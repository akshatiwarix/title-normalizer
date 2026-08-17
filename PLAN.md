# Day 011 — Title Normalizer — Implementation Plan

Day 011 of a 100-day building challenge. The concept is fixed by the master backlog
(`~/Desktop/100-days-portfolio-execution-plan.md`): *a system that maps messy real-world job titles
into standardized functions, seniority and personas.* Every choice below came out of a
decision-by-decision interview across four rounds and is deliberate rather than a default. The 28
settled decisions are recorded at the bottom; treat them as decided, not as open questions to
relitigate.

**Time limit:** one day. Feature-frozen at plan sign-off.

---

## Problem

Every GTM stack normalizes job titles, and every one of them does it with a fuzzy-match lookup
table nobody has measured. Clay, Apollo, ZoomInfo, Clearbit, the enrichment vendor your company
pays, the `CASE WHEN title ILIKE '%vp%'` block in your warehouse — all of them accept a string and
return a function and a seniority, with total confidence and no error bar. Ask any of them how often
that answer is wrong and there is no number, because none is computed.

The received explanation for why this is hard is that titles are *messy*: casing, punctuation,
abbreviations, `| We're hiring 🚀` glued onto the end. That part is real and it is also the easy
part — noise is a string problem and string problems have solutions.

The actual difficulty is that **the taxonomy is underdetermined.** There is no fact of the matter
about which function `Head of Growth` belongs to; it is Marketing at one company and Sales at the
next, and at a third it is a team of two doing both. `Head of Sales` is a Director at 80 headcount
and a VP at 2,000 — same string, different rung, and the string does not carry headcount. `Product
Owner` is a Product title in a company that runs Scrum and a Project Management title in a company
that says Scrum and means Gantt. `Chief of Staff` has no function at all.

Every tool in the category resolves these by silently picking one branch. The pick is invisible,
undocumented, and consistent enough to look correct. Then it propagates: it routes the lead, it
scores the account, it selects the sequence, it lands in the board deck as *pipeline by persona*.
Nobody audits it because nothing surfaced a decision to audit.

Four things go wrong, and this repo exists because of them.

**Silent errors are indistinguishable from correct answers.** A normalizer that returns
`Engineering` for `Sales Engineer` looks exactly like one that returns `Sales`. Both are a
confident single value in a column. The error rate of the tool you are using right now is not
merely unknown to you — it is unknown to the vendor.

**Confidence scores launder guesses.** The industry's answer to ambiguity is a float. `0.62` tells
you nothing you can act on: it does not say *which* other function was in contention, or *why*, or
whether the contention was a real taxonomy fork or just a missing entry in a lookup table. It is a
number that exists so the field is not empty.

**Compound titles get flattened.** `Founder & CTO` is not an ambiguous title. It is two facts about
one person, and the correct output has two roles in it. Every tool returns one, and which one you
get depends on token order inside somebody's regex.

**Derived fields contradict their inputs.** Persona, buyer group, segment — these are computed from
function and seniority, in a different system, weeks later, by different logic. So the CRM ends up
holding `function = Marketing`, `seniority = VP`, `persona = Technical IC` simultaneously, and all
three are pulled into different dashboards.

So the interesting problems are:

- Can a title normalizer **refuse to answer** — precisely, with the candidate set and the reason —
  and is the resulting coverage still high enough to be useful?
- Can the difference between *genuine taxonomy ambiguity* and *a gap in my lexicon* be computed
  rather than guessed?
- What is the **silent-error rate** — resolved and wrong — of a deterministic normalizer on titles
  chosen to break it, and can it be driven to approximately zero without collapsing coverage?
- Can a lexicon be grown safely, i.e. can adding an entry be **proven** never to flip an answer
  that was already resolved?

### What this repo is not

Sibling days own the neighbouring problems and this one does not build any of them.

- **Day 004 `persona-mapper`** maps company + offer → buying committee, and *emits* titles. Day 011
  is the inverse map: title string → structure. Buyer-role naming (`Economic Buyer`,
  `Technical Evaluator`) is a property of the *deal*, not of the string, and stays in Day 004.
