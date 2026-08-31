import { NextResponse } from "next/server";
import { discoverCrossref } from "@/lib/bifrost/crossref";
import { planAcquisition } from "@/lib/bifrost/engine";
import { buildWaterlooRoute, discoverOpenAlex, mergeScholarlyCandidates } from "@/lib/bifrost/e3";
import { detectEvidenceGaps } from "@/lib/bifrost/gap";
import { discoverTrustedWebPages } from "@/lib/bifrost/trusted-search";

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

  const [crossref, openAlex, trustedWeb] = await Promise.all([
    discoverCrossref({ question, queries, rowsPerQuery: 18 }),
    discoverOpenAlex({
      question,
      evidenceGapTags: gap.needs.map((need) => need.label),
      perPage: 18
    }),
    discoverTrustedWebPages({ question, maxResults: 12 })
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

  const scholarlySample = scholarlyPlan.queue.slice(0, 4).map((item) => ({
    title: item.title,
    journal: item.publicationTitle,
    doi: item.normalizedDoi,
    priorityScore: item.priorityScore,
    waterloo: buildWaterlooRoute(item)
  }));

  const webSample = webPlan.queue.slice(0, 4).map((item) => ({
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
  const trustedDomainsOnly = trustedWeb.results.every((item) =>
    trustedWeb.routes.some((route) => item.domain === route.domain || item.domain.endsWith(`.${route.domain}`))
  );
  const wikipediaExcluded = trustedWeb.results.every((item) => !item.domain.endsWith("wikipedia.org"));

  return NextResponse.json({
    ok: crossref.successfulQueries > 0 && journalPrefillReady && trustedDomainsOnly && wikipediaExcluded,
    phase: "IV-E4C",
    version: "0.4.2",
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
      },
      trustedWeb: {
        status: trustedWeb.status,
        mode: trustedWeb.mode,
        backend: trustedWeb.backend,
        backendTrust: trustedWeb.backendTrust,
        queryCount: trustedWeb.queryCount,
        results: trustedWeb.resultCount,
        trustedDomainsOnly,
        wikipediaExcluded,
        sample: trustedWeb.results.slice(0, 6)
      }
    },
    channels: {
      scholarlyJournals: {
        candidates: scholarlyCandidates.length,
        ranked: scholarlyPlan.queue.length,
        sample: scholarlySample
      },
      researchWeb: {
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
    warnings: [...crossref.warnings, ...openAlex.warnings, ...trustedWeb.warnings, ...scholarlyPlan.warnings, ...webPlan.warnings],
    guard:
      "Acceptance verifies separate scholarship and research-web channels plus page-level trusted-web discovery filtered to the curated authority registry. Wikipedia is excluded. A trusted domain is a provenance signal, not proof that a page's claims are true."
  });
}
