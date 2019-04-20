import { Xoshiro128p, float } from '../core'
import neumaier from '../algorithms/neumaier'
import { some } from '../utils'
import newton from '../algorithms/newton'
import { chi2, kolmogorovSmirnov } from './_tests'
import bracket from '../algorithms/bracketing'
import brent from '../algorithms/brent'
import { MAX_ITER } from '../special/_core'

/**
 * The distribution generator base class, all distribution generators extend this class. The methods listed here
 * are available for all distribution generators. Integer parameters of a distribution are rounded.
 *
 * The examples provided for this class are using a Pareto
 * distribution.
 *
 * @class Distribution
 * @memberOf ran.dist
 * @constructor
 */
class Distribution {
  constructor (type, k) {
    // Distribution type: discrete or continuous
    this._type = type

    // Number of parameters
    this.k = k

    // The parameters
    this.p = {}

    // Distribution support
    this.s = []

    // Pseudo random number generator
    this.r = new Xoshiro128p()

    // Mode of the distribution
    this.mode = undefined

    // Look-up table for the fallback quantile for discrete distributions
    this._cdfTable = [];
  }

  /**
   * Generates a single random variate.
   *
   * @method _generator
   * @memberOf ran.dist.Distribution
   * @returns {number} A single random variate.
   * @protected
   * @ignore
   */
  _generator () {
    throw Error('Distribution._generator() is not implemented')
  }

  /**
   * The probability distribution or probability mass function.
   *
   * @method _pdf
   * @memberOf ran.dist.Distribution
   * @param {number} x Value to evaluate the distribution/mass function at.
   * @returns {number} The probability density or probability at the specified value.
   * @protected
   * @ignore
   */
  _pdf (x) {
    throw Error('Distribution._pdf() is not implemented')
  }

  /**
   * The probability distribution function.
   *
   * @method _cdf
   * @memberOf ran.dist.Distribution
   * @param {number} x Value to evaluate the probability distribution at.
   * @returns {number} The value of the probability function at the specified value.
   * @protected
   * @ignore
   */
  _cdf (x) {
    throw Error('Distribution._cdf() is not implemented')
  }

  /**
   * Estimates the quantile function by using a look-up table.
   *
   * @method _qEstimateTable
   * @memberOf ran.dist.Distribution
   * @param {number} p Probability to find value for.
   * @return {number} The lower boundary of the interval that satisfies F(x) = p if found, undefined otherwise.
   * @protected
   * @ignore
   */
  _qEstimateTable(p) {
    // Init running variable
    let k = this.s[0].value
    let kMax = this.s[1].closed ? this.s[1].value + 1 : 1e6

    // Go through look-up table
    if (this._cdfTable.length === 0) {
      this._cdfTable.push(this.cdf(k))
    }
    for (; k < kMax; k++) {
      // Add F(x) if necessary
      if (this._cdfTable.length === k) {
        this._cdfTable.push(this.cdf(k))
      }

      // Check if we reached quantile
      if (p < this._cdfTable[k]) {
        return k
      }
    }
    // console.log(this._cdfTable[this._cdfTable.length - 1], p)

    // console.log(this._cdfTable)
    return undefined
  }

  /**
   * Estimates the quantile function by solving F(x) = p using one of the root finding algorithms.
   *
   * @method _qEstimateRoot
   * @memberOf ran.dist.Distribution
   * @param {number} p Probability to find value for.
   * @param {number?} x0 Initial guess for using Newton's method.
   * @returns {number} The value where the probability coincides with the specified value if found, undefined otherwise.
   * @protected
   * @ignore
   */
  _qEstimateRoot(p, x0) {
    // Start with Brent's method
    // Find brackets
    let bounds = bracket(
      t => this.cdf(t) - p,
      Number.isFinite(this.s[0].value) ? this.s[0].value : 1,
      Number.isFinite(this.s[1].value) ? this.s[1].value : 1.1,
      this.s
    )
    // console.log(p, bounds)

    // Run Brent's method
    let x = typeof bounds !== 'undefined'
      ? brent(t => this.cdf(t) - p, ...bounds)
      : x0

    // Polish up with Newton's method
    return newton(
      t => this.cdf(t) - p,
      t => this.pdf(t),
      x
    )
    // If a good initial guess is provided, try with Newton's method
    /*let x
    if (typeof this.mode !== 'undefined') {
      x = newton(
        t => this.cdf(t) - p,
        t => this.pdf(t),
        this.mode
      )
      // console.log(x)

      if (isFinite(x) && Number.isFinite(x)) {
        return x
      }
    }

    // If Newton failed, use Brent's method
    // Find brackets
    let bounds = bracket(
      t => this.cdf(t) - p,
      Number.isFinite(this.s[0].value) ? this.s[0].value : 1,
      Number.isFinite(this.s[1].value) ? this.s[1].value : 1.1,
      this.s
    )
    // console.log(p, bounds)

    // Solve F(x) - p using Brent's method
    return typeof bounds === 'undefined'
      ? undefined : brent(
      t => this.cdf(t) - p,
      ...bounds
    )*/
  }

