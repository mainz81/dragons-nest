import { env } from "@/lib/env";

export type VercelProject = { id: string; name: string };
export type VercelDeployment = {
  uid: string;
  name?: string;
  url?: string | null;
  state?: string;
  createdAt?: number;
  target?: "production" | "preview" | string;
};

function headers() {
  const h: Record<string, string> = {};
  if (env.VERCEL_TOKEN) h.Authorization = `Bearer ${env.VERCEL_TOKEN}`;
  return h;
}

async function vcFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`Vercel API failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function listProjects(limit = 50): Promise<VercelProject[]> {
  if (!env.VERCEL_TOKEN) return [];
  const url = new URL("https://api.vercel.com/v10/projects");
  url.searchParams.set("limit", String(Math.min(limit, 100)));
  if (env.VERCEL_TEAM_ID) url.searchParams.set("teamId", env.VERCEL_TEAM_ID);

  const data = await vcFetch<{ projects: Array<{ id: string; name: string }> }>(url.toString());
  return (data.projects ?? []).map((p) => ({ id: p.id, name: p.name }));
}

export async function listDeployments(opts: {
  projectId?: string;
  limit?: number;
  target?: "production" | "preview";
}): Promise<VercelDeployment[]> {
  if (!env.VERCEL_TOKEN) return [];
  const url = new URL("https://api.vercel.com/v6/deployments");
  if (opts.projectId) url.searchParams.set("projectId", opts.projectId);
  url.searchParams.set("limit", String(Math.min(opts.limit ?? 10, 100)));
  if (opts.target) url.searchParams.set("target", opts.target);
  if (env.VERCEL_TEAM_ID) url.searchParams.set("teamId", env.VERCEL_TEAM_ID);

  const data = await vcFetch<{ deployments: VercelDeployment[] }>(url.toString());
  return data.deployments ?? [];
}
