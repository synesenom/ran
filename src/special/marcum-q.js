import { MAX_ITER, EPS, DELTA } from '../core/constants'
import newton from '../algorithms/newton'
import trap from '../algorithms/trap'
import logGamma from './log-gamma'
import { erfc } from './error'
import { gammaLowerIncomplete, gammaUpperIncomplete } from './gamma-incomplete'

/**
 * Series expansion of the Marcum-Q function. Section 3 in https://arxiv.org/pdf/1311.0681.pdf.
 * Computes the primary (smaller) of P and Q directly so deep lower tails are
 * free of catastrophic cancellation (see #245), and derives the complement.
 *
 * @method _series
 * @memberof ran.special
 * @param {number} mu The order of the function.
 * @param {number} x First variable.
 * @param {number} y Second variable.
 * @return {Object} Object holding the Marcum P and Q values as `p` and `q`.
 * @private
 */
function _series (mu, x, y) {
  if (y > x + mu) {
    // q-regime: Q is the small primary, summed directly. Eqs. (7), (18).
    // ck = x^k / k!
    let ck = 1

    // qck = y^{mu + k - 1} e^{-y} / gamma(mu + k - 1)
    let qck = Math.exp((mu - 1) * Math.log(y) - y - logGamma(mu))

    // qk = Q_{mu + k}(y)
    let qk = gammaUpperIncomplete(mu, y)
    let dz = ck * qk
    let z = dz

    for (let k = 1; k < MAX_ITER; k++) {
      qck *= y / (mu + k - 1)
      qk += qck
      ck *= x / k
      dz = ck * qk
      z += dz
      if (dz / z < EPS) { break }
    }

    const q = Math.exp(-x) * z
    return { p: 1 - q, q }
  }

  // p-regime: P is the small primary, returned directly without forming 1 - Q.
  const p = _pSeriesComplement(mu, x, y)
  return { p, q: 1 - p }
}

// Returns `1 − Q_M` computed via the p-series of the Marcum-Q. Extracted
// so that marcumP can return this raw value directly without the
// subtraction-from-1 that catastrophically cancels in deep lower tails
// of distributions that are `1 − marcumQ(...)` (see #245).
function _pSeriesComplement (mu, x, y) {
  // Find truncation number using Eqs. (26) - (27)
  const c0 = mu + logGamma(mu) - Math.log(2 * Math.PI * EPS)
  const c1 = Math.log(x * y)
  const c2 = x * y
  let n = newton(
    t => (t + mu) * Math.log(t + mu) + t * Math.log(t) - 2 * t - t * c1 - c0,
    t => Math.log(t * (t + mu) / c2),
    0.5 * (Math.sqrt(mu * mu + 4 * x * y) - mu) + 1
  )
  n = Math.ceil(n)

  // Initialize terms with last index, Eq. (7)
  let ck = Math.exp(n * Math.log(x) - logGamma(n + 1))
  let pck = Math.exp((mu + n) * Math.log(y) - y - logGamma(mu + n + 1))
  let pk = gammaLowerIncomplete(mu + n, y)
  let dz = ck * pk
  let z = dz

  for (let k = n - 1; k >= 0; k--) {
    // Eq. (19)
    pck *= (mu + k + 1) / y
    pk += pck
    ck *= (k + 1) / x
    dz = ck * pk
    z += dz
  }

  return Math.exp(-x) * z
}

/**
 * Computes Phi_n = sigma^{n-1/2} Gamma(1/2 - n, sigma xi) via the Legendre
 * continued fraction for the incomplete gamma function. Used when sigma xi is
 * large, where the forward recurrence (Eq. 36) is unstable because Phi_n is
 * its recessive solution.
 *
 * @method _phi
 * @memberof ran.special
 * @param {number} n Index of the Phi function.
 * @param {number} sigma Scale variable.
 * @param {number} xi Scale variable.
 * @return {number} The value of Phi_n.
 * @private
 */
function _phi (n, sigma, xi) {
  const a = 0.5 - n
  const z = sigma * xi
  let b = z + 1 - a
  let c = 1 / DELTA
  let d = 1 / b
  let cf = d
  for (let i = 1; i < MAX_ITER; i++) {
    const ai = -i * (i - a)
    b += 2
    d = ai * d + b
    if (Math.abs(d) < DELTA) { d = DELTA }
    c = b + ai / c
    if (Math.abs(c) < DELTA) { c = DELTA }
    d = 1 / d
    const delta = c * d
    cf *= delta
    if (Math.abs(delta - 1) < EPS) { break }
  }
  return Math.exp(-z) * Math.pow(xi, 0.5 - n) * cf
}

