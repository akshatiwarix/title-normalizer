/**
 * One test per named trap, named after the trap, so a failure reads as
 * *"the phrase that beats its tokens"* rather than as an index into a fixture.
 *
 * These assert the *shape* of an answer — two roles, a contiguous interval, the
 * reason attached to an abstention — which is the part a metric over a lifted
 * dimension cannot express. The numbers live in `evaluate.ts` and the sweep.
 */

import { describe, expect, it } from "vitest";
import { ADVERSARIAL } from "@/data/adversarial";
import { normalizeTitle } from "./resolve";
import { isContiguous } from "./ladder";
import type { Result } from "./types";

function byTrap(trap: string): { raw: string; result: Result }[] {
  return ADVERSARIAL.titles
    .filter((title) => title.trap === trap)
    .map((title) => ({ raw: title.raw, result: normalizeTitle(title.raw) }));
}

describe("the genuine fork", () => {
  it("returns the candidate set and calls it a taxonomy-fork", () => {
    const { function: fn } = normalizeTitle("Head of Growth");
    expect(fn).toMatchObject({ state: "ambiguous", reason: "taxonomy-fork" });
    if (fn.state === "ambiguous") {
      expect(new Set(fn.candidates)).toEqual(new Set(["Sales", "Marketing"]));
    }
  });

  it("narrows to one answer the moment the string says more", () => {
    expect(normalizeTitle("Head of Growth Marketing").function).toMatchObject({
      state: "resolved",
      value: "Marketing",
    });
  });
});

describe("the ladder interval", () => {
  it("abstains across Director and VP, contiguously", () => {
    for (const { result } of byTrap("the ladder interval")) {
      const rung = result.seniority;
      expect(rung.state).toBe("ambiguous");
      if (rung.state === "ambiguous") {
        expect(rung.candidates).toEqual(["Director", "VP"]);
        expect(isContiguous(rung.candidates)).toBe(true);
      }
    }
  });

  it("still resolves the band, because Director and VP are both Leaders", () => {
    expect(normalizeTitle("Head of Sales").band).toMatchObject({
      state: "resolved",
      value: "Leader",
    });
  });
});

describe("the phrase that beats its tokens", () => {
  it("reads the phrase, not the word inside it", () => {
    expect(normalizeTitle("Sales Engineer").function).toMatchObject({
      state: "resolved",
      value: "Sales",
    });
    expect(normalizeTitle("Business Intelligence Developer").function).toMatchObject({
      state: "resolved",
      value: "Data",
    });
  });
});

describe("the ops trap", () => {
  it("files every flavour of operations under the org that owns it", () => {
    const expected: Record<string, string> = {
      "VP of Sales Operations": "RevOps",
      "Marketing Operations Manager": "RevOps",
      "People Operations Manager": "HR",
      "Security Operations Manager": "Security",
      "Business Operations Director": "RevOps",
      "Head of Sales Enablement": "RevOps",
    };
    for (const [raw, value] of Object.entries(expected)) {
      expect(normalizeTitle(raw).function).toMatchObject({ state: "resolved", value });
    }
  });
});

describe("the compound", () => {
  it("returns two roles rather than one ambiguity", () => {
    const r = normalizeTitle("Founder & CTO");
    expect(r.compound).toBe(true);
    expect(r.roles.map((role) => role.function)).toMatchObject([
      { state: "resolved", value: "ExecGeneral" },
      { state: "resolved", value: "Engineering" },
    ]);
  });

  it("names the primary by rung, not by position", () => {
    expect(normalizeTitle("CTO & Co-Founder").primaryIndex).toBe(1);
  });

  it("breaks a tie leftward", () => {
    const r = normalizeTitle("CFO & COO");
    expect(r.primaryIndex).toBe(0);
    expect(r.function).toMatchObject({ state: "resolved", value: "Finance" });
  });
});

describe("the functionless exec", () => {
  it("resolves Chief of Staff to ExecGeneral over a three-rung straddle", () => {
    const r = normalizeTitle("Chief of Staff");
    expect(r.function).toMatchObject({ state: "resolved", value: "ExecGeneral" });
    if (r.seniority.state === "ambiguous") {
      expect(r.seniority.candidates).toEqual(["Director", "VP", "CSuite"]);
    } else throw new Error("expected a straddle");
  });
});

describe("the residual function", () => {
  it("lets a concrete function outrank ExecGeneral", () => {
    expect(normalizeTitle("Managing Director, Sales").function).toMatchObject({
      state: "resolved",
      value: "Sales",
    });
    expect(normalizeTitle("Managing Director").function).toMatchObject({
      state: "resolved",
      value: "ExecGeneral",
    });
  });
});

describe("the region suffix", () => {
  it("reads the geography and refuses to invent a function", () => {
    const r = normalizeTitle("Director, EMEA");
    expect(r.scope).toMatchObject({ state: "resolved", value: "Regional" });
    expect(r.function).toMatchObject({ state: "unknown", reason: "no-evidence" });
  });
});

describe("global and regional at once", () => {
  it("abstains rather than applying a precedence rule nobody agreed to", () => {
    expect(normalizeTitle("Global VP, EMEA").scope).toMatchObject({
      state: "ambiguous",
      reason: "taxonomy-fork",
    });
  });
});

describe("the junk-only string", () => {
  it("halts with garbage-only", () => {
    for (const { result } of byTrap("the junk-only string")) {
      expect(result.function).toMatchObject({ state: "unknown", reason: "garbage-only" });
    }
  });

  it("finds the title inside the noise", () => {
    for (const { result } of byTrap("the title inside the noise")) {
      expect(result.function.state).toBe("resolved");
    }
  });
});

describe("the foreign title", () => {
  it("abstains with non-english rather than guessing from a familiar-looking word", () => {
    for (const { result } of [...byTrap("the foreign title"), ...byTrap("the foreign script")]) {
      expect(result.function).toMatchObject({ state: "unknown", reason: "non-english" });
    }
  });

  it("does not mistake an English title for a foreign one", () => {
    expect(normalizeTitle("Commercial Director").function).toMatchObject({
      state: "resolved",
      value: "Sales",
    });
  });
});

describe("the gap the tool admits to", () => {
  it("reports an undeclared conflict as a lexicon-gap, not as a fork", () => {
    for (const { result } of byTrap("the gap the tool admits to")) {
      expect(result.function).toMatchObject({ state: "ambiguous", reason: "lexicon-gap" });
    }
  });
});

describe("the whole corpus", () => {
  it("attaches evidence to every verdict on every title", () => {
    for (const title of ADVERSARIAL.titles) {
      const r = normalizeTitle(title.raw);
      for (const verdict of [r.function, r.seniority, r.scope, r.band, r.persona]) {
        expect(verdict.because.length, title.raw).toBeGreaterThan(0);
      }
    }
  });

  it("keeps every ambiguous rung contiguous", () => {
    for (const title of ADVERSARIAL.titles) {
      const rung = normalizeTitle(title.raw).seniority;
      if (rung.state === "ambiguous") {
        expect(isContiguous(rung.candidates), title.raw).toBe(true);
      }
    }
  });

  it("gives every abstention exactly one reason", () => {
    for (const title of ADVERSARIAL.titles) {
      const r = normalizeTitle(title.raw);
      for (const verdict of [r.function, r.seniority, r.scope]) {
        if (verdict.state === "resolved") continue;
        expect(typeof verdict.reason, title.raw).toBe("string");
      }
    }
  });
});
