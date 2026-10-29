namespace XLauncher.Infrastructure;

/// <summary>Locations of XLauncher's per-user data under %LOCALAPPDATA%\XLauncher.</summary>
public static class Paths
{
    public static string DataDir { get; } =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "XLauncher");

    public static string SettingsFile => Path.Combine(DataDir, "settings.json");
    public static string LogFile => Path.Combine(DataDir, "xlauncher.log");
    public static string IconCache => Path.Combine(DataDir, "cache", "icons");
    public static string ImageCache => Path.Combine(DataDir, "cache", "images");
    public static string WebViewData => Path.Combine(DataDir, "webview");
    public static string CustomIcons => Path.Combine(DataDir, "icons");
    public static string Avatars => Path.Combine(DataDir, "avatars");

    /// <summary>Google OAuth client for sign-in: next to the exe (shipped with a build) or in the data folder.</summary>
    public static IEnumerable<string> GoogleClientFiles =>
    [
        Path.Combine(AppContext.BaseDirectory, "google-oauth.json"),
        Path.Combine(DataDir, "google-oauth.json"),
    ];

    // Separate Edge profiles so command-line flags (--user-agent) apply to our windows only
    public static string EdgeProfile => Path.Combine(DataDir, "edge");
    public static string EdgeTvProfile => Path.Combine(DataDir, "edge-tv");

    public static string DefaultUiDir => Path.Combine(AppContext.BaseDirectory, "ui");
}
