using System.Globalization;
using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

/// <summary>
/// Manage › Overview: what the organisation took in over a period and what it actually gets paid. Online
/// payments go through Stripe to MyTickets first; each is passed on minus MyTickets' fee (Stripe's own cost
/// included) and Stripe's costs of earlier payouts to the bank (0.25% + €0.10 each, and €2 for every month
/// with payouts). Cash taken at the bar
/// never goes through MyTickets. Bar sales are paid in tokens, which guests bought earlier with that money.
/// </summary>
public static class OverviewEndpoints
{
    /// <summary>At most this many payments are listed one by one; the totals always count all of them.</summary>
    private const int PaymentsListed = 200;
    /// <summary>A longer period is shown per month instead of per day.</summary>
    private const int MaxDaysPerDay = 62;

    public static void MapOverview(this RouteGroupBuilder admin)
    {
        // from and to are days on the local clock, both included; leaving them out means from the start, until now.
        admin.MapGet("/summary", async (string? from, string? to, HttpContext http, AppDbContext db, IConfiguration config, TimeProvider clock) =>
        {
            var org = http.Org().Org;
            var zone = MembershipService.LocalZone(config);
            var now = clock.GetUtcNow().UtcDateTime;
            if (!TryDay(from, out var fromDay) || !TryDay(to, out var toDay)) return Http.Error(400, "Dates look like 2026-11-22.");
            var start = fromDay is { } f ? TimeZoneInfo.ConvertTimeToUtc(f.ToDateTime(TimeOnly.MinValue), zone) : DateTime.MinValue;
            var end = toDay is { } t ? TimeZoneInfo.ConvertTimeToUtc(t.AddDays(1).ToDateTime(TimeOnly.MinValue), zone) : DateTime.MaxValue;
            if (end <= start) return Http.Error(400, "The end date comes before the start date.");

            // ---- Online payments, by the moment they were paid ----
            var paid = await db.Payments.AsNoTracking()
                .Where(p => p.OrganisationId == org.Id && p.Status == PaymentStatus.Paid && p.CompletedAt >= start && p.CompletedAt < end)
                .OrderByDescending(p => p.CompletedAt).ToListAsync();
            var rules = PaymentService.FeeRulesFrom(config);
            var payments = paid.Select(p => PaymentLine.Of(p, rules)).ToList();
            // Test checkout payments are listed, but are no real money.
            var real = payments.Where(p => !p.Test).ToList();

            var sources = Enum.GetValues<PaymentPurpose>().Select(purpose =>
            {
                var lines = real.Where(p => p.Purpose == purpose).ToList();
                return new
                {
                    Purpose = purpose,
                    Count = lines.Count,
                    PaidCents = lines.Sum(p => p.AmountCents),
                    FeeCents = lines.Sum(p => p.FeeCents),
                    AccountFeeCents = lines.Sum(p => p.AccountFeeCents),
                    PayoutFeeCents = lines.Sum(p => p.PayoutFeeCents),
                    NetCents = lines.Sum(p => p.NetCents),
                };
            }).ToList();

            // ---- The wallets: cash at the bar, bar sales, and tokens ----
            var ledger = await db.WalletTransactions.AsNoTracking()
                .Where(t => db.Wallets.Any(w => w.Id == t.WalletId && w.OrganisationId == org.Id) && t.CreatedAt >= start && t.CreatedAt < end)
                .Select(t => new { t.Type, t.AmountCents, t.DepositCents, t.CreatedAt }).ToListAsync();
            var bar = ledger.Where(t => t.Type is WalletTxType.Purchase or WalletTxType.Return).ToList();
            var cash = ledger.Where(t => t.Type == WalletTxType.CashTopUp).ToList();
            // Deposit money is held for guests until their cups come back, so it isn't takings.
            int Takings(IEnumerable<(int Amount, int Deposit)> rows) => rows.Sum(r => -r.Amount - r.Deposit);

            var buckets = BucketsOf(start == DateTime.MinValue ? ledger.Select(t => t.CreatedAt).Concat(paid.Select(p => p.CompletedAt!.Value)).DefaultIfEmpty(now).Min() : start,
                end == DateTime.MaxValue ? now : Min(end, now), zone);
            string BucketOf(DateTime utc) => buckets.Key(TimeZoneInfo.ConvertTimeFromUtc(utc, zone));
            var barByBucket = bar.GroupBy(t => BucketOf(t.CreatedAt)).ToDictionary(g => g.Key, g => Takings(g.Select(t => (t.AmountCents, t.DepositCents))));
            var salesByBucket = bar.Where(t => t.Type == WalletTxType.Purchase).GroupBy(t => BucketOf(t.CreatedAt)).ToDictionary(g => g.Key, g => g.Count());
            var moneyByBucket = paid.Select(p => (p.CompletedAt!.Value, p.AmountCents)).Concat(cash.Select(c => (c.CreatedAt, c.AmountCents)))
                .GroupBy(x => BucketOf(x.Item1)).ToDictionary(g => g.Key, g => g.Sum(x => x.Item2));

            var onlineTopUps = paid.Where(p => p.Purpose == PaymentPurpose.TopUp).ToList();
            var tokensBought = onlineTopUps.Sum(p => p.TokensCents ?? p.AmountCents) + cash.Sum(c => c.AmountCents);
            var paidForTokens = onlineTopUps.Sum(p => p.AmountCents) + cash.Sum(c => c.AmountCents);

            // ---- Memberships and tickets ----
            var memberships = await db.Memberships.AsNoTracking().Where(m => m.OrganisationId == org.Id)
                .Select(m => new { Tier = m.Tier.Name, m.Tier.SortOrder, m.ExpiresAt }).ToListAsync();
            var active = memberships.Where(m => m.ExpiresAt is null || m.ExpiresAt > now).ToList();
            var joined = await db.MembershipPeriods.CountAsync(p => p.StartedAt >= start && p.StartedAt < end);
            var tickets = await db.Tickets.AsNoTracking()
                .Where(t => t.TicketType.Event.OrganisationId == org.Id && (t.Status == TicketStatus.Valid || t.Status == TicketStatus.CheckedIn))
                .Select(t => new { t.CreatedAt, t.CheckedInAt, t.PricePaidCents }).ToListAsync();
            var sold = tickets.Where(t => t.CreatedAt >= start && t.CreatedAt < end).ToList();

            var payoutBalance = await PaymentService.PayoutCostsBalanceAsync(db);
            var bankPayouts = await db.BankPayouts.AsNoTracking().Where(p => p.PaidAt >= start && p.PaidAt < end)
                .OrderByDescending(p => p.PaidAt).ToListAsync();
            return Results.Ok(new
            {
                Period = new { From = fromDay, To = toDay },
                Payout = new
                {
                    // Everything guests paid online, what came off it, and what is the organisation's.
                    PaidCents = real.Sum(p => p.AmountCents),
                    FeeCents = real.Sum(p => p.FeeCents),
                    AccountFeeCents = real.Sum(p => p.AccountFeeCents),
                    PayoutFeeCents = real.Sum(p => p.PayoutFeeCents),
                    YouGetCents = real.Sum(p => p.NetCents),
                    // Test checkout payments on a test server: no real money.
                    TestCents = payments.Where(p => p.Test).Sum(p => p.AmountCents),
                    MonthlyAccountFeeCents = config.GetValue("Stripe:MonthlyAccountFeeCents", 200),
                },
                // Stripe's payouts from the organisation's Stripe account to its bank, and the fee on each.
                BankPayouts = new
                {
                    Payouts = bankPayouts.Select(p => new { p.Id, p.PaidAt, p.AmountCents, p.FeeCents, p.AccountFeeCents }),
                    AmountCents = bankPayouts.Sum(p => p.AmountCents),
                    FeeCents = bankPayouts.Sum(p => p.FeeCents + p.AccountFeeCents),
                    // Right now: set aside for payout costs and not used yet (the buffer), or costs the next money still has to cover.
                    BufferCents = Math.Max(0, payoutBalance),
                    OwedCents = Math.Max(0, -payoutBalance),
                    TargetBufferCents = config.GetValue("Stripe:PayoutBufferCents", 250),
                },
                Sources = sources,
                Cash = new { Count = cash.Count, Cents = cash.Sum(c => c.AmountCents) },
                Bar = new
                {
                    Sales = bar.Count(t => t.Type == WalletTxType.Purchase),
                    TakingsCents = Takings(bar.Select(t => (t.AmountCents, t.DepositCents))),
                    DepositsOutCents = bar.Where(t => t.DepositCents > 0).Sum(t => t.DepositCents),
                    DepositsBackCents = -bar.Where(t => t.DepositCents < 0).Sum(t => t.DepositCents),
                },
                Tokens = new
                {
                    BoughtCents = tokensBought,
                    PaidCents = paidForTokens,
                    // Extra tokens from top-up deals: spent like the rest, but nobody paid for them.
                    BonusCents = tokensBought - paidForTokens,
                    SpentAtBarCents = Takings(bar.Select(t => (t.AmountCents, t.DepositCents))),
                    SpentOnTicketsCents = -ledger.Where(t => t.Type == WalletTxType.TicketPurchase).Sum(t => t.AmountCents),
                    // Right now, whatever the period: what guests can still spend, and deposits for cups still out.
                    OutstandingCents = await db.Wallets.Where(w => w.OrganisationId == org.Id).SumAsync(w => w.BalanceCents),
                    DepositsHeldCents = await db.WalletTransactions
                        .Where(t => db.Wallets.Any(w => w.Id == t.WalletId && w.OrganisationId == org.Id) && (t.Type == WalletTxType.Purchase || t.Type == WalletTxType.Return))
                        .SumAsync(t => t.DepositCents),
                },
                Memberships = new
                {
                    Active = active.Count,
                    Joined = joined,
                    ByType = active.GroupBy(m => new { m.Tier, m.SortOrder }).OrderBy(g => g.Key.SortOrder)
                        .Select(g => new { Name = g.Key.Tier, Active = g.Count() }),
                },
                Tickets = new
                {
                    Sold = sold.Count,
                    RevenueCents = sold.Sum(t => t.PricePaidCents),
                    CheckedIn = tickets.Count(t => t.CheckedInAt >= start && t.CheckedInAt < end),
                },
                ByPeriod = new
                {
                    Unit = buckets.Unit,
                    Points = buckets.All.Select(key => new
                    {
                        Key = key,
                        BarCents = barByBucket.GetValueOrDefault(key),
                        BarSales = salesByBucket.GetValueOrDefault(key),
                        MoneyInCents = moneyByBucket.GetValueOrDefault(key),
                    }),
                },
                Payments = payments.Take(PaymentsListed),
                PaymentsCount = payments.Count,
            });
        });
    }

