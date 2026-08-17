/**
 * The lexicon, and the matcher that reads it.
 *
 * Two things make this file the centre of the repo.
 *
 * **Precedence.** `exact` beats `phrase` beats `token`. That ordering is what lets
 * `Sales Engineer` mean Sales while `Engineer` alone means Engineering, and it is
 * the mechanism that turns "titles are ambiguous" into a set of cases somebody can
 * actually write down.
 *
 * **The declared fork.** An entry whose `function` is an *array* says: this
 * ambiguity is in the world. `Head of Growth` is Marketing at one company and
 * Sales at the next, and no amount of lexicon work fixes that. An *undeclared*
 * conflict — two token entries disagreeing with no phrase covering them — says
 * the opposite: the ambiguity is in this file, and somebody has to write a phrase.
 * The engine reports those as `taxonomy-fork` and `lexicon-gap` respectively, and
 * telling them apart is the claim the whole project rests on.
 *
 * Every non-token entry carries a `note`. The schema enforces it, because the
 * lexicon is also the documentation of every hard case in the domain.
 */

import { lexiconSchema } from "./schema";
import { patternTokens } from "./tokenize";
import type { LexiconEntry, LexiconMatch } from "./types";

/* ── seniority: the rung named by the string ─────────────────────────────────
 *
 * A definitional decision, stated once here: `seniority` is the rung the *string*
 * names, not the span of control behind it. A Product Manager with no reports is
 * still at the Manager rung; a two-person startup's "VP Sales" is still VP. Span
 * of control needs headcount, headcount needs company context, and company context
 * is not in the input contract — it is Day 014's repo.
 */
const SENIORITY_ENTRIES: LexiconEntry[] = [
  { pattern: "intern", kind: "token", seniority: "Intern" },
  { pattern: "trainee", kind: "token", seniority: "Intern" },
  { pattern: "apprentice", kind: "token", seniority: "Intern" },
  { pattern: "graduate", kind: "token", seniority: "Intern" },

  { pattern: "associate", kind: "token", seniority: "IC" },
  { pattern: "assistant", kind: "token", seniority: "IC" },
  { pattern: "coordinator", kind: "token", seniority: "IC" },
  { pattern: "specialist", kind: "token", seniority: "IC" },
  { pattern: "generalist", kind: "token", seniority: "IC" },
  { pattern: "administrator", kind: "token", seniority: "IC" },
  { pattern: "representative", kind: "token", seniority: "IC" },
  { pattern: "rep", kind: "token", seniority: "IC" },
  { pattern: "agent", kind: "token", seniority: "IC" },
  { pattern: "consultant", kind: "token", seniority: "IC" },
  { pattern: "analyst", kind: "token", seniority: "IC" },
  { pattern: "technician", kind: "token", seniority: "IC" },
  { pattern: "clerk", kind: "token", seniority: "IC" },

  { pattern: "senior", kind: "token", seniority: "SeniorIC" },
  { pattern: "sr", kind: "token", seniority: "SeniorIC" },
  { pattern: "staff", kind: "token", seniority: "SeniorIC" },
  { pattern: "principal", kind: "token", seniority: "SeniorIC" },
  {
    pattern: "lead",
    kind: "token",
    seniority: ["SeniorIC", "Manager"],
    note: "a Lead is a senior IC in engineering and a people manager in sales — the string does not say which",
  },

  { pattern: "manager", kind: "token", seniority: "Manager" },
  { pattern: "mgr", kind: "token", seniority: "Manager" },
  { pattern: "supervisor", kind: "token", seniority: "Manager" },
  {
    pattern: "senior manager",
    kind: "phrase",
    seniority: "Manager",
    note: "still the Manager rung; 'senior' modifies pay band, not the ladder",
  },
  {
    pattern: "team lead",
    kind: "phrase",
    seniority: "Manager",
    note: "resolves the Lead fork downwards: a Team Lead manages people",
  },
  {
    pattern: "group manager",
    kind: "phrase",
    seniority: ["Manager", "Director"],
    note: "manager-of-managers in some orgs, a Manager in others",
  },

  { pattern: "director", kind: "token", seniority: "Director" },
  { pattern: "dir", kind: "token", seniority: "Director" },
  {
    pattern: "associate director",
    kind: "phrase",
    seniority: ["Manager", "Director"],
    note: "explicitly below Director; the phrase exists so 'director' does not decide it alone",
  },
  {
    pattern: "senior director",
    kind: "phrase",
    seniority: "Director",
    note: "still Director; the phrase stops 'senior' from pulling the rung down",
  },
  {
    pattern: "head",
    kind: "token",
    seniority: ["Director", "VP"],
    note: "the flagship interval: Head of X is a Director at 80 headcount and a VP at 2,000, and the string carries no headcount",
  },

  { pattern: "vp", kind: "token", seniority: "VP" },
  {
    pattern: "vice president",
    kind: "phrase",
    seniority: "VP",
    note: "must beat the `president` exact entry, which is C-suite",
  },
  {
    pattern: "svp",
    kind: "token",
    seniority: "VP",
    note: "SVP and EVP are the VP rung; the ladder has eight rungs, not eight titles",
  },
  { pattern: "evp", kind: "token", seniority: "VP" },
  {
    pattern: "senior vice president",
    kind: "phrase",
    seniority: "VP",
    note: "the expanded form of SVP, which the abbreviation noise op produces",
  },
  {
    pattern: "executive vice president",
    kind: "phrase",
    seniority: "VP",
    note: "the expanded form of EVP",
  },
  {
    pattern: "associate vice president",
    kind: "phrase",
    seniority: ["Director", "VP"],
    note: "AVP sits between Director and VP and no company agrees which",
  },
  {
    pattern: "avp",
    kind: "token",
    seniority: ["Director", "VP"],
    note: "the abbreviated form of the same straddle",
  },

  { pattern: "chief", kind: "token", seniority: "CSuite" },
  { pattern: "founder", kind: "token", seniority: "FounderOwner" },
  { pattern: "cofounder", kind: "token", seniority: "FounderOwner" },
];

