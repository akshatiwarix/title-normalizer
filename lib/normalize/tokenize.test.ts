import { describe, expect, it } from "vitest";
import { CONJUNCTION, patternTokens, tokenize } from "./tokenize";

describe("noise", () => {
  it("is case, punctuation and abbreviation blind", () => {
    const forms = ["VP of Sales", "vp sales", "V.P. Sales", "  VP,  Sales  ", "Vp Of SALES"];
    const normalized = forms.map((form) => tokenize(form).normalized);
    expect(new Set(normalized)).toEqual(new Set(["vp sales"]));
  });

  it("strips credentials and honorifics as named evidence", () => {
    const t = tokenize("Ms. Priya Rao, VP Marketing, MBA");
    expect(t.tokens).toContain("vp");
    expect(t.stripped).toContain("mba");
    expect(t.stripped).toContain("ms");
  });

  it("drops a company stapled on with a pipe, a dash or an at-sign", () => {
    for (const raw of ["VP Sales | Acme", "VP Sales - Acme", "VP Sales @ Acme"]) {
      const t = tokenize(raw, { isRoleBearing: (part) => /vp|sales/i.test(part) });
      expect(t.normalized).toBe("vp sales");
      expect(t.stripped).toContain("Acme");
    }
  });

  it("keeps parenthetical departments, because they carry the function", () => {
    expect(tokenize("Director (Finance)").normalized).toBe("director finance");
  });
});

describe("region tokens", () => {
  it("lifts a region out of the token stream and records its scope", () => {
    const t = tokenize("Director, EMEA");
    expect(t.tokens).toEqual(["director"]);
    expect(t.regions).toEqual([{ token: "emea", scope: "Regional" }]);
  });

  it("reads global as a scope, not as a role word", () => {
    const t = tokenize("Global Head of Sales");
    expect(t.tokens).toEqual(["head", "sales"]);
    expect(t.regions[0]?.scope).toBe("Global");
  });
});

describe("conjunctions", () => {
  it("marks a boundary for every way people join two roles", () => {
    for (const raw of ["Founder & CTO", "Founder and CTO", "Founder / CTO", "Founder + CTO"]) {
      expect(tokenize(raw).tokens).toEqual(["founder", CONJUNCTION, "cto"]);
    }
  });

  it("does not treat a comma as a boundary", () => {
    expect(tokenize("VP, Sales Operations").tokens).toEqual(["vp", "sales", "operations"]);
  });

  it("treats two role-bearing pipe parts as a boundary rather than as junk", () => {
    const t = tokenize("Founder | CEO");
    expect(t.tokens).toEqual(["founder", CONJUNCTION, "ceo"]);
  });
});

describe("the stops before the lexicon", () => {
  it("halts on a non-Latin script", () => {
    const t = tokenize("Директор по продажам");
    expect(t.signal?.reason).toBe("non-english");
    expect(t.signal?.because[0]).toMatch(/non-Latin script/);
  });

  it("halts on a Latin-script language marker", () => {
    const t = tokenize("Directeur Commercial");
    expect(t.signal?.reason).toBe("non-english");
    expect(t.signal?.because[0]).toMatch(/language marker/);
  });

  it("does not mistake an English title for a foreign one", () => {
    expect(tokenize("Commercial Director").signal).toBeUndefined();
  });

  it("halts on junk with no role content", () => {
    for (const raw of ["| We're hiring 🚀", "🚀🚀🚀", "#opentowork", "www.acme.com"]) {
      expect(tokenize(raw).signal?.reason).toBe("garbage-only");
    }
  });

  it("halts on a region with no role attached", () => {
    expect(tokenize("EMEA").signal?.reason).toBe("garbage-only");
  });

  it("always names its evidence when it halts", () => {
    for (const raw of ["Директор", "Directeur Commercial", "🚀", "EMEA"]) {
      expect(tokenize(raw).signal?.because.length).toBeGreaterThan(0);
    }
  });
});

describe("lexicon patterns", () => {
  it("run through the same splitter, so patterns read like English", () => {
    expect(patternTokens("head of sales")).toEqual(["head", "sales"]);
    expect(patternTokens("chief of staff")).toEqual(["chief", "staff"]);
  });
});
