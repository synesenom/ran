/**
 * Curated, non-exhaustive family-level classification of distributions used by guess()'s
 * soft pre-filters. A distribution family's skewness sign or dispersion pattern is a fact
 * about the family as a whole (e.g. Normal is symmetric for every valid mu/sigma), not
 * something derivable from a single fitted instance — so it is recorded here by name
 * rather than computed. A distribution absent from every set/map below simply receives no
 * soft filter: an incomplete table only weakens pruning efficiency, never correctness,
 * since the BIC-weight/p-value ranking stage still surfaces a poor fit.
 *
 * Maps each symmetric family to its exact asymptotic skewness-estimator variance factor
 * `Var(g1)·n ≈ μ6/μ2³ − 6·μ4/μ2² + 9` (population central moments μ2/μ4/μ6), rather than
 * assuming the normal-only value of 6 for every member — Laplace's heavier tails inflate
 * this to 63 (issue #1064), so a single shared threshold either over-excludes Laplace or
 * under-excludes Normal. Each value is scale/location invariant, so the constant does not
 * depend on the family's parameterization:
 * - Normal: μ2=1, μ4=3, μ6=15 → 15 − 6·3 + 9 = 6
 * - Uniform: μ2=1/3, μ4=1/5, μ6=1/7 → 27/7 − 6·(9/5) + 9 = 72/35
 * - Laplace: μ2=2, μ4=24, μ6=720 → 90 − 6·36 + 9 = 63 (using E[X^2k] = (2k)!·b^{2k})
 *
 * @var {Map<string, number>} SYMMETRIC
 * @memberof ran.dist
 * @private
 */
export const SYMMETRIC = new Map([
  ['Normal', 6],
  ['Uniform', 72 / 35],
  ['Laplace', 63]
])

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
