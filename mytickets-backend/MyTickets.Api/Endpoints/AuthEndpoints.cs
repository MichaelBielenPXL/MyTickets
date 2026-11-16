using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

/// <summary>
/// Accounts belong to one organisation: the same email address can register at two organisations and
/// gets two separate accounts. The one exception is an organiser's owner login, which opens every
/// organisation that person created.
/// </summary>
public static class AuthEndpoints
{
    public record RegisterRequest(string? Email, string? Password, string? DisplayName, string? OrganisationName, string? JoinOrganisationSlug);
    public record LoginRequest(string? Email, string? Password, string? OrganisationSlug);
    public record LogoutRequest(string? OrganisationSlug);

    /// <summary>One organisation this browser is signed in to, and the account it uses there.</summary>
    public record SignedInAccount(string Slug, string Name, string? LogoUrl, OrgRole? Role, string? Tier, DateTime? ExpiresAt,
        Guid UserId, string Email, string DisplayName);

    private const string WrongLogin = "Wrong email address or password.";

    public static void MapAuth(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");

        group.MapPost("/register", async (RegisterRequest req, HttpContext http, PlatformDbContext platform, AppCache cache,
            TenantScopes scopes, OrganisationProvisioner provisioner, IPasswordHasher<User> hasher, IConfiguration config, TimeProvider clock) =>
        {
            var email = req.Email?.Trim().ToLowerInvariant() ?? "";
            var name = req.DisplayName?.Trim() ?? "";
            if (email.Length is < 5 or > 200 || !email.Contains('@')) return Http.Error(400, "Enter a valid email address.");
            if (name.Length is < 2 or > 80) return Http.Error(400, "Enter your name.");
            if ((req.Password?.Length ?? 0) < 8) return Http.Error(400, "Choose a password of at least 8 characters.");

            // Signing up from an organisation's page: a member account in that organisation, and nothing else.
            if (!string.IsNullOrWhiteSpace(req.JoinOrganisationSlug))
            {
                var organisation = await cache.OrganisationBySlugAsync(req.JoinOrganisationSlug.Trim());
                if (organisation is null) return Http.Error(404, "Organisation not found.");
                await using var scope = await scopes.OpenAsync(organisation);
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                if (await db.Users.AnyAsync(u => u.Email == email))
                    return Http.Error(409, $"There is already an account with this email address at {organisation.Name}.");

                var user = new User { Id = Guid.NewGuid(), Email = email, DisplayName = name, CreatedAt = clock.GetUtcNow().UtcDateTime };
                user.PasswordHash = hasher.HashPassword(user, req.Password!);
                db.Users.Add(user);
                try { await db.SaveChangesAsync(); }
                catch (DbUpdateException e) when (e.InnerException is SqliteException { SqliteErrorCode: 19 })
                {
                    return Http.Error(409, $"There is already an account with this email address at {organisation.Name}.");
                }
                await Sessions.SignInAsync(http, Sessions.ForUser(organisation.Id, user.Id));
                return Results.Ok(new { user.Id, user.Email, user.DisplayName, OrganisationSlug = organisation.Slug });
            }

            // Signing up from the front page: an owner login and their first organisation, together or not at all.
            if (!OrgEndpoints.MayCreateOrganisation(config, email))
                return Http.Error(403, "You are not allowed to create organisations.");
            var orgName = req.OrganisationName?.Trim() ?? "";
            if (orgName.Length is < 2 or > 80) return Http.Error(400, "Give the organisation a name of 2 to 80 characters.");
            var slug = OrganisationSlug.FromName(orgName);
            if (slug.Length == 0) return Http.Error(400, "This name cannot be used for an organisation page.");
            if (OrganisationSlug.IsReserved(slug)) return Http.Error(400, "This organisation page address is reserved.");
            if (await platform.Tenants.AnyAsync(t => t.Slug == slug))
                return Http.Error(409, "This organisation page address is already taken.");
            if (await platform.OwnerAccounts.AnyAsync(o => o.Email == email))
                return Http.Error(409, "There is already an organiser account with this email address. Sign in to add another organisation.");

            var owner = OrganisationProvisioner.NewOwner(email, name, req.Password!, clock);
            try
            {
                var (created, adminUserId) = await provisioner.CreateAsync(owner, ownerIsNew: true, orgName, slug, description: "");
                await Sessions.SignInAsync(http, Sessions.ForOwner(owner.Id), Sessions.ForUser(created.Id, adminUserId));
                return Results.Ok(new { Id = adminUserId, owner.Email, owner.DisplayName, OrganisationSlug = created.Slug });
            }
            catch (SlugTakenException e) { return Http.Error(409, e.Message); }
            catch (DbUpdateException e) when (e.InnerException is SqliteException { SqliteErrorCode: 19 })
            {
                return Http.Error(409, "There is already an organiser account with this email address. Sign in to add another organisation.");
            }
        }).RequireRateLimiting("auth");

        group.MapPost("/login", async (LoginRequest req, HttpContext http, PlatformDbContext platform, AppCache cache,
            TenantScopes scopes, IPasswordHasher<User> hasher) =>
        {
            var email = req.Email?.Trim().ToLowerInvariant() ?? "";
            var password = req.Password ?? "";

            // On an organisation's page: the account at that organisation.
            if (!string.IsNullOrWhiteSpace(req.OrganisationSlug))
            {
                var organisation = await cache.OrganisationBySlugAsync(req.OrganisationSlug.Trim());
                if (organisation is null) return Http.Error(404, "Organisation not found.");
                await using var scope = await scopes.OpenAsync(organisation);
                var user = await scope.ServiceProvider.GetRequiredService<AppDbContext>().Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email);
                if (user is null || hasher.VerifyHashedPassword(user, user.PasswordHash, password) == PasswordVerificationResult.Failed)
                    return Http.Error(401, WrongLogin);
                await Sessions.SignInAsync(http, Sessions.ForUser(organisation.Id, user.Id));
                return Results.Ok(new { user.Id, user.Email, user.DisplayName, OrganisationSlug = organisation.Slug });
            }

            // On the front page: an owner, who is then signed in to every organisation they created.
            var owner = await platform.OwnerAccounts.AsNoTracking().FirstOrDefaultAsync(o => o.Email == email);
            if (owner is null || hasher.VerifyHashedPassword(null!, owner.PasswordHash, password) == PasswordVerificationResult.Failed)
                return Http.Error(401, $"{WrongLogin} If you joined an organisation, sign in on that organisation's page.");
            var owned = await (
                from link in platform.TenantOwners.AsNoTracking()
                join tenant in platform.Tenants.AsNoTracking() on link.TenantId equals tenant.Id
                where link.OwnerAccountId == owner.Id
                orderby tenant.CreatedAt
                select new { tenant.Id, tenant.Slug, link.UserId }).ToListAsync();
            await Sessions.SignInAsync(http, [Sessions.ForOwner(owner.Id), .. owned.Select(o => Sessions.ForUser(o.Id, o.UserId))]);
            return Results.Ok(new { owner.Id, owner.Email, owner.DisplayName, OrganisationSlug = owned.FirstOrDefault()?.Slug });
        }).RequireRateLimiting("auth");

