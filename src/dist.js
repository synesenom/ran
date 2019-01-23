import { some } from './utils'
import special from './special'

/**
 * A collection of random number generators for well-known distributions.
 *
 * @namespace dist
 * @memberOf ran
 */
export default (function () {
  /**
   * Maximum number of trials in generators.
   *
   * @var {number} _MAX_TRIALS
   * @memberOf ran.dist
   * @private
   */
  const _MAX_TRIALS = 1000

  /**
   * Table containing critical values for the chi square test at 99% of confidence for low degrees of freedom.
   *
   * @var {number[]} _CHI_TABLE_LO
   * @memberOf ran.dist
   * @private
   */
  const _CHI_TABLE_LO = [0,
    6.635, 9.210, 11.345, 13.277, 15.086, 16.812, 18.475, 20.090, 21.666, 23.209,
    24.725, 26.217, 27.688, 29.141, 30.578, 32.000, 33.409, 34.805, 36.191, 37.566,
    38.932, 40.289, 41.638, 42.980, 44.314, 45.642, 46.963, 48.278, 49.588, 50.892,
    52.191, 53.486, 54.776, 56.061, 57.342, 58.619, 59.893, 61.162, 62.428, 63.691,
    64.950, 66.206, 67.459, 68.710, 69.957, 71.201, 72.443, 73.683, 74.919, 76.154,
    77.386, 78.616, 79.843, 81.069, 82.292, 83.513, 84.733, 85.950, 87.166, 88.379,
    89.591, 90.802, 92.010, 93.217, 94.422, 95.626, 96.828, 98.028, 99.228, 100.425,
    101.621, 102.816, 104.010, 105.202, 106.393, 107.583, 108.771, 109.958, 111.144, 112.329,
    113.512, 114.695, 115.876, 117.057, 118.236, 119.414, 120.591, 121.767, 122.942, 124.116,
    125.289, 126.462, 127.633, 128.803, 129.973, 131.141, 132.309, 133.476, 134.642, 135.807,
    136.971, 138.134, 139.297, 140.459, 141.620, 142.780, 143.940, 145.099, 146.257, 147.414,
    148.571, 149.727, 150.882, 152.037, 153.191, 154.344, 155.496, 156.648, 157.800, 158.950,
    160.100, 161.250, 162.398, 163.546, 164.694, 165.841, 166.987, 168.133, 169.278, 170.423,
    171.567, 172.711, 173.854, 174.996, 176.138, 177.280, 178.421, 179.561, 180.701, 181.840,
    182.979, 184.118, 185.256, 186.393, 187.530, 188.666, 189.802, 190.938, 192.073, 193.208,
    194.342, 195.476, 196.609, 197.742, 198.874, 200.006, 201.138, 202.269, 203.400, 204.530,
    205.660, 206.790, 207.919, 209.047, 210.176, 211.304, 212.431, 213.558, 214.685, 215.812,
    216.938, 218.063, 219.189, 220.314, 221.438, 222.563, 223.687, 224.810, 225.933, 227.056,
    228.179, 229.301, 230.423, 231.544, 232.665, 233.786, 234.907, 236.027, 237.147, 238.266,
    239.386, 240.505, 241.623, 242.742, 243.860, 244.977, 246.095, 247.212, 248.329, 249.445,
    250.561, 251.677, 252.793, 253.908, 255.023, 256.138, 257.253, 258.367, 259.481, 260.595,
    261.708, 262.821, 263.934, 265.047, 266.159, 267.271, 268.383, 269.495, 270.606, 271.717,
    272.828, 273.939, 275.049, 276.159, 277.269, 278.379, 279.488, 280.597, 281.706, 282.814,
    283.923, 285.031, 286.139, 287.247, 288.354, 289.461, 290.568, 291.675, 292.782, 293.888,
    294.994, 296.100, 297.206, 298.311, 299.417, 300.522, 301.626, 302.731, 303.835, 304.940
  ]

  /**
   * Table containing critical values for the chi square test at 95% of confidence for high degrees of freedom.
   *
   * @var {number[]} _CHI_TABLE_HI
   * @memberOf ran.dist
   * @private
   */
  const _CHI_TABLE_HI = [
    359.906, 414.474, 468.724, 522.717, 576.493, 630.084, 683.516, 736.807, 789.974, 843.029,
    895.984, 948.848, 1001.630, 1054.334, 1106.969
  ]

  /**
   * Generates a normally distributed value.
   *
   * @method _normal
   * @memberOf ran.dist
   * @param mu {number=} Distribution mean. Default value is 0.
   * @param sigma {number=} Distribution standard deviation. Default value is 1.
   * @returns {number} Random variate.
   * @private
   */
  function _normal (mu = 0, sigma = 1) {
    let u = Math.random()

    let v = Math.random()
    return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) + mu
  }

  /**
   * Generates a gamma distributed value.
   *
   * @method _gamma
   * @memberOf ran.dist
   * @param alpha {number} Shape parameter.
   * @param beta {number} Rate parameter.
   * @returns {number} Random variate.
   * @private
   */
  function _gamma (alpha, beta) {
    if (alpha > 1) {
      let d = alpha - 1 / 3

      let c = 1 / Math.sqrt(9 * d)

      let Z; let V; let U
      // while (true) {
      for (let trials = 0; trials < _MAX_TRIALS; trials++) {
        Z = _normal(0, 1)
        if (Z > -1 / c) {
          V = Math.pow(1 + c * Z, 3)
          U = Math.random()
          if (Math.log(U) < 0.5 * Z * Z + d * (1 - V + Math.log(V))) { return d * V / beta }
        }
      }
    } else {
      return _gamma(alpha + 1, beta) * Math.pow(Math.random(), 1 / alpha)
    }
  }

  /**
   * Performs a chi square test for an array of values and a probability mass function.
   *
   * @method _chiTest
   * @memberOf ran.dist
   * @param values {number[]} Array of values to perform test for.
   * @param pmf {Function} Probability mass function to perform test against.
   * @param c {number} Number of parameters for the distribution.
   * @returns {{statistics: number, passed: boolean}} Test results, containing the raw chi square statistics and a
   * boolean to tell whether the distribution passed the test.
   * @private
   */
  function _chiTest (values, pmf, c) {
    // Calculate observed distribution
    let p = new Map()
    values.forEach(function (v) {
      p.set(v, p.has(v) ? p.get(v) + 1 : 1)
    })

    // Calculate chi-square sum
    let chi2 = 0

    let n = values.length

    p.forEach((px, x) => {
      let m = pmf(parseInt(x)) * n
      chi2 += Math.pow(px - m, 2) / m
    })

    // Get critical value
    let df = Math.max(1, p.size - c - 1)

    let crit = df <= 250 ? _CHI_TABLE_LO[df] : _CHI_TABLE_HI[Math.floor(df / 50)]

    // Return comparison results
    return {
      statistics: chi2,
      passed: chi2 <= crit
    }
  }

  /**
   * Performs a Kolmogorov-Smirnov test for an array of values and a cumulative distribution function.
   *
   * @method _ksTest
   * @memberOf ran.dist
   * @param values {number[]} Array of values to perform test for.
   * @param cdf {Function} Cumulative distribution function to perform test against.
   * @returns {{statistics: number, passed: boolean}} Test results, containing the raw K-S statistics and a
   * boolean to tell whether the distribution passed the test.
   * @private
   */
  function _ksTest (values, cdf) {
    // Sort values for estimated CDF
    values.sort((a, b) => a - b)

    // Calculate D value
    let D = 0
    for (let i = 0; i < values.length; i++) {
      D = Math.max(D, Math.abs((i + 1) / values.length - cdf(values[i])))
    }

    // Return comparison results
    return {
      statistics: D,
      passed: D <= 1.628 / Math.sqrt(values.length)
    }
  }

  /**
   * The distribution generator base class, all distribution generators extend this class. The methods listed here
   * are available for all distribution generators. The examples provided for this class are using a Pareto
   * distribution.
   *
   * @class Distribution
   * @memberOf ran.dist
   * @constructor
   */
  class Distribution {
    constructor (type, k) {
      this._type = type
      this.k = k
      this.p = []
      this.c = []
    }

    _generator () {
      throw Error('Distribution._generator() is not implemented')
    }

    /**
     * The probability distribution or probability mass function.
     *
     * @method _pdf
     * @memberOf ran.dist.Distribution
     * @param {number } x Value to evaluate the distribution/mass function at.
     * @returns {number} The probability density or probability at the specified value.
     * @private
     */
    _pdf () {
      throw Error('Distribution._pdf() is not implemented')
    }

    /**
     * The probability distribution function.
     *
     * @method _cdf
     * @memberOf ran.dist.Distribution
     * @param {number=} x Value to evaluate the probability distribution at.
     * @returns {number} The value of the probability function at the specified value.
     * @private
     */
    _cdf () {
      throw Error('Distribution._cdf() is not implemented')
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
     * @returns {{value: number, closed: boolean}[]} An array of objects describing the lower and upper boundary of
     * the support. Each object contains a <code>value: number</code> and a <code>closed: boolean</code> property
     * with the value of the boundary and whether it is closed, respectively. If <code>value</code> is null, the
     * boundary is (+/-) infinity (for upper and lower boundaries). When <code>value</code> is null,
     * <code>closed</code> is always false.
     */
    support () {
      throw Error('Distribution.support() is not implemented')
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
      return this._pdf(x)
    }

    /**
     * The [cumulative distribution function]{@link https://en.wikipedia.org/wiki/Cumulative_distribution_function}:
     *
     * $$F(x) = \int_{-\infty}^x f(t) \,\mathrm{d}t,$$
     *
     * if the distribution is continuous and
     *
     * $$F(x) = \sum_{x_i < x} f(x_i),$$
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
      return this._cdf(x)
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
     * @method L
     * @memberOf ran.dist.Distribution
     * @param {number[]} data Array of numbers to calculate log-likelihood for.
     * @return {number} The value of log-likelihood.
     * @example
     *
     * let pareto = new ran.dist.Pareto(1, 2)
     * let uniform = new ran.dist.UniformContinuous(1, 10);
     *
     * let sample1 = pareto.sample(100)
     * pareto.L(sample1)
     * // => -104.55926409382
     *
     * sample2 = uniform.sample(100)
     * pareto.L(sample2)
     * // => -393.1174868780569
     *
     */
    L (data) {
      return data.reduce((sum, d) => sum + this.lnPdf(d), 0)
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
     * sample2 = uniform.sample(100)
     * pareto.test(sample2)
     * // => { statistics: 0.632890888159255, passed: false }
     *
     */
    test (values) {
      return this._type === 'discrete'
        ? _chiTest(values, x => this._pdf(x), this.k)
        : _ksTest(values, x => this._cdf(x))
    }
  }

  // TODO Bates
  // TODO Beta-binomial (https://en.wikipedia.org/wiki/Beta-binomial_distribution)
  // TODO Beta-pascal
  // TODO Discrete Weibull
  // TODO Gamma-Poisson
  // TODO Geometric
  // TODO Hypergeometric (https://en.wikipedia.org/wiki/Hypergeometric_distribution)
  // TODO Logarithm
  // TODO Negative hypergeometric
  // TODO Poisson-binomial (https://en.wikipedia.org/wiki/Poisson_binomial_distribution)
  // TODO Pascal (negative binomial)
  // TODO Polya
  // TODO Power series
  // TODO Zeta
  // TODO Zipf https://en.wikipedia.org/wiki/Zipf%27s_law |
  // TODO Chi
  // TODO Doubly non-central F
  // TODO Doubly non-central t
  // TODO Error (exponential power)
  // TODO Exponential power
  // TODO Gamma-normal
  // TODO Generalized Pareto
  // TODO Geometric
  // TODO Hyperbolic-secant
  // TODO Hyperexponential
  // TODO Hypoexponential
  // TODO IDB
  // TODO Inverse Gausian
  // TODO Inverted beta
  // TODO Irwin-Hall
  // TODO Log gamma
  // TODO Logistic-exponential
  // TODO Makeham
  // TODO Muth
  // TODO Negative binomial
  // TODO Noncentral beta
  // TODO Noncentral chi-square
  // TODO Noncentral F
  // TODO Noncentral t
  // TODO t
  // TODO triangular
  // TODO two-sided power
  // TODO von Mises
  // TODO Wald

  // TODO make standard generators for frequently used standard distributions
  /**
   * Generator for the [generalized arcsine distribution]{@link https://en.wikipedia.org/wiki/Arcsine_distribution#Arbitrary_bounded_support}:
   *
   * $$f(x; a, b) = \frac{1}{\pi \sqrt{(x -a) (b - x)}},$$
   *
   * where \(a, b \in \mathbb{R}\) and \(a < b\). Support: \(x \in [a, b]\).
   *
   * @class Arcsine
   * @memberOf ran.dist
   * @param {number=} a Lower boundary. Default value is 0.
   * @param {number=} b Upper boundary. Default value is 1.
   * @constructor
   */
  class Arcsine extends Distribution {
    constructor (a = 0, b = 1) {
      super('continuous', arguments.length)
      this.p = { a, b }
      this.c = [1 / Math.PI, b - a]
    }

    _generator () {
      // Inverse transform sampling
      let s = Math.sin(0.5 * Math.PI * Math.random())
      return (s * s) * this.c[1] + this.p.a
    }

    _pdf (x) {
      return x >= this.p.a && x < this.p.b ? this.c[0] / Math.sqrt((x - this.p.a) * (this.p.b - x)) : 0
    }

    _cdf (x) {
      return x >= this.p.a && x < this.p.b ? 2 * this.c[0] * Math.asin(Math.sqrt((x - this.p.a) / (this.p.b - this.p.a))) : 0
    }

    support () {
      return [{
        value: this.p.a,
        closed: true
      }, {
        value: this.p.b,
        closed: true
      }]
    }
  }

  /**
   * Generator for the [Bernoulli distribution]{@link https://en.wikipedia.org/wiki/Bernoulli_distribution}:
   *
   * $$f(k; p) = \begin{cases}p &\quad\text{if $k = 1$}\\1 - p &\quad\text{if $k = 0$}\\\end{cases}$$
   *
   * where \(p \in [0, 1]\). Support: \(k \in \{0, 1\}\).
   *
   * @class Bernoulli
   * @memberOf ran.dist
   * @param {number=} p Probability of the outcome 1. Default value is 0.5.
   * @constructor
   */
  class Bernoulli extends Distribution {
    constructor (p = 0.5) {
      super('discrete', arguments.length)
      this.p = { p }
    }

    _generator () {
      // Direct sampling
      return Math.random() < this.p.p ? 1 : 0
    }

    _pdf (x) {
      let xi = parseInt(x)
      return xi === 1 ? this.p.p : xi === 0 ? 1 - this.p.p : 0
    }

    _cdf (x) {
      return x < 0 ? 0 : (parseInt(x) >= 1 ? 1 : 1 - this.p.p)
    }

    support () {
      return [{
        value: 0,
        closed: true
      }, {
        value: 1,
        closed: true
      }]
    }
  }

  /**
   * Generator for the [beta distribution]{@link https://en.wikipedia.org/wiki/Beta_distribution}:
   *
   * $$f(x; \alpha, \beta) = \frac{x^{\alpha - 1}(1 - x)^{\beta - 1}}{\mathrm{B}(\alpha, \beta)},$$
   *
   * with \(\alpha, \beta \in \mathbb{R}^+\) and \(\mathrm{B}(\alpha, \beta)\) is the beta function.
   * Support: \(x \in [0, 1]\).
   *
   *
   * @class Beta
   * @memberOf ran.dist
   * @param {number=} alpha First shape parameter. Default value is 1.
   * @param {number=} beta Second shape parameter. Default value is 1.
   * @constructor
   */
  class Beta extends Distribution {
    constructor (alpha = 1, beta = 1) {
      super('continuous', arguments.length)
      this.p = { alpha, beta }
      this.c = [special.beta(alpha, beta)]
    }

    _generator () {
      // Direct sampling from gamma
      let x = _gamma(this.p.alpha, 1)

      let y = _gamma(this.p.beta, 1)
      return x / (x + y)
    }

    _pdf (x) {
      return x > 0 && x < 1 ? Math.pow(x, this.p.alpha - 1) * Math.pow(1 - x, this.p.beta - 1) / this.c[0] : 0
    }

    _cdf (x) {
      return x <= 0 ? 0 : x >= 1 ? 1 : special.betaIncomplete(this.p.alpha, this.p.beta, x)
    }

    support () {
      return [{
        value: 0,
        closed: this.p.alpha >= 1
      }, {
        value: 1,
        closed: this.p.beta >= 1
      }]
    }
  }

  /**
   * Generator for the [beta prime distribution]{@link https://en.wikipedia.org/wiki/Beta_prime_distribution}:
   *
   * $$f(x; \alpha, \beta) = \frac{x^{\alpha - 1}(1 - x)^{-\alpha - \beta}}{\mathrm{B}(\alpha, \beta)},$$
   *
   * with \(\alpha, \beta \in \mathbb{R}^+\) and \(\mathrm{B}(\alpha, \beta)\) is the beta function.
   * Support: \(x \in \mathbb{R}^+\).
   *
   *
   * @class BetaPrime
   * @memberOf ran.dist
   * @param {number=} alpha First shape parameter. Default value is 2.
   * @param {number=} beta Second shape parameter. Default value is 2.
   * @constructor
   */
  class BetaPrime extends Distribution {
    constructor (alpha = 2, beta = 2) {
      super('continuous', arguments.length)
      this.p = { alpha, beta }
    }

    _generator () {
      // Direct sampling from gamma
      return _gamma(this.p.alpha, 1) / _gamma(this.p.beta, 1)
    }

    _pdf (x) {
      return x > 0 ? Math.pow(x, this.p.alpha - 1) * Math.pow(1 + x, -this.p.alpha - this.p.beta) / special.beta(this.p.alpha, this.p.beta) : 0
    }

    _cdf (x) {
      return x > 0 ? special.betaIncomplete(this.p.alpha, this.p.beta, x / (1 + x)) : 0
    }

    support () {
      return [{
        value: 0,
        closed: this.p.alpha >= 1
      }, {
        value: null,
        closed: false
      }]
    }
  }

  /**
   * Generator for the [binomial distribution]{@link https://en.wikipedia.org/wiki/Binomial_distribution}:
   *
   * $$f(k; n, p) = \begin{pmatrix}n \\ k \\ \end{pmatrix} p^k (1 - p)^{n - k},$$
   *
   * with \(n \in \mathbb{N}_0\) and \(p \in [0, 1]\). Support: \(k \in \{0, ..., n\}\).
   *
   * @class Binomial
   * @memberOf ran.dist
   * @param {number=} n Number of trials. Default value is 100.
   * @param {number=} p Probability of success. Default value is 0.5.
   * @constructor
   */
  class Binomial extends Distribution {
    constructor (n = 100, p = 0.5) {
      super('discrete', arguments.length)
      let pp = p <= 0.5 ? p : 1 - p
      this.p = { n, p }
      this.c = [pp, n * pp]
    }

    _generator () {
      // Direct sampling
      if (this.p.n < 25) {
        // Small n
        let b = 0
        for (let i = 1; i <= this.p.n; i++) { if (Math.random() < this.c[0]) b++ }
        return this.c[0] === this.p.p ? b : this.p.n - b
      } else if (this.c[1] < 1.0) {
        // Small mean
        let lambda = Math.exp(-this.c[1])

        let t = 1.0

        let i
        for (i = 0; i <= this.p.n; i++) {
          t *= Math.random()
          if (t < lambda) break
        }
        let b = Math.min(i, this.p.n)
        return this.c[0] === this.p.p ? b : this.p.n - b
      } else {
        // Rest of the cases
        let en = this.p.n

        let g = special.gammaLn(en + 1)

        let pc = 1 - this.c[0]

        let pLog = Math.log(this.c[0])

        let pcLog = Math.log(pc)

        let sq = Math.sqrt(2.0 * this.c[1] * pc)
        let y, em, t
        do {
          do {
            y = Math.tan(Math.PI * Math.random())
            em = sq * y + this.c[1]
          } while (em < 0.0 || em >= (en + 1.0))
          em = Math.floor(em)
          t = 1.2 * sq * (1.0 + y * y) * Math.exp(g - special.gammaLn(em + 1.0) -
            special.gammaLn(en - em + 1.0) + em * pLog + (en - em) * pcLog)
        } while (Math.random() > t)
        return this.c[0] === this.p.p ? em : this.p.n - em
      }
    }

    _pdf (x) {
      let xi = parseInt(x)
      return xi < 0 ? 0 : xi > this.p.n ? 0 : Math.exp(special.gammaLn(this.p.n + 1) - special.gammaLn(xi + 1) - special.gammaLn(this.p.n - xi + 1) +
        xi * Math.log(this.p.p) + (this.p.n - xi) * Math.log(1 - this.p.p))
    }

    _cdf (x) {
      let xi = parseInt(x)
      return xi < 0 ? 0 : xi >= this.p.n ? 1 : special.betaIncomplete(this.p.n - xi, 1 + xi, 1 - this.p.p)
    }

    support () {
      return [{
        value: 0,
        closed: true
      }, {
        value: this.p.n,
        closed: true
      }]
    }
  }

  /**
   * Generator for the [bounded Pareto distribution]{@link https://en.wikipedia.org/wiki/Pareto_distribution#Bounded_Pareto_distribution}:
   *
   * $$f(x; L, H, \alpha) = \frac{\alpha L^\alpha x^{-\alpha - 1}}{1 - \big(\frac{L}{H}\big)^\alpha},$$
   *
   * with \(L, H \in \mathbb{R}^+\), \(H > L\) and \(\alpha \in \mathbb{R}^+\). Support: \(x \in [L, H]\).
   *
   * @class BoundedPareto
   * @memberOf ran.dist
   * @param {number=} L Lower boundary. Default value is 1.
   * @param {number=} H Upper boundary. Default value is 10.
   * @param {number=} alpha Shape parameter. Default value is 1.
   * @constructor
   */
  class BoundedPareto extends Distribution {
    constructor (L = 1, H = 10, alpha = 1) {
      super('continuous', arguments.length)
      this.p = { L, H, alpha }
      this.c = [Math.pow(L, alpha), Math.pow(H, alpha), (1 - Math.pow(L / H, alpha))]
    }

    _generator () {
      // Inverse transform sampling
      return Math.pow((this.c[1] + Math.random() * (this.c[0] - this.c[1])) / (this.c[0] * this.c[1]), -1 / this.p.alpha)
    }

    _pdf (x) {
      return (x < this.p.L || x > this.p.H) ? 0
        : this.p.alpha * Math.pow(this.p.L / x, this.p.alpha) / (x * this.c[2])
    }

    _cdf (x) {
      return x < this.p.L ? 0 : (x > this.p.H ? 1 : (1 - this.c[0] * Math.pow(x, -this.p.alpha)) / (1 - this.c[0] / this.c[1]))
    }

    support () {
      return [{
        value: this.p.L,
        closed: true
      }, {
        value: this.p.H,
        closed: true
      }]
    }
  }

  /**
   * Generator for [Cauchy distribution]{@link https://en.wikipedia.org/wiki/Cauchy_distribution}:
   *
   * $$f(x; x_0, \gamma) = \frac{1}{\pi\gamma\bigg[1 + \Big(\frac{x - x_0}{\gamma}\Big)^2\bigg]}$$
   *
   * where \(x_0 \in \mathbb{R}\) and \(\gamma \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}\).
   *
   * @class Cauchy
   * @memberOf ran.dist
   * @param {number=} x0 Location parameter. Default value is 0.
   * @param {number=} gamma Scale parameter. Default value is 1.
   * @constructor
   */
  class Cauchy extends Distribution {
    constructor (x0 = 0, gamma = 1) {
      super('continuous', arguments.length)
      this.p = { x0, gamma }
      this.c = [Math.PI * this.p.gamma]
    }

    _generator () {
      // Inverse transform sampling
      return this.p.x0 + this.p.gamma * (Math.tan(Math.PI * (Math.random() - 0.5)))
    }

    _pdf (x) {
      let y = (x - this.p.x0) / this.p.gamma
      return 1 / (this.c[0] * (1 + y * y))
    }

    _cdf (x) {
      return 0.5 + Math.atan2(x - this.p.x0, this.p.gamma) / Math.PI
    }

    support () {
      return [{
        value: null,
        closed: false
      }, {
        value: null,
        closed: false
      }]
    }
  }

  /**
   * Generator for a custom distribution, using the
   * [alias table method]{@link http://www.keithschwarz.com/darts-dice-coins}:
   *
   * $$f(k; \{w\}) = \frac{w_k}{\sum_j w_j},$$
   *
   * where \(w_k \in \mathbb{R}^+\). Support: \(k \in \mathbb{N}_0\).
   *
   * @class Custom
   * @memberOf ran.dist
   * @param {number[]} weights Weights for the distribution (doesn't need to be normalized). Default value is an array
   * with a single value of 1.
   * @constructor
   */
  class Custom extends Distribution {
    constructor (weights = [1]) {
      super('discrete', arguments.length)
      this.p = { n: weights.length, weights }

      // Pre-compute tables
      let n = weights.length

      let prob = [0]

      let alias = [0]

      let sum = 0
      if (weights.length > 1) {
        // Get sum (for normalization)
        for (let i = 0; i < n; i++) { sum += weights[i] }

        // Fill up small and large work lists
        let p = []

        let small = []

        let large = []
        for (let i = 0; i < n; i++) {
          p.push(n * weights[i] / sum)
          if (p[i] < 1.0) { small.push(i) } else { large.push(i) }
        }

        // Init tables
        prob = []
        alias = []
        for (let i = 0; i < n; i++) {
          prob.push(1.0)
          alias.push(i)
        }

        // Fill up alias table
        let s = 0

        let l = 0
        while (small.length > 0 && large.length > 0) {
          s = small.shift()
          l = large.shift()

          prob[s] = p[s]
          alias[s] = l

          p[l] += p[s] - 1.0
          if (p[l] < 1.0) { small.push(l) } else { large.push(l) }
        }
        while (large.length > 0) {
          l = large.shift()
          prob[l] = 1.0
          alias[l] = l
        }
        while (small.length > 0) {
          s = small.shift()
          prob[s] = 1.0
          alias[s] = s
        }
      }

      // Build pmf and cdf
      let pmf = [weights[0] / sum]

      let cdf = [weights[0] / sum]
      for (let i = 1; i < weights.length; i++) {
        pmf.push(weights[i] / sum)
        cdf.push(cdf[i - 1] + weights[i] / sum)
      }

      // Assign to constants
      this.c = [prob, alias, pmf, cdf]
    }

    _generator () {
      // Direct sampling
      if (this.p.n <= 1) {
        return 0
      }
      let i = Math.floor(Math.random() * this.p.n)
      if (Math.random() < this.c[0][i]) { return i } else { return this.c[1][i] }
    }

    _pdf (x) {
      let xi = parseInt(x)
      if (this.p.n <= 1) {
        return xi !== 0 ? 0 : 1
      } else {
        return (xi < 0 || xi >= this.p.n) ? 0 : this.c[2][xi]
      }
    }

    _cdf (x) {
      let xi = parseInt(x)
      if (this.p.n <= 1) {
        return xi < 0 ? 0 : 1
      } else {
        return xi < 0 ? 0 : xi >= this.p.n ? 1 : this.c[3][xi]
      }
    }

    support () {
      return [{
        value: 0,
        closed: true
      }, {
        value: Math.max(0, this.p.n - 1),
        closed: true
      }]
    }
  }

  /**
   * Generator for the [degenerate distribution]{@link https://en.wikipedia.org/wiki/Degenerate_distribution}:
   *
   * $$f(x; x_0) = \begin{cases}1 &\quad\text{if $x = x_0$}\\0 &\quad\text{otherwise}\\\end{cases},$$
   *
   * where \(x_0 \in \mathbb{R}\). Support: \(x \in \mathbb{R}\).
   *
   * @class Degenerate
   * @memberOf ran.dist
   * @param {number=} x0 Location of the distribution. Default value is 0.
   * @constructor
   */
  class Degenerate extends Distribution {
    constructor (x0 = 0) {
      super('continuous', arguments.length)
      this.p = { x0 }
    }

    _generator () {
      // Direct sampling
      return this.p.x0
    }

    _pdf (x) {
      return x === this.p.x0 ? 1 : 0
    }

    _cdf (x) {
      return x < this.p.x0 ? 0 : 1
    }

    support () {
      return [{
        value: this.p.x0,
        closed: true
      }, {
        value: this.p.x0,
        closed: true
      }]
    }
  }

  /**
   * Generator for the [exponential distribution]{@link https://en.wikipedia.org/wiki/Exponential_distribution}:
   *
   * $$f(x; \lambda) = \lambda e^{-\lambda x},$$
   *
   * with \(\lambda \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
   *
   * @class Exponential
   * @memberOf ran.dist
   * @param {number=} lambda Rate parameter. Default value is 1.
   * @constructor
   */
  class Exponential extends Distribution {
    constructor (lambda = 1) {
      super('continuous', arguments.length)
      this.p = { lambda }
    }

    _generator () {
      // Inverse transform sampling
      return -Math.log(Math.random()) / this.p.lambda
    }

    _pdf (x) {
      return x < 0 ? 0 : this.p.lambda * Math.exp(-this.p.lambda * x)
    }

    _cdf (x) {
      return x < 0 ? 0 : 1 - Math.exp(-this.p.lambda * x)
    }

    support () {
      return [{
        value: 0,
        closed: true
      }, {
        value: null,
        closed: false
      }]
    }
  }

  /**
   * Generator for the [F distribution]{@link https://en.wikipedia.org/wiki/F-distribution}:
   *
   * $$f(x; d_1, d_2) = \frac{\sqrt{\frac{(d_1 x)^{d_1} d_2^{d_2}}{(d_1x + d_2)^{d_1 + d_2}}}}{x \mathrm{B}\big(\frac{d_1}{2}, \frac{d_2}{2}\big)},$$
   *
   * with \(d_1, d_2 \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
   *
   * @class F
   * @memberOf ran.dist
   * @param {number=} d1 First degree of freedom. Default value is 2.
   * @param {number=} d2 Second degree of freedom. Default value is 2.
   * @constructor
   */
  class F extends Distribution {
    constructor (d1 = 2, d2 = 2) {
      super('continuous', arguments.length)
      this.p = { d1, d2 }
      this.c = [special.beta(d1 / 2, d2 / 2), Math.pow(d2, d2)]
    }

    _generator () {
      // Direct sampling from gamma
      return this.p.d2 * _gamma(this.p.d1 / 2, 1) / (this.p.d1 * _gamma(this.p.d2 / 2, 1))
    }

    _pdf (x) {
      return x > 0 ? Math.sqrt(Math.pow(this.p.d1 * x, this.p.d1) * this.c[1] / Math.pow(this.p.d1 * x + this.p.d2, this.p.d1 + this.p.d2)) / (x * this.c[0]) : 0
    }

    _cdf (x) {
      return x > 0 ? special.betaIncomplete(this.p.d1 / 2, this.p.d2 / 2, this.p.d1 * x / (this.p.d1 * x + this.p.d2)) : 0
    }

    support () {
      return [{
        value: 0,
        closed: this.p.d1 !== 1
      }, {
        value: null,
        closed: false
      }]
    }
  }

  /**
   * Generator for the [Frechet distribution]{@link https://en.wikipedia.org/wiki/Frechet_distribution}:
   *
   * $$f(x; \alpha, s, m) = \frac{\alpha z^{-1 -\alpha} e^{-z^{-\alpha}}}{s},$$
   *
   * with \(z = \frac{x - m}{s}\). and \(\alpha, s \in \mathbb{R}^+\), \(m \in \mathbb{R}\). Support: \(x \in \mathbb{R}, x > m\).
   *
   * @class Frechet
   * @memberOf ran.dist
   * @param {number=} alpha Shape parameter. Default value is 1.
   * @param {number=} s Scale parameter. Default value is 1.
   * @param {number=} m Location parameter. Default value is 0.
   * @constructor
   */
  class Frechet extends Distribution {
    constructor (alpha = 1, s = 1, m = 0) {
      super('continuous', arguments.length)
      this.p = { alpha, s, m }
    }

    _generator () {
      // Inverse transform sampling
      return this.p.m + this.p.s * Math.pow(-Math.log(Math.random()), -1 / this.p.alpha)
    }

    _pdf (x) {
      if (x <= this.p.m) {
        return 0
      } else {
        let z = (x - this.p.m) / this.p.s
        return this.p.alpha * Math.pow(z, -1 - this.p.alpha) * Math.exp(-Math.pow(z, -this.p.alpha)) / this.p.s
      }
    }

    _cdf (x) {
      return x <= this.p.m ? 0 : Math.exp(-Math.pow((x - this.p.m) / this.p.s, -this.p.alpha))
    }

    support () {
      return [{
        value: this.p.m,
        closed: false
      }, {
        value: null,
        closed: false
      }]
    }
  }

  /**
   * Generator for the [gamma distribution]{@link https://en.wikipedia.org/wiki/Gamma_distribution} using the
   * shape/rate parametrization:
   *
   * $$f(x; \alpha, \beta) = \frac{\beta^\alpha}{\Gamma(\alpha)} x^{\alpha - 1} e^{-\beta x},$$
   *
   * where \(\alpha, \beta \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
   *
   * @class Gamma
   * @memberOf ran.dist
   * @param {number=} alpha Shape parameter. Default value is 1.
   * @param {number=} beta Rate parameter. Default value is 1.
   * @constructor
   */
  class Gamma extends Distribution {
    constructor (alpha = 1, beta = 1) {
      super('continuous', arguments.length)
      this.p = { alpha, beta }
      this.c = [Math.pow(beta, alpha), special.gamma(alpha)]
    }

    _generator () {
      // Direct sampling
      return _gamma(this.p.alpha, this.p.beta)
    }

    _pdf (x) {
      return x > 0 ? this.c[0] * Math.exp((this.p.alpha - 1) * Math.log(x) - this.p.beta * x) / this.c[1] : 0
    }

    _cdf (x) {
      return special.gammaLowerIncomplete(this.p.alpha, this.p.beta * x) / this.c[1]
    }

    support () {
      return [{
        value: 0,
        closed: true
      }, {
        value: null,
        closed: false
      }]
    }
  }

  /**
   * Generator for the [generalized gamma distribution]{@link https://en.wikipedia.org/wiki/Generalized_gamma_distribution}:
   *
   * $$f(x; a, d, p) = \frac{p/a^d}{\Gamma(d/p)} x^{d - 1} e^{-(x/a)^p},$$
   *
   * where \(a, d, p \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
   *
   * @class GeneralizedGamma
   * @memberOf ran.dist
   * @param {number=} a Scale parameter. Default value is 1.
   * @param {number=} d Shape parameter. Default value is 1.
   * @param {number=} p Shape parameter. Default value is 1.
   * @constructor
   */
  class GeneralizedGamma extends Distribution {
    constructor (a = 1, d = 1, p = 1) {
      super('continuous', arguments.length)
      this.p = { a, d, p }
      this.c = [special.gamma(d / p), (p / Math.pow(a, d)), 1 / Math.pow(a, p)]
    }

    _generator () {
      // Direct sampling from gamma
      return Math.pow(_gamma(this.p.d / this.p.p, this.c[2]), 1 / this.p.p)
    }

    _pdf (x) {
      return x > 0 ? this.c[1] * Math.exp((this.p.d - 1) * Math.log(x) - Math.pow(x / this.p.a, this.p.p)) / this.c[0] : 0
    }

    _cdf (x) {
      return x > 0 ? special.gammaLowerIncomplete(this.p.d / this.p.p, Math.pow(x / this.p.a, this.p.p)) / this.c[0] : 0
    }

    support () {
      return [{
        value: 0,
        closed: this.p.d >= 1
      }, {
        value: null,
        closed: false
      }]
    }
  }

  /**
   * Generator for the [Gompertz distribution]{@link https://en.wikipedia.org/wiki/Gompertz_distribution}:
   *
   * $$f(x; \eta, b) = b \eta e^{\eta + bx - \eta e^{bx}} ,$$
   *
   * with \(\eta, b \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
   *
   * @class Gompertz
   * @memberOf ran.dist
   * @param {number=} eta Shape parameter. Default value is 1.
   * @param {number=} beta Scale parameter. Default value is 1.
   * @constructor
   */
  class Gompertz extends Distribution {
    constructor (eta = 1, b = 1) {
      super('continuous', arguments.length)
      this.p = { eta, b }
    }

    _generator () {
      // Inverse transform sampling
      return Math.log(1 - Math.log(Math.random()) / this.p.eta) / this.p.b
    }

    _pdf (x) {
      return x < 0 ? 0 : this.p.b * this.p.eta * Math.exp(this.p.eta + this.p.b * x - this.p.eta * Math.exp(this.p.b * x))
    }

    _cdf (x) {
      return x < 0 ? 0 : 1 - Math.exp(-this.p.eta * (Math.exp(this.p.b * x) - 1))
    }

    support () {
      return [{
        value: 0,
        closed: true
      }, {
        value: null,
        closed: false
      }]
    }
  }

  /**
   * Generator for the [Gumbel distribution]{@link https://en.wikipedia.org/wiki/Gumbel_distribution}:
   *
   * $$f(x; \mu, \beta) = \frac{1}{\beta} e^{-(z + e^-z)},$$
   *
   * with \(z = \frac{x - \mu}{\beta}\) and \(\mu \in \mathbb{R}\), \(\beta \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}\).
   *
   * @class Gumbel
   * @memberOf ran.dist
   * @param {number=} mu Location parameter. Default value is 0.
   * @param {number=} beta Scale parameter. Default value is 1.
   * @constructor
   */
  class Gumbel extends Distribution {
    constructor (mu = 0, beta = 1) {
      super('continuous', arguments.length)
      this.p = { mu, beta }
    }

    _generator () {
      // Inverse transform sampling
      return this.p.mu - this.p.beta * Math.log(-Math.log(Math.random()))
    }

    _pdf (x) {
      let z = (x - this.p.mu) / this.p.beta
      return Math.exp(-(z + Math.exp(-z))) / this.p.beta
    }

    _cdf (x) {
      return Math.exp(-Math.exp(-(x - this.p.mu) / this.p.beta))
    }

    support () {
      return [{
        value: null,
        closed: false
      }, {
        value: null,
        closed: false
      }]
    }
  }

  /**
   * Generator for the [Erlang distribution]{@link https://en.wikipedia.org/wiki/Erlang_distribution}:
   *
   * $$f(x; k, \lambda) = \frac{\lambda^k x^{k - 1} e^{-\lambda x}}{(k - 1)!},$$
   *
   * where \(k \in \mathbb{N}^+\) and \(\lambda \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
   *
   * @class Erlang
   * @memberOf ran.dist
   * @param {number=} k Shape parameter. It is rounded to the nearest integer. Default value is 1.
   * @param {number=} lambda Rate parameter. Default value is 1.
   * @constructor
   */
  class Erlang extends Gamma {
    // Special case of gamma
    constructor (k = 1, lambda = 1) {
      super(Math.round(k), lambda)
    }
  }

  /**
   * Generator for the [\(\chi^2\) distribution]{@link https://en.wikipedia.org/wiki/Chi-squared_distribution}:
   *
   * $$f(x; k) = \frac{1}{2^{k/2} \Gamma(k/2)} x^{k/2 - 1} e^{-x/2},$$
   *
   * where \(k \in \mathbb{N}^+\). Support: \(x \in \mathbb{R}^+\).
   *
   * @class Chi2
   * @memberOf ran.dist
   * @param {number=} k Degrees of freedom. If not an integer, is rounded to the nearest one. Default value is 2.
   * @constructor
   */
  class Chi2 extends Gamma {
    // Special case of gamma
    constructor (k = 2) {
      super(Math.round(k) / 2, 0.5)
    }
  }

  /**
   * Generator for the [inverse gamma distribution]{@link https://en.wikipedia.org/wiki/Inverse-gamma_distribution}:
   *
   * $$f(x; \alpha, \beta) = \frac{\beta^\alpha}{\Gamma(\alpha)} x^{-\alpha - 1} e^{-\beta/x},$$
   *
   * where \(\alpha, \beta \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
   *
   * @class InverseGamma
   * @memberOf ran.dist
   * @param {number=} alpha Shape parameter. Default value is 1.
   * @param {number=} beta Scale parameter. Default value is 1.
   * @constructor
   */
  class InverseGamma extends Distribution {
    constructor (alpha = 1, beta = 1) {
      super('continuous', arguments.length)
      this.p = { alpha, beta }
      this.c = [Math.pow(beta, alpha) / special.gamma(alpha), special.gamma(alpha)]
    }

    _generator () {
      // Direct sampling from gamma
      return 1 / _gamma(this.p.alpha, this.p.beta)
    }

    _pdf (x) {
      return x > 0 ? this.c[0] * Math.pow(x, -1 - this.p.alpha) * Math.exp(-this.p.beta / x) : 0
    }

    _cdf (x) {
      return x > 0 ? 1 - special.gammaLowerIncomplete(this.p.alpha, this.p.beta / x) / this.c[1] : 0
    }

    support () {
      return [{
        value: 0,
        closed: false
      }, {
        value: null,
        closed: false
      }]
    }
  }

  /**
   * Generator for the Wald or [inverse Gaussian distribution]{@link https://en.wikipedia.org/wiki/Inverse_Gaussian_distribution}:
   *
   * $$f(x; \lambda, \mu) = \bigg[\frac{\lambda}{2 \pi x^3}\bigg]^{1/2} e^{\frac{-\lambda (x - \mu)^2}{2 \mu^2 x}},$$
   *
   * with \(\lambda, \mu \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
   *
   * @class InverseGaussian
   * @memberOf ran.dist
   * @param {number} lambda Shape parameter. Default value is 1.
   * @param {number} mu Mean of the distribution. Default value is 1.
   * @constructor
   */
  class InverseGaussian extends Distribution {
    constructor (lambda = 1, mu = 1) {
      super('continuous', arguments.length)
      this.p = { lambda, mu }
      this.c = [0.5 * this.p.mu / this.p.lambda, Math.exp(2 * lambda / mu)]
    }

    static _phi (x) {
      return 0.5 * (1 + special.erf(x / Math.SQRT2))
    }

    _generator () {
      // Direct sampling
      let nu = _normal()

      let y = nu * nu

      let x = this.p.mu + this.c[0] * this.p.mu * y - this.c[0] * Math.sqrt(this.p.mu * y * (4 * this.p.lambda + this.p.mu * y))
      return Math.random() > this.p.mu / (this.p.mu + x) ? this.p.mu * this.p.mu / x : x
    }

    _pdf (x) {
      return x > 0 ? Math.sqrt(this.p.lambda / (2 * Math.PI * Math.pow(x, 3))) * Math.exp(-this.p.lambda * Math.pow(x - this.p.mu, 2) / (2 * this.p.mu * this.p.mu * x)) : 0
    }

    _cdf (x) {
      let s = Math.sqrt(this.p.lambda / x)

      let t = x / this.p.mu
      return x > 0 ? InverseGaussian._phi(s * (t - 1)) + this.c[1] * InverseGaussian._phi(-s * (t + 1)) : 0
    }

    support () {
      return [{
        value: 0,
        closed: true
      }, {
        value: null,
        closed: false
      }]
    }
  }

  /**
   * Generator for the [Laplace distribution]{@link https://en.wikipedia.org/wiki/Laplace_distribution}:
   *
   * $$f(x; \mu, b) = \frac{1}{2b}e^{-\frac{|x - \mu|}{b}},$$
   *
   * where \(\mu \in \mathbb{R}\) and \(b \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}\).
   *
   * @class Laplace
   * @memberOf ran.dist
   * @param {number=} mu Location parameter. Default value is 0.
   * @param {number=} b Scale parameter. Default value is 1.
   * @constructor
   */
  class Laplace extends Distribution {
    constructor (mu = 0, b = 1) {
      super('continuous', arguments.length)
      this.p = { mu, b }
    }

    _generator () {
      // Direct sampling from uniform
      return this.p.b * Math.log(Math.random() / Math.random()) + this.p.mu
    }

    _pdf (x) {
      return 0.5 * Math.exp(-Math.abs(x - this.p.mu) / this.p.b) / this.p.b
    }

    _cdf (x) {
      let z = Math.exp((x - this.p.mu) / this.p.b)
      return x < this.p.mu ? 0.5 * z : 1 - 0.5 / z
    }

    support () {
      return [{
        value: null,
        closed: false
      }, {
        value: null,
        closed: false
      }]
    }
  }

  /**
   * Generator for the [log-Cauchy distribution]{@link https://en.wikipedia.org/wiki/Log-Cauchy_distribution}:
   *
   * $$f(x; \mu, \sigma) = \frac{1}{\pi x}\bigg[\frac{\sigma}{(\ln x - \mu)^2 + \sigma^2}\bigg],$$
   *
   * with \(\mu \in \mathbb{R}\) and \(\sigma \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
   *
   * @class LogCauchy
   * @memberOf ran.dist
   * @param {number=} mu Location parameter. Default value is 0.
   * @param {number=} sigma Scale parameter. Default value is 1.
   * @constructor
   */
  class LogCauchy extends Distribution {
    constructor (mu = 0, sigma = 1) {
      super('continuous', arguments.length)
      this.p = { mu, sigma }
    }

    _generator () {
      // Inverse transform sampling
      return Math.exp(this.p.mu + this.p.sigma * Math.tan(Math.PI * (Math.random() - 0.5)))
    }

    _pdf (x) {
      return x > 0 ? this.p.sigma / (x * Math.PI * (this.p.sigma * this.p.sigma + Math.pow(Math.log(x) - this.p.mu, 2))) : 0
    }

    _cdf (x) {
      return x > 0 ? 0.5 + Math.atan2(Math.log(x) - this.p.mu, this.p.sigma) / Math.PI : 0
    }

    support () {
      return [{
        value: 0,
        closed: false
      }, {
        value: null,
        closed: false
      }]
    }
  }

  /**
   * Generator for the [logistic distribution]{@link https://en.wikipedia.org/wiki/Logistic_distribution}:
   *
   * $$f(x; \mu, s) = \frac{e^{-z}}{s (1 + e^{-z})^2},$$
   *
   * with \(z = \frac{x - \mu}{s}\), \(\mu \in \mathbb{R}\) and \(s \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}\).
   *
   * @class Logistic
   * @memberOf ran.dist
   * @param {number=} mu Location parameter. Default value is 0.
   * @param {number=} s Scale parameter. Default value is 1.
   * @constructor
   */
  class Logistic extends Distribution {
    constructor (mu = 0, s = 1) {
      super('continuous', arguments.length)
      this.p = { mu, s }
    }

    _generator () {
      // Inverse transform sampling
      return this.p.mu - this.p.s * Math.log(1 / Math.random() - 1)
    }

    _pdf (x) {
      let z = Math.exp(-(x - this.p.mu) / this.p.s)
      return z / (this.p.s * Math.pow(1 + z, 2))
    }

    _cdf (x) {
      return 1 / (1 + Math.exp(-(x - this.p.mu) / this.p.s))
    }

    support () {
      return [{
        value: null,
        closed: false
      }, {
        value: null,
        closed: false
      }]
    }
  }

  /**
   * Generator for the [shifted log-logistic distribution]{@link https://en.wikipedia.org/wiki/Shifted_log-logistic_distribution}:
   *
   * $$f(x; \mu, s) = \frac{e^{-z}}{s (1 + e^{-z})^2},$$
   *
   * with \(z = \frac{x - \mu}{\sigma}\), \(\mu, \xi \in \mathbb{R}\) and \(\sigma \in \mathbb{R}^+\). Support: \(x \ge \mu-\sigma/\xi\) if \(\xi > 0\), \(x \le \mu-\sigma/\xi\) if \(\xi < 0\), \(x \in \mathbb{R}\) otherwise.
   *
   * @class LogLogistic
   * @memberOf ran.dist
   * @param {number=} mu Location parameter. Default value is 0.
   * @param {number=} sigma Scale parameter. Default value is 1.
   * @param {number=} xi Shape parameter. Default value is 1.
   * @constructor
   */
  class LogLogistic extends Distribution {
    constructor (mu = 0, sigma = 1, xi = 1) {
      super('continuous', arguments.length)
      this.p = { mu, sigma, xi }
    }

    _generator () {
      // Inverse transform sampling
      if (this.p.xi === 0) {
        return this.p.mu - this.p.sigma * Math.log(1 / Math.random() - 1)
      } else {
        return this.p.mu + this.p.sigma * (Math.pow(1 / Math.random() - 1, -this.p.xi) - 1) / this.p.xi
      }
    }

    _pdf (x) {
      if (this.p.xi === 0) {
        let z = Math.exp(-(x - this.p.mu) / this.p.sigma)
        return z / (this.p.sigma * Math.pow(1 + z, 2))
      } else {
        let z = (x - this.p.mu) / this.p.sigma

        let p = Math.pow(1 + this.p.xi * z, -(1 / this.p.xi + 1)) / (this.p.sigma * Math.pow(1 + Math.pow(1 + this.p.xi * z, -1 / this.p.xi), 2))
        if (this.p.xi > 0) {
          return x >= this.p.mu - this.p.sigma / this.p.xi ? p : 0
        } else {
          return x <= this.p.mu - this.p.sigma / this.p.xi ? p : 0
        }
      }
    }

    _cdf (x) {
      if (this.p.xi === 0) {
        return 1 / (1 + Math.exp(-(x - this.p.mu) / this.p.sigma))
      } else {
        let z = (x - this.p.mu) / this.p.sigma

        let c = 1 / (1 + Math.pow(1 + this.p.xi * z, -1 / this.p.xi))
        if (this.p.xi > 0) {
          return x >= this.p.mu - this.p.sigma / this.p.xi ? c : 0
        } else {
          return x <= this.p.mu - this.p.sigma / this.p.xi ? c : 0
        }
      }
    }

    support () {
      return this.p.xi === 0 ? [{
        value: null,
        closed: false
      }, {
        value: null,
        closed: false
      }] : [{
        value: this.p.xi > 0 ? this.p.mu - this.p.sigma / this.p.xi : null,
        closed: this.p.xi > 0
      }, {
        value: this.p.x < 0 ? this.p.mu - this.p.sigma / this.p.xi : null,
        closed: this.p.xi < 0
      }]
    }
  }

  /**
   * Generator for the [lognormal distribution]{@link https://en.wikipedia.org/wiki/Log-normal_distribution}:
   *
   * $$f(x; \mu, \sigma) = \frac{1}{x \sigma \sqrt{2 \pi}}e^{-\frac{(\ln x - \mu)^2}{2\sigma^2}},$$
   *
   * where \(\mu \in \mathbb{R}\) and \(\sigma \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
   *
   * @class Lognormal
   * @memberOf ran.dist
   * @param {number=} mu Location parameter. Default value is 0.
   * @param {number=} sigma Scale parameter. Default value is 1.
   * @constructor
   */
  class Lognormal extends Distribution {
    constructor (mu = 0, sigma = 1) {
      super('continuous', arguments.length)
      this.p = { mu, sigma }
      this.c = [sigma * Math.sqrt(2 * Math.PI), sigma * Math.SQRT2]
    }

    _generator () {
      // Direct sampling from normal
      return Math.exp(this.p.mu + this.p.sigma * _normal(0, 1))
    }

    _pdf (x) {
      return x > 0 ? Math.exp(-0.5 * Math.pow((Math.log(x) - this.p.mu) / this.p.sigma, 2)) / (x * this.c[0]) : 0
    }

    _cdf (x) {
      return x > 0 ? 0.5 * (1 + special.erf((Math.log(x) - this.p.mu) / this.c[1])) : 0
    }

    support () {
      return [{
        value: 0,
        closed: false
      }, {
        value: null,
        closed: false
      }]
    }
  }

  /**
   * Generator for the [Lomax distribution]{@link https://en.wikipedia.org/wiki/Lomax_distribution}:
   *
   * $$f(x; \lambda, \alpha) = \frac{\alpha}{\lambda}\bigg[1 + \frac{x}{\lambda}\bigg]^{-(\alpha - 1)},$$
   *
   * with \(\lambda, \alpha \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
   *
   * @class Lomax
   * @memberOf ran.dist
   * @param {number=} lambda Scale parameter. Default value is 1.
   * @param {number=} alpha Shape parameter. Default value is 1.
   * @constructor
   */
  class Lomax extends Distribution {
    constructor (lambda = 1, alpha = 1) {
      super('continuous', arguments.length)
      this.p = { lambda, alpha }
    }

    _generator () {
      // Inverse transform sampling
      return this.p.lambda * (Math.pow(Math.random(), -1 / this.p.alpha) - 1)
    }

    _pdf (x) {
      return x < 0 ? 0 : this.p.alpha * Math.pow(1 + x / this.p.lambda, -1 - this.p.alpha) / this.p.lambda
    }

    _cdf (x) {
      return x < 0 ? 0 : 1 - Math.pow(1 + x / this.p.lambda, -this.p.alpha)
    }

    support () {
      return [{
        value: 0,
        closed: true
      }, {
        value: null,
        closed: false
      }]
    }
  }

  /**
   * Generator for the [Minimax distribution]{@link http://stats-www.open.ac.uk/TechnicalReports/minimax.pdf} (as defined in <i>M. C. Jones, The Minimax Distribution: A Beta-Type Distribution With Some Tractability Advantages. The Open University, UK., pp: 1-21.</i>):
   *
   * $$f(x; \alpha, \beta) = \alpha \beta x^{\alpha-1} (1 - x^\alpha)^{\beta - 1},$$
   *
   * with \(\alpha, \beta \in \mathbb{R}^+\). Support: \(x \in (0, 1)\).
   *
   * @class Minimax
   * @memberOf ran.dist
   * @param {number=} alpha First shape parameter. Default value is 1.
   * @param {number=} beta Second shape parameter. Default value is 1.
   * @constructor
   */
  class Minimax extends Distribution {
    constructor (alpha = 1, beta = 1) {
      super('continuous', arguments.length)
      this.p = { alpha, beta }
    }

    _generator () {
      // Inverse transform sampling
      return Math.pow(1 - Math.pow(1 - Math.random(), 1 / this.p.beta), 1 / this.p.alpha)
    }

    _pdf (x) {
      return x > 0 && x < 1 ? this.p.alpha * this.p.beta * Math.pow(x, this.p.alpha - 1) * Math.pow(1 - Math.pow(x, this.p.alpha), this.p.beta - 1) : 0
    }

    _cdf (x) {
      return x > 0 && x < 1 ? 1 - Math.pow(1 - Math.pow(x, this.p.alpha), this.p.beta) : 0
    }

    support () {
      return [{
        value: 0,
        closed: false
      }, {
        value: 0,
        closed: false
      }]
    }
  }

  /**
   * Generator for the [normal distribution]{@link https://en.wikipedia.org/wiki/Normal_distribution}:
   *
   * $$f(x; \mu, \sigma) = \frac{1}{\sqrt{2 \pi \sigma^2}} e^{-\frac{(x - \mu)^2}{2\sigma^2}},$$
   *
   * with \(\mu \in \mathbb{R}\) and \(\sigma \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}\).
   *
   * @class Normal
   * @memberOf ran.dist
   * @param {number=} mu Location parameter (mean). Default value is 0.
   * @param {number=} sigma Squared scale parameter (variance). Default value is 1.
   * @constructor
   */
  class Normal extends Distribution {
    constructor (mu = 0, sigma = 1) {
      super('continuous', arguments.length)
      this.p = { mu, sigma }
      this.c = [sigma * Math.sqrt(2 * Math.PI), sigma * Math.SQRT2]
    }

    _generator () {
      // Direct sampling
      return _normal(this.p.mu, this.p.sigma)
    }

    _pdf (x) {
      return Math.exp(-0.5 * Math.pow((x - this.p.mu) / this.p.sigma, 2)) / this.c[0]
    }

    _cdf (x) {
      return 0.5 * (1 + special.erf((x - this.p.mu) / this.c[1]))
    }

    support () {
      return [{
        value: null,
        closed: false
      }, {
        value: null,
        closed: false
      }]
    }
  }

  /**
   * Generator for the [Pareto distribution]{@link https://en.wikipedia.org/wiki/Pareto_distribution}:
   *
   * $$f(x; x_\mathrm{min}, \alpha) = \frac{\alpha x_\mathrm{min}^\alpha}{x^{\alpha + 1}},$$
   *
   * with \(x_\mathrm{min}, \alpha \in \mathbb{R}^+\). Support: \(x \in [x_\mathrm{min}, \infty)\).
   *
   * @class Pareto
   * @memberOf ran.dist
   * @param {number=} xmin Scale parameter. Default value is 1.
   * @param {number=} alpha Shape parameter. Default value is 1.
   * @constructor
   */
  class Pareto extends Distribution {
    constructor (xmin = 1, alpha = 1) {
      super('continuous', arguments.length)
      this.p = { xmin, alpha }
    }

    _generator () {
      // Inverse transform sampling
      return this.p.xmin / Math.pow(Math.random(), 1 / this.p.alpha)
    }

    _pdf (x) {
      return x < this.p.xmin ? 0 : this.p.alpha * Math.pow(this.p.xmin / x, this.p.alpha) / x
    }

    _cdf (x) {
      return x < this.p.xmin ? 0 : 1 - Math.pow(this.p.xmin / x, this.p.alpha)
    }

    support () {
      return [{
        value: this.p.xmin,
        closed: true
      }, {
        value: null,
        closed: false
      }]
    }
  }

  /**
   * Generator for the [Poisson distribution]{@link https://en.wikipedia.org/wiki/Poisson_distribution}:
   *
   * $$f(k; \lambda) = \frac{\lambda^k e^{-\lambda}}{k!},$$
   *
   * with \(\lambda \in \mathbb{R}^+\). Support: \(k \in \mathbb{N}_0\).
   *
   * @class Poisson
   * @memberOf ran.dist
   * @param {number=} lambda Mean of the distribution. Default value is 1.
   * @constructor
   */
  class Poisson extends Distribution {
    constructor (lambda = 1) {
      super('discrete', arguments.length)
      this.p = { lambda }
    }

    _generator () {
      // Direct sampling
      if (this.p.lambda < 30) {
        // Small lambda, Knuth's method
        let l = Math.exp(-this.p.lambda)

        let k = 0

        let p = 1
        do {
          k++
          p *= Math.random()
        } while (p > l)
        return k - 1
      } else {
        // Large lambda, normal approximation
        let c = 0.767 - 3.36 / this.p.lambda

        let beta = Math.PI / Math.sqrt(3 * this.p.lambda)

        let alpha = beta * this.p.lambda

        let k = Math.log(c) - this.p.lambda - Math.log(beta)
        // while (true) {
        for (let trials = 0; trials < _MAX_TRIALS; trials++) {
          let r, x, n
          do {
            r = Math.random()
            x = (alpha - Math.log((1 - r) / r)) / beta
            n = Math.floor(x + 0.5)
          } while (n < 0)
          let v = Math.random()

          let y = alpha - beta * x

          let lhs = y + Math.log(v / Math.pow(1.0 + Math.exp(y), 2))

          let rhs = k + n * Math.log(this.p.lambda) - special.gammaLn(n + 1)
          if (lhs <= rhs) { return n }
        }
      }
    }

    _pdf (x) {
      let xi = parseInt(x)
      return xi < 0 ? 0 : Math.pow(this.p.lambda, xi) * Math.exp(-this.p.lambda) / special.gamma(xi + 1)
    }

    _cdf (x) {
      let xi = parseInt(x)
      return xi < 0 ? 0 : 1 - special.gammaLowerIncomplete(xi + 1, this.p.lambda) / special.gamma(xi + 1)
    }

    support () {
      return [{
        value: 0,
        closed: true
      }, {
        value: null,
        closed: false
      }]
    }
  }

  /**
   * Generator for the continuous
   * [uniform distribution]{@link https://en.wikipedia.org/wiki/Uniform_distribution_(continuous)}:
   *
   * $$f(x; x_\mathrm{min}, x_\mathrm{max}) = \frac{1}{x_\mathrm{max} - x_\mathrm{min}},$$
   *
   * with \(x_\mathrm{min}, x_\mathrm{max} \in \mathbb{R}\) and \(x_\mathrm{min} < x_\mathrm{max}\).
   * Support: \(x \in [x_\mathrm{min}, x_\mathrm{max}]\).
   *
   * @class UniformContinuous
   * @memberOf ran.dist
   * @param {number=} xmin Lower boundary. Default value is 0.
   * @param {number=} xmax Upper boundary. Default value is 1.
   * @constructor
   */
  class UniformContinuous extends Distribution {
    constructor (xmin = 0, xmax = 1) {
      super('continuous', arguments.length)
      this.p = { xmin, xmax }
      this.c = [xmax - xmin]
    }

    _generator () {
      // Direct sampling
      return Math.random() * this.c[0] + this.p.xmin
    }

    _pdf (x) {
      return x < this.p.xmin || x > this.p.xmax ? 0 : 1 / this.c[0]
    }

    _cdf (x) {
      return x < this.p.xmin ? 0 : x > this.p.xmax ? 1 : (x - this.p.xmin) / this.c[0]
    }

    support () {
      return [{
        value: this.p.xmin,
        closed: true
      }, {
        value: this.p.xmax,
        closed: true
      }]
    }
  }

  /**
   * Generator for the discrete
   * [uniform distribution]{@link https://en.wikipedia.org/wiki/Discrete_uniform_distribution}:
   *
   * $$f(k; x_\mathrm{min}, x_\mathrm{max}) = \frac{1}{x_\mathrm{max} - x_\mathrm{min} + 1},$$
   *
   * with \(x_\mathrm{min}, x_\mathrm{max} \in \mathbb{Z}\) and \(x_\mathrm{min} < x_\mathrm{max}\). Support: \(k \in \{x_\mathrm{min}, ..., x_\mathrm{max}\}\).
   *
   * @class UniformDiscrete
   * @memberOf ran.dist
   * @param {number=} xmin Lower boundary. Default value is 0.
   * @param {number=} xmax Upper boundary. Default value is 100.
   * @constructor
   */
  class UniformDiscrete extends Distribution {
    constructor (xmin = 0, xmax = 100) {
      super('discrete', arguments.length)
      this.p = { xmin, xmax }
      this.c = [xmax - xmin + 1]
    }

    _generator () {
      // Direct sampling
      return parseInt(Math.random() * this.c[0]) + this.p.xmin
    }

    _pdf (x) {
      let xi = parseInt(x)
      return xi < this.p.xmin || xi > this.p.xmax ? 0 : 1 / this.c[0]
    }

    _cdf (x) {
      let xi = parseInt(x)
      return xi < this.p.xmin ? 0 : xi > this.p.xmax ? 1 : (1 + xi - this.p.xmin) / this.c[0]
    }

    support () {
      return [{
        value: this.p.xmin,
        closed: true
      }, {
        value: this.p.xmax,
        closed: true
      }]
    }
  }

  /**
   * Generator for the [Weibull distribution]{@link https://en.wikipedia.org/wiki/Weibull_distribution}:
   *
   * $$f(x; \lambda, k) = \frac{k}{\lambda}\bigg(\frac{x}{\lambda}\bigg)^{k - 1} e^{-(x / \lambda)^k},$$
   *
   * with \(\lambda, k \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
   *
   * @class Weibull
   * @memberOf ran.dist
   * @param {number=} lambda Scale parameter. Default value is 1.
   * @param {number=} k Shape parameter. Default value is 1.
   * @constructor
   */
  class Weibull extends Distribution {
    constructor (lambda = 1, k = 1) {
      super('continuous', arguments.length)
      this.p = { lambda, k }
    }

    _generator () {
      // Inverse transform sampling
      return this.p.lambda * Math.pow(-Math.log(Math.random()), 1 / this.p.k)
    }

    _pdf (x) {
      return x < 0 ? 0 : (this.p.k / this.p.lambda) * Math.exp((this.p.k - 1) * Math.log(x / this.p.lambda) - Math.pow(x / this.p.lambda, this.p.k))
    }

    _cdf (x) {
      return x < 0 ? 0 : 1 - Math.exp(-Math.pow(x / this.p.lambda, this.p.k))
    }

    support () {
      return [{
        value: 0,
        closed: true
      }, {
        value: null,
        closed: false
      }]
    }
  }

  /**
   * Generator for the [Rayleigh distribution]{@link https://en.wikipedia.org/wiki/Rayleigh_distribution}:
   *
   * $$f(x; \sigma) = \frac{x}{\sigma} e^{-\frac{x^2}{2\sigma^2}},$$
   *
   * with \(\sigma \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
   *
   * @class Rayleigh
   * @memberOf ran.dist
   * @param {number} sigma Scale parameter. Default value is 1.
   * @constructor
   */
  class Rayleigh extends Weibull {
    // Special case of Weibull
    constructor (sigma = 1) {
      super(sigma * Math.SQRT2, 2)
    }
  }

  /**
   * Generator of an invalid (not implemented) distribution. Only for testing purposes.
   *
   * @class _InvalidDistribution
   * @memberOf ran.dist
   * @private
   */
  class _InvalidDistribution extends Distribution {
    constructor () {
      super('discrete', arguments.length)
    }
  }

  // Public classes
  return {
    Arcsine,
    Bernoulli,
    Beta,
    BetaPrime,
    Binomial,
    BoundedPareto,
    Cauchy,
    Chi2,
    Custom,
    Degenerate,
    Erlang,
    Exponential,
    F,
    Frechet,
    Gamma,
    GeneralizedGamma,
    Gompertz,
    Gumbel,
    InverseGamma,
    InverseGaussian,
    Laplace,
    LogCauchy,
    Logistic,
    LogLogistic,
    Lognormal,
    Lomax,
    Minimax,
    Normal,
    Pareto,
    Poisson,
    Rayleigh,
    UniformContinuous,
    UniformDiscrete,
    Weibull,
    _InvalidDistribution
  }
})()
