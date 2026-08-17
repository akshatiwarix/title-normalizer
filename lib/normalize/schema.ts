/**
 * The trust boundary.
 *
 * Three kinds of data enter this engine and none of them are trusted: the
 * committed corpora (which a generator wrote), the lexicon (which a human
 * wrote), and API payloads (which a stranger wrote). Zod is where each stops
 * being a guess about a shape.
 *
 * The corpus and lexicon schemas are applied at *import* time in `data/` and
 * `lexicon.ts`, so a malformed fixture is a crash on load rather than a wrong
 * number in a scorecard.
 */

import { z } from "zod";
import { FUNCTION_IDS, SCOPE_IDS, SENIORITY_IDS, rankOf } from "./taxonomy";

export const functionIdSchema = z.enum(FUNCTION_IDS);
export const seniorityIdSchema = z.enum(SENIORITY_IDS);
export const scopeIdSchema = z.enum(SCOPE_IDS);
export const unknownReasonSchema = z.enum(["no-evidence", "non-english", "garbage-only"]);
export const abstentionReasonSchema = z.enum([
  "taxonomy-fork",
  "lexicon-gap",
  "no-evidence",
  "non-english",
  "garbage-only",
]);

/* ── lexicon ─────────────────────────────────────────────────────────────── */

/** A closed interval on the ordered ladder: `[lo, hi]` with `lo <= hi`. */
const seniorityIntervalSchema = z
  .tuple([seniorityIdSchema, seniorityIdSchema])
  .refine(([lo, hi]) => rankOf(lo) <= rankOf(hi), {
    message: "a seniority interval must be written low rung first",
  });

export const lexiconEntrySchema = z
  .object({
    pattern: z.string().min(1),
    kind: z.enum(["phrase", "token"]),
    function: z.union([functionIdSchema, z.array(functionIdSchema).min(2)]).optional(),
    seniority: z.union([seniorityIdSchema, seniorityIntervalSchema]).optional(),
    scope: scopeIdSchema.optional(),
    note: z.string().min(1).optional(),
  })
  .refine((e) => e.function !== undefined || e.seniority !== undefined || e.scope !== undefined, {
    message: "an entry that assigns nothing cannot resolve anything",
  })
  .refine((e) => e.kind !== "phrase" || e.pattern.trim().includes(" "), {
    message: "a phrase entry must span more than one token — use kind: 'token' instead",
  })
  .refine((e) => e.kind !== "phrase" || (e.note !== undefined && e.note.length > 0), {
    message: "every phrase entry carries a note: the lexicon is the documentation of the hard cases",
  })
  .refine((e) => !(Array.isArray(e.function) && new Set(e.function).size !== e.function.length), {
    message: "a declared fork must not repeat a function",
  });

export const lexiconSchema = z.array(lexiconEntrySchema);

/* ── gold and corpora ────────────────────────────────────────────────────── */

function goldDimension<T extends z.ZodType>(values: T) {
  return z.union([
    z.object({ kind: z.literal("labelled"), values: z.array(values).min(1) }),
    z.object({ kind: z.literal("unknowable"), reason: unknownReasonSchema }),
  ]);
}

/** Gold seniority sets are contiguous for the same reason engine output is. */
const goldSenioritySchema = goldDimension(seniorityIdSchema).refine(
  (g) => {
    if (g.kind !== "labelled") return true;
    const ranks = g.values.map(rankOf).sort((a, b) => a - b);
    return ranks.every((r, i) => i === 0 || r === (ranks[i - 1] ?? r) + 1);
  },
  { message: "a gold seniority set must be a contiguous interval on the ladder" },
);

export const goldSchema = z.object({
  function: goldDimension(functionIdSchema),
  seniority: goldSenioritySchema,
  scope: goldDimension(scopeIdSchema),
});

export const corpusTitleSchema = z.object({
  raw: z.string().min(1),
  gold: goldSchema,
  trap: z.string().min(1).optional(),
  canonical: z.string().min(1).optional(),
  ops: z.array(z.string().min(1)).optional(),
});

export const corpusSchema = z.object({
  id: z.enum(["generated", "adversarial"]),
  titles: z.array(corpusTitleSchema).min(1),
});

/* ── API payloads ────────────────────────────────────────────────────────── */

/**
 * The same caps the permalink uses, for the same reason: a bound that is not
 * enforced is a bound that gets silently exceeded. Over-cap is a 400 with the
 * limit named, never a truncated tail — in a tool whose thesis is *no silent
 * behaviour*, quietly dropping titles would be the funniest possible bug.
 */
export const MAX_TITLES = 100;
export const MAX_TITLE_LENGTH = 200;
export const MAX_INPUT_BYTES = 4096;

export const titleListSchema = z
  .array(z.string().min(1).max(MAX_TITLE_LENGTH))
  .min(1)
  .max(MAX_TITLES)
  .refine((titles) => new TextEncoder().encode(titles.join("\n")).length <= MAX_INPUT_BYTES, {
    message: `input exceeds ${MAX_INPUT_BYTES} bytes`,
  });

export const normalizeRequestSchema = z.object({ titles: titleListSchema });

export const proposeRequestSchema = z.object({
  titles: titleListSchema,
  reason: abstentionReasonSchema,
});

/** What the model is allowed to hand back. Never applied, only rendered. */
export const proposeResponseSchema = z.object({
  entries: z.array(lexiconEntrySchema).max(5),
});
