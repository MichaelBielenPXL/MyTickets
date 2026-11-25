namespace MyTickets.Api.Services;

/// <summary>Price sums shared by tickets and the bar.</summary>
public static class Prices
{
    /// <summary>A price with a membership discount off, rounded to the nearest cent.</summary>
    public static int Discounted(int priceCents, int percent) => (priceCents * (100 - percent) + 50) / 100;
}
