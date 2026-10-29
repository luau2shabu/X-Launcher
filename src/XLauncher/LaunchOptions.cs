using XLauncher.Infrastructure;

namespace XLauncher;

/// <summary>
/// Command line: <c>XLauncher.exe [--debug] [--windowed] [--monitor N] [--ui DIR] [--screenshot FILE]</c>.
/// --ui points at app/ui in a checkout so UI edits show up after a reload (F5 in debug mode).
/// --screenshot saves a PNG of the UI a few seconds after it first renders (for checking a build).
/// </summary>
public sealed record LaunchOptions(bool Debug, bool Windowed, int Monitor, string UiDir, string? ScreenshotPath = null)
{
    public static LaunchOptions Parse(string[] args)
    {
        bool debug = false, windowed = false;
        var monitor = 0;
        var ui = Paths.DefaultUiDir;
        string? screenshot = null;
        for (var i = 0; i < args.Length; i++)
        {
            switch (args[i].ToLowerInvariant())
            {
                case "-d" or "--debug":
                    debug = true;
                    break;
                case "--windowed":
                    windowed = true;
                    break;
                case "--monitor" when i + 1 < args.Length && int.TryParse(args[i + 1], out var m):
                    monitor = Math.Max(0, m - 1);
                    i++;
                    break;
                case "--ui" when i + 1 < args.Length:
                    ui = Path.GetFullPath(args[++i]);
                    break;
                case "--screenshot" when i + 1 < args.Length:
                    screenshot = Path.GetFullPath(args[++i]);
                    break;
            }
        }
        return new LaunchOptions(debug, windowed, monitor, ui, screenshot);
    }
}
