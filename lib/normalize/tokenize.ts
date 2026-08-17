/**
 * String hygiene, and the two stops that happen before any lexicon is consulted.
 *
 * This module handles the part of the problem everybody thinks *is* the problem:
 * casing, punctuation, separators, credentials, appended junk. It is genuinely
 * the easy half, and keeping it in one place is what lets the interesting half —
 * an underdetermined taxonomy — be reasoned about on clean tokens.
 *
 * Two decisions live here and nowhere else:
 *
 *   - `non-english`: a script range or a language marker fires and the engine
 *     stops. Abstaining loudly on `Directeur Commercial` is a correct answer;
 *     guessing Engineering from `Directeur` is not, and a small four-language
 *     lexicon would produce exactly that class of confident mistake at the edges.
 *   - `garbage-only`: after junk is removed there is nothing role-bearing left.
 *     This is distinct from `no-evidence`, which means tokens survived but the
 *     lexicon had nothing to say about them.
 *
 * Whether a *part* of a title is role-bearing is a lexicon question, so it comes
 * in as a predicate rather than as an import — `lib/normalize/tokenize.ts` never
 * learns what the lexicon contains.
 */

import { REGION_TOKENS, type ScopeId } from "./taxonomy";
import type { UnknownReason } from "./types";

/** Cyrillic, Greek, Hebrew, Arabic, Devanagari, CJK, Kana, Hangul, Thai. */
const NON_LATIN =
  /[Ͱ-ϿЀ-ԯ֐-׿؀-ۿऀ-ॿ぀-ヿ㐀-䶿一-鿿가-힯฀-๿]/u;

/**
 * High-signal non-English role words. Every entry is chosen because it is *not*
 * also an English title word — `commercial`, `director`, `manager` and `analyst`
 * are deliberately absent, since `Commercial Director` is an ordinary UK title.
 */
const LANGUAGE_MARKERS = new Set([
  "directeur",
  "directrice",
  "direktor",
  "direktorin",
  "diretor",
  "direttore",
  "geschaftsfuhrer",
  "geschaftsfuhrerin",
  "leiter",
  "leiterin",
  "prokurist",
  "vertrieb",
  "vertriebsleiter",
  "einkauf",
  "verkoop",
  "hoofd",
  "medewerker",
  "bedrijfsleider",
  "gerente",
  "gerencia",
  "jefe",
  "jefa",
  "responsable",
  "ventas",
  "vendas",
  "vendite",
  "mercadotecnia",
  "mercadeo",
  "ingeniero",
  "ingenieur",
  "ingegnere",
  "amministratore",
  "delegato",
  "dirigeant",
  "chef",
  "chargé",
  "charge",
  "adjoint",
  "kierownik",
  "koordynator",
  "sprzedazy",
  "verkstallande",
  "grundare",
  "forsaljningschef",
  "salgschef",
  "toimitusjohtaja",
  "mudur",
  "genel",
]);


const URLISH = /https?:\/\/|www\.|\.com\b|\.io\b|\.ai\b|\.co\b/;
const HASHTAG = /#\w/;
const JUNK_PHRASES = [
  "hiring",
  "we are hiring",
  "open to work",
  "opentowork",
  "dm me",
  "let's talk",
  "lets talk",
  "views my own",
  "opinions my own",
  "ex-",
  "formerly",
  "book a demo",
  "linkedin",
  "top voice",
];

/** Dropped silently: they carry no information and naming them as evidence is noise. */
const STOPWORDS = new Set(["of", "the", "for", "to", "in", "at", "a", "an", "on", "with"]);

/** Segment boundaries. `,` is deliberately *not* one — `Director, EMEA` is one role. */
const CONJUNCTIONS = new Set(["and", "&", "/", "+", "|"]);
export const CONJUNCTION = "&";

const CREDENTIALS = new Set([
  "mba",
  "phd",
  "cpa",
  "cfa",
  "pmp",
  "msc",
  "bsc",
  "ba",
  "bs",
  "ms",
  "jd",
  "cissp",
  "cism",
  "cpim",
  "cma",
  "mph",
  "pe",
  "csm",
  "safe",
  "itil",
]);

const HONORIFICS = new Set(["mr", "mrs", "ms", "mx", "prof", "sir"]);

export type RegionHit = { token: string; scope: ScopeId };

export type Tokenized = {
  raw: string;
  /** The token stream the engine actually reasons over, joined for display. */
  normalized: string;
  tokens: string[];
  regions: RegionHit[];
  /** Everything removed, in the words it was removed as. This is evidence. */
  stripped: string[];
  /** Set when the pipeline must stop before the lexicon is consulted. */
  signal?: { reason: UnknownReason; because: string[] };
};

export type TokenizeOptions = {
  /**
   * Does this fragment contain anything a lexicon could act on? Passed in by
   * `resolve`, which does know the lexicon. The default is structural only:
   * a fragment with letters counts. That default keeps `tokenize` testable in
   * isolation, and it is why `VP Sales | Acme` needs the real predicate to shed
   * the company name.
   */
  isRoleBearing?: (fragment: string) => boolean;
};

function foldDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * Emoji are decoration, not delimiters: `Sales Intern 🚀🚀` arrives with no
 * separator at all, so judging the part as junk because it contains a rocket would
 * throw away a perfectly ordinary title. They are removed first and reported as
 * stripped; what remains is judged on its own.
 */
function deEmoji(fragment: string): string {
  return fragment.replace(/\p{Extended_Pictographic}/gu, " ").replace(/\s+/g, " ").trim();
}

