import { env } from "@/lib/env";

export type HfModel = {
  id: string;
  private?: boolean;
  likes?: number;
  downloads?: number;
  lastModified?: string;
};

export type HfSpace = {
  id: string;
  private?: boolean;
  likes?: number;
  lastModified?: string;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithBackoff(input: RequestInfo | URL, init?: RequestInit, tries = 3) {
  let attempt = 0;
  while (true) {
    const res = await fetch(input, init);
    if (res.status !== 429 || attempt >= tries) return res;
    await sleep(400 * Math.pow(2, attempt));
    attempt++;
  }
}

function headers() {
  const h: Record<string, string> = {};
  if (env.HF_TOKEN) h.Authorization = `Bearer ${env.HF_TOKEN}`;
  return h;
}

export async function listModels(author: string, limit = 10): Promise<HfModel[]> {
  const url = new URL("https://huggingface.co/api/models");
  url.searchParams.set("author", author);
  url.searchParams.set("limit", String(limit));
  const res = await fetchWithBackoff(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`HF models failed: ${res.status}`);
  return (await res.json()) as HfModel[];
}

export async function listSpaces(author: string, limit = 10): Promise<HfSpace[]> {
  const url = new URL("https://huggingface.co/api/spaces");
  url.searchParams.set("author", author);
  url.searchParams.set("limit", String(limit));
  const res = await fetchWithBackoff(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`HF spaces failed: ${res.status}`);
  return (await res.json()) as HfSpace[];
}
