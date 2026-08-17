/**
 * The taxonomy. This is the only place in the repository where a function, a
 * seniority rung, a scope, a band or a region token is written down. Everything
 * else — the lexicon, the corpora, the console, the metrics — refers to these
 * ids.
 *
 * Two properties matter downstream and are asserted by the sweep:
 *
 *   - The seniority ladder is *ordered*. Ambiguity about seniority is therefore
 *     always a contiguous interval on the ladder rather than an arbitrary set,
 *     which is both cheaper to represent and provable.
 *   - Every (function, band) cell is either a named persona or explicitly
 *     pruned. There is no third case, so persona can never be silently missing.
 */

/* ── functions ───────────────────────────────────────────────────────────── */

export const FUNCTION_IDS = [
  "Sales",
  "Marketing",
  "RevOps",
  "CustomerSuccess",
  "Support",
  "Engineering",
  "Product",
  "Design",
  "Data",
  "Finance",
  "HR",
  "Legal",
  "IT",
  "Security",
  "ExecGeneral",
] as const;

export type FunctionId = (typeof FUNCTION_IDS)[number];

/**
 * `label` is what the console prints; `short` is what a persona name is built
 * from. `ExecGeneral` is not a dumping ground — the lexicon may only reach it
 * through an explicit phrase entry (`CEO`, `Chief of Staff`, `Owner`), never
 * through token fallback, because a catch-all function hides exactly the
 * abstentions this repo exists to surface.
 */
export const FUNCTIONS: Record<FunctionId, { label: string; short: string }> = {
  Sales: { label: "Sales", short: "Sales" },
  Marketing: { label: "Marketing", short: "Marketing" },
  RevOps: { label: "Revenue Operations", short: "RevOps" },
  CustomerSuccess: { label: "Customer Success", short: "CS" },
  Support: { label: "Support", short: "Support" },
  Engineering: { label: "Engineering", short: "Engineering" },
  Product: { label: "Product", short: "Product" },
  Design: { label: "Design", short: "Design" },
  Data: { label: "Data", short: "Data" },
  Finance: { label: "Finance", short: "Finance" },
  HR: { label: "People / HR", short: "HR" },
  Legal: { label: "Legal", short: "Legal" },
  IT: { label: "IT", short: "IT" },
  Security: { label: "Security", short: "Security" },
  ExecGeneral: { label: "Executive (general)", short: "Exec" },
};

/* ── seniority ───────────────────────────────────────────────────────────── */

/** Ordered, lowest rung first. The order is the algebra; do not sort this. */
export const SENIORITY_IDS = [
  "Intern",
  "IC",
  "SeniorIC",
  "Manager",
  "Director",
  "VP",
  "CSuite",
  "FounderOwner",
] as const;

export type SeniorityId = (typeof SENIORITY_IDS)[number];

export const BAND_IDS = ["IC", "Manager", "Leader", "Exec"] as const;
export type BandId = (typeof BAND_IDS)[number];

export const SENIORITY: Record<SeniorityId, { label: string; rank: number; band: BandId }> = {
  Intern: { label: "Intern", rank: 0, band: "IC" },
  IC: { label: "Individual contributor", rank: 1, band: "IC" },
  SeniorIC: { label: "Senior IC", rank: 2, band: "IC" },
  Manager: { label: "Manager", rank: 3, band: "Manager" },
  Director: { label: "Director", rank: 4, band: "Leader" },
  VP: { label: "VP", rank: 5, band: "Leader" },
  CSuite: { label: "C-suite", rank: 6, band: "Exec" },
  FounderOwner: { label: "Founder / Owner", rank: 7, band: "Exec" },
};

export const BANDS: Record<BandId, { label: string }> = {
  IC: { label: "IC" },
  Manager: { label: "Manager" },
  Leader: { label: "Leader" },
  Exec: { label: "Exec" },
};

export function rankOf(id: SeniorityId): number {
  return SENIORITY[id].rank;
}

export function seniorityAtRank(rank: number): SeniorityId | undefined {
  return SENIORITY_IDS[rank];
}

export function bandOf(id: SeniorityId): BandId {
  return SENIORITY[id].band;
}

/* ── scope ───────────────────────────────────────────────────────────────── */

export const SCOPE_IDS = ["Global", "Regional", "None"] as const;
export type ScopeId = (typeof SCOPE_IDS)[number];

export const SCOPES: Record<ScopeId, { label: string }> = {
  Global: { label: "Global" },
  Regional: { label: "Regional" },
  None: { label: "Unscoped" },
};

/**
 * Region tokens live here rather than in the lexicon because they answer a
 * taxonomy question (which scope is this?) and not a role question. A region
 * token contributes `scope` and *nothing else* — `Director, EMEA` is Regional
 * with an unknown function, because EMEA says nothing about what the person does.
 */
export const REGION_TOKENS: Record<string, ScopeId> = {
  emea: "Regional",
  apac: "Regional",
  amer: "Regional",
  amers: "Regional",
  na: "Regional",
  namer: "Regional",
  latam: "Regional",
  dach: "Regional",
  benelux: "Regional",
  anz: "Regional",
  mena: "Regional",
  nordics: "Regional",
  iberia: "Regional",
  uki: "Regional",
  uk: "Regional",
  us: "Regional",
  usa: "Regional",
  japan: "Regional",
  india: "Regional",
  china: "Regional",
  germany: "Regional",
  france: "Regional",
  brazil: "Regional",
  canada: "Regional",
  australia: "Regional",
  global: "Global",
  worldwide: "Global",
  international: "Global",
  ww: "Global",
};

/* ── persona ─────────────────────────────────────────────────────────────── */

/**
 * Persona is *derived* from (function, band) and has no resolution path of its
 * own. That is the whole point: a CRM that computes persona separately ends up
 * holding `function = Marketing, seniority = VP, persona = Technical IC` at the
 * same time, and this shape makes that state unrepresentable.
 *
 * Pruned cells are impossible rather than merely unobserved: `ExecGeneral` is
 * reached only by phrases like `CEO` and `Owner`, so an IC or Manager band under
 * it would mean the resolver contradicted itself.
 */
const PRUNED: ReadonlySet<string> = new Set(["ExecGeneral|IC", "ExecGeneral|Manager"]);

const PERSONA_OVERRIDES: Record<string, string> = {
  "ExecGeneral|Leader": "Executive Staff",
  "ExecGeneral|Exec": "Executive",
};

export function personaCellKey(fn: FunctionId, band: BandId): string {
  return `${fn}|${band}`;
}

export function isPrunedPersona(fn: FunctionId, band: BandId): boolean {
  return PRUNED.has(personaCellKey(fn, band));
}

/** `undefined` means the cell is pruned, i.e. the combination cannot occur. */
export function personaLabel(fn: FunctionId, band: BandId): string | undefined {
  const key = personaCellKey(fn, band);
  if (PRUNED.has(key)) return undefined;
  return PERSONA_OVERRIDES[key] ?? `${FUNCTIONS[fn].short} ${BANDS[band].label}`;
}

/** Every reachable persona label, for the console's legend and for the sweep. */
export function allPersonas(): string[] {
  const out: string[] = [];
  for (const fn of FUNCTION_IDS) {
    for (const band of BAND_IDS) {
      const label = personaLabel(fn, band);
      if (label) out.push(label);
    }
  }
  return out;
}
