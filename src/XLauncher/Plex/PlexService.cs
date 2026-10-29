using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Reflection;
using System.Text.Json;
using XLauncher.Config;
using XLauncher.Infrastructure;
using Microsoft.Win32;

namespace XLauncher.Plex;

/// <summary>
/// Talks to Plex Media Servers: the one on this PC, plus servers shared with the signed-in account (via plex.tv).
/// Builds the composed screens (Home, Movies, Shows) the UI renders as rows.
/// </summary>
public sealed class PlexService : IDisposable
{
    const string PlexTv = "https://plex.tv";
    const string LocalServerKey = @"HKEY_CURRENT_USER\Software\Plex, Inc.\Plex Media Server";
    static readonly TimeSpan ServerTtl = TimeSpan.FromMinutes(20);

    readonly SettingsStore _settings;
    readonly KidsGuard _kids;
    readonly HttpClient _http;
    readonly SemaphoreSlim _serverGate = new(1, 1);
    readonly ConcurrentDictionary<string, (DateTime At, object Value)> _cache = new();
    readonly string _version = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "0.1.0";
    IReadOnlyList<PlexServer> _servers = [];
    DateTime _serversAt = DateTime.MinValue;

    public PlexService(SettingsStore settings, KidsGuard kids)
    {
        _settings = settings;
        _kids = kids;
        _http = new HttpClient(new SocketsHttpHandler
        {
            ConnectTimeout = TimeSpan.FromSeconds(4),
            PooledConnectionLifetime = TimeSpan.FromMinutes(5),
            AutomaticDecompression = System.Net.DecompressionMethods.All,
        })
        {
            Timeout = TimeSpan.FromSeconds(25),
        };
    }

    public void Invalidate() => _cache.Clear();

    // ---------------------------------------------------------------- servers

    public async Task<IReadOnlyList<PlexServer>> ServersAsync(bool refresh = false)
    {
        await _serverGate.WaitAsync();
        try
        {
            if (!refresh && _servers.Count > 0 && DateTime.UtcNow - _serversAt < ServerTtl) return _servers;
            var options = _settings.Current.Plex;
            var found = new List<PlexServer>();
            if (options.Enabled)
            {
                var token = Registry.GetValue(LocalServerKey, "PlexOnlineToken", null) as string;
                var local = await ProbeLocalAsync(options.LocalUrl, token);
                if (local is not null) found.Add(local);
                if (options.UseAccountServers && !string.IsNullOrEmpty(token))
                {
                    try { found.AddRange(await AccountServersAsync(token, local?.Id)); }
                    catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
                    {
                        Log.Warn("Could not list servers from plex.tv", ex);
                    }
                }
            }
            Log.Info($"Plex servers: {(found.Count == 0 ? "none" : string.Join(", ", found))}");
            _servers = found;
            _serversAt = DateTime.UtcNow;
            Invalidate();
            return _servers;
        }
        finally
        {
            _serverGate.Release();
        }
    }

    public async Task<PlexServer?> ServerAsync(string id) =>
        (await ServersAsync()).FirstOrDefault(s => s.Id == id);

