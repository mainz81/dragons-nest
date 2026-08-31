import { NextResponse } from "next/server";
import { z } from "zod";
import { BIFROST_DEMO_CANDIDATES } from "@/lib/bifrost/demo-candidates";
import { planAcquisition } from "@/lib/bifrost/engine";

const rights = z.enum(["PERMITTED", "RESTRICTED", "UNKNOWN"]);
const access = z.enum(["OPEN_ACCESS", "WATERLOO_REMOTE", "WATERLOO_ON_CAMPUS", "UNKNOWN"]);

const candidateSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  authors: z.array(z.string()).optional(),
  year: z.number().int().min(1000).max(3000).optional(),
  doi: z.string().optional(),
  url: z.string().url().optional(),
  abstract: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  evidenceGapTags: z.array(z.string()).optional(),
  accessStatus: access.optional(),
  downloadRights: rights.optional(),
  aiUseStatus: rights.optional(),
  tdmStatus: rights.optional()
});

const bodySchema = z.object({
  question: z.string().min(3),
  candidates: z.array(candidateSchema).optional(),
  evidenceGapTags: z.array(z.string()).optional(),
  maxAcquire: z.number().int().min(1).max(12).optional(),
  demo: z.boolean().optional().default(false)
});

export async function GET() {
  const plan = planAcquisition({
    question: "How are children forming relationships with conversational AI?",
    candidates: BIFROST_DEMO_CANDIDATES,
    evidenceGapTags: ["longitudinal", "developmental", "measurement"],
    maxAcquire: 5
  });

  return NextResponse.json({
    ok: true,
    mode: "IV_E1_SMOKE_TEST",
    fixtureNotice: "All candidate titles in this smoke test are clearly labeled demonstration fixtures, not claims about real publications.",
    plan
  });
}

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const candidates = body.demo ? BIFROST_DEMO_CANDIDATES : body.candidates ?? [];

    const plan = planAcquisition({
      question: body.question,
      candidates,
      evidenceGapTags: body.evidenceGapTags,
      maxAcquire: body.maxAcquire
    });

    return NextResponse.json({
      ok: true,
      mode: body.demo ? "DEMO_FIXTURE" : "CALLER_SUPPLIED_CANDIDATES",
      plan
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "INVALID_BIFROST_REQUEST", issues: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "BIFROST_PLANNER_FAILURE",
        message: error instanceof Error ? error.message : "Unknown planner error"
      },
      { status: 500 }
    );
  }
}
