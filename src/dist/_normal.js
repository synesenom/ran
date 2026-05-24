// Improved Ziggurat algorithm — Marsaglia-Tsang (2000) / Doornik (2005).
// Avoids transcendentals on ~98-99% of samples via 128-layer lookup tables.

const _V = 9.91256303526217e-3
const _R = 3.442619855899
const _N = 128

// Each layer of the ziggurat has equal area V; X[i] is the right edge of layer i.
const ZIGX = (() => {
  const x = new Array(_N + 1)
  let f = Math.exp(-0.5 * _R * _R)
  x[0] = _V / f
  x[1] = _R
  for (let i = 2; i < _N; i++) {
    x[i] = Math.sqrt(-2 * Math.log(_V / x[i - 1] + f))
    f = Math.exp(-0.5 * x[i] * x[i])
  }
  x[_N] = 0
  return x
})()

// W[i] = X[i+1] / X[i]: fraction of layer i that lies inside layer i+1.
const ZIGW = ZIGX.slice(0, _N).map((xi, i) => ZIGX[i + 1] / xi)

/**
 * Generates a normally distributed random variate using the Improved Ziggurat
 * algorithm (Marsaglia-Tsang 2000 / Doornik 2005).
 *
 * @method normal
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number} mu Distribution mean.
 * @param {number} sigma Distribution standard deviation.
 * @returns {number} Random variate.
 * @ignore
 */
export default function (r, mu = 0, sigma = 1) {
  for (;;) {
    const u = 2 * r.next() - 1
    const i = Math.floor(r.next() * _N)

    // Fast path: candidate lies inside a solid rectangle — no transcendentals
    if (Math.abs(u) < ZIGW[i]) {
      return u * ZIGX[i] * sigma + mu
    }

    // Tail path: layer 0 extends into the unbounded tail beyond _R
    if (i === 0) {
      let x, y
      do {
        x = Math.log(r.next()) / _R
        y = Math.log(r.next())
      } while (-2 * y < x * x)
      return (u < 0 ? x - _R : _R - x) * sigma + mu
    }

    // Wedge path: candidate lies in the curved region between layers i and i+1
    const x = u * ZIGX[i]
    const x2 = x * x
    const f0 = Math.exp(-0.5 * (ZIGX[i] * ZIGX[i] - x2))
    const f1 = Math.exp(-0.5 * (ZIGX[i + 1] * ZIGX[i + 1] - x2))
    if (f1 + r.next() * (f0 - f1) < 1) {
      return x * sigma + mu
    }
  }
}
