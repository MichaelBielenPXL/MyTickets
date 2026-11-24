using System.Net;
using System.Net.Http.Json;
using System.Text;

namespace MyTickets.Tests;

public class TicketEmailTests : IClassFixture<TestApp>
{
    private readonly TestApp _app;
    public TicketEmailTests(TestApp app) => _app = app;

    private static async Task<string> EmailOfAsync(HttpClient client) => (await client.GetOkAsync("/api/auth/me")).Str("email");

    private static bool IsPdf(byte[] file) => Encoding.ASCII.GetString(file, 0, 5) == "%PDF-";

    [Fact]
    public async Task Free_tickets_are_emailed_straight_away_with_a_pdf_of_them()
    {
        var shop = await _app.NewShopAsync(priceCents: 0);
        var buyer = await _app.NewBuyerAsync(shop);
        var email = await EmailOfAsync(buyer);

        await buyer.PostOkAsync($"{shop.Url}/events/{shop.EventId}/order", new { items = new[] { new { ticketTypeId = shop.TicketTypeId, quantity = 2 } } });

        var mail = Assert.Single(_app.Emails.To(email));
        Assert.StartsWith("Your tickets for", mail.Subject);
        Assert.Contains("2 × ", mail.Text);
        var pdf = Assert.Single(mail.Attachments!);
        Assert.Equal(("application/pdf", true), (pdf.ContentType, pdf.FileName.StartsWith(shop.Slug)));
        Assert.True(IsPdf(pdf.Content));
    }

    [Fact]
    public async Task Tickets_paid_online_are_emailed_once_the_payment_is_complete_in_their_language()
    {
        var shop = await _app.NewShopAsync(priceCents: 1250);
        var buyer = await _app.NewBuyerAsync(shop);
        var email = await EmailOfAsync(buyer);

        var order = await buyer.PostOkAsync($"{shop.Url}/events/{shop.EventId}/order",
            new { items = new[] { new { ticketTypeId = shop.TicketTypeId, quantity = 1 } }, payWith = "online", language = "nl" });
        // Held while paying: nothing sent yet.
        Assert.Empty(_app.Emails.To(email));

        await buyer.PayAsync(order);
        var mail = Assert.Single(_app.Emails.To(email));
        Assert.StartsWith("Je tickets voor", mail.Subject);
        Assert.True(IsPdf(Assert.Single(mail.Attachments!).Content));
    }

    [Fact]
    public async Task A_ticket_downloads_as_a_pdf_for_its_owner_only()
    {
        var shop = await _app.NewShopAsync(priceCents: 0);
        var buyer = await _app.NewBuyerAsync(shop);
        await buyer.PostOkAsync($"{shop.Url}/events/{shop.EventId}/order", new { items = new[] { new { ticketTypeId = shop.TicketTypeId, quantity = 1 } } });
        var ticketId = (await buyer.GetOkAsync($"{shop.Url}/me/tickets"))[0]!.Str("id");

        var download = await buyer.GetAsync($"{shop.Url}/me/tickets/{ticketId}/pdf?lang=nl");
        Assert.Equal(HttpStatusCode.OK, download.StatusCode);
        Assert.Equal("application/pdf", download.Content.Headers.ContentType!.MediaType);
        Assert.True(IsPdf(await download.Content.ReadAsByteArrayAsync()));

        var someoneElse = await _app.NewBuyerAsync(shop);
        Assert.Equal(HttpStatusCode.NotFound, (await someoneElse.GetAsync($"{shop.Url}/me/tickets/{ticketId}/pdf")).StatusCode);
    }
}
