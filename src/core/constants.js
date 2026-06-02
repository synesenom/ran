/**
 * Maximum number of iterations in function approximations.
 *
 * @var {number} MAX_ITER
 * @memberof ran.special
 * @private
 */
export const MAX_ITER = 100

/**
 * Maximum number of iterations for series summation (hypergeometric, noncentral distribution CDFs). Higher
 * than MAX_ITER because series like the Kummer ₁F₁ Taylor sum or the Poisson-weighted noncentral CDF sum
 * can require O(|z|) or O(λ) terms to converge — well above the 100-term general cap.
 *
 * @var {number} MAX_SERIES_ITER
 * @memberof ran.special
 * @private
 */
export const MAX_SERIES_ITER = 500

/**
 * Error tolerance in function approximations.
 *
 * @var {number} EPS
 * @memberof ran.special
 * @private
 */
export const EPS = Number.EPSILON

/**
 * Safe underflow limit .
 *
 * @var {number} DELTA
 * @memberof ran.special
 * @private
 */
export const DELTA = 1e-30

/**
 * Safe overflow limit.
 *
 * @var {number} K
 * @memberof ran.special
 * @private
 */
export const K = 1e+300
