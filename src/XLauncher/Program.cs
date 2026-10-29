using XLauncher.Infrastructure;
using XLauncher.Shell;

namespace XLauncher;

static class Program
{
    [STAThread]
    static int Main(string[] args)
    {
        using var mutex = new Mutex(true, @"Local\XLauncher.SingleInstance", out var firstInstance);
        if (!firstInstance)
        {
            // Starting XLauncher again (e.g. from a remote's shortcut) just brings the running one forward
            NativeMethods.ForceForeground(NativeMethods.FindWindow(null, MainForm.WindowTitle));
            return 0;
        }

        var options = LaunchOptions.Parse(args);
        Log.Init(Paths.LogFile, options.Debug);
        Log.Info($"X Launcher starting (ui: {options.UiDir}, debug: {options.Debug})");

        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.ThreadException += (_, e) => Log.Error("Unhandled UI exception", e.Exception);
        AppDomain.CurrentDomain.UnhandledException += (_, e) => Log.Error("Unhandled exception", e.ExceptionObject as Exception);
        TaskScheduler.UnobservedTaskException += (_, e) =>
        {
            Log.Error("Unobserved task exception", e.Exception);
            e.SetObserved();
        };

        using var services = new Services();
        Application.Run(new MainForm(options, services));
        Log.Info("X Launcher exited");
        return 0;
    }
}
