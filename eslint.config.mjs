import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // The engine boundary (PLAN.md, "System / architecture"). `lib/normalize/` is
  // a dependency-free, framework-free package: it may import `zod` and its own
  // relative modules, nothing else. A normalizer that cannot reach a network
  // client cannot return an answer that is not a consequence of its arguments
  // and its lexicon.
  //
  // Test files are exempt here because `purity.test.ts` reads the engine's
  // source off disk and enforces the same rule with no allowlist at all — that
  // test, not this rule, is the real boundary.
  {
    files: ["lib/normalize/**/*.ts"],
    ignores: ["lib/normalize/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "next",
                "next/*",
                "next/**",
                "react",
                "react-*",
                "react/**",
                "react-dom/**",
                "@google/genai",
                "@google/**",
                "@/*",
                "@/**",
                "node:*",
                "fs",
                "path",
              ],
              message:
                "lib/normalize is dependency-free: only `zod` and relative imports are allowed. Move this code to lib/propose, the data layer, or the route handler.",
            },
          ],
        },
      ],
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
