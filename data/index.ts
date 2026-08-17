/**
 * The corpora, validated at import.
 *
 * A malformed fixture is a crash on load rather than a wrong number in a
 * scorecard, which is the only place a validation error is cheap.
 */

import { corpusSchema } from "@/lib/normalize/schema";
import type { Corpus } from "@/lib/normalize/types";
import generatedJson from "./generated.json";

export const GENERATED: Corpus = corpusSchema.parse(generatedJson);

export const CORPORA: Corpus[] = [GENERATED];

export function corpusById(id: string): Corpus | undefined {
  return CORPORA.find((corpus) => corpus.id === id);
}
