using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace MyTickets.Api.Services;

/// <summary>Stripe said no, or could not be reached. <see cref="Exception.Message"/> is safe to show to an admin.</summary>
public class StripeException(string message, HttpStatusCode? status = null) : Exception(message)
{
    public HttpStatusCode? Status { get; } = status;
}

/// <summary>A paid charge, and what Stripe charged the platform for it.</summary>
/// <param name="DirectTransferId">
/// Set when Stripe already sent the money to the organisation's account at payment time (how payments worked
/// before they were passed on afterwards): that transfer, with the platform's application fee.
/// </param>
public record StripeCharge(string Id, int StripeFeeCents, string? DirectTransferId = null, int? ApplicationFeeCents = null);

/// <summary>Money Stripe sent from an organisation's Stripe balance to its bank account. Instant payouts cost more.</summary>
public record StripePayout(string Id, int AmountCents, DateTime CreatedAt, bool Instant = false);

/// <summary>An organisation's Stripe account, as far as taking payments and getting paid out goes.</summary>
public record StripeAccountStatus(string Id, bool ChargesEnabled, bool PayoutsEnabled, bool DetailsSubmitted, int RequirementsDue);

/// <summary>What we ask Stripe's payment page to charge, and who gets the money.</summary>
public record StripeCheckoutRequest(int AmountCents, string Description, string ReturnUrl, string CancelUrl,
    Guid PaymentId, Guid OrganisationId, string ConnectedAccountId, DateTime ExpiresAt);

/// <summary>A Stripe Checkout page. Status is open, complete or expired; PaymentStatus is paid or unpaid.</summary>
public record StripeCheckoutSession(string Id, string? Url, string Status, string PaymentStatus)
{
    public bool IsPaid => Status == "complete" && PaymentStatus is "paid" or "no_payment_required";
    public bool IsExpired => Status == "expired";
}

/// <summary>
/// Talks to Stripe with the platform's secret key. Organisations each get an Express account under the
/// platform (Stripe Connect): Stripe collects their details and bank account and pays them out itself.
/// </summary>
public class StripeClient(HttpClient http, IConfiguration config)
{
    public const string ProviderName = "Stripe";

    /// <summary>Whether the platform's Stripe key is set. Without it there are no online payments.</summary>
    public bool Configured => SecretKey is not null;

    private string? SecretKey => config["Stripe:SecretKey"] is { Length: > 0 } key ? key : null;

    // ---- Organisations: Express accounts ----

    /// <summary>
    /// Creates the organisation's account with Stripe's Accounts v2 API (new platforms can't use v1 for this).
    /// With the Express dashboard Stripe requires the platform to pay Stripe's fees and carry losses, which
    /// matches how payments are set up here: the platform's 5% covers Stripe's costs.
    /// </summary>
    public async Task<string> CreateExpressAccountAsync(Guid organisationId, string organisationName, string email, CancellationToken ct = default)
    {
        var body = new
        {
            contact_email = email,
            display_name = organisationName,
            dashboard = "express",
            identity = new { country = (config["Stripe:AccountCountry"] ?? "BE").ToLowerInvariant() },
            defaults = new { currency = "eur", responsibilities = new { fees_collector = "application", losses_collector = "application" } },
            configuration = new
            {
                // Takes payments (cards, Bancontact) as the seller...
                merchant = new { capabilities = new { card_payments = new { requested = true }, bancontact_payments = new { requested = true } } },
                // ...and receives the money from the platform, to be paid out to the bank.
                recipient = new { capabilities = new { stripe_balance = new { stripe_transfers = new { requested = true } } } },
            },
            metadata = new Dictionary<string, string> { ["organisationId"] = organisationId.ToString() },
        };
        var account = await SendAsync(HttpMethod.Post, "/v2/core/accounts", JsonContent.Create(body), ct, apiVersion: ApiVersionV2);
        return account.GetProperty("id").GetString()!;
    }

    /// <summary>The Stripe-Version the v2 endpoints are written against.</summary>
    private string ApiVersionV2 => config["Stripe:ApiVersion"] ?? "2026-10-28.endive";

