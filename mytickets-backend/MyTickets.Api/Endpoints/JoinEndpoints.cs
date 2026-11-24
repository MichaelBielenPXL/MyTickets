using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

/// <summary>Joining an organisation, switching membership type, or renewing. The rules are in <see cref="JoinService"/>.</summary>
public static class JoinEndpoints
{
    public record JoinRequest(Guid TierId, string? InviteCode);

    public static void MapJoin(this RouteGroupBuilder org)
    {
        // Free types apply at once; paid ones go through checkout; some wait for an admin's approval first.
        // Their record here is made now if saving their details didn't already.
        org.MapPost("/join", async (JoinRequest req, HttpContext http, JoinService join, AccountService accounts) =>
        {
            var organisation = http.Org().Org;
            var userId = http.User.TryUserId()
                ?? await accounts.EnsureRecordAtAsync(Sessions.AccountId(http) ?? throw new AppProblem(401, "Sign in first."), organisation);
            return Results.Ok(await join.JoinAsync(organisation, userId, req.TierId, req.InviteCode));
        });
    }
}
