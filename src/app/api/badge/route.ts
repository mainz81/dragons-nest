import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET() {
  const github = Boolean(env.GITHUB_TOKEN);
  const vercel = Boolean(env.VERCEL_TOKEN);

  const status = github && vercel ? "OK" : "SETUP";
  const right = github && vercel ? "READY" : "NEEDS TOKENS";

  const svg = \`
<svg xmlns="http://www.w3.org/2000/svg" width="260" height="28" role="img" aria-label="Dragon's Nest: \${esc(status)}">
  <linearGradient id="g" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".08"/>
    <stop offset="1" stop-opacity=".08"/>
  </linearGradient>
  <rect rx="8" width="260" height="28" fill="#0a0a0c"/>
  <rect rx="8" x="0" y="0" width="120" height="28" fill="#1a1a20"/>
  <rect rx="8" x="118" y="0" width="142" height="28" fill="#111117"/>
  <rect rx="8" width="260" height="28" fill="url(#g)"/>
  <g fill="#f5f5fa" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" font-size="12">
    <text x="60" y="19">Dragon’s Nest</text>
    <text x="189" y="19">\${esc(right)}</text>
  </g>
</svg>\`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
