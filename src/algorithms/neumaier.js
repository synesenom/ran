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
  let s = arr[0]
  let c = 0
  for (let i = 1; i < arr.length; i++) {
    let t = s + arr[i]
    if (Math.abs(s) > Math.abs(arr[i])) {
      c += (s - t) + arr[i]
    } else {
      c += (arr[i] - t) + s
    }
    s = t
  }
  return s + c
}