  /**
   * Returns the type of the distribution (either discrete or continuous).
   *
   * @method type
   * @memberOf ran.dist.Distribution
   * @returns {string} Distribution type.
   */
  type () {
    return this._type
  }

  /**
   * Returns the support of the probability distribution (based on the current parameters). Note that the support
   * for the probability distribution is not necessarily the same as the support of the cumulative distribution.
   *
   * @method support
   * @memberOf ran.dist.Distribution
   * @returns {Object[]} An array of objects describing the lower and upper boundary of the support. Each object
   * contains a <code>value: number</code> and a <code>closed: boolean</code> property with the value of the boundary
   * and whether it is closed, respectively. When <code>value</code> is (+/-)Infinity, <code>closed</code> is always false.
   */
  support () {
    return this.s
  }

  /**
   * Sets the seed for the distribution generator. Distributions implement the same PRNG
   * ([xoshiro128+]{@link http://vigna.di.unimi.it/ftp/papers/ScrambledLinear.pdf}) that is used in the core functions.
   *
   * @method seed
   * @methodOf ran.dist.Distribution
   * @param {(number|string)} value The value of the seed, either a number or a string (for the ease of tracking seeds).
   * @returns {ran.dist.Distribution} Reference to the current distribution.
   * @example
   *
   * let pareto = new ran.dist.Pareto(1, 2).seed('test')
   * pareto.sample(5)
   * // => [ 1.2963808682328533,
   * //      1.1084992533723803,
   * //      2.137114851993669,
   * //      1.0173185472384896,
   * //      1.6465170523444383 ]
   *
   */
  seed (value) {
    this.r.seed(value)
    return this
  }

  /**
   * Generates some random variate.
   *
   * @method sample
   * @memberOf ran.dist.Distribution
   * @param {number=} n Number of variates to generate. If not specified, a single value is returned.
   * @returns {(number|number[])} Single sample or an array of samples.
   * @example
   *
   * let pareto = new ran.dist.Pareto(1, 2)
   * pareto.sample(5)
   * // => [ 5.619011325146519,
   * //      1.3142187491180493,
   * //      1.0513159445581859,
   * //      1.8124951360943067,
   * //      1.1694087449301402 ]
   *
   */
  sample (n = 1) {
    return some(() => this._generator(), n)
  }

  /**
   * [Probability density function]{@link https://en.wikipedia.org/wiki/Probability_density_function}. In case of discrete distributions, it is the [probability mass function]{@link https://en.wikipedia.org/wiki/Probability_mass_function}.
   *
   * @method pdf
   * @memberOf ran.dist.Distribution
   * @param {number} x Value to evaluate distribution at.
   * @returns {number} The probability density or probability mass.
   * @example
   *
   * let pareto = new ran.dist.Pareto(1, 2)
   * pareto.pdf(3)
   * // => 0.07407407407407407
   *
   */
  pdf (x) {
    // Convert to integer if discrete
    let z = this._type === 'discrete' ? Math.round(x) : x

    // Check against lower support
    if ((this.s[0].closed && z < this.s[0].value) || (!this.s[0].closed && z <= this.s[0].value)) {
      return 0
    }

    // Check against upper support
    if ((this.s[1].closed && z > this.s[1].value) || (!this.s[1].closed && z >= this.s[1].value)) {
      return 0
    }

    // Return value
    return this._pdf(z)
  }

