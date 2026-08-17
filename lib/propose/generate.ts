/**
 * Abstained titles to proposed lexicon entries. The model's only job.
 *
 * It never normalizes a title, never resolves an ambiguity, never picks a branch of a
 * fork and never appears in a measured number. It reads titles the engine already
 * refused and writes candidate *entries* — the same shape a human writes by hand —
 * which land in the Abstentions pane as a copyable diff and are never written to disk.
 *
 * That boundary is the whole reason the scorecard means anything. A model in the
 * resolution path would make every published figure a claim about a sampled
 * distribution of model outputs rather than a property of a file somebody can read.
 *
 * The response schema is a flat array of uniform objects rather than a discriminated
 * union, because a native `responseSchema` handles unions badly and the interesting
 * failure — a proposal that contradicts the taxonomy — is caught by Zod afterwards.
 * A response schema is a request; a validator is a promise.
 */

import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import {
  FUNCTION_IDS,
  SCOPE_IDS,
  SENIORITY_IDS,
  proposeResponseSchema,
  type AbstentionReason,
  type LexiconEntry,
} from "@/lib/normalize";

const MODEL = "gemini-3.6-flash";

export class MissingKeyError extends Error {}
export class ModelError extends Error {}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    entries: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          pattern: { type: Type.STRING },
          kind: { type: Type.STRING, enum: ["exact", "phrase", "token"] },
          functions: {
            type: Type.ARRAY,
            items: { type: Type.STRING, enum: [...FUNCTION_IDS] },
          },
          seniorityLo: { type: Type.STRING, enum: [...SENIORITY_IDS] },
          seniorityHi: { type: Type.STRING, enum: [...SENIORITY_IDS] },
          scope: { type: Type.STRING, enum: [...SCOPE_IDS] },
          note: { type: Type.STRING },
        },
        required: ["pattern", "kind", "note"],
      },
    },
  },
  required: ["entries"],
};

const GUIDANCE: Record<AbstentionReason, string> = {
  "taxonomy-fork":
    "These abstained because the lexicon *declares* the ambiguity. Usually the right answer is no entry at all. Propose one only if a longer phrase would legitimately narrow the fork — the way `growth marketing` narrows `growth`.",
  "lexicon-gap":
    "These abstained because two token entries disagreed and no phrase covered them. This is the case that wants work: propose the phrase, spanning the words that conflict, with the function the phrase actually denotes.",
  "no-evidence":
    "These abstained because nothing matched. Propose entries only for words that genuinely denote a function or a rung — not for company names, buzzwords or invented C-titles.",
  "non-english":
    "These are out of scope by design. Propose nothing unless a title is in fact English and was misread.",
  "garbage-only":
    "These carried no role content at all. Propose nothing unless a real title was hidden in the noise.",
};

const SYSTEM = `You extend the lexicon of a deterministic job-title normalizer. You do not classify titles.

The lexicon has three kinds of entry, in precedence order:
  exact  — matches only when it spans the whole title segment (single words allowed: ceo, owner)
  phrase — a run of two or more adjacent words; beats any token inside it
  token  — one word, the fallback

Rules you must follow:
  - A multi-value function list declares a genuine ambiguity in the world. Use it only when no
    company would agree on one answer. Never use it to hedge.
  - seniority is the rung the string NAMES, not span of control. Use seniorityLo/seniorityHi to
    express a genuine straddle (e.g. head of X is Director..VP); a point rung sets both to the same.
  - ExecGeneral means "the whole company" and may never be a token entry.
  - A phrase built from a rung-bearing word must state a rung itself, or it silently removes one.
  - Every entry needs a note saying why it exists, in one clause.
  - Propose at most five entries. Fewer is better. Propose none if none is right.

You are writing candidates for a human to review. They will be diffed, not applied.`;

function toEntries(raw: {
  entries: {
    pattern: string;
    kind: string;
    functions?: string[];
    seniorityLo?: string;
    seniorityHi?: string;
    scope?: string;
    note: string;
  }[];
}): LexiconEntry[] {
  const mapped = raw.entries.map((entry) => {
    const functions = entry.functions ?? [];
    const seniority =
      entry.seniorityLo === undefined
        ? undefined
        : entry.seniorityHi === undefined || entry.seniorityHi === entry.seniorityLo
          ? entry.seniorityLo
          : [entry.seniorityLo, entry.seniorityHi];

    return {
      pattern: entry.pattern.toLowerCase().trim(),
      kind: entry.kind,
      ...(functions.length === 1 ? { function: functions[0] } : {}),
      ...(functions.length > 1 ? { function: functions } : {}),
      ...(seniority === undefined ? {} : { seniority }),
      ...(entry.scope === undefined ? {} : { scope: entry.scope }),
      note: entry.note,
    };
  });

  const parsed = proposeResponseSchema.safeParse({ entries: mapped });
  if (!parsed.success) {
    throw new ModelError(parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data.entries;
}

export async function proposeEntries(
  titles: string[],
  reason: AbstentionReason,
): Promise<LexiconEntry[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new MissingKeyError("GEMINI_API_KEY is not set");

  const client = new GoogleGenAI({ apiKey: key });

  const prompt = [
    GUIDANCE[reason],
    "",
    `Titles the engine abstained on (reason: ${reason}):`,
    ...titles.slice(0, 40).map((title) => `- ${title}`),
  ].join("\n");

  let response;
  try {
    response = await client.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        responseSchema,
        // Constrained generation against a fixed schema, not reasoning.
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        temperature: 0,
      },
    });
  } catch (error) {
    throw new ModelError(error instanceof Error ? error.message : "the model call failed");
  }

  const text = response.text;
  if (!text) throw new ModelError("the model returned no content");

  try {
    return toEntries(JSON.parse(text));
  } catch (error) {
    if (error instanceof ModelError) throw error;
    throw new ModelError("the model returned content that was not the requested JSON");
  }
}
