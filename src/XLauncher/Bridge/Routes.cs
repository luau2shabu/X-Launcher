using System.Diagnostics;
using XLauncher.Apps;
using XLauncher.Config;
using XLauncher.Infrastructure;
using XLauncher.SystemOps;
using XLauncher.Web;

namespace XLauncher.Bridge;

/// <summary>Window operations the bridge needs from the host form (dialogs must run on the UI thread).</summary>
public interface IHostWindow
{
    string? PickProgram();
    string? PickFolder();
    void Quit();
    void OnUiReady();
    /// <summary>Lets the user pick a picture (or .exe/.ico) for an app icon.</summary>
    string? PickImage();
    /// <summary>Called right before an app is started (watches for its window to make it full screen).</summary>
    void BeforeLaunch(AppEntry app);
}

/// <summary>Every method the web UI can call. Keep app/ui/js/mock.js in step with this list.</summary>
public static class Routes
{
    public static void Register(BridgeHost bridge, Services svc, IHostWindow window)
    {
        var settings = svc.Settings;

        // ---- settings
        bridge.On("settings.get", _ => settings.Current);
        bridge.On("settings.update", p =>
        {
            // A kids profile cannot change settings (or switch profile) without the parent PIN
            if (svc.Kids.ActiveRules is not null && !svc.Pin.Verify(p.Opt("_pin") ?? ""))
                throw new UnauthorizedAccessException("Parent PIN required");
            var updated = settings.Merge(p);
            svc.Plex.Invalidate();
            return updated;
        });

        // ---- apps
        bridge.On("apps.list", async p => (object?)await svc.Apps.ListAsync(p.Flag("refresh")));
        bridge.On("apps.launch", async p =>
        {
            var app = await svc.Apps.FindAsync(p.Req("id")) ?? throw new InvalidOperationException("App not found");
            if (!svc.Kids.CanLaunch(app.Id)) throw new UnauthorizedAccessException("This app is not allowed for this profile");
            if (svc.Kids.TimeUp) throw new UnauthorizedAccessException("Screen time is up for today");
            window.BeforeLaunch(app);
            AppLauncher.Launch(app);
            return (object?)true;
        });
        bridge.On("apps.rename", p =>
        {
            var id = p.Req("id");
            var name = p.Opt("name")?.Trim();
            return settings.Update(s =>
            {
                if (string.IsNullOrEmpty(name)) s.NameOverrides.Remove(id);
                else s.NameOverrides[id] = name;
            });
        });

        // ---- app icons: from the internet or from a file on this PC
        bridge.On("icons.search", async p => (object?)await svc.Icons.SearchAsync(p.Req("name"), p.Opt("website")));
        bridge.On("icons.use", async p => (object?)await svc.Icons.UseAsync(p.Req("id"), p.Req("url")));
        bridge.On("icons.fromFile", async p =>
        {
            var path = window.PickImage();
            return path is null ? null : (object?)await svc.Icons.UseFileAsync(p.Req("id"), path);
        });
        bridge.On("icons.reset", p =>
        {
            svc.Icons.Reset(p.Req("id"));
            return true;
        });

        // ---- parent PIN and kids mode
        bridge.On("pin.status", _ => new { set = svc.Pin.IsSet });
        bridge.On("pin.verify", p => svc.Pin.Verify(p.Req("pin")));
        bridge.On("pin.set", p =>
        {
            if (svc.Pin.IsSet && !svc.Pin.Verify(p.Opt("current") ?? "")) throw new UnauthorizedAccessException("The current PIN is wrong");
            svc.Pin.Set(p.Req("pin"));
            return true;
        });
        bridge.On("kids.status", _ => svc.Kids.Status());
        bridge.On("kids.addTime", p =>
        {
            if (!svc.Pin.Verify(p.Opt("pin") ?? "")) throw new UnauthorizedAccessException("Parent PIN required");
            return svc.Kids.AddTime(p.Req("profile"), p.Num("minutes", 30));
        });
        bridge.On("apps.addWebsite", p =>
        {
            var url = NormalizeUrl(p.Req("url"));
            var app = new CustomApp
            {
                Kind = "url",
                Name = p.Opt("name") is { Length: > 0 } name ? name.Trim() : new Uri(url).Host.Replace("www.", ""),
                Target = url,
                TvMode = p.Flag("tvMode"),
            };
            AddCustom(settings, app);
            return svc.Apps.ToEntry(app);
        });
        bridge.On("apps.addProgram", _ =>
        {
            var path = window.PickProgram();
            if (path is null) return null;
            var description = FileVersionInfo.GetVersionInfo(path).FileDescription;
            var app = new CustomApp
            {
                Kind = "exe",
                Name = string.IsNullOrWhiteSpace(description) ? Path.GetFileNameWithoutExtension(path) : description.Trim(),
                Target = path,
            };
            AddCustom(settings, app);
            return svc.Apps.ToEntry(app);
        });
        bridge.On("apps.removeCustom", p =>
        {
            var id = p.Req("id");
            settings.Update(s =>
            {
                s.CustomApps.RemoveAll(a => a.Id == id);
                foreach (var profile in s.Profiles) profile.Favorites.Remove(id);
            });
            return true;
        });

        // ---- plex
        bridge.On("plex.servers", async p => (object?)(await svc.Plex.ServersAsync(p.Flag("refresh"))).Select(s => s.ToInfo()).ToList());
        bridge.On("plex.sections", async _ => (object?)await svc.Plex.SectionsAsync());
        bridge.On("plex.home", async p => (object?)await svc.Plex.HomeAsync(p.Flag("refresh")));
        bridge.On("plex.tab", async p => (object?)await svc.Plex.TabAsync(p.Req("type"), p.Flag("refresh")));
        bridge.On("plex.onDeck", async p => (object?)await svc.Plex.OnDeckAsync(p.Num("size", 20)));
        bridge.On("plex.all", async p => (object?)await svc.Plex.AllAsync(
            p.Req("server"), p.Req("section"), p.Num("start", 0), p.Num("size", 60), p.Opt("sort") ?? "titleSort", p.Flag("unwatched")));
        bridge.On("plex.item", async p => (object?)await svc.Plex.ItemAsync(p.Req("server"), p.Req("key")));
        bridge.On("plex.children", async p => (object?)await svc.Plex.ChildrenAsync(p.Req("server"), p.Req("key")));
        bridge.On("plex.related", async p => (object?)await svc.Plex.RelatedAsync(p.Req("server"), p.Req("key")));
        bridge.On("plex.search", async p => (object?)await svc.Plex.SearchAsync(p.Opt("query") ?? ""));
        bridge.On("plex.watched", async p =>
        {
            await svc.Plex.SetWatchedAsync(p.Req("server"), p.Req("key"), p.Flag("watched"));
            return (object?)true;
        });
        bridge.On("plex.play", async p =>
        {
            if (svc.Kids.TimeUp) throw new UnauthorizedAccessException("Screen time is up for today");
            await svc.Plex.ItemAsync(p.Req("server"), p.Req("key")); // throws when a kids profile may not see it
            return (object?)await svc.Playback.PlayAsync(p.Req("server"), p.Req("key"), p.Num("offset", 0));
        });

        // ---- ambient mode
        bridge.On("ambient.photos", _ => ImageRouter.ListPhotos(settings.Current.Ambient.Folder));

        // ---- system
        bridge.On("system.info", _ => SystemInfo.Get());
        bridge.On("system.power", p =>
        {
            Power.Run(p.Req("action"), window.Quit);
            return true;
        });
        bridge.On("system.openSettings", p =>
        {
            WindowsSettings.Open(p.Req("page"));
            return true;
        });
        bridge.On("system.pickFolder", _ => window.PickFolder());

        // ---- UI lifecycle and diagnostics (UI errors end up in xlauncher.log)
        bridge.On("ui.ready", p =>
        {
            Log.Info($"UI ready: {p.Opt("summary")}");
            window.OnUiReady();
            return true;
        });
        bridge.On("ui.log", p =>
        {
            var message = $"[ui] {p.Opt("message")}";
            if (p.Opt("level") == "error") Log.Error(message);
            else Log.Info(message);
            return true;
        });
    }

    static void AddCustom(SettingsStore settings, CustomApp app) =>
        settings.Update(s =>
        {
            s.CustomApps.Add(app);
            s.ActiveProfile.Favorites.Add(app.Id);
        });

    public static string NormalizeUrl(string input)
    {
        var url = input.Trim();
        if (!url.Contains("://")) url = "https://" + url;
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https") || !uri.Host.Contains('.'))
            throw new ArgumentException("That doesn't look like a web address");
        return uri.ToString();
    }
}
