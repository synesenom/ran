declare module 'ranjs' {
  // ---- ran.dist -------------------------------------------------------

  export namespace dist {
    type DistributionType = 'continuous' | 'discrete'

    interface SupportBound {
      value: number
      closed: boolean
    }

    interface DistributionState {
      prngState: unknown
      params: Record<string, unknown>
      constants: unknown[]
      support: SupportBound[]
    }

    interface TestResult {
      statistics: number
      passed: boolean
    }

    class Distribution {
      type(): DistributionType
      support(): SupportBound[]
      seed(value: number | string): this
      save(): DistributionState
      load(state: DistributionState): this
      sample(): number
      sample(n: 1): number
      sample(n: number): number | number[]
      pdf(x: number): number
      cdf(x: number): number
      q(p: number): number | undefined
      survival(x: number): number
      hazard(x: number): number
      cHazard(x: number): number
      lnPdf(x: number): number
      lnL(data: number[]): number
      aic(data: number[]): number
      bic(data: number[]): number
      test(values: number[]): TestResult
    }

    // Distribution classes — alphabetical

    class Alpha extends Distribution { constructor(alpha: number, beta: number) }
    class Anglit extends Distribution { constructor() }
    class Arcsine extends Distribution { constructor(a: number, b: number) }
    class BaldingNichols extends Distribution { constructor(F: number, p: number) }
    class Bates extends Distribution { constructor(n: number, a: number, b: number) }
    class Benini extends Distribution { constructor(alpha: number, beta: number, sigma: number) }
    class BenktanderII extends Distribution { constructor(a: number, b: number) }
    class Bernoulli extends Distribution { constructor(p: number) }
    class Beta extends Distribution { constructor(alpha: number, beta: number) }
    class BetaBinomial extends Distribution { constructor(n: number, alpha: number, beta: number) }
    class BetaPrime extends Distribution { constructor(alpha: number, beta: number) }
    class BetaRectangular extends Distribution { constructor(alpha: number, beta: number, theta: number, a: number, b: number) }
    class Binomial extends Distribution { constructor(n: number, p: number) }
    class BirnbaumSaunders extends Distribution { constructor(mu: number, beta: number, gamma: number) }
    class Borel extends Distribution { constructor(mu: number) }
    class BorelTanner extends Distribution { constructor(mu: number, n: number) }
    class BoundedPareto extends Distribution { constructor(L: number, H: number, alpha: number) }
    class Bradford extends Distribution { constructor(c: number) }
    class Burr extends Distribution { constructor(c: number, k: number) }
    class Categorical extends Distribution { constructor(weights: number[], min: number) }
    class Cauchy extends Distribution { constructor(x0: number, gamma: number) }
    class Chi extends Distribution { constructor(k: number) }
    class Chi2 extends Distribution { constructor(k: number) }
    class Dagum extends Distribution { constructor(p: number, a: number, b: number) }
    class Degenerate extends Distribution { constructor(x0: number) }
    class Delaporte extends Distribution { constructor(alpha: number, beta: number, lambda: number) }
    class DiscreteUniform extends Distribution { constructor(xmin: number, xmax: number) }
    class DiscreteWeibull extends Distribution { constructor(q: number, beta: number) }
    class DoubleGamma extends Distribution { constructor(alpha: number, beta: number) }
    class DoubleWeibull extends Distribution { constructor(lambda: number, k: number) }
    class DoublyNoncentralBeta extends Distribution { constructor(alpha: number, beta: number, lambda1: number, lambda2: number) }
    class DoublyNoncentralF extends Distribution { constructor(d1: number, d2: number, lambda1: number, lambda2: number) }
    class DoublyNoncentralT extends Distribution { constructor(nu: number, mu: number, theta: number) }
    class Erlang extends Distribution { constructor(k: number, lambda: number) }
    class Exponential extends Distribution { constructor(lambda: number) }
    class ExponentialLogarithmic extends Distribution { constructor(p: number, beta: number) }
    class ExponentiatedWeibull extends Distribution { constructor(lambda: number, k: number, alpha: number) }
    class F extends Distribution { constructor(d1: number, d2: number) }
    class FisherZ extends Distribution { constructor(d1: number, d2: number) }
    class FlorySchulz extends Distribution { constructor(a: number) }
    class Frechet extends Distribution { constructor(alpha: number, s: number, m: number) }
    class Gamma extends Distribution { constructor(alpha: number, beta: number) }
    class GammaGompertz extends Distribution { constructor(b: number, s: number, beta: number) }
    class GeneralizedExponential extends Distribution { constructor(a: number, b: number, c: number) }
    class GeneralizedExtremeValue extends Distribution { constructor(c: number) }
    class GeneralizedGamma extends Distribution { constructor(a: number, d: number, p: number) }
    class GeneralizedHermite extends Distribution { constructor(a1: number, a2: number, m: number) }
    class GeneralizedLogistic extends Distribution { constructor(mu: number, s: number, c: number) }
    class GeneralizedNormal extends Distribution { constructor(mu: number, alpha: number, beta: number) }
    class GeneralizedPareto extends Distribution { constructor(mu: number, sigma: number, xi: number) }
    class Geometric extends Distribution { constructor(p: number) }
    class Gilbrat extends Distribution { constructor() }
    class Gompertz extends Distribution { constructor(eta: number, b: number) }
    class Gumbel extends Distribution { constructor(mu: number, beta: number) }
    class HalfGeneralizedNormal extends Distribution { constructor(alpha: number, beta: number) }
    class HalfLogistic extends Distribution { constructor() }
    class HalfNormal extends Distribution { constructor(sigma: number) }
    class HeadsMinusTails extends Distribution { constructor(n: number) }
    class Hoyt extends Distribution { constructor(q: number, omega: number) }
    class HyperbolicSecant extends Distribution { constructor() }
    class Hyperexponential extends Distribution { constructor(parameters: Array<{ weight: number; rate: number }>) }
    class Hypergeometric extends Distribution { constructor(N: number, K: number, n: number) }
    class InvalidDiscrete extends Distribution { constructor() }
    class InverseChi2 extends Distribution { constructor(nu: number) }
    class InverseGamma extends Distribution { constructor(alpha: number, beta: number) }
    class InverseGaussian extends Distribution { constructor(mu: number, lambda: number) }
    class InvertedWeibull extends Distribution { constructor(c: number) }
    class IrwinHall extends Distribution { constructor(n: number) }
    class JohnsonSB extends Distribution { constructor(gamma: number, delta: number, lambda: number, xi: number) }
    class JohnsonSU extends Distribution { constructor(gamma: number, delta: number, lambda: number, xi: number) }
    class Kolmogorov extends Distribution { constructor() }
    class Kumaraswamy extends Distribution { constructor(a: number, b: number) }
    class Laplace extends Distribution { constructor(mu: number, b: number) }
    class Levy extends Distribution { constructor(mu: number, c: number) }
    class Lindley extends Distribution { constructor(theta: number) }
    class Logarithmic extends Distribution { constructor(a: number, b: number) }
    class LogCauchy extends Distribution { constructor(mu: number, sigma: number) }
    class LogGamma extends Distribution { constructor(alpha: number, beta: number, mu: number) }
    class Logistic extends Distribution { constructor(mu: number, s: number) }
    class LogisticExponential extends Distribution { constructor(lambda: number, kappa: number) }
    class LogitNormal extends Distribution { constructor(mu: number, sigma: number) }
    class LogLaplace extends Distribution { constructor(mu: number, b: number) }
    class LogLogistic extends Distribution { constructor(alpha: number, beta: number) }
    class LogNormal extends Distribution { constructor(mu: number, sigma: number) }
    class LogSeries extends Distribution { constructor(p: number) }
    class Lomax extends Distribution { constructor(lambda: number, alpha: number) }
    class Makeham extends Distribution { constructor(alpha: number, beta: number, lambda: number) }
    class MaxwellBoltzmann extends Distribution { constructor(a: number) }
    class Mielke extends Distribution { constructor(k: number, s: number) }
    class Moyal extends Distribution { constructor(mu: number, sigma: number) }
    class Muth extends Distribution { constructor(alpha: number) }
    class Nakagami extends Distribution { constructor(m: number, omega: number) }
    class NegativeBinomial extends Distribution { constructor(r: number, p: number) }
    class NegativeHypergeometric extends Distribution { constructor(N: number, K: number, r: number) }
    class NeymanA extends Distribution { constructor(lambda: number, phi: number) }
    class NoncentralBeta extends Distribution { constructor(alpha: number, beta: number, lambda: number) }
    class NoncentralChi extends Distribution { constructor(k: number, lambda: number) }
    class NoncentralChi2 extends Distribution { constructor(k: number, lambda: number) }
    class NoncentralF extends Distribution { constructor(d1: number, d2: number, lambda: number) }
    class NoncentralT extends Distribution { constructor(nu: number, mu: number) }
    class Normal extends Distribution { constructor(mu: number, sigma: number) }
    class Pareto extends Distribution { constructor(xmin: number, alpha: number) }
    class PERT extends Distribution { constructor(a: number, b: number, c: number) }
    class Poisson extends Distribution { constructor(lambda: number) }
    class PolyaAeppli extends Distribution { constructor(lambda: number, theta: number) }
    class PowerLaw extends Distribution { constructor(a: number) }
    class QExponential extends Distribution { constructor(q: number, lambda: number) }
    class R extends Distribution { constructor(c: number) }
    class Rademacher extends Distribution { constructor() }
    class RaisedCosine extends Distribution { constructor(mu: number, s: number) }
    class Rayleigh extends Distribution { constructor(sigma: number) }
    class Reciprocal extends Distribution { constructor(a: number, b: number) }
    class ReciprocalInverseGaussian extends Distribution { constructor(mu: number, lambda: number) }
    class Rice extends Distribution { constructor(nu: number, sigma: number) }
    class ShiftedLogLogistic extends Distribution { constructor(mu: number, sigma: number, xi: number) }
    class Skellam extends Distribution { constructor(mu1: number, mu2: number) }
    class SkewNormal extends Distribution { constructor(xi: number, omega: number, alpha: number) }
    class Slash extends Distribution { constructor() }
    class Soliton extends Distribution { constructor(N: number) }
    class StudentT extends Distribution { constructor(nu: number) }
    class StudentZ extends Distribution { constructor(n: number) }
    class Trapezoidal extends Distribution { constructor(a: number, b: number, c: number, d: number) }
    class Triangular extends Distribution { constructor(a: number, b: number, c: number) }
    class TruncatedNormal extends Distribution { constructor(mu: number, sigma: number, a: number, b: number) }
    class TukeyLambda extends Distribution { constructor(lambda: number) }
    class Uniform extends Distribution { constructor(xmin: number, xmax: number) }
    class UniformProduct extends Distribution { constructor(n: number) }
    class UniformRatio extends Distribution { constructor() }
    class UQuadratic extends Distribution { constructor(a: number, b: number) }
    class VonMises extends Distribution { constructor(kappa: number) }
    class Weibull extends Distribution { constructor(lambda: number, k: number) }
    class Wigner extends Distribution { constructor(R: number) }
    class YuleSimon extends Distribution { constructor(rho: number) }
    class Zeta extends Distribution { constructor(s: number) }
    class Zipf extends Distribution { constructor(s: number, N: number) }
  }

  // ---- ran.core -------------------------------------------------------

  export namespace core {
    function seed(value: number | string): void
    function float(): number
    function float(min: number): number
    function float(min: number, max: number): number
    function float(min: number, max: number, n: number): number | number[]
    function int(min: number): number
    function int(min: number, max: number): number
    function int(min: number, max: number, n: number): number | number[]
    function choice<T>(values: T[]): T | undefined
    function choice<T>(values: T[], n: number): T | T[] | undefined
    function char(string: string): string | undefined
    function char(string: string, n: number): string | string[] | undefined
    function shuffle<T>(values: T[]): T[]
    function coin<H, T>(head: H, tail: T, p?: number): H | T
    function coin<H, T>(head: H, tail: T, p: number, n: number): H | T | Array<H | T>
  }

  // ---- ran.location ---------------------------------------------------

  export namespace location {
    function geometricMean(values: number[]): number | undefined
    function harmonicMean(values: number[]): number | undefined
    function mean(values: number[]): number | undefined
    function median(values: number[]): number | undefined
    function midrange(values: number[]): number | undefined
    function mode(values: number[]): number | undefined
    function trimean(values: number[]): number | undefined
  }

  // ---- ran.dispersion -------------------------------------------------

  export namespace dispersion {
    function cv(values: number[]): number | undefined
    function dVar(x: number[]): number | undefined
    function entropy(probabilities: number[], base?: number): number | undefined
    function gini(values: number[]): number | undefined
    function iqr(values: number[]): number | undefined
    function md(values: number[]): number | undefined
    function midhinge(values: number[]): number | undefined
    function range(values: number[]): number | undefined
    function rmd(values: number[]): number | undefined
    function stdev(values: number[]): number | undefined
    function qcd(values: number[]): number | undefined
    function variance(values: number[]): number | undefined
    function vmr(values: number[]): number | undefined
  }

  // ---- ran.shape ------------------------------------------------------

  export namespace shape {
    function kurtosis(values: number[]): number | undefined
    function moment(values: number[], k: number, c?: number): number | undefined
    function quantile(values: number[], p: number): number | undefined
    function rank(values: number[]): number[] | undefined
    function skewness(values: number[]): number | undefined
    function yule(values: number[]): number | undefined
  }

  // ---- ran.dependence -------------------------------------------------

  export namespace dependence {
    function covariance(x: number[], y: number[]): number | undefined
    function dCov(x: number[], y: number[]): number | undefined
    function dCor(x: number[], y: number[]): number | undefined
    function kendall(x: number[], y: number[]): number | undefined
    function kullbackLeibler(p: number[], q: number[]): number | undefined
    function oddsRatio(p00: number, p01: number, p10: number, p11: number): number | undefined
    function pearson(x: number[], y: number[]): number | undefined
    function pointBiserial(x: number[], y: number[]): number | undefined
    function somersD(x: number[], y: number[]): number | undefined
    function spearman(x: number[], y: number[]): number | undefined
    function yuleQ(p00: number, p01: number, p10: number, p11: number): number | undefined
    function yuleY(p00: number, p01: number, p10: number, p11: number): number | undefined
  }

  // ---- ran.test -------------------------------------------------------

  interface StatTestResult {
    stat: number
    passed: boolean
  }

  export namespace test {
    function bartlett(dataSets: number[][], alpha?: number): StatTestResult
    function brownForsythe(dataSets: number[][], alpha?: number): StatTestResult
    function hsic(dataSets: number[][], alpha?: number): StatTestResult
    function levene(dataSets: number[][], alpha?: number): StatTestResult
    function mannWhitney(dataSets: number[][], alpha?: number): StatTestResult
  }
}