- **Day 003 `lead-cleaner`** owns record-level hygiene and dedupe. Day 011 normalizes one field.
- **Day 009 `lead-router`** consumes normalized titles to route. It does not normalize.
- **Day 010 `crm-doctor`** finds defects across a CRM's fields. Day 011 is one field, in depth.
- **Day 014 `company-classifier`** classifies companies. Nothing here looks at a company.

Not in scope, stated so it cannot drift in: non-English titles (see below), inferring headcount or
company context from anything, an LLM in the resolution path, a machine-learning classifier,
embeddings, a database, or persisting anything a user pastes.

**Non-English is an explicit non-goal.** `Directeur Commercial` gets script/language detection and
an `unknown` verdict with reason `non-english`. Abstaining loudly on it is a correct answer.
Guessing `Engineering` from `Directeur` is not, and a small four-language lexicon would produce
exactly that class of confident mistake at the edges.

---

## Intended user

A GTM engineer or RevOps lead who already owns a title-normalization step and does not trust it.
They arrive skeptical, and the demo has to survive that: they paste fifty titles from their own CRM
into a textarea and read, within ten seconds, how many the engine resolved, how many it refused,
and why it refused each one. The scorecard on *their* data is the pitch; the bundled corpus is only
what makes the numbers reproducible.

Secondary user: a hiring manager reading the repo. For them the artifacts are the six sweep
invariants, the 120-title adversarial corpus with named traps, and the fact that the headline
number reported is the failure rate rather than the accuracy.

---

## User journey

1. Land on the console. The adversarial corpus is already loaded and scored — no empty state, no
   "upload a CSV to begin".
2. Read the Scorecard: coverage, accuracy-on-resolved, **silent-error rate**, abstention precision,
   per-dimension, with the generated corpus and the adversarial corpus side by side and never
   averaged together.
3. Scan the Verdicts table. Sort by state. See `Head of Growth` sitting at `ambiguous` with
   `{Sales, Marketing}` and the tokens that forced the fork.
4. Open Abstentions. See the five reasons grouped: `taxonomy-fork` (a feature), `lexicon-gap` (a
   TODO), `no-evidence`, `non-english`, `garbage-only`.
5. Paste their own titles. Everything re-scores in the browser, no round trip. Gold labels are
   absent for pasted titles, so the Scorecard shows coverage and abstention breakdown but greys out
   the accuracy columns — it does not invent a denominator.
6. Hit *Propose lexicon entries* on an abstention group. The model reads the abstained titles and
   returns up to five candidate lexicon entries as a copyable diff, unapplied.
7. Download CSV, or copy the permalink and send it to a colleague.
8. Or skip the UI: `curl -X POST .../api/normalize -d '{"titles":["VP, Sales Ops"]}'`.

---

## MVP scope

**In:**

- Deterministic engine: string → `roles[]`, `function`, `seniority` (interval), `scope`, `persona`,
  each with a three-state verdict.
- Compound-title segmentation with a primary-role rule.
- Longest-phrase-first lexicon with token fallback.
- Ladder interval algebra for ordered seniority ambiguity.
- Persona derived from (function, band) so it can never contradict its inputs.
- Five-reason abstention taxonomy, exactly one reason per abstention.
- Seeded generator (~140 canonical roles × 10 noise ops → ~2,000 labelled titles).
- 120-title hand-curated adversarial corpus with gold *sets* and named trap labels.
- `evaluate.ts`: four metrics per dimension + confusion matrices, both corpora reported separately.
- `npm run sweep`: six invariants, brute-forced over the corpora. Generates the README numbers.
- Console: Input · Verdicts · Scorecard · Abstentions.
- CSV export, permalink (100 titles / 4 KB cap, no silent truncation).
- `POST /api/normalize` (pure, no key, rate-limited) and `POST /api/propose` (Gemini seam).
- Public repo from the first commit, Vercel production deploy, README numbers machine-generated.

**Out (explicitly) — as binding as the In list:**

