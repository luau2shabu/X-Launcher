using System.Runtime.InteropServices;
using System.Text;
using XLauncher.Infrastructure;

namespace XLauncher.Shell;

/// <summary>
/// After X Launcher starts an app, the first windows that app brings to the front are made to cover
/// their monitor: classic Win32 windows become borderless full screen, Store (UWP) apps get the
/// system Win+Shift+Enter full-screen toggle. Windows that already cover the screen are left alone.
/// </summary>
public sealed class FullscreenOnLaunch : IDisposable
{
    const uint EVENT_SYSTEM_FOREGROUND = 0x0003;
    const int GWL_STYLE = -16, GWL_EXSTYLE = -20;
    const long WS_CAPTION = 0x00C00000, WS_THICKFRAME = 0x00040000;
    const long WS_EX_TOOLWINDOW = 0x00000080;
    const uint SWP_NOZORDER = 0x0004, SWP_NOOWNERZORDER = 0x0200, SWP_FRAMECHANGED = 0x0020, SWP_SHOWWINDOW = 0x0040;
    const int SW_RESTORE = 9;
    const uint GW_OWNER = 4;
    const byte VK_LWIN = 0x5B, VK_SHIFT = 0x10, VK_RETURN = 0x0D;
    const uint KEYEVENTF_KEYUP = 0x2;
    static readonly TimeSpan WatchFor = TimeSpan.FromSeconds(25);
    static readonly TimeSpan FollowUp = TimeSpan.FromSeconds(8);

    // Shell surfaces and dialogs that must never be resized
    static readonly HashSet<string> IgnoredClasses = new(StringComparer.Ordinal)
    {
        "Shell_TrayWnd", "Shell_SecondaryTrayWnd", "Progman", "WorkerW", "Windows.UI.Core.CoreWindow",
        "ForegroundStaging", "MultitaskingViewFrame", "XamlExplorerHostIslandWindow", "#32768", "#32770",
        "TopLevelWindowForOverflowXamlIsland", "NotifyIconOverflowWindow",
    };

    delegate void WinEventProc(IntPtr hook, uint evt, IntPtr hwnd, int idObject, int idChild, uint thread, uint time);

    [DllImport("user32.dll")] static extern IntPtr SetWinEventHook(uint min, uint max, IntPtr module, WinEventProc proc, uint pid, uint tid, uint flags);
    [DllImport("user32.dll")] static extern bool UnhookWinEvent(IntPtr hook);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr hwnd);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr hwnd, uint cmd);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder name, int max);
    [DllImport("user32.dll")] static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);
    [DllImport("user32.dll")] static extern IntPtr SetWindowLongPtr(IntPtr hwnd, int index, IntPtr value);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int w, int h, uint flags);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hwnd, int cmd);
    [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint flags);
    [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);

    [StructLayout(LayoutKind.Sequential)]
    struct Rect { public int Left, Top, Right, Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    struct MonitorInfo { public int Size; public Rect Monitor; public Rect Work; public uint Flags; }

    readonly WinEventProc _proc; // kept alive for the hook
    readonly IntPtr _hook;
    readonly HashSet<IntPtr> _done = [];
    long _until;
    uint _pid;

    public FullscreenOnLaunch()
    {
        _proc = OnForegroundChanged;
        // Out-of-context hooks call back on this (UI) thread's message loop
        _hook = SetWinEventHook(EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND, IntPtr.Zero, _proc, 0, 0, 0);
    }

    /// <summary>Call just before launching an app.</summary>
    public void Arm()
    {
        _until = Environment.TickCount64 + (long)WatchFor.TotalMilliseconds;
        _pid = 0;
        _done.Clear();
    }

    public void Disarm() => _until = 0;

    void OnForegroundChanged(IntPtr hook, uint evt, IntPtr hwnd, int idObject, int idChild, uint thread, uint time)
    {
        if (hwnd == IntPtr.Zero || idObject != 0 || Environment.TickCount64 > _until || _done.Contains(hwnd)) return;
        GetWindowThreadProcessId(hwnd, out var pid);
        if (pid == Environment.ProcessId || !IsAppWindow(hwnd)) return;
        // After the first window, only follow the same app (e.g. splash screen -> main window)
        if (_pid != 0 && pid != _pid) return;
        _pid = pid;
        _until = Environment.TickCount64 + (long)FollowUp.TotalMilliseconds;
        _done.Add(hwnd);
        _ = ApplySoonAsync(hwnd);
    }

    static async Task ApplySoonAsync(IntPtr hwnd)
    {
        await Task.Delay(700); // let the app finish laying out its window
        if (GetForegroundWindow() != hwnd || !IsWindowVisible(hwnd)) return;
        try
        {
            MakeFullscreen(hwnd);
        }
        catch (Exception ex)
        {
            Log.Warn("Could not make the app full screen", ex);
        }
    }

    static bool IsAppWindow(IntPtr hwnd)
    {
        if (!IsWindowVisible(hwnd) || GetWindow(hwnd, GW_OWNER) != IntPtr.Zero) return false;
        if ((GetWindowLongPtr(hwnd, GWL_EXSTYLE).ToInt64() & WS_EX_TOOLWINDOW) != 0) return false;
        return !IgnoredClasses.Contains(ClassName(hwnd));
    }

    static void MakeFullscreen(IntPtr hwnd)
    {
        var info = new MonitorInfo { Size = Marshal.SizeOf<MonitorInfo>() };
        if (!GetMonitorInfo(MonitorFromWindow(hwnd, 2), ref info) || !GetWindowRect(hwnd, out var window)) return;
        var screen = info.Monitor;
        if (window.Left <= screen.Left && window.Top <= screen.Top && window.Right >= screen.Right && window.Bottom >= screen.Bottom)
            return; // already full screen (games, Plex HTPC, Kodi...)

        var cls = ClassName(hwnd);
        if (cls == "ApplicationFrameWindow")
        {
            // Store apps cannot be restyled from outside; use the system full-screen shortcut
            keybd_event(VK_LWIN, 0, 0, UIntPtr.Zero);
            keybd_event(VK_SHIFT, 0, 0, UIntPtr.Zero);
            keybd_event(VK_RETURN, 0, 0, UIntPtr.Zero);
            keybd_event(VK_RETURN, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            keybd_event(VK_SHIFT, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            Log.Info("Full screen: sent Win+Shift+Enter to a Store app");
            return;
        }

        if (IsZoomed(hwnd)) ShowWindow(hwnd, SW_RESTORE);
        var style = GetWindowLongPtr(hwnd, GWL_STYLE).ToInt64() & ~(WS_CAPTION | WS_THICKFRAME);
        SetWindowLongPtr(hwnd, GWL_STYLE, new IntPtr(style));
        SetWindowPos(hwnd, IntPtr.Zero, screen.Left, screen.Top, screen.Right - screen.Left, screen.Bottom - screen.Top,
            SWP_NOZORDER | SWP_NOOWNERZORDER | SWP_FRAMECHANGED | SWP_SHOWWINDOW);
        Log.Info($"Full screen: borderless window ({cls})");
    }

    static string ClassName(IntPtr hwnd)
    {
        var name = new StringBuilder(256);
        GetClassName(hwnd, name, name.Capacity);
        return name.ToString();
    }

    public void Dispose()
    {
        if (_hook != IntPtr.Zero) UnhookWinEvent(_hook);
    }
}
