/**
 * The pipeline, and the place the two kinds of "I don't know" are told apart.
 *
 *   raw title
 *    ├─ 1. SCRIPT     non-Latin / language marker  ──► unknown (non-english)   stop
 *    ├─ 2. TOKENIZE   junk, credentials, regions;
 *    │                nothing role-bearing left    ──► unknown (garbage-only)  stop
 *    ├─ 3. SEGMENT    split on conjunctions
 *    ├─ 4. MATCH      exact ▸ longest phrase ▸ token
 *    ├─ 5. RESOLVE    per segment, per dimension
 *    ├─ 6. PRIMARY    highest rung, ties leftward
 *    └─ 7. DERIVE     band ← seniority, persona ← (function, band)
 *
 * One rule governs step 5 and it is the whole thesis: **the most specific claim
 * wins, and a disagreement between claims of equal specificity is reported rather
 * than resolved.** If the disagreement was declared by the lexicon — a multi-value
 * entry — it is a `taxonomy-fork` and the output is correct. If it was not, it is a
 * `lexicon-gap` and somebody has to write a phrase. No branch of this file picks a
 * winner out of an undeclared conflict.
 */

import { COMPILED, hasEvidence, matchSegment, type CompiledLexicon } from "./lexicon";
import { expand, fromEntryValue, hull, intersect, type Interval } from "./ladder";
import { segmentTokens, selectPrimary } from "./segment";
import {
  bandOf,
  rankOf,
  type BandId,
  type FunctionId,
  type ScopeId,
  type SeniorityId,
} from "./taxonomy";
import { isPrunedPersona, personaLabel } from "./taxonomy";
import { tokenize, type RegionHit, type Tokenized } from "./tokenize";
import {
  ambiguous,
  resolved,
  unknown,
  type AmbiguityReason,
  type LexiconMatch,
  type Result,
  type Role,
  type UnknownReason,
  type Verdict,
} from "./types";

/* ── specificity ─────────────────────────────────────────────────────────── */

const KIND_RANK = { exact: 0, phrase: 1, token: 2 } as const;

/** Keep only the matches from the most specific tier that has anything to say. */
function mostSpecific(matches: LexiconMatch[]): LexiconMatch[] {
  if (matches.length === 0) return [];
  const best = Math.min(...matches.map((m) => KIND_RANK[m.entry.kind]));
  return matches.filter((m) => KIND_RANK[m.entry.kind] === best);
}

function evidenceOf(matches: LexiconMatch[]): string[] {
  return matches.map((m) => `“${m.text}” → ${m.entry.pattern} (${m.entry.kind})`);
}

function noEvidence<T>(unclaimed: string[], matches: LexiconMatch[], what: string): Verdict<T> {
  if (unclaimed.length > 0) {
    return unknown("no-evidence", [
      `no lexicon entry for ${unclaimed.map((t) => `“${t}”`).join(", ")}`,
    ]);
  }
  if (matches.length > 0) {
    return unknown("no-evidence", [
      `matched ${matches.map((m) => `“${m.text}”`).join(", ")}, none of which names ${what}`,
    ]);
  }
  return unknown("no-evidence", ["the segment was empty after tokenization"]);
}

/* ── function ────────────────────────────────────────────────────────────── */

function resolveFunction(
  matches: LexiconMatch[],
  unclaimed: string[],
): Verdict<FunctionId> {
  const contributors = mostSpecific(matches.filter((m) => m.entry.function !== undefined));
  if (contributors.length === 0) return noEvidence(unclaimed, matches, "a function");

  const because = evidenceOf(contributors);
  const singles = new Set<FunctionId>();
  const forks: FunctionId[][] = [];

  for (const match of contributors) {
    const value = match.entry.function;
    if (value === undefined) continue;
    if (Array.isArray(value)) forks.push(value);
    else singles.add(value);
  }

  // A concrete single-valued claim *narrows* a declared fork it belongs to. This
  // is what makes `Growth Marketing Manager` resolve while `Head of Growth` does
  // not, and it is monotone: adding evidence can only narrow, never flip.
  if (singles.size === 1) {
    const only = [...singles][0] as FunctionId;
    const contradicted = forks.filter((fork) => !fork.includes(only));
    if (contradicted.length === 0) return resolved(only, because);
    const union = [...new Set([only, ...contradicted.flat()])];
    return ambiguous(union, "lexicon-gap", because);
  }

  if (singles.size > 1) {
    const union = [...new Set([...singles, ...forks.flat()])];
    return ambiguous(union, "lexicon-gap", because);
  }

  // Forks only. Several forks narrow each other by intersection; forks that do not
  // overlap at all are a gap, because the lexicon declared two incompatible worlds.
  const first = forks[0];
  if (first === undefined) return noEvidence(unclaimed, matches, "a function");

  let candidates = [...first];
  for (const fork of forks.slice(1)) {
    candidates = candidates.filter((id) => fork.includes(id));
  }

  if (candidates.length === 1) return resolved(candidates[0] as FunctionId, because);
  if (candidates.length === 0) {
    return ambiguous([...new Set(forks.flat())], "lexicon-gap", because);
  }
  return ambiguous(candidates, "taxonomy-fork", because);
}

