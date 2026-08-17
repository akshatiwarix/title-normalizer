/**
 * `POST /api/propose` — the model seam, and the only route that needs a key.
 *
 * Missing key → 501 pointing at the lexicon. Model failure → 502. Everything else in
 * this app — both corpora, every verdict, the whole scorecard, the abstention grouping,
 * the CSV, the permalink and `/api/normalize` — works with `GEMINI_API_KEY` unset.
 */

import { proposeRequestSchema } from "@/lib/normalize";
import { MissingKeyError, ModelError, proposeEntries } from "@/lib/propose/generate";
import { clientKey, rateLimit } from "@/lib/http/rate-limit";

const LIMIT_PER_MINUTE = 10;

export async function POST(request: Request) {
  const limit = rateLimit(`propose:${clientKey(request)}`, LIMIT_PER_MINUTE);
  if (!limit.allowed) {
    return Response.json(
      {
        error: `Proposals are limited to ${LIMIT_PER_MINUTE} a minute. Try again in ${limit.retryAfterSeconds}s — writing the entry by hand is the same work and needs no key.`,
      },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = proposeRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Send the abstained titles and the reason they abstained." },
      { status: 400 },
    );
  }

  try {
    const entries = await proposeEntries(parsed.data.titles, parsed.data.reason);
    return Response.json({ entries });
  } catch (error) {
    if (error instanceof MissingKeyError) {
      return Response.json(
        {
          error:
            "No GEMINI_API_KEY is configured, so no entries can be proposed. Nothing else in this console depends on it — the abstentions above already say exactly which phrase is missing.",
        },
        { status: 501 },
      );
    }
    if (error instanceof ModelError) {
      return Response.json(
        {
          error: `The model could not produce entries this lexicon will accept. ${error.message}`,
        },
        { status: 502 },
      );
    }
    return Response.json({ error: "The proposal failed." }, { status: 500 });
  }
}
