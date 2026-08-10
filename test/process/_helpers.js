import { assert } from 'chai'

// Fixed seeds replace ksTest/chiTest significance-level checks: a random seed can produce
// a false positive/negative at the chosen critical value on some runs, while a fixed seed
// deterministically reproduces the same sample every run.
export const MOMENT_SEEDS = [0, 42, 12345]

// Sample mean/variance are compared against an exact closed-form derived independently from
// each process's SDE/update rule — never against the process's own mean()/variance() methods,
// which would make the test a tautology against the code under test (decisions: never write
// the same formula in both the production method and the test assertion). The comparison uses
// a CLT-derived tolerance: SE(mean) = sqrt(variance/n), and SE(variance) ≈ variance*sqrt(2/(n-1))
// (exact for Gaussian data, a reasonable order-of-magnitude bound for the Poisson/Bernoulli/
// Gamma-like samples used elsewhere in this file). K standard errors keeps false failures
// negligible at all three fixed seeds.
export const K_SIGMA = 8

export function assertSampleMoments (sample, expectedMean, expectedVariance, seed) {
  const n = sample.length
  const mean = sample.reduce((a, b) => a + b, 0) / n
  const variance = sample.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1)
  const tolMean = K_SIGMA * Math.sqrt(expectedVariance / n)
  const tolVariance = K_SIGMA * expectedVariance * Math.sqrt(2 / (n - 1))
  assert.closeTo(mean, expectedMean, tolMean, `seed ${seed}: sample mean ${mean} vs expected ${expectedMean}`)
  assert.closeTo(variance, expectedVariance, tolVariance, `seed ${seed}: sample variance ${variance} vs expected ${expectedVariance}`)
}

// Draws n single-step samples from a continuously evolving path, transforming each
// (newState, prevState) pair. Relies on the step distribution being stationary and
// independent of the current state (true for all processes this helper is used with).
export function sampleSteps (proc, n, transform = (curr, prev) => curr - prev) {
  const samples = []
  for (let i = 0; i < n; i++) {
    const prev = proc.state()
    proc.next()
    samples.push(transform(proc.state(), prev))
  }
  return samples
}

// Draws n independent single-step samples from x0, resetting between draws. Needed
// whenever the step distribution depends on the current state (e.g. a time-indexed bridge).
export function sampleResetSteps (proc, n) {
  const samples = []
  for (let i = 0; i < n; i++) {
    proc.reset()
    proc.next()
    samples.push(proc.state())
  }
  return samples
}

// Counts Math.log() invocations during fn(), then restores the original — used to verify a
// precomputed log constant (e.g. this.c.logNoise) isn't being recomputed on every call in a
// process's _transitionLnPdf hot path.
export function countLogCalls (fn) {
  const originalLog = Math.log
  let calls = 0
  Math.log = (x) => {
    calls++
    return originalLog(x)
  }
  try {
    fn()
  } finally {
    Math.log = originalLog
  }
  return calls
}

// Asserts the mean per-step transition log-density of a Gaussian-transition process (BM, OU)
// matches its known theoretical expectation within a CLT tolerance. Each step's residual
// z = (x_{i+1}-mean)/scale is exactly N(0,1) by construction (_next() draws it directly), so
// E[-0.5*z^2] = -0.5 exactly and Var(z^2) = 2, giving Var(mean of n such terms) = 1/(2n).
export function assertMeanPerStepLnLMatchesGaussianTransition (proc, path, scale) {
  const n = path.length - 1
  const expectedMean = -0.5 - Math.log(scale) - 0.5 * Math.log(2 * Math.PI)
  const tol = K_SIGMA * Math.sqrt(1 / (2 * n))
  assert.closeTo(proc.lnL(path) / n, expectedMean, tol)
}

// Deprecated-alias tests construct through a console.warn-emitting constructor; both silencing
// it and capturing its message need the same save/restore-on-throw bracketing around the call.
export function withSuppressedWarnings (fn) {
  const originalWarn = console.warn
  console.warn = () => {}
  try {
    return fn()
  } finally {
    console.warn = originalWarn
  }
}

export function captureWarnings (fn) {
  const warnings = []
  const originalWarn = console.warn
  console.warn = msg => warnings.push(msg)
  try {
    fn()
  } finally {
    console.warn = originalWarn
  }
  return warnings
}
