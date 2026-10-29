using System.Runtime.InteropServices;
using XLauncher.Infrastructure;
using XLauncher.Shell;

namespace XLauncher.Input;

/// <summary>
/// Global low-level keyboard hook so the remote's Home key reaches XLauncher even while another app is in front.
/// The callback returns true to swallow the key.
/// </summary>
public sealed class KeyboardHook : IDisposable
{
    readonly NativeMethods.LowLevelKeyboardProc _proc; // kept in a field so the GC never collects the delegate
    readonly Func<int, bool> _onKeyDown;
    IntPtr _hook;

    public KeyboardHook(Func<int, bool> onKeyDown)
    {
        _onKeyDown = onKeyDown;
        _proc = Callback;
        _hook = NativeMethods.SetWindowsHookEx(NativeMethods.WH_KEYBOARD_LL, _proc, NativeMethods.GetModuleHandle(null), 0);
        if (_hook == IntPtr.Zero)
            Log.Warn($"Keyboard hook failed (error {Marshal.GetLastWin32Error()}); the Home key only works while X Launcher is in front");
    }

    IntPtr Callback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0 && (wParam == NativeMethods.WM_KEYDOWN || wParam == NativeMethods.WM_SYSKEYDOWN))
        {
            var vk = Marshal.ReadInt32(lParam);
            try
            {
                if (_onKeyDown(vk)) return 1;
            }
            catch (Exception ex)
            {
                Log.Error("Keyboard hook handler failed", ex);
            }
        }
        return NativeMethods.CallNextHookEx(_hook, nCode, wParam, lParam);
    }

    public void Dispose()
    {
        if (_hook == IntPtr.Zero) return;
        NativeMethods.UnhookWindowsHookEx(_hook);
        _hook = IntPtr.Zero;
    }
}
