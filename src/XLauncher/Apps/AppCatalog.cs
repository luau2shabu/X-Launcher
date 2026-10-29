using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using XLauncher.Config;
using XLauncher.Infrastructure;
using XLauncher.Shell;

namespace XLauncher.Apps;

/// <summary>Installed apps (from the Start menu's AppsFolder, Win32 and Store) plus the user's custom tiles.</summary>
public sealed class AppCatalog : IDisposable
{
    const string AppsFolder = "shell:::{4234d49b-0245-4df3-b780-3893943456e1}";

    readonly SettingsStore _settings;
    readonly StaWorker _sta = new("XLauncher.Shell");
    readonly SemaphoreSlim _gate = new(1, 1);
    readonly ConcurrentDictionary<string, string> _iconSources = new(); // icon key -> shell parsing name
    List<AppEntry>? _installed;

    public AppCatalog(SettingsStore settings) => _settings = settings;

    public async Task<IReadOnlyList<AppEntry>> ListAsync(bool refresh = false)
    {
        await _gate.WaitAsync();
        try
        {
            if (_installed is null || refresh)
            {
                _installed = await _sta.Run(EnumerateInstalled);
                Log.Info($"App catalog: {_installed.Count} installed apps");
                SeedOnce(_installed);
            }
        }
        finally
        {
            _gate.Release();
        }
        var overrides = _settings.Current.IconOverrides;
        return _settings.Current.CustomApps.Select(ToEntry).Concat(_installed)
            .Select(a => overrides.TryGetValue(a.Id, out var file) ? a with { Icon = IconSearch.CustomIconUrl(file) } : a)
            .ToList();
    }

    public async Task<AppEntry?> FindAsync(string id) =>
        (await ListAsync()).FirstOrDefault(a => a.Id == id);

    public AppEntry ToEntry(CustomApp app)
    {
        var icon = app.Kind == "exe" && File.Exists(app.Target) ? IconUrl(app.Target) : null;
        return new AppEntry(app.Id, app.Name, app.Kind, icon, true, app.Target, app.Arguments, app.TvMode);
    }

    /// <summary>Returns PNG bytes for an icon key from <see cref="IconUrl"/>, extracting and caching it on first use.</summary>
    public async Task<byte[]?> GetIconAsync(string key)
    {
        if (!_iconSources.TryGetValue(key, out var parsingName)) return null;
        var file = Path.Combine(Paths.IconCache, key + ".png");
        if (File.Exists(file)) return await File.ReadAllBytesAsync(file);

        var png = await _sta.Run(() => ShellIcons.GetPng(parsingName, 256));
        if (png is null) return null;
        Directory.CreateDirectory(Paths.IconCache);
        await File.WriteAllBytesAsync(file, png);
        return png;
    }

    public void Dispose() => _sta.Dispose();

    // First run: add website tiles for missing services and fill the active profile's favorites
    void SeedOnce(IReadOnlyList<AppEntry> installed)
    {
        if (_settings.Current.AppsSeeded) return;
        var websites = AppSeeder.MissingWebsites(installed);
        _settings.Update(s =>
        {
            s.CustomApps.AddRange(websites);
            var all = s.CustomApps.Select(ToEntry).Concat(installed).ToList();
            if (s.ActiveProfile.Favorites.Count == 0)
                s.ActiveProfile.Favorites.AddRange(AppSeeder.PickFavorites(all));
            s.AppsSeeded = true;
        });
        Log.Info($"Seeded {websites.Count} website tiles and default favorites");
    }

    List<AppEntry> EnumerateInstalled()
    {
        var shellType = Type.GetTypeFromProgID("Shell.Application")
            ?? throw new InvalidOperationException("Shell.Application is not available");
        dynamic shell = Activator.CreateInstance(shellType)!;
        try
        {
            dynamic items = shell.NameSpace(AppsFolder).Items();
            int count = items.Count;
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var apps = new List<AppEntry>(count);
            for (var i = 0; i < count; i++)
            {
                dynamic item = items.Item(i);
                string name = item.Name;
                string path = item.Path;
                if (!AppFilter.IsLaunchable(name, path) || !seen.Add(path)) continue;
                apps.Add(new AppEntry(path, name, AppFilter.KindOf(path), IconUrl(@"shell:AppsFolder\" + path), false));
            }
            return apps.OrderBy(a => a.Name, StringComparer.CurrentCultureIgnoreCase).ToList();
        }
        finally
        {
            Marshal.FinalReleaseComObject(shell);
        }
    }

    string IconUrl(string parsingName)
    {
        var key = Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(parsingName))).ToLowerInvariant();
        _iconSources[key] = parsingName;
        return $"https://img.xlauncher.local/app/{key}.png";
    }
}
