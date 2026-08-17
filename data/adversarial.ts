/**
 * The adversarial corpus: 120 titles chosen to break a normalizer, each with a
 * hand-written gold label and a named trap.
 *
 * Gold is a **set**, because for a lot of these the truth is a set — `Head of Sales`
 * is genuinely `{Director, VP}` and any tool returning one of them is wrong in a way
 * that matters. A dimension whose truth is "there is no answer here" is marked
 * `unknowable` with the reason it should abstain for, so abstaining for the *wrong*
 * reason still scores as a miss.
 *
 * Two conventions, both load-bearing:
 *
 *   - For a compound title, gold describes the **primary** role (highest rung, ties
 *     leftward). The shape of `roles[]` is asserted by the named trap tests instead,
 *     because a metric over a lifted dimension cannot express "two roles".
 *   - Where the engine and this file disagree, one of them is wrong and the number
 *     is published either way. Several entries here are known lexicon gaps kept
 *     deliberately: a corpus tuned until the engine passes it measures nothing.
 */

import { corpusSchema } from "@/lib/normalize/schema";
import type { Corpus, Gold, UnknownReason } from "@/lib/normalize/types";
import type { FunctionId, ScopeId, SeniorityId } from "@/lib/normalize/taxonomy";

type Spec = {
  fn: FunctionId[] | UnknownReason;
  rung: SeniorityId[] | UnknownReason;
  scope?: ScopeId[] | UnknownReason;
};

function dimension<T>(value: T[] | UnknownReason) {
  return typeof value === "string"
    ? ({ kind: "unknowable", reason: value } as const)
    : ({ kind: "labelled", values: value } as const);
}

function gold(spec: Spec): Gold {
  return {
    function: dimension<FunctionId>(spec.fn),
    seniority: dimension<SeniorityId>(spec.rung),
    scope: dimension<ScopeId>(spec.scope ?? ["None"]),
  };
}

