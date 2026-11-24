using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services.Email;

namespace MyTickets.Api.Services;

/// <summary>
/// "Forgot your password?": a link by email to choose a new password for a MyTickets account. The link is signed with
/// the app's data protection keys, is valid for an hour, and works once: it carries a fingerprint of the current
/// password, so it stops working once the password has changed. Nothing is stored for it.
/// </summary>
public class PasswordResetService(PlatformDbContext platform, AccountService accounts, IDataProtectionProvider protection,
    IEmailSender mailer, TimeProvider clock, ILogger<PasswordResetService> log)
{
    public static readonly TimeSpan LinkLifetime = TimeSpan.FromHours(1);

    private ITimeLimitedDataProtector Protector => protection.CreateProtector("password-reset").ToTimeLimitedDataProtector();

    /// <summary>Whose password a link resets, the organisation to go back to (if asked from one), and the password's fingerprint.</summary>
    private record Target(Guid AccountId, string? Slug, string Stamp);

    /// <summary>
    /// Emails a reset link when there is an account with this address. Says nothing either way, so nobody can find out
    /// who has an account. Asked at an organisation, the link and the email are that organisation's.
    /// <paramref name="site"/> is the address the link points to; <paramref name="language"/> "nl" writes it in Dutch.
    /// </summary>
    public async Task RequestAsync(string email, string? organisationSlug, string site, string? language)
    {
        var account = await accounts.FindAsync(email);
        if (account is null) return;
        var tenant = string.IsNullOrWhiteSpace(organisationSlug)
            ? null
            : await platform.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Slug == organisationSlug.Trim());
        var token = TokenFor(new Target(account.Id, tenant?.Slug, StampOf(account.PasswordHash)));
        var link = $"{site}{(tenant is null ? "" : $"/{tenant.Slug}")}/reset-password?token={Uri.EscapeDataString(token)}";

        try
        {
            await mailer.SendAsync(Message(account.Email, tenant?.Name, link, language == "nl"));
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            // The person is told the same either way; the failure is ours to look into.
            log.LogError(e, "Sending a password reset email failed");
        }
    }

    /// <summary>Sets the new password. Returns the organisation the link was asked from (null: the front page), to sign in there next.</summary>
    public async Task<string?> ResetAsync(string? token, string? password)
    {
        if ((password?.Length ?? 0) < AccountService.MinimumPasswordLength) throw AppProblem.BadRequest("Choose a password of at least 8 characters.");
        var target = Read(token) ?? throw Expired();
        var account = await accounts.FindAsync(target.AccountId);
        if (account is null || StampOf(account.PasswordHash) != target.Stamp) throw Expired();
        await accounts.SetPasswordAsync(account.Id, password!);
        return target.Slug;
    }

    private string TokenFor(Target target) =>
        Protector.Protect($"{target.AccountId}|{target.Slug}|{target.Stamp}", clock.GetUtcNow() + LinkLifetime);

    /// <summary>The link's account, or null when it isn't one of ours, was changed, or has run out.</summary>
    private Target? Read(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        try
        {
            var parts = Protector.Unprotect(token, out var expires).Split('|');
            if (expires < clock.GetUtcNow() || parts.Length != 3 || !Guid.TryParse(parts[0], out var accountId)) return null;
            return new Target(accountId, parts[1].Length > 0 ? parts[1] : null, parts[2]);
        }
        catch (CryptographicException)
        {
            return null;
        }
    }

    /// <summary>A short fingerprint of the password as stored: changes with every new password, reveals nothing of it.</summary>
    private static string StampOf(string passwordHash) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(passwordHash)))[..16];

    private static AppProblem Expired() =>
        AppProblem.BadRequest("This link has run out or was already used. Ask for a new one.");

    private static EmailMessage Message(string to, string? organisation, string link, bool dutch)
    {
        var where = organisation is null ? "" : dutch ? $" (via {organisation})" : $" (from {organisation})";
        return dutch
            ? new(to, "Nieuw wachtwoord voor MyTickets",
                $"""
                Hallo,

                Iemand vroeg een nieuw wachtwoord aan voor je MyTickets-account{where}. Was jij dat? Kies dan hier een nieuw wachtwoord:

                {link}

                Deze link werkt één keer en blijft een uur geldig. Je nieuwe wachtwoord geldt voor al je organisaties. Vroeg je niets aan? Dan kun je deze e-mail negeren; er verandert niets.

                MyTickets
                """)
            : new(to, "A new password for MyTickets",
                $"""
                Hello,

                Someone asked for a new password for your MyTickets account{where}. If that was you, choose one here:

                {link}

                The link works once and for an hour. Your new password is for all your organisations. If you didn't ask, you can ignore this email; nothing changes.

                MyTickets
                """);
    }
}
