/**
 * The noise model: ten named ops that mangle a canonical title without changing
 * what it means.
 *
 * The hard rule, and the reason the noise-invariance invariant is not circular:
 * **an op may never change the function or the rung.** If a transformation could
 * change either, it is not noise — it is an adversarial case, and it belongs in the
 * hand-curated corpus with its own gold label and its own named trap.
 *
 * One op adds information rather than preserving it: `region-suffix` declares that
 * the scope of its output is `Regional`. That is a *declared* transformation of one
 * dimension, written into the gold the op emits, and it is the only one.
 *
 * Randomness is seeded and the output is committed, so every number in the README
 * is reproducible by a stranger with no credentials. Nothing here reads a clock.
 */

import type { ScopeId } from "@/lib/normalize/taxonomy";
import type { CanonicalRole } from "./roles";

/* ── seeded randomness ───────────────────────────────────────────────────── */

export type Rng = () => number;

/** mulberry32 — small, fast, and deterministic given the seed. */
export function seeded(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  const index = Math.floor(rng() * items.length);
  return items[Math.min(index, items.length - 1)] as T;
}

/* ── the ops ─────────────────────────────────────────────────────────────── */

export type NoiseInput = { title: string; scope: ScopeId; role: CanonicalRole };
export type NoiseOutput = { title: string; scope: ScopeId };

export type NoiseOp = {
  id: string;
  label: string;
  /** `undefined` when the op does not apply to this title. */
  apply(input: NoiseInput, rng: Rng): NoiseOutput | undefined;
};

/**
 * Both directions. Every pair is one where the two forms are genuinely
 * interchangeable in the lexicon; pairs that drop a rung (`Customer Success
 * Manager` → `CSM`, `Site Reliability Engineer` → `SRE`) are deliberately absent,
 * because contracting them *would* change the answer and the sweep would — and
 * did — catch it.
 */
const ABBREVIATIONS: [string, string][] = [
  ["Senior", "Sr."],
  ["Senior Vice President", "SVP"],
  ["Vice President", "VP"],
  ["Director", "Dir."],
  ["Operations", "Ops"],
  ["Manager", "Mgr."],
  ["Chief Executive Officer", "CEO"],
  ["Chief Operating Officer", "COO"],
  ["Chief Financial Officer", "CFO"],
  ["Chief Marketing Officer", "CMO"],
  ["Chief Technology Officer", "CTO"],
  ["Chief Product Officer", "CPO"],
  ["Chief Revenue Officer", "CRO"],
  ["Chief Information Officer", "CIO"],
  ["Chief Information Security Officer", "CISO"],
  ["Chief Human Resources Officer", "CHRO"],
  ["Human Resources", "HR"],
  ["Information Technology", "IT"],
  ["Sales Development Representative", "SDR"],
  ["Business Development Representative", "BDR"],
];

const JUNK = [
  "| We're hiring 🚀",
  "| Acme Corp",
  "@ Northwind Traders",
  "| #opentowork",
  "🚀🚀",
  "| ex-Contoso",
];

const CREDENTIALS = [", MBA", ", PhD", ", CPA", ", CFA", ", PMP"];

const REGIONS = ["EMEA", "APAC", "LATAM", "DACH", "Benelux", "Nordics", "UK", "US", "ANZ"];

