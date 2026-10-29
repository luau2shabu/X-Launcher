using System.Runtime.InteropServices;
using XLauncher.Infrastructure;

namespace XLauncher.Input;

/// <summary>
/// Polls XInput controllers and turns them into the same key names the UI uses for the keyboard.
/// The Guide button acts as Home from anywhere; everything else only while XLauncher is in front.
/// </summary>
public sealed class Gamepad : IDisposable
{
    const int RepeatDelayMs = 420;
    const int RepeatIntervalMs = 110;
    const short StickThreshold = 16000;

    const ushort DpadUp = 0x0001, DpadDown = 0x0002, DpadLeft = 0x0004, DpadRight = 0x0008;
    const ushort StartButton = 0x0010, BackButton = 0x0020, Guide = 0x0400;
    const ushort ButtonA = 0x1000, ButtonB = 0x2000, ButtonX = 0x4000, ButtonY = 0x8000;

    [StructLayout(LayoutKind.Sequential)]
    struct XInputGamepad
    {
        public ushort Buttons;
        public byte LeftTrigger;
        public byte RightTrigger;
        public short ThumbLX;
        public short ThumbLY;
        public short ThumbRX;
        public short ThumbRY;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct XInputState
    {
        public uint PacketNumber;
        public XInputGamepad Gamepad;
    }

    // Ordinal 100 is XInputGetStateEx, the only variant that reports the Guide button
    [DllImport("xinput1_4.dll", EntryPoint = "#100")]
    static extern int XInputGetStateEx(int userIndex, out XInputState state);

    readonly System.Windows.Forms.Timer _timer = new() { Interval = 16 };
    readonly Func<bool> _isActive;
    readonly Action<string> _onKey;
    readonly Action _onHome;
    ushort _previous;
    string? _heldKey;
    long _nextRepeat;
    int _controller = -1;
    int _scanCountdown;

    public Gamepad(Func<bool> isActive, Action<string> onKey, Action onHome)
    {
        _isActive = isActive;
        _onKey = onKey;
        _onHome = onHome;
        _timer.Tick += (_, _) => Poll();
    }

    public void Start() => _timer.Start();

    void Poll()
    {
        XInputState state;
        try
        {
            if (_controller < 0)
            {
                // Looking for a controller is slow when none is connected; do it twice a second
                if (--_scanCountdown > 0) return;
                _scanCountdown = 30;
                for (var i = 0; i < 4 && _controller < 0; i++)
                    if (XInputGetStateEx(i, out _) == 0) _controller = i;
                if (_controller < 0) return;
            }
            if (XInputGetStateEx(_controller, out state) != 0)
            {
                _controller = -1;
                return;
            }
        }
        catch (Exception ex) when (ex is DllNotFoundException or EntryPointNotFoundException)
        {
            Log.Warn("XInput unavailable; gamepad support disabled", ex);
            _timer.Stop();
            return;
        }

        var pad = state.Gamepad;
        var buttons = pad.Buttons;
        if (pad.ThumbLY > StickThreshold) buttons |= DpadUp;
        if (pad.ThumbLY < -StickThreshold) buttons |= DpadDown;
        if (pad.ThumbLX < -StickThreshold) buttons |= DpadLeft;
        if (pad.ThumbLX > StickThreshold) buttons |= DpadRight;

        var pressed = (ushort)(buttons & ~_previous);
        _previous = buttons;

        if ((pressed & Guide) != 0)
        {
            _onHome();
            return;
        }
        if (!_isActive()) return;

        if ((pressed & ButtonA) != 0) _onKey("Enter");
        if ((pressed & ButtonB) != 0 || (pressed & BackButton) != 0) _onKey("Back");
        if ((pressed & ButtonX) != 0) _onKey("Menu");
        if ((pressed & ButtonY) != 0) _onKey("Search");
        if ((pressed & StartButton) != 0) _onKey("Settings");

        // Directions auto-repeat while held
        var direction = (buttons & DpadUp) != 0 ? "ArrowUp"
            : (buttons & DpadDown) != 0 ? "ArrowDown"
            : (buttons & DpadLeft) != 0 ? "ArrowLeft"
            : (buttons & DpadRight) != 0 ? "ArrowRight"
            : null;
        var now = Environment.TickCount64;
        if (direction is null)
        {
            _heldKey = null;
        }
        else if (direction != _heldKey)
        {
            _heldKey = direction;
            _nextRepeat = now + RepeatDelayMs;
            _onKey(direction);
        }
        else if (now >= _nextRepeat)
        {
            _nextRepeat = now + RepeatIntervalMs;
            _onKey(direction);
        }
    }

    public void Dispose() => _timer.Dispose();
}
