import { BIFROST_SOURCES } from "./sources";
import { Candidate, normalizeDoi, normalizeTitle, PlannedCandidate } from "./engine";

export type WaterlooRouteIntelligence = {
  status: "OPEN_ACCESS_DIRECT" | "WATERLOO_CHECK_REQUIRED";
  holdingsStatus: "OPEN_ACCESS" | "UNVERIFIED_IN_OMNI";
  alumniRemoteScope: "SELECTED_ELECTRONIC_RESOURCES";
  omniTitleSearchUrl: string;
  omniDoiSearchUrl?: string;
  catalogueUrl: string;
  accessGatewayUrl: string;
  alumniAccessInfoUrl: string;
  usageGuidelinesUrl: string;
  aiUsePolicyUrl: string;
  researcherAction: string;
  guard: string;
};

function omniSearchUrl(term: string): string {
  const params = new URLSearchParams({
    vid: BIFROST_SOURCES.waterloo.omniVid,
    lang: "en",
    sortby: "rank",
    query: `any,contains,${term}`
  });
  return `${BIFROST_SOURCES.waterloo.omniSearchBaseUrl}?${params.toString()}`;
}

export function buildWaterlooRoute(candidate: Candidate | PlannedCandidate): WaterlooRouteIntelligence {
  const doi = normalizeDoi(candidate.doi);
  const openAccess = candidate.accessStatus === "OPEN_ACCESS";

  return {
    status: openAccess ? "OPEN_ACCESS_DIRECT" : "WATERLOO_CHECK_REQUIRED",
    holdingsStatus: openAccess ? "OPEN_ACCESS" : "UNVERIFIED_IN_OMNI",
    alumniRemoteScope: BIFROST_SOURCES.waterloo.alumniRemoteScope,
    omniTitleSearchUrl: omniSearchUrl(candidate.title),
    omniDoiSearchUrl: doi ? omniSearchUrl(doi) : undefined,
    catalogueUrl: BIFROST_SOURCES.waterloo.catalogueUrl,
    accessGatewayUrl: BIFROST_SOURCES.waterloo.remoteAccessInfoUrl,
    alumniAccessInfoUrl: BIFROST_SOURCES.waterloo.alumniAccessInfoUrl,
    usageGuidelinesUrl: BIFROST_SOURCES.waterloo.usageGuidelinesUrl,
    aiUsePolicyUrl: BIFROST_SOURCES.waterloo.aiUsePolicyUrl,
    researcherAction: openAccess
      ? "Open the public source first. If you prefer the Waterloo record, verify the title or DOI in Omni."
      : "Open the pre-filled Omni search, verify Waterloo availability, then authenticate in your own browser if the selected alumni resource permits remote access.",
    guard: openAccess
      ? "Open-access status does not itself establish AI reuse permission; inspect the source licence before full text enters an AI workflow."
      : "This is a Waterloo search route, not a holdings claim. Alumni remote access is limited to selected electronic resources, and the Omni record or provider must confirm availability and usage rights."
  };
}

type OpenAlexAuthorship = {
  author?: { display_name?: string };
};

type OpenAlexLocation = {
  landing_page_url?: string;
  pdf_url?: string;
  is_oa?: boolean;
};

type OpenAlexWork = {
  id?: string;
  doi?: string;
  display_name?: string;
  title?: string;
  publication_year?: number;
  authorships?: OpenAlexAuthorship[];
  cited_by_count?: number;
  open_access?: {
    is_oa?: boolean;
    oa_status?: string;
    oa_url?: string;
  };
  primary_topic?: { display_name?: string };
  primary_location?: OpenAlexLocation;
  best_oa_location?: OpenAlexLocation;
};

type OpenAlexResponse = {
  results?: OpenAlexWork[];
};

export type OpenAlexDiscovery = {
  source: "OPENALEX";
  status: "AVAILABLE" | "UNAVAILABLE";
  candidateCount: number;
  candidates: Candidate[];
  warnings: string[];
};

function openAlexAuthors(work: OpenAlexWork): string[] {
  return (work.authorships ?? [])
    .map((entry) => entry.author?.display_name?.trim())
    .filter((value): value is string => Boolean(value));
}

function toOpenAlexCandidate(work: OpenAlexWork, evidenceGapTags: string[]): Candidate | undefined {
  const title = (work.display_name ?? work.title)?.trim();
  if (!title) return undefined;

  const doi = normalizeDoi(work.doi);
  const isOpen = Boolean(work.open_access?.is_oa);
  const publicUrl =
    work.best_oa_location?.landing_page_url ||
    work.open_access?.oa_url ||
    work.primary_location?.landing_page_url ||
    (doi ? `https://doi.org/${doi}` : work.id);

  const keywords = [
    work.primary_topic?.display_name,
    work.open_access?.oa_status ? `open access ${work.open_access.oa_status}` : undefined,
    typeof work.cited_by_count === "number" ? `citations ${work.cited_by_count}` : undefined
  ].filter((value): value is string => Boolean(value));

  return {
    id: work.id ? `openalex:${work.id.replace(/^https?:\/\/openalex\.org\//i, "")}` : undefined,
    title,
    authors: openAlexAuthors(work),
    year: work.publication_year,
    doi,
    url: publicUrl,
    keywords,
    evidenceGapTags,
    accessStatus: isOpen ? "OPEN_ACCESS" : "UNKNOWN",
    downloadRights: "UNKNOWN",
    aiUseStatus: "UNKNOWN",
    tdmStatus: "UNKNOWN"
  };
}

