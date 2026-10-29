# Builds the X Launcher setup wizard: dist\XLauncher-Setup-<version>.exe
# Publishes a self-contained build (no .NET install needed on the target PC), then compiles installer\XLauncher.iss.
# Requires Inno Setup 6.5+ (winget install JRSoftware.InnoSetup).
$ErrorActionPreference = 'Stop'

$version = ([xml](Get-Content (Join-Path $PSScriptRoot 'src\XLauncher\XLauncher.csproj'))).Project.PropertyGroup.Version | Where-Object { $_ } | Select-Object -First 1
$iscc = @(
    (Get-Command iscc -ErrorAction SilentlyContinue).Source,
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $iscc) { throw 'Inno Setup 6 not found. Install it with: winget install JRSoftware.InnoSetup' }

& (Join-Path $PSScriptRoot 'publish.ps1') -SelfContained

if (-not (Test-Path (Join-Path $PSScriptRoot 'installer\wizard-large-100.bmp'))) {
    & (Join-Path $PSScriptRoot 'tools\make-installer-art.ps1')
}

& $iscc /Q "/DAppVersion=$version" (Join-Path $PSScriptRoot 'installer\XLauncher.iss')
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup compile failed.' }

$setup = Join-Path $PSScriptRoot "dist\XLauncher-Setup-$version.exe"
Write-Host ("Setup built: {0} ({1:N1} MB)" -f $setup, ((Get-Item $setup).Length / 1MB))