/* ── functions ───────────────────────────────────────────────────────────── */

const SALES_ENTRIES: LexiconEntry[] = [
  { pattern: "sales", kind: "token", function: "Sales" },
  { pattern: "selling", kind: "token", function: "Sales" },
  { pattern: "quota", kind: "token", function: "Sales" },
  { pattern: "ae", kind: "token", function: "Sales", seniority: "IC" },
  { pattern: "sdr", kind: "token", function: "Sales", seniority: "IC" },
  { pattern: "bdr", kind: "token", function: "Sales", seniority: "IC" },
  {
    pattern: "account executive",
    kind: "phrase",
    function: "Sales",
    seniority: "IC",
    note: "an IC quota carrier; 'executive' here is British-inflected and means the opposite of C-suite",
  },
  {
    pattern: "sales executive",
    kind: "phrase",
    function: "Sales",
    seniority: "IC",
    note: "same trap as Account Executive: an IC, not an exec",
  },
  {
    pattern: "sales development representative",
    kind: "phrase",
    function: "Sales",
    seniority: "IC",
    note: "the expanded form of SDR",
  },
  {
    pattern: "business development representative",
    kind: "phrase",
    function: "Sales",
    seniority: "IC",
    note: "the expanded form of BDR",
  },
  {
    pattern: "business development",
    kind: "phrase",
    function: "Sales",
    note: "BD is a sales function everywhere except where it means corp dev, which this taxonomy does not carry",
  },
  {
    pattern: "sales engineer",
    kind: "phrase",
    function: "Sales",
    note: "presales: the phrase exists precisely so the `engineer` token cannot claim it for Engineering",
  },
  {
    pattern: "solutions engineer",
    kind: "phrase",
    function: "Sales",
    note: "the same presales role under a different name",
  },
  {
    pattern: "solutions architect",
    kind: "phrase",
    function: "Sales",
    note: "presales in a GTM org; the `architect` token would otherwise send it to Engineering",
  },
  {
    pattern: "solutions consultant",
    kind: "phrase",
    function: "Sales",
    note: "presales again — the third name for it",
  },
  {
    pattern: "account manager",
    kind: "phrase",
    function: ["Sales", "CustomerSuccess"],
    note: "a declared fork: an AM carries a quota in one org and owns retention in the next",
  },
  {
    pattern: "account management",
    kind: "phrase",
    function: ["Sales", "CustomerSuccess"],
    note: "the same fork in noun form",
  },
  {
    pattern: "channel",
    kind: "token",
    function: "Sales",
    note: "partnerships and channel sit under Sales in this taxonomy",
  },
  { pattern: "partnerships", kind: "token", function: "Sales" },
  {
    pattern: "cro",
    kind: "exact",
    function: "Sales",
    seniority: "CSuite",
    note: "Chief Revenue Officer; owns the revenue org, which this taxonomy files under Sales",
  },
  {
    pattern: "chief revenue officer",
    kind: "phrase",
    function: "Sales",
    seniority: "CSuite",
    note: "the expanded form of CRO, which the abbreviation noise op produces",
  },
  { pattern: "revenue", kind: "token", function: "Sales" },
];

