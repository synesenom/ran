import * as index from './index'
import { cv, vmr } from '../dispersion'
import { skewness } from '../shape'
import { andersonDarling, chi2 } from './_tests'
import {
  SYMMETRIC,
  POSITIVE_SKEW_ONLY,
  CV_ONE_FAMILY,
  POISSON_LIKE,
  NEGATIVE_BINOMIAL_LIKE
} from './_guess-meta'

// Reads `index` (this module's own barrel, which re-exports guess() itself) only inside
// the function body — never at module top level — so the circular import between
// guess.js and index.js resolves safely: by the time a caller invokes guess(), the whole
// module graph has already finished evaluating.
function _defaultCandidates () {
  return Object.entries(index)
    .filter(([name]) => name !== 'guess')
    .map(([, Cls]) => Cls)
}

// Mirrors fit()'s own first step (see decisions/0016-distribution-fit-powell-and-exact-mle.md)
// to read a candidate's type()/k/support() before running the expensive fit() call, without
// needing arbitrary "default" constructor arguments. _fitInit is expected to be a cheap
// moment-based/closed-form calculation, so the redundant call fit() makes later is
// negligible next to Powell's cost.
// solutions/distribution/2026-07-20-2359-guess-probe-instance-pre-fit-introspection.md
function _buildProbe (Cls, data) {
  try {
    return new Cls(...Cls._fitInit(data))
  } catch (e) {
    return null
  }
}

function _withinSupport (probe, xmin, xmax) {
  const [lo, hi] = probe.support()
  if (xmin < lo.value || (xmin === lo.value && !lo.closed)) return false
  if (xmax > hi.value || (xmax === hi.value && !hi.closed)) return false
  return true
}

// Asymmetric by design: a positive-skew-only family is only ruled out by strongly
// *negative* sample skewness, not by symmetric or already-positive sample skewness.
function _skewnessFilterFails (name, skew, threshold) {
  if (SYMMETRIC.has(name) && Math.abs(skew) > threshold) return true
  return POSITIVE_SKEW_ONLY.has(name) && skew < -threshold
}

// cvValue is NaN for non-positive-mean data; NaN comparisons are always false, so this
// filter naturally never triggers on data for which it isn't meaningful.
function _cvFilterFails (name, cvValue, isDiscrete) {
  if (isDiscrete || !CV_ONE_FAMILY.has(name)) return false
  return cvValue < 0.1 || cvValue > 10
}

// Same NaN-safe guard as _cvFilterFails, via vmrValue.
function _dispersionFilterFails (name, vmrValue, isDiscrete) {
  if (!isDiscrete) return false
  if (POISSON_LIKE.has(name) && vmrValue > 3) return true
  return NEGATIVE_BINOMIAL_LIKE.has(name) && vmrValue < 0.5
}

// Soft filters are statistically-principled pruning heuristics, not correctness guards:
// a family absent from every _guess-meta.js set simply receives no soft filter, and an
// incompatible family that slips through still gets caught by its BIC weight/p-value.
// Takes the pre-computed data context (rather than recomputing skewness/cv/vmr per
// candidate) since these are properties of the data, not of the candidate.
function _passesSoftFilters (name, context) {
  const { isDiscrete, skew, skewnessThreshold, cvValue, vmrValue } = context
  if (_skewnessFilterFails(name, skew, skewnessThreshold)) return false
  if (_cvFilterFails(name, cvValue, isDiscrete)) return false
  return !_dispersionFilterFails(name, vmrValue, isDiscrete)
}

function _dataContext (data) {
  return {
    isDiscrete: data.every(Number.isInteger),
    xmin: Math.min(...data),
    xmax: Math.max(...data),
    skew: skewness(data),
    skewnessThreshold: 2 * Math.sqrt(6 / data.length),
    cvValue: cv(data),
    vmrValue: vmr(data)
  }
}

function _survivingCandidates (pool, data, context) {
  const { isDiscrete, xmin, xmax } = context
  const survivors = []
  pool.forEach(Cls => {
    const probe = _buildProbe(Cls, data)
    if (!probe) return
    if (probe.type() !== (isDiscrete ? 'discrete' : 'continuous')) return
    if (!_withinSupport(probe, xmin, xmax)) return
    if (!_passesSoftFilters(Cls.name, context)) return
    survivors.push({ Cls, probe })
  })
  return survivors
}

