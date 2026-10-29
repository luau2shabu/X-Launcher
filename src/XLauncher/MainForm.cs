using System.Runtime.InteropServices;
using XLauncher.Bridge;
using XLauncher.Infrastructure;
using XLauncher.Input;
using XLauncher.Plex;
using XLauncher.Shell;
using XLauncher.Web;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace XLauncher;

/// <summary>Borderless full-screen window hosting the web UI in WebView2.</summary>
public sealed class MainForm : Form, IHostWindow
{
    public const string WindowTitle = "X Launcher";
    const string UiHost = "ui.xlauncher.local";
    static readonly Color Background = Color.FromArgb(18, 19, 22);

    readonly LaunchOptions _options;
    readonly Services _svc;
    readonly BridgeHost _bridge = new();
    readonly WebView2 _web = new() { Dock = DockStyle.Fill, DefaultBackgroundColor = Background };
    KeyboardHook? _hook;
    Gamepad? _gamepad;

    public MainForm(LaunchOptions options, Services services)
    {
        _options = options;
        _svc = services;
        Text = WindowTitle;
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        BackColor = Background;
        if (options.Windowed)
        {
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(1600, 900);
        }
        else
        {
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.Manual;
            var screens = Screen.AllScreens;
            Bounds = (options.Monitor < screens.Length ? screens[options.Monitor] : Screen.PrimaryScreen!).Bounds;
        }
        Controls.Add(_web);

        _bridge.Outgoing += Post;
        Routes.Register(_bridge, _svc, this);
        Activated += (_, _) =>
        {
            _web.Focus();
            _bridge.Emit("focus", true);
        };
        Deactivate += (_, _) => _bridge.Emit("focus", false);
    }

    protected override async void OnLoad(EventArgs e)
    {
        base.OnLoad(e);
        try
        {
            await InitWebViewAsync();
        }
        catch (Exception ex) when (ex is WebView2RuntimeNotFoundException or COMException or DirectoryNotFoundException)
        {
            Log.Error("WebView2 failed to start", ex);
            MessageBox.Show(this, $"X Launcher could not start its display engine (Microsoft Edge WebView2).\n\n{ex.Message}", WindowTitle,
                MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
            return;
        }

        _hook = new KeyboardHook(OnGlobalKeyDown);
        if (_svc.Settings.Current.Input.GamepadEnabled)
        {
            _gamepad = new Gamepad(() => ActiveForm == this, key => _bridge.Emit("key", key), GoHome);
            _gamepad.Start();
        }
        _ = Task.Run(PlexImages.TrimCache);
    }

    async Task InitWebViewAsync()
    {
        if (!Directory.Exists(_options.UiDir)) throw new DirectoryNotFoundException($"UI folder not found: {_options.UiDir}");

        var environment = await CoreWebView2Environment.CreateAsync(null, Paths.WebViewData,
            new CoreWebView2EnvironmentOptions("--autoplay-policy=no-user-gesture-required"));
        await _web.EnsureCoreWebView2Async(environment);
        var core = _web.CoreWebView2;

        var s = core.Settings;
        s.AreDevToolsEnabled = _options.Debug;
        s.AreDefaultContextMenusEnabled = _options.Debug;
        s.AreBrowserAcceleratorKeysEnabled = _options.Debug;
        s.IsZoomControlEnabled = false;
        s.IsPinchZoomEnabled = false;
        s.IsSwipeNavigationEnabled = false;
        s.IsStatusBarEnabled = false;
        s.IsGeneralAutofillEnabled = false;
        s.IsPasswordAutosaveEnabled = false;

        core.SetVirtualHostNameToFolderMapping(UiHost, _options.UiDir, CoreWebView2HostResourceAccessKind.Allow);
        core.AddWebResourceRequestedFilter($"https://{ImageRouter.Host}/*", CoreWebView2WebResourceContext.All);
        core.WebResourceRequested += OnWebResourceRequested;
        core.WebMessageReceived += OnWebMessageReceived;
        core.NavigationStarting += (_, a) =>
        {
            if (a.Uri.StartsWith($"https://{UiHost}/", StringComparison.OrdinalIgnoreCase)) return;
            a.Cancel = true;
            Log.Warn($"Blocked navigation to {a.Uri}");
        };
        core.NewWindowRequested += (_, a) => a.Handled = true;
        core.ProcessFailed += (_, a) =>
        {
            Log.Error($"WebView2 process failed: {a.ProcessFailedKind}");
            if (a.ProcessFailedKind is CoreWebView2ProcessFailedKind.RenderProcessExited or CoreWebView2ProcessFailedKind.RenderProcessUnresponsive)
                core.Reload();
        };
        core.Navigate($"https://{UiHost}/index.html{(_options.Debug ? "?debug=1" : "")}");
    }

    async void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (!e.Source.StartsWith($"https://{UiHost}/", StringComparison.OrdinalIgnoreCase)) return;
        var response = await _bridge.DispatchAsync(e.WebMessageAsJson);
        if (response is not null) _web.CoreWebView2?.PostWebMessageAsJson(response);
    }

