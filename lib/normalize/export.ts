/**
 * Serialisation: a CSV a reviewer can open, and a permalink they can send.
 *
 * The CSV keeps the three-state verdict intact rather than flattening it into a
 * value column, because a spreadsheet that says `Sales` where the engine said
 * `{Sales, Marketing} (taxonomy-fork)` has thrown away the entire point.
 *
 * The permalink is capped, and over-cap is an *error* rather than a truncation. In a
 * tool whose thesis is that nothing should happen silently, quietly dropping the
 * tail of somebody's paste would be the funniest possible bug to ship.
 */

import { MAX_INPUT_BYTES, MAX_TITLES, MAX_TITLE_LENGTH } from "./schema";
import type { Dimension, Result, Verdict } from "./types";

/* ── CSV ─────────────────────────────────────────────────────────────────── */

const COLUMNS = [
  "raw",
  "normalized",
  "compound",
  "roles",
  "function",
  "function_state",
  "function_reason",
  "seniority",
  "seniority_state",
  "seniority_reason",
  "scope",
  "band",
  "persona",
  "persona_state",
  "evidence",
] as const;

function answer(verdict: Verdict<string>): string {
  if (verdict.state === "resolved") return verdict.value;
  if (verdict.state === "ambiguous") return verdict.candidates.join(" | ");
  return "";
}

function reason(verdict: Verdict<string>): string {
  return verdict.state === "resolved" ? "" : verdict.reason;
}

function cell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function verdictOf(dimension: Dimension, result: Result): Verdict<string> {
  if (dimension === "function") return result.function;
  if (dimension === "seniority") return result.seniority;
  if (dimension === "scope") return result.scope;
  return result.persona;
}

export function toCsv(results: Result[]): string {
  const rows = results.map((result) => {
    const evidence = [
      ...new Set([
        ...result.function.because,
        ...result.seniority.because,
        ...result.scope.because,
      ]),
    ].join("; ");

    return [
      result.raw,
      result.normalized,
      String(result.compound),
      String(result.roles.length),
      answer(result.function),
      result.function.state,
      reason(result.function),
      answer(result.seniority),
      result.seniority.state,
      reason(result.seniority),
      answer(result.scope),
      answer(result.band),
      answer(verdictOf("persona", result)),
      result.persona.state,
      evidence,
    ].map(cell);
  });

  return [COLUMNS.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

/* ── permalink ───────────────────────────────────────────────────────────── */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function toBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0;
    const b = bytes[index + 1];
    const c = bytes[index + 2];
    const triple = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += ALPHABET[(triple >> 18) & 63] ?? "";
    out += ALPHABET[(triple >> 12) & 63] ?? "";
    if (b !== undefined) out += ALPHABET[(triple >> 6) & 63] ?? "";
    if (c !== undefined) out += ALPHABET[triple & 63] ?? "";
  }
  return out;
}

function fromBase64Url(text: string): Uint8Array {
  const values = [...text]
    .map((character) => ALPHABET.indexOf(character))
    .filter((value) => value >= 0);
  const bytes: number[] = [];
  for (let index = 0; index < values.length; index += 4) {
    const chunk = values.slice(index, index + 4);
    const [a = 0, b = 0, c, d] = chunk;
    const triple = (a << 18) | (b << 12) | ((c ?? 0) << 6) | (d ?? 0);
    bytes.push((triple >> 16) & 255);
    if (c !== undefined) bytes.push((triple >> 8) & 255);
    if (d !== undefined) bytes.push(triple & 255);
  }
  return new Uint8Array(bytes);
}

export type EncodeResult =
  | { state: "ok"; value: string }
  | { state: "over-cap"; titles: number; bytes: number; maxTitles: number; maxBytes: number };

export function encodeTitles(titles: string[]): EncodeResult {
  const joined = titles.join("\n");
  const bytes = new TextEncoder().encode(joined);

  if (titles.length > MAX_TITLES || bytes.length > MAX_INPUT_BYTES) {
    return {
      state: "over-cap",
      titles: titles.length,
      bytes: bytes.length,
      maxTitles: MAX_TITLES,
      maxBytes: MAX_INPUT_BYTES,
    };
  }
  return { state: "ok", value: toBase64Url(bytes) };
}

export type DecodeResult =
  | { state: "ok"; titles: string[] }
  | { state: "malformed" }
  | { state: "over-cap"; titles: number; maxTitles: number };

export function decodeTitles(encoded: string): DecodeResult {
  let joined: string;
  try {
    joined = new TextDecoder("utf-8", { fatal: true }).decode(fromBase64Url(encoded));
  } catch {
    return { state: "malformed" };
  }

  const titles = joined
    .split("\n")
    .map((title) => title.trim().slice(0, MAX_TITLE_LENGTH))
    .filter((title) => title.length > 0);

  if (titles.length === 0) return { state: "malformed" };
  if (titles.length > MAX_TITLES) {
    return { state: "over-cap", titles: titles.length, maxTitles: MAX_TITLES };
  }
  return { state: "ok", titles };
}
