using System.Globalization;
using QRCoder;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace MyTickets.Api.Services.Tickets;

/// <summary>
/// Tickets as a PDF to print or show at the door: one A4 page per ticket with what it is for and a large QR code of its
/// code. The QR code is vector, so it stays sharp at any size. Used for "Download PDF" and the email after buying.
/// </summary>
public static class TicketPdf
{
    /// <summary>One ticket's page. <see cref="StartsAt"/> and <see cref="UsedAt"/> are local (Belgian) times.</summary>
    public record Page(string OrganisationName, string EventName, DateTime StartsAt, string Location, string TicketType,
        string? HolderName, string Code, DateTime? UsedAt);

    public static byte[] Render(IReadOnlyList<Page> pages, bool dutch) =>
        Document.Create(document =>
        {
            foreach (var ticket in pages) document.Page(page => Draw(page, ticket, dutch));
        }).GeneratePdf();

    private static void Draw(PageDescriptor page, Page ticket, bool dutch)
    {
        var muted = Colors.Grey.Darken1;
        page.Size(PageSizes.A4);
        page.Margin(20, Unit.Millimetre);
        page.DefaultTextStyle(text => text.FontSize(11).FontColor("#333333"));
        page.Content().Column(column =>
        {
            column.Spacing(3);
            // Who it is from, and for what.
            column.Item().Text(ticket.OrganisationName.ToUpperInvariant()).FontSize(10).FontColor(muted).LetterSpacing(0.05f);
            column.Item().PaddingTop(4).Text(ticket.EventName).FontSize(24).Bold().FontColor("#141414");
            column.Item().Text(When(ticket.StartsAt, dutch)).FontSize(13);
            if (ticket.Location.Length > 0) column.Item().Text(ticket.Location).FontSize(13);

            // The ticket itself.
            column.Item().PaddingVertical(10).LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten2);
            column.Item().Row(row =>
            {
                row.RelativeItem().Column(cell =>
                {
                    cell.Item().Text("Ticket").FontSize(9).FontColor(muted);
                    cell.Item().Text(ticket.TicketType).FontSize(14).Bold().FontColor("#141414");
                });
                if (ticket.HolderName is { Length: > 0 } holder)
                    row.RelativeItem().Column(cell =>
                    {
                        cell.Item().Text(dutch ? "Naam" : "Name").FontSize(9).FontColor(muted);
                        cell.Item().Text(holder).FontSize(14).Bold().FontColor("#141414");
                    });
            });

            // The code to scan, in the middle of the page.
            column.Item().PaddingTop(18).AlignCenter().Width(75, Unit.Millimetre).Height(75, Unit.Millimetre).Svg(QrSvg(ticket.Code));
            column.Item().PaddingTop(6).AlignCenter().Text(ticket.Code).FontSize(11).FontColor("#555555").LetterSpacing(0.08f);
            column.Item().PaddingTop(10).AlignCenter()
                .Text(dutch ? "Toon deze QR-code aan de deur. Met elk ticket kom je één keer binnen."
                    : "Show this QR code at the door. Each ticket gets you in once.").FontColor("#505050");
            if (ticket.UsedAt is { } used)
                column.Item().AlignCenter()
                    .Text(dutch ? $"Al gebruikt: binnengekomen op {When(used, dutch)}." : $"Already used: checked in {When(used, dutch)}.")
                    .FontColor("#b42318");
        });
    }

    /// <summary>"Sat 31/10/2026 22:00" ("za 31/10/2026 22:00"), as the app writes dates.</summary>
    private static string When(DateTime local, bool dutch)
    {
        var culture = CultureInfo.GetCultureInfo(dutch ? "nl-BE" : "en-GB");
        return $"{culture.DateTimeFormat.GetAbbreviatedDayName(local.DayOfWeek).TrimEnd('.')} {local:dd/MM/yyyy HH:mm}";
    }

    private static string QrSvg(string code)
    {
        using var data = QRCodeGenerator.GenerateQrCode(code, QRCodeGenerator.ECCLevel.M);
        return new SvgQRCode(data).GetGraphic(10, "#000000", "#ffffff", drawQuietZones: true, sizingMode: SvgQRCode.SizingMode.ViewBoxAttribute);
    }
}
