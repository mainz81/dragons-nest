import { NextResponse } from "next/server";
import { discoverCrossref } from "@/lib/bifrost/crossref";
import { planAcquisition } from "@/lib/bifrost/engine";
import { detectEvidenceGaps } from "@/lib/bifrost/gap";

export const runtime = "nodejs";

export async function GET() {
  const question = "How are children forming relationships with conversational AI?";
  const gap = detectEvidenceGaps({ question });
  const discovery = await discoverCrossref({
    question,
    queries: gap.queryVariants.map((query, index) => ({
      query,
      evidenceGapTags:
        index === 0
          ? gap.needs.map((need) => need.label)
          : [gap.needs[index - 1]?.label ?? "question relevance"]
    })),
    rowsPerQuery: 8
  });
  const plan = planAcquisition({
    question,
    candidates: discovery.candidates,
    evidenceGapTags: gap.needs.map((need) => need.label),
    maxAcquire: 5
  });

  return NextResponse.json({
    ok: discovery.successfulQueries > 0,
    phase: "IV-E2",
    version: "0.2.1",
    source: discovery.source,
    mimirContext: gap.mimirContext,
    queryCount: discovery.queryCount,
    successfulQueries: discovery.successfulQueries,
    realMetadataCandidates: discovery.candidateCount,
    acquisitionTarget: plan.acquisitionTarget,
    sample: plan.queue.slice(0, 5).map((item) => ({
      title: item.title,
      doi: item.normalizedDoi,
      year: item.year,
      priorityScore: item.priorityScore,
      downstreamMode: item.downstreamMode
    })),
    warnings: [...discovery.warnings, ...plan.warnings],
    guard: gap.guard
  });
}
