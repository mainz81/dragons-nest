export const BIFROST_SOURCES = {
  waterloo: {
    id: "waterloo",
    label: "University of Waterloo Libraries",
    catalogueUrl: "https://lib.uwaterloo.ca/library/web/",
    omniSearchBaseUrl: "https://ocul-wtl.primo.exlibrisgroup.com/discovery/search",
    omniVid: "01OCUL_WTL:WTL_DEFAULT",
    omniHelpUrl: "https://uwaterloo.ca/lib/searching-libraries-catalogue-omni",
    remoteAccessInfoUrl: "https://uwaterloo.ca/lib/services/get-access-anywhere",
    alumniAccessInfoUrl: "https://uwaterloo.ca/lib/alumni-and-community-borrowers/how-access-resources",
    usageGuidelinesUrl: "https://uwaterloo.ca/lib/find-resources/copyright/eresources-use-guidelines",
    aiUsePolicyUrl: "https://uwaterloo.ca/lib/research-supports/copyright-and-licensing/use-library-resources-ai",
    mode: "RESEARCHER_AUTHENTICATED" as const,
    alumniRemoteScope: "SELECTED_ELECTRONIC_RESOURCES" as const,
    credentialPolicy: "BIFROST_NEVER_HANDLES_WATIAM_CREDENTIALS" as const,
    holdingsPolicy: "BIFROST_DOES_NOT_CLAIM_WATERLOO_HOLDINGS_UNTIL_OMNI_CONFIRMS" as const
  },
  doi: {
    id: "doi",
    label: "DOI Resolver",
    resolverBaseUrl: "https://doi.org/"
  },
  openAlex: {
    id: "openalex",
    label: "OpenAlex",
    worksApiUrl: "https://api.openalex.org/works",
    mode: "PUBLIC_SCHOLARLY_WEB_METADATA" as const,
    fullTextPolicy: "METADATA_AND_PUBLIC_OA_LINKS_ONLY" as const
  }
} as const;

export const BIFROST_DOCTRINE = {
  discovery: "AGGRESSIVE",
  acquisition: "SURGICAL",
  credentialHandling: "NONE",
  bulkLicensedDownload: false,
  automatedAuthenticatedCrawling: false,
  mimirAuthorityPreserved: true,
  retrievalCoverageIsTruthConfidence: false,
  waterlooHoldingsMustBeVerifiedInOmni: true,
  licensedFullTextNeverSentToThirdPartyAiByDefault: true
} as const;
