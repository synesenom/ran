// Finds the minimum sample size at which the GoF test still passes for each distribution.
//
// For each distribution it steps down from MAX_SIZE to MIN_SIZE in steps of STEP.
// At each size it runs REPS independent trials (different seeds). The moment any
// trial fails it records (name, failing_size) to the CSV and moves on to the next
// distribution. Distributions that pass all the way down to MIN_SIZE are recorded
// with sample_size=0 as a sentinel.
//
// The script is resumable: on startup it reads the CSV (if it exists) and skips any
// distribution that already has a row. Each result is appended immediately, so an
// interrupted run can be continued without losing progress.
//
// Usage:
//   node --require @babel/register scripts/gof-sample-size-search.js

import fs from 'fs'
import path from 'path'
import * as dist from '../src/dist'
import continuousCases from '../test/dist-cases-continuous'
import discreteCases from '../test/dist-cases-discrete'
import { adTest, chiTest } from '../test/test-utils'

const REPS = 100
const MAX_SIZE = 10000
const STEP = 1000
const MIN_SIZE = 1000
// Matches the alpha used in the production GoF test (dist.js).
const AD_ALPHA = 0.001

// __dirname is available because @babel/register transpiles ES modules to CJS.
const OUTPUT_PATH = path.join(__dirname, 'gof-min-sample-size.csv')

// Read already-processed distribution names from the CSV so we can resume.
function loadDone () {
  if (!fs.existsSync(OUTPUT_PATH)) return new Set()
  return new Set(
    fs.readFileSync(OUTPUT_PATH, 'utf8')
      .split('\n')
      .slice(1) // skip header
      .filter(line => line.trim().length > 0)
      .map(line => line.split(',')[0])
  )
}

// Append a single result row; writes the header first if the file is new.
function appendRow (name, sampleSize) {
  if (!fs.existsSync(OUTPUT_PATH)) {
    fs.writeFileSync(OUTPUT_PATH, 'distribution,sample_size\n')
  }
  fs.appendFileSync(OUTPUT_PATH, `${name},${sampleSize}\n`)
}

// Returns false if ANY of the distribution's parameter cases fails the GoF test at
// sample size n with the given seed.
function trialPasses (tc, n, seed) {
  const cases = (tc.sampleParams ?? tc.cases).map(c => ({
    generate: () => new dist[tc.name](...c.params())
  }))

  for (const c of cases) {
    const generator = c.generate()
    generator.seed(seed)
    const sample = generator.sample(n)
    const passed = generator.type() === 'continuous'
      ? adTest(sample, x => generator.cdf(x), AD_ALPHA)
      : chiTest(sample, x => generator.pdf(x), 0)
    if (!passed) return false
  }
  return true
}

const testCases = [...continuousCases, ...discreteCases]
const done = loadDone()

for (const tc of testCases) {
  if (done.has(tc.name)) {
    console.log(`${tc.name} → skipped (already done)`)
    continue
  }

  process.stdout.write(`${tc.name}`)
  let failSize = null

  for (let n = MAX_SIZE; n >= MIN_SIZE; n -= STEP) {
    let anyFailed = false

    for (let rep = 0; rep < REPS; rep++) {
      if (!trialPasses(tc, n, rep)) {
        anyFailed = true
        break
      }
    }

    if (anyFailed) {
      failSize = n
      process.stdout.write(` → first failure at n=${n}\n`)
      appendRow(tc.name, failSize)
      break
    }

    process.stdout.write(` ${n}`)
  }

  if (failSize === null) {
    process.stdout.write(` → passed all\n`)
    // 0 is a sentinel meaning "passed all sizes down to MIN_SIZE".
    appendRow(tc.name, 0)
  }
}

console.log(`\nResults written to ${OUTPUT_PATH}`)
