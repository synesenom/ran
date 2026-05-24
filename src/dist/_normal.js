// Improved Ziggurat algorithm for the standard normal distribution.
// Marsaglia & Tsang (2000) "The Ziggurat Method for Generating Random Variables"
//   J. Statistical Software 5(8). https://doi.org/10.18637/jss.v005.i08
// Doornik (2005) "An Improved Ziggurat Method to Generate Normal Random Samples"
//   https://www.doornik.com/research/ziggurat.pdf

// N = 128 horizontal strips of equal area V partition the half-normal curve.
// R is the right-tail cutoff; strip 0 spans [0, R] plus the infinite right tail.
// V = R·φ(R) + Pr(X ≥ R) is chosen so every strip has the same area.
// (Marsaglia & Tsang 2000, §1; numerical values from Doornik 2005, Table 1.)
const _N = 128
const _R = 3.442619855899
const _V = 9.91256303526217e-3

// _X[i] is the right-edge x-coordinate of strip i.
// Equal-area recurrence (Marsaglia & Tsang 2000, §1):
//   V = x[i-1] · (φ(x[i]) − φ(x[i-1]))  ⟹  x[i] = √(−2 ln(V/x[i-1] + φ(x[i-1])))
// Boundary conditions: x[0] = V/φ(R), x[1] = R, x[N] = 0 (density peak).
const _X = (() => {
  const x = new Array(_N + 1)
  let phi = Math.exp(-0.5 * _R * _R)
  x[0] = _V / phi
  x[1] = _R
  for (let i = 2; i < _N; i++) {
    x[i] = Math.sqrt(-2 * Math.log(_V / x[i - 1] + phi))
    phi = Math.exp(-0.5 * x[i] * x[i])
  }
  x[_N] = 0
  return x
})()

// _W[i] = x[i+1]/x[i]: fast-path acceptance ratio for strip i (Doornik 2005, §2).
// Candidate u·x[i] with |u| < _W[i] satisfies |candidate| < x[i+1], placing it
// inside the inner rectangle of strip i, which lies entirely below the curve.
const _W = _X.slice(0, _N).map((xi, i) => _X[i + 1] / xi)

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
  while (true) {
    // u ~ Uniform(−1, 1); strip i ~ Uniform{0, …, N−1}. (Doornik 2005, §2)
    // Candidate x-coordinate: xc = u · x[i].
    const u = 2 * r.next() - 1
    const i = Math.floor(r.next() * _N)
    const xc = u * _X[i]

    // Fast path (~98–99%): |xc| < x[i+1] means xc is inside the solid inner rectangle
    // of strip i, which lies entirely under the curve. No acceptance test needed.
    if (Math.abs(u) < _W[i]) {
      return xc * sigma + mu
    }

    // Tail path (strip 0): sample from φ(x) conditioned on x > R.
    // Marsaglia (1964): draw z ~ Exp(R) via z = −ln(U₁)/R; accept when 2·ln(U₂) ≤ −z².
    // Sign is taken from the original u to cover both tails symmetrically.
    if (i === 0) {
      let z, v
      do {
        z = Math.log(r.next()) / _R
        v = Math.log(r.next())
      } while (-2 * v < z * z)
      return (u < 0 ? z - _R : _R - z) * sigma + mu
    }

    // Wedge path: xc lies in the curved wedge at the corner of strip i.
    // Accept with probability (φ(xc) − φ(x[i])) / (φ(x[i+1]) − φ(x[i])). (Doornik 2005, §3)
    // Dividing numerator and denominator by φ(xc), and writing
    //   rk = φ(x[k]) / φ(xc) = exp(−½·(x[k]² − xc²)):
    //   P(accept) = (1 − ri) / (ri1 − ri)  ⟺  accept when U·(ri − ri1) + ri1 < 1.
    const xc2 = xc * xc
    const ri = Math.exp(-0.5 * (_X[i] * _X[i] - xc2))
    const ri1 = Math.exp(-0.5 * (_X[i + 1] * _X[i + 1] - xc2))
    if (ri1 + r.next() * (ri - ri1) < 1) {
      return xc * sigma + mu
    }
  }
}
