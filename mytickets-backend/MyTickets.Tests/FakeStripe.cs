using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using MyTickets.Api.Services;

namespace MyTickets.Tests;

/// <summary>
/// Stands in for Stripe's API: remembers the accounts and payment pages it was asked to create, and lets
/// a test decide when an organisation is approved and when a buyer pays.
/// </summary>
public class FakeStripe : HttpMessageHandler
{
    public const string SecretKey = "sk_test_platform0123456789";
    public const string WebhookSecret = "whsec_test0123456789";

    public record Account(Dictionary<string, string> Request, bool Active);
    /// <param name="DirectTo">Paid straight into an organisation's account, as payments were at first: (transfer id, application fee).</param>
    public record Session(Dictionary<string, string> Request, string Status, string PaymentStatus, int StripeFeeCents = 0,
        (string TransferId, int ApplicationFeeCents)? DirectTo = null);

    public ConcurrentDictionary<string, Account> Accounts { get; } = new();
    public ConcurrentDictionary<string, Session> Sessions { get; } = new();
    /// <summary>The last payment page created.</summary>
    public string LastSessionId { get; private set; } = "";
    public string LastAccountId { get; private set; } = "";
    public bool FailCreates { get; set; }
    public bool FailTransfers { get; set; }

    /// <summary>What Stripe charges for the next payment that is paid. A test sets it to see the fee rules at work.</summary>
    public int NextStripeFeeCents { get; set; } = 55;

    /// <summary>Transfers to organisations, by idempotency key: a repeated key returns the first transfer, like Stripe does.</summary>
    public ConcurrentDictionary<string, Dictionary<string, string>> Transfers { get; } = new();

    /// <summary>Stripe has checked the organisation's details: it can take payments and be paid out.</summary>
    public void Approve(string accountId) => Accounts[accountId] = Accounts[accountId] with { Active = true };

    /// <summary>Payouts Stripe made from each organisation's Stripe balance to its bank, by account.</summary>
    public ConcurrentDictionary<string, List<(string Id, int AmountCents, DateTimeOffset Created)>> Payouts { get; } = new();

    /// <summary>Stripe pays an organisation's balance out to its bank.</summary>
    public string PayOut(string accountId, int amountCents, DateTimeOffset? at = null)
    {
        var id = $"po_{Guid.NewGuid():N}"[..20];
        Payouts.GetOrAdd(accountId, _ => []).Add((id, amountCents, at ?? DateTimeOffset.UtcNow));
        return id;
    }

    public void Pay(string sessionId) =>
        Sessions[sessionId] = Sessions[sessionId] with { Status = "complete", PaymentStatus = "paid", StripeFeeCents = NextStripeFeeCents };

    /// <summary>The transfer made to the organisation for one of our payments, if any.</summary>
    public Dictionary<string, string>? TransferFor(Guid paymentId) =>
        Transfers.Values.SingleOrDefault(t => t["metadata[paymentId]"] == paymentId.ToString());

    public string SessionFor(Guid paymentId) => Sessions.Single(s => s.Value.Request["metadata[paymentId]"] == paymentId.ToString()).Key;

