using System.Web;
using XLauncher.Apps;
using XLauncher.Config;
using XLauncher.Infrastructure;
using XLauncher.Plex;

namespace XLauncher.Web;

/// <summary>
/// Serves https://img.xlauncher.local/* to the WebView:
///   /app/{key}.png              app icon
///   /plex/{serverId}/{w}x{h}?u= Plex artwork
///   /photo?p=                   a picture from the ambient-mode folder
/// </summary>
public sealed class ImageRouter(AppCatalog apps, PlexImages plexImages, SettingsStore settings)
{
    public const string Host = "img.xlauncher.local";

    static readonly Dictionary<string, string> PhotoTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".png"] = "image/png",
        [".webp"] = "image/webp",
    };

    public async Task<(byte[]? Data, string Mime)> ResolveAsync(Uri uri)
    {
        var segments = uri.AbsolutePath.Trim('/').Split('/');
        var query = HttpUtility.ParseQueryString(uri.Query);
        switch (segments[0])
        {
            case "app" when segments.Length == 2:
                return (await apps.GetIconAsync(Path.GetFileNameWithoutExtension(segments[1])), "image/png");

            case "plex" when segments.Length == 3 && query["u"] is { Length: > 0 } path:
                var size = segments[2].Split('x');
                if (size.Length != 2 || !int.TryParse(size[0], out var w) || !int.TryParse(size[1], out var h)) return (null, "");
                return (await plexImages.GetAsync(segments[1], w, h, path), "image/jpeg");

            case "photo" when query["p"] is { Length: > 0 } file:
                return await PhotoAsync(file);

            case "custom" when segments.Length == 2:
                return (await ReadLocalAsync(Paths.CustomIcons, segments[1]), "image/png");

            case "avatar" when segments.Length == 2:
                return (await ReadLocalAsync(Paths.Avatars, segments[1]), "image/jpeg");

            default:
                return (null, "");
        }
    }

    // Only files inside the folder the user picked for ambient mode
    async Task<(byte[]?, string)> PhotoAsync(string file)
    {
        var folder = settings.Current.Ambient.Folder;
        if (string.IsNullOrWhiteSpace(folder)) return (null, "");
        var root = Path.GetFullPath(folder).TrimEnd('\\') + "\\";
        var full = Path.GetFullPath(file);
        if (!full.StartsWith(root, StringComparison.OrdinalIgnoreCase) || !PhotoTypes.TryGetValue(Path.GetExtension(full), out var mime) || !File.Exists(full))
            return (null, "");
        return (await File.ReadAllBytesAsync(full), mime);
    }

    // A plain file name inside one of our own folders; anything with a path in it is refused
    static async Task<byte[]?> ReadLocalAsync(string folder, string name)
    {
        if (name != Path.GetFileName(name) || name.Contains("..")) return null;
        var path = Path.Combine(folder, name);
        return File.Exists(path) ? await File.ReadAllBytesAsync(path) : null;
    }

    public static List<string> ListPhotos(string folder, int max = 500)
    {
        if (string.IsNullOrWhiteSpace(folder) || !Directory.Exists(folder)) return [];
        return Directory.EnumerateFiles(folder, "*.*", SearchOption.AllDirectories)
            .Where(f => PhotoTypes.ContainsKey(Path.GetExtension(f)))
            .Take(max)
            .Select(f => $"https://{Host}/photo?p={Uri.EscapeDataString(f)}")
            .ToList();
    }
}