const MARKETING_ENTRIES: LexiconEntry[] = [
  { pattern: "marketing", kind: "token", function: "Marketing" },
  { pattern: "brand", kind: "token", function: "Marketing" },
  { pattern: "seo", kind: "token", function: "Marketing" },
  { pattern: "sem", kind: "token", function: "Marketing" },
  { pattern: "communications", kind: "token", function: "Marketing" },
  { pattern: "comms", kind: "token", function: "Marketing" },
  { pattern: "pr", kind: "token", function: "Marketing" },
  {
    pattern: "growth",
    kind: "token",
    function: ["Sales", "Marketing"],
    note: "the flagship declared fork: Head of Growth is Marketing at one company, Sales at the next, and often both",
  },
  {
    pattern: "growth marketing",
    kind: "phrase",
    function: "Marketing",
    note: "resolves the Growth fork: the qualifier is the evidence the bare token lacks",
  },
  {
    pattern: "demand generation",
    kind: "phrase",
    function: "Marketing",
    note: "demand gen is Marketing even though it is measured on pipeline",
  },
  {
    pattern: "demand gen",
    kind: "phrase",
    function: "Marketing",
    note: "the abbreviated form of the same",
  },
  {
    pattern: "product marketing",
    kind: "phrase",
    function: "Marketing",
    note: "PMM is Marketing; the phrase stops `product` and `marketing` from conflicting",
  },
  {
    pattern: "field marketing",
    kind: "phrase",
    function: "Marketing",
    note: "regional marketing; `field` alone is meaningless in this taxonomy",
  },
  {
    pattern: "content",
    kind: "token",
    function: "Marketing",
    note: "content is Marketing here; content *design* is caught by the Design phrase",
  },
  {
    pattern: "cmo",
    kind: "exact",
    function: "Marketing",
    seniority: "CSuite",
    note: "Chief Marketing Officer",
  },
];

