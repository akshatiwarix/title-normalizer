/**
 * The invariant sweep. `npm run sweep`.
 *
 * Six properties, brute-forced over both corpora. This is the file that decides
 * whether the lexicon is safe to grow, and it is the one that produces the numbers
 * the README quotes — they are generated, not typed.
 *
 * Where a pass bounds its own coverage, it says so out loud. A silent cap reads as
 * "we checked everything" when it did not.
 */

import { ADVERSARIAL, GENERATED } from "@/data";
import { CANONICAL_ROLES } from "@/data/roles";
import { COMPILED, LEXICON, compileLexicon } from "@/lib/normalize/lexicon";
import { isContiguous } from "@/lib/normalize/ladder";
import { normalizeTitle, normalizeTitles } from "@/lib/normalize/resolve";
import { evaluateCorpus } from "@/lib/normalize/evaluate";
import { patternTokens } from "@/lib/normalize/tokenize";
import {
  BAND_IDS,
  FUNCTION_IDS,
  SCOPE_IDS,
  SENIORITY_IDS,
  allPersonas,
  isPrunedPersona,
  personaLabel,
} from "@/lib/normalize/taxonomy";
import type { Corpus, Result, Verdict } from "@/lib/normalize/types";
import { ABSTENTION_REASONS, DIMENSIONS } from "@/lib/normalize/types";

const CORPORA: Corpus[] = [ADVERSARIAL, GENERATED];
const failures: string[] = [];

function check(condition: boolean, message: string): void {
  if (!condition) failures.push(message);
}

function answerOf(verdict: Verdict<string>): string {
  if (verdict.state === "resolved") return `=${verdict.value}`;
  if (verdict.state === "ambiguous") return `?${[...verdict.candidates].sort().join("|")}`;
  return `!${verdict.reason}`;
}

/**
 * Scope is excluded from the idempotence check on purpose. `normalized` is the
 * *role* token stream, and the geography was deliberately lifted out of it into
 * `regions` — so `Director, EMEA` normalizes to `director`, and re-normalizing that
 * is right to say the scope is unknown. Function, rung and band are the answers the
 * token stream is supposed to carry, and those must not move.
 */
function roleFingerprint(result: Result): string {
  return [result.function, result.seniority, result.band].map(answerOf).join(" ");
}

/* ── 1. determinism ──────────────────────────────────────────────────────── */

function determinism(): string {
  let checked = 0;
  for (const corpus of CORPORA) {
    for (const title of corpus.titles) {
      const a = JSON.stringify(normalizeTitle(title.raw));
      const b = JSON.stringify(normalizeTitle(title.raw));
      check(a === b, `determinism: “${title.raw}” answered differently on a second call`);
      checked += 1;
    }
  }
  return `determinism            ${checked} titles, byte-identical on re-run`;
}

/* ── 2. idempotence ──────────────────────────────────────────────────────── */

function idempotence(): string {
  let checked = 0;
  for (const corpus of CORPORA) {
    for (const title of corpus.titles) {
      const first = normalizeTitle(title.raw);
      if (first.normalized.length === 0) continue;
      const again = normalizeTitle(first.normalized);
      check(
        roleFingerprint(first) === roleFingerprint(again),
        `idempotence: “${title.raw}” → “${first.normalized}” changed function, rung or band on re-normalization`,
      );
      checked += 1;
    }
  }
  return `idempotence            ${checked} titles, function/rung/band are a fixed point of the token stream`;
}

/* ── 3. noise invariance ─────────────────────────────────────────────────── */

function noiseInvariance(): string {
  const canonical = new Map(CANONICAL_ROLES.map((role) => [role.title, role]));
  let checked = 0;
  const opsSeen = new Set<string>();

  for (const title of GENERATED.titles) {
    const role = title.canonical === undefined ? undefined : canonical.get(title.canonical);
    if (role === undefined) continue;
    const result = normalizeTitle(title.raw);
    (title.ops ?? []).forEach((op) => opsSeen.add(op));

    check(
      result.function.state === "resolved" && result.function.value === role.function,
      `noise invariance: “${title.raw}” (${(title.ops ?? []).join("+")}) lost the function of “${role.title}”`,
    );
    check(
      result.seniority.state === "resolved" && result.seniority.value === role.seniority,
      `noise invariance: “${title.raw}” (${(title.ops ?? []).join("+")}) lost the rung of “${role.title}”`,
    );
    checked += 1;
  }

  return `noise invariance       ${checked} variants across ${opsSeen.size} ops preserve function and rung`;
}

/* ── 4. lexicon monotonicity ─────────────────────────────────────────────── */

const KIND_RANK = { exact: 0, phrase: 1, token: 2 } as const;

/** The specificity of the evidence behind a verdict, read out of its own audit trail. */
function evidenceSpecificity(verdict: Verdict<string>): number {
  const kinds = [...verdict.because.join(" ").matchAll(/\((exact|phrase|token)\)/g)].map(
    (match) => KIND_RANK[(match[1] ?? "token") as keyof typeof KIND_RANK],
  );
  return kinds.length === 0 ? KIND_RANK.token : Math.min(...kinds);
}

