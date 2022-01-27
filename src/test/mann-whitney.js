import { Normal } from '../dist'

/**
 * Marks an array of values with a type.
 *
 * @method _markData
 * @memberof ran.test
 * @param {number[]} data Array of numbers to mark.
 * @param {number} type Type of the data to mark with.
 * @returns {Object[]} Array of objects containing the data as value properties and type as the type properties.
 * @private
 */
function _markData (data, type) {
  return data.map(d => ({
    value: d,
    type
  }))
}

/**
 * Computes the ranks for an array of marked data.
 *
 * @method _computeRanks
 * @memberof ran.test
 * @param {Object[]} data Array of objects containing the marked data sets.
 * @returns {Object[]} Array of objects containing the marked data along with the ranks.
 * @private
 */
function _computeRanks (data) {
  // Merge data sets, sort and assign ranks
  const rankedData = data
    // Sort values
    .sort((a, b) => a.value - b.value)
    // Assign ranks
    .map((d, i) => ({
      value: d.value,
      type: d.type,
      rank: i + 1
    }))

  // Adjust ranks
  // Fix ranks for ties
  let lo = 0
  let hi = lo
  for (let i = 1; i < rankedData.length; i++) {
    // Check for ties
    if (rankedData[i].value === rankedData[lo].value) {
      hi = i
    } else {
      // Update ranks
      if (hi !== lo) {
        const midpoint = (rankedData[hi].rank + rankedData[lo].rank) / 2
        for (let j = lo; j <= hi; j++) {
          rankedData[j].rank = midpoint
        }
      }

      // Reset low and high ranks
      lo = i
      hi = lo
    }
  }

  return rankedData
}

/**
 * Calculates the [Mann-Whitney statistics]{@link https://en.wikipedia.org/wiki/Mann%E2%80%93Whitney_U_test} for two
 * data sets.
 *
 * @method mannWhitney
 * @memberof ran.test
 * @param {Array[]} dataSets Array containing the two data sets.
 * @param {number} [alpha = 0.05] Confidence level.
 * @returns {Object} Object containing the (non-standardized) test statistics (U) and whether the data sets passed the null hypothesis that
 * the samples come from the same distribution.
 * @throws {Error} If the number of data sets is different from 2.
 * @example
 *
 * let pareto = new ran.dist.Pareto(1, 2)
 * let uniform = new ran.dist.Uniform(1, 10)
 *
 * ran.test.mannWhitney([pareto.sample(100), pareto.sample(100)], 0.1)
 * // => { stat: 4941, passed: true }
 *
 * ran.test.mannWhitney([pareto.sample(100), uniform.sample(100)], 0.1)
 * // => { stat: 132, passed: false }
 */
export default function (dataSets, alpha = 0.05) {
  // Check data sets.
  if (dataSets.length !== 2) {
    throw Error('dataSets must contain two data sets')
  }

  // Flag data sets.
  const markedData1 = _markData(dataSets[0], 1)
  const markedData2 = _markData(dataSets[1], 2)

  // Assign ranks.
  const ranks = _computeRanks(markedData1.concat(markedData2))

  // Compute statistics.
  const n1 = dataSets[0].length
  const n2 = dataSets[1].length
  const r1 = ranks.filter(d => d.type === 1)
    .reduce((sum, d) => sum + d.rank, 0)
  const U1 = r1 - n1 * (n1 + 1) / 2
  const U = Math.min(U1, n1 * n2 - U1)

  // Standardize U.
  const m = n1 * n2 / 2
  const s = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12)

  // Compare against critical value.
  return {
    stat: U,
    passed: Math.abs((U - m) / s) <= (new Normal()).q(1 - 2 * alpha)
  }
}
