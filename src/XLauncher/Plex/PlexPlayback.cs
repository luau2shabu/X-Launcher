using System.Diagnostics;
using System.Text.Json;
using XLauncher.Config;
using XLauncher.Infrastructure;
using XLauncher.Shell;

namespace XLauncher.Plex;

/// <summary>
/// Plays an item in Plex HTPC, which keeps the big mpv buffer and HDR/audio passthrough.
/// Uses Plex Companion: the command goes to the PMS on this PC, which relays it to the HTPC client.
/// If that fails, Plex HTPC is still opened so the user can pick the title there.
/// </summary>
public sealed class PlexPlayback(PlexService plex, SettingsStore settings)
{
    static readonly TimeSpan ColdStartWait = TimeSpan.FromSeconds(45);
    static readonly TimeSpan WarmWait = TimeSpan.FromSeconds(8);
    int _commandId;

    public async Task<object> PlayAsync(string serverId, string key, long offsetMs)
    {
        var server = await plex.ServerAsync(serverId) ?? throw new InvalidOperationException("That Plex server is not reachable right now");
        var relay = (await plex.ServersAsync()).FirstOrDefault(s => s.OnThisPc);
        var clientId = HtpcConfig.ReadClientId(HtpcConfig.IniPath);
        var coldStart = EnsureHtpcRunning();

        if (relay is null || clientId is null)
        {
            Log.Warn($"Cannot remote-control Plex HTPC (relay server: {relay is not null}, client id: {clientId is not null}); opened it instead");
            BringHtpcToFront();
            return new { status = "opened" };
        }

        var queueId = await CreatePlayQueueAsync(server, key);
        var deadline = DateTime.UtcNow + (coldStart ? ColdStartWait : WarmWait);
        while (true)
        {
            if (await SendPlayMediaAsync(relay, server, clientId, key, offsetMs, queueId))
            {
                BringHtpcToFront();
                return new { status = "playing" };
            }
            if (DateTime.UtcNow >= deadline) break;
            await Task.Delay(2000);
        }
        BringHtpcToFront();
        return new { status = "opened" };
    }

    bool EnsureHtpcRunning()
    {
        if (Process.GetProcessesByName(HtpcConfig.ProcessName).Length > 0) return false;
        var exe = settings.Current.Plex.HtpcPath is { Length: > 0 } custom ? custom : HtpcConfig.DefaultExe;
        if (!File.Exists(exe)) throw new FileNotFoundException("Plex HTPC is not installed", exe);
        NativeMethods.AllowSetForegroundWindow(NativeMethods.ASFW_ANY);
        Process.Start(new ProcessStartInfo(exe) { UseShellExecute = true, WorkingDirectory = Path.GetDirectoryName(exe)! });
        Log.Info("Started Plex HTPC");
        return true;
    }

    static void BringHtpcToFront()
    {
        foreach (var process in Process.GetProcessesByName(HtpcConfig.ProcessName))
        {
            if (process.MainWindowHandle != IntPtr.Zero) NativeMethods.ForceForeground(process.MainWindowHandle);
            process.Dispose();
        }
    }

    async Task<string?> CreatePlayQueueAsync(PlexServer server, string key)
    {
        var uri = Uri.EscapeDataString($"server://{server.Id}/com.plexapp.plugins.library/library/metadata/{key}");
        try
        {
            using var response = await plex.SendAsync(HttpMethod.Post, server,
                $"/playQueues?type=video&uri={uri}&shuffle=0&repeat=0&continuous=0&own=1&includeChapters=1");
            if (!response.IsSuccessStatusCode) return null;
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return doc.RootElement.TryGetProperty("MediaContainer", out var container) ? container.Str("playQueueID") : null;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            Log.Warn("Could not create a play queue", ex);
            return null;
        }
    }

    async Task<bool> SendPlayMediaAsync(PlexServer relay, PlexServer server, string clientId, string key, long offsetMs, string? queueId)
    {
        var address = new Uri(server.BaseUrl);
        var query = new List<string>
        {
            "key=" + Uri.EscapeDataString($"/library/metadata/{key}"),
            $"offset={Math.Max(0, offsetMs)}",
            $"machineIdentifier={server.Id}",
            "address=" + Uri.EscapeDataString(address.Host),
            $"port={address.Port}",
            $"protocol={address.Scheme}",
            "token=" + Uri.EscapeDataString(server.Token),
            "providerIdentifier=com.plexapp.plugins.library",
            "type=video",
            $"commandID={Interlocked.Increment(ref _commandId)}",
        };
        if (queueId is not null) query.Add("containerKey=" + Uri.EscapeDataString($"/playQueues/{queueId}?own=1&window=200"));

        try
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(6));
            using var response = await plex.SendAsync(HttpMethod.Get, relay, "/player/playback/playMedia?" + string.Join("&", query),
                new Dictionary<string, string> { ["X-Plex-Target-Client-Identifier"] = clientId }, cts.Token);
            Log.Info($"playMedia via {relay.Name}: HTTP {(int)response.StatusCode}");
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            Log.Debug($"playMedia not accepted yet: {ex.Message}");
            return false;
        }
    }
}
