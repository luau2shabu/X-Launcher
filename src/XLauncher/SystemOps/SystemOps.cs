using System.Diagnostics;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Reflection;
using System.Runtime.InteropServices;

namespace XLauncher.SystemOps;

public static class Power
{
    [DllImport("powrprof.dll", SetLastError = true)]
    static extern bool SetSuspendState(bool hibernate, bool forceCritical, bool disableWakeEvent);

    public static void Run(string action, Action quit)
    {
        switch (action)
        {
            case "sleep":
                SetSuspendState(false, false, false);
                break;
            case "restart":
                Shutdown("/r /t 0");
                break;
            case "shutdown":
                Shutdown("/s /t 0");
                break;
            case "quit":
                quit();
                break;
            default:
                throw new ArgumentException($"Unknown power action '{action}'");
        }
    }

    static void Shutdown(string args) =>
        Process.Start(new ProcessStartInfo("shutdown.exe", args) { UseShellExecute = false, CreateNoWindow = true });
}

/// <summary>Opens a page of the Windows Settings app. Only known pages are allowed.</summary>
public static class WindowsSettings
{
    static readonly Dictionary<string, string> Pages = new()
    {
        ["display"] = "ms-settings:display",
        ["hdr"] = "ms-settings:display-hdr",
        ["sound"] = "ms-settings:sound",
        ["network"] = "ms-settings:network",
        ["bluetooth"] = "ms-settings:bluetooth",
        ["power"] = "ms-settings:powersleep",
        ["update"] = "ms-settings:windowsupdate",
    };

    public static void Open(string page)
    {
        if (!Pages.TryGetValue(page, out var uri)) throw new ArgumentException($"Unknown settings page '{page}'");
        Process.Start(new ProcessStartInfo(uri) { UseShellExecute = true });
    }
}

public sealed record NetworkStatus(bool Connected, string? Name = null, string? Type = null, long SpeedMbps = 0, string? Ip = null);

public sealed record SystemStatus(string Version, string Machine, string Os, NetworkStatus Network);

public static class SystemInfo
{
    public static SystemStatus Get()
    {
        var version = Assembly.GetExecutingAssembly().GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion.Split('+')[0] ?? "0.1.0";
        return new SystemStatus(version, Environment.MachineName, RuntimeInformation.OSDescription, Network());
    }

    static NetworkStatus Network()
    {
        var nic = NetworkInterface.GetAllNetworkInterfaces()
            .Where(n => n.OperationalStatus == OperationalStatus.Up
                && n.NetworkInterfaceType is not (NetworkInterfaceType.Loopback or NetworkInterfaceType.Tunnel)
                && n.GetIPProperties().GatewayAddresses.Any(g => g.Address.AddressFamily == AddressFamily.InterNetwork))
            .OrderByDescending(n => n.NetworkInterfaceType == NetworkInterfaceType.Ethernet)
            .FirstOrDefault();
        if (nic is null) return new NetworkStatus(false);
        var ip = nic.GetIPProperties().UnicastAddresses
            .FirstOrDefault(a => a.Address.AddressFamily == AddressFamily.InterNetwork)?.Address.ToString();
        var type = nic.NetworkInterfaceType == NetworkInterfaceType.Wireless80211 ? "wifi" : "ethernet";
        return new NetworkStatus(true, nic.Name, type, nic.Speed / 1_000_000, ip);
    }
}