/**
 * Raw asymptotic-series sum for the Marcum function in the large-xi regime.
 * Section 4.1 in https://arxiv.org/pdf/1311.0681.pdf. Sums the Q-series
 * (Eqs. 37-38) when `complementary` is false and the P-series (Eqs. 39-40)
 * when it is true.
 *
 * @method _aelx
 * @memberof ran.special
 * @param {number} mu The order of the function.
 * @param {number} x First variable.
 * @param {number} y Second variable.
 * @param {boolean} complementary Whether to sum the P-series instead of the Q-series.
 * @return {number} The asymptotic-series value.
 * @private
 */
function _aelx (mu, x, y, complementary) {
  const xi = 2 * Math.sqrt(x * y)
  const sigma = Math.pow(Math.sqrt(y) - Math.sqrt(x), 2) / xi
  const sx = sigma * xi
  const rho = Math.sqrt(y / x)

  // Forward recurrence of Phi_n (Eq. 36) amplifies its recessive component by
  // ~e^{sigma xi}, so it is only safe for small sigma xi; otherwise each Phi_n
  // is evaluated independently by continued fraction.
  // See solutions/special-functions/2026-05-21-0724-marcum-q-four-branches.md
  const useCF = sx >= 5

  // A_n(mu), A_n(mu - 1): ratio A_n / A_{n-1} = (mu^2 - (n - 1/2)^2) / (2n). Eq. (32).
  let am = 1
  let am1 = 1

  // phic = e^{-sigma xi} xi^{1/2 - n}; phi = Phi_n. Eqs. (34)-(36). At sigma = 0
  // (x = y) Phi_0 diverges, but every term that uses it carries a 0 factor, so
  // any finite placeholder is safe.
  let phic = Math.exp(-sx) * Math.sqrt(xi)
  let phi = useCF
    ? _phi(0, sigma, xi)
    : (sigma === 0 ? 0 : Math.sqrt(Math.PI / sigma) * erfc(Math.sqrt(sx)))

  // psic = (-1)^n rho^mu / (2 sqrt(2 pi)).
  let psic = 0.5 * Math.pow(rho, mu) / Math.sqrt(2 * Math.PI)

  // Leading term: Psi_0 (Eq. 38) or Psi-tilde_0 (Eq. 40).
  let z = complementary
    ? 0.5 * Math.pow(rho, mu - 0.5) * erfc(Math.sqrt(x) - Math.sqrt(y))
    : psic * (am1 - am / rho) * phi

  let prevAbs = Infinity
  for (let n = 1; n < MAX_ITER; n++) {
    am *= (mu * mu - (n - 0.5) * (n - 0.5)) / (2 * n)
    am1 *= ((mu - 1) * (mu - 1) - (n - 0.5) * (n - 0.5)) / (2 * n)

    if (useCF) {
      phi = _phi(n, sigma, xi)
    } else {
      phic /= xi
      phi = (phic - sigma * phi) / (n - 0.5)
    }

    psic *= -1

    // Psi-tilde_n = -Psi_n for n >= 1 (Eq. 39).
    const term = (complementary ? -1 : 1) * psic * (am1 - am / rho) * phi
    z += term

    // Truncate only after two consecutive negligible terms: the factor
    // (A_n(mu-1) - A_n(mu)/rho) crosses zero once, making a single mid-series
    // term spuriously small.
    const tol = Math.abs(z) * EPS
    const absTerm = Math.abs(term)
    if (absTerm < tol && prevAbs < tol) { break }
    prevAbs = absTerm
  }

  return z
}

/**
 * Asymptotic expansion of the Marcum function for large xi. Section 4.1 in
 * https://arxiv.org/pdf/1311.0681.pdf. The Q-series is used for y > x and the
 * P-series for y <= x (the sigma = 0 transition), each computing its tail
 * directly so the complement never amplifies a small value.
 *
 * @method _asymptoticLargeXi
 * @memberof ran.special
 * @param {number} mu The order of the function.
 * @param {number} x First variable.
 * @param {number} y Second variable.
 * @return {Object} Object holding the Marcum P and Q values as `p` and `q`.
 * @private
 */
function _asymptoticLargeXi (mu, x, y) {
  if (y > x) {
    const q = _aelx(mu, x, y, false)
    return { p: 1 - q, q }
  }
  const p = _aelx(mu, x, y, true)
  return { p, q: 1 - p }
}

/**
 * Computes log(1 + u) - u without the cancellation that the direct
 * subtraction suffers for small u.
 *
 * @method _log1pmx
 * @memberof ran.special
 * @param {number} u Argument.
 * @return {number} log(1 + u) - u.
 * @private
 */
