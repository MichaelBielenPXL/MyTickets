using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

public static class ImageEndpoints
{
    public static void MapImages(this IEndpointRouteBuilder app)
    {
        // Admins upload a picture first and get back a key, which they then save on the organisation or event.
        app.MapPost("/api/orgs/{slug}/admin/images", async (IFormFile? file, HttpContext http, IImageStore store) =>
        {
            if (file is null || file.Length == 0) return Http.Error(400, "Choose a picture to upload.");
            if (file.Length > Images.MaxBytes) return Http.Error(400, $"That picture is too large. The limit is {Images.MaxBytes / 1024 / 1024} MB.");

            await using var content = new MemoryStream();
            await file.CopyToAsync(content);
            var extension = Images.DetectExtension(content.GetBuffer().AsSpan(0, (int)Math.Min(content.Length, 16)));
            if (extension is null) return Http.Error(400, "Upload a PNG, JPEG or WebP picture.");

            var key = Images.NewKey(http.Org().Org.Id, extension);
            content.Position = 0;
            await store.SaveAsync(key, content, Images.ContentType(key));
            return Results.Ok(new { Key = key, Url = Images.Url(key) });
        })
        .RequireOrg(OrgRole.Admin)
        // Safe without a form token: the sign-in cookie is SameSite=Lax, so other sites cannot post with it.
        .DisableAntiforgery();

        app.MapGet("/api/images/{**key}", async (string key, HttpContext http, IImageStore store) =>
        {
            if (!Images.ValidKey().IsMatch(key)) return Results.NotFound();
            var content = await store.OpenAsync(key);
            if (content is null) return Results.NotFound();
            // A key never gets different content, so browsers may keep the picture for good.
            http.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
            http.Response.Headers.XContentTypeOptions = "nosniff";
            return Results.Stream(content, Images.ContentType(key));
        }); // No sign-in needed: logos and event pictures are shown on the public organisation pages.
    }

    private static RouteHandlerBuilder RequireOrg(this RouteHandlerBuilder endpoint, OrgRole role)
    {
        endpoint.RequireAuthorization();
        endpoint.AddEndpointFilter((ctx, next) => Http.OrgFilter(ctx, next, role));
        return endpoint;
    }
}
