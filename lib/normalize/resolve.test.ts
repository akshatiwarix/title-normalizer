import { describe, expect, it } from "vitest";
import { deriveBand, derivePersona, normalizeTitle } from "./resolve";
import { resolved, unknown, type Verdict } from "./types";
import type { FunctionId, SeniorityId } from "./taxonomy";

function fn(title: string) {
  return normalizeTitle(title).function;
}
function rung(title: string) {
  return normalizeTitle(title).seniority;
}

describe("the ordinary cases", () => {
  it("resolves a plain title on every dimension", () => {
    const r = normalizeTitle("VP of Sales");
    expect(r.function).toMatchObject({ state: "resolved", value: "Sales" });
    expect(r.seniority).toMatchObject({ state: "resolved", value: "VP" });
    expect(r.scope).toMatchObject({ state: "resolved", value: "None" });
    expect(r.band).toMatchObject({ state: "resolved", value: "Leader" });
    expect(r.persona).toMatchObject({ state: "resolved", value: "Sales Leader" });
  });

  it("takes the most senior rung the string names", () => {
    expect(rung("Senior Director, Marketing")).toMatchObject({
      state: "resolved",
      value: "Director",
    });
    expect(rung("Senior Software Engineer")).toMatchObject({ state: "resolved", value: "SeniorIC" });
  });

  it("reads an abbreviation and its expansion the same way", () => {
    // The verdicts differ in their evidence — one cites a token, the other a
    // phrase — and agree on every answer. That is the intended shape.
    expect(rung("SVP Sales")).toMatchObject({ state: "resolved", value: "VP" });
    expect(rung("Senior Vice President, Sales")).toMatchObject({ state: "resolved", value: "VP" });
    expect(fn("CFO")).toMatchObject({ state: "resolved", value: "Finance" });
    expect(fn("Chief Financial Officer")).toMatchObject({ state: "resolved", value: "Finance" });
  });
});

describe("the fork and the gap are different facts", () => {
  it("calls a declared multi-value entry a taxonomy-fork", () => {
    const v = fn("Head of Growth");
    expect(v).toMatchObject({ state: "ambiguous", reason: "taxonomy-fork" });
    if (v.state === "ambiguous") expect(new Set(v.candidates)).toEqual(new Set(["Sales", "Marketing"]));
  });

  it("calls an undeclared token conflict a lexicon-gap", () => {
    const v = fn("Product Support Engineer");
    expect(v).toMatchObject({ state: "ambiguous", reason: "lexicon-gap" });
    if (v.state === "ambiguous") expect(v.candidates.length).toBeGreaterThan(1);
  });

  it("lets concrete evidence narrow a declared fork", () => {
    expect(fn("Growth Marketing Manager")).toMatchObject({
      state: "resolved",
      value: "Marketing",
    });
  });

  it("narrows one fork by another where they overlap", () => {
    // Chief Data Officer forks {Data, Marketing}; spelled out or not, it stays forked.
    const v = fn("CDO");
    expect(v).toMatchObject({ state: "ambiguous", reason: "taxonomy-fork" });
  });
});

describe("the ladder", () => {
  it("abstains on Head of X as a contiguous interval", () => {
    const v = rung("Head of Sales");
    expect(v).toMatchObject({ state: "ambiguous", reason: "taxonomy-fork" });
    if (v.state === "ambiguous") expect(v.candidates).toEqual(["Director", "VP"]);
  });

  it("still resolves the band, because both rungs are Leaders", () => {
    expect(normalizeTitle("Head of Sales").band).toMatchObject({
      state: "resolved",
      value: "Leader",
    });
  });

  it("keeps Associate Director below Director", () => {
    const v = rung("Associate Director, Finance");
    if (v.state === "ambiguous") expect(v.candidates).toEqual(["Manager", "Director"]);
    else throw new Error("expected an interval");
  });

  it("does not let Vice President reach the President entry", () => {
    expect(fn("Vice President, Sales")).toMatchObject({ state: "resolved", value: "Sales" });
    expect(rung("Vice President, Sales")).toMatchObject({ state: "resolved", value: "VP" });
    expect(fn("President")).toMatchObject({ state: "resolved", value: "ExecGeneral" });
  });
});

describe("phrases that beat their own tokens", () => {
  it("reads Sales Engineer as Sales", () => {
    expect(fn("Sales Engineer")).toMatchObject({ state: "resolved", value: "Sales" });
  });

  it("reads Sales Operations and Marketing Operations as RevOps", () => {
    expect(fn("VP of Sales Operations")).toMatchObject({ state: "resolved", value: "RevOps" });
    expect(fn("Marketing Operations Manager")).toMatchObject({ state: "resolved", value: "RevOps" });
  });

  it("reads People Operations as HR, not RevOps", () => {
    expect(fn("Head of People Operations")).toMatchObject({ state: "resolved", value: "HR" });
  });

  it("reads Solutions Architect as presales", () => {
    expect(fn("Solutions Architect")).toMatchObject({ state: "resolved", value: "Sales" });
  });
});

