const swap = (arr, i, j) => {
  const t = arr[i]
  arr[i] = arr[j]
  arr[j] = t
}

/**
 * Selects the k-th smallest element in an array using the quickselect algorithm.
 * Based on this C code: http://finmath.stanford.edu/~ryantibs/median/quickselect.c
 *
 * @method quickselect
 * @methodOf ran.algorithms
 * @param {number[]} values Array of values to select from.
 * @param {number} k The index of the item to select.
 * @return {number} The selected item.
 * @private
 */
export default function (values, k) {
  let li
  let ri
  let mid
  let a
  let left = 0
  let right = values.length - 1
  const iMax = values.length * values.length
  let jMax
  for (let i = 0; i < iMax; i++) {
    if (right <= left + 1) {
      if (right === left + 1 && values[right] < values[left]) {
        swap(values, left, right)
      }
      return values[k]
    } else {
      mid = (left + right) >> 1
      swap(values, mid, left + 1)
      if (values[left] > values[right]) {
        swap(values, left, right)
      }
      if (values[left + 1] > values[right]) {
        swap(values, left + 1, right)
      }
      if (values[left] > values[left + 1]) {
        swap(values, left, left + 1)
      }
      li = left + 1
      ri = right
      a = values[left + 1]
      jMax = ri - li + 1
      for (let j = 0; j < jMax; j++) {
        do li++; while (values[li] < a)
        do ri--; while (values[ri] > a)
        if (ri < li) {
          break
        }
        swap(values, li, ri)
      }
      values[left + 1] = values[ri]
      values[ri] = a
      if (ri >= k) {
        right = ri - 1
      }
      if (ri <= k) {
        left = li
      }
    }
  }
}
