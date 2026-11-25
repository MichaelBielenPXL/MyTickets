using MyTickets.Api.Data;

namespace MyTickets.Api.Endpoints;

/// <summary>
/// Manage: everything an organisation's admins do, under one address only admins get into. Each area has its own
/// file: the overview, the organisation, memberships and members, events, and the bar.
/// </summary>
public static class AdminEndpoints
{
    public static void MapAdmin(this IEndpointRouteBuilder app)
    {
        var admin = app.MapGroup("/api/orgs/{slug}/admin").RequireOrg(OrgRole.Admin);
        admin.MapOverview();
        admin.MapAdminOrganisation();
        admin.MapAdminMemberships();
        admin.MapAdminEvents();
        admin.MapAdminBar();
    }
}
