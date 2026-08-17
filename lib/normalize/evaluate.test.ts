import { describe, expect, it } from "vitest";
import { evaluateCorpus, goldFor, score } from "./evaluate";
import { normalizeTitles } from "./resolve";
import { ADVERSARIAL, GENERATED } from "@/data";
import type { GoldDimension, Verdict } from "./types";

const single: GoldDimension<string> = { kind: "labelled", values: ["Sales"] };
const set: GoldDimension<string> = { kind: "labelled", values: ["Sales", "Marketing"] };
const junk: GoldDimension<string> = { kind: "unknowable", reason: "garbage-only" };

function resolved(value: string): Verdict<string> {
  return { state: "resolved", value, because: ["x"] };
}
function ambiguous(...candidates: string[]): Verdict<string> {
  return { state: "ambiguous", candidates, reason: "taxonomy-fork", because: ["x"] };
}

describe("scoring one dimension", () => {
  it("counts a right answer as correct and a wrong one as a silent error", () => {
    expect(score(single, resolved("Sales")).kind).toBe("correct");
    expect(score(single, resolved("Marketing")).kind).toBe("silent-error");
  });

  it("counts resolving a genuine fork as a silent error, however plausible the pick", () => {
    expect(score(set, resolved("Sales")).kind).toBe("silent-error");
  });

  it("scores an exactly-right abstention as exact and containing", () => {
    expect(score(set, ambiguous("Marketing", "Sales"))).toEqual({
      kind: "abstention",
      exact: true,
      containing: true,
    });
  });

  it("refuses to call a wider set exact, but grants containment", () => {
    expect(score(set, ambiguous("Sales", "Marketing", "RevOps"))).toEqual({
      kind: "abstention",
      exact: false,
      containing: true,
    });
  });

  it("gives an over-abstention no credit for equality", () => {
    expect(score(single, ambiguous("Sales", "Marketing"))).toEqual({
      kind: "abstention",
      exact: false,
      containing: true,
    });
  });

  it("requires the right reason on an unknowable dimension", () => {
    expect(score(junk, { state: "unknown", reason: "garbage-only", because: ["x"] }).kind).toBe(
      "abstention",
    );
    expect(score(junk, { state: "unknown", reason: "garbage-only", because: ["x"] })).toMatchObject({
      exact: true,
    });
    expect(score(junk, { state: "unknown", reason: "no-evidence", because: ["x"] })).toMatchObject({
      exact: false,
    });
  });

  it("calls answering an unanswerable title a silent error", () => {
    expect(score(junk, resolved("Sales")).kind).toBe("silent-error");
  });
});

describe("derived gold", () => {
  it("builds persona gold from the two columns that exist", () => {
    const gold = goldFor("persona", {
      function: { kind: "labelled", values: ["Sales"] },
      seniority: { kind: "labelled", values: ["Director", "VP"] },
      scope: { kind: "labelled", values: ["None"] },
    });
    expect(gold).toEqual({ kind: "labelled", values: ["Sales Leader"] });
  });

  it("inherits unknowability from either input", () => {
    const gold = goldFor("persona", {
      function: { kind: "unknowable", reason: "non-english" },
      seniority: { kind: "unknowable", reason: "non-english" },
      scope: { kind: "unknowable", reason: "non-english" },
    });
    expect(gold).toEqual({ kind: "unknowable", reason: "non-english" });
  });
});

describe("the published numbers", () => {
  it("reports zero silent errors on both corpora", () => {
    for (const corpus of [ADVERSARIAL, GENERATED]) {
      const metrics = evaluateCorpus(corpus, normalizeTitles(corpus.titles.map((t) => t.raw)));
      for (const dimension of ["function", "seniority", "scope", "persona"] as const) {
        expect(metrics.dimensions[dimension].silentErrors, `${corpus.id}/${dimension}`).toBe(0);
      }
    }
  });

  it("keeps the two corpora separate — there is no combined figure to report", () => {
    const adversarial = evaluateCorpus(ADVERSARIAL, normalizeTitles(ADVERSARIAL.titles.map((t) => t.raw)));
    const generated = evaluateCorpus(GENERATED, normalizeTitles(GENERATED.titles.map((t) => t.raw)));
    expect(adversarial.corpus).not.toBe(generated.corpus);
    expect(adversarial.dimensions.function.coverage).toBeLessThan(
      generated.dimensions.function.coverage,
    );
  });
});
