/**
 * The canonical roles the generated corpus is built from.
 *
 * Gold labels are declared here, by hand, next to the string. They are **not**
 * produced by running the engine over the canonical form — that would make the
 * accuracy figure circular, since any systematic bug in the resolver would be
 * promoted to ground truth and then scored as correct.
 *
 * These are deliberately the *unambiguous* half of the domain: one function, one
 * rung, no geography. Titles whose truth is genuinely a set live in the
 * adversarial corpus, and the two are never averaged together.
 */

import type { FunctionId, ScopeId, SeniorityId } from "@/lib/normalize/taxonomy";

export type CanonicalRole = {
  title: string;
  function: FunctionId;
  seniority: SeniorityId;
  scope?: ScopeId;
  /** Set when the title reads `<Function> <Rung>`, which the parenthetical and prefix ops need. */
  functionWord?: string;
};

export const CANONICAL_ROLES: CanonicalRole[] = [
  // ── Sales ──────────────────────────────────────────────────────────────────
  { title: "Sales Intern", function: "Sales", seniority: "Intern", functionWord: "Sales" },
  { title: "Sales Development Representative", function: "Sales", seniority: "IC" },
  { title: "Business Development Representative", function: "Sales", seniority: "IC" },
  { title: "Account Executive", function: "Sales", seniority: "IC" },
  // `Senior` names the IC seniority track, so the rung moves even though the
  // phrase `Account Executive` carries IC on its own.
  { title: "Senior Account Executive", function: "Sales", seniority: "SeniorIC" },
  { title: "Sales Representative", function: "Sales", seniority: "IC", functionWord: "Sales" },
  // No `functionWord`: moving `Sales` into a parenthetical would leave `Engineer
  // (Sales)`, and that is a meaning-changing edit rather than noise.
  { title: "Sales Engineer", function: "Sales", seniority: "IC" },
  { title: "Solutions Engineer", function: "Sales", seniority: "IC" },
  { title: "Solutions Architect", function: "Sales", seniority: "IC" },
  { title: "Sales Manager", function: "Sales", seniority: "Manager", functionWord: "Sales" },
  { title: "Channel Manager", function: "Sales", seniority: "Manager" },
  { title: "Partnerships Manager", function: "Sales", seniority: "Manager" },
  { title: "Sales Director", function: "Sales", seniority: "Director", functionWord: "Sales" },
  { title: "Senior Director, Sales", function: "Sales", seniority: "Director" },
  { title: "VP of Sales", function: "Sales", seniority: "VP" },
  { title: "SVP Sales", function: "Sales", seniority: "VP" },
  { title: "Chief Revenue Officer", function: "Sales", seniority: "CSuite" },

  // ── Marketing ──────────────────────────────────────────────────────────────
  { title: "Marketing Intern", function: "Marketing", seniority: "Intern", functionWord: "Marketing" },
  {
    title: "Marketing Coordinator",
    function: "Marketing",
    seniority: "IC",
    functionWord: "Marketing",
  },
  {
    title: "Marketing Specialist",
    function: "Marketing",
    seniority: "IC",
    functionWord: "Marketing",
  },
  { title: "Content Specialist", function: "Marketing", seniority: "IC" },
  { title: "SEO Specialist", function: "Marketing", seniority: "IC" },
  { title: "Brand Manager", function: "Marketing", seniority: "Manager" },
  { title: "Product Marketing Manager", function: "Marketing", seniority: "Manager" },
  { title: "Field Marketing Manager", function: "Marketing", seniority: "Manager" },
  { title: "Demand Generation Manager", function: "Marketing", seniority: "Manager" },
  { title: "Growth Marketing Manager", function: "Marketing", seniority: "Manager" },
  { title: "Communications Manager", function: "Marketing", seniority: "Manager" },
  {
    title: "Marketing Director",
    function: "Marketing",
    seniority: "Director",
    functionWord: "Marketing",
  },
  { title: "Director of Demand Generation", function: "Marketing", seniority: "Director" },
  { title: "VP of Marketing", function: "Marketing", seniority: "VP" },
  { title: "Chief Marketing Officer", function: "Marketing", seniority: "CSuite" },

  // ── RevOps ─────────────────────────────────────────────────────────────────
  { title: "Revenue Operations Analyst", function: "RevOps", seniority: "IC" },
  { title: "Sales Operations Analyst", function: "RevOps", seniority: "IC" },
  { title: "Marketing Operations Specialist", function: "RevOps", seniority: "IC" },
  { title: "Deal Desk Analyst", function: "RevOps", seniority: "IC" },
  { title: "Sales Enablement Manager", function: "RevOps", seniority: "Manager" },
  { title: "Revenue Operations Manager", function: "RevOps", seniority: "Manager" },
  { title: "Marketing Operations Manager", function: "RevOps", seniority: "Manager" },
  { title: "Sales Operations Manager", function: "RevOps", seniority: "Manager" },
  { title: "Business Operations Manager", function: "RevOps", seniority: "Manager" },
  { title: "Director of Revenue Operations", function: "RevOps", seniority: "Director" },
  { title: "Senior Director, Sales Operations", function: "RevOps", seniority: "Director" },
  { title: "VP of Revenue Operations", function: "RevOps", seniority: "VP" },

  // ── Customer Success ───────────────────────────────────────────────────────
  { title: "Customer Success Associate", function: "CustomerSuccess", seniority: "IC" },
  { title: "Customer Success Manager", function: "CustomerSuccess", seniority: "Manager" },
  { title: "Senior Customer Success Manager", function: "CustomerSuccess", seniority: "Manager" },
  { title: "Onboarding Specialist", function: "CustomerSuccess", seniority: "IC" },
  { title: "Renewals Manager", function: "CustomerSuccess", seniority: "Manager" },
  { title: "Director of Customer Success", function: "CustomerSuccess", seniority: "Director" },
  { title: "VP of Customer Success", function: "CustomerSuccess", seniority: "VP" },
  { title: "Chief Customer Officer", function: "CustomerSuccess", seniority: "CSuite" },

  // ── Support ────────────────────────────────────────────────────────────────
  { title: "Customer Support Agent", function: "Support", seniority: "IC" },
  { title: "Technical Support Engineer", function: "Support", seniority: "IC" },
  { title: "Customer Support Manager", function: "Support", seniority: "Manager" },
  { title: "Director of Customer Support", function: "Support", seniority: "Director" },
  { title: "VP of Customer Support", function: "Support", seniority: "VP" },

  // ── Engineering ────────────────────────────────────────────────────────────
  { title: "Engineering Intern", function: "Engineering", seniority: "Intern" },
  { title: "Software Engineer", function: "Engineering", seniority: "IC" },
  { title: "Senior Software Engineer", function: "Engineering", seniority: "SeniorIC" },
  { title: "Staff Software Engineer", function: "Engineering", seniority: "SeniorIC" },
  { title: "Principal Engineer", function: "Engineering", seniority: "SeniorIC" },
  { title: "Site Reliability Engineer", function: "Engineering", seniority: "IC" },
  { title: "DevOps Engineer", function: "Engineering", seniority: "IC" },
  { title: "QA Engineer", function: "Engineering", seniority: "IC" },
  { title: "Engineering Manager", function: "Engineering", seniority: "Manager" },
  { title: "Senior Engineering Manager", function: "Engineering", seniority: "Manager" },
  { title: "Director of Engineering", function: "Engineering", seniority: "Director" },
  { title: "VP of Engineering", function: "Engineering", seniority: "VP" },
  { title: "Chief Technology Officer", function: "Engineering", seniority: "CSuite" },

  // ── Product ────────────────────────────────────────────────────────────────
  { title: "Associate Product Manager", function: "Product", seniority: "IC" },
  { title: "Product Manager", function: "Product", seniority: "Manager" },
  { title: "Senior Product Manager", function: "Product", seniority: "Manager" },
  { title: "Group Product Manager", function: "Product", seniority: "Manager" },
  { title: "Director of Product", function: "Product", seniority: "Director" },
  { title: "VP of Product", function: "Product", seniority: "VP" },
  { title: "Chief Product Officer", function: "Product", seniority: "CSuite" },

  // ── Design ─────────────────────────────────────────────────────────────────
  { title: "Design Intern", function: "Design", seniority: "Intern", functionWord: "Design" },
  { title: "Product Designer", function: "Design", seniority: "IC" },
  { title: "Senior Product Designer", function: "Design", seniority: "SeniorIC" },
  { title: "UX Designer", function: "Design", seniority: "IC" },
  { title: "UX Researcher", function: "Design", seniority: "IC" },
  { title: "Design Manager", function: "Design", seniority: "Manager", functionWord: "Design" },
  { title: "Creative Director", function: "Design", seniority: "Director" },
  { title: "Director of Design", function: "Design", seniority: "Director" },
  { title: "VP of Design", function: "Design", seniority: "VP" },

  // ── Data ───────────────────────────────────────────────────────────────────
  { title: "Data Analyst", function: "Data", seniority: "IC", functionWord: "Data" },
  { title: "Senior Data Analyst", function: "Data", seniority: "SeniorIC" },
  { title: "Business Intelligence Analyst", function: "Data", seniority: "IC" },
  { title: "Data Scientist", function: "Data", seniority: "IC", functionWord: "Data" },
  { title: "Senior Data Scientist", function: "Data", seniority: "SeniorIC" },
  { title: "Analytics Manager", function: "Data", seniority: "Manager" },
  { title: "Data Science Manager", function: "Data", seniority: "Manager" },
  { title: "Director of Analytics", function: "Data", seniority: "Director" },
  { title: "VP of Data", function: "Data", seniority: "VP" },

  // ── Finance ────────────────────────────────────────────────────────────────
  { title: "Finance Intern", function: "Finance", seniority: "Intern", functionWord: "Finance" },
  { title: "Staff Accountant", function: "Finance", seniority: "SeniorIC" },
  { title: "Financial Analyst", function: "Finance", seniority: "IC" },
  { title: "Senior Financial Analyst", function: "Finance", seniority: "SeniorIC" },
  { title: "Accounting Manager", function: "Finance", seniority: "Manager" },
  { title: "Finance Manager", function: "Finance", seniority: "Manager", functionWord: "Finance" },
  { title: "Procurement Manager", function: "Finance", seniority: "Manager" },
  { title: "Finance Director", function: "Finance", seniority: "Director", functionWord: "Finance" },
  { title: "VP of Finance", function: "Finance", seniority: "VP" },
  { title: "Chief Financial Officer", function: "Finance", seniority: "CSuite" },

  // ── HR ─────────────────────────────────────────────────────────────────────
  { title: "Recruiting Coordinator", function: "HR", seniority: "IC" },
  { title: "Technical Recruiter", function: "HR", seniority: "IC" },
  { title: "Talent Acquisition Specialist", function: "HR", seniority: "IC" },
  { title: "HR Manager", function: "HR", seniority: "Manager", functionWord: "HR" },
  { title: "People Operations Manager", function: "HR", seniority: "Manager" },
  { title: "Human Resources Manager", function: "HR", seniority: "Manager" },
  { title: "Director of Talent", function: "HR", seniority: "Director" },
  { title: "VP of People", function: "HR", seniority: "VP" },
  { title: "Chief Human Resources Officer", function: "HR", seniority: "CSuite" },

  // ── Legal ──────────────────────────────────────────────────────────────────
  { title: "Paralegal", function: "Legal", seniority: "IC" },
  { title: "Legal Counsel", function: "Legal", seniority: "IC", functionWord: "Legal" },
  { title: "Senior Legal Counsel", function: "Legal", seniority: "SeniorIC" },
  { title: "Compliance Manager", function: "Legal", seniority: "Manager" },
  { title: "Legal Director", function: "Legal", seniority: "Director", functionWord: "Legal" },
  { title: "General Counsel", function: "Legal", seniority: "CSuite" },

  // ── IT ─────────────────────────────────────────────────────────────────────
  { title: "Help Desk Technician", function: "IT", seniority: "IC" },
  { title: "Systems Administrator", function: "IT", seniority: "IC" },
  { title: "IT Manager", function: "IT", seniority: "Manager", functionWord: "IT" },
  { title: "IT Director", function: "IT", seniority: "Director", functionWord: "IT" },
  { title: "Director of Information Technology", function: "IT", seniority: "Director" },
  { title: "VP of IT", function: "IT", seniority: "VP" },
  { title: "Chief Information Officer", function: "IT", seniority: "CSuite" },

  // ── Security ───────────────────────────────────────────────────────────────
  { title: "Security Analyst", function: "Security", seniority: "IC", functionWord: "Security" },
  { title: "Senior Security Engineer", function: "Security", seniority: "SeniorIC" },
  {
    title: "Information Security Manager",
    function: "Security",
    seniority: "Manager",
  },
  { title: "Security Operations Manager", function: "Security", seniority: "Manager" },
  { title: "Director of Security", function: "Security", seniority: "Director" },
  { title: "VP of Security", function: "Security", seniority: "VP" },
  { title: "Chief Information Security Officer", function: "Security", seniority: "CSuite" },

  // ── Executive (general) ────────────────────────────────────────────────────
  { title: "CEO", function: "ExecGeneral", seniority: "CSuite" },
  { title: "Chief Executive Officer", function: "ExecGeneral", seniority: "CSuite" },
  { title: "COO", function: "ExecGeneral", seniority: "CSuite" },
  { title: "Chief Operating Officer", function: "ExecGeneral", seniority: "CSuite" },
  { title: "President", function: "ExecGeneral", seniority: "CSuite" },
  { title: "Founder", function: "ExecGeneral", seniority: "FounderOwner" },
  { title: "Co-Founder", function: "ExecGeneral", seniority: "FounderOwner" },
  { title: "Owner", function: "ExecGeneral", seniority: "FounderOwner" },
  { title: "Managing Partner", function: "ExecGeneral", seniority: "FounderOwner" },
  { title: "Board Member", function: "ExecGeneral", seniority: "FounderOwner" },
];
