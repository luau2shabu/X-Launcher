using System.Diagnostics;
using XLauncher.Infrastructure;
using XLauncher.Shell;
using Microsoft.Win32;

namespace XLauncher.Apps;

/// <summary>
/// Starts apps. XLauncher stays open behind them, so when an app closes Windows hands
/// focus back to the launcher; the Home key brings it forward while an app is running.
/// </summary>
public static class AppLauncher
{
    public static void Launch(AppEntry app)
    {
        Log.Info($"Launching {app.Name} ({app.Kind})");
        NativeMethods.AllowSetForegroundWindow(NativeMethods.ASFW_ANY);
        switch (app.Kind)
        {
            case "url":
                OpenWebsite(app.Target!, app.TvMode);
                break;
            case "exe":
                Process.Start(new ProcessStartInfo(app.Target!)
                {
                    Arguments = app.Arguments ?? "",
                    UseShellExecute = true,
                    WorkingDirectory = Path.GetDirectoryName(app.Target!) ?? "",
                });
                break;
            default:
                // Works for both packaged AUMIDs and Win32 Start menu entries
                Process.Start(new ProcessStartInfo("explorer.exe", $@"shell:AppsFolder\{app.Id}") { UseShellExecute = true });
                break;
        }
    }

    /// <summary>Opens a site as a full-screen Edge app window (no tabs or address bar).</summary>
    public static void OpenWebsite(string url, bool tvMode)
    {
        var edge = FindEdge();
        if (edge is null)
        {
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            return;
        }
        var profile = tvMode ? Paths.EdgeTvProfile : Paths.EdgeProfile;
        var args = $"--app=\"{url}\" --start-fullscreen --no-first-run --no-default-browser-check --user-data-dir=\"{profile}\"";
        if (tvMode) args += $" --user-agent=\"{AppSeeder.TvUserAgent}\"";
        Process.Start(new ProcessStartInfo(edge, args) { UseShellExecute = false });
    }

    public static void OpenUri(string uri) => Process.Start(new ProcessStartInfo(uri) { UseShellExecute = true });

    static string? FindEdge()
    {
        const string appPath = @"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe";
        foreach (var hive in new[] { Registry.LocalMachine, Registry.CurrentUser })
        {
            using var key = hive.OpenSubKey(appPath);
            if (key?.GetValue(null) is string path && File.Exists(path)) return path;
        }
        var fallback = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe");
        return File.Exists(fallback) ? fallback : null;
    }
}
