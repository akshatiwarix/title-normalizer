import { describe, expect, it } from "vitest";
import {
  FULL_LADDER,
  LadderError,
  expand,
  fromEntryValue,
  hull,
  intersect,
  intervalFromSet,
  isContiguous,
  isPoint,
  interval,
  width,
} from "./ladder";
import { SENIORITY_IDS } from "./taxonomy";

describe("intervals", () => {
  it("refuses to be written high rung first", () => {
    expect(() => interval("VP", "Director")).toThrow(LadderError);
  });

  it("expands into a contiguous run, lowest first", () => {
    expect(expand(interval("Manager", "CSuite"))).toEqual([
      "Manager",
      "Director",
      "VP",
      "CSuite",
    ]);
  });

  it("reads a lexicon value as a point or an interval", () => {
    expect(isPoint(fromEntryValue("VP"))).toBe(true);
    expect(width(fromEntryValue(["Director", "VP"]))).toBe(2);
  });

  it("covers the whole ladder without a hole", () => {
    expect(expand(FULL_LADDER)).toEqual([...SENIORITY_IDS]);
  });
});

describe("combination", () => {
  it("intersects overlapping claims", () => {
    expect(intersect(interval("Manager", "VP"), interval("Director", "CSuite"))).toEqual(
      interval("Director", "VP"),
    );
  });

  it("returns undefined for claims that do not overlap — a conflict, not an answer", () => {
    expect(intersect(interval("IC", "Manager"), interval("VP", "CSuite"))).toBeUndefined();
  });

  it("hulls a conflict into the smallest interval containing both", () => {
    expect(hull(interval("IC", "IC"), interval("VP", "VP"))).toEqual(interval("IC", "VP"));
  });
});

describe("contiguity", () => {
  it("accepts a run and rejects a set with a hole", () => {
    expect(isContiguous(["Director", "VP"])).toBe(true);
    expect(isContiguous(["Director", "CSuite"])).toBe(false);
    expect(isContiguous(["VP", "Director"])).toBe(true);
    expect(isContiguous([])).toBe(false);
  });

  it("rejects a repeated rung, which would fake a wider interval", () => {
    expect(isContiguous(["VP", "VP"])).toBe(false);
  });

  it("throws rather than silently widening a set with a hole", () => {
    expect(() => intervalFromSet(["IC", "VP"])).toThrow(LadderError);
    expect(intervalFromSet(["VP", "Director"])).toEqual(interval("Director", "VP"));
  });
});
