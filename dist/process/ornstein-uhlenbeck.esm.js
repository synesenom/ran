// https://synesenom.github.io/ran/ v1.29.0 Copyright 2026 Enys Mones
// Improved Ziggurat algorithm for the standard normal distribution.
// Marsaglia & Tsang (2000) "The Ziggurat Method for Generating Random Variables"
//   J. Statistical Software 5(8). https://doi.org/10.18637/jss.v005.i08
// Doornik (2005) "An Improved Ziggurat Method to Generate Normal Random Samples"
//   https://www.doornik.com/research/ziggurat.pdf

// N = 128 horizontal strips of equal area V partition the half-normal curve.
// R is the right-tail cutoff; strip 0 spans [0, R] plus the infinite right tail.
// V = R·φ(R) + Pr(X ≥ R) is chosen so every strip has the same area.
// (Marsaglia & Tsang 2000, §1; numerical values from Doornik 2005, Table 1.)
const _N = 128;
const _R = 3.442619855899;
const _V = 9.91256303526217e-3;

// _X[i] is the right-edge x-coordinate of strip i.
// Equal-area recurrence (Marsaglia & Tsang 2000, §1):
//   V = x[i-1] · (φ(x[i]) − φ(x[i-1]))  ⟹  x[i] = √(−2 ln(V/x[i-1] + φ(x[i-1])))
// Boundary conditions: x[0] = V/φ(R), x[1] = R, x[N] = 0 (density peak).
const _X = (() => {
  const x = new Array(_N + 1);
  let phi = Math.exp(-0.5 * _R * _R);
  x[0] = _V / phi;
  x[1] = _R;
  for (let i = 2; i < _N; i++) {
    x[i] = Math.sqrt(-2 * Math.log(_V / x[i - 1] + phi));
    phi = Math.exp(-0.5 * x[i] * x[i]);
  }
  x[_N] = 0;
  return x
})();

// _W[i] = x[i+1]/x[i]: fast-path acceptance ratio for strip i (Doornik 2005, §2).
// Candidate u·x[i] with |u| < _W[i] satisfies |candidate| < x[i+1], placing it
// inside the inner rectangle of strip i, which lies entirely below the curve.
const _W = _X.slice(0, _N).map((xi, i) => _X[i + 1] / xi);

/**
 * Generates a normally distributed random variate using the Improved Ziggurat
 * algorithm (Marsaglia-Tsang 2000 / Doornik 2005).
 *
 * @method normal
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number} mu Distribution mean.
 * @param {number} sigma Distribution standard deviation.
 * @returns {number} Random variate.
 * @ignore
 */
function normal (r, mu = 0, sigma = 1) {
  while (true) {
    // u ~ Uniform(−1, 1); strip i ~ Uniform{0, …, N−1}. (Doornik 2005, §2)
    // Candidate x-coordinate: xc = u · x[i].
    const u = 2 * r.next() - 1;
    const i = Math.floor(r.next() * _N);
    const xc = u * _X[i];

    // Fast path (~98–99%): |xc| < x[i+1] means xc is inside the solid inner rectangle
    // of strip i, which lies entirely under the curve. No acceptance test needed.
    if (Math.abs(u) < _W[i]) {
      return xc * sigma + mu
    }

    // Tail path (strip 0): sample from φ(x) conditioned on x > R.
    // Marsaglia (1964): draw z ~ Exp(R) via z = −ln(U₁)/R; accept when 2·ln(U₂) ≤ −z².
    // Sign is taken from the original u to cover both tails symmetrically.
    if (i === 0) {
      let z, v;
      do {
        z = Math.log(r.next()) / _R;
        v = Math.log(r.next());
      } while (-2 * v < z * z)
      return (u < 0 ? z - _R : _R - z) * sigma + mu
    }

    // Wedge path: xc lies in the curved wedge at the corner of strip i.
    // Accept with probability (φ(xc) − φ(x[i])) / (φ(x[i+1]) − φ(x[i])). (Doornik 2005, §3)
    // Dividing numerator and denominator by φ(xc), and writing
    //   rk = φ(x[k]) / φ(xc) = exp(−½·(x[k]² − xc²)):
    //   P(accept) = (1 − ri) / (ri1 − ri)  ⟺  accept when U·(ri − ri1) + ri1 < 1.
    const xc2 = xc * xc;
    const ri = Math.exp(-0.5 * (_X[i] * _X[i] - xc2));
    const ri1 = Math.exp(-0.5 * (_X[i + 1] * _X[i + 1] - xc2));
    if (ri1 + r.next() * (ri - ri1) < 1) {
      return xc * sigma + mu
    }
  }
}

/**
 * A xoshiro128+ pseudo random number generator.
 *
 * @class Xoshiro128p
 * @memberof ran.core
 * @ignore
 */
