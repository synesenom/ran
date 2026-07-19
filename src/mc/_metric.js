import MCMC from './_mcmc'
import Matrix from '../la/matrix'

// Shared Euclidean mass-matrix ("metric") machinery for the gradient samplers HMC and NUTS. Both
// adapt a diagonal or dense metric during warm-up with byte-for-byte identical accumulator, refresh,
// momentum-sampling, and validation logic; this module is the single source of truth for it.
// See decisions/0036-shared-metric-module.md — extracted from the per-sampler duplicates ADR-0029
// (HMC) and ADR-0034 (NUTS) deliberately deferred.
//
// The state is a plain object (never a class holding a Matrix/Vector field): storing a ran.la.Matrix
// instance as a field on any class reachable from src/index.js leaks an unresolvable `ran.la.Matrix`
// type into the generated .d.ts — refreshMetric() therefore builds its Matrix as a method-body local
// and extracts plain arrays. See solutions/tooling/2026-07-15-1330-adaptive-metropolis-ran-la-matrix-dts-leak.md

// Regularization added to the estimated metric (variance or covariance) before it is used, matching
// AdaptiveMetropolis's EPS*I convention: keeps the diagonal variance away from exactly zero and keeps
// ldl() -- which has no pivoting or singularity guard -- from hitting a non-positive pivot while the
// dense covariance accumulator is still rank deficient.
export const EPS = 1e-6

// A dense metric's covariance accumulator and LDL factor are both dim*dim -- MCMC's own
// _validateCombinedFootprint only bounds dim*maxLag (the autocorrelation buffers), so it does not
// itself catch a dense-metric blowup at MCMC._MAX_DIM = 10000 (~800MB). See
// decisions/0029-hmc-euclidean-metric-adaptation.md.
export const MAX_DENSE_METRIC_DIM = 1000

// Matrix.ldl() is O(dim^3); refreshing the dense metric every iteration (as the diagonal case and
// AdaptiveMetropolis both do cheaply) would make dense warm-up cost scale with O(dim^3) *
// iterations. This interval is a fixed, non-configurable constant, deliberately decoupled from
// MCMC.warmUp()'s own internal batch size so a future change to one cannot silently change the
// other's behavior. See decisions/0029-hmc-euclidean-metric-adaptation.md.
export const DENSE_METRIC_REFRESH_INTERVAL = 1000

// ─── STATE CONSTRUCTION ───

// Builds the metric state bag: the online (Welford) accumulator plus the effective, ready-to-use
// metric consulted by sampleMomentum/applyInverseMetric. `resumedMetric`/`resumedAccumulator`
// (decisions/0035-mcmc-exact-stream-reproducible-resume.md) restore a mid-warm-up chain so its next
// refresh reads the same history the uninterrupted chain would have; nested arrays are deep-copied so
// the live state never aliases a caller-held snapshot's rows. Field names match the external snapshot
// keys (metN/metMean/metM2/metCovS/metL/metD/metVar) so serialization needs no name mapping.
export function createMetricState ({ type, dim, resumedMetric, resumedAccumulator }) {
  const met = { type, dim }
  initAccumulator(met, resumedAccumulator)
  initEffectiveMetric(met, resumedMetric)
  return met
}

// Deliberately not reusing MCMC's own _welford accumulator (contractual per
// decisions/0023-mcmc-accumulator-mechanics.md and tracking a different lifecycle), mirroring
// AdaptiveMetropolis building its own _covMean/_covS instead of reaching into the base class.
function initAccumulator (met, resumed) {
  met.metN = MCMC._resolveResumedField(resumed, 'metN', 0)
  met.metMean = MCMC._resolveResumedField(resumed, 'metMean', new Array(met.dim).fill(0)).slice()
  if (met.type === 'dense') {
    met.metCovS = MCMC._resolveResumedField(
      resumed, 'metCovS', Array.from({ length: met.dim }, () => new Array(met.dim).fill(0))
    ).map(row => row.slice())
    met.metDelta = new Array(met.dim).fill(0)
    met.metDelta2 = new Array(met.dim).fill(0)
    met.zBuffer = new Array(met.dim).fill(0)
  } else {
    met.metM2 = MCMC._resolveResumedField(resumed, 'metM2', new Array(met.dim).fill(0)).slice()
  }
}

// Seeded from a resumed state or the identity default -- kept separate from the accumulator so a
// resumed sampler uses its adapted metric immediately without waiting for metN to re-cross the
// refresh gate.
function initEffectiveMetric (met, resumedMetric) {
  if (met.type === 'dense') {
    met.metL = resumedMetric ? resumedMetric.L.map(row => row.slice()) : identityRows(met.dim)
    met.metD = resumedMetric ? resumedMetric.D.slice() : new Array(met.dim).fill(1)
  } else {
    met.metVar = resumedMetric ? resumedMetric.variance.slice() : new Array(met.dim).fill(1)
  }
}

