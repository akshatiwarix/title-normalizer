/**
 * The public surface of the engine.
 *
 * `boundary.test.ts` pins this list, so widening it is a deliberate diff rather than
 * a thing that happened. Everything here is pure: given the same title and the same
 * lexicon it returns the same verdicts, in a browser or in a route handler, with no
 * network, no clock and no randomness anywhere behind it.
 */

export {
  normalizeTitle,
  normalizeTitles,
  deriveBand,
  derivePersona,
} from "./resolve";

export { LEXICON, COMPILED, compileLexicon, matchSegment, evidenceScore, hasEvidence } from "./lexicon";

export { tokenize, patternTokens, CONJUNCTION } from "./tokenize";
export { segmentTokens, selectPrimary, primaryRank } from "./segment";

export {
  expand as expandRungs,
  interval,
  intersect,
  hull,
  isContiguous,
  isPoint,
  width,
  FULL_LADDER,
} from "./ladder";

export {
  evaluateCorpus,
  evaluateDimension,
  reasonHistogram,
  score,
  goldFor,
  verdictFor,
  goldLabel,
  predictedLabel,
} from "./evaluate";

export { toCsv, encodeTitles, decodeTitles } from "./export";

export {
  corpusSchema,
  goldSchema,
  lexiconSchema,
  lexiconEntrySchema,
  normalizeRequestSchema,
  proposeRequestSchema,
  proposeResponseSchema,
  titleListSchema,
  MAX_TITLES,
  MAX_TITLE_LENGTH,
  MAX_INPUT_BYTES,
} from "./schema";

export {
  FUNCTIONS,
  FUNCTION_IDS,
  SENIORITY,
  SENIORITY_IDS,
  SCOPES,
  SCOPE_IDS,
  BANDS,
  BAND_IDS,
  REGION_TOKENS,
  allPersonas,
  bandOf,
  isPrunedPersona,
  personaLabel,
  rankOf,
} from "./taxonomy";

export {
  ABSTENTION_REASONS,
  DIMENSIONS,
  ambiguous,
  resolved,
  unknown,
  abstentionReasonOf,
} from "./types";

export type {
  AbstentionReason,
  AmbiguityReason,
  ConfusionCell,
  Corpus,
  CorpusId,
  CorpusMetrics,
  CorpusTitle,
  Dimension,
  DimensionMetrics,
  Gold,
  GoldDimension,
  LexiconEntry,
  LexiconMatch,
  NormalizeRequest,
  NormalizeResponse,
  ProposeRequest,
  ProposeResponse,
  Result,
  Role,
  UnknownReason,
  Verdict,
  VerdictState,
} from "./types";

export type { BandId, FunctionId, ScopeId, SeniorityId } from "./taxonomy";
export type { CompiledLexicon } from "./lexicon";
export type { Tokenized, RegionHit } from "./tokenize";
export type { Interval } from "./ladder";
export type { Outcome } from "./evaluate";
export type { DecodeResult, EncodeResult } from "./export";
