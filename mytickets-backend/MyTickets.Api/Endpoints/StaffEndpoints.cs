using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

/// <summary>
/// What the people at the door and behind the bar use. Everyone who works at an event gets in here; each endpoint
/// then checks the job is theirs. The jobs have their own files: checking cards and looking members up
/// (<see cref="StaffCardEndpoints"/>), the door (<see cref="StaffDoorEndpoints"/>), and the till (<see cref="StaffTillEndpoints"/>).
/// </summary>
public static class StaffEndpoints
{
    public static void MapStaff(this IEndpointRouteBuilder app)
    {
        var staff = app.MapGroup("/api/orgs/{slug}/staff").RequireOrg(OrgRole.Barman);

        staff.MapGet("/context", async (HttpContext http, AppDbContext db, AppCache cache, TimeProvider clock) =>
        {
            var org = http.Org().Org;
            var now = clock.GetUtcNow().UtcDateTime;
            var events = (await db.Events.AsNoTracking()
                .Where(e => e.OrganisationId == org.Id && e.Published).Where(Event.NotClosed(now))
                .OrderBy(e => e.StartsAt).ToListAsync())
                .Select(e => new { e.Id, e.Name, e.StartsAt, Status = e.Status(now) });
            // The app shows only the jobs this person does.
            var tasks = StaffTasks.For(http.Org().Membership!.Role).Select(t => t.ToString());
            return Results.Ok(new { org.Name, Tasks = tasks, Events = events, Products = await cache.ActiveProductsAsync(org.Id), Categories = await cache.CategoriesAsync(org.Id) });
        });

        staff.MapStaffCards();
        staff.MapStaffDoor();
        staff.MapStaffTill();
    }
}
