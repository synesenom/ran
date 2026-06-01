import Xoshiro128p from '../core/xoshiro'
import neumaier from '../algorithms/neumaier'
import powell from '../algorithms/powell'
import some from '../utils/some'
import { chi2, kolmogorovSmirnov } from './_tests'
import bracket from '../algorithms/bracket'
import chandrupatla from '../algorithms/chandrupatla'
import { MAX_ITER } from '../core/constants'

/**
 * The distribution generator base class, all distribution generators extend this class. The methods listed here
 * are available for all distribution generators. Integer parameters of a distribution are rounded. The examples provided for this class are using a Pareto
 * distribution.
 *
 * @class Distribution
 * @memberof ran.dist
 */
// Warn once when q(p) is called with p outside [0,1]; removal tracked in #594
let _qOutOfRangeWarned = false

class Distribution {
  constructor (type, k) {
    // decisions/0009-rename-single-letter-instance-fields.md — descriptive names replace single-letter abbreviations
    this._type = type

    // Number of parameters
    this.k = k

    // The parameters — natural (user-facing) params only; see decisions/0014-categorical-this-c-natural-params-split.md
    /** @type {Object} */
    this.p = {}

    // Distribution support
    this.s = []

    // Pseudo random number generator
    this.r = new Xoshiro128p()

    // Speed-up constants — must be a named object, never a positional array
    // decisions/0008-this-c-named-object-convention.md
    this.c = {}
  }

  /**
   * Validates a set of parameters using a list of constraints.
   *
   * @method validate
   * @memberof Distribution
   * @param {Object} params Object containing the parameters to validate.
   * @param {string[]} constraints Array of strings defining the parameter constraints.
   * @throws {Error} If any parameter is undefined, null, or NaN, or doesn't satisfy the constraints.
   * @ignore
   */
  static validate (params, constraints) {
    // See decisions/0004-validate-rejects-undefined-and-nan.md, solutions/correctness/2026-05-17-0847-validate-rejects-missing-params.md — comparison operators against undefined/null/NaN return false, so missing params would otherwise pass silently
    const missing = Object.entries(params)
      .filter(([, v]) => v === undefined || v === null || Number.isNaN(v))
      .map(([name]) => name)
    if (missing.length > 0) {
      throw Error(`Invalid parameters. Required parameters missing or not a number: ${missing.join(', ')}.`)
    }

    // Go through parameters and check constraints
    const errors = constraints.filter(constraint => {
      // Tokenize constraint
      let tokens = constraint.split(/ (<=|>=|!=) /)
      if (tokens.length === 1) {
        tokens = constraint.split(/ ([=<>]) /)
      }

      // Substitute parameters if there is any
      const a = Object.prototype.hasOwnProperty.call(params, tokens[0]) ? params[tokens[0]] : parseFloat(tokens[0])
      const b = Object.prototype.hasOwnProperty.call(params, tokens[2]) ? params[tokens[2]] : parseFloat(tokens[2])

      // Check for errors
      switch (tokens[1]) {
        case '<':
          return a >= b
        case '<=':
          return a > b
        case '>':
          return a <= b
        case '>=':
          return a < b
        case '!=':
          return a === b
        default:
          return false
      }
    })

    if (errors.length > 0) {
      throw Error(`Invalid parameters. Parameters must satisfy the following constraints: ${constraints.join(', ')}. Got: ${Object.entries(params).map(([name, value]) => `${name} = ${value}`).join(', ')}`)
    }
  }

  /**
   * Rounds a value to an integer if the distribution is of discrete type.
   *
   * @method _toInt
   * @memberof Distribution
   * @param {number} x Value to round if necessary.
   * @returns {number} The rounded or left intact value.
   * @private
   */
  _toInt (x) {
    return this._type === 'discrete' ? Math.round(x) : x
  }

