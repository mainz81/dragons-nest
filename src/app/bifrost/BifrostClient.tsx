"use client";

import Image from "next/image";
import { useState } from "react";

type HuntResponse = {
  ok: boolean;
  phase?: string;
  version?: string;
  mode?: string;
  error?: string;
  message?: string;
  guard?: string;
  warnings?: string[];
  discovery?: {
    source: string;
    queryCount: number;
    successfulQueries: number;
    candidateCount: number;
    warnings: string[];
  };
  gap?: {
    mimirContext: "AVAILABLE" | "UNAVAILABLE";
    guard: string;
    needs: Array<{
      id: string;
      label: string;
      rationale: string;
      status: string;
      localMatches: number;
    }>;
  };
  plan?: {
    candidateCount: number;
    uniqueCandidateCount: number;
    acquisitionTarget: number;
    warnings: string[];
    epistemicGuard: string;
    queue: Array<{
      id?: string;
      title: string;
      authors?: string[];
      year?: number;
      normalizedDoi?: string;
      priorityScore: number;
      downstreamMode: string;
      accessStatus?: string;
      scoreBreakdown: {
        topicalRelevance: number;
        evidenceGapFit: number;
        recency: number;
        access: number;
        rightsPenalty: number;
      };
      route: {
        doiResolverUrl?: string;
        directUrl?: string;
        waterlooCatalogueUrl: string;
        waterlooAccessInfoUrl: string;
        researcherAction: string;
      };
    }>;
  };
};

