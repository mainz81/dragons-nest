param(
  [string]$SearxngUrl = "http://127.0.0.1:8080",
  [int]$Port = 8787
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "=== MAINLAND MYTHOS / BIFROST RELAY IV-E5A ===" -ForegroundColor Cyan
Write-Host "Local Huginn -> authenticated relay -> secure tunnel -> Vercel BIFROST" -ForegroundColor DarkCyan
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js was not found in PATH."
}

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  Write-Host "cloudflared is not installed yet." -ForegroundColor Yellow
  Write-Host "Install it with:" -ForegroundColor Yellow
  Write-Host "winget install --id Cloudflare.cloudflared" -ForegroundColor Cyan
  Write-Host "Then reopen PowerShell and run this script again." -ForegroundColor Yellow
  exit 1
}

try {
  $null = Invoke-WebRequest -Uri $SearxngUrl -UseBasicParsing -TimeoutSec 5
  Write-Host "PASS - Huginn/SearXNG reachable at $SearxngUrl" -ForegroundColor Green
} catch {
  throw "SearXNG is not reachable at $SearxngUrl. Start the existing MAINLAND MYTHOS SearXNG service first."
}

$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$token = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
$env:BIFROST_RELAY_TOKEN = $token
$env:SEARXNG_URL = $SearxngUrl
$env:BIFROST_RELAY_PORT = "$Port"
$env:BIFROST_RELAY_HOST = "127.0.0.1"

$token | Set-Clipboard
Write-Host "PASS - Fresh relay bearer token generated." -ForegroundColor Green
Write-Host "PASS - Token copied to clipboard and NOT printed." -ForegroundColor Green

$relayScript = Join-Path $PSScriptRoot "bifrost-relay.mjs"
if (-not (Test-Path $relayScript)) {
  throw "Relay script not found: $relayScript"
}

$relayCommand = "Set-Location '$repoRoot'; node '.\scripts\bifrost-relay.mjs'"
$relayProcess = Start-Process powershell.exe -ArgumentList @(
  "-NoExit",
  "-Command",
  $relayCommand
) -PassThru

Write-Host "Starting local relay in a separate PowerShell window..." -ForegroundColor Cyan
$healthy = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2
    if ($health.ok) {
      $healthy = $true
      break
    }
  } catch {}
}

if (-not $healthy) {
  try { Stop-Process -Id $relayProcess.Id -Force -ErrorAction SilentlyContinue } catch {}
  throw "The local BIFROST Relay did not become healthy on 127.0.0.1:$Port."
}

Write-Host "PASS - BIFROST Relay healthy on 127.0.0.1:$Port" -ForegroundColor Green
Write-Host "PASS - Direct SearXNG port remains private." -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT ORDER:" -ForegroundColor Yellow
Write-Host "1. In Vercel -> dragons-nest -> Settings -> Environment Variables," -ForegroundColor Yellow
Write-Host "   create BIFROST_RELAY_TOKEN and PASTE NOW from the clipboard." -ForegroundColor Yellow
Write-Host "2. Then copy the https://*.trycloudflare.com URL printed below and save it" -ForegroundColor Yellow
Write-Host "   in Vercel as BIFROST_RELAY_URL." -ForegroundColor Yellow
Write-Host "3. Redeploy Production." -ForegroundColor Yellow
Write-Host ""
Write-Host "Starting secure Cloudflare Quick Tunnel..." -ForegroundColor Magenta
Write-Host "Keep THIS window and the relay window open during acceptance testing." -ForegroundColor DarkGray
Write-Host ""

cloudflared tunnel --url "http://127.0.0.1:$Port"
