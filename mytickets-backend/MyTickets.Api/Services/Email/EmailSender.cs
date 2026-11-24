using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace MyTickets.Api.Services.Email;

/// <summary>One email: to whom, the subject, and the text (plain text, which every mail app shows well).</summary>
public record EmailMessage(string To, string Subject, string Text);

/// <summary>Sends email. Which one is used depends on whether the server has a mail account set up (see <see cref="EmailSetup"/>).</summary>
public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken ct = default);
}

/// <summary>
/// The mail account the server sends from, from configuration: Email:Host, Email:Port (587), Email:User,
/// Email:Password, Email:From and Email:FromName ("MyTickets"). Any SMTP provider will do.
/// </summary>
public record EmailSettings(string Host, int Port, string? User, string? Password, string From, string FromName)
{
    public static EmailSettings? FromConfig(IConfiguration config) =>
        config["Email:Host"] is { Length: > 0 } host && config["Email:From"] is { Length: > 0 } from
            ? new(host, config.GetValue("Email:Port", 587), config["Email:User"], config["Email:Password"], from,
                config["Email:FromName"] ?? "MyTickets")
            : null;
}

/// <summary>Sends through the configured SMTP server, encrypted (STARTTLS, or TLS on port 465).</summary>
public class SmtpEmailSender(EmailSettings settings) : IEmailSender
{
    public async Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        var mail = new MimeMessage();
        mail.From.Add(new MailboxAddress(settings.FromName, settings.From));
        mail.To.Add(MailboxAddress.Parse(message.To));
        mail.Subject = message.Subject;
        mail.Body = new TextPart("plain") { Text = message.Text };

        using var smtp = new SmtpClient();
        await smtp.ConnectAsync(settings.Host, settings.Port, settings.Port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls, ct);
        if (!string.IsNullOrEmpty(settings.User)) await smtp.AuthenticateAsync(settings.User, settings.Password ?? "", ct);
        await smtp.SendAsync(new MailKit.SendRequest(mail), ct);
        await smtp.DisconnectAsync(true, ct);
    }
}

/// <summary>
/// Without a mail account set up nothing can be sent: the email goes to the server log instead, so things can still
/// be tried on a developer's machine. On a live site that means the person never gets it, so it is logged as a warning.
/// </summary>
public class LogOnlyEmailSender(ILogger<LogOnlyEmailSender> log) : IEmailSender
{
    public Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        log.LogWarning("Email is not set up (Email:Host, Email:From), so this email to {To} was not sent:\n{Subject}\n\n{Text}",
            message.To, message.Subject, message.Text);
        return Task.CompletedTask;
    }
}

public static class EmailSetup
{
    /// <summary>The SMTP sender when a mail account is configured, otherwise the log.</summary>
    public static IServiceCollection AddEmail(this IServiceCollection services, IConfiguration config)
    {
        if (EmailSettings.FromConfig(config) is { } settings) services.AddSingleton<IEmailSender>(new SmtpEmailSender(settings));
        else services.AddSingleton<IEmailSender, LogOnlyEmailSender>();
        return services;
    }
}
