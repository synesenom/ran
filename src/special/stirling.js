export const stirlingSecond = (function () {
  const _s = new Map()
  _s.set('0 0', 1)

  function snk(n, k) {
    if (isInvalidInput(n, k)) {
      return 0
    }

    const i = `${n} ${k}`
    if (_s.has(i)) {
      return _s.get(i)
    }

    const s = k * snk(n - 1, k) + snk(n - 1, k - 1)
    _s.set(i, s)
    return s
  }

  function isInvalidInput(n, k) {
    return n < 0 || k < 0 || k > n
  }

  /**
   * Computes the Stirling number of the second kind.
   *
   * @method stirlingSecond
   * @memberof ran.special
   * @param {number} n Number of objects.
   * @param {number} k Number of non-empty sets.
   * @returns The (n, k)-th Stirling number of the second kind.
   * @private
   */
  return snk
})()