  /**
   * The [cumulative distribution function]{@link https://en.wikipedia.org/wiki/Cumulative_distribution_function}:
   *
   * $$F(x) = \int_{-\infty}^x f(t) \,\mathrm{d}t,$$
   *
   * if the distribution is continuous and
   *
   * $$F(x) = \sum_{x_i \le x} f(x_i),$$
   *
   * if it is discrete. The functions \(f(t)\) and \(f(x_i)\) denote the probability density and mass functions.
   *
   * @method cdf
   * @memberOf ran.dist.Distribution
   * @param {number} x Value to evaluate CDF at.
   * @returns {number} The cumulative distribution value.
   * @example
   *
   * let pareto = new ran.dist.Pareto(1, 2)
   * pareto.cdf(3)
   * // => 0.8888888888888888
   *
   */
  cdf (x) {
    // Convert to integer if discrete
    let z = this._type === 'discrete' ? Math.round(x) : x

    // Check against lower support
    if ((this.s[0].closed && z < this.s[0].value) || (!this.s[0].closed && z <= this.s[0].value)) {
      return 0
    }

    // Check against upper support
    if (z >= this.s[1].value) {
      return 1
    }

    // Return value
    return this._cdf(z)
  }

  q (p) {
    if (p < 0 || p > 1) {
      // If out of bounds, return undefined
      return undefined
    } else if (p === 0) {
      // If zero, return lower support boundary
      return this.s[0].value
    } else if (p === 1) {
      // If unit, return upper support boundary
      return this.s[1].value
    } else {
      // If quantile function is implemented, use that, otherwise use the estimators: look-up table for discrete and root-finder for continuous
      //
      return typeof this['_q'] === 'function'
        ? this._q(p)
        : this._type === 'discrete'
          ? this._qEstimateTable(p)
          : this._qEstimateRoot(p)
    }
  }

  /**
   * The [survival function]{@link https://en.wikipedia.org/wiki/Survival_function}:
   *
   * $$S(x) = 1 - F(x),$$
   *
   * where \(F(x)\) denotes the cumulative distribution function.
   *
   * @method survival
   * @memberOf ran.dist.Distribution
   * @param {number} x Value to evaluate survival function at.
   * @returns {number} The survival value.
   * @example
   *
   * let pareto = new ran.dist.Pareto(1, 2)
   * pareto.survival(3)
   * // => 0.11111111111111116
   *
   */
  survival (x) {
    return 1 - this._cdf(x)
  }

  /**
   * The [hazard function]{@link https://en.wikipedia.org/wiki/Failure_rate}:
   *
   * $$\lambda(x) = \frac{f(x)}{S(x)},$$
   *
   * where \(f(x)\) and \(S(x)\) are the probability density (or mass) function and the survival function, respectively.
   *
   * @method hazard
   * @memberOf ran.dist.Distribution
   * @param {number} x Value to evaluate the hazard at.
   * @returns {number} The hazard value.
   * @example
   *
   * let pareto = new ran.dist.Pareto(1, 2)
   * pareto.hazard(3)
   * // => 0.6666666666666663
   *
   */
  hazard (x) {
    return this._pdf(x) / this.survival(x)
  }

  /**
   * The [cumulative hazard function]{@link https://en.wikipedia.org/wiki/Survival_analysis#Hazard_function_and_cumulative_hazard_function}:
   *
   * $$\Lambda(x) = \int_0^x \lambda(t) \,\mathrm{d}t,$$
   *
   * where \(\lambda(x)\) is the hazard function.
   *
   * @method cHazard
   * @memberOf ran.dist.Distribution
   * @param {number} x Value to evaluate cumulative hazard at.
   * @returns {number} The cumulative hazard.
   * @example
   *
   * let pareto = new ran.dist.Pareto(1, 2)
   * pareto.cHazard(3)
   * // => 2.197224577336219
   *
   */
  cHazard (x) {
    return -Math.log(this.survival(x))
  }

  /**
   * The [logarithmic probability density function]{@link https://en.wikipedia.org/wiki/Log_probability}.
   * For discrete distributions, this is the logarithm of the probability mass function.
   *
   * @method logPdf
   * @memberOf ran.dist.Distribution
   * @param {number} x Value to evaluate the log pdf at.
   * @returns {number} The logarithmic probability density (or mass).
   * @example
   *
   * let pareto = new ran.dist.Pareto(1, 2)
   * pareto.lnPdf(3)
   * // => -2.6026896854443837
   *
   */
  lnPdf (x) {
    return Math.log(this._pdf(x))
  }

