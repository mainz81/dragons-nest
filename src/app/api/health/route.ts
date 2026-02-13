import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function GET() {
  // IMPORTANT: This endpoint should never leak tokens.
  // We report only "configured" status.
  const githubConfigured = Boolean(env.GITHUB_TOKEN);
  const vercelConfigured = Boolean(env.VERCEL_TOKEN);
  const hfConfigured = Boolean(env.HF_TOKEN);

  return NextResponse.json(
    {
      ok: true,
      github: { configured: githubConfigured },
      vercel: { configured: vercelConfigured },
      huggingface: { configured: hfConfigured }
    },
    { status: 200 }
  );
}
