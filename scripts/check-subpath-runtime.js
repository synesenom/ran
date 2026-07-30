#!/usr/bin/env node
/**
 * Smoke-tests built minified subpath ESM bundles (dist/*.esm.js,
 * dist/process/*.esm.js, dist/mc/*.esm.js) by actually importing and running
 * a representative module from each of the three categories.
 *
 * Why this exists (#1227): npm test only ever exercises src/, so a terser
 * option change (e.g. mangle.properties, compress.pure_funcs) could silently
 * break a built subpath bundle — renaming a class at runtime or corrupting a
 * computed value — without any test noticing. This check would have caught a
 * regression of the keep_classnames fix in #1220.
 */

const path = require('path')
const { pathToFileURL } = require('url')

const root = path.join(__dirname, '..')

function importDist (relPath) {
  return import(pathToFileURL(path.join(root, 'dist', relPath)).href)
}

function assertClose (actual, expected, label) {
  if (Math.abs(actual - expected) > 1e-9) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`)
  }
}

function assertEqual (actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`)
  }
}

function assertClassName (instance, expected, label) {
  assertEqual(instance.constructor.name, expected, `${label} constructor.name`)
}

const CHECKS = [
  {
    category: 'distribution',
    file: 'beta.esm.js',
    label: 'Beta',
    run: Beta => {
      const beta = new Beta(0.5, 0.5)
      assertClassName(beta, 'Beta', 'Beta')
      // mpmath dps=50 (same reference as the 'near-zero shapes' case in test/dist-cases-continuous.js): pdf=1/(pi*sqrt(x(1-x))), cdf=2/pi*asin(sqrt(x))
      assertClose(beta.pdf(0.5), 0.6366197723675814, 'Beta.pdf(0.5)')
      assertClose(beta.cdf(0.5), 0.5, 'Beta.cdf(0.5)')
    }
  },
  {
    category: 'distribution',
    file: 'poisson.esm.js',
    label: 'Poisson',
    run: Poisson => {
      const poisson = new Poisson(10)
      assertClassName(poisson, 'Poisson', 'Poisson')
      // scipy.stats.poisson(10) (same reference as test/dist-cases-discrete.js Poisson refVals)
      assertClose(poisson.pdf(10), 0.12511003572113372, 'Poisson.pdf(10)')
      assertClose(poisson.cdf(10), 0.5830397501929852, 'Poisson.cdf(10)')
    }
  },
  {
    category: 'process',
    file: 'process/brownian-motion.esm.js',
    label: 'BrownianMotion',
    run: BrownianMotion => {
      const bm = new BrownianMotion(0, 1, 1)
      assertClassName(bm, 'BrownianMotion', 'BrownianMotion')
      // exact formula: BrownianMotion(0, 1, 1).pdf(0, 1) is the standard normal density at 0, 1/sqrt(2*pi)
      assertClose(bm.pdf(0, 1), 1 / Math.sqrt(2 * Math.PI), 'BrownianMotion.pdf(0, 1)')
    }
  },
  {
    category: 'mc',
    file: 'mc/rwm.esm.js',
    label: 'RWM',
    run: RWM => {
      const rwm = new RWM({ logDensity: x => -0.5 * x[0] * x[0] })
      assertClassName(rwm, 'RWM', 'RWM')
      // Skips warmUp() (expensive) — a smoke test only needs to confirm sample() shape, not mixing
      const samples = rwm.sample(null, 5)
      assertEqual(samples.length, 5, 'RWM.sample() length')
      assertEqual(samples[0].length, 1, 'RWM.sample()[0] dimensionality')
    }
  }
]

async function main () {
  let failed = false
  for (const check of CHECKS) {
    try {
      const mod = await importDist(check.file)
      check.run(mod.default)
      console.log(`OK: dist/${check.file} (${check.category}, ${check.label})`)
    } catch (err) {
      failed = true
      console.error(`FAILED: dist/${check.file} (${check.category}, ${check.label}) — ${err.message}`)
    }
  }
  process.exit(failed ? 1 : 0)
}

main()
