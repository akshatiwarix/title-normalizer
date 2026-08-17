/**
 * Interval algebra on the seniority ladder.
 *
 * Seniority is the one dimension with an *order*, and that order is worth
 * exploiting: an honest uncertainty about a rung is always a contiguous run of
 * rungs. `Head of Sales` is "Director or VP", never "Director or C-suite but not
 * VP". So ambiguity is represented as `[lo, hi]` rather than as an arbitrary set,
 * which makes it a third of the size to store, exact to combine, and provable —
 * the sweep asserts contiguity over both corpora, and a violation means a lexicon
 * entry is wrong rather than that a title was unusual.
 */

import { SENIORITY_IDS, rankOf, seniorityAtRank, type SeniorityId } from "./taxonomy";

export type Interval = { lo: SeniorityId; hi: SeniorityId };

export class LadderError extends Error {}

export function interval(lo: SeniorityId, hi: SeniorityId): Interval {
  if (rankOf(lo) > rankOf(hi)) {
    throw new LadderError(`interval written high rung first: [${lo}, ${hi}]`);
  }
  return { lo, hi };
}

/** A lexicon entry writes a rung either as a point or as a closed interval. */
export function fromEntryValue(value: SeniorityId | [SeniorityId, SeniorityId]): Interval {
  return Array.isArray(value) ? interval(value[0], value[1]) : interval(value, value);
}

export function isPoint(iv: Interval): boolean {
  return iv.lo === iv.hi;
}

export function width(iv: Interval): number {
  return rankOf(iv.hi) - rankOf(iv.lo) + 1;
}

/** Every rung in the interval, lowest first. */
export function expand(iv: Interval): SeniorityId[] {
  const out: SeniorityId[] = [];
  for (let rank = rankOf(iv.lo); rank <= rankOf(iv.hi); rank += 1) {
    const id = seniorityAtRank(rank);
    if (id === undefined) throw new LadderError(`no rung at rank ${rank}`);
    out.push(id);
  }
  return out;
}

/** The smallest interval containing both. Used when contributors conflict. */
export function hull(a: Interval, b: Interval): Interval {
  const lo = rankOf(a.lo) <= rankOf(b.lo) ? a.lo : b.lo;
  const hi = rankOf(a.hi) >= rankOf(b.hi) ? a.hi : b.hi;
  return interval(lo, hi);
}

/** `undefined` when they do not overlap — that is a conflict, not an empty answer. */
export function intersect(a: Interval, b: Interval): Interval | undefined {
  const lo = rankOf(a.lo) >= rankOf(b.lo) ? a.lo : b.lo;
  const hi = rankOf(a.hi) <= rankOf(b.hi) ? a.hi : b.hi;
  return rankOf(lo) <= rankOf(hi) ? interval(lo, hi) : undefined;
}

export function isContiguous(ids: readonly SeniorityId[]): boolean {
  if (ids.length === 0) return false;
  const ranks = [...new Set(ids.map(rankOf))].sort((a, b) => a - b);
  if (ranks.length !== ids.length) return false;
  return ranks.every((rank, index) => index === 0 || rank === (ranks[index - 1] ?? rank) + 1);
}

/** The smallest interval covering a set of rungs; throws if the set has a hole. */
export function intervalFromSet(ids: readonly SeniorityId[]): Interval {
  if (ids.length === 0) throw new LadderError("cannot build an interval from an empty set");
  if (!isContiguous(ids)) {
    throw new LadderError(`seniority set is not contiguous: ${ids.join(", ")}`);
  }
  const ranks = ids.map(rankOf);
  const lo = seniorityAtRank(Math.min(...ranks));
  const hi = seniorityAtRank(Math.max(...ranks));
  if (lo === undefined || hi === undefined) throw new LadderError("rung out of range");
  return interval(lo, hi);
}

export const FULL_LADDER: Interval = interval(
  SENIORITY_IDS[0],
  SENIORITY_IDS[SENIORITY_IDS.length - 1] as SeniorityId,
);
