"use client";

import { ABSTENTION_REASONS, type AbstentionReason, type Result } from "@/lib/normalize";
import { Panel } from "./ui";

/**
 * Grouped by reason, because the reasons are not the same kind of thing.
 *
 *   taxonomy-fork  correct output. Nobody has work to do.
 *   lexicon-gap    a missing phrase. Somebody has work to do.
 *   no-evidence    a role this lexicon has never seen.
 *   non-english    out of scope by design.
 *   garbage-only   the input was not a title.
 *
 * A single "ambiguous" bucket — which is what every tool in this category ships —
 * makes the first two indistinguishable, and that is the difference between a feature
 * and a TODO.
 */

const COPY: Record<AbstentionReason, { label: string; verdict: string; tone: string }> = {
  "taxonomy-fork": {
    label: "taxonomy fork",
    verdict: "correct output — the world is undecided, not the lexicon",
    tone: "border-fork/40 bg-fork-soft text-fork",
  },
  "lexicon-gap": {
    label: "lexicon gap",
    verdict: "actionable — a phrase entry would resolve these",
    tone: "border-gap/50 hatch-gap text-gap border-dashed",
  },
  "no-evidence": {
    label: "no evidence",
    verdict: "unseen role words — add them, or accept they are not titles",
    tone: "border-unknown/50 bg-unknown-soft text-unknown",
  },
  "non-english": {
    label: "non-english",
    verdict: "out of scope by design",
    tone: "border-unknown/50 bg-unknown-soft text-unknown",
  },
  "garbage-only": {
    label: "garbage only",
    verdict: "the input was not a title",
    tone: "border-unknown/50 bg-unknown-soft text-unknown",
  },
};

export type AbstentionGroup = {
  reason: AbstentionReason;
  titles: { raw: string; because: string[] }[];
};

export function groupAbstentions(results: Result[]): AbstentionGroup[] {
  const groups = new Map<AbstentionReason, { raw: string; because: string[] }[]>();

  for (const result of results) {
    // Grouped on the function verdict: it is the dimension a downstream system keys
    // off, and reporting one row per dimension would count the same title five times.
    const verdict = result.function;
    if (verdict.state === "resolved") continue;
    const list = groups.get(verdict.reason) ?? [];
    list.push({ raw: result.raw, because: verdict.because });
    groups.set(verdict.reason, list);
  }

  return ABSTENTION_REASONS.filter((reason) => (groups.get(reason)?.length ?? 0) > 0).map(
    (reason) => ({ reason, titles: groups.get(reason) ?? [] }),
  );
}

export function Abstentions({
  groups,
  action,
}: {
  groups: AbstentionGroup[];
  action?: (group: AbstentionGroup) => React.ReactNode;
}) {
  const total = groups.reduce((sum, group) => sum + group.titles.length, 0);

  return (
    <Panel
      title="Abstentions"
      subtitle={`${total} titles the engine declined to answer on function, grouped by why`}
    >
      <div className="space-y-3 p-3">
        {groups.length === 0 ? (
          <p className="text-xs text-slate">
            Nothing abstained. On a corpus of ordinary titles that is the expected result — the
            adversarial corpus is where the refusals live.
          </p>
        ) : null}

        {groups.map((group) => {
          const copy = COPY[group.reason];
          return (
            <div key={group.reason} className={`rounded border ${copy.tone} p-2`}>
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <span className="marking !text-current">{copy.label}</span>
                  <span className="tabular ml-2 font-mono text-xs">{group.titles.length}</span>
                </div>
                {action ? action(group) : null}
              </div>
              <p className="mt-0.5 text-[0.6875rem] text-slate">{copy.verdict}</p>
              <ul className="mt-1.5 space-y-0.5">
                {group.titles.slice(0, 12).map((title) => (
                  <li key={title.raw} className="font-mono text-[0.6875rem] text-ink">
                    {title.raw}
                    <span className="ml-2 text-slate">{title.because[0]}</span>
                  </li>
                ))}
              </ul>
              {group.titles.length > 12 ? (
                <div className="marking mt-1">
                  showing 12 of {group.titles.length} — the CSV has all of them
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
