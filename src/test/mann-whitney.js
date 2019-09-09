import Normal from '../dist/normal'

/**
 * Marks an array of values with a type.
 *
 * @method _markData
 * @memberOf ran.test
 * @param {number[]} data Array of numbers to mark.
 * @param {number} type Type of the data to mark with.
 * @returns {Object[]} Array of objects containing the data as value properties and type as the type properties.
 * @private
 */
function _markData(data, type) {
  return data.map(d => ({
    value: d,
    type
  }))
}

/**
 * Computes the ranks for an array of marked data.
 *
 * @method _computeRanks
 * @memberOf ran.test
 * @param {Object[]} data Array of objects containing the marked data sets.
 * @returns {Object[]} Array of objects containing the marked data along with the ranks.
 * @private
 */
function _computeRanks(data) {
  // Merge data sets, sort and assign ranks
  let rankedData = data
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
        let midpoint = (rankedData[hi].rank + rankedData[lo].rank) / 2
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
 * Calculates the [Mann-Whitney statistics]{@link https://en.wikipedia.org/wiki/Mann%E2%80%93Whitney_U_test} for two data sets.
 *
 * @method mannWhitney
 * @memberOf ran.test
 * @param {number[]} data1 First data set.
 * @param {number[]} data2 Second data set.
 * @param {number} alpha Confidence level.
 * @returns {Object} Object containing the test statistics and whether the data sets passed the null hypothesis that their distribution is the same.
 * @example
 *
 * let pareto = new ran.dist.Pareto(1, 2)
 * let uniform = new ran.dist.UniformContinuous(1, 10);
 *
 * ran.test.mannWhitney(pareto.sample(1000), pareto.sample(100), 0.1)
 * // => { U: 0.6427808284792651, passed: true }
 *
 * ran.test.mannWhitney(pareto.sample(1000), uniform.sample(1000), 0.1)
 * // => { U: 38.72015463311832, passed: false }
 */
export default function (data1, data2, alpha = 0.05) {
  // Flag data sets
  let rankedData1 = _markData(data1, 1)
  let rankedData2 = _markData(data2, 2)

  // Assign ranks
  let ranks = _computeRanks(rankedData1.concat(rankedData2))

  // Compute statistics
  let n1 = data1.length
  let n2 = data2.length
  let r1 = ranks.filter(d => d.type === 1)
    .reduce((acc, d) => acc + d.rank, 0)
  let u1 = r1 - n1 * (n1 + 1) / 2
  let u = Math.min(u1, n1 * n2 - u1)

  // Standardize U
  let m = n1 * n2 / 2
  let s = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12)
  let z = Math.abs((u - m) / s)

  // Compare against critical value
  return {
    U: z,
    passed: z <= (new Normal()).q(1 - alpha)
  }
}
