using System.Text.Json.Serialization;

namespace XLauncher.Config;

/// <summary>Everything XLauncher persists. Serialized camelCase to settings.json and sent to the UI as-is.</summary>
public sealed class AppSettings
{
    public int Version { get; set; } = 1;
    public string Language { get; set; } = "th";
    public string ClientId { get; set; } = Guid.NewGuid().ToString("N");
    public bool AppsSeeded { get; set; }
    public string ActiveProfileId { get; set; } = Profile.DefaultId;
    public List<Profile> Profiles { get; set; } = [Profile.CreateDefault()];
    public List<string> HiddenApps { get; set; } = [];
    public List<CustomApp> CustomApps { get; set; } = [];
    /// <summary>App id -> file name in %LOCALAPPDATA%\XLauncher\icons, for icons the user picked.</summary>
    public Dictionary<string, string> IconOverrides { get; set; } = [];
    /// <summary>App id -> display name the user chose.</summary>
    public Dictionary<string, string> NameOverrides { get; set; } = [];
    public LaunchBehavior Launch { get; set; } = new();
    public PlexOptions Plex { get; set; } = new();
    public AmbientOptions Ambient { get; set; } = new();
    public InputOptions Input { get; set; } = new();

    [JsonIgnore]
    public Profile ActiveProfile =>
        Profiles.FirstOrDefault(p => p.Id == ActiveProfileId) ?? Profiles[0];

    [JsonIgnore]
    public Profile AdminProfile => Profiles.FirstOrDefault(p => p.Kind == Profile.Admin) ?? Profiles[0];
}

/// <summary>
/// A person using the TV. The admin profile is the Windows user (name and photo come from the
/// Windows account); others are local "standard" or "kids" profiles created in X Launcher.
/// </summary>
public sealed class Profile
{
    public const string DefaultId = "default";
    public const string Admin = "admin", Standard = "standard", Kids = "kids";

    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..8];
    public string Name { get; set; } = "";
    public string Color { get; set; } = "#3ba3cc";
    public string Kind { get; set; } = Standard;
    public List<string> Favorites { get; set; } = [];
    /// <summary>Profile photo URL served by the host (img.xlauncher.local/avatar/...), or null.</summary>
    public string? Picture { get; set; }
    /// <summary>Only for kids profiles: what the admin allows.</summary>
    public KidsRules? Rules { get; set; }
    /// <summary>Kids time accounting: minutes used on <see cref="UsageDate"/> (yyyy-MM-dd).</summary>
    public string? UsageDate { get; set; }
    public int UsedMinutes { get; set; }

    public static Profile CreateDefault() => new() { Id = DefaultId, Name = "Home", Color = "#3ba3cc", Kind = Admin };
}

/// <summary>Parental controls for one kids profile.</summary>
public sealed class KidsRules
{
    /// <summary>App ids the child may open, in the order shown on their home screen.</summary>
    public List<string> AllowedApps { get; set; } = [];
    /// <summary>Plex libraries ("serverId/sectionKey") the child may browse.</summary>
    public List<string> AllowedSections { get; set; } = [];
    /// <summary>Content rating ceiling: all | young | child | teen (see <see cref="ContentRatings"/>).</summary>
    public string MaxRating { get; set; } = "child";
    /// <summary>Daily screen time in minutes; 0 means no limit.</summary>
    public int DailyMinutes { get; set; } = 90;
}

/// <summary>An app the user added by hand: a program (.exe) or a website opened in an Edge app window.</summary>
public sealed class CustomApp
{
    public const string IdPrefix = "custom:";

    public string Id { get; set; } = IdPrefix + Guid.NewGuid().ToString("N")[..12];
    public string Name { get; set; } = "";
    public string Kind { get; set; } = "exe"; // "exe" | "url"
    public string Target { get; set; } = "";
    public string Arguments { get; set; } = "";
    /// <summary>For websites: open with a Smart-TV user agent so sites like YouTube serve their remote-friendly TV UI.</summary>
    public bool TvMode { get; set; }
}

public sealed class LaunchBehavior
{
    /// <summary>Make an app's window cover the whole screen after it opens.</summary>
    public bool Fullscreen { get; set; } = true;
    /// <summary>App ids that should keep their normal window.</summary>
    public List<string> WindowedApps { get; set; } = [];
}

public sealed class PlexOptions
{
    public bool Enabled { get; set; } = true;
    public string LocalUrl { get; set; } = "http://127.0.0.1:32400";
    /// <summary>Also show servers shared with the signed-in Plex account (found through plex.tv).</summary>
    public bool UseAccountServers { get; set; } = true;
    public string HtpcPath { get; set; } = "";
    /// <summary>"serverId/sectionKey" pairs the user hid from XLauncher.</summary>
    public List<string> HiddenSections { get; set; } = [];
}

public sealed class AmbientOptions
{
    public bool Enabled { get; set; } = true;
    public int IdleMinutes { get; set; } = 5;
    public string Source { get; set; } = "plex"; // "plex" | "folder"
    public string Folder { get; set; } = "";
    public bool ShowClock { get; set; } = true;
}

public sealed class InputOptions
{
    /// <summary>Virtual-key codes that bring XLauncher to the front from any app. 0xAC = VK_BROWSER_HOME.</summary>
    public List<int> HomeKeys { get; set; } = [0xAC];
    public bool GamepadEnabled { get; set; } = true;
}
