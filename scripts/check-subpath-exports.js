#!/usr/bin/env node
/**
 * Verifies package.json subpath exports stay in sync with the distributions
 * actively exported from src/dist/index.js and the processes exported from
 * src/process/index.js.
 *
 * Catches:
 *   - New entry added to a source index but subpath entry missing from package.json
 *   - Subpath entry in package.json pointing to a source no longer exported
 *
 * The same regex used in rollup.config.js to select entries for per-file
 * builds is used here, so the check validates both artefacts stay aligned.
 */

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

// Shared regex: matches uncommented exports, excludes underscore-prefixed files
const EXPORT_RE = /^export.*from '\.\/([a-z0-9][a-z0-9-]*)'/gm

function checkGroup (label, srcFile, pkgPrefix) {
  const src = fs.readFileSync(path.join(root, srcFile), 'utf8')
  const fromIndex = new Set([...src.matchAll(EXPORT_RE)].map(m => m[1]))

  const fromExports = new Set(
    Object.keys(pkg.exports)
      .filter(k => k.startsWith(pkgPrefix) && k !== pkgPrefix.replace(/\/$/, ''))
      .map(k => k.replace(pkgPrefix, ''))
  )

  let ok = true

  for (const name of fromIndex) {
    if (!fromExports.has(name)) {
      console.error(`MISSING subpath export: "${pkgPrefix}${name}" not in package.json exports`)
      ok = false
    }
  }

  for (const name of fromExports) {
    if (!fromIndex.has(name)) {
      console.error(`STALE subpath export: "${pkgPrefix}${name}" in package.json but not in ${srcFile}`)
      ok = false
    }
  }

  if (ok) {
    console.log(`OK: ${fromIndex.size} ${label} subpath exports in sync with ${srcFile}`)
  }

  return ok
}

const ok = [
  checkGroup('distribution', 'src/dist/index.js', './dist/'),
  checkGroup('process', 'src/process/index.js', './process/')
].every(Boolean)

process.exit(ok ? 0 : 1)