function _log1pmx (u) {
  if (u === 0) {
    return 0
  }
  if (Math.abs(u) > 0.5) {
    return Math.log1p(u) - u
  }
  let p = u
  let sum = 0
  for (let k = 2; k < MAX_ITER; k++) {
    p *= u
    const d = (k % 2 === 0 ? -1 : 1) * p / k
    sum += d
    if (Math.abs(d) < Math.abs(sum) * EPS) { break }
  }
  return sum
}

/**
 * Computes the saddle-point variable zeta of the quadrature representation,
 * Eqs. (56), (84) in https://arxiv.org/pdf/1311.0681.pdf, in scaled variables.
 * The half-square is assembled so every term is O((xs - ys + 1)^2), avoiding
 * the cancellation of the raw formula near the transition line ys = xs + 1.
 *
 * @method _zetaxy
 * @memberof ran.special
 * @param {number} xs Scaled first variable x / mu.
 * @param {number} ys Scaled second variable y / mu.
 * @return {number} The value of zeta.
 * @private
 */
function _zetaxy (xs, ys) {
  const w = Math.sqrt(1 + 4 * xs * ys)
  const eps = xs - ys + 1
  const d1 = xs + ys + w
  const d2 = w + 2 * ys - 1
  const halfZetaSq = eps * eps / d1 + 2 * eps * eps / (d1 * d2) + _log1pmx(2 * eps / d2)
  return Math.sign(eps) * Math.sqrt(2 * Math.max(halfZetaSq, 0))
}

/**
 * Quadrature method for the Marcum function. Section 5 in
 * https://arxiv.org/pdf/1311.0681.pdf. Evaluates the trapezoidal integral
 * representation (Eq. 95) and returns both tails, computing the
 * directly-evaluated one without subtraction.
 *
 * @method _pqTrap
 * @memberof ran.special
 * @param {number} mu The order of the function.
 * @param {number} x First variable.
 * @param {number} y Second variable.
 * @return {Object} Object holding the Marcum P and Q values as `p` and `q`.
 * @private
 */
function _pqTrap (mu, x, y) {
  const xs = x / mu
  const ys = y / mu
  const xis2 = 4 * xs * ys
  const wxis = Math.sqrt(1 + xis2)

  // Integrand e^{mu psi(theta)} f(theta) of Eq. (95); even in theta.
  const integrand = theta => {
    const s = Math.sin(theta)
    const cs = Math.cos(theta)
    const g = theta === 0 ? 1 : theta / s
    const rho = Math.sqrt(g * g + xis2)
    const r = (g + rho) / (2 * ys)
    // sin(theta) - theta cos(theta); series below 0.1 where it cancels.
    const t2 = theta * theta
    const smt = Math.abs(theta) < 0.1
      ? theta * t2 * (1 / 3 - t2 / 30 + t2 * t2 / 840)
      : s - theta * cs
    const gp = theta === 0 ? 0 : smt / (s * s)
    const rp = gp * (1 + g / rho) / (2 * ys)
    const psi = cs * rho - wxis - Math.log((g + rho) / (1 + wxis))
    const f = (s * rp + (cs - r) * r) / (r * r - 2 * r * cs + 1)
    return f * Math.exp(mu * psi)
  }

  const zeta = _zetaxy(xs, ys)
  const halfMuZeta2 = 0.5 * mu * zeta * zeta

  // The primary tail underflows: e^{-mu zeta^2 / 2} is below the safe range.
  if (-halfMuZeta2 < Math.log(DELTA)) {
    return y > x + mu ? { p: 1, q: 0 } : { p: 0, q: 1 }
  }

  // The integrand is a peak at theta = 0 of width ~1/sqrt(mu wxis) (since
  // psi''(0) = -wxis); integrate only over its support so the node count
  // stays bounded regardless of mu.
  const b = Math.min(Math.PI, 14 / Math.sqrt(mu * wxis))

  // Q = e^{-mu zeta^2/2} / (2 pi) * integral over [-pi, pi]; integrand is even.
  const pq = trap(integrand, 0, b) * Math.exp(-halfMuZeta2) / Math.PI
  return zeta < 0
    ? { q: pq, p: 1 - pq }
    : { q: 1 + pq, p: -pq }
}

/**
 * Computes the ratio I_nu(z) / I_{nu-1}(z) of modified Bessel functions of the
 * first kind via a continued fraction (modified Lentz). Valid for fractional
 * order, free of overflow because dominant factors cancel in the ratio.
 *
 * @method _fc
 * @memberof ran.special
 * @param {number} nu Order of the Bessel function in the numerator.
 * @param {number} z Argument.
 * @return {number} The ratio I_nu(z) / I_{nu-1}(z).
 * @private
 */
