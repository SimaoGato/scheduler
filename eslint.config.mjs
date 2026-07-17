import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // CHORE-23 (pre-existing, unrelated to this chore's diff): "App design
    // refinement/" is a standalone, self-contained HTML/JS mockup prototype
    // (see docs/stories/CHORE-23-...md Context section) — reference only,
    // never imported into or wired up inside the running app. It is not
    // part of this project's source and should not be linted as such.
    "App design refinement/**",
  ]),
]);

export default eslintConfig;
