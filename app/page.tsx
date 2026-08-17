import { ADVERSARIAL, GENERATED } from "@/data";
import { decodeTitles, evaluateCorpus, normalizeTitles } from "@/lib/normalize";
import { Console, type CorpusView } from "./components/Console";

/**
 * The corpora are read and validated on the server, and the *metrics* are computed
 * there too — over every title in both corpora, not over what the browser receives.
 *
 * The generated corpus ships a sample of its rows to the browser because 2,061
 * labelled titles is most of a megabyte and the table only ever shows a screenful.
 * The scorecard is unaffected: it is computed over the whole thing server-side, and
 * the panel says how many rows were shipped rather than letting a reader assume the
 * sample is the corpus. A silent cap reads as "we measured everything".
 *
 * The permalink is decoded here rather than in an effect: it is untrusted input, it
 * goes through the same validation as everything else, and doing it before the first
 * render means a bad link produces a message instead of a console that flickers.
 */

const GENERATED_ROWS_SHOWN = 80;

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const encoded = typeof params.t === "string" ? params.t : null;
  const decoded = encoded ? decodeTitles(encoded) : null;

  const adversarial: CorpusView = {
    id: ADVERSARIAL.id,
    label: "adversarial",
    count: ADVERSARIAL.titles.length,
    titles: ADVERSARIAL.titles,
    metrics: evaluateCorpus(
      ADVERSARIAL,
      normalizeTitles(ADVERSARIAL.titles.map((title) => title.raw)),
    ),
    note: `all ${ADVERSARIAL.titles.length} hand-curated titles, each with a named trap · click a row for its evidence`,
  };

  const generated: CorpusView = {
    id: GENERATED.id,
    label: "generated",
    count: GENERATED.titles.length,
    titles: GENERATED.titles.slice(0, GENERATED_ROWS_SHOWN),
    metrics: evaluateCorpus(
      GENERATED,
      normalizeTitles(GENERATED.titles.map((title) => title.raw)),
    ),
    note: `${GENERATED_ROWS_SHOWN} of ${GENERATED.titles.length} rows shipped to the browser; the scorecard covers all ${GENERATED.titles.length}`,
  };

  const linkError =
    decoded === null || decoded.state === "ok"
      ? null
      : decoded.state === "over-cap"
        ? `that link carries ${decoded.titles} titles and the cap is ${decoded.maxTitles}. Nothing was truncated — ask for a shorter link.`
        : "that permalink is malformed, so nothing was loaded from it.";

  return (
    <Console
      corpora={[adversarial, generated]}
      initialTitles={decoded?.state === "ok" ? decoded.titles : null}
      linkError={linkError}
    />
  );
}
