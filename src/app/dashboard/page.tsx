import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { LinkOut } from "@/components/LinkOut";
import { SectionTitle } from "@/components/SectionTitle";
import { TargetSelectors } from "@/components/TargetSelectors";
import { TasksPanel } from "@/components/TasksPanel";
import { listRepos, listWorkflowRuns } from "@/lib/github";
import { listDeployments, listProjects } from "@/lib/vercel";
import { listModels, listSpaces } from "@/lib/hf";
import { formatRelativeFromNow } from "@/lib/time";

type SearchParams = Record<string, string | string[] | undefined>;

function pickFirst(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const gh = pickFirst(searchParams.gh); // "owner/repo"
  const vc = pickFirst(searchParams.vc); // projectId
  const hf = pickFirst(searchParams.hf);

  const [reposRes, projectsRes] = await Promise.allSettled([listRepos(100), listProjects(100)]);
  const repos = reposRes.status === "fulfilled" ? reposRes.value : [];
  const projects = projectsRes.status === "fulfilled" ? projectsRes.value : [];

  const [owner, repo] = (gh ?? "").split("/");
  const ghSelectedOk = Boolean(owner && repo);

  const [runsRes, deploymentsRes, modelsRes, spacesRes] = await Promise.allSettled([
    ghSelectedOk ? listWorkflowRuns(owner!, repo!, 10) : Promise.resolve([]),
    vc ? listDeployments({ projectId: vc, limit: 10 }) : Promise.resolve([]),
    hf ? listModels(hf, 10) : Promise.resolve([]),
    hf ? listSpaces(hf, 10) : Promise.resolve([])
  ]);

  const runs = runsRes.status === "fulfilled" ? runsRes.value : [];
  const deployments = deploymentsRes.status === "fulfilled" ? deploymentsRes.value : [];
  const models = modelsRes.status === "fulfilled" ? modelsRes.value : [];
  const spaces = spacesRes.status === "fulfilled" ? spacesRes.value : [];

  const githubConnected = reposRes.status === "fulfilled" && repos.length > 0;
  const vercelConnected = projectsRes.status === "fulfilled" && projects.length > 0;
  const hfConnected = Boolean(hf);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Dragon’s Nest</h1>
          <div className="flex flex-wrap gap-2">
            <Badge tone={githubConnected ? "good" : "warn"}>GitHub: {githubConnected ? "Connected" : "Not connected"}</Badge>
            <Badge tone={vercelConnected ? "good" : "warn"}>Vercel: {vercelConnected ? "Connected" : "Not connected"}</Badge>
            <Badge tone={hfConnected ? "good" : "neutral"}>HF: {hfConnected ? hf : "Optional"}</Badge>
          </div>
        </div>

        <p className="text-sm text-muted">
          Choose targets above, and the dashboard becomes your live cockpit. Tokens are never exposed to the browser.
        </p>

        <TargetSelectors
          repos={repos}
          projects={projects}
          selectedRepo={gh}
          selectedProjectId={vc}
          hfUser={hf}
        />
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Vercel deployments</SectionTitle>
          {!vc && <div className="text-sm text-muted">Pick a Vercel project to see deployments.</div>}
          {vc && deployments.length === 0 && (
            <div className="text-sm text-muted">No deployments found (or token lacks access).</div>
          )}
          <ul className="space-y-2 text-sm">
            {deployments.slice(0, 10).map((d) => (
              <li key={d.uid} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/5 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{d.name ?? d.uid}</div>
                  <div className="text-xs text-muted">
                    {d.target ?? "unknown"} · {formatRelativeFromNow(d.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted">{d.state ?? "unknown"}</span>
                  {d.url ? (
                    <LinkOut href={`https://${d.url}`}>open</LinkOut>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle>GitHub workflow runs</SectionTitle>
          {!ghSelectedOk && <div className="text-sm text-muted">Pick a GitHub repo to see workflow runs.</div>}
          {ghSelectedOk && runs.length === 0 && (
            <div className="text-sm text-muted">No runs found (or token lacks access).</div>
          )}
          <ul className="space-y-2 text-sm">
            {runs.slice(0, 10).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/5 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.name ?? r.display_title ?? `Run #${r.id}`}</div>
                  <div className="text-xs text-muted">
                    {r.head_branch ?? "—"} · {formatRelativeFromNow(r.created_at)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted">{r.conclusion ?? r.status ?? "unknown"}</span>
                  {r.html_url ? <LinkOut href={r.html_url}>open</LinkOut> : <span className="text-xs text-muted">—</span>}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle>Hugging Face models</SectionTitle>
          {!hf && <div className="text-sm text-muted">Add an HF username above to see models.</div>}
          {hf && models.length === 0 && <div className="text-sm text-muted">No models found.</div>}
          <ul className="space-y-2 text-sm">
            {models.slice(0, 10).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/5 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{m.id}</div>
                  <div className="text-xs text-muted">
                    {m.downloads ?? 0} downloads · {m.likes ?? 0} likes
                  </div>
                </div>
                <LinkOut href={`https://huggingface.co/${m.id}`}>open</LinkOut>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle>Hugging Face spaces</SectionTitle>
          {!hf && <div className="text-sm text-muted">Add an HF username above to see Spaces.</div>}
          {hf && spaces.length === 0 && <div className="text-sm text-muted">No spaces found.</div>}
          <ul className="space-y-2 text-sm">
            {spaces.slice(0, 10).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/5 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.id}</div>
                  <div className="text-xs text-muted">{s.likes ?? 0} likes</div>
                </div>
                <LinkOut href={`https://huggingface.co/spaces/${s.id}`}>open</LinkOut>
              </li>
            ))}
          </ul>
        </Card>

        <TasksPanel />
      </div>

      <footer className="mt-8 text-xs text-muted">
        Endpoints: <LinkOut href="/api/health">/api/health</LinkOut> · <LinkOut href="/api/badge">/api/badge</LinkOut>
      </footer>
    </main>
  );
}