class Xoshiro128p {
  constructor (state) {
    // Set state
    this._state = state || [
      (Math.random() * Number.MAX_SAFE_INTEGER) >>> 0,
      2, 3, 4
    ];

    // Call next once.
    this.next();
  }

  /**
   * Generates a has for a string, based on the Java String.hashCode implementation.
   *
   * @method hash
   * @memberof ran.core.Xoshiro128p
   * @param {string} str String to hash.
   * @returns {number} The hash code.
   * @ignore
   */
  static hash (str) {
    // Calculate Java's String.hashCode value
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash
  }

  /**
   * Returns the next pseudo random number.
   *
   * @method next
   * @memberof ran.core.Xoshiro128p
   * @returns {number} The next pseudo random number.
   * @ignore
   */
  next () {
    // Init helper variables
    const t = this._state[1] << 9;
    const u = this._state[0] + this._state[3];

    // Update state
    this._state[2] = this._state[2] ^ this._state[0];
    this._state[3] = this._state[3] ^ this._state[1];
    this._state[1] = this._state[1] ^ this._state[2];
    this._state[0] = this._state[0] ^ this._state[3];
    this._state[2] = this._state[2] ^ t;
    this._state[3] = this._state[3] << 11 | this._state[3] >>> 21;

    // Return random number
    return (u >>> 0) / 4294967296
  }

  /**
   * Sets the seed for the underlying pseudo random number generator used by ranjs. Under the hood, ranjs
   * implements the [xoshiro128+ algorithm]{@link http://vigna.di.unimi.it/ftp/papers/ScrambledLinear.pdf}.
   *
   * @method seed
   * @memberof ran.core.Xoshiro128p
   * @param {number|string} value The value of the seed, either a number or a string (for the ease of tracking
   * seeds).
   * @ignore
   */
  seed (value) {
    // Set state
    this._state = [
      (typeof value === 'number' ? value : Xoshiro128p.hash(value)) >>> 0,
      2, 3, 4
    ];

    // Run some iterations
    for (let i = 0; i < 100; i++) {
      this.next();
    }
  }

  /**
   * Loads the state of the generator.
   *
   * @method load
   * @memberof ran.core.Xoshiro128p
   * @param {number[]} state The state to load.
   * @ignore
   */
  load (state) {
    this._state = state.slice();
  }

  /**
   * Returns the current state of the generator. This can be later passed on to a new generator to continue where the
   * current one finished.
   *
   * @method save
   * @memberof ran.core.Xoshiro128p
   * @returns {number[]} The current state of the generator.
   * @ignore
   */
  save () {
    return this._state.slice()
  }
}

/**
 * The stochastic process generator base class, all process generators extend this class. The methods listed here
 * are available for all process generators.
 *
 * @class Process
 * @memberof ran.process
 */
class Process {
  constructor () {
    // Parameters — subclass populates after super()
    /** @type {Object} */
    this.p = {};

    // Current state — subclass sets after super()
    this.x = null;

    // Initial state — subclass sets after super(); used by reset()
    this.x0 = null;

    // Pseudo random number generator
    this.r = new Xoshiro128p();

    // Speed-up constants — must be a named object, never a positional array
    // decisions/0008-this-c-named-object-convention.md
    this.c = {};
  }

  /**
   * Validates a set of parameters using a list of constraints.
   *
   * @method validate
   * @memberof ran.process.Process
   * @param {Object} params Object containing the parameters to validate.
   * @param {string[]} constraints Array of strings defining the parameter constraints.
   * @throws {Error} If any parameter is undefined, null, or NaN, or doesn't satisfy the constraints.
   * @ignore
   */
  static validate (params, constraints) {
    // See decisions/0004-validate-rejects-undefined-and-nan.md — comparison operators against undefined/null/NaN return false, so missing params would otherwise pass silently
    const missing = Object.entries(params)
      .filter(([, v]) => v === undefined || v === null || Number.isNaN(v))
      .map(([name]) => name);
    if (missing.length > 0) {
      throw Error(`Invalid parameters. Required parameters missing or not a number: ${missing.join(', ')}.`)
    }

    // Go through parameters and check constraints
    const errors = constraints.filter(constraint => {
      // Tokenize constraint
      let tokens = constraint.split(/ (<=|>=|!=) /);
      if (tokens.length === 1) {
        tokens = constraint.split(/ ([=<>]) /);
      }

      // Substitute parameters if there is any
      const a = Object.prototype.hasOwnProperty.call(params, tokens[0]) ? params[tokens[0]] : parseFloat(tokens[0]);
      const b = Object.prototype.hasOwnProperty.call(params, tokens[2]) ? params[tokens[2]] : parseFloat(tokens[2]);

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
        /* istanbul ignore next */
        default:
          return false
      }
    });

