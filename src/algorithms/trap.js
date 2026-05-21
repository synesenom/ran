/**
 * Calculates the integral of a function with the trapezoidal rule, doubling the
 * node count until the estimate settles. For integrands that vanish with all
 * derivatives at the endpoints the trapezoidal rule is spectrally accurate;
 * Neumaier-compensated summation keeps the rounding noise near machine epsilon
 * even at hundreds of thousands of nodes.
 *
 * @method trap
 * @memberof ran.algorithms
 * @param {Function} f Function to calculate the definite integral for.
 * @param {number} a Lower boundary of the integration interval.
 * @param {number} b Upper boundary of the integration interval.
 * @return {number} The approximate integral of the function.
 * @private
 */
export default function (f, a, b) {
  let n = 1
  let h = b - a
  let t = 0.5 * h * (f(a) + f(b))
  for (let k = 1; k <= 24; k++) {
    let s = 0
    let c = 0
    let xx = a + 0.5 * h
    for (let i = 0; i < n; i++, xx += h) {
      const v = f(xx)
      const u = s + v
      c += Math.abs(s) >= Math.abs(v) ? (s - u) + v : (v - u) + s
      s = u
    }
    const next = 0.5 * t + 0.5 * h * (s + c)
    if (k > 3 && Math.abs(next - t) <= 1e-12 * Math.abs(next)) {
      return next
    }
    t = next
    n *= 2
    h *= 0.5
  }
  return t
}
