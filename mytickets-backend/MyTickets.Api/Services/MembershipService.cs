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
        membership.TierId = tier.Id;
        membership.ExpiresAt = expires;
        // An approved request for this membership has now done its job.
        await db.MembershipRequests.Where(r => r.UserId == userId && r.TierId == tier.Id && r.Status == RequestStatus.Approved)
            .ExecuteUpdateAsync(u => u.SetProperty(r => r.Status, RequestStatus.Completed));
        await db.SaveChangesAsync();
        await wallets.GetOrCreateAsync(userId, organisationId);
        return membership;
    }
}
