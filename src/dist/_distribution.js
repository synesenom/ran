import Xoshiro128p from '../core/xoshiro'
import neumaier from '../algorithms/neumaier'
import tanhSinh from '../algorithms/tanh-sinh'
import powell from '../algorithms/powell'
import some from '../utils/some'
import validateParams from '../utils/validate-params'
import { chi2, andersonDarling } from './_tests'
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
class Distribution {
  constructor (type, k) {
    if (new.target === Distribution) {
      throw Error('Distribution is abstract and cannot be instantiated directly.')
    }

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

  // ─── PUBLIC INSTANCE ──────────────────────────────────────────────────────

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
   *
   * @method params
   * @memberof ran.dist.Distribution
   * @returns {Object} The natural parameters of the distribution.
   */
  params () {
    // Trusts this.p to already hold only natural params — a reparametrizing subclass that merges
    // via Object.assign(this.p, {...}) instead of replacing it will leak the parent's keys here.
    // See decisions/0018-continuous-subclass-natural-params.md and
    // solutions/distribution/2026-07-21-1252-reparametrizing-subclass-this-p-merge-vs-replace.md
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
   * @returns {{type: string, k: number, prngState: *, params: Object, constants: Object, support: {value: number, closed: boolean}[]}} Object representing the inner state of the current generator.
   * @example
   *
   * let pareto1 = new ran.dist.Pareto(1, 2).seed('test')
   * let sample1 = pareto1.sample(2)
   * let state = pareto1.save()
   *
   * let pareto2 = ran.dist.Pareto.load(state)
   * let sample2 = pareto2.sample(3)
   * // => [ 1.1315154468682591,
   * //      5.44269493220745,
   * //      1.2587482868229616 ]
   *
   */
  save () {
    return {
      type: this._type,
      k: this.k,
      prngState: this.r.save(),
      params: this.p,
      constants: this.c,
      support: this.s
    }
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
    const z = this._toInt(x)
    if (this._belowSupport(z)) return 0
    if (this._aboveSupport(z)) return 0
    const v = this._pdf(z)
    // Formula divergences (e.g. log-barrier 0/0) at an exact closed boundary produce NaN even
    // though the point is in the support. The limit is 0 by continuity, so return 0 instead of
    // propagating NaN into tanhSinh and corrupting numerical moments.
    if (Number.isNaN(v) && this._atClosedBoundary(z)) return 0
    return v
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
    const z = this._toInt(x)
    if (this._belowSupport(z)) return 0
    if (z >= this.s[1].value) return 1
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
   * @returns {number} The value of the quantile function at the specified probability.
   * @throws {Error} If p is outside [0, 1].
   */
  q (p) {
    if (p < 0 || p > 1) {
      throw Error('Invalid probability. p must be in [0, 1].')
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
    return 1 - this.cdf(x)
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
    return this.pdf(x) / this.survival(x)
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
   * method uses $\chi^2$ test, whereas for continuous distributions it uses the Anderson-Darling test. In both cases, the probability of Type I error (rejecting a correct null hypotheses) is 1%.
   *
   * @method test
   * @memberof ran.dist.Distribution
   * @param {number[]} values Array of values to test.
   * @returns {{statistics: number, passed: boolean, pValue: number}} Object representing the result of the test:
   * <ul>
   *     <li>{statistics}: The $\chi^2$ or A² statistics depending on whether the distribution is discrete or
   *     continuous.</li>
   *     <li>{passed}: Whether the sample passed the null hypothesis that it is sampled from the current
   *     distribution.</li>
   *     <li>{pValue}: The goodness-of-fit p-value, from the $\chi^2$ or A² test depending on whether the
   *     distribution is discrete or continuous.</li>
   * </ul>
   * @example
   *
   * let pareto = new ran.dist.Pareto(1, 2)
   * let uniform = new ran.dist.UniformContinuous(1, 10);
   *
   * let sample1 = pareto.sample(100)
   * pareto.test(sample1)
   * // => { statistics: 0.312, passed: true }
   *
   * let sample2 = uniform.sample(100)
   * pareto.test(sample2)
   * // => { statistics: 9.47, passed: false }
   *
   */
  test (values) {
    return this._type === 'discrete'
      // Parameters are fixed in the constructor (known), not estimated from values — df correction is 0.
      ? chi2(values, x => this.pdf(x), 0)
      : andersonDarling(values, x => this.cdf(x))
  }

  /**
   * The theoretical [mean]{@link https://en.wikipedia.org/wiki/Expected_value} of the distribution:
   *
   * $$\mu = \mathrm{E}[X].$$
   *
   * Returns a finite number for well-behaved distributions, `NaN` when the moment is mathematically
   * undefined, or `Infinity` / `-Infinity` when it diverges. Distributions with non-finite moments
   * must override this method; the numerical fallback cannot detect divergence through truncated
   * integration.
   *
   * @method mean
   * @memberof ran.dist.Distribution
   * @returns {number} The theoretical mean.
   */
  mean () {
    return this._numericalRawMoment(1)
  }

  /**
   * The theoretical [variance]{@link https://en.wikipedia.org/wiki/Variance} of the distribution:
   *
   * $$\sigma^2 = \mathrm{E}[X^2] - \mathrm{E}[X]^2.$$
   *
   * Returns a non-negative finite number for well-behaved distributions, `NaN` when the moment is
   * mathematically undefined, or `Infinity` when it diverges. Distributions with non-finite moments
   * must override this method.
   *
   * @method variance
   * @memberof ran.dist.Distribution
   * @returns {number} The theoretical variance.
   */
  variance () {
    const m1 = this._numericalRawMoment(1)
    const m2 = this._numericalRawMoment(2)
    const v = m2 - m1 * m1
    // Clamp floating-point negatives from catastrophic cancellation in E[X²] - E[X]²
    return v < 0 ? 0 : v
  }

  /**
   * The theoretical [skewness]{@link https://en.wikipedia.org/wiki/Skewness} of the distribution:
   *
   * $$\gamma_1 = \frac{\mathrm{E}[(X-\mu)^3]}{\sigma^3} = \frac{\mathrm{E}[X^3] - 3\mu\,\mathrm{E}[X^2] + 2\mu^3}{\sigma^3}.$$
   *
   * Returns `NaN` when undefined (zero variance, or moment does not exist). Distributions with
   * non-finite moments must override this method.
   *
   * @method skewness
   * @memberof ran.dist.Distribution
   * @returns {number} The theoretical skewness.
   */
  skewness () {
    const m1 = this._numericalRawMoment(1)
    const m2 = this._numericalRawMoment(2)
    const m3 = this._numericalRawMoment(3)
    const v = m2 - m1 * m1
    if (!(v > 0)) return NaN
    return (m3 - 3 * m1 * m2 + 2 * Math.pow(m1, 3)) / Math.pow(v, 1.5)
  }

  /**
   * The theoretical [excess kurtosis]{@link https://en.wikipedia.org/wiki/Kurtosis#Excess_kurtosis} of the distribution:
   *
   * $$\gamma_2 = \frac{\mathrm{E}[(X-\mu)^4]}{\sigma^4} - 3 = \frac{\mathrm{E}[X^4] - 4\mu\,\mathrm{E}[X^3] + 6\mu^2\,\mathrm{E}[X^2] - 3\mu^4}{\sigma^4} - 3.$$
   *
   * Returns `NaN` when undefined (zero variance, or moment does not exist). Distributions with
   * non-finite moments must override this method.
   *
   * @method kurtosis
   * @memberof ran.dist.Distribution
   * @returns {number} The theoretical excess kurtosis.
   */
  kurtosis () {
    const m1 = this._numericalRawMoment(1)
    const m2 = this._numericalRawMoment(2)
    const m3 = this._numericalRawMoment(3)
    const m4 = this._numericalRawMoment(4)
    const v = m2 - m1 * m1
    if (!(v > 0)) return NaN
    return (m4 - 4 * m1 * m3 + 6 * m1 * m1 * m2 - 3 * Math.pow(m1, 4)) / (v * v) - 3
  }

  // ─── PUBLIC STATIC ────────────────────────────────────────────────────────

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
    validateParams(params, constraints)
  }

  /**
   * Reconstructs a distribution instance from a snapshot created by save(). No constructor call is needed.
   *
   * @method load
   * @memberof ran.dist.Distribution
   * @param {Object} state The state to load, as returned by save().
   * @returns {Distribution} New distribution instance with the restored state.
   * @example
   *
   * let pareto1 = new ran.dist.Pareto(1, 2).seed('test')
   * let sample1 = pareto1.sample(2)
   * let state = pareto1.save()
   *
   * let pareto2 = ran.dist.Pareto.load(state)
   * let sample2 = pareto2.sample(3)
   * // => [ 1.1315154468682591,
   * //      5.44269493220745,
   * //      1.2587482868229616 ]
   *
   */
  // decisions/0019-distribution-load-static-factory.md — static factory bypasses the constructor so the instance is fully initialized before any method is called
  static load (state) {
    const instance = Object.create(this.prototype)
    instance._type = state.type
    instance.k = state.k
    instance.p = state.params
    instance.s = state.support
    instance.c = state.constants
    instance.r = new Xoshiro128p()
    instance.r.load(state.prngState)
    instance._afterLoad()
    return instance
  }

  /**
   * Estimates the distribution parameters from data using maximum likelihood estimation (MLE).
   * Distributions with a closed-form MLE return it directly; all others maximise the
   * log-likelihood lnL(data) with Powell's derivative-free conjugate-direction optimizer.
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
    if (Distribution._isExactFit(Cls)) {
      return new Cls(...x0)
    }
    const objective = params => {
      try {
        const inst = new Cls(...params)
        // Penalised negative log-likelihood: the base penalty is 0 (pure MLE); Beta-family
        // distributions override _fitPenalty with a Jeffreys-like log-barrier to prevent the
        // optimizer from sitting near shape-parameter singularities where lnL is large-but-finite.
        // See decisions/0017-beta-fit-penalty.md.
        const v = -inst.lnL(data) + Cls._fitPenalty(inst)
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

  // ─── PROTECTED INSTANCE ───────────────────────────────────────────────────

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
   * Returns a starting bracket [a, b] for quantile root-finding. For bounded support the full
   * support range [lo, hi] is returned — CDF(lo)=0 and CDF(hi)=1 guarantee a sign change for
   * any 0<p<1, so no further expansion is needed. For unbounded/semi-bounded support a
   * support-derived starting point is returned; _qEstimateRoot will expand it until sign change.
   *
   * @method _qInitialGuess
   * @memberof ran.dist.Distribution
   * @param {number} p Probability to find quantile for (unused in base class; exposed for overrides).
   * @returns {number[]} Starting bracket [a, b] with a < b.
   * @protected
   * @ignore
   */
  _qInitialGuess (p) {
    // Bounded support: CDF(lo)=0 and CDF(hi)=1 for any continuous distribution, so [lo, hi]
    // is always a valid bracket — no expansion needed in _qEstimateRoot.
    if (Number.isFinite(this.s[0].value) && Number.isFinite(this.s[1].value)) {
      return [this.s[0].value, this.s[1].value]
    }
    // Unbounded/semi-bounded: provide a compact starting point near the support boundary.
    // _qEstimateRoot will expand until a sign change is found.
    const delta = ((Number.isFinite(this.s[1].value) ? this.s[1].value : 10) -
      (Number.isFinite(this.s[0].value) ? this.s[0].value : -10)) / 2
    let a = this.r.next()
    if (this.s[0].closed) {
      a = this.s[0].value + Number.EPSILON
    } else if (Number.isFinite(this.s[0].value)) {
      a = this.s[0].value + delta * this.r.next()
    }
    // Math.max(..., Number.EPSILON) guards against r.next()=0 (probability 2^-32), which would
    // collapse b=a, make expansion=0, and cause the loop in _qEstimateRoot to break immediately.
    let b = a + Math.max(this.r.next(), Number.EPSILON)
    if (Number.isFinite(this.s[1].value)) {
      b = this.s[1].value - delta * this.r.next()
    }
    return [a, b]
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
    if (p === 0) return this.s[0].value
    if (p === 1) return this.s[1].value
    return this.cdf(start) >= p
      ? this._walkDown(p, start)
      : this._walkUp(p, start)
  }

  // Hook for subclasses that store non-serializable state (AliasTable, lazy look-up tables, etc.)
  // beyond the four standard fields. Override to rebuild those structures from this.p/this.c.
  _afterLoad () {}

  // ─── PROTECTED STATIC ─────────────────────────────────────────────────────

  /**
   * Returns the initial parameter vector for the MLE optimizer. The base-class default takes
   * the constructor arity from `this.length` and draws random positive values in (0, 5) until
   * a vector validates against the distribution's parameter constraints. All-ones fails for
   * ~22% of distributions in the library (ordering constraints like `a < b`, probability bounds,
   * integer constraints), whereas random retries succeed for every distribution with a scalar
   * constructor. Subclasses should override with a data-aware (method-of-moments) estimate for
   * better convergence.
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
   * never silently inherits the fast path.
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
   * An additive penalty on the penalised log-likelihood objective inside `fit()`. The base-class
   * default returns 0 (pure MLE, no penalty). Subclasses with a boundary singularity (e.g. Beta,
   * where lnL can be large-but-finite near alpha=0) override this to repel the optimizer from
   * near-degenerate regions.
   *
   * @method _fitPenalty
   * @memberof ran.dist.Distribution
   * @param {Distribution} dist An instance of the distribution at the candidate params.
   * @returns {number} The penalty value to add to the minimisation objective.
   * @protected
   * @ignore
   */
  static _fitPenalty (dist) { // eslint-disable-line no-unused-vars
    return 0
  }

  // ─── PRIVATE INSTANCE ─────────────────────────────────────────────────────

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

  _belowSupport (z) {
    return this.s[0].closed ? z < this.s[0].value : z <= this.s[0].value
  }

  _aboveSupport (z) {
    return this.s[1].closed ? z > this.s[1].value : z >= this.s[1].value
  }

  _atClosedBoundary (z) {
    return (this.s[0].closed && z === this.s[0].value) || (this.s[1].closed && z === this.s[1].value)
  }

  _qTableBracket (p) {
    let k1 = 0
    let k2 = 0
    let delta = 1
    for (let i = 0; i < MAX_ITER; i++) {
      if (this.cdf(k2) >= p) break
      k1 = k2
      k2 += delta
      delta = Math.ceil(1.618 * delta)
    }
    return [k1, k2]
  }

  _qTableBisect (p, k1, k2) {
    for (let i = 0; i < MAX_ITER; i++) {
      if (k2 - k1 <= 1) return k2
      const k = Math.floor((k1 + k2) / 2)
      if (p > this.cdf(k)) {
        k1 = k
      } else {
        k2 = k
      }
    }
    return NaN
  }

  /**
   * Estimates the quantile function using a look-up table.
   *
   * @method _qEstimateTable
   * @memberof ran.dist.Distribution
   * @param {number} p Probability to find value for.
   * @returns {number} The lower boundary of the interval that satisfies F(x) = p if found, NaN otherwise.
   * @private
   * @ignore
   */
  _qEstimateTable (p) {
    const [k1, k2] = this._qTableBracket(p)
    return this._qTableBisect(p, k1, k2)
  }

  _walkDown (p, k) {
    while (this.cdf(k - 1) >= p) k--
    return k
  }

  _walkUp (p, k) {
    while (this.cdf(k) < p) k++
    return k
  }

  _openBoundaryDelta (sideIdx) {
    return this.s[sideIdx].closed ? 0 : 1
  }

  /**
   * Estimates the quantile function by solving F(x) = p using Chandrupatla's method.
   * Expands the initial bracket from _qInitialGuess until a sign change is found, then
   * solves with Chandrupatla.
   *
   * @method _qEstimateRoot
   * @memberof ran.dist.Distribution
   * @param {number} p Probability to find value for.
   * @returns {number} The value where the probability coincides with the specified value if found, NaN otherwise.
   * @private
   * @ignore
   */
  _qEstimateRoot (p) {
    let [a, b] = this._qInitialGuess(p)
    const min = this.s[0].value
    const max = this.s[1].value
    // deltaA/deltaB shrink toward zero to approach open boundaries without landing on them.
    let deltaA = this._openBoundaryDelta(0)
    let deltaB = this._openBoundaryDelta(1)
    let fa = this.cdf(a) - p
    let fb = this.cdf(b) - p
    // Expand bracket by golden-ratio steps until sign change (immediately exits for bounded support).
    // Only expand a side if it would actually move: when a side is clamped at its limit, switch to
    // the other side to avoid an infinite no-progress loop.
    for (let k = 0; k < MAX_ITER; k++) {
      if (fa * fb < 0) break
      const expansion = 1.618 * (b - a)
      const newA = Math.max(a - expansion, min + deltaA)
      const newB = Math.min(b + expansion, max - deltaB)
      if (Math.abs(fa) <= Math.abs(fb) && newA !== a) {
        a = newA
        deltaA /= 1.618
        fa = this.cdf(a) - p
      } else if (newB !== b) {
        b = newB
        deltaB /= 1.618
        fb = this.cdf(b) - p
      } else {
        break
      }
    }
    if (fa * fb >= 0) return NaN
    return Math.min(Math.max(
      chandrupatla(t => this.cdf(t) - p, a, b), min), max
    )
  }

  _momentBounds (tailP, round) {
    return [
      Number.isFinite(this.s[0].value) ? this.s[0].value : round(this.q(tailP)),
      Number.isFinite(this.s[1].value) ? this.s[1].value : round(this.q(1 - tailP))
    ]
  }

  /**
   * Computes a raw moment E[X^n] numerically. Continuous distributions use tanh-sinh
   * quadrature; discrete distributions use compensated summation. Infinite support bounds
   * are truncated at the 1e-12 / (1 - 1e-12) quantile. Distributions with undefined or
   * divergent moments must override the public moment methods to return NaN / Infinity
   * directly, because quantile truncation makes divergent integrals appear finite.
   *
   * @method _numericalRawMoment
   * @memberof ran.dist.Distribution
   * @param {number} n Moment order.
   * @returns {number} E[X^n].
   * @private
   * @ignore
   */
  _numericalRawMoment (n) {
    // 1e-12 tail cut: tighter than 1e-7 because x^4 tails contribute ~x^3·φ(x) which
    // is still ~1e-4 at z≈5.2 (the 1e-7 quantile) — far too large for kurtosis precision.
    const TAIL_P = 1e-12
    if (this._type === 'discrete') {
      const [lo, hi] = this._momentBounds(TAIL_P, Math.round)
      // Heavy-tailed discrete distributions (e.g. Zeta, YuleSimon) can have a 1-1e-12 quantile
      // in the billions, making the loop effectively hang. Return NaN — the analytical override
      // should handle these. 1e6 terms covers all practical well-behaved distributions.
      const overflows = !Number.isFinite(lo) || !Number.isFinite(hi) || hi - lo > 1e6
      if (overflows) return NaN
      const terms = []
      for (let k = lo; k <= hi; k++) terms.push(Math.pow(k, n) * this.pdf(k))
      return terms.length > 0 ? neumaier(terms) : NaN
    }
    const [lo, hi] = this._momentBounds(TAIL_P, Number)
    // Point-mass support (lo === hi): tanhSinh returns 0 (halfLen = 0), but E[X^n] = lo^n
    // for a unit point mass. Handles Degenerate and any other single-point continuous type.
    if (lo === hi) return Math.pow(lo, n)
    return tanhSinh(x => Math.pow(x, n) * this.pdf(x), lo, hi)
  }

  // ─── PRIVATE STATIC ───────────────────────────────────────────────────────

  static _isExactFit (Cls) {
    const d = Object.getOwnPropertyDescriptor(Cls, '_fitInitIsExact')
    return d && d.get && d.get.call(Cls)
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

  /**
   * Cramér-Rao half-width for the integer grid search in `fit()`, derived from the
   * observed Fisher information at `seed` via a finite-difference second derivative of
   * the total log-likelihood. Returns `max(5, ⌈3/√I_obs⌉)` so the window is always at
   * least ±5 and widens automatically when the likelihood is flat. When `seed − 1 < lb`
   * the backward point is unavailable; `lnLAt(seed)` is reused, collapsing the estimate
   * to a one-sided difference that still respects the floor.
   *
   * @method _adaptiveHalfWidth
   * @memberof ran.dist.Distribution
   * @param {Function} lnLAt Maps an integer parameter value to the total log-likelihood
   *   for the data; must return `-Infinity` (not throw) for invalid values.
   * @param {number} seed Integer seed (result of `Math.round(momentEstimate)`).
   * @param {number} lb Domain lower bound (e.g. 1 for most distributions, 2 for UniformProduct).
   * @returns {number} Adaptive half-width `w ≥ 5`.
   * @private
   * @ignore
   */
  // See solutions/distribution/2026-06-06-1500-adaptive-fit-window-fisher-info.md
  static _adaptiveHalfWidth (lnLAt, seed, lb) {
    const lnL0 = lnLAt(seed)
    const lnLp = lnLAt(seed + 1)
    const lnLm = seed - 1 >= lb ? lnLAt(seed - 1) : lnL0
    const iObs = 2 * lnL0 - lnLp - lnLm
    return Math.max(5, Math.ceil(3 / Math.sqrt(Math.max(iObs, 1e-6))))
  }
}

export default Distribution
