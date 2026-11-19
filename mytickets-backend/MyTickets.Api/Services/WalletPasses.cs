using System.Buffers.Binary;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Security.Cryptography.Pkcs;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace MyTickets.Api.Services;

/// <summary>What goes on a member's wallet pass. The token balance stays off it: a saved pass never updates.</summary>
public record MemberPassData(
    Guid MembershipId, Guid OrganisationId, string OrganisationName, string? BrandColor,
    string MemberName, string Tier, DateTime? ExpiresAt, bool Active, string Code,
    byte[]? LogoPng, string? LogoUrl);

/// <summary>
/// "Add to Apple Wallet": a signed .pkpass file. Needs a Pass Type ID certificate from an Apple Developer
/// account (WalletPasses:Apple:*). Without one the button isn't offered.
/// </summary>
public class AppleWalletPasses(IConfiguration config, IWebHostEnvironment env)
{
    private IConfigurationSection Settings => config.GetSection("WalletPasses:Apple");

    public bool Enabled =>
        !string.IsNullOrEmpty(Settings["PassTypeId"]) && !string.IsNullOrEmpty(Settings["TeamId"]) &&
        !string.IsNullOrEmpty(Settings["CertificatePath"]) && !string.IsNullOrEmpty(Settings["WwdrCertificatePath"]);

    public byte[] Build(MemberPassData pass)
    {
        var (background, ink) = WalletColors.Of(pass.BrandColor);
        var json = new JsonObject
        {
            ["formatVersion"] = 1,
            ["passTypeIdentifier"] = Settings["PassTypeId"],
            ["teamIdentifier"] = Settings["TeamId"],
            ["serialNumber"] = pass.MembershipId.ToString("N"),
            ["organizationName"] = pass.OrganisationName,
            ["description"] = $"{pass.OrganisationName} membership",
            ["logoText"] = pass.OrganisationName,
            ["backgroundColor"] = WalletColors.Rgb(background),
            ["foregroundColor"] = WalletColors.Rgb(ink),
            ["labelColor"] = WalletColors.Rgb(ink),
            ["barcodes"] = new JsonArray(new JsonObject
            {
                ["format"] = "PKBarcodeFormatQR", ["message"] = pass.Code,
                ["messageEncoding"] = "iso-8859-1", ["altText"] = MemberPasses.Display(pass.Code),
            }),
            ["storeCard"] = new JsonObject
            {
                ["primaryFields"] = new JsonArray(Field("member", "MEMBER", pass.MemberName)),
                ["secondaryFields"] = new JsonArray(
                    Field("tier", "MEMBERSHIP", pass.Tier),
                    Field("valid", pass.Active ? "VALID UNTIL" : "EXPIRED", WalletColors.Until(pass.ExpiresAt))),
                ["backFields"] = new JsonArray(Field("how", "AT THE DOOR AND THE BAR",
                    "Show this code to staff. They scan it the same way they would tap your card.")),
            },
        };

        var icon = pass.LogoPng ?? SolidPng.Square(87, background);
        var files = new Dictionary<string, byte[]>
        {
            ["pass.json"] = Encoding.UTF8.GetBytes(json.ToJsonString()),
            ["icon.png"] = icon,
            ["icon@2x.png"] = icon,
        };
        if (pass.LogoPng is not null) { files["logo.png"] = pass.LogoPng; files["logo@2x.png"] = pass.LogoPng; }

        var manifest = new JsonObject();
        foreach (var (name, bytes) in files) manifest[name] = Convert.ToHexStringLower(SHA1.HashData(bytes));
        var manifestBytes = Encoding.UTF8.GetBytes(manifest.ToJsonString());

        using var output = new MemoryStream();
        using (var zip = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var (name, bytes) in files) Add(zip, name, bytes);
            Add(zip, "manifest.json", manifestBytes);
            Add(zip, "signature", Sign(manifestBytes));
        }
        return output.ToArray();
    }

    private static JsonObject Field(string key, string label, string value) =>
        new() { ["key"] = key, ["label"] = label, ["value"] = value };

    private static void Add(ZipArchive zip, string name, byte[] bytes)
    {
        using var entry = zip.CreateEntry(name).Open();
        entry.Write(bytes);
    }

    /// <summary>Apple checks the manifest against a detached PKCS #7 signature by the pass certificate.</summary>
    private byte[] Sign(byte[] manifest)
    {
        using var signer = X509CertificateLoader.LoadPkcs12FromFile(
            Path.Combine(env.ContentRootPath, Settings["CertificatePath"]!), Settings["CertificatePassword"]);
        using var wwdr = X509CertificateLoader.LoadCertificateFromFile(Path.Combine(env.ContentRootPath, Settings["WwdrCertificatePath"]!));
        var cms = new SignedCms(new ContentInfo(manifest), detached: true);
        var cmsSigner = new CmsSigner(SubjectIdentifierType.IssuerAndSerialNumber, signer) { IncludeOption = X509IncludeOption.EndCertOnly };
        cmsSigner.Certificates.Add(wwdr);
        cmsSigner.SignedAttributes.Add(new Pkcs9SigningTime(DateTime.UtcNow));
        cms.ComputeSignature(cmsSigner);
        return cms.Encode();
    }
}

