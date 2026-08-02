import { EPS, MAX_ITER, MAX_SERIES_ITER } from '../core/constants'
import gamma from './gamma'
import recursiveSum from '../algorithms/recursive-sum'

/**
 * Computes the modified Bessel function of the first kind with order zero.
 * This algorithm simply applies the definition:
 * https://en.wikipedia.org/wiki/Bessel_function#Modified_Bessel_functions:_I%CE%B1,_K%CE%B1
 *
 * @method _I0
 * @memberof ran.special
 * @param {number} x Value to evaluate the function at.
 * @return {number} The function value.
 * @private
 */
function _I0 (x) {
  let dz = 1
  let z = dz
  for (let m = 1; m < MAX_ITER; m++) {
    dz *= (x / 2) ** 2 / m ** 2
    z += dz
    if (Math.abs(dz / z) < EPS) { break }
  }
  return z
}

// Upward recurrence for the modified spherical Bessel function of the second kind, without
// the exp(-x)/x normalization -- kept separate so besselISphericalExpScaled (#1292) can reuse
// the raw recurrence values without ever forming the exp(-x) factor that _kn applies below.
function _knRaw (n, x) {
  let k1 = 1 + 1 / x
  let k2 = 1
  let k
  for (let i = 2; i <= n; i++) {
    k = (i + i - 1) * k1 / x + k2
    k2 = k1
    k1 = k
  }
  return [k, k2]
}

/**
 * Computes the modified spherical Bessel function of the second kind.
 *
 * @method _kn
 * @memberof ran.special
 * @param {number} n Order of the Bessel function.
 * @param {number} x Value to evaluate the function at.
 * @return {(number|number[])} The function value at the specified order and one order less if order is larger than 1, single function value otherwise.
 * @private
 */
function _kn (n, x) {
  const [k, k2] = _knRaw(n, x)
  return [
    Math.exp(-x) * k / x,
    Math.exp(-x) * k2 / x
  ]
}

/**
 * Computes the ratio of two modified Bessel functions (same for spherical).
 *
 * @method _hi
 * @memberof ran.special
 * @param {number} n Order of the Bessel function in the numerator.
 * @param {number} x Value to evaluate the function at.
 * @return {number} The function value.
 * @private
 */
function _hi (n, x) {
  // Continued fraction (from Numerical methods for special functions)
  // Required depth grows with x, not n (empirically ~6*sqrt(x) steps, mirroring _fc's own
  // slow-convergence fix in marcum-q.js #1286): the shared MAX_ITER=100 silently truncated
  // once x exceeded ~250, losing up to 3 significant digits with no signal. This was previously
  // unreachable through besselISpherical's public callers because the unscaled result overflows
  // to Infinity before x gets this large -- besselISphericalExpScaled (#1292) is what first makes
  // this depth reachable. 7*sqrt(x) + 20 keeps a comfortable margin over the measured worst case.
  const maxIter = Math.max(MAX_ITER, Math.ceil(7 * Math.sqrt(x)) + 20)
  let d = x / (n + n + 1)
  let del = d
  let h = del
  let b = (n + n + 3) / x
  for (let i = 1; i < maxIter; i++) {
    d = 1 / (b + d)
    del = (b * d - 1) * del
    h += del
    b += 2 / x

    if (Math.abs(del / h) < EPS) { break }
  }
  return h
}

