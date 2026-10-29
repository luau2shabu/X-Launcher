namespace XLauncher.Plex;

/// <summary>Where Plex HTPC lives and the client identifier it registers with Plex Companion.</summary>
public static class HtpcConfig
{
    public const string ProcessName = "Plex HTPC";

    public static string IniPath =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Plex HTPC", "plex.ini");

    public static string DefaultExe =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Plex", "Plex HTPC", "Plex HTPC.exe");

    public static string? ReadClientId(string iniPath)
    {
        try
        {
            return File.Exists(iniPath) ? ParseClientId(File.ReadAllText(iniPath)) : null;
        }
        catch (IOException)
        {
            return null;
        }
    }

    /// <summary>Reads <c>ClientID</c> from the <c>[web]</c> section of plex.ini.</summary>
    public static string? ParseClientId(string ini)
    {
        var inWeb = false;
        foreach (var raw in ini.Split('\n'))
        {
            var line = raw.Trim();
            if (line.StartsWith('['))
            {
                inWeb = line.Equals("[web]", StringComparison.OrdinalIgnoreCase);
                continue;
            }
            if (inWeb && line.StartsWith("ClientID=", StringComparison.OrdinalIgnoreCase))
                return line["ClientID=".Length..].Trim() is { Length: > 0 } id ? id : null;
        }
        return null;
    }
}
