using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

/// <summary>Checking whose card this is, and (staff and admins) looking members up by name, email or card.</summary>
public static class StaffCardEndpoints
{
    public record LookupRequest(string? CardUid, Guid? EventId);

    /// <summary>A search shows at most this many members; typing more of the name narrows it down.</summary>
    private const int MembersShown = 50;

    public static void MapStaffCards(this RouteGroupBuilder staff)
    {
        staff.MapPost("/lookup", async (LookupRequest req, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var org = http.Org().Org;
            var holder = await CardLookup.FindHolderAsync(db, org.Id, req.CardUid);
            var now = clock.GetUtcNow().UtcDateTime;
            var tickets = req.EventId is null ? [] : await db.Tickets.AsNoTracking()
                .Where(t => t.EventId == req.EventId && t.UserId == holder.User.Id &&
                            (t.Status == TicketStatus.Valid || t.Status == TicketStatus.CheckedIn))
                .Select(t => new { TicketType = t.TicketType.Name, t.Status, t.CheckedInAt }).ToListAsync();
            return Results.Ok(new
            {
                Name = holder.User.DisplayName, Tier = holder.Membership.Tier.Name,
                MembershipActive = holder.Membership.IsActive(now), holder.Membership.ExpiresAt,
                holder.Wallet.BalanceCents, Tickets = tickets,
                DrinkDiscountPercent = holder.Membership.IsActive(now) ? holder.Membership.Tier.DrinkDiscountPercent : 0,
                // For staff who go on to look the member up (see /members/{id}).
                MemberId = holder.Membership.Id,
            });
        }).RequireTask(StaffTask.CheckCard);

        // ---- Member info: staff and admins look a member up, by name or email, or by their card ----
        staff.MapGet("/members", async (string? search, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var orgId = http.Org().Org.Id;
            var now = clock.GetUtcNow().UtcDateTime;
            var members = db.Memberships.AsNoTracking().Where(m => m.OrganisationId == orgId);
            var wanted = search?.Trim() ?? "";
            if (wanted.Length > 0)
            {
                // SQLite's LIKE ignores case. % and _ typed in are taken literally.
                var pattern = $"%{wanted.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_")}%";
                members = members.Where(m => EF.Functions.Like(m.User.DisplayName, pattern, "\\")
                    || EF.Functions.Like(m.User.Email, pattern, "\\")
                    || EF.Functions.Like((m.User.FirstName ?? "") + " " + (m.User.LastName ?? ""), pattern, "\\"));
            }
            var found = await members.OrderBy(m => m.User.DisplayName).Take(MembersShown)
                .Select(m => new { m.Id, m.User.DisplayName, m.User.Email, Tier = m.Tier.Name, m.ExpiresAt }).ToListAsync();
            return Results.Ok(found.Select(m => new { m.Id, m.DisplayName, m.Email, m.Tier, MembershipActive = m.ExpiresAt is null || m.ExpiresAt > now }));
        }).RequireTask(StaffTask.MemberInfo);

        staff.MapGet("/members/{id:guid}", async (Guid id, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var orgId = http.Org().Org.Id;
            var now = clock.GetUtcNow().UtcDateTime;
            var member = await db.Memberships.AsNoTracking().Include(m => m.User).Include(m => m.Tier)
                .FirstOrDefaultAsync(m => m.Id == id && m.OrganisationId == orgId);
            if (member is null) return Http.Error(404, "Member not found.");
            var user = member.User;
            var wallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(w => w.UserId == user.Id && w.OrganisationId == orgId);
            var cards = wallet is null ? [] : await db.NfcCards.AsNoTracking().Where(c => c.WalletId == wallet.Id).OrderBy(c => c.LinkedAt)
                .Select(c => new { c.Number, c.Label, c.Blocked, c.LinkedAt }).ToListAsync();
            return Results.Ok(new
            {
                member.Id, user.DisplayName, user.Email, member.Role, member.TierId, Tier = member.Tier.Name, member.JoinedAt, member.ExpiresAt,
                MembershipActive = member.IsActive(now), BalanceCents = wallet?.BalanceCents ?? 0,
                ExtraCardAllowed = wallet?.ExtraCardAllowed ?? false,
                // For an admin's edit form: which details this organisation asks, as on the member's own My details.
                Fields = ProfileFields.Read(await db.Organisations.AsNoTracking().FirstAsync()), Profile = ProfileFields.Of(user),
                user.FirstName, user.LastName, user.Phone, user.Street, user.PostalCode, user.City, user.School, user.Faculty, user.StudyYear,
                Cards = cards.Select(c => new { Number = CardCodes.Display(c.Number), c.Label, c.Blocked, c.LinkedAt }),
                History = await MembershipService.HistoryAsync(db, user.Id, now),
            });
        }).RequireTask(StaffTask.MemberInfo);
    }
}