- Non-English lexicons.
- Any model in the resolution path.
- Confidence scores or a coverage/precision threshold dial.
- Company context, headcount inference, enrichment lookups.
- Persistence of pasted titles; auth; multi-user anything.
- Hand-named buyer personas (Day 004 owns them).
- A specialty/sub-function axis (considered in Round 1 and dropped in favour of `scope`).
- Writing model-proposed lexicon entries to disk.

---

## Stack

Inherited wholesale from Days 001–010, because deviating costs reviewer familiarity and buys
nothing:

| layer | choice |
|---|---|
| framework | Next 16, App Router, React 19 |
| language | TypeScript, `strict` + `noUncheckedIndexedAccess` |
| styling | Tailwind 4 (`@tailwindcss/postcss`) |
| validation | Zod 4 — the engine's only dependency |
| tests | Vitest 4, config in `vitest.config.mts`, globs `lib/**/*.test.ts` |
| scripts | `vite-node -c vitest.config.mts` |
| model | `gemini-3.6-flash` via `@google/genai`, one seam only |
| package manager | npm (committed lockfile) |
| deploy | Vercel |

```bash
npm run dev
npm run build         # run before claiming done
npm test
npm run test:watch
npm run sweep         # six invariants + the README numbers
npm run typecheck     # next typegen && tsc --noEmit
npm run lint          # includes the engine boundary rule
```

---

## APIs / data sources

No third-party data source. The corpora are committed to the repo, one generated from a seeded PRNG
and one hand-written, so a stranger reproduces every published number with `npm run sweep` and no
credentials.

`GEMINI_API_KEY` is the only secret; `.env.example` carries the name, `.env.local` is gitignored.
Without a key the console works fully — only the *Propose lexicon entries* button reports that it
is unconfigured.

---

## System / architecture

```
                    ┌─ server component ──► data/*.ts (Zod-validated at import)
Browser ────────────┤
                    ├─ lib/normalize (pure) ──► same functions client- and server-side
                    │
                    ├─ POST /api/normalize ──► rate limit ──► same pure engine ──► Zod
                    │
                    └─ POST /api/propose  ──► key check ──► rate limit ──► model ──► Zod
                                                              ──► LexiconEntry[] (unapplied)
```

`lib/normalize/` is the engine and is **dependency-free and framework-free** — it imports `zod` and
nothing else. Not `next`, not `react`, not `@/data`, not `@google/genai`, no DOM globals, no
`Date.now`, no `Math.random`. An eslint `no-restricted-imports` rule scoped to the directory
enforces it and the package carries its own `README.md`. This is not stylistic: a normalizer that
cannot reach a network client cannot return an answer that is not a consequence of its arguments
and its lexicon.

### Modules

| module | responsibility |
|---|---|
| `types.ts` | the type contract — verdicts, roles, entries, reasons, metrics |
| `taxonomy.ts` | the 15 functions, 8 rungs, 3 scopes, 4 bands, region tokens. The **only** place a value is written down |
| `schema.ts` | Zod schemas for corpus, gold labels, lexicon, API payloads; parsed at import |
| `tokenize.ts` | string → tokens; casing, punctuation, junk stripping, script detection |
| `segment.ts` | compound split into role segments; primary selection |
| `lexicon.ts` | the entries; longest-phrase-first matching |
| `resolve.ts` | the pipeline; produces verdicts per dimension |
| `ladder.ts` | ordered-scale interval algebra for seniority |
| `persona.ts` | derived (function, band) → persona; ambiguity propagation |
| `evaluate.ts` | the four metrics, confusion matrices, per corpus |
| `export.ts` | CSV serialisation, permalink encode/decode with the cap |
| `index.ts` | the public surface — the boundary test pins it |

`data/` holds the generator, the seeded generated corpus and the adversarial corpus.
`lib/propose/` holds the Gemini call, prompt, response schema and rate limiter. `app/` is the single
console: Input · Verdicts · Scorecard · Abstentions.

### The pipeline

