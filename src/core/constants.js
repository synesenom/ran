/**
 * Maximum number of iterations in function approximations.
 *
 * @var {number} MAX_ITER
 * @memberof ran.special
 * @private
 */
export const MAX_ITER = 100

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