function looksJunky(fragment: string): boolean {
  const lower = fragment.toLowerCase();
  if (URLISH.test(lower) || HASHTAG.test(fragment)) return true;
  if (JUNK_PHRASES.some((phrase) => lower.includes(phrase))) return true;
  return !/[a-z]/i.test(foldDiacritics(fragment));
}

/**
 * Titles arrive in parts, and the delimiter says how the parts relate.
 *
 * A pipe or a bullet joins *peers*: `Founder | CEO` is two roles, and a role-bearing
 * part on each side is a compound title. An `@`, a spaced dash or a run of spaces
 * is a *separator*: `Director - Marketing` is one role written with punctuation, and
 * treating that dash as a conjunction would split a perfectly ordinary title into a
 * rung with no function and a function with no rung. Both forms shed a part that the
 * lexicon has nothing to say about, which is how `VP Sales | Acme` loses `Acme`.
 */
type Part = { text: string; peer: boolean };

function splitParts(raw: string): Part[] {
  const parts: Part[] = [];
  let buffer = "";
  let peer = false;

  const flush = () => {
    const text = buffer.trim();
    if (text.length > 0) parts.push({ text, peer });
    buffer = "";
  };

  const peerBoundary = /[|•·]/;
  const separatorBoundary = /^(@|\s[-–—]\s|\s{3,})/;

  for (let index = 0; index < raw.length; ) {
    const rest = raw.slice(index);
    const separator = separatorBoundary.exec(rest);
    const char = raw[index] ?? "";

    if (peerBoundary.test(char)) {
      flush();
      peer = true;
      index += 1;
      continue;
    }
    if (separator) {
      flush();
      peer = false;
      index += separator[0].length;
      continue;
    }
    buffer += char;
    index += 1;
  }
  flush();

  return parts;
}

function words(fragment: string): string[] {
  return foldDiacritics(fragment)
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/([&/+])/g, " $1 ")
    .split(/[^a-z0-9&/+]+/)
    .filter((w) => w.length > 0);
}

/**
 * Lexicon patterns run through the same word splitter as titles, so a pattern can
 * be written the way a human reads it — `head of sales` — and still match a token
 * stream that dropped `of`.
 */
export function patternTokens(pattern: string): string[] {
  return words(pattern).filter((w) => !STOPWORDS.has(w) && !CONJUNCTIONS.has(w));
}

export function tokenize(raw: string, options: TokenizeOptions = {}): Tokenized {
  const isRoleBearing = options.isRoleBearing ?? ((fragment: string) => /[a-z]/i.test(fragment));

  const base: Omit<Tokenized, "signal"> = {
    raw,
    normalized: "",
    tokens: [],
    regions: [],
    stripped: [],
  };

  if (NON_LATIN.test(raw)) {
    const hit = raw.match(NON_LATIN)?.[0] ?? raw;
    return {
      ...base,
      signal: { reason: "non-english", because: [`non-Latin script: “${hit}”`] },
    };
  }

  // Before junk filtering, not after: a foreign title has no lexicon evidence, so
  // the role-bearing predicate would throw the whole string away and report
  // `garbage-only`. `Directeur Commercial` is not garbage — it is a title in a
  // language this engine declines to handle, and the reason has to say so.
  const rawMarker = words(raw).find((word) => LANGUAGE_MARKERS.has(word));
  if (rawMarker) {
    return {
      ...base,
      signal: { reason: "non-english", because: [`language marker: “${rawMarker}”`] },
    };
  }

  const parts = splitParts(raw);
  const stripped: string[] = [];
  const kept: Part[] = [];

  for (const part of parts) {
    const withoutEmoji = deEmoji(part.text);
    if (withoutEmoji !== part.text) stripped.push("emoji");
    if (withoutEmoji.length === 0) continue;
    if (looksJunky(withoutEmoji) || !isRoleBearing(withoutEmoji)) {
      stripped.push(withoutEmoji);
      continue;
    }
    kept.push({ text: withoutEmoji, peer: part.peer });
  }

  if (kept.length === 0) {
    return {
      ...base,
      stripped,
      signal: {
        reason: "garbage-only",
        because:
          stripped.length > 0
            ? [`nothing role-bearing survived: ${stripped.map((s) => `“${s}”`).join(", ")}`]
            : ["the input contained no letters"],
      },
    };
  }

  const tokens: string[] = [];
  const regions: RegionHit[] = [];

  kept.forEach((part, index) => {
    if (index > 0 && part.peer) tokens.push(CONJUNCTION);
    for (const word of words(part.text)) {
      if (CONJUNCTIONS.has(word)) {
        if (tokens.length > 0 && tokens[tokens.length - 1] !== CONJUNCTION) tokens.push(CONJUNCTION);
        continue;
      }
      if (STOPWORDS.has(word)) continue;
      if (HONORIFICS.has(word) || CREDENTIALS.has(word)) {
        stripped.push(word);
        continue;
      }
      if (/^\d+$/.test(word)) {
        stripped.push(word);
        continue;
      }
      const scope = REGION_TOKENS[word];
      if (scope) {
        regions.push({ token: word, scope });
        continue;
      }
      tokens.push(word);
    }
  });

  while (tokens.length > 0 && tokens[tokens.length - 1] === CONJUNCTION) tokens.pop();
  while (tokens.length > 0 && tokens[0] === CONJUNCTION) tokens.shift();

  if (tokens.length === 0) {
    return {
      ...base,
      stripped,
      regions,
      normalized: "",
      signal: {
        reason: "garbage-only",
        because:
          regions.length > 0
            ? [`only a region token remained: “${regions.map((r) => r.token).join(", ")}”`]
            : ["nothing role-bearing survived tokenization"],
      },
    };
  }

  return { raw, normalized: tokens.join(" "), tokens, regions, stripped };
}
