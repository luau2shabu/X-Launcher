# Builds a ready-to-copy X Launcher folder in dist\XLauncher.
#   .\publish.ps1                 framework-dependent (needs the .NET 10 Desktop Runtime, ~6 MB)
#   .\publish.ps1 -SelfContained  includes the .NET runtime (~150 MB, runs on any Windows 10/11 x64)
param([switch]$SelfContained)

$ErrorActionPreference = 'Stop'
$out = Join-Path $PSScriptRoot 'dist\XLauncher'
if (Test-Path $out) { Remove-Item $out -Recurse -Force }

dotnet test (Join-Path $PSScriptRoot 'XLauncher.slnx') -nologo -v q
if ($LASTEXITCODE -ne 0) { throw 'Tests failed; not publishing.' }

dotnet publish (Join-Path $PSScriptRoot 'src\XLauncher\XLauncher.csproj') -nologo -c Release -r win-x64 `
    --self-contained:$($SelfContained.IsPresent) -p:DebugType=none -o $out
if ($LASTEXITCODE -ne 0) { throw 'Publish failed.' }

Write-Host "X Launcher published to $out"
