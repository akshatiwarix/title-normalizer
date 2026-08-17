"use client";

import { useMemo, useState } from "react";
import {
  DIMENSIONS,
  MAX_TITLES,
  encodeTitles,
  normalizeTitles,
  toCsv,
  verdictFor,
  type CorpusMetrics,
  type CorpusTitle,
  type Dimension,
  type Result,
} from "@/lib/normalize";
import { Abstentions, groupAbstentions } from "./Abstentions";
import { ProposeButton } from "./ProposePanel";
import { Scorecard } from "./Scorecard";
import { Verdicts } from "./Verdicts";
import { Button, Panel } from "./ui";

export type CorpusView = {
  id: string;
  label: string;
  count: number;
  titles: CorpusTitle[];
  metrics: CorpusMetrics;
  note?: string;
};

/**
 * The console.
 *
 * Everything below the corpus load happens in the browser: the engine is a pure
 * function of a string and a lexicon, so pasting fifty of your own titles re-derives
 * every verdict, every group and every coverage figure with no round trip. That is
 * not a performance decision — a normalizer you can only query is a report about
 * somebody else's data, and the whole pitch is that you can point it at yours.
 */
export function Console({
  corpora,
  initialTitles,
  linkError,
}: {
  corpora: CorpusView[];
  initialTitles: string[] | null;
  linkError: string | null;
}) {
  const [selected, setSelected] = useState(corpora[0]?.id ?? "");
  const [draft, setDraft] = useState((initialTitles ?? []).join("\n"));
  const [pasted, setPasted] = useState<string[] | null>(initialTitles);
  const [copied, setCopied] = useState<string | null>(null);

  const corpus = corpora.find((view) => view.id === selected) ?? corpora[0];

  const pastedResults = useMemo(
    () => (pasted === null ? null : normalizeTitles(pasted)),
    [pasted],
  );

  const corpusResults = useMemo(
    () => (corpus === undefined ? [] : normalizeTitles(corpus.titles.map((title) => title.raw))),
    [corpus],
  );

  const showing: { title?: CorpusTitle; result: Result }[] =
    pastedResults !== null
      ? pastedResults.map((result) => ({ result }))
      : corpusResults.map((result, index) => ({ title: corpus?.titles[index], result }));

  const results = showing.map((row) => row.result);
  const groups = useMemo(() => groupAbstentions(results), [results]);

  const pastedCoverage = useMemo(() => {
    if (pastedResults === null) return undefined;
    const coverage = Object.fromEntries(
      DIMENSIONS.map((dimension) => [
        dimension,
        pastedResults.length === 0
          ? 0
          : pastedResults.filter((result) => verdictFor(dimension, result).state === "resolved")
              .length / pastedResults.length,
      ]),
    ) as Record<Dimension, number>;
    return { count: pastedResults.length, coverage };
  }, [pastedResults]);

  function parseDraft(): string[] {
    return draft
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  function normalizeDraft() {
    const titles = parseDraft();
    setPasted(titles.length === 0 ? null : titles);
    setCopied(null);
  }

  function copyPermalink() {
    const titles = parseDraft();
    const encoded = encodeTitles(titles);
    if (encoded.state === "over-cap") {
      setCopied(
        `too big to put in a URL: ${encoded.titles} titles / ${encoded.bytes} bytes, cap is ${encoded.maxTitles} / ${encoded.maxBytes}. Nothing was truncated — paste fewer titles.`,
      );
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}?t=${encoded.value}`;
    void navigator.clipboard.writeText(url);
    setCopied("permalink copied");
  }

  function downloadCsv() {
    const blob = new Blob([toCsv(results)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `title-normalizer-${pastedResults ? "pasted" : (corpus?.id ?? "corpus")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-[1500px] flex-col gap-3 p-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-mono text-sm text-ink">
            title-normalizer
            <span className="ml-2 text-slate">
              messy job title → function, seniority, persona — or an honest refusal
            </span>
          </h1>
          <p className="mt-1 max-w-3xl text-xs text-slate">
            Day 011 of 100. Every tool in this category returns one confident value per title and
            publishes no error rate. This one returns a three-state verdict with the evidence
            behind it, tells a genuine{" "}
            <span className="text-fork">taxonomy fork</span> apart from a{" "}
            <span className="text-gap">gap in its own lexicon</span>, and leads with the number
            nobody else computes: resolved and wrong.
          </p>
        </div>
        <a
          href="https://github.com/akshatiwarix/title-normalizer"
          className="marking hover:text-ink"
        >
          github ↗
        </a>
      </header>

      <Panel
        title="Input"
        subtitle="a bundled corpus, or your own titles — pasted titles are resolved in this tab, not on a server"
        right={
          <div className="flex flex-wrap items-center gap-1.5">
            {corpora.map((view) => (
              <Button
                key={view.id}
                tone={pastedResults === null && view.id === selected ? "accent" : "plain"}
                onClick={() => {
                  setSelected(view.id);
                  setPasted(null);
                  setCopied(null);
                }}
              >
                {view.label} · {view.count}
              </Button>
            ))}
            <Button onClick={downloadCsv}>csv</Button>
            <Button onClick={copyPermalink}>permalink</Button>
          </div>
        }
      >
        <div className="space-y-2 p-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            spellCheck={false}
            placeholder={"Head of Growth\nVP, Sales Ops\nFounder & CTO\nDirecteur Commercial"}
            className="w-full resize-y rounded border border-rule bg-paper p-2 font-mono text-xs text-ink outline-none focus:border-accent"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button tone="accent" onClick={normalizeDraft}>
              normalize {parseDraft().length || ""}
            </Button>
            {pastedResults !== null ? (
              <Button
                onClick={() => {
                  setPasted(null);
                  setCopied(null);
                }}
              >
                back to corpus
              </Button>
            ) : null}
            <span className="text-[0.6875rem] text-slate">
              up to {MAX_TITLES} titles, one per line. Over the cap you get a refusal, never a
              silently truncated tail.
            </span>
          </div>
          {copied ? <p className="text-[0.6875rem] text-accent">{copied}</p> : null}
          {linkError ? <p className="text-[0.6875rem] text-gap">{linkError}</p> : null}
        </div>
      </Panel>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Verdicts
          rows={showing}
          note={
            pastedResults !== null
              ? `${showing.length} pasted titles · click a row for its evidence`
              : corpus?.note
          }
        />
        <div className="flex min-h-0 flex-col gap-3">
          <Scorecard
            metrics={corpora.map((view) => view.metrics)}
            pasted={pastedCoverage}
          />
          <Abstentions groups={groups} action={(group) => <ProposeButton group={group} />} />
        </div>
      </div>
    </main>
  );
}
