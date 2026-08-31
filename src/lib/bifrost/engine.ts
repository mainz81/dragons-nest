import { BIFROST_DOCTRINE, BIFROST_SOURCES } from "./sources";

export type AccessStatus =
  | "OPEN_ACCESS"
  | "WATERLOO_REMOTE"
  | "WATERLOO_ON_CAMPUS"
  | "UNKNOWN";

export type RightsStatus = "PERMITTED" | "RESTRICTED" | "UNKNOWN";

export type Candidate = {
  id?: string;
  title: string;
  authors?: string[];
  year?: number;
  doi?: string;
  url?: string;
  abstract?: string;
  keywords?: string[];
  evidenceGapTags?: string[];
  accessStatus?: AccessStatus;
  downloadRights?: RightsStatus;
  aiUseStatus?: RightsStatus;
  tdmStatus?: RightsStatus;
};

export type PlannedCandidate = Candidate & {
  normalizedDoi?: string;
  normalizedTitle: string;
  priorityScore: number;
  scoreBreakdown: {
    topicalRelevance: number;
    evidenceGapFit: number;
    recency: number;
    access: number;
    rightsPenalty: number;
  };
  downstreamMode: "MIMIR_ELIGIBLE" | "VAULT_METADATA_ONLY" | "HOLD_FOR_REVIEW";
  route: {
    doiResolverUrl?: string;
    directUrl?: string;
    waterlooCatalogueUrl: string;
    waterlooAccessInfoUrl: string;
    researcherAction: string;
  };
};

export type BifrostPlan = {
  engine: "BIFROST";
  phase: "IV-E1";
  version: "0.1.0";
  question: string;
  generatedAt: string;
  doctrine: typeof BIFROST_DOCTRINE;
  candidateCount: number;
  uniqueCandidateCount: number;
  acquisitionTarget: number;
  queue: PlannedCandidate[];
  warnings: string[];
  epistemicGuard: string;
};

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "for", "on", "with", "by",
  "is", "are", "was", "were", "be", "being", "been", "how", "what", "why", "when",
  "where", "who", "which", "that", "this", "these", "those", "from", "into", "as"
]);

export function normalizeDoi(input?: string): string | undefined {
  if (!input) return undefined;
  const value = input
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .replace(/[\s]+/g, "")
    .toLowerCase();
  return /^10\.\d{4,9}\/\S+$/i.test(value) ? value : undefined;
}

