import { Xoshiro128p } from '../core'
import neumaier from '../algorithms/neumaier'
import { some } from '../utils'
import { float } from '../core'
import newton from '../algorithms/newton'
import { chi2, kolmogorovSmirnov } from './_tests'
// TODO If a parameter is invalid, return undefined for generator and pdf/cdf

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
  }

  /**
   * Generates a single random variate.
   *
   * @method _generator
   * @memberOf ran.dist.Distribution
   * @returns {number} A single random variate.
   * @protected
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
   */
  _cdf (x) {
    throw Error('Distribution._cdf() is not implemented')
  }

  /**
   * Estimates the quantile function (inverse cumulative distribution function) by solving CDF(x) = p using Newton's method. Initial value for the algorithm is picked randomly from the support. Should not be overridden.
   *
   * @method _q
   * @memberOf ran.dist.Distribution
   * @param {number} p Probability to find value for.
   * @param {number=} x0 Initial value for Newton's method.
   * @returns {number} The value where the probability coincides with the specified value.
   * @protected
   */
  // TODO Pick x0 as the mode of the distribution
  _qEstimate (p, x0) {
    let x = newton(
      t => this._cdf(t) - p,
      t => this._pdf(t),
      typeof x0 === 'undefined' ? float(
        this.s[0].value === null ? -10 : this.s[0].value,
        this.s[1].value === null ? 10 : this.s[1].value
      ) : x0
    )

    return this._type === 'discrete' ? Math.ceil(x) : x
  }

  _q (p) {
    return this._qEstimate(p)
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
   * and whether it is closed, respectively. If <code>value</code> is null, the boundary is (+/-) infinity (for upper
   * and lower boundaries). When <code>value</code> is null, <code>closed</code> is always false.
   */
  support () {
    return this.s
  }

  /**
   * Sets the seed for the distribution generator. Distributions implement the same PRNG
   * ([xoshiro128+]{@link http://vigna.di.unimi.it/ftp/papers/ScrambledLinear.pdf}) that is used in the core functions.
   *
   * @method seed
   * @methodOf ran.core
   * @param {(number|string)} value The value of the seed, either a number or a string (for the ease of tracking seeds).
   * @returns {ran.dist.Distribution} Reference to the current distribution.
   * @example
   *
   * let pareto = new ran.dist.Pareto(1, 2)
   *                .seed('test')
   * pareto.sample(5)
   * // => [ 1.2963808682328533,
   * //      1.1084992533723803,
   * //      2.137114851993669,
   * //      1.0173185472384896,
   * //      1.6465170523444383 ]
   *
   */
  seed(value) {
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
  sample (n) {
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

    // Check against support
    if (this.s[0].value !== null && ((this.s[0].closed && z < this.s[0].value) || (!this.s[0].closed && z <= this.s[0].value))) {
      return 0
    }

    if (this.s[1].value !== null && ((this.s[1].closed && z > this.s[1].value) || (!this.s[1].closed && z >= this.s[1].value))) {
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

    // Check against support
    if (this.s[0].value !== null && ((this.s[0].closed && z < this.s[0].value) || (!this.s[0].closed && z <= this.s[0].value))) {
      return 0
    }

    if (this.s[1].value !== null && z >= this.s[1].value) {
      return 1
    }

    // Return value
    return this._cdf(z)
  }

  q (p) {
    if (p < 0 || p > 1) {
      return null
    } else {
      return this._q(p)
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
   * method uses \(\chi^2\) test, whereas for continuous distributions it uses the Kolmogorov-Smirnov test.
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
