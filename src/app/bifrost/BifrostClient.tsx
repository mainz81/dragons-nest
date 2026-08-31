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

type TrustedWebRoute = {
  id: string;
  name: string;
  domain: string;
  kind: string;
  priorityScore: number;
  searchUrl: string;
  note: string;
  rationale: string;
};

type TrustedWebPage = {
  id: string;
  title: string;
  url: string;
  snippet: string;
  domain: string;
  sourceName: string;
  kind: string;
  priorityScore: number;
  engines: string[];
  publishedDate?: string;
  sourceSearchUrl: string;
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
    trustedWeb?: {
      status: "AVAILABLE" | "DEGRADED" | "UNAVAILABLE";
      sourceCount: number;
      pageResultCount: number;
      queryCount: number;
      mode: string;
      backend: string;
      backendTrust: string;
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
    trustedWeb?: {
      label: string;
      source: string;
      sourceStatus: "AVAILABLE" | "DEGRADED" | "UNAVAILABLE";
      mode: string;
      backend: string;
      backendTrust: string;
      candidateCount: number;
      pageResults: TrustedWebPage[];
      routes: TrustedWebRoute[];
      guard: string;
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

type Channel = "scholarly" | "web" | "trusted";

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
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(intake));
    } catch {}
  }, [intake]);

  async function hunt() {
    setLoading(true);
    setData(null);
    setChannel("scholarly");
    try {
      const response = await fetch("/api/bifrost/hunt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, maxAcquire: 50, rowsPerQuery: 50 })
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
    downloadText("bifrost-zotero-intake.ris", intake.map(toRis).join("\n\n"), "application/x-research-info-systems;charset=utf-8");
  }

  function exportManifest() {
    if (!intake.length) return;
    downloadText("bifrost-intake-manifest.json", JSON.stringify({ system: "MAINLAND MYTHOS", bridge: "BIFROST", items: intake }, null, 2), "application/json;charset=utf-8");
  }

  const activeQueue = useMemo(() => {
    if (!data?.channels || channel === "trusted") return undefined;
    return channel === "scholarly" ? data.channels.scholarlyJournals : data.channels.webResults;
  }, [data, channel]);

  const trustedChannel = data?.channels?.trustedWeb;
  const trustedPages = trustedChannel?.pageResults ?? [];
  const trustedRoutes = trustedChannel?.routes ?? [];
  const intakeKeys = useMemo(() => new Set(intake.map(itemKey)), [intake]);
  const journalCount = data?.channels?.scholarlyJournals.queue.length ?? 0;
  const webCount = data?.channels?.webResults.queue.length ?? 0;
  const trustedCount = trustedPages.length || trustedRoutes.length;

  return (
    <main className="min-h-screen bg-[#05070b] text-slate-100">
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-cyan-300/20 bg-black/40 p-1.5 shadow-lg shadow-cyan-500/10">
              <Image src="/bifrost-download.svg" alt="BIFRÖST official sigil" width={64} height={64} className="h-14 w-14 md:h-16 md:w-16" priority />
            </div>
            <div>
              <div className="text-xs tracking-[0.28em] text-amber-300">MAINLAND MYTHOS</div>
              <div className="font-serif text-2xl md:text-3xl">BIFRÖST</div>
              <div className="mt-1 text-[10px] tracking-[0.18em] text-cyan-200/70">OFFICIAL SCHOLARLY BRIDGE SIGIL</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 text-xs text-cyan-100">HUGINN THREE-LANE PAGE DISCOVERY</div>
            <div className="rounded-full border border-violet-300/20 bg-violet-300/5 px-3 py-2 text-xs text-violet-100">MÍMIR INTAKE {intake.length}</div>
          </div>
        </header>

        <section className="py-16 md:py-20">
          <div className="text-xs tracking-[0.32em] text-amber-300">THE LIBRARIAN’S HUNT</div>
          <h1 className="mt-3 max-w-5xl font-serif text-6xl leading-none md:text-8xl">Search wide. Rank hard. Cross the actual page.</h1>
          <p className="mt-6 max-w-4xl text-lg leading-8 text-slate-400">BIFRÖST separates formal scholarship, the OpenAlex research-web ecosystem, and trusted non-journal pages from authoritative sources.</p>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
          <aside className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/40">
              <div className="text-xs tracking-[0.22em] text-slate-500">RESEARCH INTENT</div>
              <textarea value={question} onChange={(event) => setQuestion(event.target.value)} className="mt-4 min-h-36 w-full resize-none rounded-2xl border border-white/10 bg-black/40 p-4 text-lg outline-none transition focus:border-cyan-300/40" />
              <button onClick={hunt} disabled={loading || question.trim().length < 3} className="mt-4 w-full rounded-2xl bg-gradient-to-r from-cyan-200 via-sky-200 to-amber-200 px-5 py-4 font-bold text-slate-950 transition hover:brightness-110 disabled:opacity-50">
                {loading ? "HUGINN IS FLYING ACROSS THREE SKIES…" : "ᛉ LAUNCH 50-DEEP HUGINN + BIFRÖST"}
              </button>

              <div className="mt-6 grid grid-cols-2 gap-3 text-center">
                <Metric label="DISCOVERED" value={data?.discovery?.combinedCandidateCount ?? "—"} />
                <Metric label="JOURNAL RANKED" value={journalCount || "—"} />
                <Metric label="RESEARCH WEB" value={webCount || "—"} />
                <Metric label="TRUSTED PAGES" value={trustedPages.length || "—"} />
                <Metric label="MÍMIR INTAKE" value={intake.length} />
              </div>
            </div>

            <div className="rounded-3xl border border-violet-300/15 bg-violet-300/[0.04] p-6 shadow-2xl shadow-black/40">
              <div className="text-xs tracking-[0.22em] text-violet-300">MÍMIR INTAKE DOCK</div>
              <div className="mt-1 font-serif text-2xl">Selected scholarship</div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button type="button" disabled={!intake.length} onClick={exportRis} className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-3 text-xs font-semibold text-emerald-100 disabled:opacity-30">EXPORT ZOTERO RIS ↓</button>
                <button type="button" disabled={!intake.length} onClick={exportManifest} className="rounded-xl border border-violet-300/25 bg-violet-300/10 px-3 py-3 text-xs font-semibold text-violet-100 disabled:opacity-30">EXPORT MANIFEST ↓</button>
              </div>
            </div>
          </aside>

          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/40 md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs tracking-[0.22em] text-slate-500">RANKED DISCOVERY</div>
                <h2 className="mt-1 font-serif text-3xl">The Ranked Crossing</h2>
              </div>
            </div>

            {data?.channels ? (
              <>
                <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/20 p-1.5 text-xs">
                  <button onClick={() => setChannel("scholarly")} className={`rounded-xl px-3 py-3 ${channel === "scholarly" ? "bg-amber-300/10 text-amber-200" : "text-slate-400"}`}>SCHOLARLY JOURNALS {journalCount}</button>
                  <button onClick={() => setChannel("web")} className={`rounded-xl px-3 py-3 ${channel === "web" ? "bg-cyan-300/10 text-cyan-200" : "text-slate-400"}`}>HUGINN RESEARCH WEB {webCount}</button>
                  <button onClick={() => setChannel("trusted")} className={`rounded-xl px-3 py-3 ${channel === "trusted" ? "bg-emerald-300/10 text-emerald-200" : "text-slate-400"}`}>HUGINN TRUSTED WEB {trustedCount}</button>
                </div>

                <div className="mt-5 space-y-4">
                  {channel !== "trusted" && activeQueue?.queue.map((item, index) => (
                    <article key={itemKey(item)} className="rounded-2xl border border-white/10 bg-black/30 p-5">
                      <div className="font-mono text-xs text-amber-300">{String(index + 1).padStart(2, "0")} / PRIORITY {item.priorityScore}</div>
                      <h3 className="mt-4 font-serif text-2xl">{item.title}</h3>
                      <div className="mt-3 text-sm text-slate-500">{item.authors?.join(", ")} {item.year ? `• ${item.year}` : ""}</div>
                      {item.publicationTitle && <div className="mt-3 rounded-xl border border-amber-300/10 bg-amber-300/[0.03] p-3 text-xs text-amber-100">JOURNAL / PUBLICATION • {item.publicationTitle}</div>}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {item.route.doiResolverUrl && <a href={item.route.doiResolverUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-cyan-300/30 px-3 py-2 text-xs text-cyan-200">OPEN DOI ↗</a>}
                        {item.waterloo.omniJournalSearchUrl && <a href={item.waterloo.omniJournalSearchUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-amber-300/30 px-3 py-2 text-xs text-amber-200">SEARCH JOURNAL IN WATERLOO ↗</a>}
                        <button onClick={() => toggleIntake(item)} className="rounded-xl border border-violet-300/30 px-3 py-2 text-xs text-violet-200">{intakeKeys.has(itemKey(item)) ? "REMOVE FROM MÍMIR" : "QUEUE FOR MÍMIR"}</button>
                      </div>
                    </article>
                  ))}

                  {channel === "trusted" && trustedPages.map((page, index) => (
                    <article key={page.id} className="rounded-2xl border border-emerald-300/10 bg-black/30 p-5">
                      <div className="font-mono text-xs text-emerald-300">{String(index + 1).padStart(2, "0")} / TRUST {page.priorityScore}</div>
                      <h3 className="mt-4 font-serif text-2xl">{page.title}</h3>
                      <div className="mt-2 text-sm text-slate-500">{page.sourceName} • {page.domain}</div>
                      <p className="mt-3 text-sm leading-6 text-slate-400">{page.snippet}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <a href={page.url} target="_blank" rel="noreferrer" className="rounded-xl border border-emerald-300/30 px-3 py-2 text-xs text-emerald-200">OPEN TRUSTED PAGE ↗</a>
                        <a href={page.sourceSearchUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300">SEARCH THIS SOURCE ↗</a>
                      </div>
                    </article>
                  ))}

                  {channel === "trusted" && !trustedPages.length && trustedRoutes.map((route, index) => (
                    <article key={route.id} className="rounded-2xl border border-white/10 bg-black/30 p-5">
                      <div className="font-mono text-xs text-emerald-300">{String(index + 1).padStart(2, "0")} / TRUST {route.priorityScore}</div>
                      <h3 className="mt-4 font-serif text-2xl">{route.name}</h3>
                      <div className="mt-2 text-sm text-slate-500">{route.domain}</div>
                      <p className="mt-3 text-sm text-slate-400">{route.rationale}</p>
                      <a href={route.searchUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-xl border border-emerald-300/30 px-3 py-2 text-xs text-emerald-200">SEARCH THIS SOURCE ↗</a>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-10 text-center text-slate-500">Launch the deep hunt. BIFRÖST will rank scholarship, research-web material, and trusted non-journal pages separately.</div>
            )}
          </section>
        </section>

        <footer className="py-20 text-center text-sm text-slate-600">ᛉ BIFRÖST • OFFICIAL SIGIL RESTORED • WATERLOO ROUTING • MÍMIR INTAKE</footer>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-white/10 bg-black/30 p-3"><div className="font-serif text-2xl text-slate-100">{value}</div><div className="mt-1 text-[9px] tracking-wider text-slate-600">{label}</div></div>;
}