  /**
   * Generates a single random variate.
   *
   * @method _generator
   * @memberof ran.dist.Distribution
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
   * @memberof ran.dist.Distribution
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
   * @memberof ran.dist.Distribution
   * @param {number} x Value to evaluate the probability distribution at.
   * @returns {number} The value of the probability function at the specified value.
   * @protected
   * @ignore
   */
  _cdf (x) {
    throw Error('Distribution._cdf() is not implemented')
  }

  /**
   * Estimates the quantile function using a look-up table.
   *
   * @method _qEstimateTable
   * @memberof ran.dist.Distribution
   * @param {number} p Probability to find value for.
   * @returns {number} The lower boundary of the interval that satisfies F(x) = p if found, NaN otherwise.
   * @protected
   * @ignore
   */
  _qEstimateTable (p) {
    // Find upper bound
    let k1 = 0
    let k2 = 0
    let delta = 1
    for (let i = 0; i < MAX_ITER; i++) {
      const q = this.cdf(k2)
      if (q >= p) {
        break
      }

      k1 = k2
      k2 += delta
      delta = Math.ceil(1.618 * delta)
    }

    // Find quantile within bracket
    for (let i = 0; i < MAX_ITER; i++) {
      if (k2 - k1 <= 1) {
        return k2
      }

      const k = Math.floor((k1 + k2) / 2)
      const q = this.cdf(k)
      if (p > q) {
        k1 = k
      } else {
        k2 = k
      }
    }

    return NaN
  }

  // _qEstimateTable is broken for negative-integer support (hardwired start at k=0); use this instead.
  // See solutions/algorithm/2026-05-20-0647-q-estimate-walk-infinite-support-discrete.md
  /**
   * Estimates the quantile function using a deterministic linear walk from a caller-supplied start.
   * When p=0 returns the lower support bound; when p=1 returns the upper support bound.
   * For 0 < p < 1, walks toward the infimum quantile until cdf(k) >= p and cdf(k-1) < p.
   *
   * @method _qEstimateWalk
   * @memberof ran.dist.Distribution
   * @param {number} p Probability to find value for.
   * @param {number} start Integer to start the walk from.
   * @returns {number} The smallest integer k such that F(k) >= p and F(k-1) < p.
   * @protected
   * @ignore
   */
  _qEstimateWalk (p, start) {
    if (p === 0) {
      return this.s[0].value
    }
    if (p === 1) {
      return this.s[1].value
    }
    let k = start
    if (this.cdf(k) >= p) {
      while (this.cdf(k - 1) >= p) {
        k--
      }
    } else {
      while (this.cdf(k) < p) {
        k++
      }
    }
    return k
  }

  /**
   * Estimates the quantile function by solving F(x) = p using Chandrupatla's method.
   *
   * @method _qEstimateRoot
   * @memberof ran.dist.Distribution
   * @param {number} p Probability to find value for.
   * @returns {number} The value where the probability coincides with the specified value if found, NaN otherwise.
   * @protected
   * @ignore
   */
  _qEstimateRoot (p) {
    // Guess range.
    const delta = ((Number.isFinite(this.s[1].value) ? this.s[1].value : 10) -
      (Number.isFinite(this.s[0].value) ? this.s[0].value : -10)) / 2

    // Set initial guess for lower boundary.
    let a0 = Math.random()
    if (this.s[0].closed) {
      a0 = this.s[0].value + Number.EPSILON
    } else if (Number.isFinite(this.s[0].value)) {
      a0 = this.s[0].value + delta * Math.random()
    }

    // Set initial guess for upper boundary.
    let b0 = a0 + Math.random()
    if (this.s[1].closed) {
      b0 = this.s[1].value - Number.EPSILON
    } else if (Number.isFinite(this.s[1].value)) {
      b0 = this.s[1].value - delta * Math.random()
    }

    // Find brackets.
    const bounds = bracket(t => this.cdf(t) - p, a0, b0, this.s)

    // Perform root-finding using Chandrupatla's method.
    if (Array.isArray(bounds)) {
      return Math.min(Math.max(
        chandrupatla(t => this.cdf(t) - p, ...bounds), this.s[0].value), this.s[1].value
      )
    }

    return NaN
  }

