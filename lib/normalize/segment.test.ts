import { describe, expect, it } from "vitest";
import { primaryRank, segmentTokens, selectPrimary } from "./segment";
import { resolved, ambiguous, unknown, type Role, type Verdict } from "./types";
import type { SeniorityId } from "./taxonomy";
import { tokenize } from "./tokenize";

function role(segment: string, seniority: Verdict<SeniorityId>): Role {
  return {
    segment,
    seniority,
    function: unknown("no-evidence", ["stub"]),
    scope: resolved("None", ["stub"]),
  };
}

describe("segmentation", () => {
  it("splits a compound title into one segment per role", () => {
    expect(segmentTokens(tokenize("Founder & CTO").tokens)).toEqual([["founder"], ["cto"]]);
  });

  it("leaves a single role as one segment", () => {
    expect(segmentTokens(tokenize("VP of Sales Operations").tokens)).toEqual([
      ["vp", "sales", "operations"],
    ]);
  });

  it("keeps a seniority-less side as its own segment rather than merging it away", () => {
    expect(segmentTokens(tokenize("Sales & Marketing Manager").tokens)).toEqual([
      ["sales"],
      ["marketing", "manager"],
    ]);
  });

  it("always produces at least one segment", () => {
    expect(segmentTokens([])).toEqual([[]]);
  });
});

describe("primary selection", () => {
  it("ranks an ambiguous rung at its highest candidate", () => {
    expect(primaryRank(ambiguous<SeniorityId>(["Director", "VP"], "taxonomy-fork", ["head"]))).toBe(
      primaryRank(resolved<SeniorityId>("VP", ["vp"])),
    );
  });

  it("ranks an unknown rung below every known rung, not at the bottom one", () => {
    expect(primaryRank(unknown("no-evidence", ["x"]))).toBeLessThan(
      primaryRank(resolved<SeniorityId>("Intern", ["intern"])),
    );
  });

  it("gives the primary to the highest rung", () => {
    const roles = [
      role("head sales", ambiguous<SeniorityId>(["Director", "VP"], "taxonomy-fork", ["head"])),
      role("founder", resolved<SeniorityId>("FounderOwner", ["founder"])),
    ];
    expect(selectPrimary(roles)).toBe(1);
  });

  it("breaks a tie leftwards", () => {
    const roles = [
      role("cto", resolved<SeniorityId>("CSuite", ["cto"])),
      role("cfo", resolved<SeniorityId>("CSuite", ["cfo"])),
    ];
    expect(selectPrimary(roles)).toBe(0);
  });

  it("still names a primary when no segment has a rung", () => {
    const roles = [role("sales", unknown("no-evidence", ["x"])), role("data", unknown("no-evidence", ["y"]))];
    expect(selectPrimary(roles)).toBe(0);
  });
});
