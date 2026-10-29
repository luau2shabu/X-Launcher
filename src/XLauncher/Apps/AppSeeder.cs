using System.Text.RegularExpressions;
using XLauncher.Config;

namespace XLauncher.Apps;

/// <summary>First-run defaults: website tiles for missing streaming services and a starting "Your apps" row.</summary>
public static class AppSeeder
{
    public const string TvUserAgent =
        "Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 85.0.4183.93/6.0 TV Safari/537.36";

    sealed record Wish(string Pattern, string Name, string? Website = null, bool TvMode = false);

    // Order here is the order of the default favorites row
    static readonly Wish[] Wanted =
    [
        new(@"^Plex HTPC$", "Plex HTPC"),
        new(@"^Netflix$", "Netflix", "https://www.netflix.com/browse"),
        new(@"^YouTube$", "YouTube", "https://www.youtube.com/tv", TvMode: true),
        new(@"^Prime Video", "Prime Video", "https://www.primevideo.com"),
        new(@"^(HBO Max|Max)$", "HBO Max", "https://play.hbomax.com"),
        new(@"^Disney\+", "Disney+"),
        new(@"^Spotify", "Spotify"),
        new(@"^Kodi$", "Kodi"),
        new(@"^VLC media player$", "VLC media player"),
        new(@"^Steam$", "Steam"),
    ];

    /// <summary>Website tiles for services that have no installed app. YouTube always gets its TV-mode tile.</summary>
    public static List<CustomApp> MissingWebsites(IReadOnlyList<AppEntry> installed)
    {
        var result = new List<CustomApp>();
        foreach (var wish in Wanted)
        {
            if (wish.Website is null) continue;
            // The desktop YouTube app/PWA is mouse-driven; the TV site is what a remote needs.
            var installedAlready = !wish.TvMode && installed.Any(a => Matches(a, wish));
            if (installedAlready) continue;
            result.Add(new CustomApp { Name = wish.Name, Kind = "url", Target = wish.Website, TvMode = wish.TvMode });
        }
        return result;
    }

    /// <summary>Picks the default favorites in <see cref="Wanted"/> order, preferring TV-mode tiles and Store apps.</summary>
    public static List<string> PickFavorites(IReadOnlyList<AppEntry> apps)
    {
        var picks = new List<string>();
        foreach (var wish in Wanted)
        {
            var match = apps
                .Where(a => Matches(a, wish))
                .OrderByDescending(a => a.TvMode)
                .ThenByDescending(a => a.Kind == "store")
                .FirstOrDefault();
            if (match is not null && !picks.Contains(match.Id)) picks.Add(match.Id);
        }
        return picks;
    }

    static bool Matches(AppEntry app, Wish wish) => Regex.IsMatch(app.Name, wish.Pattern, RegexOptions.IgnoreCase);
}