const REVOPS_ENTRIES: LexiconEntry[] = [
  { pattern: "revops", kind: "token", function: "RevOps" },
  {
    pattern: "revenue operations",
    kind: "phrase",
    function: "RevOps",
    note: "the canonical expansion",
  },
  {
    pattern: "sales operations",
    kind: "phrase",
    function: "RevOps",
    note: "the ops trap: `sales` would otherwise claim this for Sales, and Sales Ops is a RevOps job",
  },
  {
    pattern: "sales ops",
    kind: "phrase",
    function: "RevOps",
    note: "the abbreviated form of the same trap",
  },
  {
    pattern: "marketing operations",
    kind: "phrase",
    function: "RevOps",
    note: "MOps is RevOps, not Marketing — the mirror image of the Sales Ops trap",
  },
  {
    pattern: "marketing ops",
    kind: "phrase",
    function: "RevOps",
    note: "the abbreviated form",
  },
  {
    pattern: "business operations",
    kind: "phrase",
    function: "RevOps",
    note: "BizOps folds into RevOps because this taxonomy has no standalone Ops function, per the taxonomy decision",
  },
  {
    pattern: "deal desk",
    kind: "phrase",
    function: "RevOps",
    note: "deal desk is a RevOps team even when it reports to Finance",
  },
  {
    pattern: "enablement",
    kind: "token",
    function: "RevOps",
    note: "enablement folds into RevOps rather than Marketing or HR",
  },
  {
    pattern: "ops",
    kind: "token",
    function: "RevOps",
    note: "a bare Ops folds into RevOps, per the taxonomy decision; the noise is in the world, not in this entry",
  },
  { pattern: "operations", kind: "token", function: "RevOps" },
];

const CS_ENTRIES: LexiconEntry[] = [
  {
    pattern: "customer success",
    kind: "phrase",
    function: "CustomerSuccess",
    note: "the canonical form",
  },
  {
    pattern: "client success",
    kind: "phrase",
    function: "CustomerSuccess",
    note: "the agency-flavoured synonym",
  },
  { pattern: "csm", kind: "token", function: "CustomerSuccess" },
  { pattern: "renewals", kind: "token", function: "CustomerSuccess" },
  { pattern: "onboarding", kind: "token", function: "CustomerSuccess" },
  {
    pattern: "customer experience",
    kind: "phrase",
    function: ["CustomerSuccess", "Support"],
    note: "a declared fork: CX is a success org in B2B and a support org in B2C",
  },
  {
    pattern: "cco",
    kind: "exact",
    function: ["CustomerSuccess", "Sales", "Legal"],
    seniority: "CSuite",
    note: "a three-way declared fork: Chief Customer, Chief Commercial, or Chief Compliance Officer",
  },
];

const SUPPORT_ENTRIES: LexiconEntry[] = [
  { pattern: "support", kind: "token", function: "Support" },
  {
    pattern: "customer support",
    kind: "phrase",
    function: "Support",
    note: "pins the fork that `support` alone leaves open",
  },
  {
    pattern: "technical support",
    kind: "phrase",
    function: "Support",
    note: "Support, not IT: the customer is external",
  },
];

const ENGINEERING_ENTRIES: LexiconEntry[] = [
  { pattern: "engineering", kind: "token", function: "Engineering" },
  { pattern: "engineer", kind: "token", function: "Engineering" },
  { pattern: "developer", kind: "token", function: "Engineering" },
  { pattern: "dev", kind: "token", function: "Engineering" },
  { pattern: "programmer", kind: "token", function: "Engineering" },
  { pattern: "sre", kind: "token", function: "Engineering" },
  { pattern: "devops", kind: "token", function: "Engineering" },
  { pattern: "qa", kind: "token", function: "Engineering" },
  { pattern: "architect", kind: "token", function: "Engineering" },
  {
    pattern: "software engineer",
    kind: "phrase",
    function: "Engineering",
    note: "the unambiguous case, kept as a phrase so the generator has a canonical form",
  },
  {
    pattern: "cto",
    kind: "exact",
    function: "Engineering",
    seniority: "CSuite",
    note: "Chief Technology Officer",
  },
  {
    pattern: "vpe",
    kind: "exact",
    function: "Engineering",
    seniority: "VP",
    note: "VP Engineering, abbreviated the way engineering orgs write it",
  },
];

const PRODUCT_ENTRIES: LexiconEntry[] = [
  { pattern: "product", kind: "token", function: "Product" },
  {
    pattern: "product manager",
    kind: "phrase",
    function: "Product",
    seniority: "Manager",
    note: "the rung is the one the string names; span of control needs headcount, which is not in the input",
  },
  {
    pattern: "product owner",
    kind: "phrase",
    function: ["Product", "Engineering"],
    note: "a declared fork on methodology: a Product function in a Scrum org, a delivery role inside Engineering in a Gantt org",
  },
  {
    pattern: "cpo",
    kind: "exact",
    function: "Product",
    seniority: "CSuite",
    note: "Chief Product Officer",
  },
  {
    pattern: "program manager",
    kind: "phrase",
    function: ["Product", "Engineering"],
    note: "the same methodology fork under the older name",
  },
];