    if (errors.length > 0) {
      throw Error(`Invalid parameters. Parameters must satisfy the following constraints: ${constraints.join(', ')}. Got: ${Object.entries(params).map(([name, value]) => `${name} = ${value}`).join(', ')}`)
    }
  }

  /**
   * Seeds the internal PRNG for reproducible paths.
   *
   * @method seed
   * @memberof ran.process.Process
   * @param {number|string} value Seed value passed to the underlying Xoshiro128p PRNG.
   * @returns {this} Reference to the current process.
   */
  seed (value) {
    this.r.seed(value);
    return this
  }

  /**
   * Generates the next state. Must be implemented by subclasses.
   *
   * @method _next
   * @memberof ran.process.Process
   * @returns {number} Next state.
   * @protected
   * @ignore
   */
  _next () {
    throw Error('Process._next() is not implemented')
  }

  /**
   * Advances the process by one step, updates the current state, and returns the new state.
   *
   * @method next
   * @memberof ran.process.Process
   * @returns {number} The new state after the step.
   */
  next () {
    this.x = this._next();
    return this.x
  }

  /**
   * Generates a path of n steps starting from the initial state. Non-destructive: the current
   * state is preserved after the call.
   *
   * @method path
   * @memberof ran.process.Process
   * @param {number} n Number of steps.
   * @returns {Array} Array of n+1 states (initial state followed by n successive states).
   */
  path (n) {
    const states = [this.x0];
    const savedX = this.x;
    const savedRng = this.r.save();
    this.x = this.x0;
    for (let i = 0; i < n; i++) {
      this.x = this._next();
      states.push(this.x);
    }
    // restore — path() is non-destructive (state and PRNG)
    // See solutions/correctness/2026-07-07-1500-path-prng-save-restore.md
    this.r.load(savedRng);
    this.x = savedX;
    return states
  }

  /**
   * Resets the process to its initial state.
   *
   * @method reset
   * @memberof ran.process.Process
   */
  reset () {
    this.x = this.x0;
  }

  /**
   * Returns the current state of the process.
   *
   * @method state
   * @memberof ran.process.Process
   * @returns {number} Current state.
   */
  state () {
    return this.x
  }
}

/**
 * Ornstein-Uhlenbeck mean-reverting process, using an exact discrete-time sampler.
 *
 * The update rule per step is
 *
 * $X(t + \mathrm{d}t) = X(t)\,e^{-\theta\,\mathrm{d}t} + \mu\!\left(1 - e^{-\theta\,\mathrm{d}t}\right) + \sigma\sqrt{\frac{1 - e^{-2\theta\,\mathrm{d}t}}{2\theta}}\,Z,$
 *
 * where $Z \sim \mathcal{N}(0, 1)$.
 *
 * @class OrnsteinUhlenbeck
 * @memberof ran.process
 * @constructor
 */
class OrnsteinUhlenbeck extends Process {
  /**
   * @param {number} [theta=1] Mean-reversion speed (must be > 0).
   * @param {number} [mu=0] Long-run mean.
   * @param {number} [sigma=1] Diffusion coefficient (must be > 0).
   * @param {number} [dt=1] Time step (must be > 0).
   */
  constructor (theta = 1, mu = 0, sigma = 1, dt = 1) {
    super();
    Process.validate({ theta, mu, sigma, dt }, ['theta > 0', 'sigma > 0', 'dt > 0']);
    this.p = { theta, mu, sigma, dt };
    this.x = 0;
    this.x0 = 0;
    const decay = Math.exp(-theta * dt);
    this.c = {
      decay,
      noise: sigma * Math.sqrt((1 - decay * decay) / (2 * theta))
    };
  }

  _next () {
    const { mu } = this.p;
    const { decay, noise } = this.c;
    return this.x * decay + mu * (1 - decay) + noise * normal(this.r)
  }

  /**
   * Returns the analytical mean of the process at time t.
   *
   * @method mean
   * @memberof ran.process.OrnsteinUhlenbeck
   * @param {number} t Time.
   * @returns {number} Expected value $x_0 e^{-\theta t} + \mu(1 - e^{-\theta t})$.
   */
  mean (t) {
    if (t < 0) return NaN
    const e = Math.exp(-this.p.theta * t);
    return this.x0 * e + this.p.mu * (1 - e)
  }

  /**
   * Returns the analytical variance of the process at time t.
   *
   * @method variance
   * @memberof ran.process.OrnsteinUhlenbeck
   * @param {number} t Time.
   * @returns {number} Variance $\sigma^2 \frac{1 - e^{-2\theta t}}{2\theta}$.
   */
  variance (t) {
    if (t < 0) return NaN
    return this.p.sigma * this.p.sigma * (1 - Math.exp(-2 * this.p.theta * t)) / (2 * this.p.theta)
  }
}

export { OrnsteinUhlenbeck as default };
