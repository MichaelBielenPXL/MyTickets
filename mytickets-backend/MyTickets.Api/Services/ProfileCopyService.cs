using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;

namespace MyTickets.Api.Services;

/// <summary>
/// Lets someone fill in their details at an organisation with what they gave another organisation they are in. Each
/// organisation keeps its own record, so this only ever happens when the person asks for it, and nothing is saved
/// here: the details only fill the form, which they check and save.
/// </summary>
public class ProfileCopyService(AccountService accounts, TenantScopes scopes)
{
    /// <summary>Another organisation the account has a record at, with details given there.</summary>
    public record Source(string Slug, string Name);

    /// <summary>The account's other organisations where it gave details, the first one joined first.</summary>
    public async Task<List<Source>> SourcesAsync(Guid accountId, Guid currentTenantId)
    {
        var sources = new List<Source>();
        foreach (var (tenant, userId) in await accounts.RecordsAsync(accountId))
            if (tenant.Id != currentTenantId && await DetailsAsync(tenant, userId) is not null)
                sources.Add(new Source(tenant.Slug, tenant.Name));
        return sources;
    }

    /// <summary>The details the account gave at that organisation.</summary>
    public async Task<ProfileFields.Values> DetailsFromAsync(Guid accountId, string fromSlug)
    {
        var (tenant, userId) = (await accounts.RecordsAsync(accountId)).FirstOrDefault(r => r.Tenant.Slug == fromSlug);
        return (tenant is null ? null : await DetailsAsync(tenant, userId))
            ?? throw AppProblem.NotFound("There are no details to bring over from there.");
    }

    /// <summary>What the record at that organisation filled in, from its own database; null when there is nothing.</summary>
    private async Task<ProfileFields.Values?> DetailsAsync(Tenant tenant, Guid userId)
    {
        await using var scope = await scopes.OpenAsync(tenant.ToOrganisation());
        var user = await scope.ServiceProvider.GetRequiredService<AppDbContext>().Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        return user is { FirstName: not null } ? ProfileFields.Of(user) : null;
    }
}
