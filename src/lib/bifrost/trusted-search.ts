import { buildTrustedWebRoutes, TrustedWebRoute } from "./trusted-web";

export type TrustedWebPageResult = {
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

export type TrustedWebPageDiscovery = {
  status: "AVAILABLE" | "DEGRADED" | "UNAVAILABLE";
  mode: "PAGE_LEVEL_SEARXNG" | "PAGE_LEVEL_BING_RSS" | "CURATED_ROUTE_FALLBACK";
  backend: string;
  backendTrust: "CONFIGURED_PRIVATE_OR_MANAGED" | "PUBLIC_SEARCH_FALLBACK";
  queryCount: number;
  resultCount: number;
  results: TrustedWebPageResult[];
  routes: TrustedWebRoute[];
  warnings: string[];
};

type RawSearchResult = {
  url?: string;
  title?: string;
  content?: string;
  engine?: string;
  engines?: string[];
  score?: number;
  publishedDate?: string;
  published_date?: string;
};

type SearxPayload = {
  results?: RawSearchResult[];
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
  const q = [...new Set(tokens(question))];
  if (!q.length) return 0;
  const body = new Set(tokens(`${title} ${snippet}`));
  const hits = q.filter((token) => body.has(token)).length;
  return Math.round((hits / q.length) * 22);
}

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"');
}

