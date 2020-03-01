/**
 * Finds the index corresponding to the largest term in a series.
 *
 * @method startIndex
 * @memberOf ran.algorithms
 * @param {Function} term Function that accepts an index and returns the term.
 * @returns {number} The index of the largest term.
 * @private
 */
export default function (term) {
  // Bracket maximum
  let j1 = 1
  let f1 = term(j1)
  let j2 = 2
  let f2 = term(j2)
  let j = 3
  let f
  while (f2 >= f1) {
    // Calculate new value
    j = j1 + j2
    f = term(j)

    // Update indices if new value is larger
    if (f >= f2) {
      j1 = j2
      j2 = j
      f1 = f2
      f2 = f
    } else {
      break
    }
  }

  // Close bracket
  let a = j1
  let fa = f1
  let b = j
  let fb = f
  let m
  let fm
  while (a !== b) {
    // Add middle point
    m = Math.floor((a + b) / 2)
    fm = term(m)

    // Check if boundary is small enough
    if (m === a || m === b) {
      break
    }

    // Update
    if (fa > fb) {
      fb = fm
      b = m
    } else {
      fa = fm
      a = m
    }
  }

  return m
}
