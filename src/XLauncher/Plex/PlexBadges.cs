using System.Text.Json;
using XLauncher.Infrastructure;

namespace XLauncher.Plex;

/// <summary>Quality badges (4K, Dolby Vision, HDR10, Dolby Atmos, DTS-HD MA, 7.1...) from a Plex item's first media version.</summary>
public static class PlexBadges
{
    public static string[] From(JsonElement metadata)
    {
        var media = metadata.Arr("Media").FirstOrDefault();
        if (media.ValueKind != JsonValueKind.Object) return [];

        var badges = new List<string>();
        switch (media.Str("videoResolution")?.ToLowerInvariant())
        {
            case "4k": badges.Add("4K"); break;
            case "1080" or "720": badges.Add("HD"); break;
        }

        var streams = media.Arr("Part").FirstOrDefault().Arr("Stream").ToList();
        if (streams.Count > 0)
        {
            var video = streams.FirstOrDefault(s => s.Int("streamType") == 1);
            var audio = streams.Where(s => s.Int("streamType") == 2).OrderByDescending(s => s.Bool("selected")).FirstOrDefault();
            AddVideo(badges, video);
            AddAudio(badges, audio.ValueKind == JsonValueKind.Object ? audio.Str("codec") : null, audio);
        }
        else
        {
            // List endpoints carry only media-level summaries
            AddAudio(badges, media.Str("audioCodec"), media);
            if (media.Str("audioChannels") is { } ch && int.TryParse(ch, out var channels)) AddChannels(badges, channels);
        }
        return badges.Distinct().ToArray();
    }

    static void AddVideo(List<string> badges, JsonElement video)
    {
        if (video.ValueKind != JsonValueKind.Object) return;
        var title = (video.Str("displayTitle") ?? "") + " " + (video.Str("extendedDisplayTitle") ?? "");
        if (video.Bool("DOVIPresent") || title.Contains("DoVi", StringComparison.OrdinalIgnoreCase) || title.Contains("Dolby Vision", StringComparison.OrdinalIgnoreCase))
            badges.Add("Dolby Vision");
        if (title.Contains("HDR10+", StringComparison.OrdinalIgnoreCase))
            badges.Add("HDR10+");
        else if (video.Str("colorTrc") == "smpte2084" || title.Contains("HDR10", StringComparison.OrdinalIgnoreCase))
            badges.Add("HDR10");
        else if (video.Str("colorTrc") == "arib-std-b67" || title.Contains("HLG", StringComparison.OrdinalIgnoreCase))
            badges.Add("HLG");
    }

    static void AddAudio(List<string> badges, string? codec, JsonElement stream)
    {
        var title = stream.ValueKind == JsonValueKind.Object
            ? (stream.Str("displayTitle") ?? "") + " " + (stream.Str("extendedDisplayTitle") ?? "")
            : "";
        var profile = stream.ValueKind == JsonValueKind.Object ? stream.Str("profile") ?? stream.Str("audioProfile") ?? "" : "";
        codec = codec?.ToLowerInvariant();

        if (title.Contains("Atmos", StringComparison.OrdinalIgnoreCase)) badges.Add("Dolby Atmos");
        else if (codec == "truehd") badges.Add("Dolby TrueHD");
        else if (codec == "eac3") badges.Add("Dolby Digital+");
        else if (codec == "ac3") badges.Add("Dolby Digital");

        if (title.Contains("DTS:X", StringComparison.OrdinalIgnoreCase)) badges.Add("DTS:X");
        else if (codec is "dca" or "dts")
            badges.Add(profile.Contains("ma", StringComparison.OrdinalIgnoreCase) || title.Contains("DTS-HD MA", StringComparison.OrdinalIgnoreCase) ? "DTS-HD MA" : "DTS");

        if (stream.ValueKind == JsonValueKind.Object && stream.Has("channels")) AddChannels(badges, stream.Int("channels"));
    }

    static void AddChannels(List<string> badges, int channels)
    {
        if (channels >= 8) badges.Add("7.1");
        else if (channels >= 6) badges.Add("5.1");
    }
}
