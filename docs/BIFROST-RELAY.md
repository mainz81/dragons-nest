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

## Local runtime

Default local path:

`Vercel BIFRÖST -> HTTPS tunnel -> 127.0.0.1:8787 BIFRÖST Relay -> 127.0.0.1:8080 SearXNG`

Start the relay from the repository root:

```powershell
.\scripts\start-bifrost-relay.ps1
```

If a relay token is not already present, the launcher generates a cryptographically random token, places it in the relay process environment, and copies it to the Windows clipboard without printing it.

In a second PowerShell window:

```powershell
.\scripts\start-bifrost-tunnel.ps1
```

A Cloudflare Quick Tunnel is suitable for development and produces a temporary `https://*.trycloudflare.com` address. The quick-tunnel process must remain open and its URL changes when restarted. For a long-lived BIFRÖST installation, use a stable authenticated tunnel instead.

## Vercel configuration

The Vercel BIFRÖST runtime expects:

- `BIFROST_SEARXNG_URL` — the HTTPS URL that reaches the relay.
- `BIFROST_RELAY_TOKEN` — the same bearer token used by the local relay.

Never place the token in source control or in a `NEXT_PUBLIC_*` variable. It is server-side only.

Once both variables are configured and Vercel is redeployed, Trusted Web switches from the public fallback to the authenticated BIFRÖST Relay path.

## Health check

Local:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
```

The health endpoint reveals no token and does not perform a web search.

## Search safety

The relay is not a generic HTTP proxy. It cannot fetch arbitrary URLs and cannot proxy Waterloo authentication. Its only purpose is to forward controlled search queries to the researcher's SearXNG instance and return JSON search results to the BIFRÖST server.
