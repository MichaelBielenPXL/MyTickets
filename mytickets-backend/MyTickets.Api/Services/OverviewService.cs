using System.Globalization;
using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;

namespace MyTickets.Api.Services;

/// <summary>
/// Manage › Overview: what an organisation took in over a period and what it gets. Online payments go through
/// Stripe to MyTickets first; each is passed on minus MyTickets' fee (Stripe's card costs included) and what is set
/// aside for Stripe's costs of paying the organisation out. Top-ups at the cashier never go through MyTickets.
/// Bar sales are paid in tokens, which guests bought earlier with that money.
/// </summary>
public class OverviewService(AppDbContext db, IConfiguration config, TimeProvider clock)
{
    /// <summary>At most this many payments are listed one by one; the totals always count all of them.</summary>
    private const int PaymentsListed = 200;
    /// <summary>A longer period is drawn per month instead of per day.</summary>
    private const int MaxDaysPerDay = 62;

    // ---- What the overview returns ----

    public record Overview(Period Period, Payout Payout, BankPayouts BankPayouts, List<Source> Sources, Cash Cash, Bar Bar,
        Tokens Tokens, Memberships Memberships, Tickets Tickets, ByPeriod ByPeriod, List<PaymentLine> Payments, int PaymentsCount);

    /// <summary>The days asked for, on the local clock, both included. Null: from the start, or until now.</summary>
    public record Period(DateOnly? From, DateOnly? To);

    /// <summary>Everything guests paid online, what came off it, and what is the organisation's.</summary>
    public record Payout(int PaidCents, int FeeCents, int AccountFeeCents, int PayoutFeeCents, int YouGetCents,
        int TestCents, int MonthlyAccountFeeCents);

    /// <summary>Stripe's payouts to the bank, and right now the buffer set aside for the next ones (or what is still owed).</summary>
    public record BankPayouts(List<BankPayoutLine> Payouts, int AmountCents, int FeeCents, int BufferCents, int OwedCents, int TargetBufferCents);
    public record BankPayoutLine(Guid Id, DateTime PaidAt, int AmountCents, int FeeCents, int AccountFeeCents);

    /// <summary>Online payments of one kind.</summary>
    public record Source(PaymentPurpose Purpose, int Count, int PaidCents, int FeeCents, int AccountFeeCents, int PayoutFeeCents, int NetCents);

    /// <summary>Top-ups at the cashier, cash or card.</summary>
    public record Cash(int Count, int Cents);

    /// <summary>In tokens. Takings leave deposits out: those are the guests' until their cups come back.</summary>
    public record Bar(int Sales, int TakingsCents, int DepositsOutCents, int DepositsBackCents);

    /// <summary>Tokens bought and spent in the period; outstanding and deposits held are right now.</summary>
    public record Tokens(int BoughtCents, int PaidCents, int BonusCents, int SpentAtBarCents, int SpentOnTicketsCents,
        int OutstandingCents, int DepositsHeldCents);

    public record Memberships(int Active, int Joined, List<TypeCount> ByType);
    public record TypeCount(string Name, int Active);

    public record Tickets(int Sold, int RevenueCents, int CheckedIn);

    /// <summary>The period drawn per day ("2026-11-22") or, when long, per month ("2026-11").</summary>
    public record ByPeriod(string Unit, List<Point> Points);
    public record Point(string Key, int BarCents, int BarSales, int MoneyInCents);

    /// <summary>
    /// One online payment and what the organisation gets from it, counted as passed on once paid: the fees are those
    /// recorded when it was, or for one not recorded yet, MyTickets' fee worked out from its rules.
    /// </summary>
    public record PaymentLine(Guid Id, DateTime PaidAt, PaymentPurpose Purpose, string Description, int AmountCents,
        int FeeCents, int AccountFeeCents, int PayoutFeeCents, int NetCents, bool Test)
    {
        public static PaymentLine Of(Payment p, FeeRules rules)
        {
            var test = p.Provider != StripeClient.ProviderName;
            var fee = test ? 0 : p.PlatformFeeCents ?? Fees.PlatformFee([p.AmountCents], p.AmountCents, 0, rules);
            var account = test ? 0 : p.AccountFeeCents ?? 0;
            var payout = test ? 0 : p.PayoutFeeCents ?? 0;
            return new PaymentLine(p.Id, p.CompletedAt!.Value, p.Purpose, p.Description, p.AmountCents,
                fee, account, payout, p.AmountCents - fee - account - payout, test);
        }
    }

    // ---- Working it out ----

    /// <summary>A period as UTC times: from <see cref="Start"/> up to, not including, <see cref="End"/>.</summary>
    private record Range(DateTime Start, DateTime End)
    {
        public bool Contains(DateTime utc) => utc >= Start && utc < End;
    }

    /// <summary>One wallet movement, as far as the overview needs it.</summary>
    private record Movement(WalletTxType Type, int AmountCents, int DepositCents, DateTime CreatedAt)
    {
        public bool AtBar => Type is WalletTxType.Purchase or WalletTxType.Return;
        /// <summary>Deposit money is held for guests until their cups come back, so it isn't takings.</summary>
        public int TakingsCents => -AmountCents - DepositCents;
    }