    /// <summary>An event as Stripe would post it to the webhook, with a valid signature (or a wrong one).</summary>
    public static HttpRequestMessage Webhook(string type, string sessionId, Guid organisationId, string secret = WebhookSecret)
    {
        var body = System.Text.Json.JsonSerializer.Serialize(new
        {
            id = $"evt_{Guid.NewGuid():N}", type,
            data = new { @object = new { id = sessionId, @object = "checkout.session", metadata = new { organisationId } } },
        });
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var signature = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes($"{timestamp}.{body}"))).ToLowerInvariant();
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/payments/stripe-webhook") { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        request.Headers.Add("Stripe-Signature", $"t={timestamp},v1={signature}");
        return request;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        if (request.Headers.Authorization?.Parameter != SecretKey)
            return Error(HttpStatusCode.Unauthorized, "Invalid API Key provided");
        var path = request.RequestUri!.AbsolutePath;
        if (request.Method == HttpMethod.Post && path == "/v2/core/accounts")
        {
            // v2: JSON, with a Stripe-Version header. Remembered flattened, like the v1 form fields.
            if (!request.Headers.Contains("Stripe-Version")) return Error(HttpStatusCode.BadRequest, "Stripe-Version header required");
            var json = System.Text.Json.Nodes.JsonNode.Parse(await request.Content!.ReadAsStringAsync(ct))!;
            var v2Id = $"acct_{Guid.NewGuid():N}"[..21];
            Accounts[v2Id] = new Account(Flatten(json), false);
            LastAccountId = v2Id;
            return Ok(new { id = v2Id, @object = "v2.core.account" });
        }
        var form = request.Content is null ? new Dictionary<string, string>()
            : (await request.Content.ReadAsStringAsync(ct)).Split('&', StringSplitOptions.RemoveEmptyEntries)
                .Select(p => p.Split('=', 2)).ToDictionary(p => Uri.UnescapeDataString(p[0].Replace('+', ' ')), p => Uri.UnescapeDataString(p[1].Replace('+', ' ')));

        switch (request.Method.Method, path)
        {
            case ("POST", "/v1/accounts"):
                // As for new platforms on real Stripe: v1 account creation is switched off.
                return Error(HttpStatusCode.BadRequest, "Stripe no longer recommends Accounts v1 for new Connect integrations.");
            case ("POST", "/v1/account_links"):
                return Ok(new { @object = "account_link", url = $"https://connect.stripe.com/setup/e/{form["account"]}" });
            case ("POST", "/v1/transfers"):
                if (FailTransfers) return Error(HttpStatusCode.InternalServerError, "Something went wrong on Stripe's end.");
                var key = request.Headers.TryGetValues("Idempotency-Key", out var keys) ? keys.Single() : Guid.NewGuid().ToString();
                form["id"] = $"tr_{key}";
                var transfer = Transfers.GetOrAdd(key, form);
                return Ok(new { id = transfer["id"], @object = "transfer" });
            case ("POST", "/v1/checkout/sessions"):
                if (FailCreates) return Error(HttpStatusCode.InternalServerError, "Something went wrong on Stripe's end.");
                var sessionId = $"cs_test_{Guid.NewGuid():N}";
                Sessions[sessionId] = new Session(form, "open", "unpaid");
                LastSessionId = sessionId;
                return Ok(SessionView(sessionId));
        }
        if (request.Method == HttpMethod.Get && path == "/v1/payouts")
        {
            // Listed on the organisation's own account, named in the Stripe-Account header.
            if (!request.Headers.TryGetValues("Stripe-Account", out var acting)) return Error(HttpStatusCode.BadRequest, "Stripe-Account header required");
            var query = System.Web.HttpUtility.ParseQueryString(request.RequestUri.Query);
            var since = long.Parse(query["created[gte]"] ?? "0");
            var data = Payouts.GetValueOrDefault(acting.Single()) ?? [];
            return Ok(new
            {
                @object = "list",
                data = data.Where(p => p.Created.ToUnixTimeSeconds() >= since).OrderByDescending(p => p.Created)
                    .Select(p => new { id = p.Id, @object = "payout", amount = p.AmountCents, currency = "eur", status = "paid", created = p.Created.ToUnixTimeSeconds() }),
            });
        }
        if (path.StartsWith("/v1/accounts/", StringComparison.Ordinal))
        {
            var rest = path["/v1/accounts/".Length..];
            if (rest.EndsWith("/login_links", StringComparison.Ordinal))
                return Ok(new { @object = "login_link", url = $"https://connect.stripe.com/express/{rest.Split('/')[0]}" });
            return Accounts.ContainsKey(rest) ? Ok(AccountView(rest)) : Error(HttpStatusCode.NotFound, "No such account");
        }
        if (path.StartsWith("/v1/checkout/sessions/", StringComparison.Ordinal))
        {
            var rest = path["/v1/checkout/sessions/".Length..];
            if (rest.EndsWith("/expire", StringComparison.Ordinal))
            {
                var id = rest.Split('/')[0];
                if (Sessions[id].Status != "open") return Error(HttpStatusCode.BadRequest, "Only Checkout Sessions with a status of open can be expired.");
                Sessions[id] = Sessions[id] with { Status = "expired" };
                return Ok(SessionView(id));
            }
            if (!Sessions.ContainsKey(rest)) return Error(HttpStatusCode.NotFound, "No such checkout.session");
            return request.RequestUri.Query.Contains("latest_charge") ? Ok(SessionWithCharge(rest)) : Ok(SessionView(rest));
        }
        return Error(HttpStatusCode.NotFound, "Unrecognized request URL");
    }

    /// <summary>{"a":{"b":true}} -> "a.b" = "true", so tests can check what was sent.</summary>
    private static Dictionary<string, string> Flatten(System.Text.Json.Nodes.JsonNode node, string prefix = "")
    {
        var result = new Dictionary<string, string>();
        if (node is System.Text.Json.Nodes.JsonObject obj)
            foreach (var (key, value) in obj)
                foreach (var pair in Flatten(value!, prefix.Length == 0 ? key : $"{prefix}.{key}")) result[pair.Key] = pair.Value;
        else result[prefix] = node.ToString();
        return result;
    }

    private object AccountView(string id)
    {
        var active = Accounts[id].Active;
        return new
        {
            id, @object = "account", type = "express", charges_enabled = active, payouts_enabled = active, details_submitted = active,
            requirements = new { currently_due = active ? Array.Empty<string>() : new[] { "external_account", "individual.dob.day" } },
        };
    }

    private object SessionView(string id)
    {
        var s = Sessions[id];
        return new
        {
            id, @object = "checkout.session", status = s.Status, payment_status = s.PaymentStatus,
            url = s.Status == "open" ? $"https://checkout.stripe.com/c/pay/{id}" : null,
        };
    }

    /// <summary>The session with its payment and charge expanded, as asked for when settling.</summary>
    private object SessionWithCharge(string id)
    {
        var s = Sessions[id];
        object? intent = s.PaymentStatus != "paid" ? null : new
        {
            id = $"pi_{id}", @object = "payment_intent",
            latest_charge = new
            {
                id = $"ch_{id}", @object = "charge",
                balance_transaction = new { id = $"txn_{id}", @object = "balance_transaction", fee = s.StripeFeeCents },
                transfer = s.DirectTo?.TransferId,
                application_fee_amount = s.DirectTo?.ApplicationFeeCents,
            },
        };
        return new { id, @object = "checkout.session", status = s.Status, payment_status = s.PaymentStatus, payment_intent = intent };
    }

    private static HttpResponseMessage Ok(object body) => new(HttpStatusCode.OK) { Content = JsonContent.Create(body) };

    private static HttpResponseMessage Error(HttpStatusCode status, string message) =>
        new(status) { Content = JsonContent.Create(new { error = new { message, type = "invalid_request_error" } }) };
}

/// <summary>The real API with the platform's Stripe account switched on, talking to <see cref="FakeStripe"/>.</summary>
public class StripeTestApp : TestApp
{
    public FakeStripe Stripe { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("Stripe:SecretKey", FakeStripe.SecretKey);
        builder.UseSetting("Stripe:WebhookSecret", FakeStripe.WebhookSecret);
        builder.UseSetting("App:PublicUrl", "https://tickets.example.org");
        // As on a live site: no test checkout to fall back on.
        builder.UseSetting("Payments:UseTestCheckout", "false");
        builder.ConfigureTestServices(services =>
            services.AddHttpClient<StripeClient>().ConfigurePrimaryHttpMessageHandler(() => Stripe));
    }
}

/// <summary>The real API with no Stripe key and no test checkout: a live site where payments were never set up.</summary>
public class NoPaymentsTestApp : TestApp
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("Stripe:SecretKey", "");
        builder.UseSetting("Payments:UseTestCheckout", "false");
    }
}
