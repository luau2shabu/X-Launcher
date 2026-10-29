using XLauncher.Apps;
using XLauncher.Auth;

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

public sealed class GoogleSignInTests
{
    [Theory]
    [InlineData("authorization_pending", "pending")]
    [InlineData("slow_down", "slow_down")]
    [InlineData("access_denied", "denied")]
    [InlineData("expired_token", "expired")]
    public void Maps_device_flow_errors(string error, string status) =>
        Assert.Equal(status, GoogleSignIn.PollStatus(error));

    [Fact]
    public void Unknown_errors_fail_the_sign_in() =>
        Assert.Throws<InvalidOperationException>(() => GoogleSignIn.PollStatus("invalid_client"));
}
