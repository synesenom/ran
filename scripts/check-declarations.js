#!/usr/bin/env node
/**
 * Verifies dist/ranjs.d.ts declares every export from ranjs source.
 *
 * Catches:
 *   - New distributions added to src/dist/index.js but missing from .d.ts
 *   - Functions added to a namespace index but missing from the .d.ts namespace block
 *   - Classes declared in .d.ts that no longer exist in source (stale)
 *
 * Does NOT catch: behavioral drift (wrong parameter or return types). That
 * requires either JSDoc-driven tsc --declaration or a TypeScript source migration.
 */

const fs = require('fs')

let exitCode = 0

function fail (msg) {
  console.error(`  MISSING: ${msg}`)
  exitCode = 1
}

const dts = fs.readFileSync('dist/ranjs.d.ts', 'utf8')

// Returns the full text of `export namespace <ns> { ... }` using bracket counting.
function extractNamespaceBlock (ns) {
  const marker = `export namespace ${ns} {`
  const start = dts.indexOf(marker)
  if (start === -1) return null
  let depth = 0
  for (let pos = start; pos < dts.length; pos++) {
    if (dts[pos] === '{') depth++
    else if (dts[pos] === '}') {
      depth--
      if (depth === 0) return dts.slice(start, pos + 1)
    }
  }
  return null
}

// ---- 1. Distribution classes ------------------------------------------------

console.log('Checking dist classes...')

const distSrc = fs.readFileSync('src/dist/index.js', 'utf8')
const srcClasses = new Set(
  [...distSrc.matchAll(/^export\s*\{\s*default\s+as\s+(\w+)\s*\}/gm)]
    .map(m => m[1])
)

const dtsClasses = new Set(
  [...dts.matchAll(/\bclass\s+(\w+)\s+extends\s+Distribution\b/g)]
    .map(m => m[1])
)

for (const name of srcClasses) {
  if (!dtsClasses.has(name)) fail(`dist.${name} — exported from source but missing from .d.ts`)
}
for (const name of dtsClasses) {
  if (!srcClasses.has(name)) fail(`dist.${name} — declared in .d.ts but not exported from source`)
}
if (srcClasses.size === dtsClasses.size && exitCode === 0) {
  console.log(`  OK: ${srcClasses.size} distribution classes`)
}

// ---- 2. core namespace (named exports, not re-exports) ----------------------

console.log('Checking core namespace...')

const coreSrc = fs.readFileSync('src/core/index.js', 'utf8')
const coreNames = new Set([
  ...[...coreSrc.matchAll(/^export\s+(?:const|function)\s+(\w+)/gm)].map(m => m[1])
])

const coreBlock = extractNamespaceBlock('core')
if (!coreBlock) {
  fail('export namespace core is missing from dist/ranjs.d.ts')
} else {
  const dtsCoreNames = new Set(
    [...coreBlock.matchAll(/\bfunction\s+(\w+)/g)].map(m => m[1])
  )
  for (const name of coreNames) {
    if (!dtsCoreNames.has(name)) fail(`core.${name} — in source but missing from .d.ts`)
  }
  if (exitCode === 0) console.log(`  OK: ${coreNames.size} core exports`)
}

// ---- 3. Statistical namespaces (re-export style) ----------------------------

const namespaceSources = {
  location: 'src/location/index.js',
  dispersion: 'src/dispersion/index.js',
  shape: 'src/shape/index.js',
  dependence: 'src/dependence/index.js',
  test: 'src/test/index.js'
}

for (const [ns, srcFile] of Object.entries(namespaceSources)) {
  console.log(`Checking ${ns} namespace...`)
  const srcContent = fs.readFileSync(srcFile, 'utf8')

  // Handles both: `export { default as name }` and `export { name }`
  const srcNames = new Set(
    [...srcContent.matchAll(/^export\s*\{[^}]*\}/gm)]
      .flatMap(m => [...m[0].matchAll(/(?:default\s+as\s+|(?<![a-z]\s))(\b\w+\b)(?=\s*[,}])/g)])
      .map(m => m[1])
      .filter(name => name !== 'default')
  )

  const block = extractNamespaceBlock(ns)
  if (!block) {
    fail(`export namespace ${ns} is missing from dist/ranjs.d.ts`)
    continue
  }

  const dtsFunctions = new Set(
    [...block.matchAll(/\bfunction\s+(\w+)/g)].map(m => m[1])
  )

  for (const name of srcNames) {
    if (!dtsFunctions.has(name)) fail(`${ns}.${name} — in source but missing from .d.ts`)
  }
  if (exitCode === 0) console.log(`  OK: ${srcNames.size} ${ns} exports`)
}

process.exit(exitCode)