const DESIGN_ENTRIES: LexiconEntry[] = [
  { pattern: "design", kind: "token", function: "Design" },
  { pattern: "designer", kind: "token", function: "Design" },
  { pattern: "ux", kind: "token", function: "Design" },
  { pattern: "ui", kind: "token", function: "Design" },
  {
    pattern: "user experience",
    kind: "phrase",
    function: "Design",
    note: "the expanded form of UX",
  },
  {
    pattern: "creative director",
    kind: "phrase",
    function: "Design",
    seniority: "Director",
    note: "Design, not Marketing, even in an agency where it reports to Marketing",
  },
];

const DATA_ENTRIES: LexiconEntry[] = [
  { pattern: "data", kind: "token", function: "Data" },
  { pattern: "analytics", kind: "token", function: "Data" },
  { pattern: "bi", kind: "token", function: "Data" },
  {
    pattern: "data science",
    kind: "phrase",
    function: "Data",
    note: "kept as a phrase so `science` never stands alone",
  },
  { pattern: "scientist", kind: "token", function: "Data" },
  {
    pattern: "business intelligence",
    kind: "phrase",
    function: "Data",
    note: "the expanded form of BI",
  },
  {
    pattern: "data engineer",
    kind: "phrase",
    function: ["Data", "Engineering"],
    note: "a declared fork: a platform role inside Engineering in some orgs, part of the data team in others",
  },
  {
    pattern: "cdo",
    kind: "exact",
    function: ["Data", "Marketing"],
    seniority: "CSuite",
    note: "a declared fork: Chief Data Officer or Chief Digital Officer, and the acronym does not say",
  },
];

const FINANCE_ENTRIES: LexiconEntry[] = [
  { pattern: "finance", kind: "token", function: "Finance" },
  { pattern: "financial", kind: "token", function: "Finance" },
  { pattern: "accounting", kind: "token", function: "Finance" },
  { pattern: "accountant", kind: "token", function: "Finance" },
  { pattern: "controller", kind: "token", function: "Finance" },
  { pattern: "treasury", kind: "token", function: "Finance" },
  { pattern: "fpa", kind: "token", function: "Finance" },
  { pattern: "procurement", kind: "token", function: "Finance" },
  {
    pattern: "cfo",
    kind: "exact",
    function: "Finance",
    seniority: "CSuite",
    note: "Chief Financial Officer",
  },
];

const HR_ENTRIES: LexiconEntry[] = [
  { pattern: "hr", kind: "token", function: "HR" },
  { pattern: "people", kind: "token", function: "HR" },
  { pattern: "talent", kind: "token", function: "HR" },
  { pattern: "recruiting", kind: "token", function: "HR" },
  { pattern: "recruiter", kind: "token", function: "HR" },
  {
    pattern: "human resources",
    kind: "phrase",
    function: "HR",
    note: "the expanded form of HR",
  },
  {
    pattern: "talent acquisition",
    kind: "phrase",
    function: "HR",
    note: "recruiting under its formal name",
  },
  {
    pattern: "people operations",
    kind: "phrase",
    function: "HR",
    note: "People Ops is HR, not RevOps — the `operations` token would otherwise claim it",
  },
  {
    pattern: "chro",
    kind: "exact",
    function: "HR",
    seniority: "CSuite",
    note: "Chief Human Resources Officer",
  },
];