function cleanText(value?: string): string {
  return decodeEntities(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalUrl(value: string): string | undefined {
  try {
    const url = new URL(decodeEntities(value));
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

function parseSearxHtml(html: string): RawSearchResult[] {
  const results: RawSearchResult[] = [];
  const articleRe = /<article\b[^>]*class="[^"]*\bresult\b[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  let match: RegExpExecArray | null;

  while ((match = articleRe.exec(html)) !== null && results.length < 30) {
    const block = match[1] ?? "";
    const link = block.match(/<h3\b[^>]*>[\s\S]*?<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
      ?? block.match(/<a\b[^>]*class="[^"]*url_header[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const snippetMatch = block.match(/<p\b[^>]*class="[^"]*\bcontent\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    results.push({
      url: cleanText(link[1]),
      title: cleanText(link[2]),
      content: cleanText(snippetMatch?.[1]),
      engine: "searxng-html"
    });
  }
  return results;
}

function xmlTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] ?? "";
}

function parseBingRss(xml: string): RawSearchResult[] {
  const results: RawSearchResult[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(xml)) !== null && results.length < 20) {
    const block = match[1] ?? "";
    const title = cleanText(xmlTag(block, "title"));
    const url = cleanText(xmlTag(block, "link"));
    if (!title || !url) continue;
    results.push({
      title,
      url,
      content: cleanText(xmlTag(block, "description")),
      publishedDate: cleanText(xmlTag(block, "pubDate")) || undefined,
      engine: "bing-rss"
    });
  }
  return results;
}

async function fetchWithTimeout(url: URL, accept: string, timeoutMs = 6500): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: {
        Accept: accept,
        "User-Agent": "MAINLAND-MYTHOS-BIFROST/0.4.2 (human-directed personal research)"
      },
      signal: controller.signal,
      cache: "no-store"
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function searchSearx(baseUrl: string, query: string): Promise<{ results: RawSearchResult[]; warning?: string }> {
  try {
    const endpoint = new URL("/search", `${baseUrl.replace(/\/$/, "")}/`);
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("categories", "general");
    endpoint.searchParams.set("language", "en");
    endpoint.searchParams.set("safesearch", "1");
    endpoint.searchParams.set("pageno", "1");

    const response = await fetchWithTimeout(endpoint, "application/json,text/html;q=0.8");
    if (response.status === 429) return { results: [], warning: "Configured SearXNG rate-limited the request; BIFRÖST stopped without retrying." };

    const contentType = response.headers.get("content-type") ?? "";
    if (response.ok && contentType.includes("application/json")) {
      const payload = (await response.json()) as SearxPayload;
      return { results: payload.results ?? [] };
    }

    if (response.status === 403 || response.status === 404 || !contentType.includes("application/json")) {
      const htmlEndpoint = new URL("/search", `${baseUrl.replace(/\/$/, "")}/`);
      htmlEndpoint.searchParams.set("q", query);
      htmlEndpoint.searchParams.set("categories", "general");
      htmlEndpoint.searchParams.set("language", "en");
      htmlEndpoint.searchParams.set("safesearch", "1");
      const htmlResponse = await fetchWithTimeout(htmlEndpoint, "text/html");
      if (htmlResponse.status === 429) return { results: [], warning: "Configured SearXNG HTML fallback was rate-limited; BIFRÖST stopped without retrying." };
      if (!htmlResponse.ok) return { results: [], warning: `Configured SearXNG returned HTTP ${htmlResponse.status}.` };
      const parsed = parseSearxHtml(await htmlResponse.text());
      return { results: parsed, warning: parsed.length ? "Configured SearXNG used HTML fallback because JSON output was unavailable." : "Configured SearXNG returned no parseable results." };
    }

    return { results: [], warning: `Configured SearXNG returned HTTP ${response.status}.` };
  } catch (error) {
    return { results: [], warning: `Configured SearXNG failed gracefully: ${error instanceof Error ? error.message : "unknown error"}.` };
  }
}

async function searchBingRss(query: string): Promise<{ results: RawSearchResult[]; warning?: string }> {
  try {
    const endpoint = new URL("https://www.bing.com/search");
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("format", "rss");
    endpoint.searchParams.set("setlang", "en-US");

    const response = await fetchWithTimeout(endpoint, "application/rss+xml,application/xml,text/xml;q=0.9");
    if (response.status === 429) return { results: [], warning: "Bing RSS trusted-web search was rate-limited; BIFRÖST stopped without retrying." };
    if (!response.ok) return { results: [], warning: `Bing RSS trusted-web search returned HTTP ${response.status}.` };

    const parsed = parseBingRss(await response.text());
    return { results: parsed, warning: parsed.length ? undefined : "Bing RSS responded but returned no parseable trusted-web candidates." };
  } catch (error) {
    return { results: [], warning: `Bing RSS trusted-web search failed gracefully: ${error instanceof Error ? error.message : "unknown error"}.` };
  }
}

function buildDomainQuery(question: string, routes: TrustedWebRoute[]): string {
  const domains = routes.map((route) => `site:${route.domain}`).join(" OR ");
  return `${question.trim()} (${domains})`;
}

function rankResults(question: string, rawGroups: RawSearchResult[][], routes: TrustedWebRoute[], maxResults: number): TrustedWebPageResult[] {
  const byUrl = new Map<string, TrustedWebPageResult>();

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
    const publishedDate = raw.publishedDate ?? raw.published_date;

    const result: TrustedWebPageResult = {
      id: `trusted:${Buffer.from(url).toString("base64url").slice(0, 32)}`,
      title,
      url,
      snippet,
      domain: host,
      sourceName: route.name,
      kind: route.kind,
      priorityScore,
      engines,
      publishedDate,
      sourceSearchUrl: route.searchUrl
    };

    const existing = byUrl.get(url);
    if (!existing || result.priorityScore > existing.priorityScore) byUrl.set(url, result);
  }

  return [...byUrl.values()]
    .sort((a, b) => b.priorityScore - a.priorityScore || a.title.localeCompare(b.title))
    .slice(0, maxResults);
}

export async function discoverTrustedWebPages(input: {
  question: string;
  maxResults?: number;
}): Promise<TrustedWebPageDiscovery> {
  const question = input.question.trim();
  const maxResults = Math.max(5, Math.min(input.maxResults ?? 35, 50));
  const routes = buildTrustedWebRoutes(question, 30);
  const configuredSearx = process.env.BIFROST_SEARXNG_URL?.trim();
  const useSearx = Boolean(configuredSearx);
  const backend = configuredSearx || "https://www.bing.com/search?format=rss";
  const backendTrust: TrustedWebPageDiscovery["backendTrust"] = configuredSearx
    ? "CONFIGURED_PRIVATE_OR_MANAGED"
    : "PUBLIC_SEARCH_FALLBACK";
  const warnings: string[] = [];

  if (!question || !routes.length) {
    return {
      status: "UNAVAILABLE",
      mode: "CURATED_ROUTE_FALLBACK",
      backend,
      backendTrust,
      queryCount: 0,
      resultCount: 0,
      results: [],
      routes,
      warnings: ["Trusted-web page discovery skipped because no research question or trusted routes were available."]
    };
  }

  const groupSize = useSearx ? 10 : 8;
  const maxGroups = useSearx ? 2 : 3;
  const routeGroups = Array.from({ length: maxGroups }, (_, index) =>
    routes.slice(index * groupSize, (index + 1) * groupSize)
  ).filter((group) => group.length > 0);

  const searches = await Promise.all(
    routeGroups.map((group) => {
      const query = buildDomainQuery(question, group);
      return useSearx ? searchSearx(configuredSearx as string, query) : searchBingRss(query);
    })
  );

  for (const search of searches) if (search.warning) warnings.push(search.warning);
  const results = rankResults(question, searches.map((search) => search.results), routes, maxResults);

  if (!configuredSearx) {
    warnings.push("Trusted Web is using Bing RSS as a no-key personal-research fallback. Set BIFROST_SEARXNG_URL to move this lane to a private or managed MAINLAND MYTHOS SearXNG endpoint.");
  }

  if (!results.length) {
    return {
      status: warnings.some((warning) => /rate-limited|failed|HTTP/i.test(warning)) ? "UNAVAILABLE" : "DEGRADED",
      mode: "CURATED_ROUTE_FALLBACK",
      backend,
      backendTrust,
      queryCount: routeGroups.length,
      resultCount: 0,
      results: [],
      routes,
      warnings
    };
  }

  return {
    status: configuredSearx && !warnings.length ? "AVAILABLE" : "DEGRADED",
    mode: configuredSearx ? "PAGE_LEVEL_SEARXNG" : "PAGE_LEVEL_BING_RSS",
    backend,
    backendTrust,
    queryCount: routeGroups.length,
    resultCount: results.length,
    results,
    routes,
    warnings
  };
}
