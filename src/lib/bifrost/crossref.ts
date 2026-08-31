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
  "container-title"?: string[];
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

const ALLOWED_TYPES = new Set([
  "journal-article",
  "proceedings-article",
  "posted-content",
  "book-chapter",
  "book",
  "monograph",
  "report",
  "dissertation"
]);

const AI_ANCHORS = [
  "ai",
  "artificial intelligence",
  "conversational ai",
  "conversational agent",
  "conversational agents",
  "chatbot",
  "chatbots",
  "social robot",
  "social robots",
  "voice assistant",
  "voice assistants",
  "large language model",
  "large language models",
  "llm",
  "llms"
];

const CHILD_ANCHORS = ["child", "children", "adolescent", "adolescents", "youth", "teen", "teens", "pediatric"];
const RELATION_ANCHORS = [
  "relationship",
  "relationships",
  "relational",
  "attachment",
  "trust",
  "companionship",
  "companion",
  "parasocial",
  "anthropomorphism",
  "social presence",
  "disclosure",
  "reliance",
  "dependency",
  "bond"
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function containsAny(text: string, phrases: string[]): boolean {
  const padded = ` ${normalizeTitle(text)} `;
  return phrases.some((phrase) => padded.includes(` ${normalizeTitle(phrase)} `));
}

function candidatePassesAnchors(question: string, candidate: Candidate): boolean {
  const q = normalizeTitle(question);
  const body = [candidate.title, candidate.publicationTitle ?? "", candidate.abstract ?? "", ...(candidate.keywords ?? [])].join(" ");

  const questionHasAi = containsAny(q, AI_ANCHORS);
  const questionHasChild = containsAny(q, CHILD_ANCHORS);
  const questionHasRelation = containsAny(q, RELATION_ANCHORS);

  if (questionHasAi && !containsAny(body, AI_ANCHORS)) return false;
  if (questionHasChild && !containsAny(body, CHILD_ANCHORS)) return false;
  if (questionHasRelation && !containsAny(body, RELATION_ANCHORS)) return false;
  return true;
}

function keyFor(candidate: Candidate): string {
  const doi = normalizeDoi(candidate.doi);
  return doi
    ? `doi:${doi}`
    : `title:${normalizeTitle(candidate.title)}:${candidate.year ?? "unknown"}`;
}

function toCandidate(item: CrossrefItem, evidenceGapTags: string[]): Candidate | undefined {
  if (item.type && !ALLOWED_TYPES.has(item.type)) return undefined;

  const title = item.title?.[0]?.trim();
  if (!title) return undefined;

  const publicationTitle = item["container-title"]?.[0]?.trim() || undefined;
  const doi = normalizeDoi(item.DOI);
  const openLicense = hasClearlyOpenLicense(item);

  return {
    id: doi ? `crossref:${doi}` : undefined,
    title,
    publicationTitle,
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

async function requestCrossref(url: string, retry = true): Promise<Response> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "MAINLAND-MYTHOS-BIFROST/0.2.1 (https://dragons-nest.vercel.app/bifrost)"
    },
    next: { revalidate: 86400 }
  });

  if (response.status === 429 && retry) {
    await sleep(1200);
    return requestCrossref(url, false);
  }
  return response;
}

async function searchOne(
  question: string,
  query: string,
  evidenceGapTags: string[],
  rows: number
): Promise<Candidate[]> {
  const params = new URLSearchParams({
    "query.bibliographic": query,
    rows: String(rows)
  });

  const mailto = process.env.BIFROST_CROSSREF_MAILTO?.trim();
  if (mailto) params.set("mailto", mailto);

  const url = `https://api.crossref.org/works?${params.toString()}`;
  const response = await requestCrossref(url);

  if (!response.ok) {
    throw new Error(`Crossref returned HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as CrossrefResponse;
  const items = payload.message?.items ?? [];
  return items
    .map((item) => toCandidate(item, evidenceGapTags))
    .filter((candidate): candidate is Candidate => Boolean(candidate))
    .filter((candidate) => candidatePassesAnchors(question, candidate));
}

export async function discoverCrossref(input: {
  question: string;
  queries: Array<{ query: string; evidenceGapTags: string[] }>;
  rowsPerQuery?: number;
}): Promise<CrossrefDiscovery> {
  const rowsPerQuery = Math.max(3, Math.min(input.rowsPerQuery ?? 8, 15));
  const queries = input.queries.filter((entry) => entry.query.trim()).slice(0, 3);
  const warnings: string[] = [];
  const byKey = new Map<string, Candidate>();
  let successfulQueries = 0;

  for (let index = 0; index < queries.length; index += 1) {
    const entry = queries[index];
    if (!entry) continue;

    try {
      const candidates = await searchOne(input.question, entry.query, entry.evidenceGapTags, rowsPerQuery);
      successfulQueries += 1;
      for (const candidate of candidates) {
        const key = keyFor(candidate);
        const existing = byKey.get(key);
        if (!existing) {
          byKey.set(key, candidate);
          continue;
        }

        byKey.set(key, {
          ...existing,
          publicationTitle: existing.publicationTitle ?? candidate.publicationTitle,
          evidenceGapTags: [...new Set([...(existing.evidenceGapTags ?? []), ...(candidate.evidenceGapTags ?? [])])],
          keywords: [...new Set([...(existing.keywords ?? []), ...(candidate.keywords ?? [])])]
        });
      }
    } catch (error) {
      warnings.push(`Crossref query ${index + 1} failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }

    if (index < queries.length - 1) await sleep(450);
  }

  if (!successfulQueries) {
    warnings.push("All public scholarly-metadata discovery queries failed. No absence inference is permitted.");
  }
  if (successfulQueries && !byKey.size) {
    warnings.push("Crossref responded, but no records passed BIFROST concept-anchor filtering. This is not evidence that relevant scholarship does not exist.");
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
