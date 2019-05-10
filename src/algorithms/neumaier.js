/**
 * Sums the element of an array using the robust (but slower) [Neumaier method]{@link https://www.mat.univie.ac.at/~neum/scan/01.pdf}.
 *
 * @method neumaier
 * @memberOf ran.algorithms
 * @param {number[]} arr Array to sum.
 * @returns {number} The sum of the elements in the array.
 * @private
 */
export default function (arr) {
  let sorted = arr.sort((a, b) => a - b)
  let s = sorted[0]
  let c = 0
  for (let i = 1; i < sorted.length; i++) {
    let t = s + sorted[i]
    if (Math.abs(s) > Math.abs(sorted[i])) {
      c += (s - t) + sorted[i]
    } else {
      c += (sorted[i] - t) + s
    }
    s = t
  }
  return s + c
}