const LEGAL_ENTRIES: LexiconEntry[] = [
  { pattern: "legal", kind: "token", function: "Legal" },
  { pattern: "counsel", kind: "token", function: "Legal" },
  { pattern: "paralegal", kind: "token", function: "Legal" },
  { pattern: "compliance", kind: "token", function: "Legal" },
  {
    pattern: "general counsel",
    kind: "phrase",
    function: "Legal",
    seniority: "CSuite",
    note: "the GC sits at the exec table; `counsel` alone says nothing about rung",
  },
  {
    pattern: "privacy",
    kind: "token",
    function: ["Legal", "Security"],
    note: "a declared fork: privacy is a legal function in the EU and a security function in most US orgs",
  },
];

const IT_ENTRIES: LexiconEntry[] = [
  { pattern: "it", kind: "token", function: "IT" },
  { pattern: "helpdesk", kind: "token", function: "IT" },
  { pattern: "sysadmin", kind: "token", function: "IT" },
  {
    pattern: "information technology",
    kind: "phrase",
    function: "IT",
    note: "the expanded form of IT",
  },
  {
    pattern: "help desk",
    kind: "phrase",
    function: "IT",
    note: "internal, therefore IT rather than Support",
  },
  {
    pattern: "systems administrator",
    kind: "phrase",
    function: "IT",
    note: "the `administrator` token carries the IC rung, this phrase carries the function",
  },
  {
    pattern: "infrastructure",
    kind: "token",
    function: ["IT", "Engineering"],
    note: "a declared fork: infra is IT in a corporate org and Engineering in a product org",
  },
  {
    pattern: "cio",
    kind: "exact",
    function: "IT",
    seniority: "CSuite",
    note: "Chief Information Officer",
  },
];

const SECURITY_ENTRIES: LexiconEntry[] = [
  { pattern: "security", kind: "token", function: "Security" },
  { pattern: "infosec", kind: "token", function: "Security" },
  {
    pattern: "information security",
    kind: "phrase",
    function: "Security",
    note: "the expanded form of infosec; `information` alone would drift to IT",
  },
  {
    pattern: "security operations",
    kind: "phrase",
    function: "Security",
    note: "SecOps is Security, not RevOps — the `operations` token would otherwise claim it",
  },
  {
    pattern: "ciso",
    kind: "exact",
    function: "Security",
    seniority: "CSuite",
    note: "Chief Information Security Officer",
  },
];

/**
 * The expanded C-suite forms. These exist because the abbreviation noise op turns
 * `CFO` into `Chief Financial Officer`, and without them the `chief` token would
 * carry the rung while the function fell through to `no-evidence` — a defensible
 * abstention, but a wrong one, since the expansion is strictly more informative
 * than the acronym.
 */
const EXPANDED_CSUITE_ENTRIES: LexiconEntry[] = [
  {
    pattern: "chief marketing officer",
    kind: "phrase",
    function: "Marketing",
    seniority: "CSuite",
    note: "the expanded form of CMO",
  },
  {
    pattern: "chief technology officer",
    kind: "phrase",
    function: "Engineering",
    seniority: "CSuite",
    note: "the expanded form of CTO",
  },
  {
    pattern: "chief product officer",
    kind: "phrase",
    function: "Product",
    seniority: "CSuite",
    note: "the expanded form of CPO",
  },
  {
    pattern: "chief financial officer",
    kind: "phrase",
    function: "Finance",
    seniority: "CSuite",
    note: "the expanded form of CFO",
  },
  {
    pattern: "chief information officer",
    kind: "phrase",
    function: "IT",
    seniority: "CSuite",
    note: "the expanded form of CIO",
  },
  {
    pattern: "chief information security officer",
    kind: "phrase",
    function: "Security",
    seniority: "CSuite",
    note: "the expanded form of CISO; longer than the CIO phrase, so it wins by length",
  },
  {
    pattern: "chief human resources officer",
    kind: "phrase",
    function: "HR",
    seniority: "CSuite",
    note: "the expanded form of CHRO",
  },
  {
    pattern: "chief customer officer",
    kind: "phrase",
    function: "CustomerSuccess",
    seniority: "CSuite",
    note: "one of the three readings of CCO, disambiguated by being spelled out",
  },
  {
    pattern: "chief data officer",
    kind: "phrase",
    function: ["Data", "Marketing"],
    seniority: "CSuite",
    note: "spelling out CDO does not help: Chief Data and Chief Digital are both written this way",
  },
  {
    pattern: "chief operating officer",
    kind: "phrase",
    function: "ExecGeneral",
    seniority: "CSuite",
    note: "the expanded form of COO — company-general, not RevOps",
  },
];

