param(
    [int]$Port = 7823
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

try {
    $candidates = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
        Where-Object { $_.CommandLine -like '*@kz-rebuild*' -or $_.CommandLine -like '*vite*' }
    foreach ($c in $candidates) {
        Stop-Process -Id $c.ProcessId -Force -ErrorAction SilentlyContinue
    }
} catch {
}

Write-Output "Starting dev servers at http://localhost:$Port (web) and http://localhost:4932 (api) ..."
Set-Location $root
npm run dev
