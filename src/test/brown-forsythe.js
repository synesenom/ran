import {generalLevene} from './levene'
import { median } from '../location'

/**
 * Calculates the [Brown-Forsythe test]{@link https://en.wikipedia.org/wiki/Brown%E2%80%93Forsythe_test} statistic for multiple data sets.
 *
 * @method brownForsythe
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
 * ran.test.brownForsythe([normal1.sample(100), normal1.sample(100), normal1.sample(100)], 0.1)
 * // => { stat: 1.0664885130451343, passed: true }
 *
 * ran.test.brownForsythe([normal1.sample(100), normal2.sample(100), normal3.sample(100)], 0.1)
 * // => { stat: 27.495614343570345, passed: false }
 */
export default function (dataSets, alpha = 0.05) {
  return generalLevene(dataSets, alpha, median)
}