    /// <summary>
    /// One online payment, and what the organisation gets from it. Counted as passed on once paid: the fees are those
    /// recorded when it was, or for one not recorded yet, MyTickets' fee worked out from its rules.
    /// </summary>
    private record PaymentLine(Guid Id, DateTime PaidAt, PaymentPurpose Purpose, string Description, int AmountCents,
        int FeeCents, int AccountFeeCents, int PayoutFeeCents, int NetCents, bool Test)
    {
        public static PaymentLine Of(Payment p, PaymentService.FeeRules rules)
        {
            var test = p.Provider != StripeClient.ProviderName;
            var fee = test ? 0 : p.PlatformFeeCents ?? PaymentService.PlatformFee([p.AmountCents], p.AmountCents, 0, rules);
            var account = test ? 0 : p.AccountFeeCents ?? 0;
            var payout = test ? 0 : p.PayoutFeeCents ?? 0;
            return new PaymentLine(p.Id, p.CompletedAt!.Value, p.Purpose, p.Description, p.AmountCents,
                fee, account, payout, p.AmountCents - fee - account - payout, test);
        }
    }

    /// <summary>The days (or, for a long period, months) a period is drawn in: "2026-11-22" or "2026-11".</summary>
    private record Buckets(string Unit, List<string> All, Func<DateTime, string> Key);

    private static Buckets BucketsOf(DateTime startUtc, DateTime endUtc, TimeZoneInfo zone)
    {
        var first = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(startUtc, zone));
        var last = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(endUtc.AddTicks(-1), zone));
        if (last < first) last = first;
        if (last.DayNumber - first.DayNumber < MaxDaysPerDay)
        {
            var days = Enumerable.Range(0, last.DayNumber - first.DayNumber + 1).Select(i => first.AddDays(i).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)).ToList();
            return new Buckets("day", days, local => local.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        }
        var months = new List<string>();
        for (var m = new DateOnly(first.Year, first.Month, 1); m <= last; m = m.AddMonths(1))
            months.Add(m.ToString("yyyy-MM", CultureInfo.InvariantCulture));
        return new Buckets("month", months, local => local.ToString("yyyy-MM", CultureInfo.InvariantCulture));
    }

    private static bool TryDay(string? text, out DateOnly? day)
    {
        day = null;
        if (string.IsNullOrWhiteSpace(text)) return true;
        if (!DateOnly.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed)) return false;
        day = parsed;
        return true;
    }

    private static DateTime Min(DateTime a, DateTime b) => a < b ? a : b;
}
