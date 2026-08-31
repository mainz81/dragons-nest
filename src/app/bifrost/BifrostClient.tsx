"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type WaterlooRoute = {
  status: "OPEN_ACCESS_DIRECT" | "WATERLOO_CHECK_REQUIRED";
  holdingsStatus: "OPEN_ACCESS" | "UNVERIFIED_IN_OMNI";
  alumniRemoteScope: "SELECTED_ELECTRONIC_RESOURCES";
  omniTitleSearchUrl: string;
  omniJournalSearchUrl?: string;
  omniDoiSearchUrl?: string;
  catalogueUrl: string;
  accessGatewayUrl: string;
  alumniAccessInfoUrl: string;
  usageGuidelinesUrl: string;
  aiUsePolicyUrl: string;
  researcherAction: string;
  guard: string;
};

type QueueItem = {
  id?: string;
  title: string;
  publicationTitle?: string;
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
  waterloo: WaterlooRoute;
};

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
    source: "HUGINN";
    combinedCandidateCount: number;
    crossref: {
      status: "AVAILABLE" | "UNAVAILABLE";
      queryCount: number;
      successfulQueries: number;
      candidateCount: number;
    };
    openAlex: {
      status: "AVAILABLE" | "UNAVAILABLE";
      candidateCount: number;
    };
  };
  channels?: {
    scholarlyJournals: {
      label: string;
      source: string;
      candidateCount: number;
      queue: QueueItem[];
    };
    webResults: {
      label: string;
      source: string;
      sourceStatus: "AVAILABLE" | "UNAVAILABLE";
      candidateCount: number;
      queue: QueueItem[];
    };
  };
  waterloo?: {
    routing: string;
    holdingsVerification: string;
    alumniRemoteScope: string;
    credentialHandling: string;
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
    acquisitionTarget: number;
    warnings: string[];
    epistemicGuard: string;
    queue: QueueItem[];
  };
};

type Channel = "scholarly" | "web";