    async Task<PlexServer?> ProbeLocalAsync(string url, string? token)
    {
        try
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(4));
            var identity = await GetAsync(url, token, "/identity", cts.Token);
            var id = identity.Str("machineIdentifier");
            if (id is null) return null;
            var root = await GetAsync(url, token, "/", cts.Token);
            return new PlexServer(id, root.Str("friendlyName") ?? Environment.MachineName, url, token ?? "", owned: true, onThisPc: true);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            Log.Warn($"Local Plex server not reachable at {url}", ex);
            return null;
        }
    }

    async Task<List<PlexServer>> AccountServersAsync(string token, string? skipId)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{PlexTv}/api/v2/resources?includeHttps=1&includeRelay=1");
        AddHeaders(request, token);
        using var response = await _http.SendAsync(request);
        response.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        var probes = new List<Task<PlexServer?>>();
        foreach (var resource in doc.RootElement.EnumerateArray())
        {
            if (!(resource.Str("provides") ?? "").Contains("server")) continue;
            var id = resource.Str("clientIdentifier");
            if (id is null || id == skipId) continue;
            var connections = resource.Arr("connections")
                .Select(c => (Uri: c.Str("uri"), Local: c.Bool("local"), Relay: c.Bool("relay")))
                .Where(c => c.Uri is not null)
                .OrderBy(c => c.Relay)
                .ThenByDescending(c => c.Local)
                .Select(c => c.Uri!)
                .ToList();
            probes.Add(PickConnectionAsync(id, resource.Str("name") ?? "Plex", resource.Str("accessToken") ?? token, resource.Bool("owned"), connections));
        }
        return (await Task.WhenAll(probes)).OfType<PlexServer>().ToList();
    }

    // Tries every advertised address at once and keeps the best one that answers as the right server
    async Task<PlexServer?> PickConnectionAsync(string id, string name, string token, bool owned, List<string> uris)
    {
        var answers = await Task.WhenAll(uris.Select(async uri =>
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(4));
                return (await GetAsync(uri, token, "/identity", cts.Token)).Str("machineIdentifier");
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
            {
                return null;
            }
        }));
        for (var i = 0; i < uris.Count; i++)
            if (answers[i] == id) return new PlexServer(id, name, uris[i], token, owned, onThisPc: false);
        Log.Info($"Plex server {name} is offline");
        return null;
    }

    // ---------------------------------------------------------------- composed screens

    public Task<object> HomeAsync(bool refresh) =>
        Cached("home", refresh, TimeSpan.FromSeconds(45), BuildHomeAsync);

    public Task<object> TabAsync(string type, bool refresh) =>
        type is "movie" or "show"
            ? Cached("tab:" + type, refresh, TimeSpan.FromMinutes(3), () => BuildTabAsync(type))
            : throw new ArgumentException($"Unknown tab type '{type}'");

    // Servers can have dozens of libraries, so Home uses one "recently added" call per server
    // and samples Top picks from a handful of libraries instead of querying every one.
    async Task<object> BuildHomeAsync()
    {
        var servers = await ServersAsync();
        if (servers.Count == 0) return Disconnected();

        var sections = (await SectionsAsync()).Where(s => !s.Hidden).ToList();
        var onDeck = OnDeckAsync(20);
        var recent = RecentlyAddedAsync(sections, 80);
        var picks = PicksAsync(sections, 20);
        await Task.WhenAll(onDeck, recent, picks);

        var movies = recent.Result.Where(i => i.Type == "movie").Take(20).ToList();
        var shows = OnePerShow(recent.Result.Where(i => i.Type != "movie")).Take(20).ToList();
        var rows = new List<PlexRow>();
        if (onDeck.Result.Count > 0) rows.Add(new PlexRow("continue", null, onDeck.Result));
        if (picks.Result.Count > 0) rows.Add(new PlexRow("picks", null, picks.Result));
        if (movies.Count > 0) rows.Add(new PlexRow("recentMovies", null, movies));
        if (shows.Count > 0) rows.Add(new PlexRow("recentShows", null, shows));

        return new { connected = true, servers = servers.Select(s => s.ToInfo()), hero = Hero(Interleave([movies, shows])), rows };
    }

    async Task<object> BuildTabAsync(string type)
    {
        var servers = await ServersAsync();
        if (servers.Count == 0) return Disconnected();

        var sections = (await SectionsAsync()).Where(s => !s.Hidden && s.Type == type).ToList();
        var picks = PicksAsync(sections, 20);
        var recent = RecentlyAddedAsync(sections, 60);
        var perSection = sections.Take(MaxSectionRows).Select(s => SafeAsync(() => RecentAsync(s, 20))).ToList();
        var genreSource = DailyShuffle.Apply(sections, "genres").FirstOrDefault();
        var genreRows = genreSource is null ? Task.FromResult(new List<PlexRow>()) : GenreRowsAsync(genreSource, 6);
        await Task.WhenAll(perSection.Cast<Task>().Append(picks).Append(recent).Append(genreRows));

        var rows = new List<PlexRow>();
        if (picks.Result.Count > 0) rows.Add(new PlexRow("picks", null, picks.Result));
        var recentOfType = (type == "movie"
            ? recent.Result.Where(i => i.Type == "movie")
            : OnePerShow(recent.Result.Where(i => i.Type != "movie"))).Take(20).ToList();
        if (recentOfType.Count > 0) rows.Add(new PlexRow(type == "movie" ? "recentMovies" : "recentShows", null, recentOfType));
        rows.AddRange(genreRows.Result);
        for (var i = 0; i < perSection.Count; i++)
            if (perSection[i].Result.Count > 0)
                rows.Add(new PlexRow("recent", Label(sections[i], servers.Count > 1), perSection[i].Result, sections[i].Id));

        return new { connected = true, hero = Hero(Interleave([picks.Result, recentOfType])), rows, sections };
    }

    const int MaxPickSections = 6;
    const int MaxSectionRows = 6;

    static List<PlexItem> Hero(IEnumerable<PlexItem> candidates) =>
        candidates.Where(i => i.Art is not null && !string.IsNullOrWhiteSpace(i.Summary)).DistinctBy(DedupKey).Take(6).ToList();

    /// <summary>
    /// The same title often sits in several libraries (4K and 1080p copies) or on several servers,
    /// sometimes under a translated name. Agent GUIDs match across all of them; titles are the fallback.
    /// </summary>
    public static string DedupKey(PlexItem i) =>
        i.Guid is { } guid && guid.StartsWith("plex://", StringComparison.Ordinal)
            ? guid
            : $"{i.Type}|{i.Title.Trim().ToLowerInvariant()}|{i.Year}|{i.Season}|{i.Episode}";

    // A batch of new episodes should show up once, as the show
    static IEnumerable<PlexItem> OnePerShow(IEnumerable<PlexItem> items) =>
        items.DistinctBy(i => i.Title.Trim().ToLowerInvariant());

    async Task<List<PlexRow>> GenreRowsAsync(PlexSection section, int count)
    {
        var server = await ServerAsync(section.Server);
        if (server is null) return [];
        try
        {
            var genres = (await GetAsync(server, $"/library/sections/{section.Key}/genre")).Arr("Directory")
                .Select(d => (Title: d.Str("title"), Key: d.Str("fastKey") ?? $"/library/sections/{section.Key}/all?genre={d.Str("key")}"))
                .Where(g => g.Title is not null)
                .ToList();
            var chosen = DailyShuffle.Apply(genres, section.Id).Take(count).ToList();
            var lists = await Task.WhenAll(chosen.Select(g => SafeAsync(() => ListAsync(server, AppendQuery(g.Key, "X-Plex-Container-Start=0&X-Plex-Container-Size=20")))));
            return chosen.Zip(lists)
                .Where(p => p.Second.Count >= 4)
                .Select(p => new PlexRow("genre", p.First.Title, p.Second, section.Id))
                .ToList();
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            Log.Warn($"Genres unavailable for {section.Title}", ex);
            return [];
        }
    }

    static object Disconnected() =>
        new { connected = false, hero = Array.Empty<PlexItem>(), rows = Array.Empty<PlexRow>(), sections = Array.Empty<PlexSection>() };

    static string Label(PlexSection section, bool multiServer) =>
        multiServer ? $"{section.Title} · {section.ServerName}" : section.Title;

    // ---------------------------------------------------------------- content

    public async Task<List<PlexSection>> SectionsAsync() =>
        (List<PlexSection>)await Cached("sections", false, TimeSpan.FromMinutes(5), async () =>
        {
            var hidden = _settings.Current.Plex.HiddenSections;
            var perServer = await Task.WhenAll((await ServersAsync()).Select(async server =>
            {
                try
                {
                    return (await GetAsync(server, "/library/sections")).Arr("Directory")
                        .Where(d => d.Str("type") is "movie" or "show")
                        .Select(d =>
                        {
                            var id = $"{server.Id}/{d.Str("key")}";
                            return new PlexSection(id, server.Id, server.Name, d.Str("key") ?? "", d.Str("title") ?? "", d.Str("type")!,
                                PlexMapper.ImageUrl(server.Id, d.Str("art") ?? d.Str("composite"), PlexMapper.LandscapeW, PlexMapper.LandscapeH),
                                hidden.Contains(id) || !_kids.CanSeeSection(id));
                        })
                        .ToList();
                }
                catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
                {
                    Log.Warn($"Libraries unavailable on {server.Name}", ex);
                    return [];
                }
            }));
            return (object)perServer.SelectMany(s => s).ToList();
        });

    public async Task<List<PlexItem>> OnDeckAsync(int size)
    {
        var hidden = _settings.Current.Plex.HiddenSections;
        var lists = await Task.WhenAll((await ServersAsync()).Select(server =>
            SafeAsync(() => ListAsync(server, $"/library/onDeck?X-Plex-Container-Start=0&X-Plex-Container-Size={size}"))));
        return lists.SelectMany(l => l)
            .Where(i => i.SectionKey is null || !hidden.Contains($"{i.Server}/{i.SectionKey}"))
            .OrderByDescending(i => i.LastViewedAt)
            .DistinctBy(DedupKey)
            .Take(size)
            .ToList();
    }

    async Task<List<PlexItem>> RecentAsync(PlexSection section, int size)
    {
        var server = await ServerAsync(section.Server);
        return server is null ? [] : await ListAsync(server,
            $"/library/sections/{section.Key}/all?sort=addedAt:desc&X-Plex-Container-Start=0&X-Plex-Container-Size={size}");
    }

    /// <summary>Newest additions across the given libraries: one request per server, newest first, duplicates removed.</summary>
    async Task<List<PlexItem>> RecentlyAddedAsync(IReadOnlyList<PlexSection> sections, int perServer)
    {
        var wanted = sections.Select(s => s.Id).ToHashSet();
        var lists = await Task.WhenAll((await ServersAsync())
            .Where(server => sections.Any(s => s.Server == server.Id))
            .Select(server => SafeAsync(() => ListAsync(server, $"/library/recentlyAdded?X-Plex-Container-Start=0&X-Plex-Container-Size={perServer}"))));
        return lists.SelectMany(l => l)
            .Where(i => i.SectionKey is null || wanted.Contains($"{i.Server}/{i.SectionKey}"))
            .OrderByDescending(i => i.AddedAt)
            .DistinctBy(DedupKey)
            .ToList();
    }

    /// <summary>
    /// "Top picks": unwatched titles from up to <see cref="MaxPickSections"/> libraries, chosen and ordered once a day.
    /// Each library is sampled at a daily random offset, so even huge libraries cost two small requests.
    /// </summary>
    async Task<List<PlexItem>> PicksAsync(IReadOnlyList<PlexSection> sections, int size)
    {
        var chosen = DailyShuffle.Apply(sections, "picks").Take(MaxPickSections).ToList();
        if (chosen.Count == 0) return [];
        var perSection = Math.Max(4, (int)Math.Ceiling(size * 1.5 / chosen.Count));
        var lists = await Task.WhenAll(chosen.Select(s => SafeAsync(() => SampleUnwatchedAsync(s, perSection))));
        return Interleave(lists).DistinctBy(DedupKey).Take(size).ToList();
    }

    async Task<List<PlexItem>> SampleUnwatchedAsync(PlexSection section, int size)
    {
        var server = await ServerAsync(section.Server);
        if (server is null) return [];
        var path = $"/library/sections/{section.Key}/all?unwatched=1";
        var total = (await GetAsync(server, path + "&X-Plex-Container-Start=0&X-Plex-Container-Size=0")).Int("totalSize");
        if (total == 0) return [];
        var start = total <= size ? 0 : new Random(DailyShuffle.Seed(section.Id)).Next(total - size);
        var items = await ListAsync(server, $"{path}&X-Plex-Container-Start={start}&X-Plex-Container-Size={size}");
        return DailyShuffle.Apply(items, section.Id);
    }

    public async Task<object> AllAsync(string serverId, string sectionKey, int start, int size, string sort, bool unwatched)
    {
        if (!_kids.CanSeeSection($"{serverId}/{sectionKey}")) throw new UnauthorizedAccessException("This library is not allowed for this profile");
        var server = await RequireServerAsync(serverId);
        var allowedSort = sort is "titleSort" or "addedAt:desc" or "year:desc" or "audienceRating:desc" or "lastViewedAt:desc" ? sort : "titleSort";
        var query = $"/library/sections/{sectionKey}/all?sort={allowedSort}&X-Plex-Container-Start={Math.Max(0, start)}&X-Plex-Container-Size={Math.Clamp(size, 1, 200)}";
        if (unwatched) query += "&unwatched=1";
        var container = await GetAsync(server, query);
        var items = Visible(PlexMapper.Items(container, server.Id, server.Name));
        return new { items, total = container.Int("totalSize", start + items.Count) };
    }

    public async Task<PlexItem?> ItemAsync(string serverId, string key)
    {
        var server = await RequireServerAsync(serverId);
        var container = await GetAsync(server, $"/library/metadata/{Uri.EscapeDataString(key)}?includeOnDeck=1");
        return Visible(PlexMapper.Items(container, server.Id, server.Name)).FirstOrDefault()
            ?? throw new UnauthorizedAccessException("This title is not allowed for this profile");
    }

    public async Task<List<PlexItem>> ChildrenAsync(string serverId, string key)
    {
        var server = await RequireServerAsync(serverId);
        return await ListAsync(server, $"/library/metadata/{Uri.EscapeDataString(key)}/children");
    }

    public async Task<List<PlexItem>> RelatedAsync(string serverId, string key)
    {
        var server = await RequireServerAsync(serverId);
        return await SafeAsync(() => ListAsync(server, $"/library/metadata/{Uri.EscapeDataString(key)}/similar?count=20"));
    }

    public async Task<object> SearchAsync(string query)
    {
        if (string.IsNullOrWhiteSpace(query)) return new { movies = Array.Empty<PlexItem>(), shows = Array.Empty<PlexItem>(), episodes = Array.Empty<PlexItem>() };
        var hubs = await Task.WhenAll((await ServersAsync()).Select(async server =>
        {
            try
            {
                var container = await GetAsync(server, $"/hubs/search?query={Uri.EscapeDataString(query.Trim())}&limit=12&includeCollections=0");
                return Visible(container.Arr("Hub").SelectMany(h => PlexMapper.Items(h, server.Id, server.Name)).ToList());
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
            {
                Log.Warn($"Search failed on {server.Name}", ex);
                return [];
            }
        }));
        var all = hubs.SelectMany(h => h).ToList();
        return new
        {
            movies = all.Where(i => i.Type == "movie").ToList(),
            shows = all.Where(i => i.Type == "show").ToList(),
            episodes = all.Where(i => i.Type == "episode").Take(20).ToList(),
        };
    }

    public async Task SetWatchedAsync(string serverId, string key, bool watched)
    {
        var server = await RequireServerAsync(serverId);
        var action = watched ? "scrobble" : "unscrobble";
        using var response = await SendAsync(HttpMethod.Get, server,
            $"/:/{action}?key={Uri.EscapeDataString(key)}&identifier=com.plexapp.plugins.library");
        response.EnsureSuccessStatusCode();
        Invalidate();
    }

    // ---------------------------------------------------------------- HTTP

    public async Task<JsonElement> GetAsync(PlexServer server, string path, CancellationToken ct = default) =>
        await GetAsync(server.BaseUrl, server.Token, path, ct);

    public async Task<byte[]> GetBytesAsync(PlexServer server, string path, CancellationToken ct = default)
    {
        using var response = await SendAsync(HttpMethod.Get, server, path, ct: ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsByteArrayAsync(ct);
    }

    /// <summary>Sends a request with Plex headers. The caller owns (and must dispose) the response.</summary>
    public async Task<HttpResponseMessage> SendAsync(HttpMethod method, PlexServer server, string path,
        IReadOnlyDictionary<string, string>? headers = null, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(method, server.BaseUrl + path);
        AddHeaders(request, server.Token);
        if (headers is not null)
            foreach (var (name, value) in headers) request.Headers.TryAddWithoutValidation(name, value);
        return await _http.SendAsync(request, ct);
    }

    async Task<JsonElement> GetAsync(string baseUrl, string? token, string path, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, baseUrl.TrimEnd('/') + path);
        AddHeaders(request, token);
        using var response = await _http.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        return doc.RootElement.TryGetProperty("MediaContainer", out var container) ? container.Clone() : doc.RootElement.Clone();
    }

    async Task<List<PlexItem>> ListAsync(PlexServer server, string path) =>
        Visible(PlexMapper.Items(await GetAsync(server, path), server.Id, server.Name));

    /// <summary>Drops titles a kids profile may not see (library not allowed or rating too high).</summary>
    List<PlexItem> Visible(List<PlexItem> items) =>
        _kids.ActiveRules is null ? items : items.Where(i => _kids.CanSee(i.Server, i.SectionKey, i.ContentRating, i.Type)).ToList();

    async Task<PlexServer> RequireServerAsync(string id) =>
        await ServerAsync(id) ?? throw new InvalidOperationException("That Plex server is not reachable right now");

    void AddHeaders(HttpRequestMessage request, string? token)
    {
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        if (!string.IsNullOrEmpty(token)) request.Headers.TryAddWithoutValidation("X-Plex-Token", token);
        request.Headers.TryAddWithoutValidation("X-Plex-Client-Identifier", _settings.Current.ClientId);
        request.Headers.TryAddWithoutValidation("X-Plex-Product", "X Launcher");
        request.Headers.TryAddWithoutValidation("X-Plex-Version", _version);
        request.Headers.TryAddWithoutValidation("X-Plex-Platform", "Windows");
        request.Headers.TryAddWithoutValidation("X-Plex-Device-Name", Environment.MachineName);
    }

    // ---------------------------------------------------------------- helpers

    async Task<object> Cached(string key, bool refresh, TimeSpan ttl, Func<Task<object>> build)
    {
        if (!refresh && _cache.TryGetValue(key, out var hit) && DateTime.UtcNow - hit.At < ttl) return hit.Value;
        var value = await build();
        _cache[key] = (DateTime.UtcNow, value);
        return value;
    }

    static async Task<List<PlexItem>> SafeAsync(Func<Task<List<PlexItem>>> load)
    {
        try { return await load(); }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            Log.Warn("Plex request failed", ex);
            return [];
        }
    }

    /// <summary>Round-robin merge so one big library does not crowd out the others.</summary>
    public static IEnumerable<T> Interleave<T>(IEnumerable<IReadOnlyList<T>> lists)
    {
        var all = lists.ToList();
        var longest = all.Count == 0 ? 0 : all.Max(l => l.Count);
        for (var i = 0; i < longest; i++)
            foreach (var list in all)
                if (i < list.Count) yield return list[i];
    }

    static string AppendQuery(string path, string query) => path + (path.Contains('?') ? "&" : "?") + query;

    public void Dispose() => _http.Dispose();
}

/// <summary>Deterministic shuffle that changes once per day, so "Top picks" feel fresh without jumping around.</summary>
public static class DailyShuffle
{
    public static int Seed(string salt, DateOnly? day = null) =>
        StableHash($"{day ?? DateOnly.FromDateTime(DateTime.Now):yyyyMMdd}|{salt}");

    public static List<T> Apply<T>(IEnumerable<T> items, string salt, DateOnly? day = null)
    {
        var random = new Random(Seed(salt, day));
        var list = items.ToList();
        for (var i = list.Count - 1; i > 0; i--)
        {
            var j = random.Next(i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }
        return list;
    }

    static int StableHash(string text)
    {
        unchecked
        {
            var hash = (int)2166136261;
            foreach (var c in text) hash = (hash ^ c) * 16777619;
            return hash;
        }
    }
}