    /// <summary>The overview for an organisation, from and to these local days (both included; null means open-ended).</summary>
    public async Task<Overview> ForAsync(Guid organisationId, DateOnly? from, DateOnly? to)
    {
        var zone = MembershipService.LocalZone(config);
        var now = clock.GetUtcNow().UtcDateTime;
        var range = new Range(
            from is { } f ? TimeZoneInfo.ConvertTimeToUtc(f.ToDateTime(TimeOnly.MinValue), zone) : DateTime.MinValue,
            to is { } t ? TimeZoneInfo.ConvertTimeToUtc(t.AddDays(1).ToDateTime(TimeOnly.MinValue), zone) : DateTime.MaxValue);

        var paid = await db.Payments.AsNoTracking()
            .Where(p => p.OrganisationId == organisationId && p.Status == PaymentStatus.Paid && p.CompletedAt >= range.Start && p.CompletedAt < range.End)
            .OrderByDescending(p => p.CompletedAt).ToListAsync();
        var rules = FeeRules.From(config);
        var payments = paid.Select(p => PaymentLine.Of(p, rules)).ToList();
        // Test checkout payments are listed, but are no real money.
        var real = payments.Where(p => !p.Test).ToList();

        var ledger = await db.WalletTransactions.AsNoTracking()
            .Where(t => db.Wallets.Any(w => w.Id == t.WalletId && w.OrganisationId == organisationId) && t.CreatedAt >= range.Start && t.CreatedAt < range.End)
            .Select(t => new Movement(t.Type, t.AmountCents, t.DepositCents, t.CreatedAt)).ToListAsync();
        var bar = ledger.Where(t => t.AtBar).ToList();
        var cash = ledger.Where(t => t.Type == WalletTxType.CashTopUp).ToList();

        return new Overview(
            new Period(from, to),
            PayoutOf(real, payments),
            await BankPayoutsAsync(range),
            SourcesOf(real),
            new Cash(cash.Count, cash.Sum(c => c.AmountCents)),
            BarOf(bar),
            await TokensAsync(organisationId, paid, ledger, bar, cash),
            await MembershipsAsync(organisationId, range, now),
            await TicketsAsync(organisationId, range),
            ByPeriodOf(range, paid, ledger, bar, cash, zone, now),
            payments.Take(PaymentsListed).ToList(),
            payments.Count);
    }

    private Payout PayoutOf(List<PaymentLine> real, List<PaymentLine> all) => new(
        real.Sum(p => p.AmountCents), real.Sum(p => p.FeeCents), real.Sum(p => p.AccountFeeCents), real.Sum(p => p.PayoutFeeCents),
        real.Sum(p => p.NetCents), all.Where(p => p.Test).Sum(p => p.AmountCents),
        config.GetValue("Stripe:MonthlyAccountFeeCents", 200));

    private static List<Source> SourcesOf(List<PaymentLine> real) => Enum.GetValues<PaymentPurpose>().Select(purpose =>
    {
        var lines = real.Where(p => p.Purpose == purpose).ToList();
        return new Source(purpose, lines.Count, lines.Sum(p => p.AmountCents), lines.Sum(p => p.FeeCents),
            lines.Sum(p => p.AccountFeeCents), lines.Sum(p => p.PayoutFeeCents), lines.Sum(p => p.NetCents));
    }).ToList();

    private async Task<BankPayouts> BankPayoutsAsync(Range range)
    {
        var payouts = await db.BankPayouts.AsNoTracking().Where(p => p.PaidAt >= range.Start && p.PaidAt < range.End)
            .OrderByDescending(p => p.PaidAt).ToListAsync();
        var balance = await SettlementService.PayoutCostsBalanceAsync(db);
        return new BankPayouts(
            payouts.Select(p => new BankPayoutLine(p.Id, p.PaidAt, p.AmountCents, p.FeeCents, p.AccountFeeCents)).ToList(),
            payouts.Sum(p => p.AmountCents), payouts.Sum(p => p.FeeCents + p.AccountFeeCents),
            Math.Max(0, balance), Math.Max(0, -balance), config.GetValue("Stripe:PayoutBufferCents", 250));
    }

    private static Bar BarOf(List<Movement> bar) => new(
        bar.Count(t => t.Type == WalletTxType.Purchase), bar.Sum(t => t.TakingsCents),
        bar.Where(t => t.DepositCents > 0).Sum(t => t.DepositCents), -bar.Where(t => t.DepositCents < 0).Sum(t => t.DepositCents));

