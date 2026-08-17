/**
 * The public surface, pinned.
 *
 * Not a style rule: every name here is something a sibling repo, a route handler or
 * the console can depend on, and the engine's guarantees — pure, deterministic, no
 * network — are promises about exactly this list. Widening it should be a line in a
 * diff somebody chose to write.
 */

import { describe, expect, it } from "vitest";
import * as engine from "./index";

const SURFACE = [
  "ABSTENTION_REASONS",
  "BANDS",
  "BAND_IDS",
  "COMPILED",
  "CONJUNCTION",
  "DIMENSIONS",
  "FULL_LADDER",
  "FUNCTIONS",
  "FUNCTION_IDS",
  "LEXICON",
  "MAX_INPUT_BYTES",
  "MAX_TITLES",
  "MAX_TITLE_LENGTH",
  "REGION_TOKENS",
  "SCOPES",
  "SCOPE_IDS",
  "SENIORITY",
  "SENIORITY_IDS",
  "abstentionReasonOf",
  "allPersonas",
  "ambiguous",
  "bandOf",
  "compileLexicon",
  "corpusSchema",
  "decodeTitles",
  "deriveBand",
  "derivePersona",
  "encodeTitles",
  "evaluateCorpus",
  "evaluateDimension",
  "evidenceScore",
  "expandRungs",
  "goldFor",
  "goldLabel",
  "goldSchema",
  "hasEvidence",
  "hull",
  "intersect",
  "interval",
  "isContiguous",
  "isPoint",
  "isPrunedPersona",
  "lexiconEntrySchema",
  "lexiconSchema",
  "matchSegment",
  "normalizeRequestSchema",
  "normalizeTitle",
  "normalizeTitles",
  "patternTokens",
  "personaLabel",
  "predictedLabel",
  "primaryRank",
  "proposeRequestSchema",
  "proposeResponseSchema",
  "rankOf",
  "reasonHistogram",
  "resolved",
  "score",
  "segmentTokens",
  "selectPrimary",
  "titleListSchema",
  "toCsv",
  "tokenize",
  "unknown",
  "verdictFor",
  "width",
];

describe("the public surface", () => {
  it("exports exactly the pinned list", () => {
    expect(Object.keys(engine).sort()).toEqual([...SURFACE].sort());
  });

  it("resolves a title through the surface alone", () => {
    expect(engine.normalizeTitle("VP of Sales").function).toMatchObject({
      state: "resolved",
      value: "Sales",
    });
  });
});
