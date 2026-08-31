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
    discoverCrossref({ question, queries, rowsPerQuery: 18 }),
    discoverOpenAlex({
      question,
      evidenceGapTags: gap.needs.map((need) => need.label),
      perPage: 18
    })
  ]);

  const combinedCandidates = mergeScholarlyCandidates(crossref.candidates, openAlex.candidates);
  const journalPool = crossref.candidates.filter((candidate) => Boolean(candidate.publicationTitle));
  const scholarlyCandidates = journalPool.length ? journalPool : crossref.candidates;
  const webCandidates = openAlex.status === "AVAILABLE"
    ? openAlex.candidates
    : crossref.candidates.filter((candidate) => Boolean(candidate.url));

  const scholarlyPlan = planAcquisition({
    question,
    candidates: scholarlyCandidates,
    evidenceGapTags: gap.needs.map((need) => need.label),
    maxAcquire: 12
  });
  const webPlan = planAcquisition({
    question,
    candidates: webCandidates,
    evidenceGapTags: gap.needs.map((need) => need.label),
    maxAcquire: 12
  });

  const scholarlySample = scholarlyPlan.queue.slice(0, 5).map((item) => ({
    title: item.title,
    journal: item.publicationTitle,
    doi: item.normalizedDoi,
    priorityScore: item.priorityScore,
    waterloo: buildWaterlooRoute(item)
  }));

  const webSample = webPlan.queue.slice(0, 5).map((item) => ({
    title: item.title,
    journal: item.publicationTitle,
    doi: item.normalizedDoi,
    priorityScore: item.priorityScore,
    webUrl: item.url,
    waterloo: buildWaterlooRoute(item)
  }));

  const journalPrefillReady = scholarlySample.some((item) =>
    Boolean(item.journal && item.waterloo.omniJournalSearchUrl?.includes("ocul-wtl.primo.exlibrisgroup.com/discovery/search"))
  );

  return NextResponse.json({
    ok: crossref.successfulQueries > 0 && journalPrefillReady,
    phase: "IV-E3.1",
    version: "0.3.1",
    discovery: {
      combinedCandidates: combinedCandidates.length,
      crossref: {
        status: crossref.successfulQueries > 0 ? "AVAILABLE" : "UNAVAILABLE",
        queryCount: crossref.queryCount,
        candidates: crossref.candidateCount
      },
      openAlex: {
        status: openAlex.status,
        candidates: openAlex.candidateCount
      }
    },
    channels: {
      scholarlyJournals: {
        candidates: scholarlyCandidates.length,
        ranked: scholarlyPlan.queue.length,
        sample: scholarlySample
      },
      webResults: {
        source: openAlex.status === "AVAILABLE" ? "OPENALEX" : "CROSSREF_PUBLISHER_WEB_FALLBACK",
        candidates: webCandidates.length,
        ranked: webPlan.queue.length,
        sample: webSample
      }
    },
    waterloo: {
      journalPrefillReady,
      holdingsClaimed: false,
      credentialHandling: "NONE"
    },
    warnings: [...crossref.warnings, ...openAlex.warnings, ...scholarlyPlan.warnings, ...webPlan.warnings],
    guard:
      "Acceptance verifies deeper ranked discovery, separate scholarly and research-web channels, and Waterloo Omni links pre-filled with journal/publication titles where metadata exists. It does not assert Waterloo holdings or licence permissions."
  });
}
