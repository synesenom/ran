// Smoke test: verify all three build artifacts exist and expose the correct API.
// Run after `npm run build` — not part of the mocha suite.
import { createRequire } from 'module'
import assert from 'assert'

const require = createRequire(import.meta.url)

// ESM artifact — verify all seven namespaces load and core constructors work
const esm = await import('../dist/ranjs.esm.js')
assert.strictEqual(typeof esm.dist, 'object', 'ESM: dist namespace missing')
assert.strictEqual(typeof esm.core, 'object', 'ESM: core namespace missing')
assert.strictEqual(typeof esm.location, 'object', 'ESM: location namespace missing')
assert.strictEqual(typeof esm.dispersion, 'object', 'ESM: dispersion namespace missing')
assert.strictEqual(typeof esm.shape, 'object', 'ESM: shape namespace missing')
assert.strictEqual(typeof esm.dependence, 'object', 'ESM: dependence namespace missing')
assert.strictEqual(typeof esm.test, 'object', 'ESM: test namespace missing')
const esmNormal = new esm.dist.Normal(0, 1)
assert.ok(Math.abs(esmNormal.pdf(0) - 0.3989422804014327) < 1e-9, 'ESM: Normal.pdf(0) must match standard Gaussian')
assert.strictEqual(esm.default, undefined, 'ESM: must not have accidental .default wrapper')

// CJS artifact — verify all seven namespaces and a working constructor
const ran = require('../dist/ranjs.cjs.js')
assert.strictEqual(typeof ran.dist, 'object', 'CJS: dist namespace missing')
assert.strictEqual(typeof ran.core, 'object', 'CJS: core namespace missing')
assert.strictEqual(typeof ran.location, 'object', 'CJS: location namespace missing')
assert.strictEqual(typeof ran.dispersion, 'object', 'CJS: dispersion namespace missing')
assert.strictEqual(typeof ran.shape, 'object', 'CJS: shape namespace missing')
assert.strictEqual(typeof ran.dependence, 'object', 'CJS: dependence namespace missing')
assert.strictEqual(typeof ran.test, 'object', 'CJS: test namespace missing')
const cjsNormal = new ran.dist.Normal(0, 1)
assert.ok(Math.abs(cjsNormal.pdf(0) - 0.3989422804014327) < 1e-9, 'CJS: Normal.pdf(0) must match standard Gaussian')

// UMD artifact — load and verify it exposes the expected API
const umd = require('../dist/ranjs.min.js')
assert.strictEqual(typeof umd.dist, 'object', 'UMD: dist namespace missing')
const umdNormal = new umd.dist.Normal(0, 1)
assert.ok(Math.abs(umdNormal.pdf(0) - 0.3989422804014327) < 1e-9, 'UMD: Normal.pdf(0) must match standard Gaussian')

console.log('Smoke tests passed: ESM, CJS, UMD all OK')
