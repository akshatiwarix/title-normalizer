# Title Normalizer — how it works, in plain English

No code in this document. It explains what the tool does, why the hard part is not what people think
it is, and why it refuses to give you a confidence score.

---

## The problem

Somewhere in your company, a job title becomes two columns.

`VP of Sales Operations` goes in one end. `function = Sales`, `seniority = VP` comes out the other,
and from there it routes the lead, scores the account, picks the sequence and shows up in the board
deck as *pipeline by persona*.

That conversion happens in your enrichment vendor, or in a Clay table, or in three hundred lines of
`CASE WHEN title LIKE '%vp%'` in your warehouse. Wherever it happens, it has two properties in
common everywhere:

1. It always returns an answer.
2. Nobody — including the vendor — knows how often that answer is wrong.

By the way, the answer above is wrong. Sales Operations is a RevOps job, not a Sales job. It says
`Sales` because the word "sales" is in the string.

## Everyone thinks the hard part is the mess

Ask why title normalization is hard and you get the mess: `vp sales`, `V.P. SALES`,
`VP Sales | We're hiring 🚀`, `VP Sales, MBA`, `Директор по продажам`.

That is real, and it is the easy half. Stripping emoji and expanding `Sr.` is a solved problem.

The hard half is that **for a lot of titles there is no right answer.**

- **`Head of Growth`** is Marketing at one company, Sales at the next, and at a third it is two
  people doing both. Nobody is wrong. The title genuinely does not say.
- **`Head of Sales`** is a Director at a 90-person company and a VP at a 3,000-person company. Same
  five words, different level, and the string carries no headcount.
- **`Product Owner`** is a product job in a company that actually runs Scrum, and a project-manager
  job in a company that says Scrum and means Gantt charts.
- **`Chief of Staff`** has no function at all. Their function is whoever's office they sit in.
- **`Founder & CTO`** is not one job. It is two, about one person.

Every tool in this category handles these by quietly picking one. It picks the same one every time,
so it looks correct, and the pick is never written down anywhere.

## What this tool does instead

It returns one of three things for each answer, and it always shows you what made it decide.

**It resolved it.** One value, plus the word or phrase behind it. `Sales Engineer` → Sales, because
`sales engineer` is a phrase in the lexicon that outranks the word `engineer` sitting inside it.

**It is ambiguous.** Not "low confidence" — the actual list. `Head of Growth` comes back as
*{Sales, Marketing}*, with the word `growth` cited as the thing that forked it.

**It does not know.** No answer, and a reason.

## The distinction the whole project rests on

When it says "ambiguous", it also tells you *whose problem that is.* There are only two answers, and
they are opposites.

### It is the world's problem

`Head of Growth` is ambiguous because the job market is ambiguous. Somebody wrote that into the
lexicon on purpose: *this word means two things, and no amount of work fixes it.*

This is **finished work.** The output is correct. Nobody has anything to do. Your router can branch
on it — send it to whoever covers both, or ask a human, or enrich the company and decide from
headcount.

### It is our problem

`Marketing Finance Manager` is ambiguous because the lexicon knows `marketing` and it knows
`finance`, and nobody ever told it what the two words mean *together.*

This is **a TODO.** One line in one file fixes it. The tool says so, in as many words, and groups it
separately from the first kind.

Every other tool puts both of these in the same bucket labelled "we're not sure". A feature and a
bug, in one pile, indistinguishable. Separating them is the point of this repo.

Three more reasons cover everything else: it has never seen these words before; the title is in a
language this tool deliberately does not handle; or the input was not a title at all
(`| We're hiring 🚀`).

## Why there is no confidence score

Every tool in this category answers ambiguity with a number. `0.62`.

That number is unusable. It does not tell you *what else* was in contention, or *why*, or whether the
contention was real. You cannot write a rule against it that means anything. It exists so the column
is not empty.

Worse, it moves the argument. Instead of "is this title Sales or Marketing", you end up discussing
where to put the threshold — and a threshold is a dial that lets anyone tune the demo to whatever
number looks good.

*{Sales, Marketing} because of the word "growth"* is a sentence you can act on. `0.62` is not.

## The number it leads with

The tool publishes four figures per column, and the headline is the ugly one:

**Silent error rate — how often it gave a confident answer that was wrong.**

That is the number no vendor in this category computes, and it is the only one that describes the
damage. The others are easy to game:

- *Accuracy* goes to 100% if you refuse to answer anything hard.
- *Coverage* goes to 100% if you guess on everything.

You have to read them together, which is why they sit next to each other.

On 129 titles hand-picked to break normalizers, this one answers 62% of them and gets **none** of
them wrong. The 38% it declines are mostly the genuine forks, where declining is the correct answer.

On 2,061 machine-generated noisy titles it answers all of them and gets none wrong — but that corpus
only tests robustness to mess, which is the easy half, and it is reported in a separate column and
never averaged with the hard one. Averaging them would let two thousand easy titles bury the 129 that
actually test anything.

## How it decides

1. **Is this even English?** Non-Latin script, or a strong foreign-language word like `Directeur`,
   and it stops with "not my language". Refusing loudly is a correct answer. Guessing Engineering
   from `Directeur` is not.
2. **Clean it up.** Emoji, URLs, taglines, company names, `, MBA`, stray punctuation. If a region
   like `EMEA` is in there, it is lifted out and recorded as geography rather than treated as a role.
   If nothing role-like survives, it stops with "that was not a title".
3. **Split compound titles.** `Founder & CTO` becomes two roles, resolved separately. Nothing gets
   thrown away.
4. **Match, most specific first.** A whole-title match beats a phrase; a phrase beats a single word.
   This is why `Sales Engineer` is Sales, `Marketing Operations` is RevOps, and `People Operations`
   is HR rather than RevOps.
5. **Decide, or report.** The most specific claim wins. Two claims of equal specificity that
   disagree are *reported*, never quietly resolved by which one happens to be first in the file.
6. **Pick the main role** in a compound title: the most senior one, ties going to the leftmost.
7. **Derive the rest.** Persona is calculated from function and level, so it can never contradict
   them. That is how a CRM ends up with `Marketing`, `VP` and `Technical IC` in the same row.

## One useful consequence of ordering the levels

The eight levels run Intern → IC → Senior IC → Manager → Director → VP → C-suite → Founder/Owner, in
that order. Because they are ordered, an honest "don't know" about a level is always a *range* —
`Head of Sales` is Director-or-VP, never Director-or-C-suite-but-not-VP.

Which means the uncertainty sometimes disappears one level up. Director and VP are both *leaders*.
So even though the tool won't tell you the rung, it will tell you the band, with no hedging. An
abstention does not have to spread to everything downstream of it.

## Where the AI is, and where it is not

There is one AI feature. It reads the titles the tool already refused and suggests new lexicon
entries — the same one-line entries a human writes.

Its suggestions land as text you copy. **They are never applied automatically.**

That boundary is load-bearing. The moment a model participates in resolving titles, every number
above stops being a fact about a file you can read and becomes a claim about the average behaviour of
a model on a day it was sampled. The tool works completely with the AI turned off; the AI only helps
you extend it.

## Try it on your own titles

Paste up to 100 titles from your own CRM into the box. They are processed inside your browser — not
uploaded, not logged, not stored. Within a couple of seconds you can see how many this thing is
willing to answer on *your* data, and read exactly why it refused the rest.

That is the honest version of a demo: not a number we picked, a number your data produced.
