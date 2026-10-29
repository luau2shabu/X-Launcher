using System.Security.Cryptography;
using System.Text;
using XLauncher.Infrastructure;

namespace XLauncher.Plex;

/// <summary>Fetches artwork through each server's photo transcoder (adding the token host-side) and caches it on disk.</summary>
public sealed class PlexImages(PlexService plex)
{
    const long CacheLimitBytes = 1_500_000_000;

    public async Task<byte[]?> GetAsync(string serverId, int width, int height, string path)
    {
        width = Math.Clamp(width, 32, 3840);
        height = Math.Clamp(height, 32, 2160);
        var key = Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes($"{serverId}|{path}|{width}x{height}"))).ToLowerInvariant();
        var file = Path.Combine(Paths.ImageCache, key[..2], key + ".jpg");
        if (File.Exists(file)) return await File.ReadAllBytesAsync(file);

        var server = await plex.ServerAsync(serverId);
        if (server is null) return null;
        var bytes = await plex.GetBytesAsync(server,
            $"/photo/:/transcode?width={width}&height={height}&minSize=1&upscale=1&format=jpeg&quality=85&url={Uri.EscapeDataString(path)}");
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(file)!);
            await File.WriteAllBytesAsync(file, bytes);
        }
        catch (IOException)
        {
            // Another request for the same image is writing it; the bytes are still good to return
        }
        return bytes;
    }

    /// <summary>Deletes the least recently used images once the cache grows past its limit.</summary>
    public static void TrimCache()
    {
        try
        {
            var dir = new DirectoryInfo(Paths.ImageCache);
            if (!dir.Exists) return;
            var files = dir.EnumerateFiles("*.jpg", SearchOption.AllDirectories).OrderByDescending(f => f.LastAccessTimeUtc).ToList();
            long total = 0;
            foreach (var file in files)
            {
                total += file.Length;
                if (total > CacheLimitBytes) file.Delete();
            }
        }
        catch (IOException ex)
        {
            Log.Warn("Image cache cleanup failed", ex);
        }
    }
}
