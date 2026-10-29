using System.Runtime.InteropServices;
using System.Security.Principal;
using Microsoft.Win32;
using XLauncher.Infrastructure;

namespace XLauncher.SystemOps;

/// <summary>The signed-in Windows user's display name and account picture, used for the admin profile.</summary>
public static class WindowsAccount
{
    [DllImport("netapi32.dll", CharSet = CharSet.Unicode)]
    static extern int NetUserGetInfo(string? server, string user, int level, out IntPtr buffer);

    [DllImport("netapi32.dll")]
    static extern int NetApiBufferFree(IntPtr buffer);

    [DllImport("secur32.dll", CharSet = CharSet.Unicode)]
    static extern bool GetUserNameEx(int format, char[] name, ref int size);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct UserInfo10
    {
        public string Name;
        public string Comment;
        public string UserComment;
        public string FullName;
    }

    const int NameDisplay = 3;

    public static string DisplayName()
    {
        // Local and Microsoft-account users: the account's full name
        try
        {
            if (NetUserGetInfo(null, Environment.UserName, 10, out var buffer) == 0)
            {
                try
                {
                    var info = Marshal.PtrToStructure<UserInfo10>(buffer);
                    if (!string.IsNullOrWhiteSpace(info.FullName)) return info.FullName.Trim();
                }
                finally
                {
                    NetApiBufferFree(buffer);
                }
            }
        }
        catch (Exception ex) when (ex is DllNotFoundException or EntryPointNotFoundException) { }

        // Domain users
        var size = 256;
        var chars = new char[size];
        if (GetUserNameEx(NameDisplay, chars, ref size) && size > 0) return new string(chars, 0, size).Trim();
        return Environment.UserName;
    }

    /// <summary>Path of the largest account picture Windows keeps for this user, or null.</summary>
    public static string? PicturePath()
    {
        var sid = WindowsIdentity.GetCurrent().User?.Value;
        if (sid is null) return null;
        using var key = Registry.LocalMachine.OpenSubKey($@"SOFTWARE\Microsoft\Windows\CurrentVersion\AccountPicture\Users\{sid}");
        foreach (var size in new[] { 448, 424, 240, 208, 192, 96 })
            if (key?.GetValue($"Image{size}") is string path && File.Exists(path)) return path;
        return null;
    }

    /// <summary>Copies the account picture into the avatar folder and returns its URL for the UI.</summary>
    public static string? PublishPicture(string profileId)
    {
        try
        {
            if (PicturePath() is not { } source) return null;
            Directory.CreateDirectory(Paths.Avatars);
            var file = $"{profileId}{Path.GetExtension(source).ToLowerInvariant()}";
            var target = Path.Combine(Paths.Avatars, file);
            File.Copy(source, target, overwrite: true);
            return $"https://img.xlauncher.local/avatar/{file}?v={File.GetLastWriteTimeUtc(source).Ticks}";
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            Log.Warn("Could not read the Windows account picture", ex);
            return null;
        }
    }
}
