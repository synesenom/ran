/**
 * Returns the number of concordant pairs in two arrays of the same length.
 *
 * @method concordant
 * @memberof ran.utils
 * @param {number[]} x First array.
 * @param {number[]} y Second array.
 * @return {number} Number of concordant pairs.
 * @private
 */
export default function (x, y) {
  let n = 0
  for (let i = 1; i < x.length; i++) {
    for (let j = 0; j < i; j++) {
      if (Math.sign(x[i] - x[j]) * Math.sign(y[i] - y[j]) > 0) {
        n++
      }
    }
  }
  return n
}
