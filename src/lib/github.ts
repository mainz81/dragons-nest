import { env } from "@/lib/env";

export type GithubRepo = { full_name: string; private: boolean };
export type GithubWorkflowRun = {
  id: number;
  name?: string;
  display_title?: string;
  event?: string;
  status?: string;
  conclusion?: string | null;
  head_branch?: string;
  html_url?: string;
  created_at?: string;
};

function headers() {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (env.GITHUB_TOKEN) h.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  return h;
}

async function ghFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    throw new Error(`GitHub API failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function listRepos(limit = 50): Promise<GithubRepo[]> {
  if (!env.GITHUB_TOKEN) return [];
  const url = new URL("https://api.github.com/user/repos");
  url.searchParams.set("per_page", String(Math.min(limit, 100)));
  url.searchParams.set("sort", "updated");
  return await ghFetch<GithubRepo[]>(url.toString());
}

export async function listWorkflowRuns(owner: string, repo: string, limit = 10) {
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/actions/runs`);
  url.searchParams.set("per_page", String(Math.min(limit, 100)));
  const data = await ghFetch<{ workflow_runs: GithubWorkflowRun[] }>(url.toString());
  return data.workflow_runs;
}
