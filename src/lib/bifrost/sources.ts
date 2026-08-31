export const BIFROST_SOURCES = {
  waterloo: {
    id: "waterloo",
    label: "University of Waterloo Libraries",
    catalogueUrl: "https://lib.uwaterloo.ca/library/web/",
    remoteAccessInfoUrl: "https://uwaterloo.ca/lib/services/get-access-anywhere",
    alumniAccessInfoUrl: "https://uwaterloo.ca/lib/alumni-and-community-borrowers/how-access-resources",
    mode: "RESEARCHER_AUTHENTICATED" as const,
    credentialPolicy: "BIFROST_NEVER_HANDLES_WATIAM_CREDENTIALS" as const
  },
  doi: {
    id: "doi",
    label: "DOI Resolver",
    resolverBaseUrl: "https://doi.org/"
  }
} as const;

export const BIFROST_DOCTRINE = {
  discovery: "AGGRESSIVE",
  acquisition: "SURGICAL",
  credentialHandling: "NONE",
  bulkLicensedDownload: false,
  automatedAuthenticatedCrawling: false,
  mimirAuthorityPreserved: true,
  retrievalCoverageIsTruthConfidence: false
} as const;
