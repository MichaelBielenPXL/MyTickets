using Microsoft.AspNetCore.Authentication;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

/// <summary>
/// Signing up and in with a MyTickets account: one email address and password per person, for every organisation.
/// An organisation keeps its own record of someone (their details, membership, tokens, tickets), made when they join.
/// </summary>
public static class AuthEndpoints
{
    public record RegisterRequest(string? Email, string? Password, string? DisplayName, string? OrganisationName, string? JoinOrganisationSlug, bool? AcceptTerms);
    public record LoginRequest(string? Email, string? Password, string? OrganisationSlug);
    public record LogoutRequest(string? OrganisationSlug);
    /// <summary>The organisation is where the link brings them back to sign in. Language "nl" for a Dutch email.</summary>
    public record ForgotPasswordRequest(string? Email, string? OrganisationSlug, string? Language);
    public record ResetPasswordRequest(string? Token, string? Password);

    /// <summary>An organisation the account has a record at: their role and membership there, and the record itself.</summary>
    public record OrganisationRecord(string Slug, string Name, string? LogoUrl, OrgRole? Role, string? Tier, DateTime? ExpiresAt,
        Guid UserId, string Email, string DisplayName);

    private const string WrongLogin = "Wrong email address or password.";

    public static void MapAuth(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");

        // From an organisation's page: just the account; their record there is made when they join.
        // From the front page: the account and the organisation they start, together or not at all.
        group.MapPost("/register", async (RegisterRequest req, HttpContext http, PlatformDbContext platform, AppCache cache,
            AccountService accounts, OrganisationProvisioner provisioner, IConfiguration config) =>
        {
            var email = AccountService.Normalise(req.Email);
            var name = req.DisplayName?.Trim() ?? "";
            if (email.Length is < 5 or > 200 || !email.Contains('@')) return Http.Error(400, "Enter a valid email address.");
            // A name is only asked of organisers here; members give theirs with their other details when they join.
            var organiserSignUp = string.IsNullOrWhiteSpace(req.JoinOrganisationSlug);
            if (organiserSignUp && name.Length is < 2 or > 80) return Http.Error(400, "Enter your name.");
            if (name.Length > 80) return Http.Error(400, "Your name is too long.");
            if ((req.Password?.Length ?? 0) < AccountService.MinimumPasswordLength) return Http.Error(400, "Choose a password of at least 8 characters.");
            if (req.AcceptTerms != true) return Http.Error(400, Legal.NotAccepted);

            if (!organiserSignUp)
            {
                var organisation = await cache.OrganisationBySlugAsync(req.JoinOrganisationSlug!.Trim());
                if (organisation is null) return Http.Error(404, "Organisation not found.");
                var member = accounts.New(email, name, req.Password!);
                await accounts.CreateAsync(member);
                await Sessions.SignInAsync(http, member.Id);
                return Results.Ok(new { member.Id, member.Email, member.DisplayName, OrganisationSlug = organisation.Slug });
            }

            if (!OrganisationProvisioner.MayCreate(config, email)) return Http.Error(403, "You are not allowed to create organisations.");
            var orgName = req.OrganisationName?.Trim() ?? "";
            if (orgName.Length is < 2 or > 80) return Http.Error(400, "Give the organisation a name of 2 to 80 characters.");
            var slug = OrganisationSlug.FromName(orgName);
            if (slug.Length == 0) return Http.Error(400, "This name cannot be used for an organisation page.");
            if (OrganisationSlug.IsReserved(slug)) return Http.Error(400, "This organisation page address is reserved.");
            if (await platform.Tenants.AnyAsync(t => t.Slug == slug)) return Http.Error(409, "This organisation page address is already taken.");
            if (await accounts.FindAsync(email) is not null) return AccountExists("Sign in to start another organisation.");

            var owner = accounts.New(email, name, req.Password!);
            try
            {
                var (created, _) = await provisioner.CreateAsync(owner, ownerIsNew: true, orgName, slug, description: "");
                await Sessions.SignInAsync(http, owner.Id);
                return Results.Ok(new { owner.Id, owner.Email, owner.DisplayName, OrganisationSlug = created.Slug });
            }
            catch (SlugTakenException e) { return Http.Error(409, e.Message); }
            catch (DbUpdateException e) when (e.InnerException is SqliteException { SqliteErrorCode: 19 })
            {
                return AccountExists("Sign in to start another organisation.");
            }
        }).RequireRateLimiting("auth");

        // The same account everywhere. Signing in at an organisation's page brings them back there; on the front page,
        // to the first organisation they run, if any.
        group.MapPost("/login", async (LoginRequest req, HttpContext http, PlatformDbContext platform, AccountService accounts) =>
        {
            var account = await accounts.VerifyAsync(req.Email ?? "", req.Password ?? "");
            if (account is null) return Http.Error(401, WrongLogin);
            await Sessions.SignInAsync(http, account.Id);
            var slug = string.IsNullOrWhiteSpace(req.OrganisationSlug)
                ? await (
                    from owned in platform.TenantOwners.AsNoTracking()
                    join tenant in platform.Tenants.AsNoTracking() on owned.TenantId equals tenant.Id
                    where owned.AccountId == account.Id
                    orderby tenant.CreatedAt
                    select tenant.Slug).FirstOrDefaultAsync()
                : req.OrganisationSlug.Trim();
            return Results.Ok(new { account.Id, account.Email, account.DisplayName, OrganisationSlug = slug });
        }).RequireRateLimiting("auth");

        // "Forgot your password?": always the same answer, so it never tells whether an address has an account.
        group.MapPost("/forgot-password", async (ForgotPasswordRequest req, HttpContext http, PasswordResetService resets, IConfiguration config) =>
        {
            var email = req.Email?.Trim() ?? "";
            if (email.Length is < 5 or > 200 || !email.Contains('@')) return Http.Error(400, "Enter a valid email address.");
            await resets.RequestAsync(email, req.OrganisationSlug, Http.SiteAddress(http, config), req.Language);
            return Results.NoContent();
        }).RequireRateLimiting("auth");

        group.MapPost("/reset-password", async (ResetPasswordRequest req, PasswordResetService resets) =>
            Results.Ok(new { OrganisationSlug = await resets.ResetAsync(req.Token, req.Password) }))
            .RequireRateLimiting("auth");

        // One account, so signing out is everywhere at once.
        group.MapPost("/logout", async (LogoutRequest? _, HttpContext http) =>
        {
            await http.SignOutAsync();
            return Results.NoContent();
        });

        // Who is signed in, and their record at each organisation they joined or run.
        group.MapGet("/me", async (HttpContext http, PlatformDbContext platform, AccountService accounts, TenantScopes scopes, IConfiguration config) =>
        {
            var account = Sessions.AccountId(http) is { } accountId ? await accounts.FindAsync(accountId) : null;
            if (account is null)
            {
                // An old cookie (from before MyTickets accounts) or a removed account: start over.
                if (http.User.Identity?.IsAuthenticated == true) await http.SignOutAsync();
                return Http.Error(401, "Not signed in.");
            }

            var records = new List<OrganisationRecord>();
            foreach (var (tenant, userId) in await accounts.RecordsAsync(account.Id))
            {
                await using var scope = await scopes.OpenAsync(tenant.ToOrganisation());
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
                if (user is null) continue;
                // Role and tier stay empty until the person has picked a membership.
                var membership = await db.Memberships.AsNoTracking().Where(m => m.UserId == userId)
                    .Select(m => new { m.Role, Tier = m.Tier.Name, m.ExpiresAt }).FirstOrDefaultAsync();
                records.Add(new OrganisationRecord(tenant.Slug, tenant.Name, Images.Url(tenant.LogoKey),
                    membership?.Role, membership?.Tier, membership?.ExpiresAt, user.Id, user.Email, user.DisplayName));
            }
            return Results.Ok(new
            {
                account.Id, account.Email, account.DisplayName,
                IsOwner = await platform.TenantOwners.AnyAsync(o => o.AccountId == account.Id),
                Memberships = records.OrderBy(m => m.Name),
                CanCreateOrganisations = OrganisationProvisioner.MayCreate(config, account.Email),
            });
        });
    }

    private static IResult AccountExists(string then) =>
        Results.Json(new { error = $"There is already a MyTickets account with this email address. {then}", code = "account-exists" }, statusCode: 409);
}
