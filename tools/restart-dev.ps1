param(
    [int]$Port = 5173
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

try {
    $candidates = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
        Where-Object { $_.CommandLine -like '*server/dev-server.js*' }
    foreach ($c in $candidates) {
        Stop-Process -Id $c.ProcessId -Force -ErrorAction SilentlyContinue
    }
} catch {
}

Write-Output "Restarting dev server at http://localhost:$Port ..."
Set-Location $root
npm run dev