/**
 * `ExecGeneral` is reachable only through `exact` and `phrase` entries, never
 * through token fallback. A function that a stray token can fall into is a
 * function that quietly absorbs the abstentions this repo exists to surface, and
 * a sweep invariant asserts the rule holds.
 */
const EXEC_ENTRIES: LexiconEntry[] = [
  {
    pattern: "ceo",
    kind: "exact",
    function: "ExecGeneral",
    seniority: "CSuite",
    note: "the whole company is the function; nothing narrower is true",
  },
  {
    pattern: "chief executive officer",
    kind: "phrase",
    function: "ExecGeneral",
    seniority: "CSuite",
    note: "the expanded form of CEO",
  },
  {
    pattern: "coo",
    kind: "exact",
    function: "ExecGeneral",
    seniority: "CSuite",
    note: "Chief Operating Officer — company-wide, not RevOps, despite the O",
  },
  {
    pattern: "president",
    kind: "exact",
    function: "ExecGeneral",
    seniority: "CSuite",
    note: "exact rather than token so `Vice President` cannot reach it",
  },
  {
    pattern: "owner",
    kind: "exact",
    function: "ExecGeneral",
    seniority: "FounderOwner",
    note: "the SMB form of founder; exact so `Product Owner` cannot reach it",
  },
  {
    pattern: "founder",
    kind: "exact",
    function: "ExecGeneral",
    seniority: "FounderOwner",
    note: "a bare Founder has no function; in `Founder & CTO` the second segment supplies one",
  },
  {
    pattern: "co founder",
    kind: "phrase",
    function: "ExecGeneral",
    seniority: "FounderOwner",
    note: "same as Founder, hyphen split by the tokenizer",
  },
  {
    pattern: "founder ceo",
    kind: "phrase",
    function: "ExecGeneral",
    seniority: "FounderOwner",
    note: "written without a conjunction often enough to need its own entry",
  },
  {
    pattern: "chief of staff",
    kind: "phrase",
    function: "ExecGeneral",
    seniority: ["Director", "CSuite"],
    note: "the functionless exec: the function is genuinely the principal's, and the rung spans Director to C-suite depending on whose office it is",
  },
  {
    pattern: "general manager",
    kind: "phrase",
    function: "ExecGeneral",
    seniority: ["Director", "VP"],
    note: "a GM owns a P&L, which is company-general rather than any single function",
  },
  {
    pattern: "managing director",
    kind: "phrase",
    function: "ExecGeneral",
    seniority: ["Director", "CSuite"],
    note: "an MD runs the company in the UK and Germany and is a senior banker in New York; the rung genuinely spans three",
  },
  {
    pattern: "managing partner",
    kind: "phrase",
    function: "ExecGeneral",
    seniority: "FounderOwner",
    note: "the partnership form of owner",
  },
  {
    pattern: "board member",
    kind: "phrase",
    function: "ExecGeneral",
    seniority: "FounderOwner",
    note: "governance rather than management, but it sits at the top of the ladder",
  },
];

/* ── the lexicon ─────────────────────────────────────────────────────────── */

export const LEXICON: LexiconEntry[] = lexiconSchema.parse([
  ...SENIORITY_ENTRIES,
  ...SALES_ENTRIES,
  ...MARKETING_ENTRIES,
  ...REVOPS_ENTRIES,
  ...CS_ENTRIES,
  ...SUPPORT_ENTRIES,
  ...ENGINEERING_ENTRIES,
  ...PRODUCT_ENTRIES,
  ...DESIGN_ENTRIES,
  ...DATA_ENTRIES,
  ...FINANCE_ENTRIES,
  ...HR_ENTRIES,
  ...LEGAL_ENTRIES,
  ...IT_ENTRIES,
  ...SECURITY_ENTRIES,
  ...EXPANDED_CSUITE_ENTRIES,
  ...EXEC_ENTRIES,
]);

