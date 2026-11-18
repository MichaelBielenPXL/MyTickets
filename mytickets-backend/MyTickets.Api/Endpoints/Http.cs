using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

/// <summary>The organisation named in the URL and the caller's membership of it (null when not a member).</summary>
public record OrgAccess(Organisation Org, Membership? Membership);

public static class Http
{
    public static IResult Error(int status, string message) => Results.Json(new { error = message }, statusCode: status);

    public static Guid UserId(this ClaimsPrincipal user) => Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public static OrgAccess Org(this HttpContext http) => (OrgAccess)http.Items["org"]!;

    /// <summary>Loads the organisation from the {slug} in the URL and refuses callers below the given role.</summary>
    public static RouteGroupBuilder RequireOrg(this RouteGroupBuilder group, OrgRole? minimumRole)
    {
        group.RequireAuthorization();
        group.AddEndpointFilter((ctx, next) => OrgFilter(ctx, next, minimumRole));
        return group;
    }

    /// <summary>For one job at the event (bar, door...): refuses roles that don't do it.</summary>
    public static RouteHandlerBuilder RequireTask(this RouteHandlerBuilder endpoint, StaffTask task) =>
        endpoint.AddEndpointFilter(async (ctx, next) =>
            ctx.HttpContext.Org().Membership is { } m && StaffTasks.Can(m.Role, task)
                ? await next(ctx)
                : Error(403, "You don't have access to this."));

    public static async ValueTask<object?> OrgFilter(EndpointFilterInvocationContext ctx, EndpointFilterDelegate next, OrgRole? minimumRole)
    {
        var http = ctx.HttpContext;
        var db = http.RequestServices.GetRequiredService<AppDbContext>();
        var slug = http.Request.RouteValues["slug"] as string;
        var org = await http.RequestServices.GetRequiredService<AppCache>().OrganisationBySlugAsync(slug ?? "");
        if (org is null) return Error(404, "Organisation not found.");
        var userId = http.User.UserId();
        var membership = await db.Memberships.AsNoTracking().Include(m => m.Tier)
            .FirstOrDefaultAsync(m => m.OrganisationId == org.Id && m.UserId == userId);
        if (minimumRole is { } min)
        {
            if (membership is null) return Error(403, "Join this organisation first.");
            if (membership.Role < min) return Error(403, "You don't have access to this.");
        }
        http.Items["org"] = new OrgAccess(org, membership);
        return await next(ctx);
    }

    public static DateTime Utc(DateTime value) =>
        value.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(value, DateTimeKind.Utc) : value.ToUniversalTime();

    public static DateTime? Utc(DateTime? value) => value is { } v ? Utc(v) : null;

    public static int Discounted(int priceCents, int percent) => (priceCents * (100 - percent) + 50) / 100;

    /// <summary>Card serial numbers arrive as "04:a2:1b:..." from phones or typed by hand; store one canonical form.</summary>
    public static string? NormaliseCardUid(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var hex = new string(raw.Where(Uri.IsHexDigit).ToArray()).ToUpperInvariant();
        var separatorsOnly = raw.All(c => Uri.IsHexDigit(c) || c is ':' or '-' or ' ');
        return separatorsOnly && hex.Length is >= 8 and <= 20 ? hex : null;
    }

    /// <summary>1250 -> "€12,50", the European way.</summary>
    public static string Euro(int cents) => $"€{cents / 100},{cents % 100:00}";

    /// <summary>Members spend tokens, one per euro: 700 -> "7 tokens", 1250 -> "12,50 tokens", 100 -> "1 token".</summary>
    public static string Tokens(int cents) =>
        (cents % 100 == 0 ? $"{cents / 100}" : $"{cents / 100},{cents % 100:00}") + (cents == 100 ? " token" : " tokens");
}
