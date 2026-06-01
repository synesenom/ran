const _swap = (arr, i, j) => {
  const tmp = arr[i]
  arr[i] = arr[j]
  arr[j] = tmp
}

// Floyd-Rivest selection: samples a small subarray to find a good pivot,
// then partitions using Hoare's two-pointer scheme. O(n) expected time with
// very low constants; replaces the Lomuto midpoint pivot that degrades to O(n²)
// on adversarial input.
function _select (arr, left, right, k) {
  while (right > left) {
    if (right - left > 600) {
      const n = right - left + 1
      const i = k - left + 1
      const z = Math.log(n)
      const s = 0.5 * Math.exp(2 * z / 3)
      const sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * Math.sign(i - n / 2)
      const newLeft = Math.max(left, Math.floor(k - i * s / n + sd))
      const newRight = Math.min(right, Math.floor(k + (n - i) * s / n + sd))
      _select(arr, newLeft, newRight, k)
    }

    const t = arr[k]
    let i = left
    let j = right
    _swap(arr, left, k)
    if (arr[right] > t) {
      _swap(arr, left, right)
    }
    while (i < j) {
      _swap(arr, i, j)
      i++
      j--
      while (arr[i] < t) i++
      while (arr[j] > t) j--
    }
    if (arr[left] === t) {
      _swap(arr, left, j)
    } else {
      j++
      _swap(arr, j, right)
    }
    if (j <= k) left = j + 1
    if (k <= j) right = j - 1
  }
  return arr[k]
}

/**
 * Selects the k-th smallest element in an array using the Floyd-Rivest algorithm
 * (Floyd & Rivest, 1975). Uses Hoare's two-pointer partition scheme and random
 * sampling to achieve O(n) expected time, avoiding the O(n²) worst case of
 * deterministic midpoint-pivot quickselect.
 *
 * @method introselect
 * @memberof ran.algorithms
 * @param {number[]} values Array of values to select from.
 * @param {number} k The index of the item to select (0-based).
 * @return {number} The k-th smallest element.
 * @throws {Error} If k is out of range.
 * @private
 */
export default function introselect (values, k) {
  if (k < 0 || k >= values.length) {
    throw new Error(`introselect: index ${k} is out of range [0, ${values.length - 1}]`)
  }
  return _select(values, 0, values.length - 1, k)
}