/* ── the matcher ─────────────────────────────────────────────────────────── */

type Compiled = { entry: LexiconEntry; tokens: string[] };

function compile(entries: LexiconEntry[], kind: LexiconEntry["kind"]): Compiled[] {
  return entries
    .filter((entry) => entry.kind === kind)
    .map((entry) => ({ entry, tokens: patternTokens(entry.pattern) }))
    .sort((a, b) => b.tokens.length - a.tokens.length);
}

export type CompiledLexicon = {
  entries: LexiconEntry[];
  exact: Compiled[];
  phrases: Compiled[];
  tokens: Map<string, LexiconEntry>;
};

export function compileLexicon(entries: LexiconEntry[] = LEXICON): CompiledLexicon {
  const tokens = new Map<string, LexiconEntry>();
  for (const compiled of compile(entries, "token")) {
    const key = compiled.tokens[0];
    if (key !== undefined) tokens.set(key, compiled.entry);
  }
  return { entries, exact: compile(entries, "exact"), phrases: compile(entries, "phrase"), tokens };
}

export const COMPILED = compileLexicon();

function runMatches(tokens: string[], at: number, pattern: string[]): boolean {
  return pattern.every((word, offset) => tokens[at + offset] === word);
}

/**
 * Match one segment. Exact first (whole segment only), then the longest phrase at
 * each position, then token fallback over whatever is left. Returns the matches
 * in segment order plus the tokens nothing claimed — those unclaimed tokens are
 * the evidence behind a `no-evidence` verdict.
 */
export function matchSegment(
  tokens: string[],
  lexicon: CompiledLexicon = COMPILED,
): { matches: LexiconMatch[]; unclaimed: string[] } {
  if (tokens.length === 0) return { matches: [], unclaimed: [] };

  for (const candidate of lexicon.exact) {
    if (
      candidate.tokens.length === tokens.length &&
      runMatches(tokens, 0, candidate.tokens)
    ) {
      return {
        matches: [
          { entry: candidate.entry, text: tokens.join(" "), from: 0, to: tokens.length },
        ],
        unclaimed: [],
      };
    }
  }

  const claimed = new Array<boolean>(tokens.length).fill(false);
  const matches: LexiconMatch[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    if (claimed[index]) continue;
    for (const candidate of lexicon.phrases) {
      const end = index + candidate.tokens.length;
      if (end > tokens.length) continue;
      if (claimed.slice(index, end).some(Boolean)) continue;
      if (!runMatches(tokens, index, candidate.tokens)) continue;
      for (let i = index; i < end; i += 1) claimed[i] = true;
      matches.push({
        entry: candidate.entry,
        text: tokens.slice(index, end).join(" "),
        from: index,
        to: end,
      });
      break;
    }
  }

  const unclaimed: string[] = [];
  tokens.forEach((token, index) => {
    if (claimed[index]) return;
    const entry = lexicon.tokens.get(token);
    if (entry) {
      matches.push({ entry, text: token, from: index, to: index + 1 });
      claimed[index] = true;
      return;
    }
    unclaimed.push(token);
  });

  matches.sort((a, b) => a.from - b.from);
  return { matches, unclaimed };
}

/**
 * Does this fragment of a raw title contain anything the lexicon can act on?
 * `tokenize` takes this as a predicate so it can drop `Acme` out of
 * `VP Sales | Acme` without importing the lexicon itself.
 */
export function hasEvidence(fragment: string, lexicon: CompiledLexicon = COMPILED): boolean {
  const tokens = patternTokens(fragment);
  if (tokens.length === 0) return false;
  return matchSegment(tokens, lexicon).matches.length > 0;
}