/// <summary>
/// "Add to Google Wallet": a signed link that saves a generic pass. Needs a Google Wallet issuer account and a
/// service account key (WalletPasses:Google:*). Without one the button isn't offered.
/// </summary>
public class GoogleWalletPasses(IConfiguration config, IWebHostEnvironment env, TimeProvider clock)
{
    private IConfigurationSection Settings => config.GetSection("WalletPasses:Google");

    public bool Enabled => !string.IsNullOrEmpty(Settings["IssuerId"]) && !string.IsNullOrEmpty(Settings["ServiceAccountKeyPath"]);

    /// <param name="origin">The site the button is on, e.g. "https://tickets.example.com".</param>
    public string SaveUrl(MemberPassData pass, string origin)
    {
        var key = JsonNode.Parse(File.ReadAllText(Path.Combine(env.ContentRootPath, Settings["ServiceAccountKeyPath"]!)))!;
        var issuer = Settings["IssuerId"]!;
        var (background, _) = WalletColors.Of(pass.BrandColor);
        var classId = $"{issuer}.mytickets-{pass.OrganisationId:N}";

        var passObject = new JsonObject
        {
            ["id"] = $"{issuer}.{pass.MembershipId:N}",
            ["classId"] = classId,
            ["state"] = "ACTIVE",
            ["cardTitle"] = Text(pass.OrganisationName),
            ["header"] = Text(pass.MemberName),
            ["subheader"] = Text(pass.Tier),
            ["hexBackgroundColor"] = background,
            ["barcode"] = new JsonObject { ["type"] = "QR_CODE", ["value"] = pass.Code, ["alternateText"] = MemberPasses.Display(pass.Code) },
            ["textModulesData"] = new JsonArray(new JsonObject
            {
                ["id"] = "valid", ["header"] = pass.Active ? "Valid until" : "Expired", ["body"] = WalletColors.Until(pass.ExpiresAt),
            }),
        };
        if (pass.LogoUrl is not null)
            passObject["logo"] = new JsonObject { ["sourceUri"] = new JsonObject { ["uri"] = origin + pass.LogoUrl } };

        var claims = new JsonObject
        {
            ["iss"] = (string)key["client_email"]!,
            ["aud"] = "google",
            ["typ"] = "savetowallet",
            ["iat"] = clock.GetUtcNow().ToUnixTimeSeconds(),
            ["origins"] = new JsonArray(origin),
            ["payload"] = new JsonObject
            {
                ["genericClasses"] = new JsonArray(new JsonObject { ["id"] = classId }),
                ["genericObjects"] = new JsonArray(passObject),
            },
        };
        return "https://pay.google.com/gp/v/save/" + Jwt((string)key["private_key"]!, claims);
    }