/**
 * Withhold each entry in turn and re-answer both corpora. Three properties, each
 * ruling out a specific way a growing lexicon goes wrong:
 *
 *   **No entry suppresses an answer.** If a title abstains with the full lexicon, it
 *   must still abstain without the entry. An entry that *causes* an abstention is a
 *   regression disguised as caution.
 *
 *   **No entry widens an ambiguity.** Candidates without the entry must be a superset
 *   of candidates with it. Adding evidence narrows; it never adds options.
 *
 *   **No entry flips a resolved answer except by being more specific.** `Sales
 *   Engineer` may override the `engineer` token because a phrase outranks a token.
 *   Two entries of the same specificity fighting over one title is the accident this
 *   forbids — that is a conflict resolved by file position, which is exactly what
 *   `lexicon-gap` exists to report instead.
 *
 * Seniority is exempt from the third property, for a stated reason: rungs aggregate
 * by *ceiling*, not by specificity, so adding `senior` is supposed to move `Senior
 * Account Executive` up a rung. The first two properties still apply to it.
 */
function monotonicity(): string {
  const titles = [...ADVERSARIAL.titles, ...GENERATED.titles];
  const baseline = titles.map((title) => normalizeTitle(title.raw));
  let comparisons = 0;

  for (const entry of LEXICON) {
    const without = compileLexicon(LEXICON.filter((candidate) => candidate !== entry));

    titles.forEach((title, index) => {
      const before = baseline[index];
      if (before === undefined) return;
      const after = normalizeTitle(title.raw, without);

      // Compared per *segment*, matched by its token stream, rather than on the
      // lifted dimensions. Withholding an entry can move which role is primary — a
      // compound title whose second segment loses its rung hands the primary to the
      // first — and that is the primary rule working, not a resolution flip.
      const reducedBySegment = new Map(after.roles.map((role) => [role.segment, role]));

      for (const role of before.roles) {
        const reducedRole = reducedBySegment.get(role.segment);
        if (reducedRole === undefined) continue;

        for (const dimension of ["function", "seniority", "scope"] as const) {
          const full = role[dimension] as Verdict<string>;
          const reduced = reducedRole[dimension] as Verdict<string>;
          comparisons += 1;

          if (
            dimension !== "seniority" &&
            full.state === "resolved" &&
            reduced.state === "resolved" &&
            full.value !== reduced.value
          ) {
            // `ExecGeneral` is the residual function, so a concrete function is
            // *supposed* to displace it regardless of specificity — that is the rule
            // that makes `Managing Director, Sales` a sales leader.
            const residual = reduced.value === "ExecGeneral";
            check(
              residual || KIND_RANK[entry.kind] < evidenceSpecificity(reduced),
              `monotonicity: removing “${entry.pattern}” (${entry.kind}) flips “${title.raw}” ${dimension} from ${reduced.value} to ${full.value} without being more specific`,
            );
          }

          if (full.state === "ambiguous" && reduced.state === "ambiguous") {
            check(
              full.candidates.every((candidate) => reduced.candidates.includes(candidate)),
              `monotonicity: removing “${entry.pattern}” (${entry.kind}) narrows “${title.raw}” ${dimension} — the entry was widening an ambiguity`,
            );
          }

          if (full.state === "unknown") {
            check(
              reduced.state === "unknown",
              `monotonicity: removing “${entry.pattern}” (${entry.kind}) makes “${title.raw}” ${dimension} answerable — the entry was suppressing an answer`,
            );
          }
        }
      }
    });
  }

  return `lexicon monotonicity   ${LEXICON.length} entries withheld in turn, ${comparisons.toLocaleString("en-US")} verdict comparisons`;
}

/* ── 5. taxonomy totality and disjointness ───────────────────────────────── */