    /// <summary>A one-time link to Stripe's own sign-up pages for this account. It expires after a few minutes.</summary>
    public async Task<string> CreateOnboardingLinkAsync(string accountId, string returnUrl, string refreshUrl, CancellationToken ct = default)
    {
        var link = await PostAsync("account_links", new()
        {
            ["account"] = accountId, ["type"] = "account_onboarding", ["return_url"] = returnUrl, ["refresh_url"] = refreshUrl,
        }, ct);
        return link.GetProperty("url").GetString()!;
    }

    /// <summary>A one-time link to the organisation's own Stripe dashboard: payouts, balance, bank account.</summary>
    public async Task<string> CreateDashboardLinkAsync(string accountId, CancellationToken ct = default) =>
        (await PostAsync($"accounts/{Safe(accountId)}/login_links", new(), ct)).GetProperty("url").GetString()!;

    public async Task<StripeAccountStatus> GetAccountAsync(string accountId, CancellationToken ct = default)
    {
        var account = await SendAsync(HttpMethod.Get, $"accounts/{Safe(accountId)}", null, ct);
        var due = account.TryGetProperty("requirements", out var requirements)
            && requirements.TryGetProperty("currently_due", out var currentlyDue) && currentlyDue.ValueKind == JsonValueKind.Array
                ? currentlyDue.GetArrayLength() : 0;
        return new StripeAccountStatus(account.GetProperty("id").GetString()!,
            Bool(account, "charges_enabled"), Bool(account, "payouts_enabled"), Bool(account, "details_submitted"), due);
    }

    // ---- Payments: Checkout sessions ----

