/**
 * The type contract.
 *
 * One shape carries the entire thesis: every dimension of every role returns a
 * `Verdict`, and a `Verdict` is allowed to say "I don't know" in two distinct
 * ways. There is deliberately no `confidence: number` anywhere in this file. A
 * float is how a guess gets laundered into a column; a candidate set plus the
 * evidence that produced it is auditable.
 */

import type { BandId, FunctionId, ScopeId, SeniorityId } from "./taxonomy";

/* ── verdicts ────────────────────────────────────────────────────────────── */

/**
 * `taxonomy-fork` — the lexicon *declares* this ambiguity (a multi-value entry).
 *   The world is ambiguous, the output is correct, and nobody has work to do.
 * `lexicon-gap`   — two token entries conflict and no phrase covers them. The
 *   ambiguity is in our file. Somebody has to write a phrase entry.
 *
 * Keeping these apart is the repo's central claim. Collapsing them into one
 * "ambiguous" bucket destroys it.
 */
export type AmbiguityReason = "taxonomy-fork" | "lexicon-gap";

/**
 * `no-evidence`  — nothing in the string matched the lexicon at all.
 * `non-english`  — a language/script signal fired. Out of scope by design.
 * `garbage-only` — junk with no role content (`| We're hiring 🚀`).
 */
export type UnknownReason = "no-evidence" | "non-english" | "garbage-only";

export type AbstentionReason = AmbiguityReason | UnknownReason;

export const ABSTENTION_REASONS: readonly AbstentionReason[] = [
  "taxonomy-fork",
  "lexicon-gap",
  "no-evidence",
  "non-english",
  "garbage-only",
] as const;

/**
 * `because` is the audit trail: the phrases, tokens or signals that produced
 * this verdict. It is required in all three states and must never be empty —
 * `assertEvidence` enforces it at construction and a test asserts it globally.
 */
export type Verdict<T> =
  | { state: "resolved"; value: T; because: string[] }
  | { state: "ambiguous"; candidates: T[]; reason: AmbiguityReason; because: string[] }
  | { state: "unknown"; reason: UnknownReason; because: string[] };

export type VerdictState = Verdict<unknown>["state"];

/** Thrown rather than returned: an unevidenced verdict is a bug, not an input error. */
export class UnevidencedVerdictError extends Error {}

function assertEvidence(because: string[]): string[] {
  if (because.length === 0) {
    throw new UnevidencedVerdictError(
      "a verdict must carry at least one piece of evidence in `because`",
    );
  }
  return because;
}

export function resolved<T>(value: T, because: string[]): Verdict<T> {
  return { state: "resolved", value, because: assertEvidence(because) };
}

export function ambiguous<T>(
  candidates: T[],
  reason: AmbiguityReason,
  because: string[],
): Verdict<T> {
  if (candidates.length < 2) {
    throw new UnevidencedVerdictError(
      `an ambiguous verdict needs at least two candidates, got ${candidates.length}`,
    );
  }
  return { state: "ambiguous", candidates, reason, because: assertEvidence(because) };
}

export function unknown<T>(reason: UnknownReason, because: string[]): Verdict<T> {
  return { state: "unknown", reason, because: assertEvidence(because) };
}

/** The reason an abstention carries, or `undefined` when the verdict resolved. */
export function abstentionReasonOf(v: Verdict<unknown>): AbstentionReason | undefined {
  return v.state === "resolved" ? undefined : v.reason;
}

/* ── the lexicon ─────────────────────────────────────────────────────────── */

/**
 * Three kinds, in precedence order:
 *
 *   `exact`  — matches only when it spans the *whole* segment. This is how
 *              single-token executive titles are reachable (`ceo`, `owner`,
 *              `president`) without letting them leak in as a token fallback
 *              inside a longer string.
 *   `phrase` — a run of adjacent tokens; beats any `token` entry overlapping it.
 *              `Sales Engineer` is a phrase, so the `Engineer` token never gets
 *              to decide it.
 *   `token`  — one word, the fallback.
 *
 * A multi-value `function` is the *declared fork*: it is how the lexicon says
 * "this ambiguity is in the world, not in this file", and it is the only way to
 * produce `taxonomy-fork`.
 *
 * A two-element `seniority` is a closed interval on the ordered ladder.
 */
