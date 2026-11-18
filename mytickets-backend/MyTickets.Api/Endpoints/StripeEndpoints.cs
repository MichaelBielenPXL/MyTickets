using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

/// <summary>
/// Getting an organisation paid: it signs up on Stripe's own pages (Stripe Connect, Express), after which
/// buyers can pay online and Stripe pays the money out to the organisation's bank account by itself.
/// </summary>
public static class StripeEndpoints
{
    public static void MapStripe(this IEndpointRouteBuilder app)
    {
        var admin = app.MapGroup("/api/orgs/{slug}/admin/payouts").RequireOrg(OrgRole.Admin);
        // Admins see what Stripe objected to, so they (or we) can act on it.
        admin.AddEndpointFilter(async (ctx, next) =>
        {
            try { return await next(ctx); }
            catch (StripeException e) { return Http.Error(502, e.Message); }
        });

        // Where the organisation stands. Asks Stripe afresh, so it is up to date right after signing up.
        admin.MapGet("", async (AppDbContext db, StripeClient stripe, TimeProvider clock, IConfiguration config) =>
        {
            // What the organisation keeps of every online payment, shown so there are no surprises.
            var feePercent = config.GetValue("Stripe:PlatformFeePercent", 5m);
            var feeMaxCentsPerItem = config.GetValue("Stripe:PlatformFeeMaxCentsPerItem", 150);
            if (!stripe.Configured) return Results.Ok(new { Status = "unavailable", RequirementsDue = 0, feePercent, feeMaxCentsPerItem });
            var account = await db.StripeAccounts.FirstOrDefaultAsync();
            if (account is null) return Results.Ok(new { Status = "not-started", RequirementsDue = 0, feePercent, feeMaxCentsPerItem });

            var remote = await stripe.GetAccountAsync(account.AccountId);
            account.ChargesEnabled = remote.ChargesEnabled;
            account.PayoutsEnabled = remote.PayoutsEnabled;
            account.DetailsSubmitted = remote.DetailsSubmitted;
            account.CheckedAt = clock.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync();
            return Results.Ok(new { Status = StatusOf(account), remote.RequirementsDue, feePercent, feeMaxCentsPerItem });
        });

        // Sends the admin to Stripe's sign-up pages. The organisation's Stripe account is made once and reused.
        admin.MapPost("/onboarding", async (HttpContext http, AppDbContext db, StripeClient stripe, TimeProvider clock, IConfiguration config) =>
        {
            if (!stripe.Configured) return Http.Error(409, "Online payments are not set up on this platform yet.");
            var organisation = http.Org().Org;
            var account = await db.StripeAccounts.FirstOrDefaultAsync();
            if (account is null)
            {
                var email = await db.Users.Where(u => u.Id == http.User.UserId()).Select(u => u.Email).FirstAsync();
                var accountId = await stripe.CreateExpressAccountAsync(organisation.Id, organisation.Name, email);
                account = new StripeAccount { OrganisationId = organisation.Id, AccountId = accountId, CheckedAt = clock.GetUtcNow().UtcDateTime };
                db.StripeAccounts.Add(account);
                await db.SaveChangesAsync();
            }

            var back = $"{SiteAddress(http, config)}/{organisation.Slug}/admin?tab=payouts";
            var url = await stripe.CreateOnboardingLinkAsync(account.AccountId, returnUrl: back, refreshUrl: $"{back}&again=1");
            return Results.Ok(new { Url = url });
        });

        // The organisation's own Stripe dashboard: balance, payouts, bank account.
        admin.MapPost("/dashboard", async (AppDbContext db, StripeClient stripe) =>
        {
            var account = await db.StripeAccounts.AsNoTracking().FirstOrDefaultAsync();
            if (account is null || !account.DetailsSubmitted) return Http.Error(409, "Finish setting up payouts first.");
            return Results.Ok(new { Url = await stripe.CreateDashboardLinkAsync(account.AccountId) });
        });

        // Stripe tells us when a payment page changes. The signature proves it came from Stripe; even so, what
        // happened is then asked of Stripe itself, like everywhere else.
        app.MapPost("/api/payments/stripe-webhook", async (HttpRequest request, StripeClient stripe, PlatformDbContext platform,
            TenantScopes scopes, TimeProvider clock, ILogger<PaymentService> log) =>
        {
            using var reader = new StreamReader(request.Body);
            var body = await reader.ReadToEndAsync();
            if (!stripe.IsGenuineWebhook(body, request.Headers["Stripe-Signature"], clock.GetUtcNow()))
                return Results.BadRequest();

            var stripeEvent = StripeEvent.Parse(body);
            if (stripeEvent is null || !stripeEvent.Type.StartsWith("checkout.session.", StringComparison.Ordinal)) return Results.Ok();
            var session = stripeEvent.Data.Object;
            if (session.Metadata?.GetValueOrDefault("organisationId") is not { } organisationText || !Guid.TryParse(organisationText, out var tenantId))
                return Results.Ok();
            var tenant = await platform.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId);
            if (tenant is null) return Results.Ok();

            await using var scope = await scopes.OpenAsync(tenant.ToOrganisation());
            try
            {
                await scope.ServiceProvider.GetRequiredService<PaymentService>().SyncByCheckoutIdAsync(session.Id);
                return Results.Ok();
            }
            catch (StripeException e)
            {
                // Stripe could not be asked right now. Answering with an error makes Stripe send the event again later.
                log.LogWarning("Stripe webhook for {Slug} could not be handled yet: {Message}", tenant.Slug, e.Message);
                return Results.StatusCode(503);
            }
        }).DisableAntiforgery();
    }

    /// <summary>not-started, incomplete (Stripe still needs something), pending (Stripe is checking), active.</summary>
    private static string StatusOf(StripeAccount account) =>
        account.ChargesEnabled && account.PayoutsEnabled ? "active"
        : account.DetailsSubmitted ? "pending"
        : "incomplete";

    private static string SiteAddress(HttpContext http, IConfiguration config) =>
        config["App:PublicUrl"] is { Length: > 0 } configured ? configured.TrimEnd('/') : $"{http.Request.Scheme}://{http.Request.Host}";
}
