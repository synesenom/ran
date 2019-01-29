/**
 * A collection of random number generators for well-known distributions.
 *
 * @namespace dist
 * @memberOf ran
 */
export { default as InvalidDiscrete } from './dist/_invalid'
export { default as Arcsine } from './dist/arcsine'
export { default as Bates } from './dist/bates'
export { default as Bernoulli } from './dist/bernoulli'
export { default as Beta } from './dist/beta'
export { default as BetaPrime } from './dist/beta-prime'
export { default as Binomial } from './dist/binomial'
export { default as BoundedPareto } from './dist/bounded-pareto'
export { default as Burr } from './dist/burr'
export { default as Cauchy } from './dist/cauchy'
export { default as Chi2 } from './dist/chi2'
export { default as Custom } from './dist/custom'
export { default as Degenerate } from './dist/degenerate'
export { default as Erlang } from './dist/erlang'
export { default as Exponential } from './dist/exponential'
export { default as F } from './dist/f'
export { default as Frechet } from './dist/frechet'
export { default as Gamma } from './dist/gamma'
export { default as GeneralizedGamma } from './dist/generalized-gamma'
export { default as Geometric } from './dist/geometric'
export { default as Gompertz } from './dist/gompertz'
export { default as Gumbel } from './dist/gumbel'
export { default as InverseChi2 } from './dist/inverse-chi2'
export { default as InverseGamma } from './dist/inverse-gamma'
export { default as InverseGaussian } from './dist/inverse-gamma'
export { default as IrwinHall } from './dist/irwin-hall'
export { default as Kumaraswamy } from './dist/kumaraswamy'
export { default as Laplace } from './dist/laplace'
export { default as Logarithmic } from './dist/logarithmic'
export { default as LogCauchy } from './dist/log-cauchy'
export { default as Logistic } from './dist/logistict'
export { default as LogLogistic } from './dist/log-logistic'
export { default as LogNormal } from './dist/log-normal'
export { default as Lomax } from './dist/lomax'
export { default as Makeham } from './dist/makeham'
export { default as MaxwellBoltzmann } from './dist/maxwell-boltzmann'
export { default as Normal } from './dist/normal'
export { default as Pareto } from './dist/pareto'
export { default as Poisson } from './dist/poisson'
export { default as Rademacher } from './dist/rademacher'
export { default as Rayleigh } from './dist/rayleigh'
export { default as UniformContinuous } from './dist/uniform-continuous'
export { default as UniformDiscrete } from './dist/uniform-discrete'
export { default as Weibull } from './dist/weibull'

// TODO Benford                               (can be directly implemented)
// TODO Beta-binomial                         (generation unknown)
// TODO Beta-pascal / Beta negative binomial  (generation unknown)
// TODO Birnbaum-Saunders                     (requires inverse erf)
// TODO Boltzmann                             (special case of Custom)
// TODO Borel                                 (generation unknown)
// TODO Chi                                   (can be directly implemented using normal variates)
// TODO Dagum                                 (can be directly implemented)
// TODO Discrete Weibull                      (can be directly implemented)
// TODO Exponential logarithmic               (can be directly implemented)
// TODO Error / exponential power             (generation unknown)
// TODO Gamma/Gompertz                        (can be directly implemented)
// TODO Gamma-Poisson / negative binomial / Pascal / Polya   (can be directly implemented)
// TODO Generalized Pareto                    (can be directly implemented)
// TODO Hyperbolic-secant                     (can be directly implemented)
// TODO Hypergeometric                        (can be directly implemented)
// TODO Johnson's SB                          (can be directly implemented)
// TODO Johnson's SU                          (can be directly implemented)
// TODO Levy                                  (can be directly implemented)
// TODO Log gamma                             (can be directly implemented)
// TODO Log-Laplace                           (can be directly implemented)
// TODO Logarithmic (continuous)              (requires lambertW function)
// TODO Logarithmic (discrete)                (generation unknown)
// TODO Logistic-exponential                  (can be directly implemented)
// TODO Logit-normal                          (can be directly implemented)
// TODO Muth                                  (requires lambertW function)
// TODO Nakagami                              (can be directly implemented using gamma)
// TODO Negative hypergeometric               (can be directly implemented)
// TODO Student's t                           (requires hypergeometric function)
// TODO triangular                            (can be directly implemented)
// TODO Raised cosine                         (generation unknown)
// TODO Reciprocal                            (can be directly implemented)
// TODO Skellam                               (requires modified Bessel, cdf unkown)
// TODO Soliton                               (special case of custom)
// TODO U-quadratic                           (can be directly implemented)
// TODO von Mises                             (generation is unknown)
// TODO Wigner semicircle                     (can be directly implemented using beta variate)
// TODO Yule-Simon                            (can be directly implemented using exponential and geometric)
// TODO Zeta                                  (requires zeta function, harmonic number)
// TODO Zipf                                  (requires zeta function, harmonic number)
