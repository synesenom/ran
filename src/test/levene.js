import { mean } from '../location'
import { F } from '../dist'

/**
 * Calculates the general Levene test with the specified aggregator. For mean it is the Leven test, for median it gives the Brown-Forsythe test.
 *
 * @method generalLevene
 * @memberOf ran.test
 * @param {Array[]} dataSets Array containing the data sets.
 * @param {number} [alpha = 0.05] Confidence level.
 * @param aggregator
 * @returns {Object} Object containing the test statistics and whether the data sets passed the null hypothesis that
 * their variances are the same.
 * @throws {Error} If the number of data sets is less than 2.
 * @throws {Error} If the size of any data set is less than 2 elements.
 * @ignore
 */
export function generalLevene (dataSets, alpha, aggregator) {
// Check number of data sets.
  if (dataSets.length < 2) {
    throw Error('dataSet must contain multiple data sets')
  }

  // Number of samples.
  const k = dataSets.length
  const Ni = dataSets.map(data => data.length)
  const N = Ni.reduce((sum, d) => sum + d, 0)

  // Compute statistics.
  const Yi = dataSets.map(aggregator)
  const Zij = dataSets.map((data, i) => data.map(d => Math.abs(d - Yi[i])))
  const Zi = Zij.map(mean)
  const Z = mean(Zij.flat())
  const num = Ni.reduce((sum, n, i) => sum + n * (Zi[i] - Z) ** 2, 0)
  let denom = 0
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < Ni[i]; j++) {
      denom += (Zij[i][j] - Zi[i]) ** 2
    }
  }
  const stat = (N - k) * num / ((k - 1) * denom)

  return {
    stat,
    passed: stat <= (new F(k - 1, N - k)).q(1 - alpha)
  }
}

/**
 * Calculates the [Levene's test]{@link https://en.wikipedia.org/wiki/Levene%27s_test} statistic for multiple data sets.
 *
 * @method levene
 * @memberof ran.test
 * @param {Array[]} dataSets Array containing the data sets.
 * @param {number} [alpha = 0.05] Confidence level.
 * @returns {Object} Object containing the test statistics (W) and whether the data sets passed the null hypothesis that
 * their variances are the same.
 * @throws {Error} If the number of data sets is less than 2.
 * @throws {Error} If the size of any data set is less than 2 elements.
 * @example
 *
 * let normal1 = new ran.dist.Normal(1, 2)
 * let normal2 = new ran.dist.Normal(1, 3)
 * let normal3 = new ran.dist.Normal(1, 5)
 *
 * ran.test.levene([normal1.sample(100), normal1.sample(100), normal1.sample(100)], 0.1)
 * // => { stat: 0.019917137672045088, passed: true }
 *
 * ran.test.levene([normal1.sample(100), normal2.sample(100), normal3.sample(100)], 0.1)
 * // => { stat: 29.06345994086687, passed: false }
 */
export function levene (dataSets, alpha = 0.05) {
  return generalLevene(dataSets, alpha, mean)
}