```
raw title
 ├─ 1. SCRIPT       non-Latin / non-English signal   ──► unknown (non-english)   (stop)
 ├─ 2. TOKENIZE     strip junk, honorifics, parens, region suffix, normalise case
 │                  nothing role-bearing left        ──► unknown (garbage-only)  (stop)
 ├─ 3. SEGMENT      split on conjunctions → 1..n role segments
 ├─ 4. MATCH        per segment: longest phrase first, then token fallback
 ├─ 5. RESOLVE      per segment per dimension → resolved | ambiguous | unknown
 │                    conflict + no phrase          ──► ambiguous (lexicon-gap)
 │                    conflict + declared fork      ──► ambiguous (taxonomy-fork)
 │                    no hit                        ──► unknown  (no-evidence)
 ├─ 6. PRIMARY      highest ladder rung wins; tie → leftmost segment
 └─ 7. DERIVE       band ← seniority; persona ← (function, band); ambiguity propagates
```

Steps 1–7 are one pure function. There is no step in which a model participates.

---

## Data model

### Taxonomy

`function` (15): `Sales` · `Marketing` · `RevOps` · `CustomerSuccess` · `Support` · `Engineering` ·
`Product` · `Design` · `Data` · `Finance` · `HR` · `Legal` · `IT` · `Security` · `ExecGeneral`.

`ExecGeneral` is not a dumping ground: a title reaches it only through an explicit phrase entry
(`CEO`, `Chief of Staff`, `Owner`, `Managing Director`), never through token fallback. A standalone
`Ops` folds into `RevOps`; a bare `Ops` with no qualifier is unresolvable noise and abstains.
`Design` stays separate from `Product` because the titles are separable in practice.

`seniority` (8 rungs, **ordered**): `Intern` < `IC` < `SeniorIC` < `Manager` < `Director` < `VP` <
`CSuite` < `FounderOwner`.

`scope`: `Global` · `Regional` · `None`. `band`: `IC` · `Manager` · `Leader` · `Exec`.

### Verdict

Every dimension of every segment carries the same three-state shape:

```ts
type Verdict<T> =
  | { state: "resolved";  value: T }
  | { state: "ambiguous"; candidates: T[]; reason: AmbiguityReason; because: string[] }
  | { state: "unknown";   reason: UnknownReason;   because: string[] }
```

`because` is the token or phrase evidence — the audit trail. A verdict with an empty `because` is a
bug, and a test asserts it cannot happen.

Seniority is the exception in representation only: because the ladder is ordered, an ambiguous
seniority is always a **contiguous interval** `[lo, hi]` rather than an arbitrary set. `Head of
Sales` yields `[Director, VP]`. Contiguity is a sweep invariant — a non-contiguous seniority
candidate set means a lexicon entry is wrong, not that the title is unusual.

### Lexicon entry

**Build-time refinement to decision 16.** A third kind, `exact`, was added during step 7 and is
recorded here rather than left as silent drift. `exact` matches only when the pattern spans the
*whole* segment, and precedence is `exact` > longest `phrase` > `token`. It exists because the rule
"`ExecGeneral` is never reachable by token fallback" is unimplementable otherwise: `ceo`, `owner` and
`president` are single tokens, so a `phrase` entry cannot express them, and a `token` entry would let
`Product Owner` reach `ExecGeneral`. Nothing else about decisions 16, 17 or 24 changes.

```ts
type LexiconEntry = {
  pattern: string;
  kind: "exact" | "phrase" | "token";
  function?: FunctionId | FunctionId[];   // an array declares a genuine taxonomy fork
  seniority?: SeniorityId | [SeniorityId, SeniorityId];
  scope?: ScopeId;
  note?: string;                          // why this entry exists
};
```

Matching is **longest phrase first**, then token fallback for whatever the phrases did not claim.
`Sales Engineer` is a phrase → `Sales`, so it is never decided by the `Engineer` token. `Marketing
Operations` is a phrase → `RevOps`, never by `Marketing`. `Product Owner`, `Chief of Staff`,
`Solutions Architect`, `Growth` and roughly forty other hard cases exist as phrases with a `note`,
which makes the lexicon double as the documentation of every hard case in the domain.

