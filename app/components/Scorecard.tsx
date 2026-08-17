"use client";

import { DIMENSIONS, type CorpusMetrics, type Dimension } from "@/lib/normalize";
import { Panel, Stat, percent } from "./ui";

/**
 * Four numbers per dimension, both corpora side by side, never averaged. Two
 * thousand generated titles would bury the 129 that are the actual test, and a single
 * blended "accuracy" figure is the number this project exists to refuse to publish.
 *
 * Silent errors get the alarm treatment whether the count is zero or not, so a reader
 * knows which cell to look at first and what it would look like if it were bad.
 */
export function Scorecard({
  metrics,
  pasted,
}: {
  metrics: CorpusMetrics[];
  pasted?: { count: number; coverage: Record<Dimension, number> };
}) {
  if (pasted) {
    return (
      <Panel
        title="Scorecard"
        subtitle={`${pasted.count} pasted titles · coverage only`}
      >
        <div className="space-y-3 p-3">
          <div className="grid grid-cols-2 gap-2">
            {DIMENSIONS.map((dimension) => (
              <Stat
                key={dimension}
                label={dimension}
                value={percent(pasted.coverage[dimension])}
                hint="resolved"
              />
            ))}
          </div>
          <p className="text-xs text-slate">
            Accuracy, silent-error rate and abstention precision are absent rather than
            estimated: your titles have no gold labels, so there is no denominator. What
            you can read here is how often this engine is willing to answer your data — and
            the Abstentions pane says why it refused.
          </p>
        </div>
      </Panel>
    );
  }

  const headline = metrics.map((corpus) => ({
    corpus,
    fn: corpus.dimensions.function,
  }));

  return (
    <Panel
      title="Scorecard"
      subtitle="the two corpora are never averaged — a blended figure is the number this repo refuses to publish"
    >
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-2 gap-2">
          {headline.map(({ corpus, fn }) => (
            <Stat
              key={corpus.corpus}
              label={`${corpus.corpus} · silent errors`}
              value={`${fn.silentErrors} (${percent(fn.silentErrorRate)})`}
              hint={`function · ${corpus.count} titles`}
              alarm
            />
          ))}
        </div>

        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-rule">
              {["dimension", "corpus", "coverage", "acc/resolved", "silent", "abstain =", "abstain ⊇"].map(
                (column) => (
                  <th key={column} className="marking px-2 py-1.5 font-medium">
                    {column}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="tabular font-mono text-[0.6875rem]">
            {DIMENSIONS.flatMap((dimension) =>
              metrics.map((corpus) => {
                const d = corpus.dimensions[dimension];
                return (
                  <tr key={`${dimension}-${corpus.corpus}`} className="border-b border-rule/60">
                    <td className="px-2 py-1 text-slate">{dimension}</td>
                    <td className="px-2 py-1 text-slate">{corpus.corpus}</td>
                    <td className="px-2 py-1">{percent(d.coverage)}</td>
                    <td className="px-2 py-1">{percent(d.accuracyOnResolved)}</td>
                    <td className={`px-2 py-1 ${d.silentErrors > 0 ? "text-silent" : "text-resolved"}`}>
                      {d.silentErrors}
                    </td>
                    <td className="px-2 py-1">
                      {d.abstentions === 0 ? "—" : percent(d.abstentionPrecisionExact)}
                    </td>
                    <td className="px-2 py-1 text-slate">
                      {d.abstentions === 0 ? "—" : percent(d.abstentionPrecisionContaining)}
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>

        <p className="text-xs text-slate">
          <span className="text-ink">Silent error</span> = resolved and wrong. It leads because
          accuracy-on-resolved can be driven to 100% by refusing to answer, and a confidence score
          can be driven anywhere by not checking. <span className="text-ink">Abstain =</span> is set
          equality against gold; <span className="text-ink">⊇</span> is mere containment, reported
          beside it because abstaining with all eight rungs would score 100% on containment alone.
          There is no threshold dial.
        </p>
      </div>
    </Panel>
  );
}
