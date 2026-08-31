import { NextResponse } from "next/server";
import { z } from "zod";
import { discoverCrossref } from "@/lib/bifrost/crossref";
import { planAcquisition } from "@/lib/bifrost/engine";
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

    const discovery = await discoverCrossref({
      question: body.question,
      queries: discoveryQueries,
      rowsPerQuery: body.rowsPerQuery
    });

    const plan = planAcquisition({
      question: body.question,
      candidates: discovery.candidates,
      evidenceGapTags: gap.needs.map((need) => need.label),
      maxAcquire: body.maxAcquire
    });

    return NextResponse.json({
      ok: true,
      phase: "IV-E2",
      version: "0.2.1",
      mode: "REAL_PUBLIC_SCHOLARLY_METADATA",
      discovery: {
        source: discovery.source,
        queryCount: discovery.queryCount,
        successfulQueries: discovery.successfulQueries,
        candidateCount: discovery.candidateCount,
        warnings: discovery.warnings
      },
      gap,
      plan,
      warnings: [...discovery.warnings, ...plan.warnings],
      guard:
        "Crossref results are real public bibliographic metadata filtered through question-level concept anchors. BIFROST has not verified Waterloo subscription availability, full-text rights, or AI-use permission unless explicitly represented by metadata; unknown rights remain held for review."
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
        error: "BIFROST_IV_E2_FAILURE",
        message: error instanceof Error ? error.message : "Unknown IV-E2 error"
      },
      { status: 500 }
    );
  }
}
