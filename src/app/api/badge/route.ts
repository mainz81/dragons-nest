import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const github = Boolean(env.GITHUB_TOKEN);
  const vercel = Boolean(env.VERCEL_TOKEN);

  const status = github && vercel ? "OK" : "SETUP";
  const right = github && vercel ? "READY" : "NEEDS TOKENS";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="260" height="28" role="img" aria-label="Dragon's Nest: ${esc(status)}">
  <defs>
    <linearGradient id="g" x2="0" y2="100%">
      <stop offset="0" stop-color="#fff" stop-opacity=".08"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="260" height="28" rx="8" fill="#111"/>
  <rect width="260" height="28" rx="8" fill="url(#g)"/>
  <text x="12" y="19" fill="#fff" font-family="ui-sans-serif, system-ui" font-size="12">Dragon's Nest</text>
  <text x="180" y="19" fill="#fff" fill-opacity=".85" font-family="ui-sans-serif, system-ui" font-size="12">${esc(right)}</text>
</svg>
`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
