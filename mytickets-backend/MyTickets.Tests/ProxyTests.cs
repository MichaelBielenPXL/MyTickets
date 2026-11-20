using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;

namespace MyTickets.Tests;

/// <summary>
/// Live, the API sits behind two proxies: Vercel (the site calls /api on its own address) and Caddy on the server.
/// The sign-in limit must count per visitor, not per proxy, or one busy evening locks everyone out.
/// </summary>
public class BehindProxyApp : TestApp
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("RateLimits:AuthPerMinute", "2");
        builder.UseSetting("Proxy:ForwardedHops", "2");
    }
}

public class ProxyTests(BehindProxyApp app) : IClassFixture<BehindProxyApp>
{
    private async Task<HttpStatusCode> SignInFromAsync(string visitorIp)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new { email = "nobody@example.com", password = "wrong password" }),
        };
        // What Vercel and then Caddy add: the visitor, then the Vercel address Caddy saw.
        request.Headers.Add("X-Forwarded-For", $"{visitorIp}, 76.76.21.21");
        request.Headers.Add("X-Forwarded-Proto", "https");
        return (await app.CreateClient().SendAsync(request)).StatusCode;
    }

    [Fact]
    public async Task The_sign_in_limit_counts_per_visitor_behind_the_proxies()
    {
        await SignInFromAsync("203.0.113.1");
        await SignInFromAsync("203.0.113.1");
        Assert.Equal(HttpStatusCode.TooManyRequests, await SignInFromAsync("203.0.113.1"));

        Assert.NotEqual(HttpStatusCode.TooManyRequests, await SignInFromAsync("203.0.113.2"));
    }
}

/// <summary>Behind Cloudflare: it hands over the visitor's own address in CF-Connecting-IP, whatever proxies follow.</summary>
public class BehindCloudflareApp : TestApp
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("RateLimits:AuthPerMinute", "2");
        builder.UseSetting("Proxy:ClientIpHeader", "CF-Connecting-IP");
    }
}

public class CloudflareTests(BehindCloudflareApp app) : IClassFixture<BehindCloudflareApp>
{
    private async Task<HttpStatusCode> SignInFromAsync(string visitorIp)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new { email = "nobody@example.com", password = "wrong password" }),
        };
        request.Headers.Add("CF-Connecting-IP", visitorIp);
        // Whatever the proxies in between add (Coolify's, nginx): not the visitor.
        request.Headers.Add("X-Forwarded-For", $"{visitorIp}, 10.0.0.5, 10.0.1.7");
        return (await app.CreateClient().SendAsync(request)).StatusCode;
    }

    [Fact]
    public async Task The_sign_in_limit_counts_per_visitor_behind_cloudflare()
    {
        await SignInFromAsync("203.0.113.1");
        await SignInFromAsync("203.0.113.1");
        Assert.Equal(HttpStatusCode.TooManyRequests, await SignInFromAsync("203.0.113.1"));

        Assert.NotEqual(HttpStatusCode.TooManyRequests, await SignInFromAsync("203.0.113.2"));
    }
}