export default function BifrostClient() {
  const [question, setQuestion] = useState("How are children forming relationships with conversational AI?");
  const [data, setData] = useState<HuntResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function hunt() {
    setLoading(true);
    setData(null);
    try {
      const response = await fetch("/api/bifrost/hunt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question,
          maxAcquire: 5,
          rowsPerQuery: 7
        })
      });
      setData((await response.json()) as HuntResponse);
    } catch {
      setData({ ok: false, error: "BIFROST_NETWORK_FAILURE" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#05070b] text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <Image src="/bifrost-download.svg" alt="BIFROST sigil" width={48} height={48} className="h-12 w-12" priority />
            <div>
              <div className="text-xs tracking-[0.28em] text-amber-300">MAINLAND MYTHOS</div>
              <div className="font-serif text-2xl">BIFRÖST / IV-E2</div>
            </div>
          </div>
          <div className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-2 text-xs text-emerald-200">
            REAL CROSSREF METADATA • RIGHTS-AWARE
          </div>
        </header>

        <section className="py-20">
          <div className="text-xs tracking-[0.32em] text-amber-300">THE LIBRARIAN’S HUNT</div>
          <h1 className="mt-3 max-w-4xl font-serif text-6xl leading-none md:text-8xl">
            Find the scholarship worth crossing for.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-400">
            IV-E2 turns a research question into explicit evidence needs, launches a bounded search against real public Crossref metadata,
            deduplicates the results, and sends the best candidates through the IV-E1 acquisition planner. Waterloo availability and AI-use
            rights remain unclaimed until verified.
          </p>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/40">
            <div className="text-xs tracking-[0.22em] text-slate-500">RESEARCH INTENT</div>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="mt-4 min-h-36 w-full resize-none rounded-2xl border border-white/10 bg-black/40 p-4 text-lg outline-none transition focus:border-cyan-300/40"
            />
            <button
              onClick={hunt}
              disabled={loading || question.trim().length < 3}
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-cyan-200 via-sky-200 to-amber-200 px-5 py-4 font-bold text-slate-950 transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? "SEARCHING THE SCHOLARLY REALM…" : "ᛉ LAUNCH REAL LIBRARIAN’S HUNT"}
            </button>

            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <Metric label="DISCOVERED" value={data?.discovery?.candidateCount ?? "—"} />
              <Metric label="QUERIES" value={data?.discovery?.successfulQueries ?? "—"} />
              <Metric label="ACQUIRE" value={data?.plan?.acquisitionTarget ?? "—"} />
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-slate-400">
              <div className="font-mono text-cyan-200">CREDENTIAL BOUNDARY</div>
              BIFRÖST never receives WatIAM credentials. Waterloo authentication stays in the researcher’s normal browser session.
            </div>

            {data?.gap && (
              <div className="mt-4 rounded-2xl border border-violet-300/15 bg-violet-300/5 p-4 text-xs leading-6 text-slate-400">
                <div className="font-mono text-violet-200">MÍMIR CONTEXT: {data.gap.mimirContext}</div>
                {data.gap.guard}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs tracking-[0.22em] text-slate-500">ACQUISITION QUEUE</div>
                <h2 className="mt-1 font-serif text-3xl">The Ranked Crossing</h2>
              </div>
              {data?.phase && (
                <div className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-2 text-xs text-emerald-200">
                  {data.phase} / v{data.version}
                </div>
              )}
            </div>

            {!data && (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-500">
                Launch the hunt to search real scholarly metadata and produce a ranked acquisition plan.
              </div>
            )}

            {data && !data.ok && (
              <div className="mt-6 rounded-2xl border border-red-300/20 bg-red-300/5 p-5 text-red-200">
                {data.message ?? data.error ?? "BIFRÖST hunt failed."}
              </div>
            )}

            <div className="mt-6 space-y-3">
              {data?.plan?.queue.map((item, index) => (
                <article key={`${item.id ?? item.title}-${index}`} className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs text-amber-300">
                      {String(index + 1).padStart(2, "0")} / PRIORITY {item.priorityScore}
                    </span>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-slate-400">
                      {item.downstreamMode.replaceAll("_", " ")}
                    </span>
                  </div>
                  <h3 className="mt-3 font-serif text-xl">{item.title}</h3>
                  <div className="mt-2 text-sm text-slate-500">
                    {item.authors?.slice(0, 3).join(", ") || "Authors unavailable"} • {item.year ?? "Year unknown"}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-slate-600">
                    {item.normalizedDoi ? `DOI ${item.normalizedDoi}` : "DOI unavailable"} • {item.accessStatus ?? "ACCESS UNKNOWN"}
                  </div>

                  <div className="mt-4 grid grid-cols-5 gap-2 text-center text-[10px] text-slate-500">
                    <Score label="TOPIC" value={item.scoreBreakdown.topicalRelevance} />
                    <Score label="GAP" value={item.scoreBreakdown.evidenceGapFit} />
                    <Score label="RECENT" value={item.scoreBreakdown.recency} />
                    <Score label="ACCESS" value={item.scoreBreakdown.access} />
                    <Score label="RIGHTS" value={item.scoreBreakdown.rightsPenalty} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.route.doiResolverUrl && (
                      <a
                        href={item.route.doiResolverUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 text-xs text-cyan-200 transition hover:bg-cyan-300/10"
                      >
                        OPEN DOI ↗
                      </a>
                    )}
                    <a
                      href={item.route.waterlooCatalogueUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-xs text-amber-200 transition hover:bg-amber-300/10"
                    >
                      SEARCH WATERLOO ↗
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {data?.gap?.needs?.length ? (
          <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.025] p-6">
            <div className="text-xs tracking-[0.22em] text-amber-300">EVIDENCE NEED MAP</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.gap.needs.map((need) => (
                <div key={need.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="font-serif text-lg">{need.label}</div>
                  <div className="mt-2 text-xs leading-5 text-slate-500">{need.rationale}</div>
                  <div className="mt-3 font-mono text-[10px] text-violet-200">{need.status.replaceAll("_", " ")}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {(data?.guard || data?.plan?.epistemicGuard) && (
          <section className="mt-6 rounded-3xl border border-violet-300/20 bg-violet-300/5 p-6">
            <div className="text-xs tracking-[0.22em] text-violet-200">EPISTEMIC GUARD</div>
            <p className="mt-2 leading-7 text-slate-300">{data.guard}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{data.plan?.epistemicGuard}</p>
          </section>
        )}

        {data?.warnings?.length ? (
          <section className="mt-6 rounded-3xl border border-amber-300/20 bg-amber-300/5 p-6 text-sm leading-6 text-amber-100/80">
            {data.warnings.join(" ")}
          </section>
        ) : null}

        <footer className="py-20 text-center text-sm text-slate-600">
          ᛉ BIFRÖST • REAL METADATA DISCOVERY • SURGICAL ACQUISITION • ZERO CREDENTIAL ABUSE
        </footer>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="font-serif text-2xl text-slate-100">{value}</div>
      <div className="mt-1 text-[9px] tracking-wider text-slate-600">{label}</div>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/30 p-2">
      <div className={value < 0 ? "text-rose-300" : "text-cyan-200"}>{value}</div>
      <div className="mt-1">{label}</div>
    </div>
  );
}
