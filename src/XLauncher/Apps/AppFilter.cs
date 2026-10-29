namespace XLauncher.Apps;

/// <summary>Decides which Start menu entries are real apps worth showing on a TV.</summary>
public static class AppFilter
{
    static readonly string[] NoiseWords =
    [
        "uninstall", "readme", "read me", "release notes", "documentation", "license", "manual",
        "changelog", "website", "support center", "faq", "reset preferences", "skinned", "visit ",
    ];

    static readonly string[] DocumentExtensions =
    [
        ".txt", ".pdf", ".chm", ".htm", ".html", ".url", ".ini", ".log", ".rtf", ".hlp", ".md", ".xml", ".msc",
    ];

    public static bool IsLaunchable(string? name, string? path)
    {
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(path)) return false;
        if (path.StartsWith("http:", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("https:", StringComparison.OrdinalIgnoreCase)) return false;
        if (NoiseWords.Any(w => name.Contains(w, StringComparison.OrdinalIgnoreCase))) return false;

        // Only file-like paths have meaningful extensions; AUMIDs contain dots too ("Microsoft.WindowsCalculator_...!App")
        if (path.Contains('\\') && DocumentExtensions.Contains(Path.GetExtension(path), StringComparer.OrdinalIgnoreCase))
            return false;
        return true;
    }

    public static string KindOf(string path) =>
        path.Contains('!') && !path.Contains('\\') ? "store" : "desktop";
}
