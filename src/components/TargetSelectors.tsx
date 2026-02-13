"use client";

import { useRouter, useSearchParams } from "next/navigation";

type RepoOption = { full_name: string; private: boolean };
type ProjectOption = { id: string; name: string };

export function TargetSelectors({
  repos,
  projects,
  selectedRepo,
  selectedProjectId,
  hfUser
}: {
  repos: RepoOption[];
  projects: ProjectOption[];
  selectedRepo?: string;
  selectedProjectId?: string;
  hfUser?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function setParam(key: string, value?: string) {
    const next = new URLSearchParams(sp.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    router.push(`/dashboard?${next.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">GitHub repo</span>
          <select
            value={selectedRepo ?? ""}
            onChange={(e) => setParam("gh", e.target.value || undefined)}
            className="min-w-[260px] rounded-xl border border-border bg-white/5 px-3 py-2 text-sm outline-none"
          >
            <option value="">Select…</option>
            {repos.map((r) => (
              <option key={r.full_name} value={r.full_name}>
                {r.full_name}{r.private ? " (private)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Vercel project</span>
          <select
            value={selectedProjectId ?? ""}
            onChange={(e) => setParam("vc", e.target.value || undefined)}
            className="min-w-[260px] rounded-xl border border-border bg-white/5 px-3 py-2 text-sm outline-none"
          >
            <option value="">Select…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">HF username</span>
          <input
            value={hfUser ?? ""}
            onChange={(e) => setParam("hf", e.target.value || undefined)}
            placeholder="e.g. your-hf-handle"
            className="min-w-[220px] rounded-xl border border-border bg-white/5 px-3 py-2 text-sm outline-none"
          />
        </label>
      </div>

      <div className="text-xs text-muted">
        Tip: bookmark your favorite combo — the URL stores your selections.
      </div>
    </div>
  );
}
