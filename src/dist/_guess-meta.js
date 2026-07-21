/**
 * Curated, non-exhaustive family-level classification of distributions used by guess()'s
 * soft pre-filters. A distribution family's skewness sign or dispersion pattern is a fact
 * about the family as a whole (e.g. Normal is symmetric for every valid mu/sigma), not
 * something derivable from a single fitted instance — so it is recorded here by name
 * rather than computed. A distribution absent from every set below simply receives no
 * soft filter: an incomplete table only weakens pruning efficiency, never correctness,
 * since the BIC-weight/p-value ranking stage still surfaces a poor fit.
 *
 * @var {Set<string>} SYMMETRIC
 * @memberof ran.dist
 * @private
 */
export const SYMMETRIC = new Set(['Normal', 'Uniform', 'Laplace'])

/**
 * Distributions whose skewness is positive for every valid parameterization.
 *
 * @var {Set<string>} POSITIVE_SKEW_ONLY
 * @memberof ran.dist
 * @private
 */
export const POSITIVE_SKEW_ONLY = new Set([
  'Exponential', 'Gamma', 'LogNormal', 'Poisson', 'Zipf', 'Chi2'
])

/**
 * Distributions whose coefficient of variation is always approximately 1, regardless of
 * their rate/scale parameter (the memoryless Exponential family).
 *
 * @var {Set<string>} CV_ONE_FAMILY
 * @memberof ran.dist
 * @private
 */
export const CV_ONE_FAMILY = new Set(['Exponential'])

/**
 * Discrete distributions whose variance-to-mean ratio (dispersion index) is always
 * approximately 1 (equidispersed, like Poisson).
 *
 * @var {Set<string>} POISSON_LIKE
 * @memberof ran.dist
 * @private
 */
export const POISSON_LIKE = new Set(['Poisson'])

/**
 * Discrete distributions whose variance-to-mean ratio (dispersion index) is always
 * greater than 1 (overdispersed relative to Poisson).
 *
 * @var {Set<string>} NEGATIVE_BINOMIAL_LIKE
 * @memberof ran.dist
 * @private
 */
export const NEGATIVE_BINOMIAL_LIKE = new Set(['NegativeBinomial'])
