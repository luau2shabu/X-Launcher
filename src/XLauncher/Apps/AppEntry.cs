namespace XLauncher.Apps;

/// <summary>
/// One launchable app as the UI sees it.
/// Kind: "store" (packaged AUMID), "desktop" (Start menu Win32 entry), "exe" or "url" (custom).
/// </summary>
public sealed record AppEntry(
    string Id,
    string Name,
    string Kind,
    string? Icon,
    bool Custom,
    string? Target = null,
    string? Arguments = null,
    bool TvMode = false);
