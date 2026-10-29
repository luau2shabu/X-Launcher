# Renders README screenshots of the UI with mock data (no personal Plex library or account photo)
# using headless Microsoft Edge at 1920x1080. Serve ui/ first, e.g.:
#   python -m http.server 5179 --directory ui
#   pwsh tools/capture-screenshots.ps1
param([string]$BaseUrl = 'http://127.0.0.1:5179/index.html', [string[]]$States = @('home', 'apps', 'details', 'search', 'menu', 'profiles', 'kids', 'parental'))
$ErrorActionPreference = 'Stop'

$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
    Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge not found' }

$out = Join-Path (Split-Path $PSScriptRoot -Parent) 'docs\screenshots'
New-Item -ItemType Directory -Force $out | Out-Null

foreach ($state in $States) {
    $file = Join-Path $out "$state.png"
    # A fresh profile per shot keeps the mock settings (localStorage) at their defaults
    $profile = Join-Path $env:TEMP "xl-shot-$state"
    Remove-Item $profile -Recurse -Force -ErrorAction SilentlyContinue
    & $edge --headless=new --disable-gpu --hide-scrollbars --mute-audio --no-first-run "--user-data-dir=$profile" `
        --window-size=1920,1080 --virtual-time-budget=9000 "--screenshot=$file" "$($BaseUrl)?mock=1&demo=$state" 2>$null | Out-Null
    Remove-Item $profile -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $file) { Write-Host ("{0,-10} {1,8:N0} bytes" -f $state, (Get-Item $file).Length) } else { Write-Warning "$state failed" }
}
