import { describe, expect, it } from "vitest";
import { decodeTitles, encodeTitles, toCsv } from "./export";
import { normalizeTitles } from "./resolve";
import { MAX_TITLES } from "./schema";

describe("CSV", () => {
  it("keeps an ambiguity as an ambiguity instead of flattening it to a value", () => {
    const csv = toCsv(normalizeTitles(["Head of Growth"]));
    const [, row = ""] = csv.split("\n");
    expect(row).toContain("Sales | Marketing");
    expect(row).toContain("ambiguous");
    expect(row).toContain("taxonomy-fork");
  });

  it("quotes a field containing a comma or a quote", () => {
    const csv = toCsv(normalizeTitles(['VP, Sales "the good one"']));
    expect(csv).toContain('"VP, Sales ""the good one"""');
  });

  it("emits one header and one row per title", () => {
    const csv = toCsv(normalizeTitles(["CEO", "Head of Sales", "🚀"]));
    expect(csv.split("\n")).toHaveLength(4);
  });

  it("carries the evidence, so a reader can audit a verdict from the file alone", () => {
    const csv = toCsv(normalizeTitles(["Sales Engineer"]));
    expect(csv).toContain("sales engineer");
  });
});

describe("permalink", () => {
  it("round-trips titles, emoji and all", () => {
    const titles = ["VP of Sales", "Head of Growth 🚀", "Directeur Commercial"];
    const encoded = encodeTitles(titles);
    if (encoded.state !== "ok") throw new Error("expected an encodable list");
    expect(decodeTitles(encoded.value)).toEqual({ state: "ok", titles });
  });

  it("refuses an over-cap list rather than truncating it", () => {
    const many = Array.from({ length: MAX_TITLES + 1 }, (_, i) => `VP Sales ${i}`);
    const encoded = encodeTitles(many);
    expect(encoded.state).toBe("over-cap");
    if (encoded.state === "over-cap") {
      expect(encoded.titles).toBe(MAX_TITLES + 1);
      expect(encoded.maxTitles).toBe(MAX_TITLES);
    }
  });

  it("refuses by bytes as well as by count", () => {
    const fat = Array.from({ length: 30 }, () => "x".repeat(190));
    expect(encodeTitles(fat).state).toBe("over-cap");
  });

  it("reports malformed input instead of guessing at it", () => {
    expect(decodeTitles("!!!!").state).toBe("malformed");
    expect(decodeTitles("").state).toBe("malformed");
  });
});