  /**
   * Returns the type of the distribution (either discrete or continuous).
   *
   * @method type
   * @memberof ran.dist.Distribution
   * @returns {'continuous' | 'discrete'} Distribution type.
   */
  type () {
    return this._type
  }

  /**
   * Returns the support of the probability distribution (based on the current parameters). Note that the support
   * for the probability distribution is not necessarily the same as the support of the cumulative distribution.
   *
   * @method support
   * @memberof ran.dist.Distribution
   * @returns {{value: number, closed: boolean}[]} An array of objects describing the lower and upper boundary of the support. Each object
   * contains a <code>value: number</code> and a <code>closed: boolean</code> property with the value of the boundary
   * and whether it is closed, respectively. When <code>value</code> is (+/-)Infinity, <code>closed</code> is always false.
   */
  support () {
    return this.s
  }

  /**
   * Returns the natural (user-facing) parameters of the distribution.
   * Internal lookup state is not included.
   * See [decisions/0014-categorical-this-c-natural-params-split.md]{@link ../../decisions/0014-categorical-this-c-natural-params-split.md}.
   *
   * @method params
   * @memberof ran.dist.Distribution
   * @returns {Object} The natural parameters of the distribution.
   */
  params () {
    return this.p
  }

  /**
   * Returns the boundedness category of the distribution's support:
   * <ul>
   *   <li><code>'bounded'</code>: both lower and upper bounds are finite.</li>
   *   <li><code>'lower'</code>: only the lower bound is finite (lower-bounded, unbounded above).</li>
   *   <li><code>'upper'</code>: only the upper bound is finite (upper-bounded, unbounded below).</li>
   *   <li><code>'unbounded'</code>: neither bound is finite.</li>
   * </ul>
   *
   * @method bounded
   * @memberof ran.dist.Distribution
   * @returns {'bounded' | 'lower' | 'upper' | 'unbounded'} The boundedness category of the support.
   */
  bounded () {
    const lowerFinite = Number.isFinite(this.s[0].value)
    const upperFinite = Number.isFinite(this.s[1].value)
    if (lowerFinite && upperFinite) return 'bounded'
    if (lowerFinite) return 'lower'
    if (upperFinite) return 'upper'
    return 'unbounded'
  }

  /**
   * Sets the seed for the distribution generator. Distributions implement the same PRNG
   * ([xoshiro128+]{@link http://vigna.di.unimi.it/ftp/papers/ScrambledLinear.pdf}) that is used in the core functions.
   *
   * @method seed
   * @memberof ran.dist.Distribution
   * @param {number|string} value The value of the seed, either a number or a string (for the ease of tracking seeds).
   * @returns {this} Reference to the current distribution.
   * @example
   *
   * let pareto = new ran.dist.Pareto(1, 2).seed('test')
   * pareto.sample(5)
   * // => [ 1.571395735462202,
   * //      2.317583041477979,
   * //      1.1315154468682591,
   * //      5.44269493220745,
   * //      1.2587482868229616 ]
   *
   */
  seed (value) {
    this.r.seed(value)
    return this
  }

  /**
   * Returns the current state of the generator. The object returned by this method contains all information necessary
   * to set up another generator of the same distribution (parameters, state of the pseudo random generator, etc).
   *
   * @method save
   * @memberof ran.dist.Distribution
   * @returns {{prngState: *, params: Object, constants: Object, support: {value: number, closed: boolean}[]}} Object representing the inner state of the current generator.
   * @example
   *
   * let pareto1 = new ran.dist.Pareto(1, 2).seed('test')
   * let sample1 = pareto1.sample(2)
   * let state = pareto1.save()
   *
   * let pareto2 = new ran.dist.Pareto().load(state)
   * let sample2 = pareto2.sample(3)
   * // => [ 1.1315154468682591,
   * //      5.44269493220745,
   * //      1.2587482868229616 ]
   *
   */
  save () {
    return {
      prngState: this.r.save(),
      params: this.p,
      constants: this.c,
      support: this.s
    }
  }