export function normalizeTitle(input: string): string {
  return input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(input: string): string[] {
  return normalizeTitle(input)
    .split(" ")
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function overlapScore(query: string[], haystack: string[], max: number): number {
  if (!query.length) return 0;
  const set = new Set(haystack);
  const hits = query.filter((t) => set.has(t)).length;
  return Math.round((hits / query.length) * max);
}

function recencyScore(year?: number): number {
  if (!year) return 0;
  const currentYear = new Date().getUTCFullYear();
  const age = Math.max(0, currentYear - year);
  return Math.max(0, 15 - Math.min(15, age));
}

function accessScore(status: AccessStatus = "UNKNOWN"): number {
  switch (status) {
    case "OPEN_ACCESS": return 10;
    case "WATERLOO_REMOTE": return 9;
    case "WATERLOO_ON_CAMPUS": return 6;
    default: return 0;
  }
}

function rightsPenalty(candidate: Candidate): number {
  if (candidate.downloadRights === "RESTRICTED") return -25;
  if (candidate.aiUseStatus === "RESTRICTED") return -12;
  if (candidate.downloadRights === "UNKNOWN" || candidate.aiUseStatus === "UNKNOWN") return -4;
  return 0;
}

function downstreamMode(candidate: Candidate): PlannedCandidate["downstreamMode"] {
  if (candidate.aiUseStatus === "RESTRICTED" || candidate.downloadRights === "RESTRICTED") {
    return "VAULT_METADATA_ONLY";
  }
  if (candidate.aiUseStatus === "PERMITTED" && candidate.downloadRights === "PERMITTED") {
    return "MIMIR_ELIGIBLE";
  }
  return "HOLD_FOR_REVIEW";
}

function routeFor(candidate: Candidate, normalizedDoi?: string): PlannedCandidate["route"] {
  return {
    doiResolverUrl: normalizedDoi
      ? `${BIFROST_SOURCES.doi.resolverBaseUrl}${normalizedDoi}`
      : undefined,
    directUrl: candidate.url,
    waterlooCatalogueUrl: BIFROST_SOURCES.waterloo.catalogueUrl,
    waterlooAccessInfoUrl: BIFROST_SOURCES.waterloo.remoteAccessInfoUrl,
    researcherAction:
      candidate.accessStatus === "OPEN_ACCESS"
        ? "Open the source directly and verify provenance before import."
        : "Open Waterloo Library in your normal browser session, authenticate yourself if prompted, then acquire only the selected source if your access and licence permit it."
  };
}

function candidateKey(candidate: Candidate): string {
  const doi = normalizeDoi(candidate.doi);
  if (doi) return `doi:${doi}`;
  return `title:${normalizeTitle(candidate.title)}:${candidate.year ?? "unknown"}`;
}

export function planAcquisition(input: {
  question: string;
  candidates: Candidate[];
  evidenceGapTags?: string[];
  maxAcquire?: number;
}): BifrostPlan {
  const question = input.question.trim();
  if (!question) throw new Error("BIFROST requires a research question.");

  const byKey = new Map<string, Candidate>();
  for (const candidate of input.candidates ?? []) {
    if (!candidate?.title?.trim()) continue;
    const key = candidateKey(candidate);
    if (!byKey.has(key)) byKey.set(key, candidate);
  }

  const queryTokens = tokens(question);
  const requestedGapTokens = tokens((input.evidenceGapTags ?? []).join(" "));

  const planned: PlannedCandidate[] = [...byKey.values()].map((candidate) => {
    const normalizedDoi = normalizeDoi(candidate.doi);
    const normalizedTitle = normalizeTitle(candidate.title);
    const body = [
      candidate.title,
      candidate.abstract ?? "",
      ...(candidate.keywords ?? []),
      ...(candidate.evidenceGapTags ?? [])
    ].join(" ");

    const topicalRelevance = overlapScore(queryTokens, tokens(body), 60);
    const evidenceGapFit = requestedGapTokens.length
      ? overlapScore(requestedGapTokens, tokens((candidate.evidenceGapTags ?? []).join(" ")), 15)
      : 0;
    const recency = recencyScore(candidate.year);
    const access = accessScore(candidate.accessStatus);
    const penalty = rightsPenalty(candidate);
    const priorityScore = Math.max(0, topicalRelevance + evidenceGapFit + recency + access + penalty);

    return {
      ...candidate,
      normalizedDoi,
      normalizedTitle,
      priorityScore,
      scoreBreakdown: {
        topicalRelevance,
        evidenceGapFit,
        recency,
        access,
        rightsPenalty: penalty
      },
      downstreamMode: downstreamMode(candidate),
      route: routeFor(candidate, normalizedDoi)
    };
  });

  planned.sort((a, b) =>
    b.priorityScore - a.priorityScore ||
    (b.year ?? 0) - (a.year ?? 0) ||
    a.normalizedTitle.localeCompare(b.normalizedTitle)
  );

  const maxAcquire = Math.max(1, Math.min(input.maxAcquire ?? 5, 12));
  const queue = planned.filter((c) => c.priorityScore > 0).slice(0, maxAcquire);

  const warnings: string[] = [];
  if (!planned.length) warnings.push("No candidate scholarship was supplied to BIFROST.");
  if (queue.some((c) => c.downstreamMode === "HOLD_FOR_REVIEW")) {
    warnings.push("At least one selected source has unknown AI/download rights and must be reviewed before full-text enters Mimir or any third-party AI workflow.");
  }
  if (queue.some((c) => c.downstreamMode === "VAULT_METADATA_ONLY")) {
    warnings.push("At least one selected source is metadata-only because a rights restriction is recorded.");
  }

  return {
    engine: "BIFROST",
    phase: "IV-E1",
    version: "0.1.0",
    question,
    generatedAt: new Date().toISOString(),
    doctrine: BIFROST_DOCTRINE,
    candidateCount: input.candidates?.length ?? 0,
    uniqueCandidateCount: planned.length,
    acquisitionTarget: queue.length,
    queue,
    warnings,
    epistemicGuard:
      "BIFROST ranks acquisition value. It does not determine whether a claim is true, and absence from an unsearched or inaccessible source universe is never negative evidence."
  };
}
