/**
 * The derived dimensions: band, then persona.
 *
 * These have no resolution path of their own, and that is the entire design. A CRM
 * that computes persona in a separate system, weeks later, with different logic,
 * ends up holding `function = Marketing`, `seniority = VP`, `persona = Technical
 * IC` at the same time — and all three get pulled into different dashboards. Here
 * persona is a function of (function, band), so that state is unrepresentable.
 *
 * The consequence worth noticing runs the other way too: an abstention does not
 * have to spread. `Head of Sales` is ambiguous between Director and VP, both of
 * which are the Leader band, so the band *resolves* even though the rung did not.
 */

import { bandOf, isPrunedPersona, personaLabel, type BandId, type FunctionId, type SeniorityId } from "./taxonomy";
import { ambiguous, resolved, unknown, type AmbiguityReason, type Verdict } from "./types";

/**
 * A gap upstream is a gap downstream. If either input abstained because the
 * lexicon is incomplete, the derived verdict says so rather than presenting the
 * ambiguity as a fact about the world.
 */
export function inheritedReason(...verdicts: Verdict<unknown>[]): AmbiguityReason {
  for (const verdict of verdicts) {
    if (verdict.state === "ambiguous" && verdict.reason === "lexicon-gap") return "lexicon-gap";
  }
  return "taxonomy-fork";
}

export function deriveBand(seniority: Verdict<SeniorityId>): Verdict<BandId> {
  if (seniority.state === "unknown") return unknown(seniority.reason, seniority.because);

  const rungs = seniority.state === "resolved" ? [seniority.value] : seniority.candidates;
  const bands = [...new Set(rungs.map(bandOf))];
  const only = bands[0];

  if (bands.length === 1 && only !== undefined) return resolved(only, seniority.because);
  return ambiguous(bands, inheritedReason(seniority), seniority.because);
}

export function derivePersona(
  fn: Verdict<FunctionId>,
  band: Verdict<BandId>,
): Verdict<string> {
  if (fn.state === "unknown") return unknown(fn.reason, fn.because);
  if (band.state === "unknown") return unknown(band.reason, band.because);

  const functions = fn.state === "resolved" ? [fn.value] : fn.candidates;
  const bands = band.state === "resolved" ? [band.value] : band.candidates;
  const because = [...new Set([...fn.because, ...band.because])];

  const labels = new Set<string>();
  for (const f of functions) {
    for (const b of bands) {
      if (isPrunedPersona(f, b)) continue;
      const label = personaLabel(f, b);
      if (label) labels.add(label);
    }
  }

  const values = [...labels];
  const only = values[0];

  if (values.length === 0) {
    return unknown("no-evidence", [
      `every (function, band) pair was pruned: ${functions.join("/")} × ${bands.join("/")}`,
    ]);
  }
  if (values.length === 1 && only !== undefined) return resolved(only, because);
  return ambiguous(values, inheritedReason(fn, band), because);
}