/* ── seniority ───────────────────────────────────────────────────────────── */

function verdictFromInterval(
  iv: Interval,
  reason: AmbiguityReason,
  because: string[],
): Verdict<SeniorityId> {
  const rungs = expand(iv);
  const only = rungs[0];
  if (rungs.length === 1 && only !== undefined) return resolved(only, because);
  return ambiguous(rungs, reason, because);
}

function resolveSeniority(
  matches: LexiconMatch[],
  unclaimed: string[],
): Verdict<SeniorityId> {
  const contributors = mostSpecific(matches.filter((m) => m.entry.seniority !== undefined));
  if (contributors.length === 0) return noEvidence(unclaimed, matches, "a rung");

  const intervals = contributors.map((match) => ({
    match,
    iv: fromEntryValue(
      match.entry.seniority as SeniorityId | [SeniorityId, SeniorityId],
    ),
  }));

  // The most senior rung the string names wins: `Senior Director` is a Director,
  // not a senior IC. Contributors that top out at the same rung are intersected —
  // two claims about the same ceiling should agree, and when they do not, that is
  // a gap rather than a coin flip.
  const ceiling = Math.max(...intervals.map(({ iv }) => rankOf(iv.hi)));
  const top = intervals.filter(({ iv }) => rankOf(iv.hi) === ceiling);
  const because = evidenceOf(top.map(({ match }) => match));

  let combined = top[0]?.iv;
  if (combined === undefined) return noEvidence(unclaimed, matches, "a rung");

  for (const { iv } of top.slice(1)) {
    const overlap = intersect(combined, iv);
    if (overlap === undefined) {
      return verdictFromInterval(hull(combined, iv), "lexicon-gap", because);
    }
    combined = overlap;
  }

  return verdictFromInterval(combined, "taxonomy-fork", because);
}

/* ── scope ───────────────────────────────────────────────────────────────── */

/**
 * Scope is a property of the whole title rather than of a segment: `Global VP
 * Sales & Marketing` is one geography. A title carrying both a global and a
 * regional token is a genuine fork — `Global VP, EMEA` is a global role sitting in
 * EMEA at one company and an EMEA role at another — so it abstains rather than
 * applying a precedence rule nobody agreed to.
 */
function resolveScope(regions: RegionHit[], matches: LexiconMatch[]): Verdict<ScopeId> {
  const fromEntry = matches.find((m) => m.entry.scope !== undefined);
  const global = regions.filter((r) => r.scope === "Global");
  const regional = regions.filter((r) => r.scope === "Regional");

  if (global.length > 0 && regional.length > 0) {
    return ambiguous(
      ["Global", "Regional"],
      "taxonomy-fork",
      [
        `both a global token (${global.map((r) => `“${r.token}”`).join(", ")}) and a regional one (${regional
          .map((r) => `“${r.token}”`)
          .join(", ")})`,
      ],
    );
  }
  if (global.length > 0) {
    return resolved("Global", global.map((r) => `“${r.token}”`));
  }
  if (regional.length > 0) {
    return resolved("Regional", regional.map((r) => `“${r.token}”`));
  }
  if (fromEntry?.entry.scope !== undefined) {
    return resolved(fromEntry.entry.scope, evidenceOf([fromEntry]));
  }
  return resolved("None", ["no region token present"]);
}

/* ── derived: band and persona ───────────────────────────────────────────── */

