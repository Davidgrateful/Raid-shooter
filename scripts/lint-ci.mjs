#!/usr/bin/env node
/*==============================================================================
LINT RATCHET

`npm run lint` exits non-zero on the current tree: there are pre-existing
errors in src/ and public/game/ (mostly react-compiler rules that arrived with
eslint-config-next, plus a handful of prefer-const). That is a real backlog,
but clearing it means refactoring working production React, which is not
something a verification phase should be doing on its own initiative.

The problem is that a plain `eslint` step in CI is therefore red on day one,
and a CI job that is always red tells you nothing - people stop reading it, and
the genuine regression it was meant to catch scrolls past with the noise.

So this script ratchets instead of gating. It fails the build when the error
count goes UP, which is the actual regression signal, and tells you to lower
the baseline when it goes DOWN so the backlog can only shrink.

  node scripts/lint-ci.mjs            check against the baseline
  node scripts/lint-ci.mjs --update   write the current count as the baseline

Warnings are reported but never fail the build.
==============================================================================*/

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(root, '.eslint-baseline.json');

/** Run eslint and return its JSON report, whatever its exit code. */
function report() {
  try {
    return JSON.parse(execFileSync('npx', ['eslint', '-f', 'json'], {
      cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
      // eslint exits 1 when it finds errors; that is expected, not a crash
      stdio: ['ignore', 'pipe', 'ignore'],
    }));
  } catch (err) {
    if (err.stdout) {
      try { return JSON.parse(err.stdout); } catch { /* fall through */ }
    }
    console.error('lint-ci: could not run eslint or parse its output');
    console.error(err.message);
    process.exit(2);
  }
}

const results = report();
let errors = 0;
let warnings = 0;
const offenders = [];

for (const file of results) {
  errors += file.errorCount;
  warnings += file.warningCount;
  if (file.errorCount > 0) {
    const rel = file.filePath.replace(`${root}/`, '');
    for (const m of file.messages) {
      if (m.severity === 2) {
        offenders.push(`  ${rel}:${m.line}:${m.column}  ${m.ruleId ?? 'error'}  ${m.message}`);
      }
    }
  }
}

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, `${JSON.stringify({ errors }, null, 2)}\n`);
  console.log(`lint-ci: baseline written at ${errors} error(s)`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error('lint-ci: no .eslint-baseline.json - run `npm run lint:baseline` once and commit it');
  process.exit(2);
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')).errors;

console.log(`lint-ci: ${errors} error(s), ${warnings} warning(s) - baseline ${baseline}`);

if (errors > baseline) {
  console.error(`\nlint-ci: FAIL - ${errors - baseline} new error(s) since the baseline.\n`);
  console.error(offenders.join('\n'));
  console.error('\nFix the new error, or if it is genuinely acceptable, raise the');
  console.error('baseline with `npm run lint:baseline` and say why in the commit.');
  process.exit(1);
}

if (errors < baseline) {
  console.log(`lint-ci: ${baseline - errors} error(s) cleared - run \`npm run lint:baseline\` to lock the gain in.`);
}

process.exit(0);
