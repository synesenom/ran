import { erfc } from '../special'
import normal from './_normal'
import LogNormal from './log-normal'

/**
 * Probability density function for the [Gilbrat's distribution]{@link http://mathworld.wolfram.com/GibratsDistribution.html}:
 *
 * $f(x) = \frac{1}{x \sqrt{2 \pi}}e^{-\frac{\ln x^2}{2}}.$
 *
 * Support: $x > 0$.
 *
 * @class Gilbrat
 * @memberof ran.dist
 * @constructor
 */
export default class Gilbrat extends LogNormal {
  // Special case of log-normal
  /** */
  constructor () {
    super(0, 1)

    // Gilbrat has 0 free parameters (both mu and sigma are fixed constants); override the 2 inherited from LogNormal/Normal
    // solutions/distribution/2026-06-07-2138-continuous-subclass-natural-params.md
    this.k = 0

    // decisions/0018-continuous-subclass-natural-params.md — natural params only in this.p;
    // this.c.sigmaRoot2Pi/sigmaRoot2 set by Normal(0,1) remain valid
    this.p = {}
  }

  _generator () {
    // Direct sampling by transforming a standard normal variate
    return Math.exp(normal(this.r, 0, 1))
  }

  _pdf (x) {
    return Math.exp(-0.5 * Math.pow(Math.log(x), 2)) / (this.c.sigmaRoot2Pi * x)
  }

  _cdf (x) {
    return 0.5 * erfc(-Math.log(x) / this.c.sigmaRoot2)
  }

  _q (p) {
    // Inlined from LogNormal._q with mu=0, sigma=1 fixed (A&S §26.2.17 rational seed + 3 Newton steps)
    const s = Math.sqrt(-2 * Math.log(p < 0.5 ? p : 1 - p))
    const z0 = s - (2.515517 + s * (0.802853 + s * 0.010328)) /
      (1 + s * (1.432788 + s * (0.189269 + s * 0.001308)))
    let z = p < 0.5 ? -z0 : z0
    for (let i = 0; i < 3; i++) {
      const phi = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)
      z -= (0.5 * erfc(-z / Math.SQRT2) - p) / phi
    }
    return Math.exp(z)
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    return Math.exp(0.5)
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    return Math.expm1(1) * Math.exp(1)
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const em1 = Math.expm1(1)
    return (em1 + 3) * Math.sqrt(em1)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    return Math.expm1(4) + 2 * Math.expm1(3) + 3 * Math.expm1(2)
  }
}
