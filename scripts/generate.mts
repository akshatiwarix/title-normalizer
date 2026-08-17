/**
 * Writes `data/generated.json`.
 *
 * Run with `npm run generate`. The output is committed, so the corpus a reviewer
 * scores against is byte-identical to the one the README quotes — the seed is here,
 * the ops are in `data/noise.ts`, and nothing reads a clock or an unseeded random
 * source.
 */

import { writeFileSync } from "node:fs";
import { CANONICAL_ROLES } from "@/data/roles";
import { NOISE_OP_IDS, applyOps, seeded, type Rng } from "@/data/noise";
import type { CorpusTitle } from "@/lib/normalize/types";

const SEED = 11_011;
const VARIANTS_PER_ROLE = 20;

function chooseOps(rng: Rng): string[] {
  const count = 1 + Math.floor(rng() * 3);
  const pool = [...NOISE_OP_IDS].sort(() => rng() - 0.5);
  return pool.slice(0, count);
}

const rng = seeded(SEED);
const seen = new Set<string>();
const titles: CorpusTitle[] = [];

for (const role of CANONICAL_ROLES) {
  const emit = (raw: string, scope: string, ops: string[]) => {
    const key = raw.trim().toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    titles.push({
      raw,
      canonical: role.title,
      ops,
      gold: {
        function: { kind: "labelled", values: [role.function] },
        seniority: { kind: "labelled", values: [role.seniority] },
        scope: { kind: "labelled", values: [scope as "Global" | "Regional" | "None"] },
      },
    });
  };

  emit(role.title, role.scope ?? "None", []);

  for (let variant = 0; variant < VARIANTS_PER_ROLE; variant += 1) {
    const result = applyOps(role, chooseOps(rng), rng);
    if (result.ops.length === 0) continue;
    emit(result.title, result.scope, result.ops);
  }
}

writeFileSync(
  new URL("../data/generated.json", import.meta.url),
  `${JSON.stringify({ id: "generated", titles }, null, 1)}\n`,
);

console.log(`generated ${titles.length} titles from ${CANONICAL_ROLES.length} canonical roles`);
