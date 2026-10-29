using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using XLauncher.Config;
using XLauncher.Infrastructure;

namespace XLauncher.Apps;

public sealed record IconCandidate(string Url, string Label, string Source, int Size);

/// <summary>
/// Finds large icons for an app on the internet so the user can pick a better one than the
/// small Start menu icon: app-store artwork (iTunes Search API, 512 px) and the website's own
/// touch/manifest icons. The chosen image is downloaded, resized to 512 px and stored locally.
/// </summary>
public sealed partial class IconSearch(SettingsStore settings) : IDisposable
{
    const int MaxDownloadBytes = 8_000_000;
    const int IconSize = 512;

    readonly HttpClient _http = CreateClient();

    static HttpClient CreateClient()
    {
        var http = new HttpClient(new SocketsHttpHandler
        {
            ConnectTimeout = TimeSpan.FromSeconds(5),
            AutomaticDecompression = System.Net.DecompressionMethods.All,
            MaxAutomaticRedirections = 5,
        })
        {
            Timeout = TimeSpan.FromSeconds(12),
        };
        http.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) XLauncher/0.2");
        return http;
    }

    public async Task<List<IconCandidate>> SearchAsync(string name, string? website)
    {
        var searches = new List<Task<List<IconCandidate>>> { Safe(() => StoreIconsAsync(name)) };
        if (Uri.TryCreate(website, UriKind.Absolute, out var site) && site.Scheme is "http" or "https")
            searches.Add(Safe(() => SiteIconsAsync(site)));
        var results = await Task.WhenAll(searches);
        // Website icons first (they are the brand's own), then store artwork
        return results.Reverse().SelectMany(r => r).DistinctBy(c => c.Url).Take(12).ToList();
    }

    async Task<List<IconCandidate>> StoreIconsAsync(string name)
    {
        var term = Uri.EscapeDataString(name);
        var lists = await Task.WhenAll(
            GetStringAsync($"https://itunes.apple.com/search?term={term}&entity=software&limit=6"),
            GetStringAsync($"https://itunes.apple.com/search?term={term}&entity=macSoftware&limit=4"));
        return lists.SelectMany(ParseStoreResults).ToList();
    }

    async Task<List<IconCandidate>> SiteIconsAsync(Uri site)
    {
        var html = await GetStringAsync(site.GetLeftPart(UriPartial.Authority) + "/");
        var found = ParseIconLinks(html, site).ToList();
        if (ManifestUrl(html, site) is { } manifest)
        {
            try { found.AddRange(ParseManifest(await GetStringAsync(manifest.ToString()), manifest)); }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException) { }
        }
        found.Add(new IconCandidate($"https://www.google.com/s2/favicons?domain={site.Host}&sz=256", site.Host, "web", 256));
        return found
            .Where(c => !c.Url.EndsWith(".svg", StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(c => c.Size)
            .ToList();
    }

    /// <summary>Downloads the chosen icon, scales it to fit 512 px and makes it the app's icon. Returns the new icon URL.</summary>
    public async Task<string> UseAsync(string appId, string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != "https")
            throw new ArgumentException("Icons can only be downloaded over https");

        using var response = await _http.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();
        if (response.Content.Headers.ContentLength > MaxDownloadBytes) throw new InvalidOperationException("That image is too large");
        var bytes = await response.Content.ReadAsByteArrayAsync();
        if (bytes.Length > MaxDownloadBytes) throw new InvalidOperationException("That image is too large");

        var png = ToSquarePng(bytes, IconSize);
        var file = FileNameFor(appId);
        Directory.CreateDirectory(Paths.CustomIcons);
        await File.WriteAllBytesAsync(Path.Combine(Paths.CustomIcons, file), png);
        settings.Update(s => s.IconOverrides[appId] = file);
        Log.Info($"New icon for {appId} from {uri.Host}");
        return CustomIconUrl(file);
    }

    public void Reset(string appId)
    {
        settings.Update(s => s.IconOverrides.Remove(appId));
        var path = Path.Combine(Paths.CustomIcons, FileNameFor(appId));
        if (File.Exists(path)) File.Delete(path);
    }

    public static string CustomIconUrl(string file)
    {
        var path = Path.Combine(Paths.CustomIcons, file);
        var version = File.Exists(path) ? File.GetLastWriteTimeUtc(path).Ticks : 0;
        return $"https://img.xlauncher.local/custom/{file}?v={version}";
    }

    static string FileNameFor(string appId) =>
        Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(appId))).ToLowerInvariant() + ".png";

    // Centers the picture on a transparent square so wide logos are not stretched
    static byte[] ToSquarePng(byte[] bytes, int size)
    {
        using var input = new MemoryStream(bytes);
        Image source;
        try { source = Image.FromStream(input); }
        catch (ArgumentException) { throw new InvalidOperationException("That file is not an image Windows can read"); }
        using (source)
        {
            var scale = Math.Min((double)size / source.Width, (double)size / source.Height);
            var w = (int)Math.Round(source.Width * scale);
            var h = (int)Math.Round(source.Height * scale);
            using var canvas = new Bitmap(size, size, PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(canvas))
            {
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.Clear(Color.Transparent);
                g.DrawImage(source, (size - w) / 2, (size - h) / 2, w, h);
            }
            using var output = new MemoryStream();
            canvas.Save(output, ImageFormat.Png);
            return output.ToArray();
        }
    }

    async Task<string> GetStringAsync(string url)
    {
        using var response = await _http.GetAsync(url);
        response.EnsureSuccessStatusCode();
        var text = await response.Content.ReadAsStringAsync();
        return text.Length > 2_000_000 ? text[..2_000_000] : text;
    }

    static async Task<List<IconCandidate>> Safe(Func<Task<List<IconCandidate>>> search)
    {
        try { return await search(); }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or UriFormatException)
        {
            Log.Info($"Icon search source failed: {ex.Message}");
            return [];
        }
    }

    // ---------------------------------------------------------------- parsing (pure, unit tested)

    public static IEnumerable<IconCandidate> ParseStoreResults(string json)
    {
        using var doc = JsonDocument.Parse(json);
        foreach (var r in doc.RootElement.Arr("results"))
        {
            var art = r.Str("artworkUrl512") ?? r.Str("artworkUrl100");
            if (art is null) continue;
            // Store artwork URLs end in e.g. 512x512bb.png; ask for the biggest useful size
            art = Regex.Replace(art, @"/\d+x\d+(bb)?\.(png|jpg)$", "/512x512bb.png");
            yield return new IconCandidate(art, r.Str("trackName") ?? "", "store", 512);
        }
    }

    public static IEnumerable<IconCandidate> ParseIconLinks(string html, Uri page)
    {
        foreach (Match tag in LinkTag().Matches(html))
        {
            var attrs = Attributes(tag.Value);
            if (!attrs.TryGetValue("rel", out var rel) || !attrs.TryGetValue("href", out var href)) continue;
            rel = rel.ToLowerInvariant();
            if (!rel.Contains("icon")) continue;
            if (!Uri.TryCreate(page, href, out var url)) continue;
            var size = attrs.TryGetValue("sizes", out var sizes) ? LargestSize(sizes) : rel.Contains("apple-touch") ? 180 : 32;
            yield return new IconCandidate(url.ToString(), page.Host, "web", size);
        }
    }

    public static Uri? ManifestUrl(string html, Uri page)
    {
        foreach (Match tag in LinkTag().Matches(html))
        {
            var attrs = Attributes(tag.Value);
            if (attrs.TryGetValue("rel", out var rel) && rel.Equals("manifest", StringComparison.OrdinalIgnoreCase)
                && attrs.TryGetValue("href", out var href) && Uri.TryCreate(page, href, out var url))
                return url;
        }
        return null;
    }

    public static IEnumerable<IconCandidate> ParseManifest(string json, Uri manifest)
    {
        using var doc = JsonDocument.Parse(json);
        var name = doc.RootElement.Str("short_name") ?? doc.RootElement.Str("name") ?? manifest.Host;
        foreach (var icon in doc.RootElement.Arr("icons"))
            if (icon.Str("src") is { } src && Uri.TryCreate(manifest, src, out var url))
                yield return new IconCandidate(url.ToString(), name, "web", LargestSize(icon.Str("sizes") ?? ""));
    }

    static int LargestSize(string sizes) =>
        SizePattern().Matches(sizes).Select(m => int.Parse(m.Groups[1].Value)).DefaultIfEmpty(32).Max();

    static Dictionary<string, string> Attributes(string tag) =>
        AttributePattern().Matches(tag)
            .GroupBy(m => m.Groups[1].Value.ToLowerInvariant())
            .ToDictionary(g => g.Key, g => System.Net.WebUtility.HtmlDecode(g.First().Groups[3].Success ? g.First().Groups[3].Value
                : g.First().Groups[4].Success ? g.First().Groups[4].Value : g.First().Groups[5].Value));

    [GeneratedRegex(@"<link\b[^>]*>", RegexOptions.IgnoreCase)]
    private static partial Regex LinkTag();

    [GeneratedRegex(@"([\w-]+)\s*=\s*(""([^""]*)""|'([^']*)'|([^\s>]+))")]
    private static partial Regex AttributePattern();

    [GeneratedRegex(@"(\d+)x\d+", RegexOptions.IgnoreCase)]
    private static partial Regex SizePattern();

    public void Dispose() => _http.Dispose();
}