// Miller backward recurrence. Normalization via the all-order sum identity
// I_0(x) + 2*(I_1+I_2+...) = e^x (DLMF 10.35.3 at theta=0), computed in
// log-space to avoid exp(x) overflow for x > ~710. Overflow guard rescales
// all four accumulators uniformly, preserving the ratio f_n/S.
// See solutions/special-functions/2026-06-01-1330-bessel-i-miller-normalization-max-iter-truncation.md
// scaled=true returns exp(-x)*I_n(x) directly: y/sum is already exp(-x)*I_n(x) before the
// final `* exp(x)` step below re-inflates it, so skipping that step is exact and free (#1292).
function _besselIBackward (n, x, scaled) {
  const tox = 2 / x
  const overflow = 1 / EPS
  let bi = 1
  let bip = 0
  let y = 0
  let sum = 0
  // j_max must exceed both n and x: when j < x the ratio I_{j+1}/I_j ≈ 1
  // and the backward recurrence hasn't contracted enough to suppress the K_n component.
  // Math.max(n, 1) inside the sqrt: at n=0 the margin term would otherwise degenerate to
  // 0 (sqrt(40*0)=0), leaving no run-up headroom and a ~1e-9 relative-error gap for
  // x in (10, 14] (issue #1185) -- n=0 borrows n=1's already-validated margin instead.
  // See solutions/special-functions/2026-07-26-1839-bessel-i-miller-n0-margin-degeneration.md
  for (let j = 2 * (n + Math.round(Math.sqrt(40 * Math.max(n, 1)))) + Math.ceil(2 * x); j > 0; j--) {
    const bim = bip + j * tox * bi
    bip = bi
    bi = bim
    sum += 2 * bip
    if (j === n) y = bip
    if (Math.abs(bi) > overflow) {
      y *= EPS
      bi *= EPS
      bip *= EPS
      sum *= EPS
    }
  }
  sum += bi
  if (n === 0) y = bi
  return scaled ? y / sum : y * Math.exp(x - Math.log(sum))
}

/**
 * Computes the modified Bessel function of the first kind. Only integer order.
 *
 * @method besselI
 * @memberof ran.special
 * @param {number} n Order of the Bessel function. Must be an integer.
 * @param {number} x Value to evaluate the function at.
 * @return {number} The modified Bessel function of the first kind.
 * @private
 */
export function besselI (n, x) {
  if (n === 0) {
    // _I0 Taylor series is accurate for |x| <= 10; use backward recurrence for large |x|
    // to avoid MAX_ITER truncation before the series peak at m ~ |x|/2.
    const ax = Math.abs(x)
    return ax <= 10 ? _I0(x) : _besselIBackward(0, ax)
  }
  if (x === 0) {
    return 0
  }
  const y = _besselIBackward(n, Math.abs(x))
  // Odd-order modified Bessel functions are odd: I_n(-x) = -I_n(x) for odd n.
  return x < 0 && n % 2 === 1 ? -y : y
}

/**
 * Computes exp(-|x|) * I_n(x): the exponentially scaled modified Bessel function of the
 * first kind. I_n(x) itself overflows Number.MAX_VALUE once |x| exceeds ~710, but a caller
 * whose own prefactor decays like exp(-|x|) can multiply this scaled value back in and
 * recombine the exponents before either factor is materialized (#1292).
 *
 * @method besselIExpScaled
 * @memberof ran.special
 * @param {number} n Order of the Bessel function. Must be an integer.
 * @param {number} x Value to evaluate the function at.
 * @return {number} exp(-|x|) times the modified Bessel function of the first kind.
 * @private
 */
export function besselIExpScaled (n, x) {
  if (n === 0) {
    const ax = Math.abs(x)
    // _I0's Taylor series never overflows for |x| <= 10, so exp(-x) can be applied afterwards.
    return ax <= 10 ? _I0(x) * Math.exp(-ax) : _besselIBackward(0, ax, true)
  }
  if (x === 0) {
    return 0
  }
  const y = _besselIBackward(n, Math.abs(x), true)
  return x < 0 && n % 2 === 1 ? -y : y
}

// Relative error of the n=1 closed-form (cosh(x)-sinh(x)/x)/x from catastrophic
// cancellation grows as 2ε/(x²/3). Using Taylor series for |x| < 1 keeps the
// relative error below 2ε everywhere in that range; the series converges with
// ratio x²/(2(k+1)(2n+2k+3)) per step, which is at most 1/10 per step at x=1.
// solutions/special-functions/2026-05-28-0000-besselISpherical-small-x-taylor.md
const _BESSEL_I_SPH_THRESHOLD = 1

