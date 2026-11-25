using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services.Email;

namespace MyTickets.Api.Services.Tickets;

/// <summary>Tickets as PDF pages, from the organisation's database: for "Download PDF" and the email after buying.</summary>
public partial class TicketDocuments(AppDbContext db, IConfiguration config)
{
    /// <summary>The pages for these tickets, in the order they were bought.</summary>
    public async Task<List<TicketPdf.Page>> PagesAsync(IReadOnlyCollection<Guid> ticketIds)
    {
        var zone = MembershipService.LocalZone(config);
        var rows = await (
            from t in db.Tickets.AsNoTracking()
            where ticketIds.Contains(t.Id)
            join e in db.Events on t.EventId equals e.Id
            join o in db.Organisations on e.OrganisationId equals o.Id
            orderby t.CreatedAt
            select new
            {
                Organisation = o.Name, Event = e.Name, e.StartsAt, e.Location, Type = t.TicketType.Name,
                t.User.FirstName, t.User.LastName, t.User.DisplayName, t.Code, t.CheckedInAt,
            }).ToListAsync();
        DateTime Local(DateTime utc) => TimeZoneInfo.ConvertTimeFromUtc(utc, zone);
        return rows.Select(r => new TicketPdf.Page(r.Organisation, r.Event, Local(r.StartsAt), r.Location, r.Type,
            r.FirstName is null ? r.DisplayName : $"{r.FirstName} {r.LastName}".Trim(), r.Code,
            r.CheckedInAt is { } used ? Local(used) : null)).ToList();
    }

    /// <summary>"night-owls-halloween-party.pdf": readable, and safe on every system.</summary>
    public static string FileName(string organisationSlug, string eventName)
    {
        var part = NotSafe().Replace(eventName.Normalize(System.Text.NormalizationForm.FormD).ToLowerInvariant(), "-").Trim('-');
        return $"{organisationSlug}{(part.Length > 0 ? "-" + part : "")}.pdf";
    }

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NotSafe();
}

/// <summary>
/// The email after buying tickets: what they are for, with the tickets attached as one PDF (a page each). Sent for the
/// <see cref="OutboxEvents.TicketsIssued"/> event, so it goes out after the purchase is saved and is tried again when
/// the mail server can't be reached.
/// </summary>
public class TicketMailer(AppDbContext db, TicketDocuments documents, IEmailSender mailer, IConfiguration config)
{
    public async Task SendAsync(IReadOnlyCollection<Guid> ticketIds)
    {
        var buyer = await db.Tickets.AsNoTracking().Where(t => ticketIds.Contains(t.Id))
            .Select(t => new { t.User.Email, t.User.FirstName, t.User.Language, Event = t.EventId }).FirstOrDefaultAsync();
        if (buyer is null) return;
        var organisation = await db.Organisations.AsNoTracking().FirstAsync();
        var ev = await db.Events.AsNoTracking().FirstAsync(e => e.Id == buyer.Event);
        var pages = await documents.PagesAsync(ticketIds);
        var dutch = buyer.Language == "nl";
        var pdf = TicketPdf.Render(pages, dutch);
        var when = TimeZoneInfo.ConvertTimeFromUtc(ev.StartsAt, MembershipService.LocalZone(config));
        var where = ev.Location.Length > 0 ? $", {ev.Location}" : "";
        var hello = buyer.FirstName is { Length: > 0 } first ? first : null;
        var lines = string.Join("\n", pages.GroupBy(p => p.TicketType).Select(g => $"  {g.Count()} × {g.Key}"));

        var text = dutch
            ? $"""
              Hallo{(hello is null ? "" : $" {hello}")},

              Je tickets voor {ev.Name} zijn er. Je vindt ze in de bijlage, en altijd onder Je tickets bij {organisation.Name}.

              {ev.Name}
              {when:dd/MM/yyyy HH:mm}{where}
              {lines}

              Toon de QR-code aan de deur, op je telefoon of geprint. Met elk ticket kom je één keer binnen.

              Tot dan!
              {organisation.Name}
              """
            : $"""
              Hello{(hello is null ? "" : $" {hello}")},

              Here are your tickets for {ev.Name}. They're attached, and always under Your tickets at {organisation.Name}.

              {ev.Name}
              {when:dd/MM/yyyy HH:mm}{where}
              {lines}

              Show the QR code at the door, on your phone or printed. Each ticket gets you in once.

              See you there!
              {organisation.Name}
              """;
        await mailer.SendAsync(new EmailMessage(buyer.Email, dutch ? $"Je tickets voor {ev.Name}" : $"Your tickets for {ev.Name}", text,
            [new EmailAttachment(TicketDocuments.FileName(organisation.Slug, ev.Name), "application/pdf", pdf)]));
    }
}
