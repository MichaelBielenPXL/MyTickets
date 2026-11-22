using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

/// <summary>The till: charging an order to a card at the bar, and topping cards up at the cashier (see <see cref="TillService"/>).</summary>
public static class StaffTillEndpoints
{
    /// <summary>The request id is made by the phone, so a sale sent twice on bad wifi is only charged once.</summary>
    public record ChargeRequest(string? CardUid, List<TillService.Item>? Items, Guid? RequestId);
    public record CashTopUpRequest(string? CardUid, int AmountCents, Guid? RequestId);

    public static void MapStaffTill(this RouteGroupBuilder staff)
    {
        staff.MapPost("/charge", async (ChargeRequest req, HttpContext http, TillService till) =>
            Results.Ok(await till.ChargeAsync(http.Org().Org.Id, req.CardUid, req.Items, req.RequestId, http.User.UserId())))
            .RequireTask(StaffTask.Bar);

        staff.MapPost("/topup", async (CashTopUpRequest req, HttpContext http, TillService till) =>
            Results.Ok(await till.TopUpAsync(http.Org().Org.Id, req.CardUid, req.AmountCents, req.RequestId, http.User.UserId())))
            .RequireTask(StaffTask.CashTopUp);
    }
}
