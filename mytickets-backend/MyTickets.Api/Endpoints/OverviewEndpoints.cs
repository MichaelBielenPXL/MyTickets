using System.Globalization;
using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

/// <summary>Manage › Overview. The figures are worked out by <see cref="OverviewService"/>.</summary>
public static class OverviewEndpoints
{
    public static void MapOverview(this RouteGroupBuilder admin)
    {
        // from and to are days on the local clock, both included; leaving them out means from the start, until now.
        admin.MapGet("/summary", async (string? from, string? to, HttpContext http, OverviewService overview) =>
        {
            if (!TryDay(from, out var fromDay) || !TryDay(to, out var toDay)) return Http.Error(400, "Dates look like 2026-11-22.");
            if (fromDay > toDay) return Http.Error(400, "The end date comes before the start date.");
            return Results.Ok(await overview.ForAsync(http.Org().Org.Id, fromDay, toDay));
        });
    }

    private static bool TryDay(string? text, out DateOnly? day)
    {
        day = null;
        if (string.IsNullOrWhiteSpace(text)) return true;
        if (!DateOnly.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed)) return false;
        day = parsed;
        return true;
    }
}
