param(
  [string]$SearxngUrl = "http://127.0.0.1:8080",
  [int]$Port = 8787
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== MAINLAND MYTHOS / BIFROST RELAY ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js was not found in PATH."
}

try {
  $null = Invoke-WebRequest -Uri $SearxngUrl -UseBasicParsing -TimeoutSec 5
  Write-Host "SearXNG reachable: $SearxngUrl" -ForegroundColor Green
} catch {
  Write-Warning "SearXNG did not answer at $SearxngUrl. The relay can still start, but searches will fail until SearXNG is online."
}

if (-not $env:BIFROST_RELAY_TOKEN -or $env:BIFROST_RELAY_TOKEN.Length -lt 24) {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  $token = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
  $env:BIFROST_RELAY_TOKEN = $token
  $token | Set-Clipboard
  Write-Host "A fresh relay token was generated and copied to your clipboard." -ForegroundColor Yellow
  Write-Host "It was NOT printed to the terminal." -ForegroundColor DarkGray
} else {
  Write-Host "Using BIFROST_RELAY_TOKEN already present in this PowerShell session." -ForegroundColor Green
}

$env:SEARXNG_URL = $SearxngUrl
$env:BIFROST_RELAY_PORT = "$Port"
$env:BIFROST_RELAY_HOST = "127.0.0.1"

Write-Host ""
Write-Host "Relay will bind only to 127.0.0.1:$Port" -ForegroundColor Cyan
Write-Host "Direct SearXNG port remains private." -ForegroundColor Cyan
Write-Host ""
Write-Host "KEEP THIS WINDOW OPEN." -ForegroundColor Yellow
Write-Host "Open a second PowerShell and run: .\scripts\start-bifrost-tunnel.ps1" -ForegroundColor Yellow
Write-Host ""

node .\scripts\bifrost-relay.mjs
