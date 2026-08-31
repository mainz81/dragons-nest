import { normalizeTitle } from "./engine";

export type MimirHolding = {
  title: string;
  doi?: string;
  abstract?: string;
  keywords?: string[];
};

export type EvidenceNeed = {
  id: string;
  label: string;
  rationale: string;
  queryHint: string;
  status: "QUESTION_DERIVED" | "CANDIDATE_GAP" | "POSSIBLE_LOCAL_COVERAGE";
  localMatches: number;
};

export type GapAssessment = {
  phase: "IV-E2";
  version: "0.2.1";
  mimirContext: "AVAILABLE" | "UNAVAILABLE";
  question: string;
  needs: EvidenceNeed[];
  queryVariants: string[];
  guard: string;
};

const NEEDS = [
  {
    id: "longitudinal",
    label: "Longitudinal evidence",
    triggers: ["relationship", "relationships", "development", "developing", "forming", "change", "over time", "children", "adolescent"],
    rationale: "Distinguish first-contact novelty from relationships or expectations that persist and change across repeated use.",
    queryHint: "longitudinal repeated measures"
  },
  {
    id: "measurement",
    label: "Measurement and construct validity",
    triggers: ["relationship", "trust", "attachment", "companionship", "dependency", "reliance", "bond", "social"],
    rationale: "Separate adjacent constructs such as trust, companionship, anthropomorphism, disclosure, reliance, and attachment-like expectations.",
    queryHint: "measurement trust companionship anthropomorphism"
  },
  {
    id: "developmental",
    label: "Developmental comparison",
    triggers: ["child", "children", "adolescent", "youth", "developmental", "age"],
    rationale: "Test whether findings differ by age, developmental stage, language ability, and social-cognitive maturity.",
    queryHint: "child adolescent developmental age differences"
  },
  {
    id: "synthesis",
    label: "Theory synthesis",
    triggers: ["relationship", "social", "attachment", "parasocial", "anthropomorphism", "companion", "companionship"],
    rationale: "Connect findings to established theories rather than treating conversational AI as an isolated phenomenon.",
    queryHint: "systematic review attachment parasocial anthropomorphism"
  },
  {
    id: "outcomes",
    label: "Outcomes and boundary conditions",
    triggers: ["relationship", "trust", "reliance", "dependency", "children", "adolescent"],
    rationale: "Identify when relational engagement is benign, helpful, misleading, or associated with problematic reliance.",
    queryHint: "outcomes reliance dependency wellbeing"
  }
] as const;

const QUERY_STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "for", "on", "with", "by", "is", "are",
  "was", "were", "be", "being", "been", "how", "what", "why", "when", "where", "who", "which",
  "that", "this", "these", "those", "from", "into", "as", "do", "does", "did"
]);

function textOfHolding(holding: MimirHolding): string {
  return normalizeTitle([
    holding.title,
    holding.abstract ?? "",
    ...(holding.keywords ?? [])
  ].join(" "));
}

function includesTrigger(text: string, trigger: string): boolean {
  return text.includes(normalizeTitle(trigger));
}

function compactResearchQuery(question: string): string {
  const terms = normalizeTitle(question)
    .split(" ")
    .filter((term) => (term.length > 2 || term === "ai") && !QUERY_STOP.has(term));
  return [...new Set(terms)].slice(0, 10).join(" ");
}

export function detectEvidenceGaps(input: {
  question: string;
  mimirHoldings?: MimirHolding[];
}): GapAssessment {
  const question = input.question.trim();
  if (!question) throw new Error("BIFROST IV-E2 requires a research question.");

  const normalizedQuestion = normalizeTitle(question);
  const holdings = input.mimirHoldings ?? [];
  const holdingTexts = holdings.map(textOfHolding);

  const triggered = NEEDS.filter((need) =>
    need.triggers.some((trigger) => includesTrigger(normalizedQuestion, trigger))
  );

  const selected = triggered.length ? triggered : [NEEDS[3], NEEDS[1]];

  const needs: EvidenceNeed[] = selected.map((need) => {
    const localMatches = holdingTexts.filter((text) =>
      need.triggers.some((trigger) => includesTrigger(text, trigger))
    ).length;

    let status: EvidenceNeed["status"] = "QUESTION_DERIVED";
    if (holdings.length) status = localMatches > 0 ? "POSSIBLE_LOCAL_COVERAGE" : "CANDIDATE_GAP";

    return {
      id: need.id,
      label: need.label,
      rationale: need.rationale,
      queryHint: need.queryHint,
      status,
      localMatches
    };
  });

  const baseQuery = compactResearchQuery(question) || question;
  const queryVariants = [
    baseQuery,
    ...needs.slice(0, 2).map((need) => `${baseQuery} ${need.queryHint}`)
  ];

  return {
    phase: "IV-E2",
    version: "0.2.1",
    mimirContext: holdings.length ? "AVAILABLE" : "UNAVAILABLE",
    question,
    needs,
    queryVariants: [...new Set(queryVariants)].slice(0, 3),
    guard: holdings.length
      ? "A local title or keyword match indicates possible Mimir coverage, not that the evidence need is satisfied. Passage-level review remains authoritative."
      : "Mimir holdings were not supplied to this public BIFROST runtime. These are question-derived evidence needs, not claims that the local scholarly library lacks them."
  };
}