    private static JsonObject Text(string value) =>
        new() { ["defaultValue"] = new JsonObject { ["language"] = "en", ["value"] = value } };

    private static string Jwt(string privateKeyPem, JsonObject claims)
    {
        static string B64(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var unsigned = B64(Encoding.UTF8.GetBytes("""{"alg":"RS256","typ":"JWT"}""")) + "." + B64(Encoding.UTF8.GetBytes(claims.ToJsonString()));
        using var rsa = RSA.Create();
        rsa.ImportFromPem(privateKeyPem);
        return unsigned + "." + B64(rsa.SignData(Encoding.ASCII.GetBytes(unsigned), HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1));
    }
}

internal static class WalletColors
{
    /// <summary>The organisation's colour and the text colour that reads best on it, as "#rrggbb".</summary>
    /// <summary>The organisation's colour, darkened if needed so white text reads on it, and that white.</summary>
    public static (string Background, string Ink) Of(string? brand) =>
        (BrandColors.ReadableShade(brand is not null && BrandColors.IsValid(brand) ? brand : "#1c1c1e"), "#ffffff");

    public static (int R, int G, int B) Channels(string hex) =>
        (Convert.ToInt32(hex[1..3], 16), Convert.ToInt32(hex[3..5], 16), Convert.ToInt32(hex[5..7], 16));

    public static string Rgb(string hex) { var (r, g, b) = Channels(hex); return $"rgb({r}, {g}, {b})"; }

    public static string Until(DateTime? expiresAt) =>
        expiresAt is { } end ? end.AddSeconds(-1).ToString("d MMM yyyy", System.Globalization.CultureInfo.InvariantCulture) : "No end date";
}

/// <summary>A plain square PNG, for a pass icon when the organisation has no PNG logo.</summary>
internal static class SolidPng
{
    public static byte[] Square(int size, string hex)
    {
        var (r, g, b) = WalletColors.Channels(hex);
        var raw = new byte[size * (1 + size * 3)];
        for (var y = 0; y < size; y++)
        for (var x = 0; x < size; x++)
        {
            var i = y * (1 + size * 3) + 1 + x * 3;
            raw[i] = (byte)r; raw[i + 1] = (byte)g; raw[i + 2] = (byte)b;
        }
        using var compressed = new MemoryStream();
        using (var z = new ZLibStream(compressed, CompressionLevel.Optimal, leaveOpen: true)) z.Write(raw);

        var header = new byte[13];
        BinaryPrimitives.WriteInt32BigEndian(header, size);
        BinaryPrimitives.WriteInt32BigEndian(header.AsSpan(4), size);
        header[8] = 8; header[9] = 2; // 8 bits per channel, RGB

        using var png = new MemoryStream();
        png.Write([0x89, (byte)'P', (byte)'N', (byte)'G', 0x0D, 0x0A, 0x1A, 0x0A]);
        Chunk(png, "IHDR", header);
        Chunk(png, "IDAT", compressed.ToArray());
        Chunk(png, "IEND", []);
        return png.ToArray();
    }

    private static void Chunk(Stream png, string type, byte[] data)
    {
        Span<byte> number = stackalloc byte[4];
        BinaryPrimitives.WriteInt32BigEndian(number, data.Length);
        png.Write(number);
        var typed = Encoding.ASCII.GetBytes(type).Concat(data).ToArray();
        png.Write(typed);
        BinaryPrimitives.WriteUInt32BigEndian(number, Crc32(typed));
        png.Write(number);
    }

    private static uint Crc32(byte[] bytes)
    {
        var crc = 0xFFFFFFFFu;
        foreach (var b in bytes)
        {
            crc ^= b;
            for (var k = 0; k < 8; k++) crc = (crc & 1) != 0 ? (crc >> 1) ^ 0xEDB88320u : crc >> 1;
        }
        return ~crc;
    }
}
