import { MAX_ITER, EPS } from '../core/constants'
import logGamma from './log-gamma'

// Loader (2000) saddle-point decomposition of the incomplete-gamma prefactor,
// extracted for gamma-incomplete.js's _gli/_gui (#1348) and marcum-q.js's _zetaxy
// (log1pmx only, relocated verbatim from that file's former private _log1pmx).

/**
 * Computes log(1 + u) - u without the cancellation that the direct
 * subtraction suffers for small u.
 *
 * @method log1pmx
 * @memberof ran.special
 * @param {number} u Argument.
 * @return {number} log(1 + u) - u.
 * @private
 */
export function log1pmx (u) {
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
 * Computes the Stirling series remainder stirlerr(s), defined by
 * logGamma(s) = (s - 1/2)*log(s) - s + (1/2)*log(2*pi) + stirlerr(s). Below s=15 the
 * direct difference is already exact to machine precision (logGamma(s) itself is far
 * from the magnitude where subtracting it from (s-1/2)*log(s)-s would cancel); at and
 * above s=15 the asymptotic series is used instead, verified against mpmath (mp.dps=50)
 * to carry <2.3e-15 relative error in stirlerr itself at s=15 and improving as s grows
 * (Abramowitz & Stegun 6.1.42).
 *
 * @method stirlerr
 * @memberof ran.special
 * @param {number} s Argument (s > 0).
 * @return {number} The Stirling series remainder.
 * @private
 */
export function stirlerr (s) {
  if (s < 15) {
    return logGamma(s) - (s - 0.5) * Math.log(s) + s - 0.5 * Math.log(2 * Math.PI)
  }
  const s2 = s * s
  return (1 / 12 - (1 / 360 - (1 / 1260 - (1 / 1680 - (1 / 1188) / s2) / s2) / s2) / s2) / s
}

/**
 * Computes the binomial-deviance term s*D(x/s) = x - s - s*log(x/s) (Loader 2000).
 * D(t) = t - 1 - log(t) only needs log1pmx's cancellation-safe form near t=1, where
 * x - s and s*log(x/s) both individually vanish; outside t in [0.5, 2] the direct
 * formula has no cancellation (Sterbenz's lemma covers x - s once t is within that
 * range of 1, and log(t) is well-conditioned everywhere). Routing every t through
 * log1pmx(t - 1) regardless would itself lose accuracy for t far from 1: t - 1 rounds
 * to exactly -1 once t drops below ~1e-16 (x many orders of magnitude below s), and
 * log1pmx(-1) = -Infinity discards the tiny-but-nonzero true result entirely.
 *
 * @method bd0
 * @memberof ran.special
 * @param {number} s Reference value.
 * @param {number} x Evaluation point.
 * @return {number} The binomial-deviance term.
 * @private
 */
export function bd0 (s, x) {
  const t = x / s
  if (t < 0.5 || t > 2) {
    return x - s - s * Math.log(t)
  }
  return -s * log1pmx(t - 1)
}