// Taylor series Σ_{k=0}^∞ x^{n+2k} / (2^k k! (2n+2k+1)!!) for i_n(x), n >= 1.
// Naturally returns 0 at x = 0 without a special-case guard.
function _besselISphericalTaylor (n, x) {
  let t = 1
  for (let j = 1; j <= n; j++) {
    t *= x / (2 * j + 1)
  }
  let sum = t
  const x2 = x * x
  for (let k = 0; k < MAX_ITER && Math.abs(t) > EPS * Math.abs(sum); k++) {
    t *= x2 / (2 * (k + 1) * (2 * n + 2 * k + 3))
    sum += t
  }
  return sum
}

/**
 * Computes the modified spherical Bessel function of the first kind. Only integer order is supported.
 * Source: http://cpc.cs.qub.ac.uk/summaries/ADGM_v1_0.html (Numerical methods for special functions).
 *
 * @method besselISpherical
 * @memberof ran.special
 * @param {number} n Order of the spherical Bessel function. Must be an integer.
 * @param {number} x Value to evaluate the function at.
 * @returns {number} The modified spherical Bessel function of the first kind.
 * @private
 */
export function besselISpherical (n, x) {
  switch (n) {
    case 0:
      return x === 0 ? 1 : Math.sinh(x) / x
    case 1:
      return Math.abs(x) < _BESSEL_I_SPH_THRESHOLD
        ? _besselISphericalTaylor(1, x)
        : (Math.cosh(x) - Math.sinh(x) / x) / x
    default:
      if (n > 0) {
        if (Math.abs(x) < _BESSEL_I_SPH_THRESHOLD) {
          return _besselISphericalTaylor(n, x)
        }
        // Use Wronskian with single run k-calculation
        const k = _kn(n + 1, x)
        return 1 / (x * x * (_hi(n + 1, x) * k[1] + k[0]))
      } else {
        // Backward recurrence for negative orders
        return (n + n + 3) * besselISpherical(n + 1, x) / x + besselISpherical(n + 2, x)
      }
  }
}

/**
 * Computes exp(-x) * i_n(x): the exponentially scaled modified spherical Bessel function of
 * the first kind, for x >= 0 -- the only domain the noncentral-chi distributions' sqrt(lambda*x)
 * argument ever produces. i_n(x) itself overflows once x exceeds ~710; this stays
 * representable so a caller whose own prefactor decays like exp(-x) can recombine the
 * exponents before either factor is materialized (#1292).
 *
 * @method besselISphericalExpScaled
 * @memberof ran.special
 * @param {number} n Order of the spherical Bessel function. Must be an integer.
 * @param {number} x Non-negative value to evaluate the function at.
 * @returns {number} exp(-x) times the modified spherical Bessel function of the first kind.
 * @private
 */
export function besselISphericalExpScaled (n, x) {
  switch (n) {
    case 0:
      return x === 0 ? 1 : (1 - Math.exp(-2 * x)) / (2 * x)
    case 1:
      if (Math.abs(x) < _BESSEL_I_SPH_THRESHOLD) {
        return _besselISphericalTaylor(1, x) * Math.exp(-x)
      }
      // cosh(x)*exp(-x) = (1+e^-2x)/2 and sinh(x)*exp(-x) = (1-e^-2x)/2 are both bounded,
      // unlike cosh(x)/sinh(x) themselves which overflow for the x this branch is reached at.
      return (1 + Math.exp(-2 * x)) / (2 * x) - (1 - Math.exp(-2 * x)) / (2 * x * x)
    default:
      if (n < 0) {
        // Backward recurrence for negative orders (same recurrence as besselISpherical: linear,
        // so it holds unchanged for the exp(-x)-scaled quantities substituted throughout).
        return (n + n + 3) * besselISphericalExpScaled(n + 1, x) / x + besselISphericalExpScaled(n + 2, x)
      }
      if (Math.abs(x) < _BESSEL_I_SPH_THRESHOLD) {
        return _besselISphericalTaylor(n, x) * Math.exp(-x)
      }
      // Same Wronskian as besselISpherical, built from _knRaw's un-normalized values so the
      // exp(-x) that _kn would otherwise apply -- and this function would have to invert
      // straight back out via the 1/(...) -- never has to be materialized.
      return _besselISphericalExpScaledWronskian(n, x)
  }
}

