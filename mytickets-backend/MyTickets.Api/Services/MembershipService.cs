using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;

namespace MyTickets.Api.Services;

public class MembershipService(AppDbContext db, WalletService wallets, TimeProvider clock)
{
    /// <summary>
    /// Puts the user on the tier: creates the membership (and wallet) on first join, otherwise switches tier.
    /// Buying the tier you are already on extends it from its current end date.
    /// </summary>
    public async Task<Membership> ApplyTierAsync(Guid userId, Guid organisationId, MembershipTier tier, OrgRole roleIfNew = OrgRole.Member)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var membership = await db.Memberships.FirstOrDefaultAsync(m => m.UserId == userId && m.OrganisationId == organisationId);

        DateTime? expires = null;
        if (tier.DurationDays is { } days)
        {
            var from = membership is { ExpiresAt: { } current } && membership.TierId == tier.Id && current > now ? current : now;
            expires = from.AddDays(days);
        }

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
        await db.SaveChangesAsync();
        await wallets.GetOrCreateAsync(userId, organisationId);
        return membership;
    }
}