Multi-value `function` on an entry is the *declared fork*: it says the ambiguity is in the world.
An undeclared conflict between two token entries is a `lexicon-gap`: it says the ambiguity is in my
file. The engine can tell them apart, and that distinction is the repo's central claim.

### Role and result

```ts
type Role = { segment: string; function: Verdict<FunctionId>; seniority: Verdict<SeniorityId>;
              scope: Verdict<ScopeId> };
type Result = { raw: string; roles: Role[]; primaryIndex: number; compound: boolean;
                function: Verdict<FunctionId>; seniority: Verdict<SeniorityId>;
                scope: Verdict<ScopeId>; band: Verdict<BandId>; persona: Verdict<string> };
```

Top-level dimensions are the primary role's, with `compound: true` when `roles.length > 1`.
`Founder & CTO` is two resolved roles, primary `FounderOwner`/`ExecGeneral`, secondary
`CSuite`/`Engineering` — not one ambiguous answer.

Persona is derived, never independent: `persona = Function + Band` (`Sales Leader`, `Data IC`,
`Finance Exec`), with impossible cells pruned. If either input is ambiguous the persona is
ambiguous over the cross-product; if either is unknown the persona is unknown. It is structurally
incapable of contradicting the fields it comes from.

### Abstention reasons

| reason | meaning | what a reader should do |
|---|---|---|
| `taxonomy-fork` | declared multi-value entry; the world is ambiguous | nothing — this is correct output |
| `lexicon-gap` | conflicting tokens, no phrase covers them | write the phrase entry |
| `no-evidence` | no lexicon hit at all | add the role, or accept it is not a title |
| `non-english` | script/language signal | out of scope by design |
| `garbage-only` | junk with no role content | nothing — the input was not a title |

Exactly one reason per abstention. The Abstentions pane groups by reason so a feature and a TODO are
never in the same bucket.

---

## Metrics

Per dimension, per corpus, never averaged across corpora:

- **coverage** — share of titles with `state: "resolved"`.
- **accuracy-on-resolved** — of the resolved, share matching gold.
- **silent-error rate** — resolved *and* wrong, as a share of all titles. **The headline.**
- **abstention precision** — of the abstentions, share where gold is genuinely a set, scored two
  ways: **set equality** (candidates exactly equal gold, the headline) and **containment**
  (candidates include gold truth, reported alongside). Containment alone is gameable — abstaining
  with all eight rungs would score 100%.

Plus a confusion matrix per dimension.

There is **no confidence threshold dial.** A knob that trades coverage against precision lets a
reader tune to whatever number flatters the demo; the four numbers are published at one operating
point and stand on their own.

### The number that is never reported

A single blended "accuracy" figure across both corpora. Two thousand generated titles would bury
the 120 that are the actual test. The README prints two columns, always.

---

## The corpora

**Generated (~2,000).** ~140 canonical roles crossed with ten **label-preserving** noise ops:
case mangle · punctuation swap · separator variants (`,` `-` `|` `@`) · abbreviation
expand/contract (`Sr.`↔`Senior`, `SVP`↔`Senior Vice President`) · appended junk
(`| We're hiring 🚀`) · parenthetical department · leading department prefix · region suffix ·
whitespace/typo slip · credential suffix (`, MBA`). Seeded PRNG, committed as JSON. No clock, no
runtime randomness.

**Hard rule:** if an op could change meaning, it is not a noise op — it becomes a hand-curated
adversarial case instead. This is what keeps the noise-invariance invariant from being circular,
and it is a rule about the generator, not a preference.

**Adversarial (120, hand-curated, gold *sets*).** Each carries a named trap label. The flagship
traps:

