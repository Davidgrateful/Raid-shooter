import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  /*
   * The vanilla-JS engine in public/game is a different codebase with
   * different conventions, and it predates the Next app around it. Linting it
   * with the app's TypeScript-flavoured rules produced ~120 findings that were
   * all style, none of them bugs - which buried the ~16 real React findings in
   * src/ that DO matter.
   *
   * These are scoped off for the engine only. `this`-aliasing (`var $ = this`)
   * is the engine's core module idiom and appears ~39 times; rewriting it
   * would touch thousands of lines of working game code to satisfy a rule
   * written for a different style of JavaScript. Unused vars and expressions
   * are downgraded to warnings rather than silenced, so genuine dead code is
   * still visible without failing the build.
   *
   * Everything in src/ keeps the full ruleset.
   */
  /*
   * Tests drive the game through `window.$`, a large dynamically-typed global
   * that has no TypeScript definition and should not grow a fake one just to
   * satisfy the linter. Reaching into it is the whole job of these files.
   */
  {
    files: ['tests/**/*.ts', 'playwright.config.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  {
    files: ['public/game/**/*.js'],
    rules: {
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
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
