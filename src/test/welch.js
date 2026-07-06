import { mean } from '../location'
import { variance } from '../dispersion'
import { StudentT } from '../dist'

/**
 * Calculates [Welch's two-sample t-test]{@link https://en.wikipedia.org/wiki/Welch%27s_t-test} for two data sets.
 *
 * @method welch
 * @memberof ran.test
 * @param {number[]} x First sample.
 * @param {number[]} y Second sample.
 * @param {number} [alpha = 0.05] Confidence level.
 * @returns {{stat: number, passed: boolean}} Object containing the test statistic (t) and whether the data
 * sets passed the null hypothesis that their means are equal.
 * @throws {Error} If either sample has fewer than 2 elements.
 * @example
 *
 * let normal1 = new ran.dist.Normal(0, 1)
 * let normal2 = new ran.dist.Normal(5, 1)
 *
 * ran.test.welch(normal1.sample(100), normal1.sample(100))
 * // => { stat: -0.43, passed: true }
 *
 * ran.test.welch(normal1.sample(100), normal2.sample(100))
 * // => { stat: -49.3, passed: false }
 */
export default function (x, y, alpha = 0.05) {
  if (x.length < 2) {
    throw Error('x must have at least 2 elements')
  }
  if (y.length < 2) {
    throw Error('y must have at least 2 elements')
  }

  const n1 = x.length
  const n2 = y.length
  const s1 = variance(x)
  const s2 = variance(y)
  const v1 = s1 / n1
  const v2 = s2 / n2

  const t = (mean(x) - mean(y)) / Math.sqrt(v1 + v2)

  // Guard degenerate case: zero variance in both samples makes nu = 0/0
  const denom = v1 ** 2 / (n1 - 1) + v2 ** 2 / (n2 - 1)
  if (denom === 0) {
    return { stat: t, passed: false }
  }
  const nu = (v1 + v2) ** 2 / denom

  // Use the left tail directly to avoid 1 - cdf(|t|) cancellation for large |t|
  const p = 2 * (new StudentT(nu)).cdf(-Math.abs(t))

  return {
    stat: t,
    passed: p >= alpha
  }
}
