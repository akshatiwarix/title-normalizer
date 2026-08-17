import { describe, expect, it } from "vitest";
import { COMPILED, LEXICON, hasEvidence, matchSegment } from "./lexicon";
import { patternTokens, tokenize } from "./tokenize";
import { FUNCTION_IDS } from "./taxonomy";

function claimedBy(title: string): string[] {
  const tokens = tokenize(title, { isRoleBearing: hasEvidence }).tokens;
  return matchSegment(tokens).matches.map((m) => m.entry.pattern);
}

describe("precedence", () => {
  it("lets the longest phrase beat its own tokens", () => {
    expect(claimedBy("Sales Engineer")).toEqual(["sales engineer"]);
    expect(claimedBy("Marketing Operations Manager")).toEqual(["marketing operations", "manager"]);
    expect(claimedBy("People Operations Lead")).toEqual(["people operations", "lead"]);
  });

  it("lets a longer phrase beat a shorter one that starts at the same token", () => {
    expect(claimedBy("Chief Information Security Officer")).toEqual([
      "chief information security officer",
    ]);
  });

  it("lets Vice President beat the President exact entry", () => {
    expect(claimedBy("Vice President, Sales")).toEqual(["vice president", "sales"]);
  });

  it("matches an exact entry only when it spans the whole segment", () => {
    expect(claimedBy("CEO")).toEqual(["ceo"]);
    // `owner` is exact, so Product Owner cannot reach ExecGeneral through it.
    expect(claimedBy("Product Owner")).toEqual(["product owner"]);
  });

  it("falls back to tokens for whatever no phrase claimed", () => {
    expect(claimedBy("Senior Data Analyst")).toEqual(["senior", "data", "analyst"]);
  });
});

describe("evidence", () => {
  it("reports tokens no entry claimed, which is what no-evidence is built from", () => {
    const { unclaimed } = matchSegment(patternTokens("blockchain evangelist"));
    expect(unclaimed).toEqual(["blockchain", "evangelist"]);
  });

  it("knows a fragment the lexicon can act on from one it cannot", () => {
    expect(hasEvidence("VP Sales")).toBe(true);
    expect(hasEvidence("Acme Corp")).toBe(false);
    expect(hasEvidence("")).toBe(false);
  });
});

describe("the lexicon as documentation", () => {
  it("gives every phrase and exact entry a note", () => {
    const undocumented = LEXICON.filter((e) => e.kind !== "token" && !e.note);
    expect(undocumented).toEqual([]);
  });

  it("never reaches ExecGeneral through token fallback", () => {
    const leaks = LEXICON.filter((e) => {
      const fn = e.function;
      const names = fn === undefined ? [] : Array.isArray(fn) ? fn : [fn];
      return e.kind === "token" && names.includes("ExecGeneral");
    });
    expect(leaks).toEqual([]);
  });

  it("declares a fork only over functions that exist in the taxonomy", () => {
    for (const entry of LEXICON) {
      const fn = entry.function;
      const names = fn === undefined ? [] : Array.isArray(fn) ? fn : [fn];
      for (const name of names) expect(FUNCTION_IDS).toContain(name);
    }
  });

  it("has one entry per (pattern, kind) pair", () => {
    const keys = LEXICON.map((e) => `${e.kind}:${patternTokens(e.pattern).join(" ")}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("compiles phrases longest-first, which is what makes precedence work", () => {
    const lengths = COMPILED.phrases.map((p) => p.tokens.length);
    expect([...lengths].sort((a, b) => b - a)).toEqual(lengths);
  });
});
