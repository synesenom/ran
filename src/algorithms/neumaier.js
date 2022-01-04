/**
 * Sums the element of an array using the robust [Neumaier method]{@link https://en.wikipedia.org/wiki/Kahan_summation_algorithm#Further_enhancements}.
 *
 * @method neumaier
 * @memberof ran.algorithms
 * @param {number[]} arr Array to sum.
 * @returns {number} The sum of the elements in the array.
 * @private
 */
export default function (arr) {
  // Sort array first.
  const sorted = arr.sort((a, b) => a - b)

  // Init sum and correction.
  let s = sorted[0]
  let c = 0

  // Start summation.
  for (let i = 1; i < sorted.length; i++) {
    const t = s + sorted[i]
    if (Math.abs(s) > Math.abs(sorted[i])) {
      c += (s - t) + sorted[i]
    } else {
      c += (sorted[i] - t) + s
    }
    s = t
  }
  return s + c
}
