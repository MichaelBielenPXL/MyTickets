namespace MyTickets.Api.Services;

/// <summary>Stand-in for a real payment page, for trying things out: a page with "Pay" and "Cancel". No money moves.</summary>
public static class TestCheckout
{
    public const string ProviderName = "Fake";

    /// <summary>Only on a developer's machine, or when explicitly switched on. Never quietly on a live site.</summary>
    public static bool Allowed(IConfiguration config, IHostEnvironment environment) =>
        config.GetValue<bool?>("Payments:UseTestCheckout") ?? environment.IsDevelopment();
}

/// <summary>This organisation can't take online payments. The message tells the buyer what is going on.</summary>
public class PaymentsNotSetUpException(string message) : Exception(message)
{
    public static PaymentsNotSetUpException For(string organisationName) =>
        new($"{organisationName} can't take online payments yet. Pay with your tokens, or ask the organisers.");
}
