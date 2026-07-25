import { Kolmogorov } from '../dist'

/**
 * Counts the number of elements in a sorted array that are less than or equal to a value.
 *
 * @method _countLE
 * @memberof ran.test
 * @param {number[]} sortedArr Array of numbers sorted in ascending order.
 * @param {number} value Value to compare against.
 * @returns {number} Number of elements less than or equal to value.
 * @private
 */
function _countLE (sortedArr, value) {
  let lo = 0
  let hi = sortedArr.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (sortedArr[mid] <= value) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

/**
 * Calculates the [two-sample Kolmogorov-Smirnov test]{@link https://en.wikipedia.org/wiki/Kolmogorov%E2%80%93Smirnov_test#Two-sample_Kolmogorov%E2%80%93Smirnov_test}
 * statistic D = sup|F1(x) - F2(x)| over the pooled empirical CDFs of two samples, along with an asymptotic
 * p-value computed from the Kolmogorov distribution.
 *
 * @method kolmogorovSmirnov
 * @memberof ran.test
 * @param {number[]} x First sample.
 * @param {number[]} y Second sample.
 * @param {number} [alpha = 0.05] Confidence level.
 * @returns {{stat: number, passed: boolean, pValue: number}} Object containing the test statistic (D), the
 * asymptotic p-value, and whether the data sets passed the null hypothesis that they are drawn from the same
 * distribution.
 * @throws {Error} If either sample is empty.
 * @example
 *
 * let normal1 = new ran.dist.Normal(0, 1)
 * let normal2 = new ran.dist.Normal(5, 1)
 *
 * ran.test.kolmogorovSmirnov(normal1.sample(100), normal1.sample(100))
 * // => { stat: 0.09, passed: true, pValue: 0.34 }
 *
 * ran.test.kolmogorovSmirnov(normal1.sample(100), normal2.sample(100))
 * // => { stat: 0.98, passed: false, pValue: 0 }
 */
export default function (x, y, alpha = 0.05) {
  if (x.length === 0) {
    throw Error('x must not be empty')
  }
  if (y.length === 0) {
    throw Error('y must not be empty')
  }

  const n1 = x.length
  const n2 = y.length
  const sortedX = [...x].sort((a, b) => a - b)
  const sortedY = [...y].sort((a, b) => a - b)
  const pooled = Array.from(new Set([...sortedX, ...sortedY])).sort((a, b) => a - b)

  const d = pooled.reduce((max, v) => {
    const diff = Math.abs(_countLE(sortedX, v) / n1 - _countLE(sortedY, v) / n2)
    return Math.max(max, diff)
  }, 0)

  // Effective sample size and asymptotic distribution of the standardized statistic,
  // see https://en.wikipedia.org/wiki/Kolmogorov%E2%80%93Smirnov_test#Two-sample_Kolmogorov%E2%80%93Smirnov_test
  const ne = (n1 * n2) / (n1 + n2)
  const pValue = (new Kolmogorov()).survival(Math.sqrt(ne) * d)

  return {
    stat: d,
    passed: pValue >= alpha,
    pValue
  }
}
