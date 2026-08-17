/**
 * Shared primitives.
 *
 * The one that carries meaning is `VerdictChip`. A declared fork and a lexicon gap
 * are both "ambiguous", and every other tool in this category puts them in the same
 * bucket — so here they get different colours *and* different border styles, and the
 * gap gets hatching on top, because one of them is finished work and the other is a
 * TODO.
 */

import type { ReactNode } from "react";
import type { Verdict } from "@/lib/normalize";

export function Panel({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex min-h-0 flex-col rounded-lg border border-rule bg-card shadow-[0_1px_2px_rgba(23,24,28,0.04)] ${className}`}
    >
      <header className="flex items-baseline justify-between gap-3 border-b border-rule px-4 py-3">
        <div className="min-w-0">
          <h2 className="marking !text-ink">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs text-slate">{subtitle}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  );
}

export function verdictText(verdict: Verdict<string>): string {
  if (verdict.state === "resolved") return verdict.value;
  if (verdict.state === "ambiguous") return verdict.candidates.join(" | ");
  return verdict.reason;
}

/** The style axis: colour and border both say which kind of answer this is. */
export function verdictStyle(verdict: Verdict<string>): string {
  if (verdict.state === "resolved") {
    return "border-solid border-resolved/30 bg-resolved-soft text-resolved";
  }
  if (verdict.state === "ambiguous") {
    return verdict.reason === "taxonomy-fork"
      ? "border-solid border-fork/40 bg-fork-soft text-fork"
      : "border-dashed border-gap/50 hatch-gap text-gap";
  }
  return "border-dotted border-unknown/50 bg-unknown-soft text-unknown";
}

export function VerdictChip({
  verdict,
  title,
}: {
  verdict: Verdict<string>;
  title?: string;
}) {
  return (
    <span
      title={title ?? verdict.because.join(" · ")}
      className={`inline-block max-w-full truncate rounded border px-1.5 py-0.5 font-mono text-[0.6875rem] ${verdictStyle(verdict)}`}
    >
      {verdictText(verdict)}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  alarm = false,
}: {
  label: string;
  value: string;
  hint?: string;
  alarm?: boolean;
}) {
  return (
    <div
      className={`rounded border px-3 py-2 ${
        alarm ? "border-silent/40 bg-silent-soft" : "border-rule bg-paper"
      }`}
    >
      <div className="marking">{label}</div>
      <div
        className={`tabular mt-1 font-mono text-lg ${alarm ? "text-silent" : "text-ink"}`}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[0.6875rem] text-slate">{hint}</div> : null}
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled = false,
  tone = "plain",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "plain" | "accent";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`marking rounded border px-2 py-1 transition-colors disabled:opacity-40 ${
        tone === "accent"
          ? "border-accent/40 bg-accent-soft !text-accent hover:brightness-95"
          : "border-rule-strong bg-card hover:bg-paper"
      }`}
    >
      {children}
    </button>
  );
}

export function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