// ─── ACCUMULATOR + REFRESH ───

// Online (Welford-style) update of the metric accumulator, fed the post-accept/reject state per the
// samplers' _adjust contract.
export function updateAccumulator (met, x) {
  met.metN++
  if (met.type === 'dense') {
    updateDense(met, x)
  } else {
    updateDiag(met, x)
  }
}

function updateDiag (met, x) {
  const n = met.metN
  for (let i = 0; i < met.dim; i++) {
    const delta = x[i] - met.metMean[i]
    met.metMean[i] += delta / n
    met.metM2[i] += delta * (x[i] - met.metMean[i])
  }
}

function updateDense (met, x) {
  const n = met.metN
  const delta = met.metDelta
  const delta2 = met.metDelta2
  for (let i = 0; i < met.dim; i++) {
    delta[i] = x[i] - met.metMean[i]
  }
  for (let i = 0; i < met.dim; i++) {
    met.metMean[i] += delta[i] / n
  }
  for (let i = 0; i < met.dim; i++) {
    delta2[i] = x[i] - met.metMean[i]
  }
  for (let i = 0; i < met.dim; i++) {
    for (let j = 0; j < met.dim; j++) {
      met.metCovS[i][j] += delta[i] * delta2[j]
    }
  }
}

// Refactorizes the effective metric from the accumulator. Diagonal: elementwise sample variance +
// EPS, no factorization needed. Dense: Cov(x) + EPS*I via a transient Matrix, decomposed via ldl()
// and extracted to plain arrays -- the Matrix instance never becomes a field (see the .d.ts note atop
// this file).
export function refreshMetric (met) {
  if (met.type === 'dense') {
    const cov = new Matrix(met.metCovS).scale(1 / (met.metN - 1)).add(new Matrix(met.dim).scale(EPS))
    const { D, L } = cov.ldl()
    met.metL = L.m()
    met.metD = Array.from({ length: met.dim }, (_, i) => D.ij(i, i))
  } else {
    met.metVar = met.metM2.map(m2 => m2 / (met.metN - 1) + EPS)
  }
}

// ─── MOMENTUM / METRIC APPLICATION ───

// Draws momentum p ~ N(0, M). The mass matrix is the *precision*, M = Sigma^-1, where Sigma is the
// estimated covariance/variance (decisions/0029-hmc-euclidean-metric-adaptation.md): a LARGER
// estimated variance means a MORE CONCENTRATED momentum distribution, so the metric compensates for
// wide target directions. Diagonal: elementwise. Dense: Sigma = L*D*L^T (from ldl()), and
// p ~ N(0, Sigma^-1) is drawn as p solving L^T*p = z/sqrt(D) via back substitution. For the identity
// default (variance all ones) this draws q.sample()/sqrt(1) in the same order as the pre-metric
// sampler, keeping behavior bitwise-identical. `q` is the sampler's Normal(0,1) instance, passed in
// rather than stored, so no dist instance becomes a field of the state bag.
// M and M^-1 are easy to swap here -- see solutions/correctness/2026-07-16-1422-hmc-mass-matrix-precision-inversion.md
export function sampleMomentum (met, q) {
  if (met.type === 'dense') {
    for (let i = 0; i < met.dim; i++) {
      met.zBuffer[i] = q.sample()
    }
    const u = met.zBuffer.map((z, i) => z / Math.sqrt(met.metD[i]))
    return backSubstituteTranspose(met.metL, u)
  }
  return Array.from({ length: met.dim }, (_, i) => q.sample() / Math.sqrt(met.metVar[i]))
}

// Computes M^-1 * p (the velocity), needed for the leapfrog position update, the kinetic energy, and
// (in NUTS) the no-U-turn check. Since M = Sigma^-1 (the precision), M^-1 * p = Sigma * p directly --
// the estimated covariance applied to p, not its inverse. Diagonal: elementwise multiplication.
// Dense: Sigma * p = L*D*L^T*p, computed as three plain matrix-vector products (no solve needed here
// -- only momentum sampling above needs a substitution, since it draws from the *precision*).
export function applyInverseMetric (met, p) {
  if (met.type === 'dense') {
    const L = met.metL
    const n = met.dim
    // v = L^T * p
    const v = new Array(n).fill(0)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        v[j] += L[i][j] * p[i]
      }
    }
    // w = D * v
    const w = v.map((vi, i) => vi * met.metD[i])
    // result = L * w
    return L.map(row => row.reduce((s, lij, j) => s + lij * w[j], 0))
  }
  return p.map((pi, i) => pi * met.metVar[i])
}

// Kinetic energy K(p) = 1/2 * p^T * M^-1 * p.
export function kineticEnergy (met, p) {
  const mInvP = applyInverseMetric(met, p)
  return 0.5 * p.reduce((s, pi, i) => s + pi * mInvP[i], 0)
}