export type LexiconEntry = {
  pattern: string;
  kind: "exact" | "phrase" | "token";
  function?: FunctionId | FunctionId[];
  seniority?: SeniorityId | [SeniorityId, SeniorityId];
  scope?: ScopeId;
  /**
   * Why this entry exists. Required on `phrase` and `exact` entries: those are
   * the hard cases, and the lexicon is their documentation.
   */
  note?: string;
};

export type LexiconMatch = {
  entry: LexiconEntry;
  /** The literal text of the segment this entry claimed. */
  text: string;
  /** Token index range within the segment, half-open. */
  from: number;
  to: number;
};

/* ── results ─────────────────────────────────────────────────────────────── */

export type Role = {
  /** The segment as tokenized, e.g. `founder` out of `Founder & CTO`. */
  segment: string;
  function: Verdict<FunctionId>;
  seniority: Verdict<SeniorityId>;
  scope: Verdict<ScopeId>;
};

export type Result = {
  raw: string;
  /** Tokenized form the engine actually reasoned over. */
  normalized: string;
  roles: Role[];
  /** Index into `roles`; the highest ladder rung wins, ties go to the leftmost. */
  primaryIndex: number;
  compound: boolean;
  /** The primary role's dimensions, lifted for convenience. */
  function: Verdict<FunctionId>;
  seniority: Verdict<SeniorityId>;
  scope: Verdict<ScopeId>;
  /** Derived. Never independent. */
  band: Verdict<BandId>;
  persona: Verdict<string>;
};

export const DIMENSIONS = ["function", "seniority", "scope", "persona"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

/* ── gold labels ─────────────────────────────────────────────────────────── */

/**
 * Gold is a *set*, because for some titles the truth is a set. `Head of Sales`
 * has gold seniority `{Director, VP}` and any engine that returns one of them is
 * wrong in a way that matters.
 *
 * `unknowable` is the gold for a title that carries no answer at all — junk, or a
 * language we do not handle. It names the reason, so abstaining for the *wrong*
 * reason is still scored as a miss.
 */
export type GoldDimension<T> =
  | { kind: "labelled"; values: T[] }
  | { kind: "unknowable"; reason: UnknownReason };

export type Gold = {
  function: GoldDimension<FunctionId>;
  seniority: GoldDimension<SeniorityId>;
  scope: GoldDimension<ScopeId>;
};

export type CorpusId = "generated" | "adversarial";

export type CorpusTitle = {
  raw: string;
  gold: Gold;
  /** Adversarial only: the named trap this title exists to catch. */
  trap?: string;
  /** Generated only: the canonical role and the noise ops applied to it. */
  canonical?: string;
  ops?: string[];
};

export type Corpus = { id: CorpusId; titles: CorpusTitle[] };

/* ── metrics ─────────────────────────────────────────────────────────────── */

/**
 * Four numbers per dimension. `silentErrorRate` is the headline — resolved *and*
 * wrong, over all titles — because it is the number every vendor in this category
 * declines to compute. There is deliberately no threshold that trades coverage
 * against precision: a dial lets a reader tune to whatever figure flatters the
 * demo.
 */
export type DimensionMetrics = {
  dimension: Dimension;
  total: number;
  scored: number;
  resolved: number;
  coverage: number;
  correctOnResolved: number;
  accuracyOnResolved: number;
  silentErrors: number;
  silentErrorRate: number;
  abstentions: number;
  /** Candidate set exactly equals gold. The strict reading, and the headline. */
  abstentionExact: number;
  abstentionPrecisionExact: number;
  /** Candidate set contains gold. Gameable alone — reported beside equality. */
  abstentionContaining: number;
  abstentionPrecisionContaining: number;
  confusion: ConfusionCell[];
};

export type ConfusionCell = { gold: string; predicted: string; count: number };

export type CorpusMetrics = {
  corpus: CorpusId;
  count: number;
  dimensions: Record<Dimension, DimensionMetrics>;
  reasons: Record<AbstentionReason, number>;
};

/* ── API payloads ────────────────────────────────────────────────────────── */

export type NormalizeRequest = { titles: string[] };
export type NormalizeResponse = { results: Result[] };

export type ProposeRequest = { titles: string[]; reason: AbstentionReason };
export type ProposeResponse = { entries: LexiconEntry[] };