function taxonomy(): string {
  for (const entry of LEXICON) {
    const fn = entry.function;
    const names = fn === undefined ? [] : Array.isArray(fn) ? fn : [fn];
    for (const name of names) {
      check(
        (FUNCTION_IDS as readonly string[]).includes(name),
        `taxonomy: “${entry.pattern}” names function ${name}, which is not in taxonomy.ts`,
      );
      check(
        !(entry.kind === "token" && name === "ExecGeneral"),
        `taxonomy: “${entry.pattern}” reaches ExecGeneral through token fallback`,
      );
    }
    const rung = entry.seniority;
    const rungs = rung === undefined ? [] : Array.isArray(rung) ? rung : [rung];
    for (const value of rungs) {
      check(
        (SENIORITY_IDS as readonly string[]).includes(value),
        `taxonomy: “${entry.pattern}” names rung ${value}, which is not in taxonomy.ts`,
      );
    }
    if (entry.scope !== undefined) {
      check(
        (SCOPE_IDS as readonly string[]).includes(entry.scope),
        `taxonomy: “${entry.pattern}” names scope ${entry.scope}, which is not in taxonomy.ts`,
      );
    }
    check(
      entry.kind === "token" || (entry.note !== undefined && entry.note.length > 0),
      `taxonomy: “${entry.pattern}” is a ${entry.kind} entry with no note`,
    );
  }

  // A phrase claims its own tokens, so a phrase built out of a rung-bearing token
  // silently *removes* that rung unless it declares one itself. `Systems
  // Administrator` losing its IC rung to the `systems administrator` phrase is the
  // shape of the bug, and it is invisible in any single test.
  for (const entry of LEXICON) {
    if (entry.kind === "token" || entry.seniority !== undefined) continue;
    const swallowed = patternTokens(entry.pattern)
      .map((word) => COMPILED.tokens.get(word))
      .filter((token) => token?.seniority !== undefined)
      .map((token) => token?.pattern);
    check(
      swallowed.length === 0,
      `taxonomy: ${entry.kind} “${entry.pattern}” swallows the rung of ${swallowed.join(", ")} without declaring one`,
    );
  }

  const keys = LEXICON.map((entry) => `${entry.kind}:${entry.pattern}`);
  check(new Set(keys).size === keys.length, "taxonomy: two entries share a (pattern, kind) pair");

  let cells = 0;
  for (const fn of FUNCTION_IDS) {
    for (const band of BAND_IDS) {
      cells += 1;
      const label = personaLabel(fn, band);
      check(
        (label === undefined) === isPrunedPersona(fn, band),
        `taxonomy: persona cell ${fn}×${band} is neither named nor pruned`,
      );
    }
  }
  const personas = allPersonas();
  check(new Set(personas).size === personas.length, "taxonomy: two persona cells share a label");

  return `taxonomy               ${LEXICON.length} entries, ${cells} persona cells, ${personas.length} named / ${cells - personas.length} pruned`;
}

/* ── 6. ladder contiguity ────────────────────────────────────────────────── */

function contiguity(): string {
  let intervals = 0;
  for (const corpus of CORPORA) {
    for (const title of corpus.titles) {
      const result = normalizeTitle(title.raw);
      for (const role of [...result.roles, result]) {
        const rung = role.seniority;
        if (rung.state !== "ambiguous") continue;
        intervals += 1;
        check(
          isContiguous(rung.candidates),
          `contiguity: “${title.raw}” yields a non-contiguous rung set ${rung.candidates.join(", ")}`,
        );
      }
    }
  }
  return `ladder contiguity      ${intervals} ambiguous rungs, every one a contiguous interval`;
}

/* ── run ─────────────────────────────────────────────────────────────────── */

const lines = [
  determinism(),
  idempotence(),
  noiseInvariance(),
  monotonicity(),
  taxonomy(),
  contiguity(),
];

console.log("\ninvariants");
console.log("──────────");
for (const line of lines) console.log(`  ${line}`);

console.log(`\ncorpora`);
console.log("───────");
for (const corpus of CORPORA) {
  console.log(`  ${corpus.id.padEnd(12)} ${corpus.titles.length} titles`);
}
console.log(`  lexicon      ${LEXICON.length} entries (${COMPILED.phrases.length} phrases, ${COMPILED.exact.length} exact, ${COMPILED.tokens.size} tokens)`);

/* ── the scorecard ───────────────────────────────────────────────────────── */

const scored = CORPORA.map((corpus) =>
  evaluateCorpus(corpus, normalizeTitles(corpus.titles.map((title) => title.raw))),
);

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** An em dash, not 0.0% — a corpus with no abstentions has no abstention precision. */
function precision(value: number, abstentions: number): string {
  return abstentions === 0 ? "—" : percent(value);
}

console.log("\nscorecard — the two corpora are never averaged");
console.log("─────────────────────────────────────────────");
console.log(
  `  ${"dimension".padEnd(10)}${"corpus".padEnd(14)}${"coverage".padStart(9)}${"acc/resolved".padStart(14)}${"SILENT ERR".padStart(12)}${"abstain=".padStart(10)}${"abstain⊇".padStart(10)}`,
);
for (const dimension of DIMENSIONS) {
  for (const metrics of scored) {
    const d = metrics.dimensions[dimension];
    console.log(
      `  ${dimension.padEnd(10)}${metrics.corpus.padEnd(14)}${percent(d.coverage).padStart(9)}${percent(d.accuracyOnResolved).padStart(14)}${`${d.silentErrors} (${percent(d.silentErrorRate)})`.padStart(12)}${precision(d.abstentionPrecisionExact, d.abstentions).padStart(10)}${precision(d.abstentionPrecisionContaining, d.abstentions).padStart(10)}`,
    );
  }
}

console.log("\nabstentions by reason");
console.log("─────────────────────");
for (const metrics of scored) {
  const parts = ABSTENTION_REASONS.map(
    (reason) => `${reason} ${metrics.reasons[reason]}`,
  ).join("  ");
  console.log(`  ${metrics.corpus.padEnd(13)}${parts}`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} violation(s)`);
  console.error("─────────────");
  for (const failure of failures.slice(0, 40)) console.error(`  ${failure}`);
  if (failures.length > 40) console.error(`  … and ${failures.length - 40} more`);
  process.exit(1);
}

console.log("\nall six invariants hold.\n");
