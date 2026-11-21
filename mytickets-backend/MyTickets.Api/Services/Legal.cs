namespace MyTickets.Api.Services;

/// <summary>The terms of service and privacy policy people agree to when they create an account.</summary>
public static class Legal
{
    /// <summary>
    /// The version shown on the site's /terms and /privacy pages. Change it together with those pages,
    /// so it stays known who agreed to which text.
    /// </summary>
    public const string TermsVersion = "2026-11-21";

    public const string NotAccepted = "Accept the terms of service and privacy policy to create an account.";
}
