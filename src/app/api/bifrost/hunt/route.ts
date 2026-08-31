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
  maxAcquire: z.number().int().min(1).max(12).optional().default(5),
  rowsPerQuery: z.number().int().min(3).max(15).optional().default(8)
});

export const runtime = "nodejs";

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
        perPage: Math.min(body.rowsPerQuery, 10)
      })
    ]);

    const candidates = mergeScholarlyCandidates(crossref.candidates, openAlex.candidates);

    const basePlan = planAcquisition({
      question: body.question,
      candidates,
      evidenceGapTags: gap.needs.map((need) => need.label),
      maxAcquire: body.maxAcquire
    });

    const plan = {
      ...basePlan,
      queue: basePlan.queue.map((item) => ({
        ...item,
        waterloo: buildWaterlooRoute(item)
      }))
    };

    const warnings = [...crossref.warnings, ...openAlex.warnings, ...basePlan.warnings];

    return NextResponse.json({
      ok: true,
      phase: "IV-E3",
      version: "0.3.0",
      mode: "HUGINN_PUBLIC_WEB_PLUS_WATERLOO_ROUTE_INTELLIGENCE",
      discovery: {
        source: "HUGINN",
        combinedCandidateCount: candidates.length,
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
      waterloo: {
        routing: "OMNI_DEEP_LINKS",
        holdingsVerification: "RESEARCHER_CONFIRMED_IN_OMNI",
        alumniRemoteScope: "SELECTED_ELECTRONIC_RESOURCES",
        credentialHandling: "NONE"
      },
      gap,
      plan,
      warnings,
      guard:
        "Huginn uses real public scholarly-web metadata from Crossref and, when available, OpenAlex. BIFROST creates pre-filled Waterloo Omni search routes but does not claim Waterloo owns or licenses a candidate until Omni confirms it. Licensed full text remains outside third-party AI workflows unless the applicable licence explicitly permits that use."
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
        error: "BIFROST_IV_E3_FAILURE",
        message: error instanceof Error ? error.message : "Unknown IV-E3 error"
      },
      { status: 500 }
    );
  }
}
