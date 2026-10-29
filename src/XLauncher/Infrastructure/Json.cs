using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace XLauncher.Infrastructure;

public static class Json
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
    public static readonly JsonSerializerOptions Pretty = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    /// <summary>RFC 7396-style merge: objects merge recursively, everything else (arrays included) replaces.</summary>
    public static void Merge(JsonObject target, JsonNode? patch)
    {
        if (patch is not JsonObject patchObject) return;
        foreach (var (key, value) in patchObject)
        {
            if (value is JsonObject childPatch && target[key] is JsonObject childTarget)
                Merge(childTarget, childPatch);
            else
                target[key] = value?.DeepClone();
        }
    }
}

/// <summary>Lenient accessors for Plex JSON, which mixes numbers and numeric strings.</summary>
public static class JsonExt
{
    public static bool Has(this JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind != JsonValueKind.Null;

    public static string? Str(this JsonElement e, string name)
    {
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(name, out var v)) return null;
        return v.ValueKind switch
        {
            JsonValueKind.String => v.GetString(),
            JsonValueKind.Number => v.GetRawText(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            _ => null,
        };
    }

    public static long Long(this JsonElement e, string name, long fallback = 0)
    {
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(name, out var v)) return fallback;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetInt64(out var n)) return n;
        if (v.ValueKind == JsonValueKind.Number) return (long)v.GetDouble();
        return v.ValueKind == JsonValueKind.String && long.TryParse(v.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var s) ? s : fallback;
    }

    public static int Int(this JsonElement e, string name, int fallback = 0) => (int)e.Long(name, fallback);

    public static int? IntOrNull(this JsonElement e, string name) => e.Has(name) ? e.Int(name) : null;

    public static double? Dbl(this JsonElement e, string name)
    {
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(name, out var v)) return null;
        if (v.ValueKind == JsonValueKind.Number) return v.GetDouble();
        return v.ValueKind == JsonValueKind.String && double.TryParse(v.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var d) ? d : null;
    }

    public static bool Bool(this JsonElement e, string name, bool fallback = false)
    {
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(name, out var v)) return fallback;
        return v.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Number => v.GetDouble() != 0,
            JsonValueKind.String => v.GetString() is "1" or "true",
            _ => fallback,
        };
    }

    public static IEnumerable<JsonElement> Arr(this JsonElement e, string name)
    {
        if (e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Array)
            foreach (var item in v.EnumerateArray()) yield return item;
    }

    public static string[] Tags(this JsonElement e, string name, int max = int.MaxValue) =>
        e.Arr(name).Select(t => t.Str("tag")).OfType<string>().Take(max).ToArray();
}
