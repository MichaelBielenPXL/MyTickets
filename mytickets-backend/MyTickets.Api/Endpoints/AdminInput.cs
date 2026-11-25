namespace MyTickets.Api.Endpoints;

/// <summary>Checks and helpers the Manage endpoints share.</summary>
public static class AdminInput
{
    public record OrderRequest(List<Guid>? Ids);

    private const int MaxPriceCents = 1_000_000;

    public static bool BadName(string? name) => (name?.Trim().Length ?? 0) is < 1 or > 80;
    public static bool BadPrice(int cents) => cents is < 0 or > MaxPriceCents;
    public static bool BadPercent(int p) => p is < 0 or > 100;

    /// <summary>
    /// Puts items in the order given. Items left out (added on another screen meanwhile) keep their place after the rest.
    /// </summary>
    public static IResult? Reorder<T>(List<T> items, List<Guid>? ids, Func<T, Guid> idOf, Action<T, int> setOrder)
    {
        if (ids is null || ids.Count == 0 || ids.Distinct().Count() != ids.Count) return Http.Error(400, "Send the new order.");
        var byId = items.ToDictionary(idOf);
        if (ids.Any(id => !byId.ContainsKey(id))) return Http.Error(409, "The list has changed. Reload and try again.");
        for (var i = 0; i < ids.Count; i++) setOrder(byId[ids[i]], i + 1);
        var next = ids.Count;
        foreach (var rest in items.Where(t => !ids.Contains(idOf(t)))) setOrder(rest, ++next);
        return null;
    }
}