    private async Task<Tokens> TokensAsync(Guid organisationId, List<Payment> paid, List<Movement> ledger, List<Movement> bar, List<Movement> cash)
    {
        var onlineTopUps = paid.Where(p => p.Purpose == PaymentPurpose.TopUp).ToList();
        var bought = onlineTopUps.Sum(p => p.TokensCents ?? p.AmountCents) + cash.Sum(c => c.AmountCents);
        var paidFor = onlineTopUps.Sum(p => p.AmountCents) + cash.Sum(c => c.AmountCents);
        var wallets = db.Wallets.Where(w => w.OrganisationId == organisationId);
        return new Tokens(
            bought, paidFor,
            // Extra tokens from top-up deals: spent like the rest, but nobody paid for them.
            bought - paidFor,
            bar.Sum(t => t.TakingsCents),
            -ledger.Where(t => t.Type == WalletTxType.TicketPurchase).Sum(t => t.AmountCents),
            // Right now, whatever the period: what guests can still spend, and deposits for cups still out.
            await wallets.SumAsync(w => w.BalanceCents),
            await db.WalletTransactions
                .Where(t => wallets.Any(w => w.Id == t.WalletId) && (t.Type == WalletTxType.Purchase || t.Type == WalletTxType.Return))
                .SumAsync(t => t.DepositCents));
    }

    private async Task<Memberships> MembershipsAsync(Guid organisationId, Range range, DateTime now)
    {
        var active = await db.Memberships.AsNoTracking()
            .Where(m => m.OrganisationId == organisationId && (m.ExpiresAt == null || m.ExpiresAt > now))
            .Select(m => new { Tier = m.Tier.Name, m.Tier.SortOrder }).ToListAsync();
        var joined = await db.MembershipPeriods.CountAsync(p => p.StartedAt >= range.Start && p.StartedAt < range.End);
        var byType = active.GroupBy(m => new { m.Tier, m.SortOrder }).OrderBy(g => g.Key.SortOrder)
            .Select(g => new TypeCount(g.Key.Tier, g.Count())).ToList();
        return new Memberships(active.Count, joined, byType);
    }

    private async Task<Tickets> TicketsAsync(Guid organisationId, Range range)
    {
        var tickets = await db.Tickets.AsNoTracking()
            .Where(t => t.TicketType.Event.OrganisationId == organisationId && (t.Status == TicketStatus.Valid || t.Status == TicketStatus.CheckedIn))
            .Select(t => new { t.CreatedAt, t.CheckedInAt, t.PricePaidCents }).ToListAsync();
        var sold = tickets.Where(t => range.Contains(t.CreatedAt)).ToList();
        return new Tickets(sold.Count, sold.Sum(t => t.PricePaidCents), tickets.Count(t => t.CheckedInAt is { } at && range.Contains(at)));
    }

    private static ByPeriod ByPeriodOf(Range range, List<Payment> paid, List<Movement> ledger, List<Movement> bar, List<Movement> cash,
        TimeZoneInfo zone, DateTime now)
    {
        // An open start begins at the first activity; an open (or future) end stops at now.
        var first = range.Start != DateTime.MinValue ? range.Start
            : ledger.Select(t => t.CreatedAt).Concat(paid.Select(p => p.CompletedAt!.Value)).DefaultIfEmpty(now).Min();
        var last = range.End < now ? range.End : now;
        var (unit, keys, keyOf) = BucketsOf(first, last, zone);
        string BucketOf(DateTime utc) => keyOf(TimeZoneInfo.ConvertTimeFromUtc(utc, zone));

        var takings = bar.GroupBy(t => BucketOf(t.CreatedAt)).ToDictionary(g => g.Key, g => g.Sum(t => t.TakingsCents));
        var sales = bar.Where(t => t.Type == WalletTxType.Purchase).GroupBy(t => BucketOf(t.CreatedAt)).ToDictionary(g => g.Key, g => g.Count());
        var moneyIn = paid.Select(p => (At: p.CompletedAt!.Value, p.AmountCents)).Concat(cash.Select(c => (At: c.CreatedAt, c.AmountCents)))
            .GroupBy(x => BucketOf(x.At)).ToDictionary(g => g.Key, g => g.Sum(x => x.AmountCents));
        return new ByPeriod(unit, keys.Select(key => new Point(key,
            takings.GetValueOrDefault(key), sales.GetValueOrDefault(key), moneyIn.GetValueOrDefault(key))).ToList());
    }

    /// <summary>The days (or, for a long period, months) from one moment to another, and which one a local time falls in.</summary>
    private static (string Unit, List<string> Keys, Func<DateTime, string> KeyOf) BucketsOf(DateTime startUtc, DateTime endUtc, TimeZoneInfo zone)
    {
        var first = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(startUtc, zone));
        var last = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(endUtc.AddTicks(-1), zone));
        if (last < first) last = first;
        if (last.DayNumber - first.DayNumber < MaxDaysPerDay)
        {
            var days = Enumerable.Range(0, last.DayNumber - first.DayNumber + 1)
                .Select(i => first.AddDays(i).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)).ToList();
            return ("day", days, local => local.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        }
        var months = new List<string>();
        for (var m = new DateOnly(first.Year, first.Month, 1); m <= last; m = m.AddMonths(1))
            months.Add(m.ToString("yyyy-MM", CultureInfo.InvariantCulture));
        return ("month", months, local => local.ToString("yyyy-MM", CultureInfo.InvariantCulture));
    }
}