function _fc (nu, z) {
  let m = 0
  let b = 2 * nu / z
  let f = DELTA
  let c = f
  let d = 0
  let delta
  do {
    d = b + d
    if (Math.abs(d) < DELTA) { d = DELTA }
    c = b + 1 / c
    if (Math.abs(c) < DELTA) { c = DELTA }
    d = 1 / d
    delta = c * d
    f *= delta
    m++
    b = 2 * (nu + m) / z
  } while (Math.abs(delta - 1) > EPS && m < MAX_ITER)
  return f
}

/**
 * Recurrence-relation method for the Marcum function. The three-term
 * recurrence Eq. (14) in https://arxiv.org/pdf/1311.0681.pdf is solved
 * backward for its minimal solution P, seeded by the quadrature method at
 * orders raised above the transition band.
 *
 * @method _recurrence
 * @memberof ran.special
 * @param {number} mu The order of the function.
 * @param {number} x First variable.
 * @param {number} y Second variable.
 * @return {Object} Object holding the Marcum P and Q values as `p` and `q`.
 * @private
 */
function _recurrence (mu, x, y) {
  // Raise the starting order so the quadrature seeds fall below the
  // transition band, where quadrature is accurate.
  const nu = y - x + 1 + Math.sqrt(2 * (x + y) + 1)
  const n3 = Math.max(1, Math.floor(nu) + 2 - Math.floor(mu))
  const mur = mu + n3
  const xi = 2 * Math.sqrt(x * y)

  let cmu = Math.sqrt(y / x) * _fc(mur, xi)
  let p1 = _pqTrap(mur + 1, x, y).p
  let p0 = _pqTrap(mur, x, y).p
  let z = p0
  for (let n = 0; n < n3; n++) {
    z = ((1 + cmu) * p0 - p1) / cmu
    p1 = p0
    p0 = z
    cmu = y / (mur - n - 1 + x * cmu)
  }

  return { p: z, q: 1 - z }
}

/**
 * Dispatches the Marcum function computation to the numerical method valid for
 * the (mu, x, y) regime and returns both the P and Q values.
 *
 * @method _marcum
 * @memberof ran.special
 * @param {number} mu The order of the function.
 * @param {number} x First variable.
 * @param {number} y Second variable.
 * @return {Object} Object holding the Marcum P and Q values as `p` and `q`.
 * @private
 */
function _marcum (mu, x, y) {
  // Special cases.
  if (y === 0) {
    return { p: 0, q: 1 }
  }
  if (x === 0) {
    return { p: gammaLowerIncomplete(mu, y), q: gammaUpperIncomplete(mu, y) }
  }

  // Series expansion. Section 3.
  if (x < 30) {
    return _series(mu, x, y)
  }

  // Asymptotic expansion for large xi. Section 4.1.
  const xi = 2 * Math.sqrt(x * y)
  if (xi > 30 && mu * mu < 2 * xi) {
    return _asymptoticLargeXi(mu, x, y)
  }

  // Recurrence relation across the transition band y = x + mu, where the
  // quadrature integrand is near-singular. Eq. (14). The paper restricts this
  // branch to mu < 135 because it covers larger mu with a separate large-mu
  // asymptotic expansion (Section 4.2); that expansion is out of scope here,
  // so the recurrence covers the whole band.
  const s = Math.sqrt(4 * x + 2 * mu)
  if (y > x + mu - s && y < x + mu + s) {
    return _recurrence(mu, x, y)
  }

  // Quadrature. Section 5.
  return _pqTrap(mu, x, y)
}

/**
 * Computes the generalized Marcum-Q function. The dispatcher selects, by the
 * (mu, x, y) regime, the series expansion (Section 3), the large-xi asymptotic
 * expansion (Section 4.1), the recurrence relation (Eq. 14) or the quadrature
 * method (Section 5). Implementation source: https://arxiv.org/pdf/1311.0681.pdf.
 *
 * @method marcumQ
 * @memberof ran.special
 * @param {number} mu The order of the function.
 * @param {number} x First variable.
 * @param {number} y Second variable.
 * @return {number} The generalized Marcum-Q function at the specified values.
 * @private
 */
export default function (mu, x, y) {
  return _marcum(mu, x, y).q
}

/**
 * Computes the complementary generalized Marcum function P_M = 1 − Q_M without
 * forming the subtraction `1 - marcumQ(...)`. Use this in place of
 * `1 - marcumQ(...)` whenever the result is expected to be small (e.g. the
 * lower-tail CDF of noncentral chi-squared family distributions): each
 * computation branch evaluates the smaller of P and Q directly, so the deep
 * lower tail never loses precision to catastrophic cancellation (see #245).
 *
 * @method marcumP
 * @memberof ran.special
 * @param {number} mu The order of the function.
 * @param {number} x First variable.
 * @param {number} y Second variable.
 * @return {number} The complementary Marcum function 1 − Q_M.
 * @private
 */
export function marcumP (mu, x, y) {
  return _marcum(mu, x, y).p
}
