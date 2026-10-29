using XLauncher.Apps;
using XLauncher.Auth;
using XLauncher.Config;
using XLauncher.Infrastructure;
using XLauncher.Plex;
using XLauncher.Web;

namespace XLauncher;

/// <summary>The long-lived services shared by the window and the bridge routes.</summary>
public sealed class Services : IDisposable
{
    public Services()
    {
        Settings = new SettingsStore(Paths.SettingsFile);
        Apps = new AppCatalog(Settings);
        Plex = new PlexService(Settings);
        PlexImages = new PlexImages(Plex);
        Playback = new PlexPlayback(Plex, Settings);
        Images = new ImageRouter(Apps, PlexImages, Settings);
        Icons = new IconSearch(Settings);
        Google = new GoogleSignIn(Settings);
    }

    public IconSearch Icons { get; }
    public GoogleSignIn Google { get; }

    public SettingsStore Settings { get; }
    public AppCatalog Apps { get; }
    public PlexService Plex { get; }
    public PlexImages PlexImages { get; }
    public PlexPlayback Playback { get; }
    public ImageRouter Images { get; }

    public void Dispose()
    {
        Apps.Dispose();
        Plex.Dispose();
        Icons.Dispose();
        Google.Dispose();
    }
}
