using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using XLauncher.Infrastructure;

namespace XLauncher.Shell;

/// <summary>Extracts large app icons (Win32 and Store) through IShellItemImageFactory. Call on an STA thread.</summary>
public static class ShellIcons
{
    const int SIIGBF_BIGGERSIZEOK = 0x1;
    const int SIIGBF_ICONONLY = 0x4;

    [ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IShellItemImageFactory
    {
        [PreserveSig]
        int GetImage(NativeSize size, int flags, out IntPtr phbm);
    }

    [StructLayout(LayoutKind.Sequential)]
    struct NativeSize
    {
        public int Width;
        public int Height;
    }

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    static extern void SHCreateItemFromParsingName(
        string path, IntPtr bindCtx, [MarshalAs(UnmanagedType.LPStruct)] Guid riid,
        [MarshalAs(UnmanagedType.Interface)] out IShellItemImageFactory item);

    [DllImport("gdi32.dll")]
    static extern bool DeleteObject(IntPtr hObject);

    /// <param name="parsingName">A file path or <c>shell:AppsFolder\{AUMID}</c>.</param>
    public static byte[]? GetPng(string parsingName, int size)
    {
        IShellItemImageFactory? factory = null;
        var hbmp = IntPtr.Zero;
        try
        {
            SHCreateItemFromParsingName(parsingName, IntPtr.Zero, typeof(IShellItemImageFactory).GUID, out factory);
            var hr = factory.GetImage(new NativeSize { Width = size, Height = size }, SIIGBF_BIGGERSIZEOK | SIIGBF_ICONONLY, out hbmp);
            if (hr < 0 || hbmp == IntPtr.Zero) return null;
            using var bitmap = ToArgb(hbmp);
            using var ms = new MemoryStream();
            bitmap.Save(ms, ImageFormat.Png);
            return ms.ToArray();
        }
        catch (Exception ex) when (ex is COMException or ArgumentException or ExternalException or FileNotFoundException)
        {
            Log.Debug($"No icon for {parsingName}: {ex.Message}");
            return null;
        }
        finally
        {
            if (hbmp != IntPtr.Zero) DeleteObject(hbmp);
            if (factory is not null) Marshal.ReleaseComObject(factory);
        }
    }

    // Image.FromHbitmap drops the alpha channel; re-read the 32-bit pixels as premultiplied ARGB to keep it.
    // Rows are copied one by one because bottom-up DIBs have a negative stride.
    static Bitmap ToArgb(IntPtr hbmp)
    {
        using var source = Image.FromHbitmap(hbmp);
        if (Image.GetPixelFormatSize(source.PixelFormat) != 32) return new Bitmap(source);

        var rect = new Rectangle(0, 0, source.Width, source.Height);
        var rowBytes = source.Width * 4;
        var pixels = new byte[rowBytes * source.Height];
        var data = source.LockBits(rect, ImageLockMode.ReadOnly, source.PixelFormat);
        try
        {
            for (var y = 0; y < data.Height; y++)
                Marshal.Copy(data.Scan0 + data.Stride * y, pixels, y * rowBytes, rowBytes);
        }
        finally
        {
            source.UnlockBits(data);
        }

        var hasAlpha = false;
        for (var i = 3; i < pixels.Length && !hasAlpha; i += 4) hasAlpha = pixels[i] != 0;
        if (!hasAlpha) return new Bitmap(source);

        var result = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppPArgb);
        var target = result.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppPArgb);
        try
        {
            for (var y = 0; y < target.Height; y++)
                Marshal.Copy(pixels, y * rowBytes, target.Scan0 + target.Stride * y, rowBytes);
        }
        finally
        {
            result.UnlockBits(target);
        }
        return result;
    }
}
