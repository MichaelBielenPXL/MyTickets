using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;

namespace MyTickets.Api.Services;

public class MembershipService(AppDbContext db, WalletService wallets, IConfiguration config, TimeProvider clock)
{
    /// <summary>The clock dates are read on: the end date "30 June" means midnight in Belgium, not in UTC.</summary>
    public static TimeZoneInfo LocalZone(IConfiguration config) =>
        TimeZoneInfo.FindSystemTimeZoneById(config["App:TimeZone"] ?? "Europe/Brussels");

    /// <summary>
    /// Puts the user on the tier: creates the membership (and wallet) on first join, otherwise switches tier.
    /// The membership runs until the tier's end date, or forever when it has none.
    /// </summary>
    public async Task<Membership> ApplyTierAsync(Guid userId, Guid organisationId, MembershipTier tier, OrgRole roleIfNew = OrgRole.Member)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var membership = await db.Memberships.FirstOrDefaultAsync(m => m.UserId == userId && m.OrganisationId == organisationId);

        var expires = tier.ExpiresAt(LocalZone(config));

        if (membership is null)
        {
            membership = new Membership
            {
                Id = Guid.NewGuid(), UserId = userId, OrganisationId = organisationId, Role = roleIfNew, JoinedAt = now,
            };
            db.Memberships.Add(membership);
        }
        await RecordPeriodAsync(userId, tier, expires);
        membership.TierId = tier.Id;
        membership.ExpiresAt = expires;
        // An approved request for this membership has now done its job.
        await db.MembershipRequests.Where(r => r.UserId == userId && r.TierId == tier.Id && r.Status == RequestStatus.Approved)
            .ExecuteUpdateAsync(u => u.SetProperty(r => r.Status, RequestStatus.Completed));
        await db.SaveChangesAsync();
        await wallets.GetOrCreateAsync(userId, organisationId);
        return membership;
    }

    public record PeriodView(Guid Id, string TierName, DateTime StartedAt, DateTime? EndsAt, bool Current);

    /// <summary>Every membership the person has had here, newest first. The member, admins and staff all see this.</summary>
    public static async Task<List<PeriodView>> HistoryAsync(AppDbContext db, Guid userId, DateTime now) =>
        (await db.MembershipPeriods.AsNoTracking().Where(p => p.UserId == userId).OrderByDescending(p => p.StartedAt).ToListAsync())
        .Select(p => new PeriodView(p.Id, p.TierName, p.StartedAt, p.EndsAt, p.EndsAt is null || p.EndsAt > now)).ToList();

    /// <summary>
    /// Keeps the membership history in step with a change to someone's membership (saved with the caller's
    /// changes). The same type running on, perhaps to another end date, stays one period; another type, or
    /// joining again after the last one ran out, starts a new one and ends the one still running.
    /// </summary>
    public async Task RecordPeriodAsync(Guid userId, MembershipTier tier, DateTime? expiresAt)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var running = await db.MembershipPeriods.Where(p => p.UserId == userId && (p.EndsAt == null || p.EndsAt > now))
            .OrderByDescending(p => p.StartedAt).FirstOrDefaultAsync();
        if (running?.TierId == tier.Id)
        {
            running.EndsAt = expiresAt;
            return;
        }
        if (running is not null) running.EndsAt = now;
        // Put on a type that has already run out: nothing new to remember.
        if (expiresAt <= now) return;
        db.MembershipPeriods.Add(new MembershipPeriod
        {
            Id = Guid.NewGuid(), UserId = userId, TierId = tier.Id, TierName = tier.Name, StartedAt = now, EndsAt = expiresAt,
        });
    }
}