export default function BifrostClient() {
  const [question, setQuestion] = useState("How are children forming relationships with conversational AI?");
  const [data, setData] = useState<HuntResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState<Channel>("scholarly");

  async function hunt() {
    setLoading(true);
    setData(null);
    setChannel("scholarly");
    try {
      const response = await fetch("/api/bifrost/hunt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question,
          maxAcquire: 12,
          rowsPerQuery: 18
        })
      });
      setData((await response.json()) as HuntResponse);
    } catch {
      setData({ ok: false, error: "BIFROST_NETWORK_FAILURE" });
    } finally {
      setLoading(false);
    }
  }

  const active = useMemo(() => {
    if (!data?.channels) return undefined;
    return channel === "scholarly" ? data.channels.scholarlyJournals : data.channels.webResults;
  }, [data, channel]);

  const journalCount = data?.channels?.scholarlyJournals.queue.length ?? 0;
  const webCount = data?.channels?.webResults.queue.length ?? 0;

  return (
    <main className="min-h-screen bg-[#05070b] text-slate-100">
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <Image src="/bifrost-download.svg" alt="BIFROST sigil" width={48} height={48} className="h-12 w-12" priority />
            <div>
              <div className="text-xs tracking-[0.28em] text-amber-300">MAINLAND MYTHOS</div>
              <div className="font-serif text-2xl">BIFRÖST / IV-E3.1</div>
            </div>
          </div>
          <div className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 text-xs text-cyan-100">
            HUGINN DUAL-CHANNEL DISCOVERY • WATERLOO OMNI ROUTER
          </div>
        </header>

        <section className="py-16 md:py-20">
          <div className="text-xs tracking-[0.32em] text-amber-300">THE LIBRARIAN’S HUNT</div>
          <h1 className="mt-3 max-w-5xl font-serif text-6xl leading-none md:text-8xl">
            Search wide. Rank hard. Cross precisely.
          </h1>
          <p className="mt-6 max-w-4xl text-lg leading-8 text-slate-400">
            BIFRÖST now separates the hunt into ranked scholarly publications and a second Huginn research-web channel. It searches more deeply than the earlier three-result build, then forges Waterloo Omni links with the article title, DOI, and journal title already entered whenever that metadata exists.
          </p>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
          <aside className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/40">
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
              {loading ? "HUGINN IS FLYING DEEP…" : "ᛉ LAUNCH DEEP HUGINN + BIFRÖST"}
            </button>

            <div className="mt-6 grid grid-cols-2 gap-3 text-center">
              <Metric label="DISCOVERED" value={data?.discovery?.combinedCandidateCount ?? "—"} />
              <Metric label="JOURNAL RANKED" value={journalCount || "—"} />
              <Metric label="WEB RANKED" value={webCount || "—"} />
              <Metric label="ACQUIRE" value={data?.plan?.acquisitionTarget ?? "—"} />
            </div>

            <div className="mt-6 grid gap-3">
              <RealmStatus
                name="HUGINN"
                detail={`Crossref ${data?.discovery?.crossref.status ?? "IDLE"} • OpenAlex ${data?.discovery?.openAlex.status ?? "IDLE"}`}
                tone="cyan"
              />
              <RealmStatus
                name="WATERLOO"
                detail={data?.waterloo ? "ARTICLE + DOI + JOURNAL PREFILL ACTIVE" : "ROUTER IDLE"}
                tone="amber"
              />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-slate-400">
              <div className="font-mono text-cyan-200">CREDENTIAL BOUNDARY</div>
              BIFRÖST never receives WatIAM credentials. Waterloo authentication stays in your normal browser session.
            </div>

            {data?.gap && (
              <div className="mt-4 rounded-2xl border border-violet-300/15 bg-violet-300/5 p-4 text-xs leading-6 text-slate-400">
                <div className="font-mono text-violet-200">MÍMIR CONTEXT: {data.gap.mimirContext}</div>
                {data.gap.guard}
              </div>
            )}
          </aside>

          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/40 md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs tracking-[0.22em] text-slate-500">RANKED DISCOVERY</div>
                <h2 className="mt-1 font-serif text-3xl">The Ranked Crossing</h2>
              </div>
              {data?.phase && (
                <div className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-2 text-xs text-emerald-200">
                  {data.phase} / v{data.version}
                </div>
              )}
            </div>

            {data?.channels && (
              <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/30 p-1.5">
                <ChannelButton
                  active={channel === "scholarly"}
                  onClick={() => setChannel("scholarly")}
                  label="SCHOLARLY JOURNALS"
                  count={journalCount}
                  tone="amber"
                />
                <ChannelButton
                  active={channel === "web"}
                  onClick={() => setChannel("web")}
                  label="HUGINN WEB RESULTS"
                  count={webCount}
                  tone="cyan"
                />
              </div>
            )}

            {!data && (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-10 text-center text-slate-500">
                Launch the deep hunt. BIFRÖST will rank up to twelve results in each discovery channel.
              </div>
            )}

            {data && !data.ok && (
              <div className="mt-6 rounded-2xl border border-red-300/20 bg-red-300/5 p-5 text-red-200">
                {data.message ?? data.error ?? "BIFRÖST hunt failed."}
              </div>
            )}

            {active && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>
                  SOURCE: <span className="font-mono text-slate-300">{active.source.replaceAll("_", " ")}</span>
                </span>
                <span>
                  {active.candidateCount} CANDIDATES • {active.queue.length} RANKED CROSSINGS
                </span>
              </div>
            )}

            <div className="mt-5 space-y-4">
              {active?.queue.map((item, index) => (
                <ResultCard key={`${item.id ?? item.title}-${index}`} item={item} index={index} channel={channel} />
              ))}
            </div>

            {active && active.queue.length === 0 && (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-500">
                No ranked results survived this channel’s current relevance gate. BIFRÖST does not treat that as evidence that nothing exists.
              </div>
            )}
          </section>
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
          ᛉ BIFRÖST • HUGINN DUAL CHANNEL • JOURNAL-PREFILLED WATERLOO ROUTING • SURGICAL ACQUISITION
        </footer>
      </div>
    </main>
  );
}

