export type TrustedWebSource = {
  id: string;
  name: string;
  domain: string;
  kind: "ENCYCLOPEDIA" | "GOVERNMENT" | "PUBLIC_HEALTH" | "UNIVERSITY" | "INTERNATIONAL" | "DATA" | "ARCHIVE" | "RESEARCH_INSTITUTE";
  searchBase: string;
  queryParam: string;
  baseWeight: number;
  keywords: string[];
  note: string;
};

export type TrustedWebRoute = {
  id: string;
  name: string;
  domain: string;
  kind: TrustedWebSource["kind"];
  priorityScore: number;
  searchUrl: string;
  note: string;
  rationale: string;
};

const SOURCES: TrustedWebSource[] = [
  { id: "britannica", name: "Encyclopaedia Britannica", domain: "britannica.com", kind: "ENCYCLOPEDIA", searchBase: "https://www.britannica.com/search", queryParam: "query", baseWeight: 72, keywords: ["history","science","psychology","philosophy","politics","culture","religion","technology","biography"], note: "Curated general-reference encyclopedia; non-journal context and definitions." },
  { id: "sep", name: "Stanford Encyclopedia of Philosophy", domain: "plato.stanford.edu", kind: "UNIVERSITY", searchBase: "https://plato.stanford.edu/search/searcher.py", queryParam: "query", baseWeight: 78, keywords: ["philosophy","ethics","mind","consciousness","epistemology","logic","metaphysics","artificial intelligence","ai"], note: "Expert-authored philosophy reference maintained at Stanford." },
  { id: "iep", name: "Internet Encyclopedia of Philosophy", domain: "iep.utm.edu", kind: "UNIVERSITY", searchBase: "https://iep.utm.edu/", queryParam: "s", baseWeight: 70, keywords: ["philosophy","ethics","mind","knowledge","logic","political philosophy","psychology"], note: "Scholarly philosophy reference with accessible topical entries." },
  { id: "apa", name: "American Psychological Association", domain: "apa.org", kind: "RESEARCH_INSTITUTE", searchBase: "https://www.apa.org/search", queryParam: "query", baseWeight: 82, keywords: ["psychology","children","child","adolescent","mental health","development","relationships","ai","technology","education"], note: "Professional psychology guidance, reports, explainers, and policy material." },
  { id: "who", name: "World Health Organization", domain: "who.int", kind: "PUBLIC_HEALTH", searchBase: "https://www.who.int/search", queryParam: "query", baseWeight: 84, keywords: ["health","mental health","children","adolescent","public health","disease","wellbeing","policy","ai"], note: "Authoritative global public-health guidance and evidence summaries." },
  { id: "nih", name: "U.S. National Institutes of Health", domain: "nih.gov", kind: "PUBLIC_HEALTH", searchBase: "https://search.nih.gov/search", queryParam: "query", baseWeight: 84, keywords: ["health","medicine","biomedical","mental health","children","development","neuroscience","ai","research"], note: "Federal biomedical and health information, programs, and research resources." },
  { id: "nimh", name: "National Institute of Mental Health", domain: "nimh.nih.gov", kind: "PUBLIC_HEALTH", searchBase: "https://www.nimh.nih.gov/search-nimh", queryParam: "query", baseWeight: 86, keywords: ["mental health","psychology","children","adolescent","anxiety","depression","development","technology","ai"], note: "Authoritative U.S. mental-health information and research context." },
  { id: "cdc", name: "U.S. Centers for Disease Control and Prevention", domain: "cdc.gov", kind: "PUBLIC_HEALTH", searchBase: "https://search.cdc.gov/search/", queryParam: "query", baseWeight: 80, keywords: ["health","public health","children","adolescent","development","behaviour","behavior","statistics","prevention"], note: "Public-health guidance, surveillance, and population information." },
  { id: "unicef", name: "UNICEF", domain: "unicef.org", kind: "INTERNATIONAL", searchBase: "https://www.unicef.org/search", queryParam: "query", baseWeight: 82, keywords: ["children","child","adolescent","youth","education","digital","ai","wellbeing","rights","development"], note: "Global child-development, child-rights, digital-life, and wellbeing resources." },
  { id: "unesco", name: "UNESCO", domain: "unesco.org", kind: "INTERNATIONAL", searchBase: "https://www.unesco.org/en/search", queryParam: "text", baseWeight: 78, keywords: ["education","ai","artificial intelligence","culture","ethics","children","youth","science","technology"], note: "International education, science, culture, and AI policy resources." },
  { id: "oecd", name: "OECD", domain: "oecd.org", kind: "INTERNATIONAL", searchBase: "https://www.oecd.org/search/", queryParam: "q", baseWeight: 78, keywords: ["education","children","youth","ai","economy","policy","technology","social","data"], note: "Comparative international policy, education, technology, and social data." },
  { id: "worldbank", name: "World Bank", domain: "worldbank.org", kind: "INTERNATIONAL", searchBase: "https://www.worldbank.org/en/search", queryParam: "q", baseWeight: 72, keywords: ["development","education","children","technology","ai","economy","global","poverty","policy"], note: "Global development, policy, socioeconomic, and education resources." },
  { id: "un", name: "United Nations", domain: "un.org", kind: "INTERNATIONAL", searchBase: "https://www.un.org/en/search", queryParam: "query", baseWeight: 70, keywords: ["human rights","children","ai","technology","policy","development","global","ethics"], note: "Official UN reports, policy documents, declarations, and programme material." },
  { id: "canada", name: "Government of Canada", domain: "canada.ca", kind: "GOVERNMENT", searchBase: "https://www.canada.ca/en/sr/srb.html", queryParam: "q", baseWeight: 82, keywords: ["canada","canadian","health","children","education","ai","privacy","policy","technology","psychology"], note: "Official Canadian federal policy, guidance, statistics, and programme information." },
  { id: "statcan", name: "Statistics Canada", domain: "statcan.gc.ca", kind: "DATA", searchBase: "https://www.statcan.gc.ca/en/search", queryParam: "q", baseWeight: 84, keywords: ["canada","canadian","statistics","children","youth","family","education","health","technology","population"], note: "Official Canadian population, family, health, education, and social statistics." },
  { id: "healthcanada", name: "Health Canada", domain: "canada.ca", kind: "PUBLIC_HEALTH", searchBase: "https://www.canada.ca/en/sr/srb.html", queryParam: "q", baseWeight: 80, keywords: ["health","mental health","children","youth","digital","technology","safety","canada"], note: "Canadian federal health and safety guidance." },
  { id: "nist", name: "U.S. National Institute of Standards and Technology", domain: "nist.gov", kind: "GOVERNMENT", searchBase: "https://www.nist.gov/search", queryParam: "search_api_fulltext", baseWeight: 82, keywords: ["ai","artificial intelligence","cybersecurity","standards","risk","privacy","technology","trustworthy ai"], note: "Authoritative technology standards, AI risk, cybersecurity, and measurement resources." },
  { id: "eu", name: "European Commission", domain: "commission.europa.eu", kind: "GOVERNMENT", searchBase: "https://commission.europa.eu/search_en", queryParam: "query", baseWeight: 76, keywords: ["ai","artificial intelligence","children","digital","privacy","law","regulation","policy","technology"], note: "Official European policy, regulation, digital, and AI governance material." },
  { id: "loc", name: "Library of Congress", domain: "loc.gov", kind: "ARCHIVE", searchBase: "https://www.loc.gov/search/", queryParam: "q", baseWeight: 72, keywords: ["history","culture","politics","archives","books","primary sources","media","law"], note: "Primary sources, historical collections, cultural records, and authoritative bibliographic material." },
  { id: "smithsonian", name: "Smithsonian Institution", domain: "si.edu", kind: "ARCHIVE", searchBase: "https://www.si.edu/search", queryParam: "edan_q", baseWeight: 68, keywords: ["history","science","culture","museum","anthropology","technology","education"], note: "Museum, science, history, culture, and archival reference material." },
  { id: "nasa", name: "NASA", domain: "nasa.gov", kind: "GOVERNMENT", searchBase: "https://search.nasa.gov/search", queryParam: "query", baseWeight: 76, keywords: ["space","astronomy","earth","science","technology","engineering","climate","physics"], note: "Authoritative space, Earth science, astronomy, engineering, and mission information." },
  { id: "nap", name: "National Academies Press", domain: "nap.nationalacademies.org", kind: "RESEARCH_INSTITUTE", searchBase: "https://nap.nationalacademies.org/search/", queryParam: "term", baseWeight: 82, keywords: ["science","medicine","education","ai","technology","psychology","health","policy","children"], note: "Consensus reports and expert committee publications from the U.S. National Academies." },
  { id: "royalsociety", name: "The Royal Society", domain: "royalsociety.org", kind: "RESEARCH_INSTITUTE", searchBase: "https://royalsociety.org/search/", queryParam: "q", baseWeight: 76, keywords: ["science","ai","technology","education","policy","research","ethics"], note: "Scientific reports, policy work, explainers, and historical scientific resources." },
  { id: "pew", name: "Pew Research Center", domain: "pewresearch.org", kind: "RESEARCH_INSTITUTE", searchBase: "https://www.pewresearch.org/", queryParam: "s", baseWeight: 76, keywords: ["public opinion","technology","ai","children","teens","internet","social media","religion","politics"], note: "Nonpartisan survey research and public-opinion analysis." },
  { id: "rand", name: "RAND", domain: "rand.org", kind: "RESEARCH_INSTITUTE", searchBase: "https://www.rand.org/search.html", queryParam: "query", baseWeight: 72, keywords: ["policy","health","education","ai","technology","security","children","social"], note: "Policy research, evidence reviews, and applied social-science analysis." },
  { id: "owid", name: "Our World in Data", domain: "ourworldindata.org", kind: "DATA", searchBase: "https://ourworldindata.org/search", queryParam: "q", baseWeight: 72, keywords: ["data","statistics","health","education","population","technology","global","development","mortality"], note: "Transparent data visualizations and topic syntheses with source documentation." }
];

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function scoreSource(question: string, source: TrustedWebSource): number {
  const q = ` ${normalize(question)} `;
  let score = source.baseWeight;
  for (const keyword of source.keywords) {
    const k = normalize(keyword);
    if (k && q.includes(` ${k} `)) score += k.split(" ").length > 1 ? 10 : 6;
  }
  return Math.min(100, score);
}

function buildSearchUrl(source: TrustedWebSource, question: string): string {
  const url = new URL(source.searchBase);
  url.searchParams.set(source.queryParam, question.trim());
  return url.toString();
}

export function buildTrustedWebRoutes(question: string, limit = 25): TrustedWebRoute[] {
  const clean = question.trim();
  if (!clean) return [];

  return SOURCES
    .map((source) => {
      const priorityScore = scoreSource(clean, source);
      return {
        id: source.id,
        name: source.name,
        domain: source.domain,
        kind: source.kind,
        priorityScore,
        searchUrl: buildSearchUrl(source, clean),
        note: source.note,
        rationale: priorityScore >= 88
          ? "Strong topical fit for this question."
          : priorityScore >= 80
            ? "High-value authoritative context for this question."
            : "Trusted non-journal source worth checking for corroboration or context."
      } satisfies TrustedWebRoute;
    })
    .sort((a, b) => b.priorityScore - a.priorityScore || a.name.localeCompare(b.name))
    .slice(0, Math.max(1, Math.min(limit, 30)));
}
