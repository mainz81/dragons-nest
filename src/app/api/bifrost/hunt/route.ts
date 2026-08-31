import { NextResponse } from "next/server";
import { z } from "zod";
import { discoverCrossref } from "@/lib/bifrost/crossref";
import { planAcquisition } from "@/lib/bifrost/engine";
import { buildWaterlooRoute, discoverOpenAlex, mergeScholarlyCandidates } from "@/lib/bifrost/e3";
import { detectEvidenceGaps } from "@/lib/bifrost/gap";
import { discoverTrustedWebPages } from "@/lib/bifrost/trusted-search";

const holdingSchema = z.object({
  title: z.string().min(1),
  doi: z.string().optional(),
  abstract: z.string().optional(),
  keywords: z.array(z.string()).optional()
});

const bodySchema = z.object({
  question: z.string().min(3).max(800),
  mimirHoldings: z.array(holdingSchema).max(500).optional(),
  maxAcquire: z.number().int().min(1).max(50).optional().default(25),
  rowsPerQuery: z.number().int().min(5).max(50).optional().default(30)
});

export const runtime = "nodejs";

function withWaterloo<T extends ReturnType<typeof planAcquisition>>(plan: T) {
  return {
    ...plan,
    queue: plan.queue.map((item) => ({
      ...item,
      waterloo: buildWaterlooRoute(item)
    }))
  };
}

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const gap = detectEvidenceGaps({
      question: body.question,
      mimirHoldings: body.mimirHoldings
    });

    const discoveryQueries = gap.queryVariants.map((query, index) => ({
      query,
      evidenceGapTags:
        index === 0
          ? gap.needs.map((need) => need.label)
          : [gap.needs[index - 1]?.label ?? "question relevance"]
    }));

    const [crossref, openAlex, trustedWeb] = await Promise.all([
      discoverCrossref({
        question: body.question,
        queries: discoveryQueries,
        rowsPerQuery: body.rowsPerQuery
      }),
      discoverOpenAlex({
        question: body.question,
        evidenceGapTags: gap.needs.map((need) => need.label),
        perPage: Math.min(body.rowsPerQuery, 50)
      }),
      discoverTrustedWebPages({
        question: body.question,
        maxResults: 40
      })
    ]);

    const combinedCandidates = mergeScholarlyCandidates(crossref.candidates, openAlex.candidates);
    const scholarlyCandidates = crossref.candidates.filter((candidate) => Boolean(candidate.publicationTitle));
    const journalPool = scholarlyCandidates.length ? scholarlyCandidates : crossref.candidates;

    const webCandidates = openAlex.status === "AVAILABLE"
      ? openAlex.candidates
      : crossref.candidates.filter((candidate) => Boolean(candidate.url));
    const webSource = openAlex.status === "AVAILABLE" ? "OPENALEX" : "CROSSREF_PUBLISHER_WEB_FALLBACK";

    const mergedPlan = withWaterloo(planAcquisition({
      question: body.question,
      candidates: combinedCandidates,
      evidenceGapTags: gap.needs.map((need) => need.label),
      maxAcquire: body.maxAcquire
    }));

    const scholarlyPlan = withWaterloo(planAcquisition({
      question: body.question,
      candidates: journalPool,
      evidenceGapTags: gap.needs.map((need) => need.label),
      maxAcquire: body.maxAcquire
    }));

    const webPlan = withWaterloo(planAcquisition({
      question: body.question,
      candidates: webCandidates,
      evidenceGapTags: gap.needs.map((need) => need.label),
      maxAcquire: body.maxAcquire
    }));

    const warnings = [
      ...crossref.warnings,
      ...openAlex.warnings,
      ...trustedWeb.warnings,
      ...mergedPlan.warnings
    ];

    return NextResponse.json({
      ok: true,
      phase: "IV-E4C",
      version: "0.4.2",
      mode: "HUGINN_THREE_LANE_PAGE_LEVEL_DISCOVERY_PLUS_MIMIR_INTAKE",
      discovery: {
        source: "HUGINN",
        combinedCandidateCount: combinedCandidates.length,
        crossref: {
          status: crossref.successfulQueries > 0 ? "AVAILABLE" : "UNAVAILABLE",
          queryCount: crossref.queryCount,
          successfulQueries: crossref.successfulQueries,
          candidateCount: crossref.candidateCount
        },
        openAlex: {
          status: openAlex.status,
          candidateCount: openAlex.candidateCount
        },
        trustedWeb: {
          status: trustedWeb.status,
          sourceCount: trustedWeb.routes.length,
          pageResultCount: trustedWeb.resultCount,
          queryCount: trustedWeb.queryCount,
          mode: trustedWeb.mode,
          backend: trustedWeb.backend,
          backendTrust: trustedWeb.backendTrust
        }
      },
      channels: {
        scholarlyJournals: {
          label: "SCHOLARLY JOURNALS",
          source: "CROSSREF",
          candidateCount: journalPool.length,
          queue: scholarlyPlan.queue
        },
        webResults: {
          label: "HUGINN RESEARCH WEB",
          source: webSource,
          sourceStatus: openAlex.status,
          candidateCount: webCandidates.length,
          queue: webPlan.queue
        },
        trustedWeb: {
          label: "HUGINN TRUSTED WEB",
          source: trustedWeb.mode === "PAGE_LEVEL_SEARXNG" ? "SEARXNG_TRUSTED_DOMAIN_FILTER" : "CURATED_AUTHORITATIVE_REGISTRY",
          sourceStatus: trustedWeb.status,
          mode: trustedWeb.mode,
          backend: trustedWeb.backend,
          backendTrust: trustedWeb.backendTrust,
          candidateCount: trustedWeb.resultCount,
          pageResults: trustedWeb.results,
          routes: trustedWeb.routes,
          guard: trustedWeb.resultCount
            ? "Trusted Web now contains actual page-level search results returned by SearXNG and then filtered against BIFRÖST's curated authoritative-domain registry. Wikipedia and non-registry domains are rejected. Source authority is not the same as claim truth; open each page and inspect its evidence and date."
            : "Page-level trusted-web search was unavailable or returned no trusted-domain pages, so BIFRÖST has fallen back to ranked authoritative source gateways. No absence inference is permitted."
        }
      },
      waterloo: {
        routing: "OMNI_DEEP_LINKS_WITH_ARTICLE_DOI_AND_JOURNAL_PREFILL",
        holdingsVerification: "RESEARCHER_CONFIRMED_IN_OMNI",
        alumniRemoteScope: "SELECTED_ELECTRONIC_RESOURCES",
        credentialHandling: "NONE"
      },
      gap,
      plan: mergedPlan,
      warnings,
      guard:
        "Huginn separates formal scholarship, scholarly research-web discovery, and trusted non-journal page-level web discovery. Trusted Web is domain-filtered after search and does not treat source reputation as proof of any claim. BIFRÖST creates pre-filled Waterloo Omni searches but does not claim Waterloo holdings or alumni entitlement until Omni confirms them."
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "INVALID_BIFROST_HUNT_REQUEST", issues: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "BIFROST_IV_E4C_FAILURE",
        message: error instanceof Error ? error.message : "Unknown IV-E4C error"
      },
      { status: 500 }
    );
  }
}
