# BIFRÖST IV-E1 — Standalone Acquisition Core

BIFRÖST is the scholarly acquisition bridge of MAINLAND MYTHOS.

Its job is not to decide what is true. Its job is to decide what scholarship is worth acquiring next, route the researcher toward legitimate access, preserve provenance, and protect the boundary between licensed material and downstream AI systems.

## Canonical flow

Waterloo / scholarly discovery → BIFRÖST → researcher-authenticated acquisition → Zotero → Mímir → Forge.

BIFRÖST is not a fourth epistemic realm. It is an acquisition layer feeding Mímir.

## IV-E1 capabilities

- Deterministic DOI normalization.
- Deterministic title normalization.
- Candidate deduplication by DOI, then normalized title + year.
- Acquisition-priority ranking using topical fit, evidence-gap fit, recency, access, and recorded rights constraints.
- Explicit access states: OPEN_ACCESS, WATERLOO_REMOTE, WATERLOO_ON_CAMPUS, UNKNOWN.
- Explicit rights states: PERMITTED, RESTRICTED, UNKNOWN.
- Explicit downstream handling: MIMIR_ELIGIBLE, VAULT_METADATA_ONLY, HOLD_FOR_REVIEW.
- Researcher-controlled Waterloo access routes.
- No WatIAM credential handling.
- No authenticated crawling.
- No bulk licensed downloading.
- No truth-confidence score.

## Rights boundary

A source is MIMIR_ELIGIBLE only when both download and AI-use status are explicitly PERMITTED. Restricted sources are metadata-only. Unknown rights are held for review.

This is intentionally conservative. A private/local workflow does not by itself establish that licensed full text may be provided to a third-party AI service.

## Epistemic guard

Retrieval coverage is not truth confidence. Absence from an inaccessible, unsearched, or intentionally omitted source universe must never be treated as negative evidence.

## Demo fixture

The live IV-E1 page can run against a small synthetic candidate fixture so the planner can be exercised before IV-E2 scholarly discovery exists. Demo titles are synthetic and must never be presented as real publications.

## Next phase

IV-E2 adds scholarly gap detection and real candidate discovery metadata. IV-E3 adds stronger Waterloo routing and acquisition manifests. IV-E4 adds Zotero intake/re-evaluation. Only after those are stable should BIFRÖST be bridged into the local MAINLAND MYTHOS MCP.