| trap | title | correct behaviour |
|---|---|---|
| the genuine fork | `Head of Growth` | `ambiguous {Sales, Marketing}`, `taxonomy-fork` |
| the ladder interval | `Head of Sales` | seniority `[Director, VP]` |
| the phrase that beats its tokens | `Sales Engineer` | `Sales`, not Engineering |
| the ops trap | `VP of Sales Operations` | `RevOps`, not Sales |
| the compound | `Founder & CTO` | two resolved roles, not one ambiguity |
| the functionless exec | `Chief of Staff` | `ExecGeneral`, resolved |
| the methodology fork | `Product Owner` | `ambiguous {Product, …}`, `taxonomy-fork` |
| the region suffix | `Director, EMEA` | scope `Regional`, function `unknown (no-evidence)` |
| the junk-only string | `\| We're hiring 🚀` | `unknown (garbage-only)` |
| the foreign title | `Directeur Commercial` | `unknown (non-english)` |

---

## Validation / test plan

Unit tests live beside each module. Two suites carry the weight:

**The named traps** (`traps.test.ts`) — one test per adversarial trap, named after it, so a failure
reads as *"the phrase that beats its tokens"* rather than as an index into a fixture.

**The invariant sweep** (`npm run sweep`) — six properties brute-forced over both corpora:

1. **determinism** — same input, same verdict, byte for byte, across repeated runs.
2. **idempotence** — a canonical title resolves to itself; re-normalizing a resolved output is a
   fixed point.
3. **noise invariance** — every generator noise op preserves the gold label, for every canonical
   role × op pair.
4. **monotonicity** — adding a lexicon entry never flips a resolved answer. It may only turn
   `unknown → resolved`, or narrow an `ambiguous` candidate set. Verified by re-running the corpus
   against the lexicon with each entry withheld in turn. This is the property that makes the
   lexicon safe to grow, and the one most likely to catch a real bug.
5. **taxonomy totality + disjointness** — every lexicon value is in `taxonomy.ts`; no two functions
   share a phrase without a declared fork; every persona cell is reachable or explicitly pruned.
6. **ladder-interval contiguity** — every ambiguous seniority is a contiguous interval.

Also: a purity test asserting `lib/normalize` reaches no forbidden global, and a boundary test
pinning the public surface of `index.ts` so widening it is a deliberate diff.

The sweep writes the numbers the README quotes. They are generated, not typed.

---

