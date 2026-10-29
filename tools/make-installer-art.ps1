# Draws the setup wizard images in the Angstrom X style (charcoal, teal bar mark, Poppins wordmark):
#   installer/wizard-large-*.bmp   side banner on the Welcome/Finish pages (100/150/200 % DPI)
#   installer/wizard-small-*.bmp   top-right image on the inner pages
# Run from anywhere: pwsh tools/make-installer-art.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root 'installer'
New-Item -ItemType Directory -Force $out | Out-Null

$fonts = New-Object System.Drawing.Text.PrivateFontCollection
$fonts.AddFontFile((Join-Path $root 'ui\fonts\Poppins-Light.ttf'))
$poppins = $fonts.Families[0]

$bars = @(@(3, 11, 62), @(33, 3, 56), @(63, 14, 62), @(93, 3, 58))   # x, y, height in a 106 x 80 box
$top = [System.Drawing.ColorTranslator]::FromHtml('#3BA3CC')
$bottom = [System.Drawing.ColorTranslator]::FromHtml('#1F6F97')

function Draw-Mark($g, [float]$x0, [float]$y0, [float]$width) {
    $scale = $width / 106
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.PointF 0, $y0), (New-Object System.Drawing.PointF 0, ($y0 + 80 * $scale + 1)), $top, $bottom
    foreach ($b in $bars) {
        $w = 10 * $scale; $x = $x0 + $b[0] * $scale; $y = $y0 + $b[1] * $scale; $h = $b[2] * $scale
        $p = New-Object System.Drawing.Drawing2D.GraphicsPath
        $p.AddArc($x, $y, $w, $w, 180, 180); $p.AddArc($x, $y + $h - $w, $w, $w, 0, 180); $p.CloseFigure()
        $g.FillPath($brush, $p)
    }
}

function Save-Bmp($bmp, $name) {
    # Wizard images must be 24-bit BMPs
    $flat = New-Object System.Drawing.Bitmap $bmp.Width, $bmp.Height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($flat); $g.DrawImage($bmp, 0, 0, $bmp.Width, $bmp.Height); $g.Dispose()
    $flat.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Bmp); $flat.Dispose()
}

foreach ($k in @(@(1.0, '100'), @(1.5, '150'), @(2.0, '200'))) {
    $s = $k[0]; $tag = $k[1]

    # Large: charcoal with a soft teal glow, mark and stacked wordmark
    $w = [int](164 * $s); $h = [int](314 * $s)
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp); $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'
    $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#1A1B1F'))
    $glow = New-Object System.Drawing.Drawing2D.GraphicsPath
    $glow.AddEllipse(-0.6 * $w, 0.05 * $h, 2.2 * $w, 0.75 * $h)
    $pgb = New-Object System.Drawing.Drawing2D.PathGradientBrush $glow
    $pgb.CenterColor = [System.Drawing.ColorTranslator]::FromHtml('#23465A'); $pgb.SurroundColors = @([System.Drawing.ColorTranslator]::FromHtml('#1A1B1F'))
    $g.FillPath($pgb, $glow)
    Draw-Mark $g (($w - 84 * $s) / 2) (92 * $s) (84 * $s)
    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(236, 236, 238))
    $grey = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150, 152, 160))
    $center = New-Object System.Drawing.StringFormat; $center.Alignment = 'Center'
    $g.DrawString('X  L A U N C H E R', (New-Object System.Drawing.Font $poppins, (12.5 * $s), ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)), $white, (New-Object System.Drawing.RectangleF 0, (176 * $s), $w, (30 * $s)), $center)
    $g.DrawString('by  A N G S T R O M  X', (New-Object System.Drawing.Font $poppins, (8 * $s), ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)), $grey, (New-Object System.Drawing.RectangleF 0, (282 * $s), $w, (20 * $s)), $center)
    $g.Dispose(); Save-Bmp $bmp "wizard-large-$tag.bmp"; $bmp.Dispose()

    # Small: the app icon tile
    $n = [int](55 * $s)
    $bmp = New-Object System.Drawing.Bitmap $n, $n
    $g = [System.Drawing.Graphics]::FromImage($bmp); $g.SmoothingMode = 'AntiAlias'
    $g.Clear([System.Drawing.Color]::White)
    $r = $n * 0.22
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddArc(0, 0, 2 * $r, 2 * $r, 180, 90); $p.AddArc($n - 2 * $r - 1, 0, 2 * $r, 2 * $r, 270, 90)
    $p.AddArc($n - 2 * $r - 1, $n - 2 * $r - 1, 2 * $r, 2 * $r, 0, 90); $p.AddArc(0, $n - 2 * $r - 1, 2 * $r, 2 * $r, 90, 90); $p.CloseFigure()
    $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#1E1F24'))), $p)
    Draw-Mark $g ($n * 0.17) ($n * 0.25) ($n * 0.66)
    $g.Dispose(); Save-Bmp $bmp "wizard-small-$tag.bmp"; $bmp.Dispose()
}
Write-Host "Wizard images written to $out"
