/**
 * The real engine boundary.
 *
 * The eslint rule in `eslint.config.mjs` enforces the same thing with an allowlist,
 * and an allowlist is a promise. This test reads the engine's own source off disk
 * and checks it with no allowlist at all: a normalizer that cannot reach a network
 * client, a database or a clock cannot return an answer that is not a consequence of
 * its arguments and its lexicon, and that is what makes the published numbers mean
 * anything.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ENGINE = join(import.meta.dirname, ".");

function engineSources(): { file: string; source: string }[] {
  return readdirSync(ENGINE)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .map((file) => ({ file, source: readFileSync(join(ENGINE, file), "utf8") }));
}

const FORBIDDEN_IMPORTS = [
  "next",
  "react",
  "react-dom",
  "@google/genai",
  "@/data",
  "@/app",
  "@/lib/propose",
  "node:fs",
  "node:path",
  "node:crypto",
];

/** Anything that would make the same input produce a different answer twice. */
const FORBIDDEN_GLOBALS = [
  "Date.now",
  "new Date",
  "Math.random",
  "fetch(",
  "process.env",
  "localStorage",
  "document.",
  "window.",
];

describe("the engine boundary", () => {
  it("finds engine sources at all — a passing test over zero files proves nothing", () => {
    expect(engineSources().length).toBeGreaterThan(8);
  });

  it("imports zod and its own relative modules, and nothing else", () => {
    for (const { file, source } of engineSources()) {
      const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1] ?? "");
      for (const specifier of imports) {
        const allowed = specifier === "zod" || specifier.startsWith("./");
        expect(allowed, `${file} imports ${specifier}`).toBe(true);
      }
      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(imports, `${file} imports ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("reads no clock, no random source, no environment and no DOM", () => {
    for (const { file, source } of engineSources()) {
      for (const global of FORBIDDEN_GLOBALS) {
        expect(source.includes(global), `${file} uses ${global}`).toBe(false);
      }
    }
  });
});
