#!/usr/bin/env node
/**
 * Verifies package.json subpath exports stay in sync with the distributions
 * actively exported from src/dist/index.js.
 *
 * Catches:
 *   - New distribution added to src/dist/index.js but subpath entry missing from package.json
 *   - Subpath entry in package.json pointing to a distribution no longer in src/dist/index.js
 *
 * The same regex used in rollup.config.js to select distributions for per-file
 * builds is used here, so the check validates both artefacts stay aligned.
 */

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')

// Distributions actively exported from the main index (same regex as rollup.config.js)
const indexSrc = fs.readFileSync(path.join(root, 'src/dist/index.js'), 'utf8')
const fromIndex = new Set(
  [...indexSrc.matchAll(/^export.*from '\.\/([a-z0-9][a-z0-9-]*)'/gm)].map(m => m[1])
)

// Distributions with subpath entries in package.json
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const fromExports = new Set(
  Object.keys(pkg.exports)
    .filter(k => k.startsWith('./dist/') && k !== './dist')
    .map(k => k.replace('./dist/', ''))
)

let ok = true

for (const name of fromIndex) {
  if (!fromExports.has(name)) {
    console.error(`MISSING subpath export: "./dist/${name}" not in package.json exports`)
    ok = false
  }
}

for (const name of fromExports) {
  if (!fromIndex.has(name)) {
    console.error(`STALE subpath export: "./dist/${name}" in package.json but not in src/dist/index.js`)
    ok = false
  }
}

if (ok) {
  console.log(`OK: ${fromIndex.size} subpath exports in sync with src/dist/index.js`)
  process.exit(0)
} else {
  process.exit(1)
}