        // Without a body: sign out everywhere. With an organisation: sign out there and stay signed in elsewhere.
        group.MapPost("/logout", async (LogoutRequest? req, HttpContext http, AppCache cache) =>
        {
            var organisation = string.IsNullOrWhiteSpace(req?.OrganisationSlug) ? null : await cache.OrganisationBySlugAsync(req.OrganisationSlug.Trim());
            if (organisation is null) await http.SignOutAsync();
            else await Sessions.SignOutOfAsync(http, organisation.Id);
            return Results.NoContent();
        });

        // Who this browser is signed in as: possibly an owner, and an account at each organisation it signed in to.
        group.MapGet("/me", async (HttpContext http, PlatformDbContext platform, TenantScopes scopes, IConfiguration config) =>
        {
            var owner = Sessions.OwnerId(http) is { } ownerId
                ? await platform.OwnerAccounts.AsNoTracking().FirstOrDefaultAsync(o => o.Id == ownerId)
                : null;

            var accounts = Sessions.Accounts(http).ToList();
            var tenantIds = accounts.Select(a => a.TenantId).ToList();
            var tenants = await platform.Tenants.AsNoTracking().Where(t => tenantIds.Contains(t.Id)).ToDictionaryAsync(t => t.Id);
            var memberships = new List<SignedInAccount>();
            string? firstName = null, firstEmail = null;
            foreach (var (tenantId, userId) in accounts)
            {
                // An organisation or account that no longer exists is simply left out.
                if (!tenants.TryGetValue(tenantId, out var tenant)) continue;
                await using var scope = await scopes.OpenAsync(tenant.ToOrganisation());
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
                if (user is null) continue;
                var membership = await db.Memberships.AsNoTracking().Where(m => m.UserId == userId)
                    .Select(m => new { m.Role, Tier = m.Tier.Name, m.ExpiresAt }).FirstOrDefaultAsync();
                firstName ??= user.DisplayName;
                firstEmail ??= user.Email;
                // Role and tier stay empty until the person has picked a membership: they may have an account
                // but not have joined yet.
                memberships.Add(new SignedInAccount(tenant.Slug, tenant.Name, Images.Url(tenant.LogoKey),
                    membership?.Role, membership?.Tier, membership?.ExpiresAt, user.Id, user.Email, user.DisplayName));
            }

            if (owner is null && memberships.Count == 0)
            {
                if (http.User.Identity?.IsAuthenticated == true) await http.SignOutAsync();
                return Http.Error(401, "Not signed in.");
            }
            return Results.Ok(new
            {
                Id = owner?.Id, Email = owner?.Email ?? firstEmail, DisplayName = owner?.DisplayName ?? firstName,
                IsOwner = owner is not null,
                Memberships = memberships.OrderBy(m => m.Name),
                // Only an owner login can add organisations; everyone else starts with organiser sign-up.
                CanCreateOrganisations = owner is not null && OrgEndpoints.MayCreateOrganisation(config, owner.Email),
            });
        });
    }
}
