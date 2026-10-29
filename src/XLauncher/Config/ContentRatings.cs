using System.Globalization;
using System.Text.RegularExpressions;

namespace XLauncher.Config;

/// <summary>Maps content ratings (MPAA, US TV, "13+", "th/15"...) to a minimum age, for kids limits.</summary>
public static partial class ContentRatings
{
    /// <summary>Kids rating ceilings, from strictest. "all" means no rating limit.</summary>
    public static readonly string[] Levels = ["young", "child", "teen", "all"];

    static readonly Dictionary<string, int> Known = new(StringComparer.OrdinalIgnoreCase)
    {
        ["G"] = 0, ["TV-Y"] = 0, ["TV-G"] = 0, ["U"] = 0, ["E"] = 0, ["ท"] = 0,
        ["TV-Y7"] = 7, ["TV-Y7-FV"] = 7,
        ["PG"] = 10, ["TV-PG"] = 10, ["ส"] = 10,
        ["PG-13"] = 13, ["TV-14"] = 14, ["12A"] = 12, ["น13+"] = 13, ["น15+"] = 15,
        ["R"] = 17, ["TV-MA"] = 17, ["NC-17"] = 18, ["X"] = 18, ["น18+"] = 18, ["ฉ20-"] = 20,
    };

    public static int MaxAge(string level) => level switch
    {
        "young" => 7,
        "child" => 10,
        "teen" => 14,
        _ => int.MaxValue,
    };

    /// <summary>Minimum age for a rating, or null when the rating is missing or not understood.</summary>
    public static int? AgeOf(string? rating)
    {
        if (string.IsNullOrWhiteSpace(rating)) return null;
        var value = rating.Trim();
        var slash = value.LastIndexOf('/');
        if (slash >= 0) value = value[(slash + 1)..]; // "us/PG-13", "th/15"
        if (Known.TryGetValue(value, out var age)) return age;
        var digits = Digits().Match(value);
        return digits.Success ? int.Parse(digits.Value, CultureInfo.InvariantCulture) : null;
    }

    /// <summary>
    /// Whether a title fits under the ceiling. Unrated movies and shows are blocked under any limit;
    /// episodes and seasons often carry no rating of their own, so they follow their library.
    /// </summary>
    public static bool Allows(string level, string? rating, string type)
    {
        if (level == "all") return true;
        var age = AgeOf(rating);
        if (age is null) return type is "episode" or "season";
        return age <= MaxAge(level);
    }

    [GeneratedRegex(@"\d{1,2}")]
    private static partial Regex Digits();
}