  /**
   * The [log-likelihood]{@link https://en.wikipedia.org/wiki/Likelihood_function#Log-likelihood} of the
   * current distribution based on some data. More precisely:
   *
   * $$\ln L(\theta | X) = \sum_{x \in X} \ln f(x; \theta),$$
   *
   * where \(X\) is the set of observations (sample) and \(\theta\) is the parameter vector of the
   * distribution. The function \(f(x)\) denotes the probability density/mass function.
   *
   * @method lnL
   * @memberOf ran.dist.Distribution
   * @param {number[]} data Array of numbers to calculate log-likelihood for.
   * @returns {number} The log-likelihood of the data for the distribution.
   * @example
   *
   * let pareto = new ran.dist.Pareto(1, 2)
   * let uniform = new ran.dist.UniformContinuous(1, 10);
   *
   * let sample1 = pareto.sample(100)
   * pareto.L(sample1)
   * // => -104.55926409382
   *
   * let sample2 = uniform.sample(100)
   * pareto.L(sample2)
   * // => -393.1174868780569
   *
   */
  lnL (data) {
    return neumaier(
      data.map(d => this.lnPdf(d))
        .sort((a, b) => b - a)
    )
  }

  /**
   * Returns the value of the [Akaike information criterion]{@link https://en.wikipedia.org/wiki/Akaike_information_criterion}
   * for a specific data set. Note that this method does not optimize the likelihood, merely computes the AIC with the
   * current parameter values.
   *
   * @method aic
   * @memberOf ran.dist.Distribution
   * @param {number[]} data Array of values containing the data.
   * @returns {number} The AIC for the current parameters.
   * @example
   *
   * let pareto1 = new dist.Pareto(1, 2)
   * let pareto2 = new dist.Pareto(1, 5)
   * let sample = pareto1.sample(1000)
   *
   * pareto1.aic(sample)
   * // => 1584.6619128383577
   *
   * pareto2.aic(sample)
   * // => 2719.0367230482957
   *
   */
  aic (data) {
    return 2 * (this.k - this.lnL(data))
  }

  /**
   * Returns the value of the [Bayesian information criterion]{@link https://en.wikipedia.org/wiki/Bayesian_information_criterion}
   * for a specific data set. Note that this method does not optimize the likelihood, merely computes the BIC with the
   * current parameter values.
   *
   * @method bic
   * @memberOf ran.dist.Distribution
   * @param {number[]} data Array of values containing the data.
   * @returns {number} The BIC for the current parameters.
   * @example
   *
   * let pareto1 = new dist.Pareto(1, 2)
   * let pareto2 = new dist.Pareto(1, 5)
   * let sample = pareto1.sample(1000)
   *
   * pareto1.bic(sample)
   * // => 1825.3432698372499
   *
   * pareto2.bic(sample)
   * // => 3190.5839264881165
   *
   */
  bic (data) {
    return Math.log(data.length) * this.k - 2 * this.lnL(data)
  }

  /**
   * Tests if an array of values is sampled from the specified distribution. For discrete distributions this
   * method uses \(\chi^2\) test, whereas for continuous distributions it uses the Kolmogorov-Smirnov test. In both cases, the probability of Type I error (rejecting a correct null hypotheses) is 1%.
   *
   * @method test
   * @memberOf ran.dist.Distribution
   * @param {number[]} values Array of values to test.
   * @returns {Object} Object with two properties representing the result of the test:
   * <ul>
   *     <li>{statistics}: The \(\chi^2\) or D statistics depending on whether the distribution is discrete or
   *     continuous.</li>
   *     <li>{passed}: Whether the sample passed the null hypothesis that it is sampled from the current
   *     distribution.</li>
   * </ul>
   * @example
   *
   * let pareto = new ran.dist.Pareto(1, 2)
   * let uniform = new ran.dist.UniformContinuous(1, 10);
   *
   * let sample1 = pareto.sample(100)
   * pareto.test(sample1)
   * // => { statistics: 0.08632443341496943, passed: true }
   *
   * let sample2 = uniform.sample(100)
   * pareto.test(sample2)
   * // => { statistics: 0.632890888159255, passed: false }
   *
   */
  test (values) {
    return this._type === 'discrete'
      ? chi2(values, x => this._pdf(x), this.k)
      : kolmogorovSmirnov(values, x => this._cdf(x))
  }
}

export default Distribution
