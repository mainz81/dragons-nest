# BIFRÖST Relay — IV-E5A

The BIFRÖST Relay is a deliberately narrow bridge between the public Vercel BIFRÖST interface and the researcher's existing local SearXNG instance.

## Doctrine

- SearXNG remains bound to localhost/private networking.
- The relay exposes only `/health` and an authenticated `/search` endpoint.
- `/search` accepts only a bounded research query and a small page number; arbitrary upstream URLs are impossible.
- Every search request requires a bearer token.
- The relay strips the caller's search parameters down to a controlled SearXNG request: JSON, general category, English, SafeSearch enabled, page 1–3.
- Responses are size-limited and never cached.
- Waterloo/WatIAM credentials never enter the relay.
- BIFRÖST still filters returned pages against its curated trusted-domain registry before displaying them.
- If Relay configuration is absent, BIFRÖST keeps the existing public Trusted Web fallback rather than failing the whole hunt.

## Architecture

`Vercel BIFRÖST -> HTTPS tunnel -> 127.0.0.1:8787 BIFRÖST Relay -> 127.0.0.1:8080 SearXNG`

The Vercel server never needs direct access to port 8080. The only internet-reachable surface is the narrow relay endpoint carried through the HTTPS tunnel.

## Local runtime

From the repository root in PowerShell:

```powershell
.\scripts\start-bifrost-relay.ps1
```

If a relay token is not already present, the launcher generates a cryptographically random token, places it in the relay process environment, and copies it to the Windows clipboard without printing it.

Keep that PowerShell open. In a second PowerShell window run:

```powershell
.\scripts\start-bifrost-tunnel.ps1
```

A Cloudflare Quick Tunnel is useful for acceptance testing and produces a temporary `https://*.trycloudflare.com` address. The quick-tunnel process must remain open and its URL changes when restarted. A stable named tunnel is preferable for long-lived use.

## Vercel configuration

The Vercel BIFRÖST runtime uses two server-side environment variables:

- `BIFROST_RELAY_URL` — the HTTPS tunnel URL that reaches the local relay.
- `BIFROST_RELAY_TOKEN` — the same bearer token used by the local relay.

Never put the token in source control and never create a `NEXT_PUBLIC_*` copy. It must remain server-side only.

After both variables are configured, redeploy BIFRÖST. The hunt API reports:

- `phase: IV-E5A`
- `relay.configured: true`
- `relay.mode: AUTHENTICATED_BIFROST_RELAY`
- Trusted Web `mode: PAGE_LEVEL_BIFROST_RELAY`

Without both variables, the live site remains operational and uses the existing public Trusted Web fallback.

## Health check

Local relay health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
```

The health endpoint reveals no token and does not perform a web search.

## Authenticated local search acceptance

With the same relay PowerShell session still holding the token:

```powershell
$headers = @{ Authorization = "Bearer $env:BIFROST_RELAY_TOKEN" }
Invoke-RestMethod "http://127.0.0.1:8787/search?q=developmental%20psychology" -Headers $headers
```

A successful response should contain SearXNG JSON results. A request without the bearer token should return HTTP 401.

## Search depth

When the Relay is active, Trusted Web runs five bounded searches across the thirty highest-ranked authoritative domains, then merges, de-duplicates, domain-gates and ranks the resulting pages. Up to 50 actual trusted pages can be returned to BIFRÖST.

This is intentionally not a general-purpose proxy, crawler, authenticated-library scraper, or Waterloo login automation system.
