# Draws the X Launcher icon (Angstrom X bar mark on a dark rounded tile) and writes:
#   src/XLauncher/Assets/xlauncher.ico   multi-size Windows icon (16-256 px, PNG entries)
#   ui/img/xlauncher-icon.png            256 px PNG for the UI
# Run from anywhere: pwsh tools/make-icon.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent

# Bar layout from the Angstrom X logo, in a 106 x 80 box: x, y, height (width 10, fully rounded)
$bars = @(@(3, 11, 62), @(33, 3, 56), @(63, 14, 62), @(93, 3, 58))
$top = [System.Drawing.ColorTranslator]::FromHtml('#3BA3CC')
$bottom = [System.Drawing.ColorTranslator]::FromHtml('#1F6F97')
$tile = [System.Drawing.ColorTranslator]::FromHtml('#1E1F24')

function New-IconPng([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.Clear([System.Drawing.Color]::Transparent)

    # Rounded tile
    $r = $size * 0.22
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, 2 * $r, 2 * $r, 180, 90)
    $path.AddArc($size - 2 * $r - 1, 0, 2 * $r, 2 * $r, 270, 90)
    $path.AddArc($size - 2 * $r - 1, $size - 2 * $r - 1, 2 * $r, 2 * $r, 0, 90)
    $path.AddArc(0, $size - 2 * $r - 1, 2 * $r, 2 * $r, 90, 90)
    $path.CloseFigure()
    $g.FillPath((New-Object System.Drawing.SolidBrush $tile), $path)

    # Bars, scaled into the middle of the tile
    $scale = ($size * 0.66) / 106
    $offX = ($size - 106 * $scale) / 2
    $offY = ($size - 80 * $scale) / 2
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.PointF 0, $offY), (New-Object System.Drawing.PointF 0, ($offY + 80 * $scale)), $top, $bottom
    foreach ($b in $bars) {
        $w = [Math]::Max(1.5, 10 * $scale)
        $x = $offX + $b[0] * $scale
        $y = $offY + $b[1] * $scale
        $h = $b[2] * $scale
        $bar = New-Object System.Drawing.Drawing2D.GraphicsPath
        $bar.AddArc($x, $y, $w, $w, 180, 180)
        $bar.AddArc($x, $y + $h - $w, $w, $w, 0, 180)
        $bar.CloseFigure()
        $g.FillPath($brush, $bar)
    }
    $g.Dispose()
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    return , $ms.ToArray()
}

$sizes = 16, 24, 32, 48, 64, 128, 256
$pngs = $sizes | ForEach-Object { , (New-IconPng $_) }

# ICO container: header, one directory entry per size, then the PNG payloads
$ico = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter $ico
$w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $s = $sizes[$i]
    $w.Write([byte]($(if ($s -ge 256) { 0 } else { $s }))); $w.Write([byte]($(if ($s -ge 256) { 0 } else { $s })))
    $w.Write([byte]0); $w.Write([byte]0); $w.Write([UInt16]1); $w.Write([UInt16]32)
    $w.Write([UInt32]$pngs[$i].Length); $w.Write([UInt32]$offset)
    $offset += $pngs[$i].Length
}
foreach ($p in $pngs) { $w.Write($p) }
$w.Flush()

$icoPath = Join-Path $root 'src\XLauncher\Assets\xlauncher.ico'
$pngPath = Join-Path $root 'ui\img\xlauncher-icon.png'
New-Item -ItemType Directory -Force (Split-Path $icoPath), (Split-Path $pngPath) | Out-Null
[IO.File]::WriteAllBytes($icoPath, $ico.ToArray())
[IO.File]::WriteAllBytes($pngPath, $pngs[-1])
Write-Host "Wrote $icoPath and $pngPath"
