import { describe, expect, it } from "vitest";
import {
  MAX_INPUT_BYTES,
  MAX_TITLES,
  goldSchema,
  lexiconEntrySchema,
  proposeResponseSchema,
  titleListSchema,
} from "./schema";
import { ambiguous, resolved, unknown, UnevidencedVerdictError } from "./types";
import { BAND_IDS, FUNCTION_IDS, allPersonas, isPrunedPersona, personaLabel } from "./taxonomy";

describe("lexicon entries", () => {
  it("rejects an entry that assigns nothing", () => {
    expect(lexiconEntrySchema.safeParse({ pattern: "vp", kind: "token" }).success).toBe(false);
  });

  it("requires a note on every phrase, because the lexicon is the documentation", () => {
    const withoutNote = { pattern: "sales engineer", kind: "phrase", function: "Sales" };
    expect(lexiconEntrySchema.safeParse(withoutNote).success).toBe(false);
    expect(lexiconEntrySchema.safeParse({ ...withoutNote, note: "presales, not eng" }).success).toBe(
      true,
    );
  });

  it("rejects a single-token 'phrase'", () => {
    const single = { pattern: "growth", kind: "phrase", function: "Sales", note: "x" };
    expect(lexiconEntrySchema.safeParse(single).success).toBe(false);
  });

  it("rejects a declared fork with one member — that is not a fork", () => {
    const entry = { pattern: "growth", kind: "token", function: ["Sales"] };
    expect(lexiconEntrySchema.safeParse(entry).success).toBe(false);
  });

  it("rejects a seniority interval written high rung first", () => {
    const backwards = { pattern: "head", kind: "token", seniority: ["VP", "Director"] };
    expect(lexiconEntrySchema.safeParse(backwards).success).toBe(false);
    const forwards = { pattern: "head", kind: "token", seniority: ["Director", "VP"] };
    expect(lexiconEntrySchema.safeParse(forwards).success).toBe(true);
  });
});

describe("gold labels", () => {
  it("accepts a set for a genuinely forked title", () => {
    const gold = {
      function: { kind: "labelled", values: ["Sales", "Marketing"] },
      seniority: { kind: "labelled", values: ["Director", "VP"] },
      scope: { kind: "labelled", values: ["None"] },
    };
    expect(goldSchema.safeParse(gold).success).toBe(true);
  });

  it("rejects a non-contiguous gold seniority set", () => {
    const gold = {
      function: { kind: "labelled", values: ["Sales"] },
      seniority: { kind: "labelled", values: ["Director", "CSuite"] },
      scope: { kind: "labelled", values: ["None"] },
    };
    expect(goldSchema.safeParse(gold).success).toBe(false);
  });

  it("carries the reason on an unknowable dimension", () => {
    const gold = {
      function: { kind: "unknowable", reason: "garbage-only" },
      seniority: { kind: "unknowable", reason: "garbage-only" },
      scope: { kind: "unknowable", reason: "garbage-only" },
    };
    expect(goldSchema.safeParse(gold).success).toBe(true);
  });
});

describe("input caps", () => {
  it("refuses more than the documented number of titles rather than truncating", () => {
    const overCap = Array.from({ length: MAX_TITLES + 1 }, (_, i) => `VP Sales ${i}`);
    expect(titleListSchema.safeParse(overCap).success).toBe(false);
  });

  it("refuses an oversized payload by bytes as well as by count", () => {
    const fat = ["x".repeat(199), "y".repeat(199)];
    const many = Array.from({ length: 40 }, (_, i) => fat[i % 2] ?? "z");
    expect(new TextEncoder().encode(many.join("\n")).length).toBeGreaterThan(MAX_INPUT_BYTES);
    expect(titleListSchema.safeParse(many).success).toBe(false);
  });
});

describe("the model's response", () => {
  it("caps proposals at five entries", () => {
    const entry = { pattern: "growth ops", kind: "phrase", function: "RevOps", note: "n" };
    const six = { entries: Array.from({ length: 6 }, () => entry) };
    expect(proposeResponseSchema.safeParse(six).success).toBe(false);
  });
});

describe("verdict construction", () => {
  it("throws when a verdict carries no evidence", () => {
    expect(() => resolved("Sales", [])).toThrow(UnevidencedVerdictError);
    expect(() => unknown("no-evidence", [])).toThrow(UnevidencedVerdictError);
  });

  it("refuses an ambiguity with fewer than two candidates", () => {
    expect(() => ambiguous(["Sales"], "taxonomy-fork", ["growth"])).toThrow(
      UnevidencedVerdictError,
    );
  });
});

describe("the taxonomy", () => {
  it("names or prunes every (function, band) cell — there is no third case", () => {
    for (const fn of FUNCTION_IDS) {
      for (const band of BAND_IDS) {
        const label = personaLabel(fn, band);
        expect(label === undefined).toBe(isPrunedPersona(fn, band));
      }
    }
  });

  it("has no duplicate persona labels", () => {
    const personas = allPersonas();
    expect(new Set(personas).size).toBe(personas.length);
  });
});
