using System.Text.Json;
using XLauncher.Config;

namespace XLauncher.Tests;

public sealed class ConfigTests : IDisposable
{
    readonly string _dir = Path.Combine(Path.GetTempPath(), "xlauncher-tests-" + Guid.NewGuid().ToString("N"));
    string SettingsPath => Path.Combine(_dir, "settings.json");

    public void Dispose()
    {
        if (Directory.Exists(_dir)) Directory.Delete(_dir, recursive: true);
    }

    [Fact]
    public void New_store_has_one_default_profile_in_thai()
    {
        var store = new SettingsStore(SettingsPath);

        Assert.Equal("th", store.Current.Language);
        Assert.Single(store.Current.Profiles);
        Assert.Equal(Profile.DefaultId, store.Current.ActiveProfile.Id);
    }

    [Fact]
    public void Update_persists_and_reloads()
    {
        var store = new SettingsStore(SettingsPath);
        store.Update(s =>
        {
            s.Language = "en";
            s.ActiveProfile.Favorites.Add("Netflix!App");
        });

        var reloaded = new SettingsStore(SettingsPath);

        Assert.Equal("en", reloaded.Current.Language);
        Assert.Equal(["Netflix!App"], reloaded.Current.ActiveProfile.Favorites);
        Assert.Equal(store.Current.ClientId, reloaded.Current.ClientId);
    }

    [Fact]
    public void Merge_patches_nested_values_and_replaces_arrays()
    {
        var store = new SettingsStore(SettingsPath);
        store.Update(s => s.HiddenApps.AddRange(["a", "b"]));

        using var patch = JsonDocument.Parse("""{ "ambient": { "idleMinutes": 10 }, "hiddenApps": ["c"] }""");
        var merged = store.Merge(patch.RootElement);

        Assert.Equal(10, merged.Ambient.IdleMinutes);
        Assert.True(merged.Ambient.Enabled);
        Assert.Equal(["c"], merged.HiddenApps);
    }

    [Fact]
    public void Merge_cannot_change_client_id_or_custom_apps()
    {
        var store = new SettingsStore(SettingsPath);
        var clientId = store.Current.ClientId;

        using var patch = JsonDocument.Parse("""{ "clientId": "evil", "customApps": [{ "name": "x", "kind": "exe", "target": "C:\\x.exe" }] }""");
        var merged = store.Merge(patch.RootElement);

        Assert.Equal(clientId, merged.ClientId);
        Assert.Empty(merged.CustomApps);
    }

    [Fact]
    public void Normalize_repairs_bad_values()
    {
        var settings = new AppSettings
        {
            Language = "fr",
            ActiveProfileId = "missing",
            Profiles = [],
            Ambient = new AmbientOptions { IdleMinutes = 7, Source = "web" },
        };

        SettingsStore.Normalize(settings);

        Assert.Equal("th", settings.Language);
        Assert.Single(settings.Profiles);
        Assert.Equal(settings.Profiles[0].Id, settings.ActiveProfileId);
        Assert.Equal(5, settings.Ambient.IdleMinutes);
        Assert.Equal("plex", settings.Ambient.Source);
    }

    [Fact]
    public void Corrupt_file_is_kept_aside_and_defaults_are_used()
    {
        Directory.CreateDirectory(_dir);
        File.WriteAllText(SettingsPath, "{ not json");

        var store = new SettingsStore(SettingsPath);

        Assert.Equal("th", store.Current.Language);
        Assert.True(File.Exists(SettingsPath + ".bad"));
    }
}
