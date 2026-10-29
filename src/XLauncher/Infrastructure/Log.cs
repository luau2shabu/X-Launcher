using System.Text.RegularExpressions;

namespace XLauncher.Infrastructure;

/// <summary>Minimal file logger. Every line is passed through <see cref="Redact"/> so Plex tokens never reach disk.</summary>
public static partial class Log
{
    static readonly object Gate = new();
    static string? _file;
    static bool _debug;

    public static void Init(string file, bool debug)
    {
        _file = file;
        _debug = debug;
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(file)!);
            var info = new FileInfo(file);
            if (info.Exists && info.Length > 2_000_000)
                File.Move(file, file + ".old", overwrite: true);
        }
        catch (IOException)
        {
            // Logging must never stop the launcher from starting
        }
    }

    public static void Debug(string message)
    {
        if (_debug) Write("DEBUG", message);
    }

    public static void Info(string message) => Write("INFO", message);

    public static void Warn(string message, Exception? ex = null) =>
        Write("WARN", ex is null ? message : $"{message}: {ex.Message}");

    public static void Error(string message, Exception? ex = null) =>
        Write("ERROR", ex is null ? message : $"{message}: {ex}");

    /// <summary>Masks values of token-like query parameters, headers and JSON fields.</summary>
    public static string Redact(string text) => TokenPattern().Replace(text, "$1$2<redacted>");

    static void Write(string level, string message)
    {
        if (_file is null) return;
        var line = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} [{level}] {Redact(message)}{Environment.NewLine}";
        lock (Gate)
        {
            try { File.AppendAllText(_file, line); }
            catch (IOException) { }
        }
    }

    [GeneratedRegex(@"(x-plex-token|accesstoken|authtoken|token)(""?\s*[=:]\s*""?)([^&\s""]+)", RegexOptions.IgnoreCase)]
    private static partial Regex TokenPattern();
}
