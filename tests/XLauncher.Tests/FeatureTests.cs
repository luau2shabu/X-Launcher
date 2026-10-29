using XLauncher.Apps;
using XLauncher.Config;

namespace XLauncher.Tests;

public sealed class IconSearchTests
{
    static readonly Uri Page = new("https://www.example.com/watch");

    [Fact]
    public void Finds_touch_and_sized_icons_and_resolves_relative_urls()
    {
        const string html = """
            <head>
              <link rel="icon" href="/favicon.ico">
              <link rel="apple-touch-icon" href="/img/touch.png">
              <link rel='icon' type='image/png' sizes='192x192 512x512' href='https://cdn.example.com/icon-512.png'>
              <link rel="stylesheet" href="/site.css">
              <link rel="manifest" href="/app.webmanifest">
            </head>
            """;

        var icons = IconSearch.ParseIconLinks(html, Page).ToList();

        Assert.Equal(3, icons.Count);
        Assert.Contains(icons, i => i.Url == "https://www.example.com/favicon.ico" && i.Size == 32);
        Assert.Contains(icons, i => i.Url == "https://www.example.com/img/touch.png" && i.Size == 180);
        Assert.Contains(icons, i => i.Url == "https://cdn.example.com/icon-512.png" && i.Size == 512);
        Assert.Equal("https://www.example.com/app.webmanifest", IconSearch.ManifestUrl(html, Page)?.ToString());
    }

    [Fact]
    public void Reads_manifest_icons()
    {
        const string json = """{ "short_name": "Example", "icons": [ { "src": "icons/192.png", "sizes": "192x192" }, { "src": "/icons/512.png", "sizes": "512x512" } ] }""";

        var icons = IconSearch.ParseManifest(json, new Uri("https://www.example.com/static/app.webmanifest")).ToList();

        Assert.Equal(["https://www.example.com/static/icons/192.png", "https://www.example.com/icons/512.png"], icons.Select(i => i.Url));
        Assert.Equal([192, 512], icons.Select(i => i.Size));
        Assert.All(icons, i => Assert.Equal("Example", i.Label));
    }

    [Fact]
    public void Store_results_ask_for_512px_artwork()
    {
        const string json = """
            { "results": [
              { "trackName": "Netflix", "artworkUrl512": "https://is1-ssl.mzstatic.com/image/thumb/abc/AppIcon.png/512x512bb.jpg" },
              { "trackName": "Old", "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/def/100x100bb.png" },
              { "trackName": "No art" }
            ] }
            """;

        var icons = IconSearch.ParseStoreResults(json).ToList();

        Assert.Equal(2, icons.Count);
        Assert.EndsWith("/512x512bb.png", icons[0].Url);
        Assert.Equal("https://is1-ssl.mzstatic.com/image/thumb/def/512x512bb.png", icons[1].Url);
        Assert.Equal("Netflix", icons[0].Label);
    }
}

public sealed class KidsTests : IDisposable
{
    readonly string _dir = Path.Combine(Path.GetTempPath(), "xlauncher-kids-" + Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        if (Directory.Exists(_dir)) Directory.Delete(_dir, recursive: true);
    }

    [Theory]
    [InlineData("G", 0)]
    [InlineData("us/PG-13", 13)]
    [InlineData("TV-MA", 17)]
    [InlineData("th/15", 15)]
    [InlineData("13+", 13)]
    [InlineData("", null)]
    [InlineData("Not Rated", null)]
    public void Ratings_map_to_ages(string rating, int? age) =>
        Assert.Equal(age, ContentRatings.AgeOf(rating));

    [Theory]
    [InlineData("child", "PG", "movie", true)]
    [InlineData("child", "PG-13", "movie", false)]
    [InlineData("teen", "TV-14", "show", true)]
    [InlineData("young", "TV-Y7", "show", true)]
    [InlineData("young", "PG", "movie", false)]
    [InlineData("child", null, "movie", false)]
    [InlineData("child", null, "episode", true)]
    [InlineData("all", "R", "movie", true)]
    public void Rating_ceiling_allows_or_blocks(string level, string? rating, string type, bool allowed) =>
        Assert.Equal(allowed, ContentRatings.Allows(level, rating, type));

    [Fact]
    public void Pin_is_hashed_and_verified()
    {
        var store = new PinStore(Path.Combine(_dir, "pin.json"));
        Assert.True(store.Verify("anything")); // no PIN yet: nothing to protect

        store.Set("2468");

        Assert.True(store.Verify("2468"));
        Assert.False(store.Verify("1357"));
        Assert.DoesNotContain("2468", File.ReadAllText(Path.Combine(_dir, "pin.json")));
        Assert.Throws<ArgumentException>(() => store.Set("12a4"));
    }

    [Fact]
    public void Kids_profile_is_limited_to_its_apps_libraries_and_time()
    {
        var settings = new SettingsStore(Path.Combine(_dir, "settings.json"));
        settings.Update(s =>
        {
            s.Profiles.Add(new Profile
            {
                Id = "kid", Name = "Kids", Kind = Profile.Kids,
                Rules = new KidsRules { AllowedApps = ["netflix"], AllowedSections = ["srv/2"], MaxRating = "child", DailyMinutes = 2 },
            });
            s.ActiveProfileId = "kid";
        });
        var guard = new KidsGuard(settings);

        Assert.True(guard.CanLaunch("netflix"));
        Assert.False(guard.CanLaunch("steam"));
        Assert.True(guard.CanSee("srv", "2", "PG", "movie"));
        Assert.False(guard.CanSee("srv", "1", "G", "movie"));
        Assert.False(guard.CanSee("srv", "2", "R", "movie"));

        Assert.False(guard.CountMinute());
        Assert.True(guard.CountMinute());
        Assert.True(guard.TimeUp);

        guard.AddTime("kid", 30);
        Assert.False(guard.TimeUp);
    }

    [Fact]
    public void Old_settings_get_one_admin_profile()
    {
        var s = new AppSettings
        {
            Profiles = [new Profile { Id = "default", Name = "Home" }, new Profile { Id = "b", Name = "Mom", Kind = Profile.Admin }, new Profile { Id = "k", Kind = Profile.Kids }],
        };

        SettingsStore.Normalize(s);

        Assert.Single(s.Profiles, p => p.Kind == Profile.Admin);
        Assert.Equal(Profile.Admin, s.Profiles.First(p => p.Id == "b").Kind);
        Assert.NotNull(s.Profiles.First(p => p.Id == "k").Rules);
    }
}
