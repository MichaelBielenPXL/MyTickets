using System.Text.RegularExpressions;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;

namespace MyTickets.Api.Services;

/// <summary>Where uploaded pictures (logos, event images) are kept.</summary>
public interface IImageStore
{
    Task SaveAsync(string key, Stream content, string contentType, CancellationToken ct = default);
    /// <summary>Null when there is no picture with this key.</summary>
    Task<Stream?> OpenAsync(string key, CancellationToken ct = default);
}

public static partial class Images
{
    public const int MaxBytes = 4 * 1024 * 1024;

    /// <summary>Every key looks like orgs/&lt;organisation&gt;/&lt;random&gt;.&lt;type&gt;. Anything else is refused, so a key can never point outside the store.</summary>
    [GeneratedRegex("^orgs/[0-9a-f]{32}/[0-9a-f]{32}\\.(png|jpg|webp)$")]
    public static partial Regex ValidKey();

    public static string NewKey(Guid organisationId, string extension) => $"orgs/{organisationId:N}/{Guid.NewGuid():N}.{extension}";

    public static bool BelongsTo(string key, Guid organisationId) =>
        ValidKey().IsMatch(key) && key.StartsWith($"orgs/{organisationId:N}/", StringComparison.Ordinal);

    public static string? Url(string? key) => key is null ? null : $"/api/images/{key}";

    public static string ContentType(string key) => Path.GetExtension(key) switch
    {
        ".png" => "image/png",
        ".jpg" => "image/jpeg",
        _ => "image/webp",
    };

    /// <summary>
    /// Works out what kind of picture this is from its first bytes, not from the file name or what the
    /// browser claims. Returns null for anything that is not a PNG, JPEG or WebP (SVG is refused on purpose:
    /// it can carry scripts).
    /// </summary>
    public static string? DetectExtension(ReadOnlySpan<byte> start)
    {
        if (start.Length >= 8 && start[..8].SequenceEqual<byte>([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return "png";
        if (start.Length >= 3 && start[0] == 0xFF && start[1] == 0xD8 && start[2] == 0xFF) return "jpg";
        if (start.Length >= 12 && start[..4].SequenceEqual("RIFF"u8) && start[8..12].SequenceEqual("WEBP"u8)) return "webp";
        return null;
    }
}

/// <summary>Keeps pictures in an S3-compatible bucket (RustFS when started through the Aspire host).</summary>
public sealed class S3ImageStore : IImageStore, IDisposable
{
    private readonly AmazonS3Client _client;
    private readonly string _bucket;
    private readonly SemaphoreSlim _bucketLock = new(1, 1);
    private bool _bucketReady;

    public S3ImageStore(IConfiguration config)
    {
        _bucket = config["Storage:Bucket"] ?? "mytickets-images";
        _client = new AmazonS3Client(
            new BasicAWSCredentials(config["Storage:AccessKey"], config["Storage:SecretKey"]),
            new AmazonS3Config
            {
                ServiceURL = config["Storage:Endpoint"],
                ForcePathStyle = true,
                AuthenticationRegion = "us-east-1",
                // Newer AWS checksum headers are not understood by every S3-compatible server.
                RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
                ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED,
            });
    }

    public async Task SaveAsync(string key, Stream content, string contentType, CancellationToken ct = default)
    {
        await EnsureBucketAsync(ct);
        await _client.PutObjectAsync(new PutObjectRequest
        {
            BucketName = _bucket, Key = key, InputStream = content, ContentType = contentType, AutoCloseStream = false,
        }, ct);
    }

    public async Task<Stream?> OpenAsync(string key, CancellationToken ct = default)
    {
        try
        {
            var response = await _client.GetObjectAsync(_bucket, key, ct);
            return response.ResponseStream;
        }
        catch (AmazonS3Exception e) when (e.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    private async Task EnsureBucketAsync(CancellationToken ct)
    {
        if (_bucketReady) return;
        await _bucketLock.WaitAsync(ct);
        try
        {
            if (_bucketReady) return;
            try { await _client.PutBucketAsync(_bucket, ct); }
            catch (AmazonS3Exception e) when (e.ErrorCode is "BucketAlreadyOwnedByYou" or "BucketAlreadyExists") { }
            _bucketReady = true;
        }
        finally { _bucketLock.Release(); }
    }

    public void Dispose() => _client.Dispose();
}

/// <summary>Keeps pictures in a folder. Used when no bucket is configured: running the API on its own, and in tests.</summary>
public sealed class FolderImageStore(string folder) : IImageStore
{
    public async Task SaveAsync(string key, Stream content, string contentType, CancellationToken ct = default)
    {
        var path = PathFor(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var file = File.Create(path);
        await content.CopyToAsync(file, ct);
    }

    public Task<Stream?> OpenAsync(string key, CancellationToken ct = default)
    {
        var path = PathFor(key);
        return Task.FromResult<Stream?>(File.Exists(path) ? File.OpenRead(path) : null);
    }

    private string PathFor(string key) =>
        Images.ValidKey().IsMatch(key) ? Path.Combine(folder, key) : throw new ArgumentException("Invalid image key.", nameof(key));
}