function _fitSurvivors (survivors, data, isDiscrete) {
  const fitted = []
  survivors.forEach(({ Cls }) => {
    try {
      const inst = Cls.fit(data)
      const bic = inst.bic(data)
      const pValue = isDiscrete
        ? chi2(data, x => inst.pdf(x), inst.k).pValue
        : andersonDarling(data, x => inst.cdf(x)).pValue
      fitted.push({ name: Cls.name, params: inst.params(), bic, pValue })
    } catch (e) {
      // fit() itself never signals a bad candidate (decisions/0016) — this is the actual
      // "candidate didn't work out" signal guess() relies on, so it is skipped, not thrown.
    }
  })
  return fitted
}

function _rankByBicWeight (fitted) {
  const minBic = Math.min(...fitted.map(f => f.bic))
  const weights = fitted.map(f => Math.exp(-0.5 * (f.bic - minBic)))
  const sumWeights = weights.reduce((a, b) => a + b, 0)

  const result = fitted
    .map((f, i) => ({ name: f.name, params: f.params, bicWeight: weights[i] / sumWeights, pValue: f.pValue }))
    .sort((a, b) => b.bicWeight - a.bicWeight)

  if (result.every(r => r.pValue < 0.05)) {
    result.warning = 'no candidate passes goodness-of-fit at α=0.05'
  }

  return result
}

/**
 * Fits a set of candidate distributions to a dataset and ranks them by BIC weight — the
 * probability that each candidate is the best-fitting model in the candidate set, given
 * the data. "Guess" is intentional: this is a heuristic exploratory tool, not a verdict.
 *
 * Candidates are pre-filtered before the expensive fit() call: hard filters (matching
 * type and support against the data) are followed by soft, statistically-principled
 * filters (skewness, coefficient of variation, dispersion index) that can, by design,
 * silently exclude a candidate that would in fact have fit reasonably well. The soft
 * filters' false-exclusion risk is not uniform: the skewness threshold (2·√(6/n)) is
 * calibrated to roughly a 5% false-exclusion rate for a truly symmetric family (about
 * 2 standard errors of the sample-skewness estimator under normality), and the
 * positive-skew-only rule is deliberately asymmetric — it only excludes on strongly
 * *negative* sample skewness, so ordinary sampling noise around zero or positive skew
 * never triggers it. The coefficient-of-variation ([0.1, 10]) and dispersion-index
 * (>3, <0.5) bounds, by contrast, are wide heuristic constants carried over from this
 * function's original design rationale and have not been independently validated by
 * simulation — treat their false-exclusion behavior as unquantified. A distribution
 * excluded by a soft filter is never reported, with no diagnostic indicating it was
 * screened out; callers with a specific hypothesis about their data should bypass all
 * filtering via the `candidates` option rather than rely on the default pool. A
 * candidate whose fit() throws is skipped rather than propagating the error. Throws if
 * the data is too small for the surviving candidate set's largest parameter count
 * (BIC's asymptotic approximation requires roughly 20 observations per parameter).
 *
 * @method guess
 * @memberof ran.dist
 * @param {number[]} data Array of numbers to fit candidate distributions to.
 * @param {Object=} options Options for the fitting procedure.
 * @param {Function[]=} options.candidates Distribution constructors to try, overriding the
 * default candidate pool (all distributions).
 * @returns {Object[]} Array of `{name, params, bicWeight, pValue}`, sorted by descending
 * `bicWeight` (`bicWeight` values across the array sum to 1). For continuous candidates,
 * `pValue` uses the Marsaglia & Marsaglia (2004) Anderson-Darling asymptotic approximation,
 * which can occasionally report a value slightly above 1 for a very small, near-perfectly-fit
 * sample — an artifact of the published approximation itself. Carries a `warning` string
 * property when every surviving candidate fails goodness-of-fit at α=0.05.
 * @throws {Error} If no candidate survives pre-filtering, if the data is too small for the
 * surviving candidate set's largest parameter count, or if no candidate can be fitted.
 */
export function guess (data, { candidates } = {}) {
  const pool = candidates || _defaultCandidates()
  const context = _dataContext(data)

  const survivors = _survivingCandidates(pool, data, context)
  if (survivors.length === 0) {
    throw new Error('guess(): no candidate distribution survives pre-filtering for this data')
  }

  const maxK = Math.max(...survivors.map(s => s.probe.k))
  const minObservations = 20 * maxK
  if (data.length < minObservations) {
    throw new Error(
      `guess(): at least ${minObservations} observations are required for the surviving candidate set (got ${data.length})`
    )
  }

  const fitted = _fitSurvivors(survivors, data, context.isDiscrete)
  if (fitted.length === 0) {
    throw new Error('guess(): no candidate distribution could be fitted to this data')
  }

  return _rankByBicWeight(fitted)
}