/** A gap anywhere upstream is a gap here; otherwise the fork propagates as a fork. */
function inheritedReason(...verdicts: Verdict<unknown>[]): AmbiguityReason {
  for (const verdict of verdicts) {
    if (verdict.state === "ambiguous" && verdict.reason === "lexicon-gap") return "lexicon-gap";
  }
  return "taxonomy-fork";
}

/**
 * The interval collapse worth noticing: `Head of Sales` is ambiguous between
 * Director and VP, and both are the Leader band, so the *band* resolves. An
 * honest abstention on one dimension does not have to propagate to every other.
 */
export function deriveBand(seniority: Verdict<SeniorityId>): Verdict<BandId> {
  if (seniority.state === "unknown") {
    return unknown(seniority.reason, seniority.because);
  }
  const rungs = seniority.state === "resolved" ? [seniority.value] : seniority.candidates;
  const bands = [...new Set(rungs.map(bandOf))];
  const only = bands[0];
  if (bands.length === 1 && only !== undefined) {
    return resolved(only, seniority.because);
  }
  return ambiguous(bands, inheritedReason(seniority), seniority.because);
}

export function derivePersona(
  fn: Verdict<FunctionId>,
  band: Verdict<BandId>,
): Verdict<string> {
  if (fn.state === "unknown") return unknown(fn.reason, fn.because);
  if (band.state === "unknown") return unknown(band.reason, band.because);

  const functions = fn.state === "resolved" ? [fn.value] : fn.candidates;
  const bands = band.state === "resolved" ? [band.value] : band.candidates;
  const because = [...new Set([...fn.because, ...band.because])];

  const labels = new Set<string>();
  for (const f of functions) {
    for (const b of bands) {
      if (isPrunedPersona(f, b)) continue;
      const label = personaLabel(f, b);
      if (label) labels.add(label);
    }
  }

  const values = [...labels];
  const only = values[0];
  if (values.length === 0) {
    return unknown("no-evidence", [
      `every (function, band) pair was pruned: ${functions.join("/")} × ${bands.join("/")}`,
    ]);
  }
  if (values.length === 1 && only !== undefined) return resolved(only, because);
  return ambiguous(values, inheritedReason(fn, band), because);
}

/* ── the pipeline ────────────────────────────────────────────────────────── */

function haltedResult(raw: string, tokenized: Tokenized, reason: UnknownReason): Result {
  const because = tokenized.signal?.because ?? ["the pipeline halted before the lexicon"];
  const role: Role = {
    segment: tokenized.normalized,
    function: unknown(reason, because),
    seniority: unknown(reason, because),
    scope: unknown(reason, because),
  };
  return {
    raw,
    normalized: tokenized.normalized,
    roles: [role],
    primaryIndex: 0,
    compound: false,
    function: role.function,
    seniority: role.seniority,
    scope: role.scope,
    band: unknown(reason, because),
    persona: unknown(reason, because),
  };
}

export function normalizeTitle(raw: string, lexicon: CompiledLexicon = COMPILED): Result {
  const tokenized = tokenize(raw, { isRoleBearing: (fragment) => hasEvidence(fragment, lexicon) });

  if (tokenized.signal) {
    return haltedResult(raw, tokenized, tokenized.signal.reason);
  }

  const segments = segmentTokens(tokenized.tokens);
  const roles: Role[] = segments.map((tokens) => {
    const { matches, unclaimed } = matchSegment(tokens, lexicon);
    return {
      segment: tokens.join(" "),
      function: resolveFunction(matches, unclaimed),
      seniority: resolveSeniority(matches, unclaimed),
      scope: resolveScope(tokenized.regions, matches),
    };
  });

  const primaryIndex = selectPrimary(roles);
  const primary = roles[primaryIndex];
  if (primary === undefined) {
    return haltedResult(raw, tokenized, "garbage-only");
  }

  const band = deriveBand(primary.seniority);

  return {
    raw,
    normalized: tokenized.normalized,
    roles,
    primaryIndex,
    compound: roles.length > 1,
    function: primary.function,
    seniority: primary.seniority,
    scope: primary.scope,
    band,
    persona: derivePersona(primary.function, band),
  };
}

export function normalizeTitles(titles: string[], lexicon: CompiledLexicon = COMPILED): Result[] {
  return titles.map((title) => normalizeTitle(title, lexicon));
}
