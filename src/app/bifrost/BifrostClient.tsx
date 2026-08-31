"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

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

const INTAKE_STORAGE_KEY = "mainland-mythos-bifrost-intake-v1";

function itemKey(item: QueueItem): string {
  return item.normalizedDoi || item.id || `${item.title.toLowerCase()}::${item.year ?? "unknown"}`;
}

function cleanRis(value?: string): string {
  return (value ?? "").replace(/[\r\n]+/g, " ").trim();
}

function toRis(item: QueueItem): string {
  const lines = ["TY  - JOUR", `TI  - ${cleanRis(item.title)}`];
  for (const author of item.authors ?? []) lines.push(`AU  - ${cleanRis(author)}`);
  if (item.year) lines.push(`PY  - ${item.year}`);
  if (item.publicationTitle) lines.push(`JO  - ${cleanRis(item.publicationTitle)}`);
  if (item.normalizedDoi) lines.push(`DO  - ${item.normalizedDoi}`);
  const url = item.route.directUrl || item.route.doiResolverUrl;
  if (url) lines.push(`UR  - ${url}`);
  lines.push("N1  - Staged by MAINLAND MYTHOS BIFROST. Full-text acquisition and AI use remain subject to source rights and Waterloo licence terms.");
  lines.push("ER  - ");
  return lines.join("\n");
}

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function BifrostClient() {
  const [question, setQuestion] = useState("How are children forming relationships with conversational AI?");
  const [data, setData] = useState<HuntResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState<Channel>("scholarly");
  const [intake, setIntake] = useState<QueueItem[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(INTAKE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as QueueItem[];
      if (Array.isArray(parsed)) setIntake(parsed);
    } catch {
      // Corrupt local state should never block research.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(intake));
    } catch {
      // Storage failure is non-fatal; export remains available for the current session.
    }
  }, [intake]);

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

  function toggleIntake(item: QueueItem) {
    const key = itemKey(item);
    setIntake((current) => {
      const exists = current.some((entry) => itemKey(entry) === key);
      return exists ? current.filter((entry) => itemKey(entry) !== key) : [...current, item];
    });
  }

  function exportRis() {
    if (!intake.length) return;
    const ris = intake.map(toRis).join("\n\n");
    downloadText("bifrost-zotero-intake.ris", ris, "application/x-research-info-systems;charset=utf-8");
  }

  function exportManifest() {
    if (!intake.length) return;
    const manifest = {
      system: "MAINLAND MYTHOS",
      bridge: "BIFROST",
      phase: "IV-E4A",
      exportedAt: new Date().toISOString(),
      researchIntent: question,
      count: intake.length,
      doctrine: {
        metadataOnlyExport: true,
        credentialsIncluded: false,
        fullTextIncluded: false,
        rightsReviewRequiredBeforeMimirIngest: true
      },
      items: intake.map((item) => ({
        key: itemKey(item),
        title: item.title,
        publicationTitle: item.publicationTitle,
        authors: item.authors ?? [],
        year: item.year,
        doi: item.normalizedDoi,
        priorityScore: item.priorityScore,
        accessStatus: item.accessStatus,
        downstreamMode: item.downstreamMode,
        publicUrl: item.route.directUrl,
        doiUrl: item.route.doiResolverUrl,
        waterloo: {
          holdingsStatus: item.waterloo.holdingsStatus,
          articleSearch: item.waterloo.omniTitleSearchUrl,
          journalSearch: item.waterloo.omniJournalSearchUrl,
          doiSearch: item.waterloo.omniDoiSearchUrl
        }
      }))
    };
    downloadText("bifrost-intake-manifest.json", JSON.stringify(manifest, null, 2), "application/json;charset=utf-8");
  }

  const active = useMemo(() => {
    if (!data?.channels) return undefined;
    return channel === "scholarly" ? data.channels.scholarlyJournals : data.channels.webResults;
  }, [data, channel]);

  const intakeKeys = useMemo(() => new Set(intake.map(itemKey)), [intake]);
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
              <div className="font-serif text-2xl">BIFRÖST / IV-E4A</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 text-xs text-cyan-100">
              HUGINN DUAL-CHANNEL DISCOVERY
            </div>
            <div className="rounded-full border border-violet-300/20 bg-violet-300/5 px-3 py-2 text-xs text-violet-100">
              MÍMIR INTAKE {intake.length}
            </div>
          </div>
        </header>

        <section className="py-16 md:py-20">
          <div className="text-xs tracking-[0.32em] text-amber-300">THE LIBRARIAN’S HUNT</div>
          <h1 className="mt-3 max-w-5xl font-serif text-6xl leading-none md:text-8xl">
            Search wide. Rank hard. Carry only what matters.
          </h1>
          <p className="mt-6 max-w-4xl text-lg leading-8 text-slate-400">
            BIFRÖST now moves beyond discovery. Rank scholarly publications and Huginn research-web results, cross into Waterloo with article, DOI, or journal already filled in, then stage the strongest sources in a persistent Mímir Intake Dock and export clean metadata directly into Zotero-compatible RIS.
          </p>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
          <aside className="space-y-5">
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
                {loading ? "HUGINN IS FLYING DEEP…" : "ᛉ LAUNCH DEEP HUGINN + BIFRÖST"}
              </button>

              <div className="mt-6 grid grid-cols-2 gap-3 text-center">
                <Metric label="DISCOVERED" value={data?.discovery?.combinedCandidateCount ?? "—"} />
                <Metric label="JOURNAL RANKED" value={journalCount || "—"} />
                <Metric label="WEB RANKED" value={webCount || "—"} />
                <Metric label="MÍMIR INTAKE" value={intake.length} />
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
            </div>

            <div className="rounded-3xl border border-violet-300/15 bg-violet-300/[0.04] p-6 shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs tracking-[0.22em] text-violet-300">MÍMIR INTAKE DOCK</div>
                  <div className="mt-1 font-serif text-2xl">Selected scholarship</div>
                </div>
                <div className="rounded-full border border-violet-300/20 bg-violet-300/5 px-3 py-1.5 font-mono text-xs text-violet-200">
                  {intake.length}
                </div>
              </div>

              {intake.length === 0 ? (
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  Stage the strongest crossings from either channel. The dock persists in this browser between hunts.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {intake.slice(0, 5).map((item) => (
                    <div key={itemKey(item)} className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <div className="line-clamp-2 text-sm text-slate-200">{item.title}</div>
                      <div className="mt-1 font-mono text-[10px] text-slate-600">
                        {item.normalizedDoi ?? item.publicationTitle ?? "METADATA STAGED"}
                      </div>
                    </div>
                  ))}
                  {intake.length > 5 && <div className="text-xs text-slate-600">+ {intake.length - 5} more staged sources</div>}
                </div>
              )}

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={exportRis}
                  disabled={!intake.length}
                  className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-3 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  EXPORT ZOTERO RIS ↓
                </button>
                <button
                  type="button"
                  onClick={exportManifest}
                  disabled={!intake.length}
                  className="rounded-xl border border-violet-300/25 bg-violet-300/10 px-3 py-3 text-xs font-semibold text-violet-100 transition hover:bg-violet-300/15 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  EXPORT MANIFEST ↓
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIntake([])}
                disabled={!intake.length}
                className="mt-2 w-full rounded-xl border border-white/10 px-3 py-2 text-[11px] text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-30"
              >
                CLEAR INTAKE DOCK
              </button>
              <p className="mt-4 text-[11px] leading-5 text-slate-500">
                RIS and manifest exports contain metadata only — no Waterloo credentials and no licensed full text. Rights review still governs whether acquired text may enter Mímir.
              </p>
            </div>
          </aside>

          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/40 md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs tracking-[0.22em] text-slate-500">RANKED DISCOVERY</div>
                <h2 className="mt-1 font-serif text-3xl">The Ranked Crossing</h2>
              </div>
              {data?.phase && (
                <div className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-2 text-xs text-emerald-200">
                  DISCOVERY KERNEL {data.phase} / v{data.version}
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
                <ResultCard
                  key={`${item.id ?? item.title}-${index}`}
                  item={item}
                  index={index}
                  channel={channel}
                  staged={intakeKeys.has(itemKey(item))}
                  onToggleStage={() => toggleIntake(item)}
                />
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
          ᛉ BIFRÖST • HUGINN DUAL CHANNEL • WATERLOO ROUTING • MÍMIR INTAKE • ZOTERO RIS BRIDGE
        </footer>
      </div>
    </main>
  );
}

function ResultCard({
  item,
  index,
  channel,
  staged,
  onToggleStage
}: {
  item: QueueItem;
  index: number;
  channel: Channel;
  staged: boolean;
  onToggleStage: () => void;
}) {
  return (
    <article className={`rounded-2xl border bg-black/30 p-5 transition ${staged ? "border-violet-300/30 shadow-lg shadow-violet-950/20" : "border-white/10"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={channel === "scholarly" ? "font-mono text-xs text-amber-300" : "font-mono text-xs text-cyan-300"}>
          {String(index + 1).padStart(2, "0")} / PRIORITY {item.priorityScore}
        </span>
        <div className="flex flex-wrap gap-2">
          {staged && <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2 py-1 text-[10px] text-violet-100">MÍMIR STAGED</span>}
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
        <button
          type="button"
          onClick={onToggleStage}
          className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
            staged
              ? "border-violet-300/35 bg-violet-300/15 text-violet-100 hover:bg-violet-300/20"
              : "border-violet-300/20 bg-violet-300/5 text-violet-200 hover:bg-violet-300/10"
          }`}
        >
          {staged ? "REMOVE FROM MÍMIR ✓" : "QUEUE FOR MÍMIR +"}
        </button>
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
