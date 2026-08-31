param(
  [int]$Port = 8787
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== BIFROST QUICK TUNNEL ===" -ForegroundColor Magenta
Write-Host ""

try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 5
  if (-not $health.ok) { throw "Relay health check was not OK." }
  Write-Host "Local relay healthy on 127.0.0.1:$Port" -ForegroundColor Green
} catch {
  throw "BIFROST Relay is not reachable on port $Port. Start .\scripts\start-bifrost-relay.ps1 first."
}

if (Get-Command cloudflared -ErrorAction SilentlyContinue) {
  Write-Host "Starting Cloudflare Quick Tunnel..." -ForegroundColor Cyan
  Write-Host "Copy the generated https://*.trycloudflare.com URL. It becomes BIFROST_SEARXNG_URL in Vercel." -ForegroundColor Yellow
  Write-Host "Quick Tunnel URLs change when this process restarts." -ForegroundColor DarkGray
  Write-Host ""
  cloudflared tunnel --url "http://127.0.0.1:$Port"
  exit $LASTEXITCODE
}

Write-Host "cloudflared was not found." -ForegroundColor Yellow
Write-Host "Cloudflare currently supports free Quick Tunnels with no account required." -ForegroundColor DarkGray
Write-Host "Install cloudflared, then rerun this script." -ForegroundColor Yellow
Write-Host ""
Write-Host "Manual tunnel command once installed:" -ForegroundColor Cyan
Write-Host "cloudflared tunnel --url http://127.0.0.1:$Port"
exit 1
