"use client";

import { Fragment, useState } from "react";
import type { Result, CorpusTitle } from "@/lib/normalize";
import { Panel, VerdictChip } from "./ui";

/**
 * The table. Every cell is a verdict rather than a value, and hovering one shows the
 * evidence that produced it — the tokens and phrases, verbatim. A reader who does not
 * believe an answer can check it without leaving the row.
 */
export function Verdicts({
  rows,
  note,
}: {
  rows: { title?: CorpusTitle; result: Result }[];
  note?: string;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <Panel
      title="Verdicts"
      subtitle={note ?? `${rows.length} titles · click a row for its evidence and its roles`}
    >
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-rule">
            {["title", "function", "seniority", "scope", "persona"].map((column) => (
              <th key={column} className="marking px-3 py-2 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ title, result }, index) => (
            <Fragment key={`${result.raw}-${index}`}>
              <tr
                onClick={() => setExpanded(expanded === index ? null : index)}
                className="cursor-pointer border-b border-rule/60 align-top hover:bg-paper"
              >
                <td className="max-w-[22rem] px-3 py-1.5">
                  <div className="truncate font-mono text-[0.6875rem] text-ink">{result.raw}</div>
                  {title?.trap ? (
                    <div className="mt-0.5 truncate text-[0.625rem] text-slate italic">
                      {title.trap}
                    </div>
                  ) : null}
                  {result.compound ? (
                    <div className="marking mt-0.5 !text-[0.5625rem]">
                      compound · {result.roles.length} roles
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-1.5">
                  <VerdictChip verdict={result.function} />
                </td>
                <td className="px-3 py-1.5">
                  <VerdictChip verdict={result.seniority} />
                </td>
                <td className="px-3 py-1.5">
                  <VerdictChip verdict={result.scope} />
                </td>
                <td className="px-3 py-1.5">
                  <VerdictChip verdict={result.persona} />
                </td>
              </tr>
              {expanded === index ? (
                <tr className="border-b border-rule bg-paper">
                  <td colSpan={5} className="px-3 py-2">
                    <div className="marking">tokenized</div>
                    <div className="font-mono text-[0.6875rem] text-ink">
                      {result.normalized || "—"}
                    </div>

                    <div className="marking mt-2">roles</div>
                    <ul className="space-y-1">
                      {result.roles.map((role, roleIndex) => (
                        <li key={roleIndex} className="font-mono text-[0.6875rem]">
                          <span className={roleIndex === result.primaryIndex ? "text-ink" : "text-slate"}>
                            {roleIndex === result.primaryIndex ? "▸ " : "  "}
                            {role.segment || "—"}
                          </span>{" "}
                          <VerdictChip verdict={role.function} />{" "}
                          <VerdictChip verdict={role.seniority} />
                        </li>
                      ))}
                    </ul>

                    <div className="marking mt-2">evidence</div>
                    <ul className="space-y-0.5 font-mono text-[0.6875rem] text-slate">
                      {[
                        ...new Set([
                          ...result.function.because,
                          ...result.seniority.because,
                          ...result.scope.because,
                        ]),
                      ].map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>

                    {title ? (
                      <>
                        <div className="marking mt-2">gold</div>
                        <div className="font-mono text-[0.6875rem] text-slate">
                          function{" "}
                          {title.gold.function.kind === "labelled"
                            ? title.gold.function.values.join(" | ")
                            : `unknowable (${title.gold.function.reason})`}
                          {" · rung "}
                          {title.gold.seniority.kind === "labelled"
                            ? title.gold.seniority.values.join(" | ")
                            : `unknowable (${title.gold.seniority.reason})`}
                        </div>
                      </>
                    ) : null}
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-xs text-slate">
                nothing matches this filter.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </Panel>
  );
}
