import { NextResponse } from "next/server";
import { z } from "zod";
import { discoverCrossref } from "@/lib/bifrost/crossref";
import { planAcquisition } from "@/lib/bifrost/engine";
import { buildWaterlooRoute, discoverOpenAlex, mergeScholarlyCandidates } from "@/lib/bifrost/e3";
import { detectEvidenceGaps } from "@/lib/bifrost/gap";

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

    const [crossref, openAlex] = await Promise.all([
      discoverCrossref({
        question: body.question,
        queries: discoveryQueries,
        rowsPerQuery: body.rowsPerQuery
      }),
      discoverOpenAlex({
        question: body.question,
        evidenceGapTags: gap.needs.map((need) => need.label),
        perPage: Math.min(body.rowsPerQuery, 50)
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
      ...mergedPlan.warnings
    ];

    return NextResponse.json({
      ok: true,
      phase: "IV-E4A",
      version: "0.4.0",
      mode: "HUGINN_DUAL_CHANNEL_DEEP_DISCOVERY_PLUS_MIMIR_INTAKE",
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
        "Huginn ranks up to fifty crossings per channel when enough relevant metadata exists. Scholarly journals and the research-web lens remain separate discovery views. BIFRÖST creates pre-filled Waterloo Omni searches but does not claim Waterloo holdings or alumni entitlement until Omni confirms them."
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
        error: "BIFROST_IV_E4A_FAILURE",
        message: error instanceof Error ? error.message : "Unknown IV-E4A error"
      },
      { status: 500 }
    );
  }
}
