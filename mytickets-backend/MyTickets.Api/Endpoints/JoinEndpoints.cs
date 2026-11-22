using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

/// <summary>Joining an organisation, switching membership type, or renewing. The rules are in <see cref="JoinService"/>.</summary>
public static class JoinEndpoints
{
    public record JoinRequest(Guid TierId, string? InviteCode);

    public static void MapJoin(this RouteGroupBuilder org)
    {
        // Free types apply at once; paid ones go through checkout; some wait for an admin's approval first.
        org.MapPost("/join", async (JoinRequest req, HttpContext http, JoinService join) =>
            Results.Ok(await join.JoinAsync(http.Org().Org, http.User.UserId(), req.TierId, req.InviteCode)));
    }
}