// ─── SERIALIZATION ───

// The effective, ready-to-use metric -- restoration uses this directly so a resumed sampler's
// momentum draws are correctly scaled even before the accumulator (below) next crosses its own
// refresh gate.
export function snapshotMetric (met) {
  return met.type === 'dense'
    ? { type: 'dense', L: met.metL.map(row => row.slice()), D: met.metD.slice() }
    : { type: 'diag', variance: met.metVar.slice() }
}

// Raw mass-matrix accumulator (distinct from the effective metric above) -- see
// decisions/0035-mcmc-exact-stream-reproducible-resume.md.
export function snapshotAccumulator (met) {
  return met.type === 'dense'
    ? { metN: met.metN, metMean: met.metMean.slice(), metCovS: met.metCovS.map(row => row.slice()) }
    : { metN: met.metN, metMean: met.metMean.slice(), metM2: met.metM2.slice() }
}

// ─── VALIDATORS ───
// Each takes `name` ('HMC'/'NUTS') so the thrown-error prefix matches the caller verbatim; the tests
// assert on the prefixed strings. Kept as functions (not sampler methods) to avoid a Complex
// Conditional / Complex Method smell in the constructors that call them.

export function validateMetric (name, metric) {
  if (metric === undefined) {
    return
  }
  if (metric !== 'diag' && metric !== 'dense') {
    throw Error(`${name}: metric must be 'diag' or 'dense'`)
  }
}

export function validateDenseMetricDim (name, metricType, dim) {
  if (metricType === 'dense' && dim > MAX_DENSE_METRIC_DIM) {
    throw Error(`${name}: metric: 'dense' requires dim to be at most ${MAX_DENSE_METRIC_DIM}`)
  }
}

// A resumed initialState.internal.metric is caller-supplied the same way config is -- see
// solutions/correctness/2026-07-15-1230-hmc-resumed-internal-state-validation-gap.md.
export function validateResumedMetric (name, metric, metricType, dim) {
  if (metric === undefined) {
    return
  }
  if (metric.type !== metricType) {
    throw Error(`${name}: resumed metric type does not match the resolved metric`)
  }
  if (metricType === 'dense') {
    validateResumedDenseMetric(name, metric, dim)
  } else {
    validateResumedDiagMetric(name, metric, dim)
  }
}

function validateResumedDiagMetric (name, metric, dim) {
  if (!isPositiveFiniteVector(metric.variance, dim)) {
    throw Error(`${name}: resumed metric.variance must be an array of dim positive finite numbers`)
  }
}

function validateResumedDenseMetric (name, metric, dim) {
  if (!isPositiveFiniteVector(metric.D, dim)) {
    throw Error(`${name}: resumed metric.D must be an array of dim positive finite numbers`)
  }
  if (!isFiniteMatrix(metric.L, dim)) {
    throw Error(`${name}: resumed metric.L must be a dim x dim array of finite numbers`)
  }
}

// A resumed initialState.internal.metAccumulator is caller-supplied the same way metric is above.
export function validateResumedMetricAccumulator (name, resumed, metricType, dim) {
  if (resumed === undefined) {
    return
  }
  MCMC._validateNonNegativeInteger(resumed.metN, `${name}: resumed metAccumulator.metN`)
  MCMC._validateFiniteVector(resumed.metMean, dim, `${name}: resumed metAccumulator.metMean`)
  if (metricType === 'dense') {
    MCMC._validateFiniteMatrix(resumed.metCovS, dim, `${name}: resumed metAccumulator.metCovS`)
  } else {
    MCMC._validateFiniteVector(resumed.metM2, dim, `${name}: resumed metAccumulator.metM2`)
  }
}

// ─── UTILITIES ───

function isFiniteVector (arr, length) {
  return Array.isArray(arr) && arr.length === length && arr.every(Number.isFinite)
}

function isPositiveFiniteVector (arr, length) {
  return isFiniteVector(arr, length) && arr.every(v => v > 0)
}

function isFiniteMatrix (rows, dim) {
  return Array.isArray(rows) && rows.length === dim && rows.every(row => isFiniteVector(row, dim))
}

// Dense metric's identity default (no observations yet to base a covariance estimate on).
function identityRows (dim) {
  return Array.from({ length: dim }, (_, i) => Array.from({ length: dim }, (_, j) => (i === j ? 1 : 0)))
}

// Solves L^T*y = v for y, where L is unit lower triangular so L^T is unit upper triangular
// (L^T[i][j] = L[j][i]).
function backSubstituteTranspose (L, v) {
  const n = v.length
  const y = new Array(n)
  for (let i = n - 1; i >= 0; i--) {
    let s = v[i]
    for (let j = i + 1; j < n; j++) {
      s -= L[j][i] * y[j]
    }
    y[i] = s
  }
  return y
}
