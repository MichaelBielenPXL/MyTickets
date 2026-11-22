using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

/// <summary>The door: checking people in, and opening and closing an event. The rules are in <see cref="DoorService"/>.</summary>
public static class StaffDoorEndpoints
{
    public record CheckInRequest(Guid EventId, string? Code, string? CardUid);

    public static void MapStaffDoor(this RouteGroupBuilder staff)
    {
        // Let someone in: scan the ticket's QR code or their member code, or tap the card of the person who bought it.
        staff.MapPost("/checkin", async (CheckInRequest req, HttpContext http, DoorService door) =>
            Results.Ok(await door.CheckInAsync(http.Org().Org.Id, req.EventId, req.Code, req.CardUid, http.User.UserId())))
            .RequireTask(StaffTask.Door);

        staff.MapPost("/events/{eventId:guid}/open", async (Guid eventId, HttpContext http, DoorService door) =>
            Results.Ok(new { Status = await door.OpenAsync(http.Org().Org.Id, eventId) }))
            .RequireTask(StaffTask.Door);

        staff.MapPost("/events/{eventId:guid}/close", async (Guid eventId, HttpContext http, DoorService door) =>
            Results.Ok(new { Status = await door.CloseAsync(http.Org().Org.Id, eventId) }))
            .RequireTask(StaffTask.Door);
    }
}
