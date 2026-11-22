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

    /// <summary>
    /// An admin changing someone's membership: its type, their role, or its end date. Another type runs until that
    /// type's end date, as if they had joined it; the same type keeps the date given, so an admin can set one by hand.
    /// Saves the change and its history. Returns why it can't be done, or null when it was.
    /// </summary>
    public async Task<string?> ChangeAsync(Membership member, MembershipTier tier, OrgRole role, DateTime? expiresAt)
    {
        var zone = LocalZone(config);
        var tierChanged = member.TierId != tier.Id;
        if (tierChanged && tier.HasEnded(clock.GetUtcNow().UtcDateTime, zone))
            return $"\"{tier.Name}\" ended on {tier.EndsOn:dd/MM/yyyy}. Give it a new end date first, or choose another membership.";
        if (member.Role == OrgRole.Admin && role != OrgRole.Admin &&
            await db.Memberships.CountAsync(m => m.OrganisationId == member.OrganisationId && m.Role == OrgRole.Admin) == 1)
            return "An organisation needs at least one admin.";

        var newExpiry = tierChanged ? tier.ExpiresAt(zone) : expiresAt;
        if (tierChanged || member.ExpiresAt != newExpiry) await RecordPeriodAsync(member.UserId, tier, newExpiry);
        member.Role = role;
        member.TierId = tier.Id;
        member.ExpiresAt = newExpiry;
        await db.SaveChangesAsync();
        return null;
    }

    /// <summary>
    /// A membership type got a new end date (say, the season got longer): everyone who still has it from this type
    /// follows, and so does their history. Members whose date an admin set by hand keep theirs. Once it has run out it
    /// stays run out: reopening an ended type for a new season means its old members join (and pay) again.
    /// </summary>
    public async Task MoveEndDateAsync(MembershipTier tier, DateTime? oldExpiry)
    {
        var newExpiry = tier.ExpiresAt(LocalZone(config));
        if (newExpiry == oldExpiry || (oldExpiry is not null && oldExpiry <= clock.GetUtcNow().UtcDateTime)) return;
        await db.Memberships.Where(m => m.TierId == tier.Id && m.ExpiresAt == oldExpiry)
            .ExecuteUpdateAsync(u => u.SetProperty(m => m.ExpiresAt, newExpiry));
        await db.MembershipPeriods.Where(p => p.TierId == tier.Id && p.EndsAt == oldExpiry)
            .ExecuteUpdateAsync(u => u.SetProperty(p => p.EndsAt, newExpiry));
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