export async function discoverOpenAlex(input: {
  question: string;
  evidenceGapTags: string[];
  perPage?: number;
}): Promise<OpenAlexDiscovery> {
  const question = input.question.trim();
  if (!question) {
    return {
      source: "OPENALEX",
      status: "UNAVAILABLE",
      candidateCount: 0,
      candidates: [],
      warnings: ["OpenAlex discovery skipped because the research question was empty."]
    };
  }

  const params = new URLSearchParams({
    search: question,
    "per-page": String(Math.max(3, Math.min(input.perPage ?? 8, 12)))
  });

  const apiKey = process.env.BIFROST_OPENALEX_API_KEY?.trim();
  if (apiKey) params.set("api_key", apiKey);

  try {
    const response = await fetch(`${BIFROST_SOURCES.openAlex.worksApiUrl}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MAINLAND-MYTHOS-BIFROST/0.3 (https://dragons-nest.vercel.app/bifrost)"
      },
      next: { revalidate: 86400 }
    });

    if (!response.ok) {
      return {
        source: "OPENALEX",
        status: "UNAVAILABLE",
        candidateCount: 0,
        candidates: [],
        warnings: [`OpenAlex web scout returned HTTP ${response.status}; Crossref discovery remains authoritative for this hunt.`]
      };
    }

    const payload = (await response.json()) as OpenAlexResponse;
    const candidates = (payload.results ?? [])
      .map((work) => toOpenAlexCandidate(work, input.evidenceGapTags))
      .filter((candidate): candidate is Candidate => Boolean(candidate));

    return {
      source: "OPENALEX",
      status: "AVAILABLE",
      candidateCount: candidates.length,
      candidates,
      warnings: []
    };
  } catch (error) {
    return {
      source: "OPENALEX",
      status: "UNAVAILABLE",
      candidateCount: 0,
      candidates: [],
      warnings: [
        `OpenAlex web scout failed gracefully: ${error instanceof Error ? error.message : "unknown error"}. Crossref discovery remains available.`
      ]
    };
  }
}

function candidateKey(candidate: Candidate): string {
  const doi = normalizeDoi(candidate.doi);
  if (doi) return `doi:${doi}`;
  return `title:${normalizeTitle(candidate.title)}:${candidate.year ?? "unknown"}`;
}

function richerCandidate(a: Candidate, b: Candidate): Candidate {
  const aText = (a.abstract?.length ?? 0) + (a.keywords?.length ?? 0) * 20 + (a.authors?.length ?? 0) * 10;
  const bText = (b.abstract?.length ?? 0) + (b.keywords?.length ?? 0) * 20 + (b.authors?.length ?? 0) * 10;
  const base = bText > aText ? b : a;
  const other = base === a ? b : a;

  return {
    ...other,
    ...base,
    doi: normalizeDoi(base.doi) ?? normalizeDoi(other.doi),
    authors: [...new Set([...(base.authors ?? []), ...(other.authors ?? [])])],
    keywords: [...new Set([...(base.keywords ?? []), ...(other.keywords ?? [])])],
    evidenceGapTags: [...new Set([...(base.evidenceGapTags ?? []), ...(other.evidenceGapTags ?? [])])],
    accessStatus:
      base.accessStatus === "OPEN_ACCESS" || other.accessStatus === "OPEN_ACCESS"
        ? "OPEN_ACCESS"
        : base.accessStatus ?? other.accessStatus,
    downloadRights:
      base.downloadRights === "PERMITTED" || other.downloadRights === "PERMITTED"
        ? "PERMITTED"
        : base.downloadRights ?? other.downloadRights,
    aiUseStatus:
      base.aiUseStatus === "RESTRICTED" || other.aiUseStatus === "RESTRICTED"
        ? "RESTRICTED"
        : base.aiUseStatus ?? other.aiUseStatus
  };
}

export function mergeScholarlyCandidates(...groups: Candidate[][]): Candidate[] {
  const byKey = new Map<string, Candidate>();
  for (const candidate of groups.flat()) {
    if (!candidate.title?.trim()) continue;
    const key = candidateKey(candidate);
    const existing = byKey.get(key);
    byKey.set(key, existing ? richerCandidate(existing, candidate) : candidate);
  }
  return [...byKey.values()];
}
