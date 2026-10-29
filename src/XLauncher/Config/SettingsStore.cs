using System.Text.Json;
using System.Text.Json.Nodes;
using XLauncher.Infrastructure;

namespace XLauncher.Config;

/// <summary>Loads and saves <see cref="AppSettings"/>; all mutation goes through <see cref="Update"/> or <see cref="Merge"/>.</summary>
public sealed class SettingsStore
{
    static readonly int[] AllowedIdleMinutes = [1, 3, 5, 10, 15, 30, 60];

    readonly string _path;
    readonly object _gate = new();

    public SettingsStore(string path)
    {
        _path = path;
        Current = Load();
    }

    public AppSettings Current { get; private set; }

    public AppSettings Update(Action<AppSettings> mutate)
    {
        lock (_gate)
        {
            mutate(Current);
            Normalize(Current);
            Save();
            return Current;
        }
    }

    /// <summary>Applies a partial settings object sent by the UI. Identity fields cannot be changed this way.</summary>
    public AppSettings Merge(JsonElement patch)
    {
        lock (_gate)
        {
            var node = JsonSerializer.SerializeToNode(Current, Json.Options)!.AsObject();
            var patchNode = JsonNode.Parse(patch.GetRawText()) as JsonObject ?? [];
            patchNode.Remove("clientId");
            patchNode.Remove("version");
            patchNode.Remove("customApps");
            patchNode.Remove("iconOverrides");
            Json.Merge(node, patchNode);
            var merged = node.Deserialize<AppSettings>(Json.Options) ?? new AppSettings();
            merged.ClientId = Current.ClientId;
            Normalize(merged);
            Current = merged;
            Save();
            return Current;
        }
    }

    public static void Normalize(AppSettings s)
    {
        if (s.Language is not ("th" or "en")) s.Language = "th";
        s.Profiles = s.Profiles.Where(p => !string.IsNullOrWhiteSpace(p.Id)).GroupBy(p => p.Id).Select(g => g.First()).ToList();
        if (s.Profiles.Count == 0) s.Profiles.Add(Profile.CreateDefault());
        foreach (var p in s.Profiles)
        {
            if (string.IsNullOrWhiteSpace(p.Name)) p.Name = p.Id == Profile.DefaultId ? "Home" : "Profile";
            p.Favorites = p.Favorites.Where(f => !string.IsNullOrWhiteSpace(f)).Distinct().ToList();
        }
        if (s.Profiles.All(p => p.Id != s.ActiveProfileId)) s.ActiveProfileId = s.Profiles[0].Id;
        s.HiddenApps = s.HiddenApps.Distinct().ToList();
        if (!AllowedIdleMinutes.Contains(s.Ambient.IdleMinutes)) s.Ambient.IdleMinutes = 5;
        if (s.Ambient.Source is not ("plex" or "folder")) s.Ambient.Source = "plex";
        if (string.IsNullOrWhiteSpace(s.Plex.LocalUrl)) s.Plex.LocalUrl = "http://127.0.0.1:32400";
        s.Plex.LocalUrl = s.Plex.LocalUrl.TrimEnd('/');
        if (s.Input.HomeKeys.Count == 0) s.Input.HomeKeys.Add(0xAC);
    }

    AppSettings Load()
    {
        try
        {
            if (File.Exists(_path))
            {
                var loaded = JsonSerializer.Deserialize<AppSettings>(File.ReadAllText(_path), Json.Options);
                if (loaded is not null)
                {
                    Normalize(loaded);
                    return loaded;
                }
            }
        }
        catch (Exception ex) when (ex is JsonException or IOException)
        {
            Log.Warn($"Settings file unreadable, keeping a copy at {_path}.bad and starting fresh", ex);
            try { File.Copy(_path, _path + ".bad", overwrite: true); } catch (IOException) { }
        }
        var fresh = new AppSettings();
        Normalize(fresh);
        return fresh;
    }

    void Save()
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
            var tmp = _path + ".tmp";
            File.WriteAllText(tmp, JsonSerializer.Serialize(Current, Json.Pretty));
            File.Move(tmp, _path, overwrite: true);
        }
        catch (IOException ex)
        {
            Log.Error("Could not save settings", ex);
        }
    }
}
