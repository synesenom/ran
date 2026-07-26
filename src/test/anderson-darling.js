import { andersonDarling as _andersonDarling } from '../dist/_tests'

/**
 * Calculates the [Anderson-Darling statistic]{@link https://en.wikipedia.org/wiki/Anderson%E2%80%93Darling_test}
 * for an array of values against a cumulative distribution function, testing the null hypothesis
 * that the sample is drawn from the distribution the CDF represents. The asymptotic p-value uses
 * the Marsaglia & Marsaglia (2004) rational-function approximation to the limiting distribution's
 * CDF, with their finite-sample correction.
 *
 * @method andersonDarling
 * @memberof ran.test
 * @param {number[]} values Array of values to perform the test for.
 * @param {Function} cdf Cumulative distribution function to test against.
 * @param {number} [alpha = 0.05] Confidence level.
 * @returns {{stat: number, pValue: number, passed: boolean}} Object containing the test statistic
 * (A²), the asymptotic goodness-of-fit p-value, and whether the sample passed the null hypothesis
 * that it is drawn from the tested distribution.
 * @throws {Error} If values is empty.
 * @example
 *
 * let normal = new ran.dist.Normal(0, 1)
 *
 * ran.test.andersonDarling(normal.sample(100), x => normal.cdf(x))
 * // => { stat: 0.231, pValue: 0.789, passed: true }
 */
export default function (values, cdf, alpha = 0.05) {
  const { statistics, pValue } = _andersonDarling(values, cdf)

  // decisions/0042-single-sample-gof-test-return-shape.md — pValue is additive to the
  // {stat, passed} shape the other src/test/* functions use, not _tests.js's {statistics, ...}.
  // The A² statistic and its Marsaglia & Marsaglia (2004) p-value are intentionally not
  // duplicated here — src/dist/_tests.js already implements and tests them.
  return {
    stat: statistics,
    pValue,
    passed: pValue >= alpha
  }
}
