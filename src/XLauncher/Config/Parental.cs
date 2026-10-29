using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using XLauncher.Infrastructure;

namespace XLauncher.Config;

/// <summary>
/// The parent PIN, kept apart from settings.json so it never travels to the UI.
/// Stored as a salted PBKDF2 hash.
/// </summary>
public sealed class PinStore(string path)
{
    sealed record Stored(string Salt, string Hash);

    public bool IsSet => File.Exists(path);

    public void Set(string pin)
    {
        if (pin.Length is < 4 or > 8 || !pin.All(char.IsAsciiDigit)) throw new ArgumentException("The PIN must be 4 to 8 digits");
        var salt = RandomNumberGenerator.GetBytes(16);
        var stored = new Stored(Convert.ToBase64String(salt), Convert.ToBase64String(Hash(pin, salt)));
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, JsonSerializer.Serialize(stored, Json.Options));
    }

    public bool Verify(string pin)
    {
        if (!IsSet) return true;
        try
        {
            var stored = JsonSerializer.Deserialize<Stored>(File.ReadAllText(path), Json.Options)!;
            var expected = Convert.FromBase64String(stored.Hash);
            return CryptographicOperations.FixedTimeEquals(expected, Hash(pin, Convert.FromBase64String(stored.Salt)));
        }
        catch (Exception ex) when (ex is JsonException or IOException or FormatException)
        {
            Log.Error("PIN file is unreadable", ex);
            return false;
        }
    }

    static byte[] Hash(string pin, byte[] salt) =>
        Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(pin), salt, 100_000, HashAlgorithmName.SHA256, 32);
}

/// <summary>
/// Enforces kids rules on the host side (the UI also hides things, but this is what counts):
/// which apps may start, which Plex titles are visible, and the daily screen-time budget.
/// </summary>
public sealed class KidsGuard(SettingsStore settings)
{
    /// <summary>Kids rules of the active profile, or null when it is not a kids profile.</summary>
    public KidsRules? ActiveRules => settings.Current.ActiveProfile is { Kind: Profile.Kids } p ? p.Rules : null;

    public bool CanLaunch(string appId) => ActiveRules is not { } rules || rules.AllowedApps.Contains(appId);

    public bool CanSeeSection(string sectionId) => ActiveRules is not { } rules || rules.AllowedSections.Contains(sectionId);

    public bool CanSee(string serverId, string? sectionKey, string? rating, string type)
    {
        if (ActiveRules is not { } rules) return true;
        if (sectionKey is not null && !rules.AllowedSections.Contains($"{serverId}/{sectionKey}")) return false;
        return ContentRatings.Allows(rules.MaxRating, rating, type);
    }

    public static string Today => DateTime.Now.ToString("yyyy-MM-dd");

    /// <summary>Minutes used today and the limit for the active kids profile (null when not a kids profile).</summary>
    public object? Status()
    {
        var profile = settings.Current.ActiveProfile;
        if (profile.Kind != Profile.Kids || profile.Rules is null) return null;
        var used = profile.UsageDate == Today ? profile.UsedMinutes : 0;
        var limit = profile.Rules.DailyMinutes;
        return new { used, limit, remaining = limit == 0 ? (int?)null : Math.Max(0, limit - used), timeUp = limit > 0 && used >= limit };
    }

    public bool TimeUp
    {
        get
        {
            var p = settings.Current.ActiveProfile;
            return p is { Kind: Profile.Kids, Rules.DailyMinutes: > 0 } && p.UsageDate == Today && p.UsedMinutes >= p.Rules.DailyMinutes;
        }
    }

    /// <summary>Adds one minute of use to the active kids profile. Returns true when this minute used up the budget.</summary>
    public bool CountMinute()
    {
        var becameTimeUp = false;
        settings.Update(s =>
        {
            var p = s.ActiveProfile;
            if (p.Kind != Profile.Kids || p.Rules is null) return;
            if (p.UsageDate != Today)
            {
                p.UsageDate = Today;
                p.UsedMinutes = 0;
            }
            p.UsedMinutes++;
            becameTimeUp = p.Rules.DailyMinutes > 0 && p.UsedMinutes == p.Rules.DailyMinutes;
        });
        return becameTimeUp;
    }

    /// <summary>Parent grants extra time today by lowering the minutes used.</summary>
    public AppSettings AddTime(string profileId, int minutes) =>
        settings.Update(s =>
        {
            var p = s.Profiles.FirstOrDefault(x => x.Id == profileId);
            if (p is null || p.UsageDate != Today) return;
            p.UsedMinutes = Math.Max(0, p.UsedMinutes - minutes);
        });
}
