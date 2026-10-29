using XLauncher.Apps;
using XLauncher.Config;
using XLauncher.Infrastructure;
using XLauncher.Plex;
using XLauncher.SystemOps;
using XLauncher.Web;

namespace XLauncher;

/// <summary>The long-lived services shared by the window and the bridge routes.</summary>
public sealed class Services : IDisposable
{
    public Services()
    {
        Settings = new SettingsStore(Paths.SettingsFile);
        Pin = new PinStore(Paths.PinFile);
        Kids = new KidsGuard(Settings);
        Apps = new AppCatalog(Settings);
        Plex = new PlexService(Settings, Kids);
        PlexImages = new PlexImages(Plex);
        Playback = new PlexPlayback(Plex, Settings);
        Images = new ImageRouter(Apps, PlexImages, Settings);
        Icons = new IconSearch(Settings);
        SyncAdminWithWindows();
    }

    public SettingsStore Settings { get; }
    public PinStore Pin { get; }
    public KidsGuard Kids { get; }
    public AppCatalog Apps { get; }
    public PlexService Plex { get; }
    public PlexImages PlexImages { get; }
    public PlexPlayback Playback { get; }
    public ImageRouter Images { get; }
    public IconSearch Icons { get; }

    /// <summary>The admin profile is the Windows user: refresh its name and photo on every start.</summary>
    void SyncAdminWithWindows()
    {
        var name = WindowsAccount.DisplayName();
        var picture = WindowsAccount.PublishPicture(Settings.Current.AdminProfile.Id);
        Settings.Update(s =>
        {
            s.AdminProfile.Name = name;
            s.AdminProfile.Picture = picture;
        });
    }

    public void Dispose()
    {
        Apps.Dispose();
        Plex.Dispose();
        Icons.Dispose();
    }
}
