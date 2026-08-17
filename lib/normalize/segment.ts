/**
 * Compound titles.
 *
 * `Founder & CTO` is not an ambiguous title — it is two facts about one person,
 * and a normalizer that returns one of them has thrown information away. Which
 * one you get from the tools that do this is decided by token order inside
 * somebody's regex.
 *
 * So the token stream splits on conjunction boundaries into *role segments*, each
 * of which is resolved independently, and one of them is named primary by a rule
 * that is written down here rather than emerging from an accident of ordering.
 */

import { CONJUNCTION } from "./tokenize";
import { rankOf } from "./taxonomy";
import type { Role, Verdict } from "./types";
import type { SeniorityId } from "./taxonomy";

/**
 * Split on conjunction markers, structurally. A segment with no seniority
 * evidence is still a segment: `Sales & Marketing Manager` yields `sales` and
 * `marketing manager`, the first with an unknown rung, and the primary rule below
 * picks the second. Nothing is discarded and nothing is invented — the reader sees
 * both roles in `roles[]` and can tell which one the lifted dimensions came from.
 *
 * The engine deliberately does not try to detect that such a title "really" means
 * one role holding two functions. Doing so would require inventing an ambiguity
 * reason for a title where the lexicon is complete and the world is not forked,
 * and a fourth reason for one syntactic case is worse than a visible second role.
 */
export function segmentTokens(tokens: string[]): string[][] {
  const segments: string[][] = [];
  let current: string[] = [];

  for (const token of tokens) {
    if (token === CONJUNCTION) {
      if (current.length > 0) segments.push(current);
      current = [];
      continue;
    }
    current.push(token);
  }
  if (current.length > 0) segments.push(current);

  return segments.length > 0 ? segments : [[]];
}

/**
 * Rank a seniority verdict for the purpose of choosing a primary role. An
 * ambiguous seniority ranks at its *highest* candidate: `Founder & Head of Sales`
 * has a primary of `Founder` either way, and taking the top of the interval means
 * an ambiguity can never demote a role below one that is certainly more junior.
 * An unknown seniority ranks below every known rung rather than at the bottom
 * rung, because "I don't know" is not "Intern".
 */
export function primaryRank(verdict: Verdict<SeniorityId>): number {
  if (verdict.state === "resolved") return rankOf(verdict.value);
  if (verdict.state === "ambiguous") return Math.max(...verdict.candidates.map(rankOf));
  return -1;
}

/** Highest ladder rung wins; ties go to the leftmost segment. */
export function selectPrimary(roles: Role[]): number {
  let best = 0;
  let bestRank = -Infinity;

  roles.forEach((role, index) => {
    const rank = primaryRank(role.seniority);
    if (rank > bestRank) {
      best = index;
      bestRank = rank;
    }
  });

  return best;
}
