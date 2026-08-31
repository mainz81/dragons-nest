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
  mode: "PAGE_LEVEL_SEARXNG" | "CURATED_ROUTE_FALLBACK";
  backend: string;
  backendTrust: "CONFIGURED_PRIVATE_OR_MANAGED" | "PUBLIC_FALLBACK";
  queryCount: number;
  resultCount: number;
  results: TrustedWebPageResult[];
  routes: TrustedWebRoute[];
  warnings: string[];
};

type SearxResult = {
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
  results?: SearxResult[];
};

const DEFAULT_PUBLIC_SEARXNG = "https://searx.tiekoetter.com";

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

function cleanText(value?: string): string {
  return (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
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

function parseHtmlResults(html: string): SearxResult[] {
  const results: SearxResult[] = [];
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

async function searchSearx(input: {
  baseUrl: string;
  query: string;
  page?: number;
}): Promise<{ results: SearxResult[]; sourceFormat: "json" | "html"; warning?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);

  try {
    const endpoint = new URL("/search", `${input.baseUrl.replace(/\/$/, "")}/`);
    endpoint.searchParams.set("q", input.query);
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("categories", "general");
    endpoint.searchParams.set("language", "en");
    endpoint.searchParams.set("safesearch", "1");
    endpoint.searchParams.set("pageno", String(input.page ?? 1));

    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json,text/html;q=0.8",
        "User-Agent": "MAINLAND-MYTHOS-BIFROST/0.4.2 (human-directed trusted-web discovery)"
      },
      signal: controller.signal,
      cache: "no-store"
    });

    if (response.status === 429) {
      return { results: [], sourceFormat: "json", warning: "Trusted-web search backend rate-limited the request (HTTP 429); BIFRÖST stopped without retrying." };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (response.ok && contentType.includes("application/json")) {
      const payload = (await response.json()) as SearxPayload;
      return { results: payload.results ?? [], sourceFormat: "json" };
    }

    if (response.status !== 403 && response.status !== 404 && response.ok) {
      const text = await response.text();
      const parsed = parseHtmlResults(text);
      if (parsed.length) return { results: parsed, sourceFormat: "html" };
    }

    if (response.status === 403 || response.status === 404 || !contentType.includes("application/json")) {
      const htmlEndpoint = new URL("/search", `${input.baseUrl.replace(/\/$/, "")}/`);
      htmlEndpoint.searchParams.set("q", input.query);
      htmlEndpoint.searchParams.set("categories", "general");
      htmlEndpoint.searchParams.set("language", "en");
      htmlEndpoint.searchParams.set("safesearch", "1");
      htmlEndpoint.searchParams.set("pageno", String(input.page ?? 1));

      const htmlResponse = await fetch(htmlEndpoint, {
        headers: {
          Accept: "text/html",
          "User-Agent": "MAINLAND-MYTHOS-BIFROST/0.4.2 (human-directed trusted-web discovery)"
        },
        signal: controller.signal,
        cache: "no-store"
      });

      if (htmlResponse.status === 429) {
        return { results: [], sourceFormat: "html", warning: "Trusted-web HTML fallback was rate-limited (HTTP 429); BIFRÖST stopped without retrying." };
      }
      if (!htmlResponse.ok) {
        return { results: [], sourceFormat: "html", warning: `Trusted-web search backend returned HTTP ${htmlResponse.status}.` };
      }

      const parsed = parseHtmlResults(await htmlResponse.text());
      return {
        results: parsed,
        sourceFormat: "html",
        warning: parsed.length ? "Trusted-web backend used ordinary SearXNG HTML fallback because JSON output was unavailable." : "Trusted-web backend returned HTML but no parseable results."
      };
    }

    return { results: [], sourceFormat: "json", warning: `Trusted-web search backend returned HTTP ${response.status}.` };
  } catch (error) {
    return {
      results: [],
      sourceFormat: "json",
      warning: `Trusted-web page search failed gracefully: ${error instanceof Error ? error.message : "unknown error"}.`
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildDomainQuery(question: string, routes: TrustedWebRoute[]): string {
  const domains = routes.map((route) => `site:${route.domain}`).join(" OR ");
  return `${question.trim()} (${domains})`;
}

export async function discoverTrustedWebPages(input: {
  question: string;
  maxResults?: number;
}): Promise<TrustedWebPageDiscovery> {
  const question = input.question.trim();
  const maxResults = Math.max(5, Math.min(input.maxResults ?? 35, 50));
  const routes = buildTrustedWebRoutes(question, 30);
  const configured = process.env.BIFROST_SEARXNG_URL?.trim();
  const baseUrl = configured || DEFAULT_PUBLIC_SEARXNG;
  const warnings: string[] = [];

  if (!question || !routes.length) {
    return {
      status: "UNAVAILABLE",
      mode: "CURATED_ROUTE_FALLBACK",
      backend: baseUrl,
      backendTrust: configured ? "CONFIGURED_PRIVATE_OR_MANAGED" : "PUBLIC_FALLBACK",
      queryCount: 0,
      resultCount: 0,
      results: [],
      routes,
      warnings: ["Trusted-web page discovery skipped because no research question or trusted routes were available."]
    };
  }

  const routeGroups = [routes.slice(0, 10), routes.slice(10, 20)].filter((group) => group.length > 0);
  const searches = await Promise.all(
    routeGroups.map((group) => searchSearx({ baseUrl, query: buildDomainQuery(question, group), page: 1 }))
  );

  const byUrl = new Map<string, TrustedWebPageResult>();

  for (const search of searches) {
    if (search.warning) warnings.push(search.warning);
    for (const raw of search.results) {
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
  }

  const results = [...byUrl.values()]
    .sort((a, b) => b.priorityScore - a.priorityScore || a.title.localeCompare(b.title))
    .slice(0, maxResults);

  if (!configured) {
    warnings.push("Trusted-web page discovery is temporarily using a public SearXNG instance. Configure BIFROST_SEARXNG_URL to move this lane onto a private or managed MAINLAND MYTHOS search endpoint.");
  }

  if (!results.length) {
    return {
      status: warnings.some((warning) => /rate-limited|failed|HTTP/i.test(warning)) ? "UNAVAILABLE" : "DEGRADED",
      mode: "CURATED_ROUTE_FALLBACK",
      backend: baseUrl,
      backendTrust: configured ? "CONFIGURED_PRIVATE_OR_MANAGED" : "PUBLIC_FALLBACK",
      queryCount: routeGroups.length,
      resultCount: 0,
      results: [],
      routes,
      warnings
    };
  }

  return {
    status: warnings.some((warning) => /fallback|public SearXNG/i.test(warning)) ? "DEGRADED" : "AVAILABLE",
    mode: "PAGE_LEVEL_SEARXNG",
    backend: baseUrl,
    backendTrust: configured ? "CONFIGURED_PRIVATE_OR_MANAGED" : "PUBLIC_FALLBACK",
    queryCount: routeGroups.length,
    resultCount: results.length,
    results,
    routes,
    warnings
  };
}
