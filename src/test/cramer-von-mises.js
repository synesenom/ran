import { besselKnu, logGamma } from '../special'
import { MAX_ITER } from '../core/constants'

/**
 * Computes the k-th term of the convergent series for the asymptotic CDF of the Cramér-von Mises
 * limiting distribution (Csörgő, S. and Faraway, J. (1996), "The Exact and Asymptotic Distributions
 * of Cramér-von Mises Statistics", JRSS-B 58(1), eq. 1.2, restated per the second line of their
 * eq. 1.3).
 *
 * @method _cvmTerm
 * @memberof ran.test
 * @param {number} x Value to evaluate the series term at.
 * @param {number} k Term index.
 * @returns {number} The k-th series term.
 * @private
 */
function _cvmTerm (x, k) {
  const y = 4 * k + 1
  const q = (y * y) / (16 * x)
  const u = Math.exp(logGamma(k + 0.5) - logGamma(k + 1)) / (Math.pow(Math.PI, 1.5) * Math.sqrt(x))
  return u * Math.sqrt(y) * Math.exp(-q) * besselKnu(0.25, q)
}

/**
 * Computes the asymptotic CDF of the Cramér-von Mises limiting distribution at x, by summing
 * {@link _cvmTerm} until terms fall below an absolute tolerance. A plain per-term absolute
 * threshold is used (matching the reference implementation) rather than a relative-to-running-sum
 * check, since the summed value itself can be far below 1 for small x, where a relative floor
 * would falsely declare convergence after only 1-2 terms.
 *
 * @method _cdfCvmInf
 * @memberof ran.test
 * @param {number} x Value to evaluate the asymptotic CDF at.
 * @returns {number} The asymptotic CDF value.
 * @private
 */
function _cdfCvmInf (x) {
  let sum = 0
  for (let k = 0; k < MAX_ITER; k++) {
    const term = _cvmTerm(x, k)
    sum += term
    if (Math.abs(term) < 1e-7) {
      break
    }
  }
  return sum
}

/**
 * Computes the Cramér-von Mises statistic T = n omega^2 for a sample against a cumulative
 * distribution function, using the standard 0.5-offset empirical-distribution-function form.
 *
 * @method _cvmStatistic
 * @memberof ran.test
 * @param {number[]} values Array of values to compute the statistic for.
 * @param {Function} cdf Cumulative distribution function to test against.
 * @returns {number} The T statistic.
 * @private
 */
function _cvmStatistic (values, cdf) {
  const n = values.length
  const u = values.map(cdf).sort((a, b) => a - b)

  let sum = 0
  for (let i = 0; i < n; i++) {
    const w = (2 * (i + 1) - 1) / (2 * n) - u[i]
    sum += w * w
  }
  return 1 / (12 * n) + sum
}

/**
 * Calculates the [Cramér-von Mises statistic]{@link https://en.wikipedia.org/wiki/Cram%C3%A9r%E2%80%93von_Mises_criterion}
 * for an array of values against a cumulative distribution function, testing the null hypothesis
 * that the sample is drawn from the distribution the CDF represents. The asymptotic p-value uses
 * the Csörgő & Faraway (1996) convergent series for the limiting distribution's CDF.
 *
 * @method cramerVonMises
 * @memberof ran.test
 * @param {number[]} values Array of values to perform the test for.
 * @param {Function} cdf Cumulative distribution function to test against.
 * @param {number} [alpha = 0.05] Confidence level.
 * @returns {{stat: number, pValue: number, passed: boolean}} Object containing the test statistic
 * (T = n omega^2), the asymptotic goodness-of-fit p-value, and whether the sample passed the null
 * hypothesis that it is drawn from the tested distribution.
 * @throws {Error} If values is empty.
 * @example
 *
 * let normal = new ran.dist.Normal(0, 1)
 *
 * ran.test.cramerVonMises(normal.sample(100), x => normal.cdf(x))
 * // => { stat: 0.043, pValue: 0.802, passed: true }
 */
export default function (values, cdf, alpha = 0.05) {
  if (values.length === 0) {
    throw Error('cramerVonMises: values must not be empty')
  }

  const stat = _cvmStatistic(values, cdf)
  const pValue = 1 - _cdfCvmInf(stat)

  // decisions/0042-single-sample-gof-test-return-shape.md — pValue is additive to the
  // {stat, passed} shape the other src/test/* functions use, not _tests.js's {statistics, ...}
  return {
    stat,
    pValue,
    passed: pValue >= alpha
  }
}
