using System.Text.Json;
using XLauncher.Infrastructure;

namespace XLauncher.Plex;

/// <summary>Turns Plex <c>Metadata</c> JSON into <see cref="PlexItem"/>.</summary>
public static class PlexMapper
{
    public const int PosterW = 360, PosterH = 540;
    public const int LandscapeW = 640, LandscapeH = 360;
    public const int ArtW = 1920, ArtH = 1080;

    public static string? ImageUrl(string serverId, string? path, int w, int h) =>
        string.IsNullOrEmpty(path) ? null : $"https://img.xlauncher.local/plex/{serverId}/{w}x{h}?u={Uri.EscapeDataString(path)}";

    public static PlexItem ToItem(JsonElement m, string serverId, string serverName)
    {
        var type = m.Str("type") ?? "";
        var duration = m.Long("duration");
        var viewOffset = m.Long("viewOffset");
        var leafCount = m.IntOrNull("leafCount");
        var viewedLeafCount = m.IntOrNull("viewedLeafCount");
        string? Img(string? path, int w, int h) => ImageUrl(serverId, path, w, h);

        var item = new PlexItem
        {
            Server = serverId,
            ServerName = serverName,
            Key = m.Str("ratingKey") ?? "",
            Guid = m.Str("guid"),
            Type = type,
            SectionKey = m.Str("librarySectionID"),
            Summary = m.Str("summary"),
            Tagline = m.Str("tagline"),
            Year = m.IntOrNull("year"),
            Duration = duration,
            ViewOffset = viewOffset,
            Progress = duration > 0 ? Math.Clamp((double)viewOffset / duration, 0, 1) : 0,
            Watched = type is "show" or "season"
                ? leafCount > 0 && viewedLeafCount >= leafCount
                : m.Int("viewCount") > 0 && viewOffset == 0,
            Rating = m.Dbl("audienceRating") ?? m.Dbl("rating"),
            ContentRating = m.Str("contentRating"),
            Studio = m.Str("studio"),
            Genres = m.Tags("Genre", 4),
            Directors = m.Tags("Director", 3),
            Cast = m.Tags("Role", 6),
            Badges = PlexBadges.From(m),
            LeafCount = leafCount,
            ViewedLeafCount = viewedLeafCount,
            ChildCount = m.IntOrNull("childCount"),
            AddedAt = m.Long("addedAt"),
            LastViewedAt = m.Long("lastViewedAt"),
            Title = type switch
            {
                "episode" => m.Str("grandparentTitle") ?? m.Str("title") ?? "",
                "season" => m.Str("parentTitle") ?? m.Str("title") ?? "",
                _ => m.Str("title") ?? "",
            },
            EpisodeTitle = type == "episode" ? m.Str("title") : null,
            Subtitle = type switch
            {
                "episode" => EpisodeLabel(m.IntOrNull("parentIndex"), m.IntOrNull("index"), m.Str("title")),
                "season" => m.Str("title"),
                _ => m.IntOrNull("year")?.ToString(),
            },
            Season = type switch
            {
                "episode" => m.IntOrNull("parentIndex"),
                "season" => m.IntOrNull("index"),
                _ => null,
            },
            Episode = type == "episode" ? m.IntOrNull("index") : null,
            ShowKey = type switch
            {
                "episode" => m.Str("grandparentRatingKey"),
                "season" => m.Str("parentRatingKey"),
                _ => null,
            },
            SeasonKey = type == "episode" ? m.Str("parentRatingKey") : null,
            Poster = type switch
            {
                "episode" => Img(m.Str("grandparentThumb") ?? m.Str("parentThumb") ?? m.Str("thumb"), PosterW, PosterH),
                "season" => Img(m.Str("thumb") ?? m.Str("parentThumb"), PosterW, PosterH),
                _ => Img(m.Str("thumb"), PosterW, PosterH),
            },
            Landscape = type == "episode"
                ? Img(m.Str("thumb"), LandscapeW, LandscapeH)
                : Img(m.Str("art") ?? m.Str("parentArt") ?? m.Str("thumb"), LandscapeW, LandscapeH),
            Art = Img(type == "episode" ? m.Str("grandparentArt") ?? m.Str("art") : m.Str("art") ?? m.Str("parentArt"), ArtW, ArtH),
        };

        if (m.TryGetProperty("OnDeck", out var onDeck) && onDeck.Arr("Metadata").FirstOrDefault() is { ValueKind: JsonValueKind.Object } next)
            item.OnDeck = ToItem(next, serverId, serverName);
        return item;
    }

    public static List<PlexItem> Items(JsonElement container, string serverId, string serverName) =>
        container.Arr("Metadata").Select(m => ToItem(m, serverId, serverName)).Where(i => i.Key.Length > 0).ToList();

    static string EpisodeLabel(int? season, int? episode, string? title)
    {
        var label = season is null ? $"E{episode}" : $"S{season} E{episode}";
        return string.IsNullOrEmpty(title) ? label : $"{label} · {title}";
    }
}