// Extracted from besselISphericalExpScaled's default branch to keep that function's own
// nesting shallow (CodeScene Bumpy Road) -- the n>0, |x|>=threshold Wronskian case.
function _besselISphericalExpScaledWronskian (n, x) {
  const [k, k2] = _knRaw(n + 1, x)
  return 1 / (x * (_hi(n + 1, x) * k2 + k))
}

// Crossover from series to asymptotic expansion for K_0 and K_1.
// Below X_K_SERIES the combined-series form (DLMF §10.31.2) retains ≥10 significant
// figures; above it, the series accumulates O(e^{2x}) intermediate values that nearly
// cancel against the tiny e^{-x} result, losing all precision.
// See solutions/special-functions/2026-07-05-1530-bessel-k-second-kind-cancellation-strategy.md
const _X_K_SERIES = 6

/**
 * Asymptotic expansion of K_ν(x) for large x (DLMF §10.40.2):
 *   K_ν(x) ~ sqrt(π/(2x)) * exp(-x) * Σ_{k=0}^M a_k(ν) / x^k
 * where a_0 = 1 and a_{k+1} = a_k * (4ν² − (2k+1)²) / (8(k+1)x).
 * Optimal truncation (stop when |a_{k+1}/x| ≥ |a_k/x^k|) bounds the error by the
 * first omitted term, avoiding divergence of the asymptotic series.
 *
 * @method _KAsymptotic
 * @memberof ran.special
 * @param {number} nu Order (real).
 * @param {number} x Positive value to evaluate at.
 * @returns {number} K_nu(x).
 * @private
 */
function _KAsymptotic (nu, x) {
  const nu2 = 4 * nu * nu
  let term = 1
  let sum = 1
  for (let k = 1; k < MAX_ITER; k++) {
    const next = term * (nu2 - (2 * k - 1) * (2 * k - 1)) / (8 * k * x)
    // Optimal truncation: stop when the asymptotic series starts to diverge
    if (Math.abs(next) >= Math.abs(term)) { break }
    term = next
    sum += term
    if (Math.abs(term) < EPS * Math.abs(sum)) { break }
  }
  return Math.sqrt(Math.PI / (2 * x)) * Math.exp(-x) * sum
}

/**
 * Computes the modified Bessel function of the second kind with order zero.
 * For x ≤ _X_K_SERIES: combined series K_0(x) = Σ_{k=0}^∞ (x²/4)^k / (k!)² · (H_k − lnh)
 * where H_k are harmonic numbers and lnh = ln(x/2) + γ (DLMF §10.31.2).
 * The combined form avoids catastrophic cancellation by grouping the two large terms.
 * For x > _X_K_SERIES: asymptotic expansion (DLMF §10.40.2).
 *
 * @method _K0
 * @memberof ran.special
 * @param {number} x Positive value to evaluate at.
 * @returns {number} K_0(x).
 * @private
 */
function _K0 (x) {
  if (x > _X_K_SERIES) { return _KAsymptotic(0, x) }
  const x2 = x * x / 4
  // ln(x/2) + γ, where γ = 0.5772156649015329 (Euler–Mascheroni constant)
  const lnh = Math.log(x / 2) + 0.5772156649015329
  return recursiveSum(
    { t: 1, h: 0 },
    (s, i) => {
      s.h += 1 / i
      s.t *= x2 / (i * i)
      return s
    },
    s => s.t * (s.h - lnh)
  )
}