function ResultCard({ item, index, channel }: { item: QueueItem; index: number; channel: Channel }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={channel === "scholarly" ? "font-mono text-xs text-amber-300" : "font-mono text-xs text-cyan-300"}>
          {String(index + 1).padStart(2, "0")} / PRIORITY {item.priorityScore}
        </span>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-slate-400">
            {item.downstreamMode.replaceAll("_", " ")}
          </span>
          <span
            className={`rounded-full border px-2 py-1 text-[10px] ${
              item.waterloo.holdingsStatus === "OPEN_ACCESS"
                ? "border-emerald-300/20 bg-emerald-300/5 text-emerald-200"
                : "border-amber-300/20 bg-amber-300/5 text-amber-200"
            }`}
          >
            {item.waterloo.holdingsStatus.replaceAll("_", " ")}
          </span>
        </div>
      </div>

      <h3 className="mt-3 font-serif text-xl leading-7 md:text-2xl">{item.title}</h3>
      <div className="mt-2 text-sm text-slate-500">
        {item.authors?.slice(0, 4).join(", ") || "Authors unavailable"} • {item.year ?? "Year unknown"}
      </div>
      {item.publicationTitle && (
        <div className="mt-2 rounded-lg border border-amber-300/10 bg-amber-300/[0.03] px-3 py-2 text-xs text-amber-100/80">
          <span className="font-mono text-[10px] text-amber-300">JOURNAL / PUBLICATION</span> • {item.publicationTitle}
        </div>
      )}
      <div className="mt-2 font-mono text-[11px] text-slate-600">
        {item.normalizedDoi ? `DOI ${item.normalizedDoi}` : "DOI unavailable"} • {item.accessStatus ?? "ACCESS UNKNOWN"}
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2 text-center text-[10px] text-slate-500">
        <Score label="TOPIC" value={item.scoreBreakdown.topicalRelevance} />
        <Score label="GAP" value={item.scoreBreakdown.evidenceGapFit} />
        <Score label="RECENT" value={item.scoreBreakdown.recency} />
        <Score label="ACCESS" value={item.scoreBreakdown.access} />
        <Score label="RIGHTS" value={item.scoreBreakdown.rightsPenalty} />
      </div>

      <div className="mt-4 rounded-xl border border-amber-300/10 bg-amber-300/[0.03] p-3 text-[11px] leading-5 text-slate-500">
        <span className="font-mono text-amber-200">WATERLOO ROUTE</span> — {item.waterloo.researcherAction}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {item.waterloo.omniJournalSearchUrl && (
          <a
            href={item.waterloo.omniJournalSearchUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-amber-300/40 bg-amber-300/15 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-300/20"
            title={`Search Waterloo Omni with journal title: ${item.publicationTitle}`}
          >
            SEARCH JOURNAL IN WATERLOO ↗
          </a>
        )}
        <a
          href={item.waterloo.omniTitleSearchUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-xs text-amber-200 transition hover:bg-amber-300/10"
        >
          SEARCH ARTICLE IN WATERLOO ↗
        </a>
        {item.waterloo.omniDoiSearchUrl && (
          <a
            href={item.waterloo.omniDoiSearchUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-violet-300/20 bg-violet-300/5 px-3 py-2 text-xs text-violet-200 transition hover:bg-violet-300/10"
          >
            CHECK DOI IN WATERLOO ↗
          </a>
        )}
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
        {item.route.directUrl && (
          <a
            href={item.route.directUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-emerald-300/20 bg-emerald-300/5 px-3 py-2 text-xs text-emerald-200 transition hover:bg-emerald-300/10"
          >
            OPEN WEB SOURCE ↗
          </a>
        )}
      </div>

      <details className="mt-4 text-xs text-slate-500">
        <summary className="cursor-pointer font-mono text-slate-400">RIGHTS + ROUTE GUARD</summary>
        <p className="mt-2 leading-5">{item.waterloo.guard}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <a className="text-violet-200 underline-offset-4 hover:underline" href={item.waterloo.aiUsePolicyUrl} target="_blank" rel="noreferrer">
            Waterloo AI-use policy ↗
          </a>
          <a className="text-violet-200 underline-offset-4 hover:underline" href={item.waterloo.usageGuidelinesUrl} target="_blank" rel="noreferrer">
            Electronic-resource guidelines ↗
          </a>
        </div>
      </details>
    </article>
  );
}

function ChannelButton({
  active,
  onClick,
  label,
  count,
  tone
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone: "amber" | "cyan";
}) {
  const activeClass = tone === "amber"
    ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
    : "border-cyan-300/30 bg-cyan-300/10 text-cyan-100";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-3 text-xs font-semibold tracking-wide transition ${
        active ? activeClass : "border-transparent text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
      }`}
    >
      {label} <span className="ml-1 font-mono">{count}</span>
    </button>
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

function RealmStatus({ name, detail, tone }: { name: string; detail: string; tone: "cyan" | "amber" }) {
  const cls = tone === "cyan"
    ? "border-cyan-300/15 bg-cyan-300/5 text-cyan-100"
    : "border-amber-300/15 bg-amber-300/5 text-amber-100";
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <div className="font-serif text-lg">{name}</div>
      <div className="mt-1 font-mono text-[10px] text-slate-400">{detail}</div>
    </div>
  );
}
