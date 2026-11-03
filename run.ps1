# Sets up Suigen's dependencies if needed, then launches it (Windows).
#
# Usage: .\run.cmd [--setup-only] [--web] [--dev]
#   --setup-only  install dependencies and the Electron binary, then exit
#   --web         run in your browser instead of the desktop app
#   --dev         open DevTools alongside the app
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$RequiredNode = [version]'22.13.0'
$mode = 'app'
$devtools = $false

foreach ($arg in $args) {
  switch ($arg) {
    '--setup-only' { $mode = 'setup' }
    '--web' { $mode = 'web' }
    '--dev' { $devtools = $true }
    { $_ -in '-h', '--help' } { Get-Content $PSCommandPath -TotalCount 6 | ForEach-Object { $_ -replace '^# ?', '' }; exit 0 }
    default { Write-Host "Unknown option: $arg (try --help)" -ForegroundColor Red; exit 1 }
  }
}

function Invoke-Checked {
  param([string]$Exe, [string[]]$ArgList)
  & $Exe @ArgList
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

# Pick up a Node install made since this terminal was opened.
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') + ';' + $env:Path

if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js $RequiredNode or newer is required but was not found." -ForegroundColor Red
  Write-Host 'Install it with:  winget install OpenJS.NodeJS.LTS   then open a new terminal.'
  exit 1
}

$found = [version]((node --version).TrimStart('v'))
if ($found -lt $RequiredNode) {
  Write-Host "Node.js $RequiredNode or newer is required (found v$found). Please upgrade:  winget upgrade OpenJS.NodeJS.LTS" -ForegroundColor Red
  exit 1
}

# Install when node_modules is missing or older than the lockfile.
$marker = 'node_modules\.package-lock.json'
if (-not (Test-Path $marker) -or (Get-Item 'package-lock.json').LastWriteTime -gt (Get-Item $marker).LastWriteTime) {
  Write-Host 'Installing dependencies...'
  Invoke-Checked 'npm.cmd' @('ci')
}

if ($mode -ne 'web') {
  # Electron downloads its binary on first use; do it now so failures surface here.
  Invoke-Checked 'node' @('-e', "require('electron')")
}

switch ($mode) {
  'setup' { Write-Host 'Setup complete. Start Suigen with .\run.cmd' }
  'web' { Invoke-Checked 'npm.cmd' @('run', 'web', '--', '--open') }
  'app' {
    if (-not $devtools) { $env:SUIGEN_NO_DEVTOOLS = '1' }
    Invoke-Checked 'npm.cmd' @('start')
  }
}