describe("compound titles", () => {
  it("returns two roles rather than one ambiguity", () => {
    const r = normalizeTitle("Founder & CTO");
    expect(r.compound).toBe(true);
    expect(r.roles).toHaveLength(2);
    expect(r.roles[0]?.function).toMatchObject({ state: "resolved", value: "ExecGeneral" });
    expect(r.roles[1]?.function).toMatchObject({ state: "resolved", value: "Engineering" });
  });

  it("gives the primary to the most senior segment", () => {
    const r = normalizeTitle("Founder & CTO");
    expect(r.primaryIndex).toBe(0);
    expect(r.seniority).toMatchObject({ state: "resolved", value: "FounderOwner" });
  });

  it("keeps a seniority-less side visible instead of merging it away", () => {
    const r = normalizeTitle("Sales & Marketing Manager");
    expect(r.roles).toHaveLength(2);
    expect(r.primaryIndex).toBe(1);
    expect(r.roles[0]?.function).toMatchObject({ state: "resolved", value: "Sales" });
  });
});

describe("the functionless exec", () => {
  it("resolves Chief of Staff to ExecGeneral with a genuinely wide rung", () => {
    const r = normalizeTitle("Chief of Staff");
    expect(r.function).toMatchObject({ state: "resolved", value: "ExecGeneral" });
    expect(r.seniority).toMatchObject({ state: "ambiguous" });
    expect(r.persona.state).toBe("ambiguous");
  });

  it("never reaches ExecGeneral from a token inside a longer title", () => {
    expect(fn("Product Owner")).toMatchObject({ state: "ambiguous" });
    const v = fn("Product Owner");
    if (v.state === "ambiguous") expect(v.candidates).not.toContain("ExecGeneral");
  });
});

describe("scope", () => {
  it("reads a region suffix as Regional and refuses to invent a function", () => {
    const r = normalizeTitle("Director, EMEA");
    expect(r.scope).toMatchObject({ state: "resolved", value: "Regional" });
    expect(r.seniority).toMatchObject({ state: "resolved", value: "Director" });
    expect(r.function).toMatchObject({ state: "unknown", reason: "no-evidence" });
  });

  it("abstains when a title claims both a global and a regional geography", () => {
    const r = normalizeTitle("Global VP Sales, EMEA");
    expect(r.scope).toMatchObject({ state: "ambiguous", reason: "taxonomy-fork" });
  });

  it("resolves the unscoped case rather than leaving it unknown", () => {
    expect(normalizeTitle("Marketing Manager").scope).toMatchObject({
      state: "resolved",
      value: "None",
    });
  });
});

describe("the stops", () => {
  it("abstains on a non-English title with the right reason", () => {
    for (const raw of ["Directeur Commercial", "Директор по продажам"]) {
      const r = normalizeTitle(raw);
      expect(r.function).toMatchObject({ state: "unknown", reason: "non-english" });
      expect(r.persona).toMatchObject({ state: "unknown", reason: "non-english" });
    }
  });

  it("abstains on junk with the right reason", () => {
    const r = normalizeTitle("| We're hiring 🚀");
    expect(r.function).toMatchObject({ state: "unknown", reason: "garbage-only" });
  });

  it("separates no-evidence from garbage-only", () => {
    expect(normalizeTitle("Chief Happiness Wizard").function).toMatchObject({
      state: "unknown",
      reason: "no-evidence",
    });
  });

  it("never returns a verdict without evidence", () => {
    const titles = [
      "VP Sales",
      "Head of Growth",
      "Chief Happiness Wizard",
      "| hiring 🚀",
      "Directeur Commercial",
      "Founder & CTO",
      "Director, EMEA",
    ];
    for (const title of titles) {
      const r = normalizeTitle(title);
      for (const verdict of [r.function, r.seniority, r.scope, r.band, r.persona]) {
        expect(verdict.because.length).toBeGreaterThan(0);
      }
      for (const role of r.roles) {
        for (const verdict of [role.function, role.seniority, role.scope]) {
          expect(verdict.because.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("derived dimensions cannot contradict their inputs", () => {
  it("propagates unknown from either input", () => {
    const band = deriveBand(unknown("no-evidence", ["x"]));
    expect(band).toMatchObject({ state: "unknown" });
    expect(derivePersona(resolved<FunctionId>("Sales", ["sales"]), band)).toMatchObject({
      state: "unknown",
    });
  });

  it("crosses an ambiguous function with an ambiguous band", () => {
    const fnVerdict: Verdict<FunctionId> = {
      state: "ambiguous",
      candidates: ["Sales", "Marketing"],
      reason: "taxonomy-fork",
      because: ["growth"],
    };
    const rungVerdict: Verdict<SeniorityId> = {
      state: "ambiguous",
      candidates: ["Manager", "Director"],
      reason: "taxonomy-fork",
      because: ["group manager"],
    };
    const persona = derivePersona(fnVerdict, deriveBand(rungVerdict));
    if (persona.state !== "ambiguous") throw new Error("expected an ambiguous persona");
    expect(new Set(persona.candidates)).toEqual(
      new Set(["Sales Manager", "Sales Leader", "Marketing Manager", "Marketing Leader"]),
    );
  });

  it("reports a gap upstream as a gap downstream", () => {
    const persona = normalizeTitle("Product Support Manager").persona;
    expect(persona).toMatchObject({ state: "ambiguous", reason: "lexicon-gap" });
  });

  it("cannot name a persona without a band, however clear the function is", () => {
    // No rung in the string means no band, and a persona is (function, band).
    // Inventing "Product IC" here would be the contradiction this shape prevents.
    const r = normalizeTitle("Product Support");
    expect(r.function.state).toBe("ambiguous");
    expect(r.persona).toMatchObject({ state: "unknown", reason: "no-evidence" });
  });
});
