/**
 * Swaps two elements of an array.
 *
 * @method _swap
 * @memberof ran.algorithms
 * @param {number[]} arr Array to modify.
 * @param {number} i First index to use for swap
 * @param {number} j First index to use for swap
 * @private
 */
const _swap = (arr, i, j) => {
  const tmp = arr[i]
  arr[i] = arr[j]
  arr[j] = tmp
}

/**
 * Partitions an array by a specific pivot value using the
 * [Lomuto partition scheme]{@link https://en.wikipedia.org/wiki/Quickselect#Algorithm}.
 *
 * @method _partition
 * @memberof ran.algorithms
 * @param {number[]} arr Array to partition.
 * @param {number} left Lower bound of the partitioning.
 * @param {number} right Upper bound of the partitioning.
 * @param {number} pivotIndex Index to partition array around.
 * @return {number} The new pivot index after partitioning.
 * @private
 */
function _partition (arr, left, right, pivotIndex) {
  // TODO Change this to Hoare's partition scheme
  const pivotValue = arr[pivotIndex]
  _swap(arr, pivotIndex, right)
  let storeIndex = left
  for (let i = left; i < right; i++) {
    if (arr[i] < pivotValue) {
      _swap(arr, storeIndex, i)
      storeIndex++
    }
  }
  _swap(arr, right, storeIndex)
  return storeIndex
}

/**
 * Performs a quickselect within a specific range of indices.
 *
 * @method _select
 * @memberof ran.algorithms
 * @param {number[]} arr Array to perform quickselect on.
 * @param {number} left Lower boundary of the index range.
 * @param {number} right Upper boundary of the index range.
 * @param {number} k The rank of the element to find.
 * @return {number} The k-th lowest element in the array.
 * @private
 */
function _select (arr, left, right, k) {
  if (left === right) {
    return arr[left]
  }
  const pivotIndex = _partition(arr, left, right, Math.floor((left + right) / 2))
  if (k === pivotIndex) {
    return arr[k]
  } else if (k < pivotIndex) {
    return _select(arr, left, pivotIndex - 1, k)
  } else {
    return _select(arr, pivotIndex + 1, right, k)
  }
}

/**
 * Selects the k-th smallest element in an array using the quickselect algorithm.
 * Just a direct implementation from https://en.wikipedia.org/wiki/Quickselect#Algorithm.
 *
 * @method quickselect
 * @memberof ran.algorithms
 * @param {number[]} values Array of values to select from.
 * @param {number} k The index of the item to select.
 * @return {number} The selected item.
 * @private
 */
export default function (values, k) {
  return _select(values, 0, values.length - 1, k)
}
