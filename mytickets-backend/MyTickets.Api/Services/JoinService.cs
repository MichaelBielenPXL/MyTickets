using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;

namespace MyTickets.Api.Services;

/// <summary>
/// Joining an organisation, switching membership type, or renewing. A free type starts at once; a paid one goes
/// through checkout; a type that needs approval asks an admin first. Refusals are <see cref="AppProblem"/>s.
/// </summary>
public class JoinService(AppDbContext db, MembershipService memberships, PaymentService payments, IConfiguration config, TimeProvider clock)
{
    /// <summary>Joined straight away; waiting for an admin; or off to pay at <see cref="CheckoutUrl"/>.</summary>
    public record Result(bool Joined, bool Pending, string? CheckoutUrl);

    /// <summary>Joins the type chosen, or the one an invite code belongs to (people only need the code).</summary>
    public async Task<Result> JoinAsync(Organisation organisation, Guid userId, Guid tierId, string? inviteCode)
    {
        var tier = await ChosenTierAsync(organisation.Id, tierId, inviteCode?.Trim());
        var now = clock.GetUtcNow().UtcDateTime;
        var zone = MembershipService.LocalZone(config);
        if (tier.HasEnded(now, zone))
            throw AppProblem.Conflict($"\"{tier.Name}\" ended on {tier.EndsOn:dd/MM/yyyy}. Choose another membership.");
        await RefuseIfAlreadyHadAsync(organisation.Id, userId, tier, now, zone);
        // The organisation's questions come first.
        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId);
        if (!ProfileFields.IsComplete(user, ProfileFields.Read(await db.Organisations.AsNoTracking().FirstAsync())))
            throw AppProblem.Conflict("Fill in your details first.", code: "profile-incomplete");
        if (tier.RequiresApproval && !await IsApprovedAsync(userId, tier, now)) return new Result(false, true, null);

        if (tier.PriceCents == 0)
        {
            await using var tx = await db.Database.BeginTransactionAsync();
            await memberships.ApplyTierAsync(userId, organisation.Id, tier);
            await tx.CommitAsync();
            return new Result(true, false, null);
        }
        var url = await payments.StartAsync(new Payment
        {
            Id = Guid.NewGuid(), UserId = userId, OrganisationId = organisation.Id, AmountCents = tier.PriceCents,
            Purpose = PaymentPurpose.Membership, TierId = tier.Id, Description = $"{tier.Name} membership",
        });
        return new Result(false, false, url);
    }

    private async Task<MembershipTier> ChosenTierAsync(Guid organisationId, Guid tierId, string? inviteCode)
    {
        if (!string.IsNullOrEmpty(inviteCode))
            return await db.MembershipTiers.FirstOrDefaultAsync(t => t.OrganisationId == organisationId && !t.Archived && t.InviteCode == inviteCode)
                ?? throw AppProblem.BadRequest("That invite code is not valid.");
        var tier = await db.MembershipTiers.FirstOrDefaultAsync(t => t.Id == tierId && t.OrganisationId == organisationId && !t.Archived)
            ?? throw AppProblem.NotFound("Membership type not found.");
        if (!tier.IsPublic) throw AppProblem.Forbidden("This membership needs an invite code.");
        return tier;
    }

    /// <summary>Renewing only makes sense when it gives you more time; never let someone pay for what they have.</summary>
    private async Task RefuseIfAlreadyHadAsync(Guid organisationId, Guid userId, MembershipTier tier, DateTime now, TimeZoneInfo zone)
    {
        var current = await db.Memberships.AsNoTracking().FirstOrDefaultAsync(m => m.UserId == userId && m.OrganisationId == organisationId);
        if (current is null || current.TierId != tier.Id || !current.IsActive(now) || current.ExpiresAt != tier.ExpiresAt(zone)) return;
        throw AppProblem.Conflict(current.ExpiresAt is { } until
            ? $"You already have this membership until {TimeZoneInfo.ConvertTimeFromUtc(until, zone).AddDays(-1):dd/MM/yyyy}."
            : "You already have this membership.");
    }

    /// <summary>
    /// For a type that needs an admin's yes: true once approved. Otherwise asks (one open request at a time: asking
    /// for another type replaces the earlier question), or says it is still waiting.
    /// </summary>
    private async Task<bool> IsApprovedAsync(Guid userId, MembershipTier tier, DateTime now)
    {
        var request = await db.MembershipRequests
            .Where(r => r.UserId == userId && r.TierId == tier.Id && (r.Status == RequestStatus.Pending || r.Status == RequestStatus.Approved))
            .OrderByDescending(r => r.CreatedAt).FirstOrDefaultAsync();
        if (request?.Status == RequestStatus.Approved) return true;
        if (request is not null) throw AppProblem.Conflict($"Your request for \"{tier.Name}\" is still waiting for approval.");

        await db.MembershipRequests.Where(r => r.UserId == userId && r.Status == RequestStatus.Pending).ExecuteDeleteAsync();
        db.MembershipRequests.Add(new MembershipRequest { Id = Guid.NewGuid(), UserId = userId, TierId = tier.Id, Status = RequestStatus.Pending, CreatedAt = now });
        await db.SaveChangesAsync();
        return false;
    }
}
