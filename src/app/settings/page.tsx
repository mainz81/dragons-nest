import { Card } from "@/components/Card";
import { LinkOut } from "@/components/LinkOut";
import { SectionTitle } from "@/components/SectionTitle";

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Settings</h1>
      <p className="mb-6 text-sm text-muted">
        This page is intentionally simple. Most configuration is done via environment variables.
      </p>

      <Card>
        <SectionTitle>Environment variables</SectionTitle>
        <div className="space-y-3 text-sm">
          <div>
            <div className="font-medium">GITHUB_TOKEN</div>
            <div className="text-muted">
              A GitHub personal access token (fine-grained or classic). Needs read access to repos and Actions.
            </div>
          </div>

          <div>
            <div className="font-medium">VERCEL_TOKEN</div>
            <div className="text-muted">A Vercel access token with access to your account or team.</div>
          </div>

          <div>
            <div className="font-medium">VERCEL_TEAM_ID (optional)</div>
            <div className="text-muted">If your projects live under a team, set the teamId here.</div>
          </div>

          <div>
            <div className="font-medium">HF_TOKEN (optional)</div>
            <div className="text-muted">
              Optional. Only needed for private Hugging Face repos or higher rate limits.
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-6 text-sm text-muted">
        Back to <LinkOut href="/dashboard">Dashboard</LinkOut>.
      </div>
    </main>
  );
}