    /// <summary>
    /// Opens Stripe's payment page. The organisation is the seller (its name is on the buyer's statement).
    /// The money lands with the platform first; see <see cref="GetChargeAsync"/> and <see cref="TransferAsync"/>.
    /// </summary>
    public async Task<StripeCheckoutSession> CreateCheckoutAsync(StripeCheckoutRequest request, CancellationToken ct = default)
    {
        var form = new Dictionary<string, string>
        {
            ["mode"] = "payment",
            ["line_items[0][quantity]"] = "1",
            ["line_items[0][price_data][currency]"] = "eur",
            ["line_items[0][price_data][unit_amount]"] = request.AmountCents.ToString(CultureInfo.InvariantCulture),
            ["line_items[0][price_data][product_data][name]"] = Truncate(request.Description, 250),
            ["success_url"] = request.ReturnUrl,
            ["cancel_url"] = request.CancelUrl,
            ["client_reference_id"] = request.PaymentId.ToString(),
            ["metadata[paymentId]"] = request.PaymentId.ToString(),
            ["metadata[organisationId]"] = request.OrganisationId.ToString(),
            ["expires_at"] = new DateTimeOffset(request.ExpiresAt).ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture),
            // The organisation is the seller; the money is passed on to it once Stripe's cost is known.
            ["payment_intent_data[on_behalf_of]"] = request.ConnectedAccountId,
            ["payment_intent_data[transfer_group]"] = request.PaymentId.ToString(),
            ["payment_intent_data[metadata][paymentId]"] = request.PaymentId.ToString(),
            ["payment_intent_data[metadata][organisationId]"] = request.OrganisationId.ToString(),
        };
        return ReadSession(await PostAsync("checkout/sessions", form, ct));
    }

    public async Task<StripeCheckoutSession> GetCheckoutAsync(string sessionId, CancellationToken ct = default) =>
        ReadSession(await SendAsync(HttpMethod.Get, $"checkout/sessions/{Safe(sessionId)}", null, ct));

    /// <summary>
    /// The charge behind a paid payment page and what Stripe charged for it. Null while Stripe has not booked
    /// it yet (rare, for slow payment methods); asking again later is fine.
    /// </summary>
    public async Task<StripeCharge?> GetChargeAsync(string sessionId, CancellationToken ct = default)
    {
        var session = await SendAsync(HttpMethod.Get,
            $"checkout/sessions/{Safe(sessionId)}?expand[]=payment_intent.latest_charge.balance_transaction", null, ct);
        if (!session.TryGetProperty("payment_intent", out var intent) || intent.ValueKind != JsonValueKind.Object) return null;
        if (!intent.TryGetProperty("latest_charge", out var charge) || charge.ValueKind != JsonValueKind.Object) return null;
        if (!charge.TryGetProperty("balance_transaction", out var booked) || booked.ValueKind != JsonValueKind.Object) return null;
        var direct = charge.TryGetProperty("transfer", out var t) && t.ValueKind == JsonValueKind.String ? t.GetString() : null;
        int? applicationFee = charge.TryGetProperty("application_fee_amount", out var a) && a.ValueKind == JsonValueKind.Number ? a.GetInt32() : null;
        return new StripeCharge(charge.GetProperty("id").GetString()!, booked.GetProperty("fee").GetInt32(), direct, applicationFee);
    }

    /// <summary>
    /// Passes the organisation its share of a charge. The idempotency key makes a repeated call (a retry after
    /// a timeout, a second webhook) return the same transfer instead of paying twice.
    /// </summary>
    public async Task<string> TransferAsync(string connectedAccountId, int amountCents, string chargeId, Guid paymentId, CancellationToken ct = default)
    {
        var form = new Dictionary<string, string>
        {
            ["amount"] = amountCents.ToString(CultureInfo.InvariantCulture),
            ["currency"] = "eur",
            ["destination"] = connectedAccountId,
            // Ties the transfer to the charge, so it goes out as soon as that money is in, not from other funds.
            ["source_transaction"] = chargeId,
            ["transfer_group"] = paymentId.ToString(),
            ["metadata[paymentId]"] = paymentId.ToString(),
        };
        var transfer = await SendAsync(HttpMethod.Post, "transfers", new FormUrlEncodedContent(form), ct, idempotencyKey: $"transfer-{paymentId:N}");
        return transfer.GetProperty("id").GetString()!;
    }

    /// <summary>
    /// The payouts Stripe made from an organisation's balance to its bank since a moment, newest first (at most
    /// 100: payouts go out at most daily, and this is checked far more often).
    /// </summary>
    public async Task<IReadOnlyList<StripePayout>> ListPaidPayoutsAsync(string connectedAccountId, DateTime since, CancellationToken ct = default)
    {
        var from = new DateTimeOffset(DateTime.SpecifyKind(since, DateTimeKind.Utc)).ToUnixTimeSeconds();
        var list = await SendAsync(HttpMethod.Get, $"payouts?status=paid&limit=100&created[gte]={from}", null, ct,
            connectedAccount: Safe(connectedAccountId));
        return list.GetProperty("data").EnumerateArray()
            .Where(p => p.GetProperty("currency").GetString() == "eur")
            .Select(p => new StripePayout(p.GetProperty("id").GetString()!, p.GetProperty("amount").GetInt32(),
                DateTimeOffset.FromUnixTimeSeconds(p.GetProperty("created").GetInt64()).UtcDateTime,
                p.TryGetProperty("method", out var method) && method.GetString() == "instant"))
            .ToList();
    }

    /// <summary>Closes the payment page so it can no longer be paid. Only open sessions can be closed.</summary>
    public async Task ExpireCheckoutAsync(string sessionId, CancellationToken ct = default) =>
        await PostAsync($"checkout/sessions/{Safe(sessionId)}/expire", new(), ct);

    // ---- Webhooks ----

    /// <summary>
    /// Checks the Stripe-Signature header: an HMAC of "timestamp.body" with the webhook's signing secret,
    /// no older than five minutes. Anything else did not come from Stripe.
    /// </summary>
    public bool IsGenuineWebhook(string body, string? signatureHeader, DateTimeOffset now)
    {
        if (config["Stripe:WebhookSecret"] is not { Length: > 0 } secret || string.IsNullOrEmpty(signatureHeader)) return false;
        var parts = signatureHeader.Split(',').Select(p => p.Split('=', 2)).Where(p => p.Length == 2).ToList();
        var timestamp = parts.FirstOrDefault(p => p[0] == "t")?[1];
        if (!long.TryParse(timestamp, out var seconds) || Math.Abs(now.ToUnixTimeSeconds() - seconds) > 300) return false;

        var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes($"{timestamp}.{body}"));
        return parts.Where(p => p[0] == "v1").Any(p =>
        {
            try { return CryptographicOperations.FixedTimeEquals(expected, Convert.FromHexString(p[1])); }
            catch (FormatException) { return false; }
        });
    }

    // ---- Plumbing ----

    private Task<JsonElement> PostAsync(string path, Dictionary<string, string> form, CancellationToken ct) =>
        SendAsync(HttpMethod.Post, path, new FormUrlEncodedContent(form), ct);

    /// <summary>
    /// v1 endpoints take form fields and paths relative to /v1/; v2 endpoints take JSON, an absolute path
    /// ("/v2/...") and a Stripe-Version header.
    /// </summary>
    private async Task<JsonElement> SendAsync(HttpMethod method, string path, HttpContent? content, CancellationToken ct,
        string? apiVersion = null, string? idempotencyKey = null, string? connectedAccount = null)
    {
        var key = SecretKey ?? throw new StripeException("Online payments are not set up: the platform's Stripe key is missing.");
        using var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
        if (apiVersion is not null) request.Headers.Add("Stripe-Version", apiVersion);
        if (idempotencyKey is not null) request.Headers.Add("Idempotency-Key", idempotencyKey);
        // Acting on an organisation's own Stripe account rather than the platform's.
        if (connectedAccount is not null) request.Headers.Add("Stripe-Account", connectedAccount);
        request.Content = content;

        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, ct);
        }
        catch (HttpRequestException)
        {
            throw new StripeException("Stripe could not be reached. Try again in a moment.");
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            throw new StripeException("Stripe took too long to answer. Try again in a moment.");
        }

        using (response)
        {
            var text = await response.Content.ReadAsStringAsync(ct);
            JsonElement json;
            try { json = JsonDocument.Parse(text).RootElement.Clone(); }
            catch (JsonException) { throw new StripeException($"Stripe sent an answer we could not read ({(int)response.StatusCode}).", response.StatusCode); }
            if (response.IsSuccessStatusCode) return json;

            var message = json.TryGetProperty("error", out var error) && error.TryGetProperty("message", out var m) ? m.GetString() : null;
            throw new StripeException($"Stripe refused the request: {message ?? $"error {(int)response.StatusCode}"}", response.StatusCode);
        }
    }

    private static StripeCheckoutSession ReadSession(JsonElement session) => new(
        session.GetProperty("id").GetString()!,
        session.TryGetProperty("url", out var url) && url.ValueKind == JsonValueKind.String ? url.GetString() : null,
        session.GetProperty("status").GetString() ?? "open",
        session.GetProperty("payment_status").GetString() ?? "unpaid");

    private static bool Bool(JsonElement json, string name) => json.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.True;

    /// <summary>Ids go into the address, so only plain ids are accepted.</summary>
    private static string Safe(string id) =>
        id.Length is > 0 and < 200 && id.All(c => char.IsAsciiLetterOrDigit(c) || c == '_')
            ? id : throw new StripeException("Not a Stripe id.", HttpStatusCode.NotFound);

    private static string Truncate(string text, int max) => text.Length > max ? text[..max] : text;
}

/// <summary>The few fields of a Stripe webhook event we act on.</summary>
public record StripeEvent(string Type, StripeEventData Data)
{
    public static StripeEvent? Parse(string body)
    {
        try { return JsonSerializer.Deserialize<StripeEvent>(body, Json); }
        catch (JsonException) { return null; }
    }

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
}

public record StripeEventData(StripeEventObject Object);

public record StripeEventObject(string Id, [property: JsonPropertyName("metadata")] Dictionary<string, string>? Metadata);