## Console layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Input        corpus picker · paste box (100 titles / 4 KB) · permalink   │
├───────────────────────────────────────┬──────────────────────────────────┤
│ Verdicts                              │ Scorecard                        │
│ title → roles · function · seniority  │ coverage / accuracy / SILENT     │
│ interval · scope · persona · state    │ ERROR / abstention precision     │
│ sortable by state; evidence on hover  │ generated | adversarial columns   │
│                                       ├──────────────────────────────────┤
│                                       │ Abstentions                      │
│                                       │ grouped by reason                │
│                                       │ [Propose lexicon entries] ← model│
└───────────────────────────────────────┴──────────────────────────────────┘
```

The Abstentions pane is the only place the model appears, and its output lands as a copyable diff
that is never written to disk.

---

## Implementation task order

One commit per step, pushed to `main` as it lands.

1. `plan:` this document + MIT `LICENSE`, public repo created.
2. `docs:` `CLAUDE.md` — engine boundary, pipeline, the invariants that are easy to break.
3. `chore:` Next 16 scaffold with the engine boundary lint rule.
4. `feat(normalize):` type contract, taxonomy, Zod schemas, trust boundary.
5. `feat(normalize):` tokenize — junk stripping, script detection, evidence capture.
6. `feat(normalize):` segment — compound split and primary selection.
7. `feat(normalize):` the lexicon, longest-phrase-first, with notes on every hard case.
8. `feat(normalize):` resolve — the pipeline and the fork/gap distinction.
9. `feat(normalize):` ladder interval algebra and derived persona.
10. `feat(data):` the seeded generator — 140 roles × 10 noise ops.
11. `feat(data):` the 120-title adversarial corpus with gold sets and trap labels.
12. `test:` the named traps and the six-invariant sweep.
13. `feat(normalize):` evaluate — four metrics, confusion matrices, per corpus.
14. `feat(normalize):` CSV, permalink, public surface, `/api/normalize`, boundary test.
15. `feat(app):` the console — input, verdicts, scorecard, abstentions.
16. `feat(propose):` the model's one job — lexicon entries for abstained titles, unapplied.
17. `docs:` README with swept numbers, plain-English guide, screenshots from the live deployment.

---

## Deployment plan

Vercel, production. `GEMINI_API_KEY` set via the Vercel CLI. `npm run build`, `npm run typecheck`,
`npm run lint`, `npm test` and `npm run sweep` all green before the deploy. Screenshots for the
README and the guide come from the live URL, not from localhost.

---

## README plan

Lead with the silent-error rate, not the accuracy. Two-column table (generated | adversarial), the
ten named traps with the correct behaviour, the six invariants, the pipeline diagram, the
`curl` example against `/api/normalize`, and a paragraph on why there is no confidence score. Every
number generated by `npm run sweep`.

Plus `docs/plain-english-guide.md` and a `Title Normalizer - how it works (plain English).pdf` on
the Desktop, matching Days 001–010.

---

## Definition of done

- `npm run build`, `typecheck`, `lint`, `test`, `sweep` all green.
- Six invariants hold over both corpora.
- Silent-error rate published for both corpora, adversarial included, however it lands.
- Every abstention carries exactly one reason and non-empty evidence.
- Public repo, 17 commits, each pushed as it landed. Live Vercel URL in the README.
- `curl` example in the README works against production.

---

## Post-MVP (not in this build)

Non-English lexicons; a headcount-conditioned seniority resolver (the `[Director, VP]` interval
collapses if you know the company size — but the input contract is a string, and taking company
context would make this Day 014's repo); lexicon versioning with a migration report; an
inter-annotator agreement study on the adversarial gold labels.

---

## Settled decisions

Round 1 — 1. thesis is a deterministic engine whose own failures are the headline output; the
taxonomy is underdetermined, not merely messy. 2. dimensions are function (15) / seniority (8,
ordered) / scope (3), persona derived. 3. deterministic engine, model at one narrow seam (lexicon
proposal only), never in the measured path. 4. hybrid corpus — seeded generator for volume,
hand-curated adversarial set for the traps. 5. three-state verdict per dimension; candidate sets,
never confidence scores. 6. four surfaces — paste box, CSV, permalink, HTTP. 7. inherit the
Days 001–010 stack, Vercel, commit-per-step to `main`.

Round 2 — 8. compound titles split into role segments with a primary rule (highest rung, tie →
leftmost) and a `compound` flag. 9. ladder-range titles abstain as a contiguous interval; no 9th
rung, no convention pick. 10. four metrics + confusion matrix, silent-error rate is the headline, no
threshold dial. 11. six sweep invariants including lexicon monotonicity. 12. ten label-preserving
noise ops, and the hard rule that a meaning-changing op is an adversarial case instead. 13.
non-English out of scope, detected and abstained. 14. four console panes; the model appears only in
Abstentions. 15. engine layout mirrors `lib/routing` and `lib/diagnose`.

Round 3 — 16. lexicon entries are phrase-or-token, longest-phrase-first, phrases carry notes. 17.
undeclared token conflict → `ambiguous` *and* a `lexicon-gap` report. 18. persona = Function + Band,
derived; buyer-role naming stays in Day 004. 19. abstention scored by set equality (headline) and
containment (alongside). 20. both corpora reported side by side, never averaged. 21. two routes —
`/api/normalize` (pure, keyless) and `/api/propose` (model seam). 22. permalink capped at 100
titles / 4 KB, no silent truncation. 23. 17 commits in the order above, plus the plain-English PDF.

Round 4 — 24. exact taxonomy values as listed; `Ops` folds into `RevOps`; `ExecGeneral` is
phrase-only. 25. five abstention reasons, exactly one per abstention. 26. ~2,000 generated from ~140
canonical roles, 120 adversarial, seeded and committed. 27. `gemini-3.6-flash`, `GEMINI_API_KEY`,
10 req/min/IP, ≤5 proposed entries, Zod-validated, never written to disk. 28. public repo from the
first commit; history is not squashed.
