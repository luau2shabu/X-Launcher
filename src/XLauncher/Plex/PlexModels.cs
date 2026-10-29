namespace XLauncher.Plex;

/// <summary>A reachable Plex Media Server. The token never leaves the host process.</summary>
public sealed class PlexServer(string id, string name, string baseUrl, string token, bool owned, bool onThisPc)
{
    public string Id { get; } = id;
    public string Name { get; } = name;
    public string BaseUrl { get; } = baseUrl.TrimEnd('/');
    public string Token { get; } = token;
    public bool Owned { get; } = owned;
    /// <summary>The server installed on this PC, used to relay remote-control commands to Plex HTPC.</summary>
    public bool OnThisPc { get; } = onThisPc;

    public object ToInfo() => new { id = Id, name = Name, owned = Owned, onThisPc = OnThisPc };

    public override string ToString() => $"{Name} ({Id})";
}

public sealed record PlexSection(string Id, string Server, string ServerName, string Key, string Title, string Type, string? Art, bool Hidden);

/// <summary>A titled row of items. Kind: continue | picks | recent | genre | related.</summary>
public sealed record PlexRow(string Kind, string? Title, IReadOnlyList<PlexItem> Items, string? SectionId = null);

/// <summary>A movie, show, season or episode, flattened for the UI. Image fields are ready-to-use URLs.</summary>
public sealed class PlexItem
{
    public string Server { get; init; } = "";
    public string ServerName { get; init; } = "";
    public string Key { get; init; } = "";
    /// <summary>Agent id such as plex://movie/5d77...; identical for the same title on every server.</summary>
    public string? Guid { get; init; }
    public string Type { get; init; } = "";
    public string? SectionKey { get; init; }
    public string Title { get; init; } = "";
    public string? Subtitle { get; init; }
    public string? EpisodeTitle { get; init; }
    public string? Summary { get; init; }
    public string? Tagline { get; init; }
    public int? Year { get; init; }
    public string? Poster { get; init; }
    public string? Landscape { get; init; }
    public string? Art { get; init; }
    public long Duration { get; init; }
    public long ViewOffset { get; init; }
    public double Progress { get; init; }
    public bool Watched { get; init; }
    public double? Rating { get; init; }
    public string? ContentRating { get; init; }
    public string? Studio { get; init; }
    public string[] Genres { get; init; } = [];
    public string[] Directors { get; init; } = [];
    public string[] Cast { get; init; } = [];
    public string[] Badges { get; init; } = [];
    public string? ShowKey { get; init; }
    public string? SeasonKey { get; init; }
    public int? Season { get; init; }
    public int? Episode { get; init; }
    public int? LeafCount { get; init; }
    public int? ViewedLeafCount { get; init; }
    public int? ChildCount { get; init; }
    public long AddedAt { get; init; }
    public long LastViewedAt { get; init; }
    /// <summary>For shows: the next episode to watch.</summary>
    public PlexItem? OnDeck { get; set; }
}