export const NOISE_OPS: NoiseOp[] = [
  {
    id: "case-mangle",
    label: "case mangle",
    apply({ title, scope }, rng) {
      const form = pick(rng, ["upper", "lower", "sentence"] as const);
      if (form === "upper") return { title: title.toUpperCase(), scope };
      if (form === "lower") return { title: title.toLowerCase(), scope };
      const lower = title.toLowerCase();
      return { title: lower.charAt(0).toUpperCase() + lower.slice(1), scope };
    },
  },
  {
    id: "punctuation-swap",
    label: "punctuation swap",
    apply({ title, scope }, rng) {
      if (title.includes(" of ")) {
        const form = pick(rng, [", ", " "] as const);
        return { title: title.replace(" of ", form), scope };
      }
      const words = title.split(" ");
      if (words.length < 2) return undefined;
      const at = 1 + Math.floor(rng() * (words.length - 1));
      const head = words.slice(0, at).join(" ");
      const tail = words.slice(at).join(" ");
      return { title: `${head}, ${tail}`, scope };
    },
  },
  {
    id: "separator-variant",
    label: "separator variant",
    apply({ title, scope }, rng) {
      const separator = pick(rng, [" - ", " – ", "   "] as const);
      if (title.includes(" of ")) return { title: title.replace(" of ", separator), scope };
      const words = title.split(" ");
      if (words.length < 2) return undefined;
      const at = Math.max(1, Math.floor(rng() * words.length));
      return {
        title: `${words.slice(0, at).join(" ")}${separator}${words.slice(at).join(" ")}`,
        scope,
      };
    },
  },
  {
    id: "abbreviation",
    label: "abbreviation expand / contract",
    apply({ title, scope }, rng) {
      const shuffled = [...ABBREVIATIONS].sort(() => rng() - 0.5);
      for (const [long, short] of shuffled) {
        // Word boundaries, not substrings: a plain `includes` turns
        // `SECURITY OPERATIONS MANAGER` into `SECURInformation TechnologyY ...`
        // by expanding the `IT` inside `SECURITY`, and that is a meaning-changing
        // edit dressed as noise.
        for (const [from, to] of [
          [long, short],
          [short, long],
        ]) {
          const pattern = new RegExp(`\\b${(from as string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\b|\\s|$)`);
          if (pattern.test(title)) return { title: title.replace(pattern, to as string), scope };
        }
      }
      return undefined;
    },
  },
  {
    id: "appended-junk",
    label: "appended junk",
    apply({ title, scope }, rng) {
      return { title: `${title} ${pick(rng, JUNK)}`, scope };
    },
  },
  {
    id: "parenthetical-department",
    label: "parenthetical department",
    apply({ title, scope, role }) {
      const word = role.functionWord;
      if (!word || !title.startsWith(word)) return undefined;
      const rest = title.slice(word.length).trim();
      if (rest.length === 0) return undefined;
      return { title: `${rest} (${word})`, scope };
    },
  },
  {
    id: "department-prefix",
    label: "leading department prefix",
    apply({ title, scope, role }) {
      const word = role.functionWord;
      if (!word) return undefined;
      return { title: `${word} - ${title}`, scope };
    },
  },
  {
    id: "region-suffix",
    label: "region suffix",
    apply({ title }, rng) {
      // The one op that changes a gold value, and it declares the change.
      return { title: `${title}, ${pick(rng, REGIONS)}`, scope: "Regional" };
    },
  },
  {
    id: "whitespace-slip",
    label: "whitespace slip",
    apply({ title, scope }, rng) {
      const form = pick(rng, ["double", "pad", "comma"] as const);
      if (form === "double") return { title: title.replace(" ", "  "), scope };
      if (form === "pad") return { title: `  ${title} `, scope };
      return { title: title.replace(", ", ","), scope };
    },
  },
  {
    id: "credential-suffix",
    label: "credential suffix",
    apply({ title, scope }, rng) {
      return { title: `${title}${pick(rng, CREDENTIALS)}`, scope };
    },
  },
];

export const NOISE_OP_IDS = NOISE_OPS.map((op) => op.id);

/**
 * Ops that staple text onto the end run last, whatever order they were chosen in.
 * Otherwise a later structural op edits *inside* the junk — `Representative |
 * ex-Contoso (Sales)` is the parenthetical op writing into a tagline the junk op
 * had already appended, and the result is a title whose function word is buried in
 * a fragment the engine is right to discard.
 */
const TRAILING_ORDER = ["region-suffix", "credential-suffix", "appended-junk"];

function orderOps(opIds: readonly string[]): string[] {
  const structural = opIds.filter((id) => !TRAILING_ORDER.includes(id));
  const trailing = TRAILING_ORDER.filter((id) => opIds.includes(id));
  return [...structural, ...trailing];
}

/** Apply a named sequence of ops, reporting which ones actually did something. */
export function applyOps(
  role: CanonicalRole,
  opIds: readonly string[],
  rng: Rng,
): { title: string; scope: ScopeId; ops: string[] } {
  let title = role.title;
  let scope: ScopeId = role.scope ?? "None";
  const applied: string[] = [];

  for (const id of orderOps(opIds)) {
    const op = NOISE_OPS.find((candidate) => candidate.id === id);
    if (!op) continue;
    const next = op.apply({ title, scope, role }, rng);
    if (!next) continue;
    title = next.title;
    scope = next.scope;
    applied.push(id);
  }

  return { title, scope, ops: applied };
}