const ROWS: [raw: string, trap: string, spec: Spec][] = [
  /* ── declared forks: the ambiguity is in the world ─────────────────────── */
  ["Head of Growth", "the genuine fork", { fn: ["Sales", "Marketing"], rung: ["Director", "VP"] }],
  ["Growth Lead", "the genuine fork", { fn: ["Sales", "Marketing"], rung: ["SeniorIC", "Manager"] }],
  ["VP Growth", "the genuine fork", { fn: ["Sales", "Marketing"], rung: ["VP"] }],
  ["Growth Hacker", "the fork with no rung", { fn: ["Sales", "Marketing"], rung: "no-evidence" }],
  ["Account Manager", "quota or retention", { fn: ["Sales", "CustomerSuccess"], rung: ["Manager"] }],
  [
    "Senior Account Manager",
    "quota or retention",
    { fn: ["Sales", "CustomerSuccess"], rung: ["Manager"] },
  ],
  [
    "Director of Account Management",
    "quota or retention",
    { fn: ["Sales", "CustomerSuccess"], rung: ["Director"] },
  ],
  ["Product Owner", "the methodology fork", { fn: ["Product", "Engineering"], rung: "no-evidence" }],
  [
    "Senior Product Owner",
    "the methodology fork",
    { fn: ["Product", "Engineering"], rung: ["SeniorIC"] },
  ],
  ["Program Manager", "the methodology fork", { fn: ["Product", "Engineering"], rung: ["Manager"] }],
  ["CDO", "the overloaded acronym", { fn: ["Data", "Marketing"], rung: ["CSuite"] }],
  [
    "Chief Data Officer",
    "spelling it out does not help",
    { fn: ["Data", "Marketing"], rung: ["CSuite"] },
  ],
  [
    "CCO",
    "the three-way acronym",
    { fn: ["CustomerSuccess", "Sales", "Legal"], rung: ["CSuite"] },
  ],
  ["Data Engineer", "platform or data team", { fn: ["Data", "Engineering"], rung: ["IC"] }],
  [
    "Senior Data Engineer",
    "platform or data team",
    { fn: ["Data", "Engineering"], rung: ["SeniorIC"] },
  ],
  [
    "Head of Infrastructure",
    "corporate or product infra",
    { fn: ["IT", "Engineering"], rung: ["Director", "VP"] },
  ],
  ["Privacy Manager", "legal or security", { fn: ["Legal", "Security"], rung: ["Manager"] }],
  [
    "Customer Experience Manager",
    "success or support",
    { fn: ["CustomerSuccess", "Support"], rung: ["Manager"] },
  ],
  [
    "Director, Customer Experience",
    "success or support",
    { fn: ["CustomerSuccess", "Support"], rung: ["Director"] },
  ],

  /* ── ladder intervals: the rung the string cannot carry ────────────────── */
  ["Head of Sales", "the ladder interval", { fn: ["Sales"], rung: ["Director", "VP"] }],
  ["Head of Marketing", "the ladder interval", { fn: ["Marketing"], rung: ["Director", "VP"] }],
  ["Head of Engineering", "the ladder interval", { fn: ["Engineering"], rung: ["Director", "VP"] }],
  [
    "Global Head of Data",
    "the ladder interval, scoped",
    { fn: ["Data"], rung: ["Director", "VP"], scope: ["Global"] },
  ],
  ["AVP, Marketing", "the AVP straddle", { fn: ["Marketing"], rung: ["Director", "VP"] }],
  [
    "Associate Vice President, Sales",
    "the AVP straddle",
    { fn: ["Sales"], rung: ["Director", "VP"] },
  ],
  [
    "Associate Director, Finance",
    "below Director",
    { fn: ["Finance"], rung: ["Manager", "Director"] },
  ],
  ["Group Product Manager", "manager of managers", { fn: ["Product"], rung: ["Manager", "Director"] }],
  [
    "Managing Director",
    "London or New York",
    { fn: ["ExecGeneral"], rung: ["Director", "VP", "CSuite"] },
  ],
  [
    "Managing Director, Sales",
    "the residual function",
    { fn: ["Sales"], rung: ["Director", "VP", "CSuite"] },
  ],
  [
    "Chief of Staff",
    "the functionless exec",
    { fn: ["ExecGeneral"], rung: ["Director", "VP", "CSuite"] },
  ],
  ["Team Lead, Support", "the Lead fork, resolved", { fn: ["Support"], rung: ["Manager"] }],
  ["Sales Lead", "the Lead fork", { fn: ["Sales"], rung: ["SeniorIC", "Manager"] }],
  ["Tech Lead", "the Lead fork", { fn: ["Engineering"], rung: ["SeniorIC", "Manager"] }],
  ["QA Lead", "the Lead fork", { fn: ["Engineering"], rung: ["SeniorIC", "Manager"] }],

  /* ── phrases that beat their own tokens ───────────────────────────────── */
  ["Sales Engineer", "the phrase that beats its tokens", { fn: ["Sales"], rung: ["IC"] }],
  ["Senior Sales Engineer", "the phrase that beats its tokens", { fn: ["Sales"], rung: ["SeniorIC"] }],
  ["Solutions Architect", "presales, not engineering", { fn: ["Sales"], rung: ["IC"] }],
  ["Solutions Consultant", "presales, not consulting", { fn: ["Sales"], rung: ["IC"] }],
  ["VP of Sales Operations", "the ops trap", { fn: ["RevOps"], rung: ["VP"] }],
  ["Marketing Operations Manager", "the ops trap", { fn: ["RevOps"], rung: ["Manager"] }],
  ["People Operations Manager", "the ops trap", { fn: ["HR"], rung: ["Manager"] }],
  ["Security Operations Manager", "the ops trap", { fn: ["Security"], rung: ["Manager"] }],
  ["Business Operations Director", "the ops trap", { fn: ["RevOps"], rung: ["Director"] }],
  ["Head of Sales Enablement", "the ops trap", { fn: ["RevOps"], rung: ["Director", "VP"] }],
  ["Product Marketing Director", "PMM is marketing", { fn: ["Marketing"], rung: ["Director"] }],
  ["Technical Support Engineer", "external customer", { fn: ["Support"], rung: ["IC"] }],
  ["Help Desk Manager", "internal customer", { fn: ["IT"], rung: ["Manager"] }],
  ["Creative Director", "design, not marketing", { fn: ["Design"], rung: ["Director"] }],
  ["Product Designer", "design, not product", { fn: ["Design"], rung: ["IC"] }],
  ["Data Science Manager", "data, not engineering", { fn: ["Data"], rung: ["Manager"] }],
  [
    "Senior Manager, Sales Operations",
    "two phrases, no conflict",
    { fn: ["RevOps"], rung: ["Manager"] },
  ],
  ["Head of Growth Marketing", "the fork, narrowed", { fn: ["Marketing"], rung: ["Director", "VP"] }],
  ["Vice President, Sales", "vice beats president", { fn: ["Sales"], rung: ["VP"] }],
  ["Senior Director, Marketing", "senior does not demote", { fn: ["Marketing"], rung: ["Director"] }],

  /* ── known lexicon gaps, kept deliberately ────────────────────────────── */
  [
    "Business Intelligence Developer",
    "the phrase that beats its tokens",
    { fn: ["Data"], rung: ["IC"] },
  ],
  ["Marketing Finance Manager", "the gap the tool admits to", { fn: ["Finance"], rung: ["Manager"] }],
  ["Product Support Manager", "the gap the tool admits to", { fn: ["Support"], rung: ["Manager"] }],

  /* ── executives, functionless and otherwise ───────────────────────────── */
  ["CEO", "the whole company", { fn: ["ExecGeneral"], rung: ["CSuite"] }],
  ["Chief Executive Officer", "the whole company", { fn: ["ExecGeneral"], rung: ["CSuite"] }],
  ["Chief Executive", "the British short form", { fn: ["ExecGeneral"], rung: ["CSuite"] }],
  ["President", "exact, not a token", { fn: ["ExecGeneral"], rung: ["CSuite"] }],
  ["Vice President", "a rung with no function", { fn: "no-evidence", rung: ["VP"] }],
  ["Owner", "exact, not a token", { fn: ["ExecGeneral"], rung: ["FounderOwner"] }],
  ["Founder", "a bare founder has no function", { fn: ["ExecGeneral"], rung: ["FounderOwner"] }],
  ["General Manager", "owns a P&L", { fn: ["ExecGeneral"], rung: ["Director", "VP"] }],
  ["GM, EMEA", "owns a P&L, scoped", { fn: ["ExecGeneral"], rung: ["Director", "VP"], scope: ["Regional"] }],
  ["Board Member", "governance, not management", { fn: ["ExecGeneral"], rung: ["FounderOwner"] }],
  ["Managing Partner", "the partnership form", { fn: ["ExecGeneral"], rung: ["FounderOwner"] }],
  ["Interim CFO", "the modifier that means nothing", { fn: ["Finance"], rung: ["CSuite"] }],
  ["Fractional CMO", "the modifier that means nothing", { fn: ["Marketing"], rung: ["CSuite"] }],
  ["Acting Head of HR", "the modifier that means nothing", { fn: ["HR"], rung: ["Director", "VP"] }],
  ["Chief Happiness Officer", "the invented C-title", { fn: "no-evidence", rung: ["CSuite"] }],

  /* ── the British 'executive' trap ─────────────────────────────────────── */
  ["Sales Executive", "executive means IC", { fn: ["Sales"], rung: ["IC"] }],
  ["Account Executive", "executive means IC", { fn: ["Sales"], rung: ["IC"] }],
  ["Marketing Executive", "executive means IC", { fn: ["Marketing"], rung: ["IC"] }],
  ["Senior Account Executive", "senior names the IC track", { fn: ["Sales"], rung: ["SeniorIC"] }],
  ["Senior Executive Assistant", "executive as an adjective", { fn: "no-evidence", rung: ["SeniorIC"] }],

  /* ── compound titles: gold is the primary role ────────────────────────── */
  ["Founder & CTO", "the compound", { fn: ["ExecGeneral"], rung: ["FounderOwner"] }],
  ["CTO & Co-Founder", "the compound, reordered", { fn: ["ExecGeneral"], rung: ["FounderOwner"] }],
  ["Co-Founder & CEO", "the compound", { fn: ["ExecGeneral"], rung: ["FounderOwner"] }],
  ["CEO / Founder", "the compound", { fn: ["ExecGeneral"], rung: ["FounderOwner"] }],
  ["CFO & COO", "the leftward tie", { fn: ["Finance"], rung: ["CSuite"] }],
  ["Sales & Marketing Manager", "the seniority-less side", { fn: ["Marketing"], rung: ["Manager"] }],
  ["VP Marketing and Demand Gen", "the compound", { fn: ["Marketing"], rung: ["VP"] }],
  ["Head of Sales / Head of Customer Success", "the leftward tie", { fn: ["Sales"], rung: ["Director", "VP"] }],
  ["Founder, CEO & President", "three ways of saying one thing", { fn: ["ExecGeneral"], rung: ["FounderOwner"] }],
  ["CTO / VP Engineering", "the compound", { fn: ["Engineering"], rung: ["CSuite"] }],
  ["Head of Product & Engineering", "the compound", { fn: ["Product"], rung: ["Director", "VP"] }],

  /* ── junk ─────────────────────────────────────────────────────────────── */
  ["| We're hiring 🚀", "the junk-only string", { fn: "garbage-only", rung: "garbage-only", scope: "garbage-only" }],
  ["🚀🚀🚀", "the junk-only string", { fn: "garbage-only", rung: "garbage-only", scope: "garbage-only" }],
  ["#opentowork", "the junk-only string", { fn: "garbage-only", rung: "garbage-only", scope: "garbage-only" }],
  ["www.acme.com", "the junk-only string", { fn: "garbage-only", rung: "garbage-only", scope: "garbage-only" }],
  ["Acme Corp", "the company, not the title", { fn: "no-evidence", rung: "no-evidence", scope: "no-evidence" }],
  ["Ms. Priya Rao, MBA", "the person, not the title", { fn: "no-evidence", rung: "no-evidence", scope: "no-evidence" }],
  ["EMEA", "the region, not the title", { fn: "garbage-only", rung: "garbage-only", scope: "garbage-only" }],
  ["VP Sales | We're hiring 🚀 | ex-Salesforce", "the title inside the noise", { fn: ["Sales"], rung: ["VP"] }],
  ["Head of Marketing @ Acme (We're hiring!)", "the title inside the noise", { fn: ["Marketing"], rung: ["Director", "VP"] }],
  ["🚀 VP of Sales 🚀", "the title inside the noise", { fn: ["Sales"], rung: ["VP"] }],
  ["Director of Sales, MBA, PMP", "credentials are not rungs", { fn: ["Sales"], rung: ["Director"] }],

  /* ── non-English: out of scope, and loudly so ─────────────────────────── */
  ["Directeur Commercial", "the foreign title", { fn: "non-english", rung: "non-english", scope: "non-english" }],
  ["Директор по продажам", "the foreign script", { fn: "non-english", rung: "non-english", scope: "non-english" }],
  ["営業部長", "the foreign script", { fn: "non-english", rung: "non-english", scope: "non-english" }],
  ["Geschäftsführer", "the foreign title", { fn: "non-english", rung: "non-english", scope: "non-english" }],
  ["Responsable de Ventas", "the foreign title", { fn: "non-english", rung: "non-english", scope: "non-english" }],
  ["Gerente de Vendas", "the foreign title", { fn: "non-english", rung: "non-english", scope: "non-english" }],
  ["Ingénieur Commercial", "the foreign title", { fn: "non-english", rung: "non-english", scope: "non-english" }],
  ["Verkoop Manager", "the foreign title", { fn: "non-english", rung: "non-english", scope: "non-english" }],
  ["Kierownik Sprzedaży", "the foreign title", { fn: "non-english", rung: "non-english", scope: "non-english" }],
  ["Commercial Director", "the English title that looks foreign", { fn: ["Sales"], rung: ["Director"] }],

  /* ── scope ────────────────────────────────────────────────────────────── */
  ["Director, EMEA", "the region suffix", { fn: "no-evidence", rung: ["Director"], scope: ["Regional"] }],
  ["VP Sales, APAC", "the region suffix", { fn: ["Sales"], rung: ["VP"], scope: ["Regional"] }],
  ["US Sales Manager", "the region prefix", { fn: ["Sales"], rung: ["Manager"], scope: ["Regional"] }],
  ["Global Head of Talent", "the global scope", { fn: ["HR"], rung: ["Director", "VP"], scope: ["Global"] }],
  ["Global VP, EMEA", "global and regional at once", { fn: "no-evidence", rung: ["VP"], scope: ["Global", "Regional"] }],
  ["Head of DACH", "the region as the whole job", { fn: "no-evidence", rung: ["Director", "VP"], scope: ["Regional"] }],

  /* ── titles that say nothing ──────────────────────────────────────────── */
  ["Analyst", "the title with no function", { fn: "no-evidence", rung: ["IC"] }],
  ["Consultant", "the title with no function", { fn: "no-evidence", rung: ["IC"] }],
  ["Intern", "the title with no function", { fn: "no-evidence", rung: ["Intern"] }],
  ["Evangelist", "the title with nothing at all", { fn: "no-evidence", rung: "no-evidence" }],
  ["Digital Transformation Lead", "the title with nothing but a rung", { fn: "no-evidence", rung: ["SeniorIC", "Manager"] }],
  ["SVP, GTM", "the acronym nobody standardised", { fn: "no-evidence", rung: ["VP"] }],
  ["Sr. Dir., Mktg", "the abbreviated everything", { fn: ["Marketing"], rung: ["Director"] }],
  ["V.P. of Bus. Dev.", "the abbreviated everything", { fn: ["Sales"], rung: ["VP"] }],
  ["AE - Mid Market", "the segment suffix", { fn: ["Sales"], rung: ["IC"] }],
  ["CSM II", "the level suffix", { fn: ["CustomerSuccess"], rung: ["Manager"] }],
  ["SDR Team Lead", "the promoted SDR", { fn: ["Sales"], rung: ["Manager"] }],
  ["RevOps", "the bare function", { fn: ["RevOps"], rung: "no-evidence" }],
  ["Head of RevOps", "the bare function, led", { fn: ["RevOps"], rung: ["Director", "VP"] }],
  ["IT Helpdesk", "the bare function", { fn: ["IT"], rung: "no-evidence" }],
];

export const ADVERSARIAL: Corpus = corpusSchema.parse({
  id: "adversarial",
  titles: ROWS.map(([raw, trap, spec]) => ({ raw, trap, gold: gold(spec) })),
});

export const TRAP_NAMES = [...new Set(ROWS.map(([, trap]) => trap))];