/**
 * Computes the modified Bessel function of the second kind with order one.
 * For x ≤ _X_K_SERIES: combined series K_1(x) = 1/x + (x/2)·Σ_{k=0}^∞ (x²/4)^k / (k!(k+1)!)
 * · [(ln(x/2)+γ) − (H_k+H_{k+1})/2] where H_k are harmonic numbers (DLMF §10.31.2).
 * For x > _X_K_SERIES: asymptotic expansion (DLMF §10.40.2).
 *
 * @method _K1
 * @memberof ran.special
 * @param {number} x Positive value to evaluate at.
 * @returns {number} K_1(x).
 * @private
 */
function _K1 (x) {
  if (x > _X_K_SERIES) { return _KAsymptotic(1, x) }
  const x2 = x * x / 4
  const lnh = Math.log(x / 2) + 0.5772156649015329
  const sum = recursiveSum(
    { t: 1, hk: 0, hk1: 1 },
    (s, i) => {
      s.hk = s.hk1
      s.hk1 += 1 / (i + 1)
      s.t *= x2 / (i * (i + 1))
      return s
    },
    s => s.t * (lnh - (s.hk + s.hk1) / 2)
  )
  return 1 / x + (x / 2) * sum
}

/**
 * Computes the modified Bessel function of the second kind. Only integer order.
 *
 * @method besselK
 * @memberof ran.special
 * @param {number} n Order of the Bessel function. Must be a non-negative integer.
 * @param {number} x Value to evaluate the function at.
 * @returns {number} The modified Bessel function of the second kind.
 * @private
 */
export function besselK (n, x) {
  if (x === 0) return Infinity
  if (n === 0) return _K0(x)
  if (n === 1) return _K1(x)
  // Upward recurrence K_{n+1}(x) = (2n/x)*K_n(x) + K_{n-1}(x) is forward-stable
  // for K because K grows with n (dominant component is preserved). DLMF §10.29.1.
  let k0 = _K0(x)
  let k1 = _K1(x)
  for (let i = 1; i < n; i++) {
    const k = (2 * i / x) * k1 + k0
    k0 = k1
    k1 = k
  }
  return k1
}

/**
 * Computes the modified Bessel function of the second kind for real order.
 * Uses the connection formula K_ν(x) = (π/2)·(I_{-ν}(x) − I_ν(x))/sin(νπ) (DLMF 10.27.4).
 * Dispatches to `besselK` for near-integer ν to avoid the 0/0 indeterminate form.
 *
 * @method besselKnu
 * @memberof ran.special
 * @param {number} nu Order of the Bessel function. Should be fractional.
 * @param {number} x Value to evaluate the function at.
 * @returns {number} The modified Bessel function of the second kind.
 * @private
 */
export function besselKnu (nu, x) {
  if (x === 0) return Infinity
  // Near-integer ν: connection formula becomes 0/0; dispatch to integer path.
  // Use Math.abs so negative integers forward the correct non-negative order to besselK.
  if (Math.abs(nu - Math.round(nu)) < 1e-8) {
    return besselK(Math.abs(Math.round(nu)), x)
  }
  // Large x: connection formula loses ~2x/ln(10) digits from catastrophic cancellation
  // between I_{-ν}(x) and I_ν(x) (both O(exp(x)) while K_ν is O(exp(-x))).
  // Asymptotic expansion avoids this and terminates exactly for half-integer ν.
  if (x > _X_K_SERIES) {
    return _KAsymptotic(nu, x)
  }
  return (Math.PI / 2) * (besselInu(-nu, x) - besselInu(nu, x)) / Math.sin(Math.PI * nu)
}

/**
 * Computes the modified Bessel function of the first kind for fractional order.
 *
 * @method besselInu
 * @memberof ran.special
 * @param {number} nu Order of the Bessel function. Should be fractional.
 * @param {number} x Value to evaluate the function at.
 * @returns {number} The modified Bessel function of the first kind.
 * @private
 */