    async void OnWebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
    {
        var deferral = e.GetDeferral();
        var environment = _web.CoreWebView2.Environment;
        try
        {
            var (data, mime) = await _svc.Images.ResolveAsync(new Uri(e.Request.Uri));
            e.Response = data is null
                ? environment.CreateWebResourceResponse(null, 404, "Not Found", "Access-Control-Allow-Origin: *")
                : environment.CreateWebResourceResponse(new MemoryStream(data), 200, "OK",
                    $"Content-Type: {mime}\r\nAccess-Control-Allow-Origin: *\r\nCache-Control: max-age=604800");
        }
        catch (Exception ex)
        {
            Log.Warn($"Image request failed: {e.Request.Uri}", ex);
            e.Response = environment.CreateWebResourceResponse(null, 502, "Bad Gateway", "Access-Control-Allow-Origin: *");
        }
        finally
        {
            deferral.Complete();
        }
    }

    bool OnGlobalKeyDown(int virtualKey)
    {
        if (!_svc.Settings.Current.Input.HomeKeys.Contains(virtualKey)) return false;
        BeginInvoke(GoHome);
        return true;
    }

    /// <summary>Home button: bring XLauncher in front of whatever app is running and return to the For you tab.</summary>
    public void GoHome()
    {
        if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
        NativeMethods.ForceForeground(Handle);
        _web.Focus();
        _bridge.Emit("home");
    }

    void Post(string json)
    {
        if (IsDisposed) return;
        if (InvokeRequired)
        {
            BeginInvoke(() => Post(json));
            return;
        }
        _web.CoreWebView2?.PostWebMessageAsJson(json);
    }

    public string? PickProgram()
    {
        using var dialog = new OpenFileDialog
        {
            Title = "Add a program to X Launcher",
            Filter = "Programs (*.exe;*.lnk;*.bat;*.cmd)|*.exe;*.lnk;*.bat;*.cmd|All files (*.*)|*.*",
            InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
        };
        return dialog.ShowDialog(this) == DialogResult.OK ? dialog.FileName : null;
    }

    public string? PickFolder()
    {
        using var dialog = new FolderBrowserDialog
        {
            Description = "Choose a photo folder for ambient mode",
            UseDescriptionForTitle = true,
            InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyPictures),
        };
        return dialog.ShowDialog(this) == DialogResult.OK ? dialog.SelectedPath : null;
    }

    public void Quit() => BeginInvoke(Close);

    public void OnUiReady()
    {
        if (_options.ScreenshotPath is { } path) _ = CaptureScreenshotAsync(path);
    }

    // Give images a moment to load, then save what the WebView shows
    async Task CaptureScreenshotAsync(string path)
    {
        await Task.Delay(TimeSpan.FromSeconds(5));
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            await using var file = File.Create(path);
            await _web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, file);
            Log.Info($"Screenshot saved to {path}");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or COMException)
        {
            Log.Warn("Screenshot failed", ex);
        }
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        _hook?.Dispose();
        _gamepad?.Dispose();
        base.OnFormClosed(e);
    }
}
