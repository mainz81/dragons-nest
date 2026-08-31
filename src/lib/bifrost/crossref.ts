import { Candidate, normalizeDoi, normalizeTitle } from "./engine";

export type CrossrefDiscovery = {
  source: "CROSSREF";
  queryCount: number;
  successfulQueries: number;
  candidateCount: number;
  candidates: Candidate[];
  warnings: string[];
};

type CrossrefAuthor = {
  given?: string;
  family?: string;
  name?: string;
};

type CrossrefDate = {
  "date-parts"?: number[][];
};

type CrossrefLicense = {
  URL?: string;
};

type CrossrefItem = {
  DOI?: string;
  title?: string[];
  author?: CrossrefAuthor[];
  published?: CrossrefDate;
  "published-print"?: CrossrefDate;
  "published-online"?: CrossrefDate;
  issued?: CrossrefDate;
  URL?: string;
  abstract?: string;
  subject?: string[];
  license?: CrossrefLicense[];
  type?: string;
};

type CrossrefResponse = {
  status?: string;
  message?: {
    items?: CrossrefItem[];
  };
};

function firstYear(item: CrossrefItem): number | undefined {
  const dates = [item.published, item["published-online"], item["published-print"], item.issued];
  for (const date of dates) {
    const year = date?.["date-parts"]?.[0]?.[0];
    if (typeof year === "number" && Number.isFinite(year)) return year;
  }
  return undefined;
}

function authorName(author: CrossrefAuthor): string | undefined {
  const explicit = author.name?.trim();
  if (explicit) return explicit;
  const combined = [author.given, author.family].filter(Boolean).join(" ").trim();
  return combined || undefined;
}

function stripMarkup(value?: string): string | undefined {
  if (!value) return undefined;
  const stripped = value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
  return stripped || undefined;
}

function hasClearlyOpenLicense(item: CrossrefItem): boolean {
  return (item.license ?? []).some((license) => {
    const url = license.URL?.toLowerCase() ?? "";
    return url.includes("creativecommons.org/") || url.includes("creativecommons.net/");
  });
}

function keyFor(candidate: Candidate): string {
  const doi = normalizeDoi(candidate.doi);
  return doi
    ? `doi:${doi}`
    : `title:${normalizeTitle(candidate.title)}:${candidate.year ?? "unknown"}`;
}

function toCandidate(item: CrossrefItem, evidenceGapTags: string[]): Candidate | undefined {
  const title = item.title?.[0]?.trim();
  if (!title) return undefined;

  const doi = normalizeDoi(item.DOI);
  const openLicense = hasClearlyOpenLicense(item);

  return {
    id: doi ? `crossref:${doi}` : undefined,
    title,
    authors: (item.author ?? []).map(authorName).filter((value): value is string => Boolean(value)),
    year: firstYear(item),
    doi,
    url: item.URL || (doi ? `https://doi.org/${doi}` : undefined),
    abstract: stripMarkup(item.abstract),
    keywords: item.subject ?? [],
    evidenceGapTags,
    accessStatus: openLicense ? "OPEN_ACCESS" : "UNKNOWN",
    downloadRights: openLicense ? "PERMITTED" : "UNKNOWN",
    aiUseStatus: "UNKNOWN",
    tdmStatus: "UNKNOWN"
  };
}

async function searchOne(query: string, evidenceGapTags: string[], rows: number): Promise<Candidate[]> {
  const params = new URLSearchParams({
    "query.bibliographic": query,
    rows: String(rows)
  });

  const mailto = process.env.BIFROST_CROSSREF_MAILTO?.trim();
  if (mailto) params.set("mailto", mailto);

  const url = `https://api.crossref.org/works?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "MAINLAND-MYTHOS-BIFROST/0.2 (https://dragons-nest.vercel.app/bifrost)"
    },
    next: { revalidate: 86400 }
  });

  if (!response.ok) {
    throw new Error(`Crossref returned HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as CrossrefResponse;
  const items = payload.message?.items ?? [];
  return items
    .map((item) => toCandidate(item, evidenceGapTags))
    .filter((candidate): candidate is Candidate => Boolean(candidate));
}

export async function discoverCrossref(input: {
  queries: Array<{ query: string; evidenceGapTags: string[] }>;
  rowsPerQuery?: number;
}): Promise<CrossrefDiscovery> {
  const rowsPerQuery = Math.max(2, Math.min(input.rowsPerQuery ?? 7, 15));
  const queries = input.queries.filter((entry) => entry.query.trim()).slice(0, 5);

  const settled = await Promise.allSettled(
    queries.map((entry) => searchOne(entry.query, entry.evidenceGapTags, rowsPerQuery))
  );

  const warnings: string[] = [];
  const byKey = new Map<string, Candidate>();
  let successfulQueries = 0;

  settled.forEach((result, index) => {
    if (result.status === "rejected") {
      warnings.push(`Crossref query ${index + 1} failed: ${result.reason instanceof Error ? result.reason.message : "unknown error"}`);
      return;
    }

    successfulQueries += 1;
    for (const candidate of result.value) {
      const key = keyFor(candidate);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, candidate);
        continue;
      }

      byKey.set(key, {
        ...existing,
        evidenceGapTags: [...new Set([...(existing.evidenceGapTags ?? []), ...(candidate.evidenceGapTags ?? [])])],
        keywords: [...new Set([...(existing.keywords ?? []), ...(candidate.keywords ?? [])])]
      });
    }
  });

  if (!successfulQueries) {
    warnings.push("All public scholarly-metadata discovery queries failed. No absence inference is permitted.");
  }

  return {
    source: "CROSSREF",
    queryCount: queries.length,
    successfulQueries,
    candidateCount: byKey.size,
    candidates: [...byKey.values()],
    warnings
  };
}
