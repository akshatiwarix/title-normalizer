/**
 * `POST /api/normalize` — the engine over HTTP.
 *
 * No key, because there is no secret behind it: this is the same pure function the
 * browser runs, and it exists so "reusable GTM infrastructure" is a claim a reviewer
 * can check from a terminal instead of a sentence in a README.
 *
 *   curl -sX POST https://<host>/api/normalize \
 *     -H 'content-type: application/json' \
 *     -d '{"titles":["Head of Growth","VP, Sales Ops","Directeur Commercial"]}'
 *
 * Rate-limited per IP for the same reason a bicycle has a lock.
 */

import { normalizeRequestSchema, normalizeTitles } from "@/lib/normalize";
import { clientKey, rateLimit } from "@/lib/http/rate-limit";

const LIMIT_PER_MINUTE = 30;

export async function POST(request: Request) {
  const limit = rateLimit(`normalize:${clientKey(request)}`, LIMIT_PER_MINUTE);
  if (!limit.allowed) {
    return Response.json(
      { error: "rate limited", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }

  const parsed = normalizeRequestSchema.safeParse(body);
  if (!parsed.success) {
    // The caps are named in the error rather than applied silently: a request for
    // 200 titles gets a refusal, never the first 100 with the rest dropped.
    return Response.json(
      { error: "invalid request", issues: parsed.error.issues.map((issue) => issue.message) },
      { status: 400 },
    );
  }

  return Response.json({ results: normalizeTitles(parsed.data.titles) });
}
