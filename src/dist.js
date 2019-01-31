/**
 * A collection of random number generators for well-known distributions.
 *
 * @namespace dist
 * @memberOf ran
 */
export { default as InvalidDiscrete } from './dist/_invalid'
export { default as Arcsine } from './dist/arcsine'
export { default as Bates } from './dist/bates'
export { default as Benini } from './dist/benini'
export { default as Bernoulli } from './dist/bernoulli'
export { default as Beta } from './dist/beta'
export { default as BetaPrime } from './dist/beta-prime'
export { default as Binomial } from './dist/binomial'
export { default as BoundedPareto } from './dist/bounded-pareto'
export { default as Burr } from './dist/burr'
export { default as Cauchy } from './dist/cauchy'
export { default as Chi } from './dist/chi'
export { default as Chi2 } from './dist/chi2'
export { default as ContinuousUniform } from './dist/continuous-uniform'
export { default as Custom } from './dist/custom'
export { default as Dagum } from './dist/dagum'
export { default as Degenerate } from './dist/degenerate'
export { default as DiscreteUniform } from './dist/discrete-uniform'
export { default as DiscreteWeibull } from './dist/discrete-weibull'
export { default as Erlang } from './dist/erlang'
export { default as Exponential } from './dist/exponential'
export { default as ExponentialLogarithmic } from './dist/exponential-logarithmic'
export { default as F } from './dist/f'
export { default as Frechet } from './dist/frechet'
export { default as Gamma } from './dist/gamma'
export { default as GammaGompertz } from './dist/gamma-gompertz'
export { default as GeneralizedGamma } from './dist/generalized-gamma'
export { default as Geometric } from './dist/geometric'
export { default as Gompertz } from './dist/gompertz'
export { default as Gumbel } from './dist/gumbel'
export { default as HalfNormal } from './dist/half-normal'
export { default as Hoyt } from './dist/hoyt'
export { default as Hypergeometric } from './dist/hypergeometric'
export { default as InverseChi2 } from './dist/inverse-chi2'
export { default as InverseGamma } from './dist/inverse-gamma'
export { default as InverseGaussian } from './dist/inverse-gamma'
export { default as IrwinHall } from './dist/irwin-hall'
export { default as JohnsonsSU } from './dist/johnsons-su'
export { default as Kumaraswamy } from './dist/kumaraswamy'
export { default as Laplace } from './dist/laplace'
export { default as Levy } from './dist/levy'
export { default as Logarithmic } from './dist/logarithmic'
export { default as LogCauchy } from './dist/log-cauchy'
export { default as Logistic } from './dist/logistict'
export { default as LogisticExponential } from './dist/logistic-exponential'
export { default as LogitNormal } from './dist/logit-normal'
export { default as LogLaplace } from './dist/log-laplace'
export { default as LogLogistic } from './dist/log-logistic'
export { default as LogNormal } from './dist/log-normal'
export { default as Lomax } from './dist/lomax'
export { default as Makeham } from './dist/makeham'
export { default as MaxwellBoltzmann } from './dist/maxwell-boltzmann'
export { default as Nakagami } from './dist/nakagami'
export { default as NegativeBinomial } from './dist/negative-binomial'
export { default as NegativeHypergeometric } from './dist/negative-hypergeometric'
export { default as Normal } from './dist/normal'
export { default as Pareto } from './dist/pareto'
export { default as Poisson } from './dist/poisson'
export { default as Rademacher } from './dist/rademacher'
export { default as Rayleigh } from './dist/rayleigh'
export { default as Reciprocal } from './dist/reciprocal'
export { default as Soliton } from './dist/soliton'
export { default as Weibull } from './dist/weibull'
export { default as WignerSemicircle } from './dist/wigner-semicircle'
export { default as YuleSimon } from './dist/yule-simon'

// TODO Make pdf/cdf more robust when large numbers are included
// TODO Robustness: check if value is finite
// TODO Robustness: check if value is NaN
// TODO Robustness: use logarithmic values
// TODO Make use of compound distributions
// TODO Simplify computations in pdf/cdf
// TODO Check parameter domains
// TODO Make equations more visible

// TODO Benford                               (can be directly implemented)
// TODO Generalized Pareto                    (can be directly implemented)
// TODO Hyperbolic-secant                     (can be directly implemented)
// TODO Johnson's SB                          (can be directly implemented)
// TODO Log gamma                             (can be directly implemented)
// TODO triangular                            (can be directly implemented)
// TODO U-quadratic                           (can be directly implemented)

// TODO Benini                                (inverse transform)
// TODO Half-logistic                         (inverse transform)
// TODO Fisher's z                            (transformed from F)
// TODO Flory-Schulz                          (lambertW)
// TODO Benktander 1nd kind                   (lambertW)
// TODO Benktander 2nd kind                   (lambertW)

// TODO Beta-rectangular                      (compound)
// TODO Delaporte                             (compound)
// TODO Normal-exponential-gamma              (compound)
// TODO slash                                 (compound: normal/uniform)

// TODO Tukey                                 (pdf/cdf are not trivial)

// TODO Hermite                               (requires higher order derivative)
// TODO Planck                                (zeta)
// TODO Zeta                                  (zeta, harmonic number)
// TODO Zipf                                  (zeta, harmonic number)
// TODO von Mises                             (modified Bessel of k)
// TODO Skellam                               (modified Bessel of first)
// TODO Student's t                           (hypergeometric function)

// TODO Birnbaum-Saunders                     (requires inverse erf)

// TODO Muth                                  (not-invertible cdf)

// TODO Beta-binomial                         (generation unknown)
// TODO Beta-pascal / Beta negative binomial  (generation unknown)
// TODO Borel                                 (generation unknown)
// TODO Davis                                 (generation unknown)
// TODO Error / exponential power             (generation unknown)

// TODO Logarithmic (discrete)                (generation unknown)
// TODO PERT distribution                     (generation unknown)
// TODO Raised cosine                         (generation unknown)
// TODO stable                                (generation unknown)
// TODO ref: http://www.nrbook.com/devroye/Devroye_files/chapter_ten.pdf
