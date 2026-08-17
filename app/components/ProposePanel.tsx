"use client";

import { useState } from "react";
import type { LexiconEntry } from "@/lib/normalize";
import { Button } from "./ui";
import type { AbstentionGroup } from "./Abstentions";

/**
 * The model's output, rendered as a diff you copy.
 *
 * It is deliberately not applied. An entry that the engine started using the moment a
 * model wrote it would put the model back in the resolution path through the side
 * door, and every number on the scorecard would silently become a claim about model
 * behaviour instead of about a file a human can read.
 */

function renderEntry(entry: LexiconEntry): string {
  const lines = [
    "  {",
    `    pattern: ${JSON.stringify(entry.pattern)},`,
    `    kind: ${JSON.stringify(entry.kind)},`,
  ];
  if (entry.function !== undefined) {
    lines.push(`    function: ${JSON.stringify(entry.function)},`);
  }
  if (entry.seniority !== undefined) {
    lines.push(`    seniority: ${JSON.stringify(entry.seniority)},`);
  }
  if (entry.scope !== undefined) {
    lines.push(`    scope: ${JSON.stringify(entry.scope)},`);
  }
  if (entry.note !== undefined) {
    lines.push(`    note: ${JSON.stringify(entry.note)},`);
  }
  lines.push("  },");
  return lines.join("\n");
}

export function ProposeButton({ group }: { group: AbstentionGroup }) {
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; entries: LexiconEntry[] }
  >({ kind: "idle" });

  async function propose() {
    setState({ kind: "loading" });
    try {
      const response = await fetch("/api/propose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          titles: group.titles.slice(0, 40).map((title) => title.raw),
          reason: group.reason,
        }),
      });
      const body = (await response.json()) as { entries?: LexiconEntry[]; error?: string };
      if (!response.ok) {
        setState({ kind: "error", message: body.error ?? `request failed (${response.status})` });
        return;
      }
      setState({ kind: "ready", entries: body.entries ?? [] });
    } catch {
      setState({ kind: "error", message: "the request could not be sent" });
    }
  }

  return (
    <div className="min-w-0">
      <Button onClick={propose} disabled={state.kind === "loading"}>
        {state.kind === "loading" ? "proposing…" : "propose entries"}
      </Button>

      {state.kind === "error" ? (
        <p className="mt-1 max-w-md text-[0.6875rem] text-slate">{state.message}</p>
      ) : null}

      {state.kind === "ready" ? (
        <div className="mt-2">
          {state.entries.length === 0 ? (
            <p className="text-[0.6875rem] text-slate">
              The model proposed nothing for this group, which for a declared fork is the right
              answer.
            </p>
          ) : (
            <>
              <div className="marking">
                {state.entries.length} candidate {state.entries.length === 1 ? "entry" : "entries"} ·
                unapplied
              </div>
              <pre className="mt-1 max-h-64 overflow-auto rounded border border-rule bg-card p-2 font-mono text-[0.625rem] leading-relaxed text-ink">
                {state.entries.map(renderEntry).join("\n")}
              </pre>
              <div className="mt-1 flex items-center gap-2">
                <Button
                  onClick={() =>
                    void navigator.clipboard.writeText(state.entries.map(renderEntry).join("\n"))
                  }
                >
                  copy
                </Button>
                <span className="text-[0.6875rem] text-slate">
                  paste into <span className="font-mono">lib/normalize/lexicon.ts</span>, then run{" "}
                  <span className="font-mono">npm run sweep</span> — monotonicity will tell you
                  whether the entry is safe.
                </span>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
