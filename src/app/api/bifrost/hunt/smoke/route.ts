import { NextResponse } from "next/server";
import { discoverCrossref } from "@/lib/bifrost/crossref";
import { planAcquisition } from "@/lib/bifrost/engine";
import { buildWaterlooRoute, discoverOpenAlex, mergeScholarlyCandidates } from "@/lib/bifrost/e3";
import { detectEvidenceGaps } from "@/lib/bifrost/gap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const question = "How are children forming relationships with conversational AI?";
  const gap = detectEvidenceGaps({ question });
  const queries = gap.queryVariants.map((query, index) => ({
    query,
    evidenceGapTags:
      index === 0
        ? gap.needs.map((need) => need.label)
        : [gap.needs[index - 1]?.label ?? "question relevance"]
  }));

  const [crossref, openAlex] = await Promise.all([
    discoverCrossref({ question, queries, rowsPerQuery: 8 }),
    discoverOpenAlex({
      question,
      evidenceGapTags: gap.needs.map((need) => need.label),
      perPage: 8
    })
  ]);

  const candidates = mergeScholarlyCandidates(crossref.candidates, openAlex.candidates);
  const plan = planAcquisition({
    question,
    candidates,
    evidenceGapTags: gap.needs.map((need) => need.label),
    maxAcquire: 5
  });

  const sample = plan.queue.slice(0, 5).map((item) => ({
    title: item.title,
    doi: item.normalizedDoi,
    year: item.year,
    priorityScore: item.priorityScore,
    downstreamMode: item.downstreamMode,
    waterloo: buildWaterlooRoute(item)
  }));

  const omniDeepLinksReady = sample.every((item) =>
    item.waterloo.omniTitleSearchUrl.includes("ocul-wtl.primo.exlibrisgroup.com/discovery/search")
  );

  return NextResponse.json({
    ok: crossref.successfulQueries > 0 && omniDeepLinksReady,
    phase: "IV-E3",
    version: "0.3.0",
    huginn: {
      crossref: {
        status: crossref.successfulQueries > 0 ? "AVAILABLE" : "UNAVAILABLE",
        candidates: crossref.candidateCount
      },
      openAlex: {
        status: openAlex.status,
        candidates: openAlex.candidateCount
      },
      combinedCandidates: candidates.length
    },
    waterloo: {
      omniDeepLinksReady,
      holdingsClaimed: false,
      alumniRemoteScope: "SELECTED_ELECTRONIC_RESOURCES",
      credentialHandling: "NONE"
    },
    acquisitionTarget: plan.acquisitionTarget,
    sample,
    warnings: [...crossref.warnings, ...openAlex.warnings, ...plan.warnings],
    guard:
      "Smoke acceptance verifies live public metadata discovery and construction of Waterloo Omni deep-search routes. It does not assert Waterloo holdings, alumni entitlement to a specific title, or AI-use permission."
  });
}