// Taylor series converges for x ≤ ~710 with MAX_SERIES_ITER=500; see
// solutions/testing/2026-06-02-1200-besselInu-infrastructure-fix-coverage-gap.md -- but for
// very negative fractional nu, I_nu(x) itself stays far below Number.MAX_VALUE at x~710 even
// though the *unnormalized* series sum (before the tiny (x/2)^nu prefactor is applied) does
// not, so a hand-written loop tracks a log-scale offset and rescales in lockstep whenever the
// running sum approaches double overflow, mirroring _besselIBackward's pattern above. The
// rescale threshold is chosen close to Number.MAX_VALUE rather than 1/EPS (as _besselIBackward
// uses) because 1/EPS triggers far more rescale round-trips than this series' magnitude range
// actually needs, and each round-trip's log/exp pair compounds rounding error.
// See solutions/special-functions/2026-07-29-0810-besselinu-negative-order-overflow.md
const _BESSEL_INU_OVERFLOW_GUARD = 1e290

// Accumulates besselInu's unnormalized Taylor series sum, rescaling the running sum and
// current term in lockstep (mirroring _besselIBackward's pattern above) whenever the sum
// approaches double overflow, and tracking the accumulated log-scale offset for the caller
// to fold into its final combination.
function _besselInuSeries (nu, x) {
  const x2 = x * x / 4
  const logEPS = -Math.log(EPS)
  let c = 1 / gamma(nu + 1)
  let sum = c
  let logScale = 0
  for (let i = 1; i < MAX_SERIES_ITER; i++) {
    c *= x2 / (i * (nu + i))
    sum += c
    if (Math.abs(sum) > _BESSEL_INU_OVERFLOW_GUARD) {
      sum *= EPS
      c *= EPS
      logScale += logEPS
    }
    if (Math.abs(c) < EPS * Math.abs(sum)) { break }
  }
  return { sum, logScale }
}

export function besselInu (nu, x) {
  // x=0: every series term past the zeroth vanishes, so the old
  // Math.pow(x/2, nu) * recursiveSum(...) reduces to Math.pow(0, nu) * (1/gamma(nu+1)) --
  // preserved verbatim here since gamma(nu+1) can be negative (e.g. nu=-1.5), which the
  // log-space combination below cannot express through 0 * -Infinity.
  if (x === 0) {
    return Math.pow(0, nu) * (1 / gamma(nu + 1))
  }

  const { sum, logScale } = _besselInuSeries(nu, x)
  // No rescale occurred: combine directly (bit-identical to the pre-fix formula) rather than
  // through log/exp, which loses a couple of ULP that besselKnu's connection-formula
  // cancellation (bessel.js:343) amplifies past its precision-gate tolerance.
  //
  // Math.sign(sum) in the rescaled branch below: for negative fractional nu the first ~|nu|
  // terms (i < -nu) alternate sign because (nu+i) is negative there, but a numerical scan of
  // nu in [-50.9, -0.1] crossed with x stepping from 1 to 715 (in 0.25 increments) -- recording
  // the sign of `sum` at the exact iteration where |sum| first exceeds the 1e290 guard -- found
  // sum strictly positive at every single rescale event (186017 of them) across that whole
  // range. The reason: once i > -nu the term ratio x2/(i*(nu+i)) turns positive and stays
  // positive, and growth toward the 1e290 threshold only happens near the series' peak term at
  // i ~ x/2 -- which for the x large enough to trigger a rescale at all (empirically x >~ 400,
  // given MAX_SERIES_ITER=500 caps how many terms can run) is always far beyond the handful of
  // alternating terms at the start. This does NOT extend to arbitrarily large |nu|: the same
  // scan pushed to nu down to -100 found the property first breaks around nu ~ -82, where the
  // near-zero denominator at i ~ -nu produces a term spike large enough to trigger the rescale
  // by itself while still inside the alternating phase. No caller in this codebase invokes
  // besselInu with an order anywhere near that magnitude (besselKnu, its only internal caller,
  // uses modest fractional orders such as 0.25).
  return logScale === 0
    ? Math.pow(x / 2, nu) * sum
    : Math.sign(sum) * Math.exp(nu * Math.log(x / 2) + Math.log(Math.abs(sum)) + logScale)
}