  /**
   * Loads a new state for the generator.
   *
   * @method load
   * @memberof ran.dist.Distribution
   * @param {Object} state The state to load.
   * @returns {this} Reference to the current distribution.
   * @example
   *
   * let pareto1 = new ran.dist.Pareto(1, 2).seed('test')
   * let sample1 = pareto1.sample(2)
   * let state = pareto1.save()
   *
   * let pareto2 = new ran.dist.Pareto().load(state)
   * let sample2 = pareto2.sample(3)
   * // => [ 1.1315154468682591,
   * //      5.44269493220745,
   * //      1.2587482868229616 ]
   *
   */
  load (state) {
    // Set parameters
    this.p = state.params

    // Set helper constants
    this.c = state.constants

    // Set support
    this.s = state.support

    // Set PRNG state
    this.r.load(state.prngState)

    return this
  }

  /**
   * @overload
   * @returns {number}
   */
  /**
   * @overload
   * @param {1} n
   * @returns {number}
   */
  /**
   * @overload
   * @param {number} n
   * @returns {number|number[]}
   */
  /**
   * Generates some random variate.
   *
   * @method sample
   * @memberof ran.dist.Distribution
   * @param {number=} n Number of variates to generate. If not specified, a single value is returned.
   * @returns {number|number[]} Single sample or an array of samples.
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
   * [Probability density function]{@link https://en.wikipedia.org/wiki/Probability_density_function}. In case of
   * discrete distributions, it is the probability mass function.
   *
   * @method pdf
   * @memberof ran.dist.Distribution
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
    const z = this._toInt(x)

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
   * if it is discrete. The functions $f(t)$ and $f(x_i)$ denote the probability density and mass functions.
   *
   * @method cdf
   * @memberof ran.dist.Distribution
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
    const z = this._toInt(x)

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

  /**
   * The [quantile function]{@link https://en.wikipedia.org/wiki/Quantile_function} of the distribution. For continuous
   * distributions, it is defined as the inverse of the distribution function:
   *
   * $$Q(p) = F^{-1}(p),$$
   *
   * whereas for discrete distributions it is the lower boundary of the interval that satisfies $F(k) = p$:
   *
   * $$Q(p) = \mathrm{inf}\\{k \in \mathrm{supp}(f): p \le F(k)\\},$$
   *
   * with $\mathrm{supp}(f)$ denoting the support of the distribution. For distributions with an analytically invertible
   * cumulative distribution function, the quantile is explicitly implemented. In other cases, two fallback estimations
   * are used: for continuous distributions the equation $F(x) = p$ is solved using [Brent's method]{@link https://en.wikipedia.org/wiki/Brent%27s_method}.
   * For discrete distributions a look-up table is used with linear search.
   *
   * @method q
   * @memberof ran.dist.Distribution
   * @param {number} p The probability at which the quantile should be evaluated.
   * @returns {number|undefined} The value of the quantile function at the specified probability if $p \in [0, 1]$ and the quantile could be found,
   * undefined otherwise.
   */
  q (p) {
    if (p < 0 || p > 1) {
      if (!_qOutOfRangeWarned) {
        _qOutOfRangeWarned = true
        console.warn('[ranjs] Distribution.q(p) with p outside [0,1] is deprecated and will throw in v1.27.0; currently returns undefined.')
      }
      return undefined
    } else if (p === 0) {
      // If zero, return lower support boundary
      return this.s[0].value
    } else if (p === 1) {
      // If unit, return upper support boundary
      return this.s[1].value
    } else {
      // If quantile function is implemented, use that, otherwise use the estimators: look-up table for discrete and
      // root-finder for continuous
      return typeof this._q === 'function'
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
   * where $F(x)$ denotes the cumulative distribution function.
   *
   * @method survival
   * @memberof ran.dist.Distribution
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
   * where $f(x)$ and $S(x)$ are the probability density (or mass) function and the survival function, respectively.
   *
   * @method hazard
   * @memberof ran.dist.Distribution
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
   * where $\lambda(x)$ is the hazard function.
   *
   * @method cHazard
   * @memberof ran.dist.Distribution
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
   * @memberof ran.dist.Distribution
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
    return Math.log(this.pdf(x))
  }

  /**
   * The [log-likelihood]{@link https://en.wikipedia.org/wiki/Likelihood_function#Log-likelihood} of the
   * current distribution based on some data. More precisely:
   *
   * $$\ln L(\theta | X) = \sum_{x \in X} \ln f(x; \theta),$$
   *
   * where $X$ is the set of observations (sample) and $\theta$ is the parameter vector of the
   * distribution. The function $f(x)$ denotes the probability density/mass function.
   *
   * @method lnL
   * @memberof ran.dist.Distribution
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
    )
  }

  /**
   * Returns the value of the [Akaike information criterion]{@link https://en.wikipedia.org/wiki/Akaike_information_criterion}
   * for a specific data set. Note that this method does not optimize the likelihood, merely computes the AIC with the
   * current parameter values.
   *
   * @method aic
   * @memberof ran.dist.Distribution
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
   * @memberof ran.dist.Distribution
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
   * method uses $\chi^2$ test, whereas for continuous distributions it uses the Kolmogorov-Smirnov test. In both cases, the probability of Type I error (rejecting a correct null hypotheses) is 1%.
   *
   * @method test
   * @memberof ran.dist.Distribution
   * @param {number[]} values Array of values to test.
   * @returns {{statistics: number, passed: boolean}} Object with two properties representing the result of the test:
   * <ul>
   *     <li>{statistics}: The $\chi^2$ or D statistics depending on whether the distribution is discrete or
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
      // Parameters are fixed in the constructor (known), not estimated from values — df correction is 0.
      ? chi2(values, x => this.pdf(x), 0)
      : kolmogorovSmirnov(values, x => this.cdf(x))
  }

  /**
   * Returns the initial parameter vector for the MLE optimizer. The base-class default takes
   * the constructor arity from `this.length` and draws random positive values in (0, 5) until
   * a vector validates against the distribution's parameter constraints. All-ones fails for
   * ~22% of distributions in the library (ordering constraints like `a < b`, probability bounds,
   * integer constraints), whereas random retries succeed for every distribution with a scalar
   * constructor. Subclasses should override with a data-aware (method-of-moments) estimate for
   * better convergence — see decisions/0016-distribution-fit-powell-and-exact-mle.md.
   * For zero-parameter distributions (k=0), returns `[]` to signal `fit()` to skip optimization.
   *
   * @method _fitInit
   * @memberof ran.dist.Distribution
   * @param {number[]} data Array of observations (may be used by subclass overrides).
   * @returns {number[]} Initial parameter vector.
   * @protected
   * @ignore
   */
  static _fitInit (data) { // eslint-disable-line no-unused-vars
    const k = this.length
    // k=0: no free parameters — any instance is the MLE; signal fit() to skip the optimizer
    if (k === 0) {
      return []
    }
    const MAX_TRIES = 500
    for (let t = 0; t < MAX_TRIES; t++) {
      const params = Array.from({ length: k }, () => Math.random() * 5 + 1e-3)
      try {
        new this(...params) // eslint-disable-line no-new
        return params
      } catch (_) {}
    }
    throw Error(`${this.name}.fit() requires a _fitInit() implementation for this distribution`)
  }

  /**
   * Flags that this distribution's `_fitInit` already returns the exact closed-form MLE, so
   * `fit()` returns it directly instead of running an iterative optimizer (which would only add
   * numerical drift to an answer that is already the maximizer). The base-class default is
   * `false`; a distribution opts in by declaring its OWN `_fitInitIsExact` getter returning
   * `true`. `fit()` deliberately checks for an *own* declaration (not an inherited one) so that
   * a subclass with a different, approximate `_fitInit` (e.g. `Weibull extends Exponential`)
   * never silently inherits the fast path. See
   * decisions/0016-distribution-fit-powell-and-exact-mle.md.
   *
   * @method _fitInitIsExact
   * @memberof ran.dist.Distribution
   * @returns {boolean} Whether `_fitInit` returns the exact MLE.
   * @protected
   * @ignore
   */
  static get _fitInitIsExact () {
    return false
  }

  /**
   * Estimates the distribution parameters from data using maximum likelihood estimation (MLE).
   * Distributions with a closed-form MLE return it directly (see `_fitInitIsExact`); all others
   * maximise the log-likelihood lnL(data) with Powell's derivative-free conjugate-direction
   * optimizer. See [decisions/0016-distribution-fit-powell-and-exact-mle.md]{@link ../../decisions/0016-distribution-fit-powell-and-exact-mle.md}.
   *
   * @method fit
   * @memberof ran.dist.Distribution
   * @param {number[]} data Array of observations to fit.
   * @returns {Distribution} A new instance of the same distribution with MLE parameters.
   */
  static fit (data) {
    const Cls = this
    const x0 = Cls._fitInit(data)
    // k=0: the distribution is fully determined with no free parameters; every instance is the MLE
    if (x0.length === 0) {
      return new Cls()
    }
    // Closed-form MLE fast path: only when the OWN class declares _fitInitIsExact, so an
    // approximate _fitInit on a subclass cannot inherit the shortcut.
    const exact = Object.getOwnPropertyDescriptor(Cls, '_fitInitIsExact')
    if (exact && exact.get && exact.get.call(Cls)) {
      return new Cls(...x0)
    }
    const objective = params => {
      try {
        const v = -new Cls(...params).lnL(data)
        // Reject any non-finite objective: NaN (neumaier(-Infinity,...)), +Infinity (zero-density
        // params), and -Infinity (an unbounded-likelihood singularity, e.g. Beta-type density as a
        // shape parameter → 0). Without the last guard a strong optimizer walks into the singularity
        // and returns a degenerate fit that Nelder-Mead was simply too weak to find.
        return Number.isFinite(v) ? v : Infinity
      } catch (_) {
        return Infinity
      }
    }
    const best = powell(objective, Distribution._feasibleStart(objective, x0))
    return new Cls(...best)
  }

  /**
   * Returns a starting point at which the objective is finite. When `_fitInit` lands in the
   * Infinity-barrier infeasible region (e.g. estimated bounded support that does not yet cover the
   * data), Powell's coordinate line searches cannot escape the way a simplex can, so this probes
   * for a feasible point by jittering all coordinates together — the diagonal moves Powell lacks.
   * The probe uses a fixed PRNG seed so `fit()` stays deterministic.
   *
   * @method _feasibleStart
   * @memberof ran.dist.Distribution
   * @param {Function} objective Objective being minimised (returns Infinity for invalid params).
   * @param {number[]} x0 Initial parameter vector from `_fitInit`.
   * @returns {number[]} A vector at which `objective` is finite, or `x0` if none was found.
   * @private
   * @ignore
   */
  static _feasibleStart (objective, x0) {
    if (Number.isFinite(objective(x0))) {
      return x0
    }
    const rng = new Xoshiro128p()
    rng.seed(0x5eed)
    for (let spread = 0.5; spread <= 16; spread *= 2) {
      for (let t = 0; t < 100; t++) {
        const trial = x0.map(xi => xi + (2 * rng.next() - 1) * spread * (Math.abs(xi) + 1))
        if (Number.isFinite(objective(trial))) {
          return trial
        }
      }
    }
    return x0
  }
}

export default Distribution
