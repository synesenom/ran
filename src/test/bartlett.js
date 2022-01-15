import { variance } from '../dispersion'
import { Chi2 } from '../dist'

/**
 * Calculates the [Bartlett statistics]{@link https://en.wikipedia.org/wiki/Bartlett%27s_test} for multiple data sets.
 *
 * @method bartlett
 * @memberof ran.test
 * @param {Array[]} dataSets Array containing the data sets.
 * @param {number} alpha Confidence level.
 * @returns {Object} Object containing the test statistics and whether the data sets passed the null hypothesis that
 * their variances are the same.
 * @throws Error when the number of data sets is less than 2.
 * @throws Error when the size of any data set is less than 2 elements.
 * @example
 *
 * let normal1 = new ran.dist.Normal(1, 2)
 * let normal2 = new ran.dist.Normal(1, 3)
 * let normal3 = new ran.dist.Normal(1, 5)
 *
 * ran.test.bartlett([normal1.sample(100), normal1.sample(100), normal1.sample(100)], 0.1)
 * // => { chi2: 0.09827551592930094, passed: true }
 *
 * ran.test.bartlett([normal1.sample(100), normal2.sample(100), normal3.sample(100)], 0.1)
 * // => { chi2: 104.31185521417476, passed: false }
 */
export default function (dataSets, alpha = 0.05) {
  // Check number of data sets.
  if (dataSets.length < 2) {
    throw Error('dataSet must contain multiple data sets')
  }

  // Check size of data sets.
  for (let i = 0; i < dataSets.length; i++) {
    if (dataSets[i].length < 2) {
      throw Error('Data sets in dataSet must have multiple elements')
    }
  }

  // Number of samples.
  const k = dataSets.length

  // Compute statistics.
  const N = dataSets.reduce((acc, d) => acc + d.length, 0)
  const nInv = dataSets.reduce((acc, d) => acc + 1 / (d.length - 1), 0)
  const Si = dataSets.map(variance)
  const Sp = dataSets.reduce((acc, d, i) => acc + (d.length - 1) * Si[i], 0) / (N - k)
  const lnSi = dataSets.reduce((acc, d, i) => acc + (d.length - 1) * Math.log(Si[i]), 0)
  const chi2 = ((N - k) * Math.log(Sp) - lnSi) / (1 + (nInv - 1 / (N - k)) / (3 * (k - 1)))

  // Compare against critical value.
  return {
    chi2,
    passed: chi2 <= (new Chi2(k - 1)).q(1 - alpha)
  }
}
