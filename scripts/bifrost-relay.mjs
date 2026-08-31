import http from "node:http";
import { timingSafeEqual } from "node:crypto";

const host = process.env.BIFROST_RELAY_HOST?.trim() || "127.0.0.1";
const port = Number.parseInt(process.env.BIFROST_RELAY_PORT || "8787", 10);
const upstreamBase = process.env.SEARXNG_URL?.trim() || "http://127.0.0.1:8080";
const token = process.env.BIFROST_RELAY_TOKEN?.trim() || "";
const maxRequestsPerMinute = Math.max(10, Math.min(Number.parseInt(process.env.BIFROST_RELAY_RPM || "120", 10), 600));
const MAX_QUERY_LENGTH = 1200;
const MAX_RESPONSE_BYTES = 2_500_000;

if (!token || token.length < 24) {
  console.error("BIFRÖST RELAY REFUSED TO START: BIFROST_RELAY_TOKEN must be set and at least 24 characters long.");
  process.exit(1);
}

let upstream;
try {
  upstream = new URL(upstreamBase);
  if (!/^https?:$/.test(upstream.protocol)) throw new Error("unsupported protocol");
} catch {
  console.error("BIFRÖST RELAY REFUSED TO START: SEARXNG_URL must be a valid http(s) URL.");
  process.exit(1);
}

const buckets = new Map();

function json(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-bifrost-relay": "IV-E5A",
    ...extraHeaders
  });
  res.end(payload);
}

function authorized(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function rateAllowed(req) {
  const now = Date.now();
  const minute = Math.floor(now / 60_000);
  const key = `${req.socket.remoteAddress || "unknown"}:${minute}`;
  const count = (buckets.get(key) || 0) + 1;
  buckets.set(key, count);

  if (buckets.size > 500) {
    for (const existing of buckets.keys()) {
      if (!existing.endsWith(`:${minute}`)) buckets.delete(existing);
    }
  }

  return count <= maxRequestsPerMinute;
}

function controlledSearchUrl(requestUrl) {
  const query = (requestUrl.searchParams.get("q") || "").trim();
  if (!query || query.length > MAX_QUERY_LENGTH) return null;

  const url = new URL("/search", `${upstream.toString().replace(/\/$/, "")}/`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("categories", "general");
  url.searchParams.set("language", "en");
  url.searchParams.set("safesearch", "1");

  const page = Number.parseInt(requestUrl.searchParams.get("pageno") || "1", 10);
  url.searchParams.set("pageno", String(Number.isFinite(page) ? Math.max(1, Math.min(page, 3)) : 1));
  return url;
}

async function proxySearch(req, res, requestUrl) {
  if (!authorized(req)) {
    json(res, 401, { ok: false, error: "BIFROST_RELAY_UNAUTHORIZED" }, { "www-authenticate": "Bearer" });
    return;
  }

  if (!rateAllowed(req)) {
    json(res, 429, { ok: false, error: "BIFROST_RELAY_RATE_LIMIT" });
    return;
  }

  const target = controlledSearchUrl(requestUrl);
  if (!target) {
    json(res, 400, { ok: false, error: "BIFROST_RELAY_INVALID_QUERY" });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(target, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MAINLAND-MYTHOS-BIFROST-RELAY/0.5.0"
      },
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      json(res, 502, {
        ok: false,
        error: "BIFROST_RELAY_UPSTREAM_ERROR",
        upstreamStatus: response.status
      });
      return;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      json(res, 502, { ok: false, error: "BIFROST_RELAY_UPSTREAM_NOT_JSON" });
      return;
    }

    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
      json(res, 502, { ok: false, error: "BIFROST_RELAY_UPSTREAM_TOO_LARGE" });
      return;
    }

    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      json(res, 502, { ok: false, error: "BIFROST_RELAY_UPSTREAM_INVALID_JSON" });
      return;
    }

    json(res, 200, payload, {
      "x-bifrost-upstream": "searxng"
    });
  } catch (error) {
    json(res, 502, {
      ok: false,
      error: "BIFROST_RELAY_UPSTREAM_UNAVAILABLE",
      message: error instanceof Error ? error.message : "unknown error"
    });
  } finally {
    clearTimeout(timeout);
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);

  if (req.method === "GET" && requestUrl.pathname === "/health") {
    json(res, 200, {
      ok: true,
      service: "MAINLAND MYTHOS BIFROST RELAY",
      phase: "IV-E5A",
      version: "0.5.0",
      upstream: "SEARXNG_CONFIGURED",
      auth: "BEARER_REQUIRED",
      publicSearchPortExposed: false
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/search") {
    await proxySearch(req, res, requestUrl);
    return;
  }

  json(res, 404, { ok: false, error: "BIFROST_RELAY_ROUTE_NOT_FOUND" });
});

server.requestTimeout = 15_000;
server.headersTimeout = 8_000;
server.keepAliveTimeout = 5_000;

server.listen(port, host, () => {
  console.log("BIFRÖST RELAY ONLINE");
  console.log(`Local relay: http://${host}:${port}`);
  console.log(`Upstream SearXNG: ${upstream.origin}`);
  console.log("Authentication: bearer token required");
  console.log("Direct SearXNG port remains unexposed.");
});

function shutdown(signal) {
  console.log(`BIFRÖST RELAY shutting down (${signal})...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
