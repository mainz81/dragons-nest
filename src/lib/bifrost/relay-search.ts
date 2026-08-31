import { buildTrustedWebRoutes, TrustedWebRoute } from "./trusted-web";

export type RelayTrustedPage = {
  id: string;
  title: string;
  url: string;
  snippet: string;
  domain: string;
  sourceName: string;
  kind: string;
  priorityScore: number;
  engines: string[];
  publishedDate?: string;
  sourceSearchUrl: string;
};

export type RelayTrustedDiscovery = {
  status: "AVAILABLE" | "DEGRADED" | "UNAVAILABLE";
  mode: "PAGE_LEVEL_BIFROST_RELAY";
  backend: string;
  backendTrust: "AUTHENTICATED_BIFROST_RELAY";
  queryCount: number;
  resultCount: number;
  results: RelayTrustedPage[];
  routes: TrustedWebRoute[];
  warnings: string[];
};

type RawResult = {
  url?: string;
  title?: string;
  content?: string;
  engine?: string;
  engines?: string[];
  score?: number;
  publishedDate?: string;
  published_date?: string;
};

type RelayPayload = {
  results?: RawResult[];
};

const STOP = new Set([
  "the", "and", "for", "with", "from", "that", "this", "are", "was", "were", "how", "what", "why",
  "when", "where", "who", "into", "about", "their", "they", "them", "have", "has", "had", "being", "been"
]);

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 2 && !STOP.has(token));
}

function topicalScore(question: string, title: string, snippet: string): number {
  const queryTokens = [...new Set(tokens(question))];
  if (!queryTokens.length) return 0;
  const bodyTokens = new Set(tokens(`${title} ${snippet}`));
  const hits = queryTokens.filter((token) => bodyTokens.has(token)).length;
  return Math.round((hits / queryTokens.length) * 22);
}

function cleanText(value?: string): string {
  return (value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function hostFor(value: string): string | undefined {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function routeForUrl(url: string, routes: TrustedWebRoute[]): TrustedWebRoute | undefined {
  const host = hostFor(url);
  if (!host) return undefined;
  if (host === "wikipedia.org" || host.endsWith(".wikipedia.org")) return undefined;
  return routes.find((route) => host === route.domain || host.endsWith(`.${route.domain}`));
}

function buildDomainQuery(question: string, routes: TrustedWebRoute[]): string {
  return `${question.trim()} (${routes.map((route) => `site:${route.domain}`).join(" OR ")})`;
}

async function relaySearch(baseUrl: string, token: string, query: string): Promise<{ results: RawResult[]; warning?: string }> {
  const endpoint = new URL("/search", `${baseUrl.replace(/\/$/, "")}/`);
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("pageno", "1");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8500);

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "MAINLAND-MYTHOS-BIFROST/0.5.0 (authenticated relay client)"
      },
      signal: controller.signal,
      cache: "no-store"
    });

    if (response.status === 401) return { results: [], warning: "BIFRÖST Relay rejected the configured bearer token (HTTP 401)." };
    if (response.status === 429) return { results: [], warning: "BIFRÖST Relay rate-limited this search (HTTP 429); no automatic retry was attempted." };
    if (!response.ok) return { results: [], warning: `BIFRÖST Relay returned HTTP ${response.status}.` };

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return { results: [], warning: "BIFRÖST Relay returned a non-JSON response." };

    const payload = (await response.json()) as RelayPayload;
    return { results: Array.isArray(payload.results) ? payload.results : [] };
  } catch (error) {
    return {
      results: [],
      warning: `BIFRÖST Relay failed gracefully: ${error instanceof Error ? error.message : "unknown error"}.`
    };
  } finally {
    clearTimeout(timeout);
  }
}

function rankResults(question: string, rawGroups: RawResult[][], routes: TrustedWebRoute[], maxResults: number): RelayTrustedPage[] {
  const byUrl = new Map<string, RelayTrustedPage>();

  for (const raw of rawGroups.flat()) {
    const title = cleanText(raw.title);
    const url = canonicalUrl(raw.url ?? "");
    if (!title || !url) continue;

    const route = routeForUrl(url, routes);
    if (!route) continue;

    const snippet = cleanText(raw.content);
    const engineBoost = typeof raw.score === "number" && Number.isFinite(raw.score)
      ? Math.min(6, Math.max(0, Math.round(raw.score)))
      : 0;
    const priorityScore = Math.min(100, route.priorityScore + topicalScore(question, title, snippet) + engineBoost);
    const engines = [...new Set([...(raw.engines ?? []), ...(raw.engine ? [raw.engine] : [])])];
    const host = hostFor(url) ?? route.domain;

    const item: RelayTrustedPage = {
      id: `trusted:${Buffer.from(url).toString("base64url").slice(0, 32)}`,
      title,
      url,
      snippet,
      domain: host,
      sourceName: route.name,
      kind: route.kind,
      priorityScore,
      engines,
      publishedDate: raw.publishedDate ?? raw.published_date,
      sourceSearchUrl: route.searchUrl
    };

    const existing = byUrl.get(url);
    if (!existing || item.priorityScore > existing.priorityScore) byUrl.set(url, item);
  }

  return [...byUrl.values()]
    .sort((a, b) => b.priorityScore - a.priorityScore || a.title.localeCompare(b.title))
    .slice(0, maxResults);
}

export async function discoverTrustedRelayPages(input: {
  question: string;
  relayUrl: string;
  relayToken: string;
  maxResults?: number;
}): Promise<RelayTrustedDiscovery> {
  const question = input.question.trim();
  const maxResults = Math.max(5, Math.min(input.maxResults ?? 50, 50));
  const routes = buildTrustedWebRoutes(question, 30);
  const warnings: string[] = [];

  if (!question || !routes.length) {
    return {
      status: "UNAVAILABLE",
      mode: "PAGE_LEVEL_BIFROST_RELAY",
      backend: input.relayUrl,
      backendTrust: "AUTHENTICATED_BIFROST_RELAY",
      queryCount: 0,
      resultCount: 0,
      results: [],
      routes,
      warnings: ["BIFRÖST Relay search skipped because the research question or trusted source registry was empty."]
    };
  }

  // Five six-domain searches provide broad authority coverage while staying deliberately bounded.
  const routeGroups = Array.from({ length: 5 }, (_, index) => routes.slice(index * 6, (index + 1) * 6))
    .filter((group) => group.length > 0);

  const searches = await Promise.all(
    routeGroups.map((group) => relaySearch(input.relayUrl, input.relayToken, buildDomainQuery(question, group)))
  );

  for (const search of searches) if (search.warning) warnings.push(search.warning);
  const results = rankResults(question, searches.map((search) => search.results), routes, maxResults);
  const failedQueries = searches.filter((search) => Boolean(search.warning)).length;

  return {
    status: results.length === 0 ? "UNAVAILABLE" : failedQueries > 0 ? "DEGRADED" : "AVAILABLE",
    mode: "PAGE_LEVEL_BIFROST_RELAY",
    backend: input.relayUrl,
    backendTrust: "AUTHENTICATED_BIFROST_RELAY",
    queryCount: routeGroups.length,
    resultCount: results.length,
    results,
    routes,
    warnings
  };
}
