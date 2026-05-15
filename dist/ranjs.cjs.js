// https://synesenom.github.io/ran/ v1.24.6 Copyright 2026 Enys Mones
'use strict';

/**
 * Runs a generator once or several times to return a single value or an array of values.
 *
 * @method some
 * @memberof ran.utils
 * @param {Function} generator Random generator to use.
 * @param {number=} k Number of values to generate.
 * @returns {(number|string|Array)} Single value or array of generated values.
 * @private
 */
function some (generator, k = 1) {
  if (k < 2) {
    return generator()
  } else {
    return Array.from({ length: k }, () => generator())
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
   * @param {(number|string)} value The value of the seed, either a number or a string (for the ease of tracking
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
    this._state = state;
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
    return this._state
  }
}

/**
 * @namespace core
 * @memberof ran
 */

// The internal generator of the core
const r$1 = new Xoshiro128p();

/**
 * Sets the seed for the underlying pseudo random number generator used by the core generators. Under the hood, ranjs
 * implements the [xoshiro128+]{@link https://arxiv.org/abs/1805.01407} algorithm as described in Blackman and Vigna: Scrambled Linear Pseudorandom Number Generators (2019).
 *
 * @method seed
 * @memberof ran.core
 * @param {(number|string)} value The value of the seed, either a number or a string (for the ease of tracking seeds).
 */
const seed = value => r$1.seed(value);

/**
 * Generates some uniformly distributed random floats in (min, max).
 * If min > max, a random float in (max, min) is generated.
 * If no parameters are passed, generates a single random float between 0 and 1.
 * If only min is specified, generates a single random float between 0 and min.
 *
 * @method float
 * @memberof ran.core
 * @param {number=} min Lower boundary, or upper if max is not given.
 * @param {number=} max Upper boundary.
 * @param {number=} n Number of floats to generate.
 * @returns {(number|number[])} Single float or array of random floats.
 * @example
 *
 * ran.core.float()
 * // => 0.278014086611011
 *
 * ran.core.float(2)
 * // => 1.7201255276155272
 *
 * ran.core.float(2, 3)
 * // => 2.3693449236256185
 *
 * ran.core.float(2, 3, 5)
 * // => [ 2.4310443387740093,
 * //      2.934333354639414,
 * //      2.7689523358767127,
 * //      2.291137165632517,
 * //      2.5040591952427906 ]
 *
 */
function float (min, max, n) {
  if (arguments.length === 0) { return r$1.next() }
  if (arguments.length === 1) { return r$1.next() * min }
  return some(() => r$1.next() * (max - min) + min, n)
}

/**
 * Generates some uniformly distributed random integers in (min, max).
 * If min > max, a random integer in (max, min) is generated.
 * If only min is specified, generates a single random integer between 0 and min.
 *
 * @method int
 * @memberof ran.core
 * @param {number} min Lower boundary, or upper if max is not specified.
 * @param {number=} max Upper boundary.
 * @param {number=} n Number of integers to generate.
 * @returns {(number|number[])} Single integer or array of random integers.
 * @example
 *
 * ran.core.int(10)
 * // => 2
 *
 * ran.core.int(10, 20)
 * //=> 12
 *
 * ran.core.int(10, 20, 5)
 * // => [ 12, 13, 10, 14, 14 ]
 *
 */
function int (min, max, n) {
  if (arguments.length === 1) { return Math.floor(r$1.next() * (min + 1)) }
  return some(() => Math.floor(r$1.next() * (max - min + 1) + min), n)
}

/**
 * Samples some elements with replacement from an array with uniform distribution.
 *
 * @method choice
 * @memberof ran.core
 * @param {Array=} values Array to sample from.
 * @param {number=} n Number of elements to sample.
 * @returns {(object|object[]|undefined)} Single element or array of sampled elements. If the array is invalid (empty or
 * not passed), undefined is returned.
 * @example
 *
 * ran.core.choice([1, 2, 3, 4, 5])
 * // => 2
 *
 * ran.core.choice([1, 2, 3, 4, 5], 5)
 * // => [ 1, 5, 4, 4, 1 ]
 */
function choice (values, n) {
  if (!Array.isArray(values) || values.length === 0) {
    return
  }
  return some(() => values[Math.floor(r$1.next() * values.length)], n)
}

/**
 * Samples some characters with replacement from a string with uniform distribution.
 *
 * @method char
 * @memberof ran.core
 * @param {string=} string String to sample characters from.
 * @param {number=} n Number of characters to sample.
 * @returns {(string|string[]|undefined)} Random character if n is not given or less than 2, an array of random characters
 * otherwise. If string is empty, undefined is returned.
 * @example
 *
 * ran.core.char('abcde')
 * // => 'd'
 *
 * ran.core.char('abcde', 5)
 * // => [ 'd', 'c', 'a', 'a', 'd' ]
 *
 */
function char (string, n) {
  if (typeof string !== 'string' || string === '') {
    return
  }
  return some(() => string.charAt(Math.floor(r$1.next() * string.length)), n)
}

/**
 * Shuffles an array in-place using the [Fisher‒Yates algorithm]{@link https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle}.
 *
 * @method shuffle
 * @memberof ran.core
 * @param {Array} values Array to shuffle.
 * @returns {Array} The shuffled array.
 * @example
 *
 * ran.core.shuffle([1, 2, 3])
 * // => [ 2, 3, 1 ]
 *
 */
function shuffle (values) {
  let i; let tmp; let l = values.length;
  while (l) {
    i = Math.floor(r$1.next() * l--);
    tmp = values[l];
    values[l] = values[i];
    values[i] = tmp;
  }
  return values
}

/**
 * Flips a biased coin several times and returns the associated head/tail value or array of values.
 *
 * @method coin
 * @memberof ran.core
 * @param {Object} head Head value.
 * @param {Object} tail Tail value.
 * @param {number=} p Bias (probability of head). Default is 0.5.
 * @param {number=} n Number of coins to flip. Default is 1.
 * @returns {(object|object[])} Single head/tail value or an array of head/tail values.
 * @example
 *
 * ran.core.coin('a', {b: 2})
 * // => { b: 2 }
 *
 * ran.core.coin('a', {b: 2}, 0.9)
 * // => 'a'
 *
 * ran.core.coin('a', {b: 2}, 0.9, 9)
 * // => [ { b: 2 }, 'a', 'a', 'a', 'a', 'a', 'a', { b: 2 }, 'a' ]
 */
function coin (head, tail, p = 0.5, n = 1) {
  return some(() => r$1.next() < p ? head : tail, n)
}

var index$6 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  char: char,
  choice: choice,
  coin: coin,
  float: float,
  int: int,
  seed: seed,
  shuffle: shuffle
});

/**
 * Calculates the [arithmetic mean]{@link https://en.wikipedia.org/wiki/Arithmetic_mean} of an array of values.
 *
 * @method mean
 * @memberof ran.location
 * @param {number[]} values Array of values to calculate mean for.
 * @returns {(number|undefined)} Mean of the values if there are any, undefined otherwise.
 * @example
 *
 * ran.location.mean([])
 * // => undefined
 *
 * ran.location.mean([1, 2, 3])
 * // => 2
 */
function mean (values) {
  return values.length > 0 ? values.reduce((acc, d) => acc + d, 0) / values.length : undefined
}

/**
 * Calculates the [geometric mean]{@link https://en.wikipedia.org/wiki/Geometric_mean} of an array of values.
 *
 * @method geometricMean
 * @memberof ran.location
 * @param {number[]} values Array of values to calculate geometric mean for.
 * @returns {(number|undefined)} Gemoetric mean of the values if there are any, undefined otherwise.
 * @example
 *
 * ran.location.geometricMean([])
 * // => undefined
 *
 * ran.location.geometricMean([1, 2, 3])
 * // => 1.8171205928321394
 */
function geometricMean (values) {
  // Check if sample contains zeroes.
  if (values.reduce((acc, d) => acc || d === 0, false)) {
    return 0
  }

  return Math.exp(mean(values.map(d => Math.log(Math.abs(d)))))
}

/**
 * Calculates the [harmonic mean]{@link https://en.wikipedia.org/wiki/Harmonic_mean} of an array of values.
 *
 * @method harmonicMean
 * @memberof ran.location
 * @param {number[]} values Array of values to calculate harmonic mean for.
 * @returns {(number|undefined)} Harmonic mean of the values if there are any, undefined otherwise.
 * @example
 *
 * ran.location.harmonicMean([])
 * // => undefined
 *
 * ran.location.harmonicMean([0, 1, 2])
 * // => undefined
 *
 * run.location.harmonicMean([-1, 2, 3])
 * // => undefined
 *
 * ran.location.harmonicMean([1, 2, 3])
 * // => 1.6363636363636365
 */
function harmonicMean (values) {
  if (values.reduce((acc, d) => acc && (d > 0), true)) {
    return 1 / mean(values.map(d => 1 / d))
  } else {
    return undefined
  }
}

/**
 * Maximum number of iterations in function approximations.
 *
 * @var {number} MAX_ITER
 * @memberof ran.special
 * @private
 */
const MAX_ITER = 100;

/**
 * Error tolerance in function approximations.
 *
 * @var {number} EPS
 * @memberof ran.special
 * @private
 */
const EPS = Number.EPSILON;

/**
 * Safe underflow limit .
 *
 * @var {number} DELTA
 * @memberof ran.special
 * @private
 */
const DELTA = 1e-30;

/**
 * Computes the first n terms of an alternating series using Algorithm 1 in:
 * Henri Cohen, Fernando Rodriguez Villegas & Don Zagier (2000) Convergence Acceleration of Alternating Series,
 * Experimental Mathematics, 9:1, 3-12, DOI: 10.1080/10586458.2000.10504632
 *
 * @method acceleratedSum
 * @memberof ran.algorithms
 * @param {Function} a Function returning the k-th element of the series.
 * @returns {number} The sum of the series up to the first n-th terms.
 * @private
 */
function acceleratedSum (a) {
  // This should be well above the threshold of 1.34 * D.
  const n = 30;

  // Init variables.
  let d = Math.pow(3 + 2 * Math.SQRT2, n);
  d = (d + 1 / d) / 2;
  let b = -1;
  let c = -d;
  let ds = 0;
  let s = 0;

  // Perform summation.
  for (let k = 0; k < n; k++) {
    c = b - c;
    ds = c * a(k);
    s += ds;

    // If the change is already below precision, just stop.
    if (Math.abs(ds / s) < EPS) {
      break
    }
    b *= (k + n) * (k - n) / ((k + 0.5) * (k + 1));
  }
  return s / d
}

// Scaling factor to speed up explorations.
const SCALE = 1.618;

/**
 * Estimates brackets around the root of a function. If there are no constraints specified, the bracket interval
 * grows without limits with a scaling factor of 1.618. Otherwise, the interval is limited to the boundary specified in
 * the constraints. If the constraining interval has an open boundary, the boundary is approached with a distance
 * shrinking with a factor of 1.618 in each step.
 *
 * @method bracket
 * @memberof ran.algorithms
 * @param {Function} f Function to find root for. Must accept a single variable.
 * @param {number} a0 Initial lower boundary of the bracket.
 * @param {number} b0 Initial upper boundary of the bracket.
 * @param {Object[]=} s Object containing the constraints on the lower and upper bracket. Each constraint has a
 * <code>closed</code> and <code>value</code> property denoting if the constraint is a closed interval and the value of
 * the boundaries. If not set, (-inf, inf) is applied.
 * @return {(number[]|undefined)} Array containing the bracket around the root if successful, undefined otherwise.
 * @private
 */
function bracket (f, a0, b0, s) {
  // If initial boundaries are invalid, return undefined.
  if (a0 === b0) {
    return
  }

  // Initialize variables.
  let a = Math.min(a0, b0);
  const min = s ? s[0].value : -Infinity;
  let deltaA = s && s[0].closed ? 0 : 1;
  let b = Math.max(a0, b0);
  const max = s ? s[1].value : Infinity;
  let deltaB = s && s[1].closed ? 0 : 1;
  let fa = f(a);
  let fb = f(b);
  let expansion;

  // Start searching.
  for (let k = 0; k < MAX_ITER; k++) {
    // If we have different signs, we are done.
    if (fa * fb < 0.0) {
      return [a, b]
    }

    // If lower boundary has a smaller value, extend to the left while respecting the support.
    expansion = SCALE * (b - a);
    if (Math.abs(fa) < Math.abs(fb)) {
      a = Math.max(a - expansion, min + deltaA);
      deltaA /= SCALE;
      fa = f(a);
    } else if (Math.abs(fa) > Math.abs(fb)) {
      // If upper boundary has a smaller value, extend to the right while respecting the support.
      b = Math.min(b + expansion, max - deltaB);
      deltaB /= SCALE;
      fb = f(b);
    } else {
      // If they have the same value, extend in both sides.
      a = Math.max(a - expansion, min + deltaA);
      deltaA /= SCALE;
      fa = f(a);
      b = Math.min(b + expansion, max + deltaB);
      deltaB /= SCALE;
      fb = f(b);
    }
  }

  // Return boundary anyway.
  return [a0 || a, b0 || b]
}

/**
 * Finds the root of a function using Brent's method.
 * Source: https://en.wikipedia.org/wiki/Brent%27s_method
 *
 * @method brent
 * @memberof ran.algorithms
 * @param {Function} f Function to find root for. Must accept a single variable.
 * @param {number} a0 Lower boundary of the bracket.
 * @param {number} b0 Upper boundary of the bracket.
 * @return {(number|undefined)} The root location if found, undefined otherwise.
 * @private
 */
// TODO Use pseudo code from wikipedia.
function brent (f, a0, b0) {
  let a = a0;
  let b = b0;
  let c = b0;
  let d, e;
  let fa = f(a);
  let fb = f(b);
  let fc, p, q, r, s, eps, xm;

  if ((fa > 0 && fb > 0) || (fa < 0 && fb < 0)) {
    return
  }

  fc = fb;
  for (let k = 0; k < MAX_ITER; k++) {
    if ((fb > 0 && fc > 0) || (fb < 0 && fc < 0)) {
      c = a;
      fc = fa;
      e = d = b - a;
    }

    if (Math.abs(fc) < Math.abs(fb)) {
      a = b;
      b = c;
      c = a;
      fa = fb;
      fb = fc;
      fc = fa;
    }

    eps = EPS * (2 * Math.abs(b) + 0.5);
    xm = 0.5 * (c - b);

    if (Math.abs(xm) <= eps || fb === 0) {
      return b
    }
    if (Math.abs(e) >= eps && Math.abs(fa) > Math.abs(fb)) {
      s = fb / fa;
      if (a === c) {
        p = 2 * xm * s;
        q = 1 - s;
      } else {
        q = fa / fc;
        r = fb / fc;
        p = s * (2 * xm * q * (q - r) - (b - a) * (r - 1));
        q = (q - 1) * (r - 1) * (s - 1);
      }
      if (p > 0) {
        q = -q;
      }
      p = Math.abs(p);
      const min1 = 3 * xm * q - Math.abs(eps * q);
      const min2 = Math.abs(e * q);
      if (2 * p < (min1 < min2 ? min1 : min2)) {
        e = d;
        d = p / q;
      } else {
        d = xm;
        e = d;
      }
    } else {
      d = xm;
      e = d;
    }

    a = b;
    fa = fb;
    if (Math.abs(d) > eps) {
      b += d;
    } else {
      b += eps * Math.sign(xm);
    }
    fb = f(b);
  }
}

/**
 * Finds the root of a function using [Newton's method]{@link https://en.wikipedia.org/wiki/Newton's_method}.
 * This is a direct implementation of the method but still useful for some simple cases.
 *
 * @method newton
 * @memberof ran.algorithms
 * @param {Function} f Function to find root for. Must accept a single variable.
 * @param {Function} df First derivative of the function. Must accept a single variable.
 * @param {number} x0 Starting point of the optimization.
 * @return {(number|undefined)} The root of the specified function.
 * @private
 */
function newton (f, df, x0) {
  let x = x0;
  let dx;
  let d;

  for (let k = 0; k < MAX_ITER; k++) {
    // Evaluate derivative.
    d = df(x);

    // If derivative is zero, evaluate the function at a close neighboring point.
    dx = f(x) / (Math.abs(d) > EPS ? d : df(x + EPS));
    x -= dx;

    // Exit if we reached precision level.
    if (Math.abs(dx / x) < EPS) {
      break
    }
  }

  return x
}

/**
 * Sums the element of an array using the robust [Neumaier method]{@link https://en.wikipedia.org/wiki/Kahan_summation_algorithm#Further_enhancements}.
 *
 * @method neumaier
 * @memberof ran.algorithms
 * @param {number[]} arr Array to sum.
 * @returns {number} The sum of the elements in the array.
 * @private
 */
function neumaier (arr) {
  // Sort array first.
  const sorted = arr.sort((a, b) => a - b);

  // Init sum and correction.
  let s = sorted[0];
  let c = 0;

  // Start summation.
  for (let i = 1; i < sorted.length; i++) {
    const t = s + sorted[i];
    if (Math.abs(s) > Math.abs(sorted[i])) {
      c += (s - t) + sorted[i];
    } else {
      c += (sorted[i] - t) + s;
    }
    s = t;
  }
  return s + c
}

/**
 * Class implementing a recursive sum. It is initialized with the zeroth term of the sum, an updater for the term
 * variables and a method that computes the term from the variables. If the module specified accuracy has reached, the
 * iteration stops, otherwise the maximum number of iterations are used.
 * This method is widely used for calculating CDFs for distributions that are only defined via computation-heavy
 * series.
 *
 * @method recursiveSum
 * @memberof ran.algorithms
 * @param {Object} x0 Object containing the state of the variables in the zeroth index. This object contains all the
 * relevant variables that are needed to calculate a term in the series.
 * @param {Function} preUpdate Function that takes the current state of the variables, the current index and returns the
 * next state of the variables before calculating the term in the series.
 * @param {Function} termFn Function that takes the current state of the variables and returns the term corresponding
 * to the state.
 * @param {Function=} postUpdate Function that takes the current state of the variables, the current index and returns
 * the next state of the variables after calculating the last term.
 * @returns {number} The approximated sum.
 * @private
 */
function recursiveSum (x0, preUpdate, termFn, postUpdate) {
  // Init state and sum for the zeroth term.
  let x = x0;
  let delta;
  let sum = termFn(x);
  if (postUpdate) {
    x = postUpdate(x, 0);
  }

  // Improve sum recursively.
  for (let i = 1; i < MAX_ITER; i++) {
    // Update state before computing the current term.
    x = preUpdate(x, i);

    // Compute current term and update the sum.
    delta = termFn(x);
    sum += delta;

    // Check if accuracy has been reached.
    if (Math.abs(delta / sum) < EPS) {
      break
    } else {
      // Otherwise update state.
      if (postUpdate) {
        x = postUpdate(x, i);
      }
    }
  }

  // Return the sum.
  return sum
}

/**
 * Swaps two elements of an array.
 *
 * @method _swap
 * @memberof ran.algorithms
 * @param {number[]} arr Array to modify.
 * @param {number} i First index to use for swap
 * @param {number} j First index to use for swap
 * @private
 */
const _swap = (arr, i, j) => {
  const tmp = arr[i];
  arr[i] = arr[j];
  arr[j] = tmp;
};

/**
 * Partitions an array by a specific pivot value using the
 * [Lomuto partition scheme]{@link https://en.wikipedia.org/wiki/Quickselect#Algorithm}.
 *
 * @method _partition
 * @memberof ran.algorithms
 * @param {number[]} arr Array to partition.
 * @param {number} left Lower bound of the partitioning.
 * @param {number} right Upper bound of the partitioning.
 * @param {number} pivotIndex Index to partition array around.
 * @return {number} The new pivot index after partitioning.
 * @private
 */
function _partition (arr, left, right, pivotIndex) {
  // TODO Change this to Hoare's partition scheme.
  const pivotValue = arr[pivotIndex];
  _swap(arr, pivotIndex, right);
  let storeIndex = left;
  for (let i = left; i < right; i++) {
    if (arr[i] < pivotValue) {
      _swap(arr, storeIndex, i);
      storeIndex++;
    }
  }
  _swap(arr, right, storeIndex);
  return storeIndex
}

/**
 * Performs a quickselect within a specific range of indices.
 *
 * @method _select
 * @memberof ran.algorithms
 * @param {number[]} arr Array to perform quickselect on.
 * @param {number} left Lower boundary of the index range.
 * @param {number} right Upper boundary of the index range.
 * @param {number} k The rank of the element to find.
 * @return {number} The k-th lowest element in the array.
 * @private
 */
function _select (arr, left, right, k) {
  if (left === right) {
    return arr[left]
  }
  const pivotIndex = _partition(arr, left, right, Math.floor((left + right) / 2));
  if (k === pivotIndex) {
    return arr[k]
  } else if (k < pivotIndex) {
    return _select(arr, left, pivotIndex - 1, k)
  } else {
    return _select(arr, pivotIndex + 1, right, k)
  }
}

/**
 * Selects the k-th smallest element in an array using the quickselect algorithm.
 * Just a direct implementation from https://en.wikipedia.org/wiki/Quickselect#Algorithm.
 *
 * @method quickselect
 * @memberof ran.algorithms
 * @param {number[]} values Array of values to select from.
 * @param {number} k The index of the item to select.
 * @return {number} The selected item.
 * @private
 */
function quickselect (values, k) {
  return _select(values, 0, values.length - 1, k)
}

/**
 * Calculates the median of a sample of values.
 *
 * @method median
 * @memberof ran.location
 * @param {number[]} values Array of values to calculate median for.
 * @returns {number} Median of the values if there are any, undefined otherwise.
 * @example
 *
 * ran.location.median([])
 * // => undefined
 *
 * ran.location.median([1, 2, 3, 4])
 * // => 2.5
 */
function median (values) {
  if (values.length === 0) {
    return undefined
  }

  const n = values.length;
  if (n % 2 === 1) {
    return quickselect(values, (n - 1) / 2)
  } else {
    return 0.5 * (quickselect(values, n / 2 - 1) + quickselect(values, n / 2))
  }
}

/**
 * Calculates the [mid-range]{@link https://en.wikipedia.org/wiki/Mid-range} for a sample of values.
 *
 * @method midrange
 * @memberof ran.location
 * @param {number[]} values Array of values to calculate mid-range for.
 * @return {(number|undefined)} The mid-range of the values if there is any, undefined otherwise.
 * @example
 *
 * ran.location.midrange([])
 * // => undefined
 *
 * ran.location.midrange([0, 0, 0, 1, 2])
 * // => 1
 */
function midrange (values) {
  if (values.length === 0) {
    return undefined
  }

  let min = values[0];
  let max = values[0];
  for (const x of values) {
    min = Math.min(min, x);
    max = Math.max(max, x);
  }
  return (min + max) / 2
}

/**
 * Calculates the mode(s) for a sample of discrete values.
 *
 * @method discreteMode
 * @memberof ran.location
 * @param {number[]} values Array containing the sample.
 * @return {number[]} Array containing the modes of the sample.
 * @private
 */
function discreteMode (values) {
  // Count occurrences.
  const counts = Array.from(values.reduce((count, d) => count.set(d, (count.get(d) || 0) + 1), new Map()))
    .sort((a, b) => b[1] - a[1]);

  // Find highest count.
  const maxCounts = counts[0][1];

  // Return values with highest count.
  return counts.filter(d => d[1] === maxCounts).map(d => d[0]).sort((a, b) => a - b)
}

/**
 * Calculates the mode for continuous sample using the half sample mode: https://arxiv.org/pdf/math/0505419.pdf.
 *
 * @method continuousMode
 * @memberof ran.location.mode
 * @param {number[]} values Array containing the continuous sample.
 * @return {number} The estimated mode.
 * @private
 */
function continuousMode (values) {
  // Sort values.
  values.sort((a, b) => a - b);

  // Depending on sample size, do one of the followings.
  switch (values.length) {
    case 1:
      return values[0]
    case 2:
      return (values[0] + values[1]) / 2
    case 3:
      if (values[1] - values[0] < values[2] - values[1]) {
        return (values[0] + values[1]) / 2
      }
      if (values[1] - values[0] > values[2] - values[1]) {
        return (values[2] + values[1]) / 2
      }
      return values[1]
    default: {
      let j = 0;
      let wMin = values[values.length - 1] - values[0];
      const N = Math.ceil(values.length / 2);
      const n = values.length;
      for (let i = 0; i < n - N + 1; i++) {
        const w = values[i + N - 1] - values[i];
        if (w < wMin) {
          wMin = w;
          j = i;
        }
      }
      return continuousMode(values.slice(j, j + N))
    }
  }
}

/**
 * Calculates the mode(s) of a sample. In case of discrete values (integers), it returns the values corresponding to the
 * highest frequencies in ascending order. For continuous sample, the mode is estimated using the
 * [half-sample mode algorithm]{@link https://arxiv.org/pdf/math/0505419.pdf}.
 *
 * @method mode
 * @memberof ran.location
 * @param {number[]} values Array of values to calculate mode for.
 * @returns {number|number[]|undefined} The estimated mode (continuous sample), an array of modes (discrete sample) or
 * undefined (empty sample).
 * @example
 *
 * ran.location.mode([])
 * // => undefined
 *
 * ran.location.mode([1])
 * // => [1]
 *
 * ran.location.mode([1, 1, 2, 2, 3])
 * // => [1, 2]
 *
 * ran.location.mode([1, 2, 2, 2, 3])
 * // => [2]
 *
 * ran.location.mode([1.2, 3.4, 5.6])
 * // => 4.5
 */
function mode (values) {
  if (values.length === 0) {
    return undefined
  }

  if (values.reduce((int, d) => int && Number.isInteger(d), true)) {
    return discreteMode(values)
  } else {
    return continuousMode(values)
  }
}

/**
 * Calculates the quantile at 0 < p < 1 using the R-7 algorithm.
 *
 * @method quantile
 * @memberof ran.shape
 * @param {number[]} values Array of values to calculate quantile for.
 * @param {number} p Value to calculate quantile at.
 * @return {(number|undefined)} The quantile of the sample if there is any, undefined otherwise.
 */
function quantile (values, p) {
  if (values.length === 0) {
    return undefined
  }

  const h = (values.length - 1) * p;
  const h0 = Math.floor(h);
  const x0 = quickselect(values, h0);
  if (h0 < values.length - 1) {
    const x1 = quickselect(values, h0 + 1);
    return x0 + (h - h0) * (x1 - x0)
  } else {
    return x0
  }
}

/**
 * Calculates the [trimean]{@link https://en.wikipedia.org/wiki/Trimean} for a sample of values.
 *
 * @method trimean
 * @memberof ran.location
 * @param {number[]} values Array of values to calculate trimean for.
 * @return {(number|undefined)} The trimean of the values if there is any, undefined otherwise.
 * @example
 *
 * ran.location.trimean([])
 * // => undefined
 *
 * ran.location.trimean([1, 1, 1, 2, 3])
 * // => 1.25
 */
function trimean (values) {
  if (values.length === 0) {
    return undefined
  }

  return (quantile(values, 0.25) + 2 * median(values) + quantile(values, 0.75)) / 4
}

/**
 * Namespaces containing various central tendency metrics.
 *
 * @namespace location
 * @memberof ran
 */

var index$5 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  geometricMean: geometricMean,
  harmonicMean: harmonicMean,
  mean: mean,
  median: median,
  midrange: midrange,
  mode: mode,
  trimean: trimean
});

/**
 * Calculates the [sample covariance]{@link https://en.wikipedia.org/wiki/Covariance#Calculating_the_sample_covariance}
 * for paired arrays of values.
 *
 * @method covariance
 * @memberof ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values.
 * @returns {(number|undefined)} The sample covariance if both arrays have more than one element and they have the same
 * length, undefined otherwise.
 * @example
 *
 * ran.dependence.covariance([], [])
 * // => undefined
 *
 * ran.dependence.covariance([1], [2])
 * // => undefined
 *
 * ran.dependence.covariance([1, 2, 3], [1, 2, 3, 4])
 * // => undefined
 *
 * ran.dependence.covariance([1, 2, 3], [4, 5, 6])
 * // => 1
 *
 * ran.dependence.covariance([1, 9, 10], [1, 2, 10])
 * // => 16.166666666666668
 */
function covariance (x, y) {
  if (isInvalidInput$1(x, y)) {
    return undefined
  }

  const mx = mean(x);
  const my = mean(y);
  return x.length * mean(x.map((d, i) => (d - mx) * (y[i] - my))) / (x.length - 1)
}

function isInvalidInput$1 (x, y) {
  return x.length < 2 || y.length < 2 || x.length !== y.length
}

/**
 * Class representing a real vector.
 *
 * @class Vector
 * @memberof ran.la
 * @param {(number|Array|ran.la.Vector)=} arg The constructor argument. If it is a number, it sets the
 * dimension of the vector. If it is an array, the vector is initialized with the array elements. If it is
 * another vector, it is copied to this vector. If not specified, a 3D vector is created directing in the X
 * axis.
 * @constructor
 * @ignore
 * @example
 *
 * let vec1 = new ran.la.Vector()
 * let vec2 = new ran.la.Vector(3)
 * let vec3 = new ran.la.Vector([1, 0, 0])
 * let vec4 = new ran.la.Vector(vec1)
 * // => ( 1, 0, 0 )
 *
 */
class Vector {
  constructor (arg) {
    if (typeof arg === 'number') {
      this._v = new Array(arg).fill(0);
      this._v[0] = 1;
    } else if (Array.isArray(arg)) {
      this._v = arg;
    } else if (typeof arg === 'object' && Array.isArray(arg._v)) {
      this._v = arg._v;
    } else {
      this._v = [1, 0, 0];
    }
  }

  /**
   * Returns the vector as an array.
   *
   * @method v
   * @memberof ran.la.Vector
   * @returns {Array} The vector as an array.
   * @example
   *
   * let vec = new ran.la.Vector(3)
   * vec.v()
   * // => [ 1, 0, 0 ]
   *
   */
  v () {
    return this._v.slice()
  }

  /**
   * Returns the dimension of the vector.
   *
   * @method dim
   * @memberof ran.la.Vector
   * @return {number} Number of dimensions.
   * @example
   *
   * let vec = new ran.la.Vector([1, 2, 3, 4])
   * vec.dim()
   * // => 4
   */
  dim () {
    return this._v.length
  }

  /**
   * Returns or sets an element of the vector.
   *
   * @method i
   * @memberof ran.la.Vector
   * @param {number} i Index of the element.
   * @param {number=} value The new value of the i-th element. If not specified, the value at i is returned.
   * @return {(number | Vector)} The i-th element if value is not specified, otherwise a vector with the i-th element
   * changed
   * @example
   *
   * let v = new ran.la.Vector()
   *
   * v.i(0)
   * // => 1
   *
   * v.i(1)
   * // => 0
   *
   * v.i(1, 2)
   * // => ( 1, 2, 0 )
   *
   */
  i (i, value) {
    if (typeof value !== 'undefined') {
      this._v[i] = value;
      return new Vector(this._v)
    } else {
      return this._v[i]
    }
  }

  /**
   * Performs an operation on the vector element-wise.
   *
   * @method f
   * @memberof ran.la.Vector
   * @param {Function} func Function to apply on each element. May take two arguments: the vector value and the current index.
   * @returns {ran.la.Vector} The transformed matrix.
   * @example
   *
   * let v = new ran.la.Vector([1, 2, 3])
   * v.f(d => d * d)
   * // => ( 1, 4, 9 )
   *
   */
  f (func) {
    return new Vector(this._v.map((d, i) => func(d, i)))
  }

  /**
   * Multiplies this vector with a scalar.
   *
   * @method scale
   * @memberof ran.la.Vector
   * @param {number} s Scalar to multiply vector with.
   * @returns {ran.la.Vector} The scaled vector.
   * @example
   *
   * let vec = new ran.la.Vector([1, 2, 3])
   * vec.scale(2)
   * // => ( 2, 4, 6 )
   *
   */
  scale (s) {
    return new Vector(this._v.map(d => d * s))
  }

  /**
   * Adds another vector to this vector.
   *
   * @method add
   * @memberof ran.la.Vector
   * @param {ran.la.Vector} vec The vector to add.
   * @returns {ran.la.Vector} The sum vector.
   * @example
   *
   * let v = new ran.la.Vector([1, 2, 3])
   * let w = new ran.la.Vector([4, 5, 6])
   * v.add(w)
   * // => ( 5, 7, 9 )
   *
   */
  add (vec) {
    const v = vec.v();
    return new Vector(this._v.map((d, i) => d + v[i]))
  }

  /**
   * Subtracts another vector from this vector.
   *
   * @method sub
   * @memberof ran.la.Vector
   * @param {ran.la.Vector} vec The vector to subtract.
   * @returns {ran.la.Vector} The difference vector.
   * @example
   *
   * let v = new ran.la.Vector([4, 5, 6])
   * let w = new ran.la.Vector([1, 1, 1])
   * v.sub(w)
   * // => ( 3, 4, 5 )
   *
   */
  sub (vec) {
    const v = vec.v();
    return new Vector(this._v.map((d, i) => d - v[i]))
  }

  /**
   * Calculates the dot product with another vector.
   *
   * @method dot
   * @memberof ran.la.Vector
   * @param {ran.la.Vector} vec Vector to multiply with.
   * @returns {number} The dot product.
   * @example
   *
   * let v = new ran.la.Vector([1, 2, 3])
   * let w = new ran.la.Vector([4, 5, 6])
   * v.dot(w)
   * // => 32
   *
   */
  dot (vec) {
    const v = vec.v();
    return this._v.reduce((sum, d, i) => sum + d * v[i], 0)
  }

  /**
   * Calculates the outer product with another vector.
   *
   * @method outer
   * @memberof ran.la.Vector
   * @param vec {ran.la.Vector} vec Vector to multiply with (from the right).
   * @returns {Array[]} An array of arrays representing the outer product.
   * @example
   *
   * let v = new ran.la.Vector([1, 2, 3])
   * let w = new ran.la.Vector([4, 5, 6])
   * v.outer(w)
   * // => [[4,   5,  6],
   *        [8,  10, 12],
   *        [12, 15, 18]]
   */
  outer (vec) {
    return this._v.map(u => vec.scale(u).v())
  }
}

/**
 * Class representing an immutable real square matrix.
 *
 * @class Matrix
 * @memberof ran.la
 * @param {(number|Array|ran.la.Matrix)=} arg The constructor argument. If it is a number, it sets the
 * linear dimension of the matrix. If it is an array of arrays, the matrix is initialized with the array
 * elements. If it is another matrix, it is copied to this matrix. If not specified, a 3x3 identity matrix is
 * created.
 * @constructor
 * @ignore
 * @example
 *
 * let M1 = new ran.la.Matrix()
 * let M2 = new ran.la.Matrix(3)
 * let M3 = new ran.la.Matrix([[1, 0, 0], [0, 1, 0], [0, 0, 1]])
 * let M4 = new ran.la.Matrix(M1)
 * //    ┌         ┐
 * //    │ 1  0  0 │
 * // => │ 0  1  0 │
 * //    │ 0  0  1 │
 * //    └         ┘
 *
 */
class Matrix {
  constructor (arg) {
    if (typeof arg === 'number') {
      this._m = Array.from({ length: arg }, () => new Array(arg).fill(0));
      for (let i = 0; i < arg; i++) {
        this._m[i][i] = 1;
      }
    } else if (Array.isArray(arg)) {
      this._m = arg;
    } else if (typeof arg === 'object' && Array.isArray(arg._m)) {
      this._m = arg._m;
    } else {
      this._m = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    }
  }

  /**
   * Returns the matrix as an array of arrays.
   *
   * @method m
   * @memberof ran.la.Matrix
   * @returns {Array[]} The matrix in an array of array representation.
   * @example
   *
   * let M = new ran.la.Matrix()
   * M.m()
   * // => [ [ 1, 0, 0 ],
   * //      [ 0, 1, 0 ],
   * //      [ 0, 0, 1 ] ]
   *
   */
  m () {
    return this._m.map(d => d.slice())
  }

  /**
   * Returns or sets an element of the matrix.
   *
   * @method ij
   * @memberof ran.la.Matrix
   * @param {number} i Row index of the element.
   * @param {number} j Column index of the element.
   * @param {number=} value The new value of the element at the i-th row and j-th column. If not specified,
   * the value at (i, j) is returned.
   * @example
   *
   * let M = new ran.la.Matrix()
   *
   * M.ij(1, 1)
   * // => 1
   *
   * M.ij(1, 2)
   * // => 0
   *
   * M.ij(1, 2, 5)
   * //    ┌         ┐
   * //    │ 1  0  0 │
   * // => │ 0  1  0 │
   * //    │ 0  5  1 │
   * //    └         ┘
   *
   */
  ij (i, j, value) {
    if (typeof value !== 'undefined') {
      this._m[i][j] = value;
    } else {
      return this._m[i][j]
    }
  }

  /**
   * Performs an operation on the matrix element-wise.
   *
   * @method f
   * @memberof ran.la.Matrix
   * @param {Function} func Function to apply on each element. May take three parameters: the element's value and its
   * row and column indices.
   * @returns {ran.la.Matrix} The transformed matrix.
   * @example
   *
   * let M = new ran.la.Matrix([[1, 2], [3, 4]])
   * M.f(d => d * d)
   * //    ┌      ┐
   * // => │ 1  4 │
   * //    │ 9 16 │
   * //    └      ┘
   *
   */
  f (func) {
    return new Matrix(this._m.map((row, i) => row.map((d, j) => func(d, i, j))))
  }

  /**
   * Multiplies the matrix with a scalar.
   *
   * @method scale
   * @memberof ran.la.Matrix
   * @param {number} s The scalar to multiply matrix with.
   * @returns {ran.la.Matrix} The scaled matrix.
   * @example
   *
   * let M = new ran.la.Matrix([[1, 2], [3, 4]])
   * M.scale(2)
   * //    ┌      ┐
   * // => │ 2  4 │
   * //    │ 6  8 │
   * //    └      ┘
   *
   */
  scale (s) {
    return this.f(x => x * s)
  }

  /**
   * Adds another matrix to the current matrix.
   *
   * @method add
   * @memberof ran.la.Matrix
   * @param {ran.la.Matrix} mat The matrix to add.
   * @returns {ran.la.Matrix} The sum of the two matrices.
   * @example
   *
   * let M = new ran.la.Matrix([[1, 2], [3, 4]])
   * let N = new ran.la.Matrix([[5, 6], [7, 8]])
   * M.add(N)
   * //    ┌        ┐
   * // => │  6   8 │
   * //    │ 10  12 │
   * //    └        ┘
   *
   */
  add (mat) {
    const m = mat.m();
    return new Matrix(this._m.map((row, i) => row.map((d, j) => d + m[i][j])))
  }

  /**
   * Subtracts another matrix from the current matrix.
   *
   * @method sub
   * @memberof ran.la.Matrix
   * @param {ran.la.Matrix} mat The matrix to subtract.
   * @returns {ran.la.Matrix} The difference of the two matrices.
   * @example
   *
   * let M = new ran.la.Matrix([[5, 6], [7, 8]])
   * let N = new ran.la.Matrix([[1, 1], [1, 1]])
   * M.add(N)
   * //    ┌      ┐
   * // => │ 4  5 │
   * //    │ 6  7 │
   * //    └      ┘
   *
   */
  sub (mat) {
    const m = mat.m();
    return new Matrix(this._m.map((row, i) => row.map((d, j) => d - m[i][j])))
  }

  /**
   * Multiplies the matrix with another matrix (from the right).
   *
   * @method mult
   * @memberof ran.la.Matrix
   * @param {Matrix} mat Matrix to multiply current matrix with.
   * @returns {Matrix} The product matrix.
   * @example
   *
   * let M = new ran.la.Matrix([[1, 2], [3, 4]])
   * let N = new ran.la.Matrix([[5, 6], [7, 8]])
   * M.mult(N)
   * //    ┌        ┐
   * // => │ 19  22 │
   * //    │ 43  50 │
   * //    └        ┘
   *
   */
  mult (mat) {
    const m = mat.m();
    const n = this._m.length;
    const r = new Matrix(n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let rij = 0;
        for (let k = 0; k < n; k++) {
          rij += this._m[i][k] * m[k][j];
        }
        r.ij(i, j, rij);
      }
    }
    return r
  }

  /**
   * Returns the transpose of the matrix.
   *
   * @method t
   * @memberof ran.la.Matrix
   * @returns {ran.la.Matrix} The transposed matrix.
   * @example
   *
   * let M = new ran.la.Matrix([[1, 2], [3, 4]])
   * M.t()
   * //    ┌      ┐
   * // => │ 1  3 │
   * //    │ 2  4 │
   * //    └      ┘
   *
   */
  t () {
    return new Matrix(this._m[0].map((col, i) => this._m.map(row => row[i])))
  }

  /**
   * Multiplies a vector with the matrix (applies this matrix on a vector).
   *
   * @method apply
   * @memberof ran.la.Matrix
   * @param {ran.la.Vector} vec Vector to apply matrix on.
   * @returns {ran.la.Vector} The mapped vector.
   * @example
   *
   * let M = new ran.la.Matrix([[1, 2], [3, 4]])
   * let v = new ran.la.Vector([5, 6])
   * M.apply(v)
   * // => ( 17, 39 )
   *
   */
  apply (vec) {
    return new Vector(this._m.map(d => vec.dot(new Vector(d))))
  }

  /**
   * Performs the [LDL decomposition]{@link https://en.wikipedia.org/wiki/Cholesky_decomposition} of the
   * matrix.
   *
   * @method ldl
   * @memberof ran.la.Matrix
   * @returns {Object} Object containing two properties: {D} and {L} representing the corresponding matrices
   * in the LDL decomposition.
   * @example
   *
   * let M = new Matrix([[4, 12, -16], [12, 37, -43], [-16, -43, 98]])
   * M.ldl()
   * //        ┌          ┐       ┌         ┐
   * //        │  1  0  0 │       │ 4  0  0 │
   * // => L = │  3  1  0 │,  D = │ 0  1  0 │
   * //        │ -4  5  1 │       │ 0  0  9 │
   * //        └          ┘       └         ┘
   *
   */
  ldl () {
    // Init D, L
    const n = this._m.length;

    const D = new Matrix(n);

    const L = new Matrix(n);

    // Perform decomposition
    for (let j = 0; j < n; j++) {
      // Update D
      let dj = this.ij(j, j);
      for (let k = 0; k < j; k++) {
        dj -= D.ij(k, k) * L.ij(j, k) * L.ij(j, k);
      }
      D.ij(j, j, dj);

      // Update L
      for (let i = n - 1; i > j; i--) {
        let lij = this.ij(i, j);
        for (let k = 0; k < j; k++) {
          lij -= D.ij(k, k) * L.ij(i, k) * L.ij(j, k);
        }
        L.ij(i, j, lij / dj);
      }
    }

    return { D, L }
  }

  /**
   * Returns an array representing the row sums of the matrix.
   *
   * @method rowSum
   * @memberof ran.la.Matrix
   * @return {number[]} Array containing the row sums.
   */
  rowSum () {
    return this._m.map(row => row.reduce((sum, d) => sum + d, 0))
  }

  /**
   * Returns the Hadamard (element-wise) product of the matrix with another matrix
   *
   * @method hadamard
   * @memberof ran.la.Matrix
   * @param {ran.la.Matrix} mat Matrix to calculate element-wise product with.
   * @return {ran.la.Matrix} The result matrix.
   */
  hadamard (mat) {
    const m = mat.m();
    return this.f((d, i, j) => d * m[i][j])
  }

  /**
   * Returns the trace of the matrix.
   *
   * @method trace
   * @memberof ran.la.Matrix
   * @return {number} The trace of the matrix.
   */
  trace () {
    const n = this._m.length;
    let t = 0;
    for (let i = 0; i < n; i++) {
      t += this._m[i][i];
    }
    return t
  }
}

/**
 * Calculates the [distance matrix for the distance covariance]{@link https://en.wikipedia.org/wiki/Distance_correlation#Distance_covariance}.
 *
 * @method distanceMatrix
 * @memberof ran.dependence
 * @param {number[]} values Array of values to calculate distance matrix for.
 * @return {ran.la.Matrix} The distance matrix.
 * @private
 */
function distanceMatrix (values) {
  // Calculate distance matrix.
  const mat = new Matrix(values.map(i => values.map(j => Math.abs(i - j))));

  // Centralize.
  const row = mat.rowSum().map(d => d / values.length);
  const grand = mean(row);
  return mat.f((d, i, j) => d + grand - row[i] - row[j])
}

/**
 * Calculates the [distance covariance]{@link https://en.wikipedia.org/wiki/Distance_correlation#Distance_covariance} for
 * paired arrays of values.
 *
 * @method dCov
 * @memberof ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values.
 * @returns {(number|undefined)} The distance covariance if none of the arrays are empty and they have the same length,
 * undefined otherwise.
 * @example
 *
 * ran.dependence.dCov([1, 2, 3], [])
 * // => undefined
 *
 * ran.dependence.dCov([1, 2, 3], [2, 1, 2])
 * // => 0.31426968052735443
 */
function distanceCovariance (x, y) {
  if (x.length * y.length === 0 || x.length !== y.length) {
    return undefined
  }

  const a = distanceMatrix(x);
  const b = distanceMatrix(y);
  return Math.sqrt(mean([].concat(...a.hadamard(b).m())))
}

/**
 * Calculates the [distance correlation]{@link https://en.wikipedia.org/wiki/Distance_correlation#Distance_correlation}
 * for paired arrays of values.
 *
 * @method dCor
 * @memberof ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values.
 * @returns {(number|undefined)} The distance correlation if none of the arrays are empty and they have the same length,
 * undefined otherwise.
 * @example
 *
 * ran.dependence.dCor([1, 2, 3], [])
 * // => undefined
 *
 * ran.dependence.dCor([1, 2, 3], [2, 1, 2])
 * // => 0.5623413251903491
 */
function distanceCorrelation (x, y) {
  const a = distanceMatrix(x);
  const b = distanceMatrix(y);
  const dVarX = Math.sqrt(mean([].concat(...a.hadamard(a).m())));
  const dVarY = Math.sqrt(mean([].concat(...b.hadamard(b).m())));
  if (dVarX * dVarY > 0) {
    const dCov = Math.sqrt(mean([].concat(...a.hadamard(b).m())));
    return dCov / Math.sqrt(dVarX * dVarY)
  }
  return undefined
}

/**
 * Returns the number of concordant pairs in two arrays of the same length.
 *
 * @method concordant
 * @memberof ran.utils
 * @param {number[]} x First array.
 * @param {number[]} y Second array.
 * @return {number} Number of concordant pairs.
 * @private
 */
function concordant (x, y) {
  let n = 0;
  for (let i = 1; i < x.length; i++) {
    for (let j = 0; j < i; j++) {
      if (Math.sign(x[i] - x[j]) * Math.sign(y[i] - y[j]) > 0) {
        n++;
      }
    }
  }
  return n
}

/**
 * Returns the number of discordant pairs in two arrays of the same length.
 *
 * @method discordant
 * @memberof ran.utils
 * @param {number[]} x First array.
 * @param {number[]} y Second array.
 * @return {number} Number of discordant pairs.
 * @private
 */
function discordant (x, y) {
  let n = 0;
  for (let i = 1; i < x.length; i++) {
    for (let j = 0; j < i; j++) {
      if (Math.sign(x[i] - x[j]) * Math.sign(y[i] - y[j]) < 0) {
        n++;
      }
    }
  }
  return n
}

function nTies (values) {
  const counts = values.reduce((acc, d) => Object.assign(acc, { [d]: (acc[d] || 0) + 1 }), {});
  const ties = Object.values(counts).filter(d => d > 1);
  return ties.reduce((sum, d) => sum + d * (d - 1) / 2, 0)
}

/**
 * Calculates [Kendall's rank correlation coefficient]{@link https://en.wikipedia.org/wiki/Kendall_rank_correlation_coefficient}
 * for paired arrays of values.
 *
 * @method kendall
 * @memberof ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values.
 * @returns {(number|undefined)} Kendall's correlation coefficient if none of the arrays are empty and they have the
 * same length, undefined otherwise.
 * @example
 *
 * ran.dependence.kendall([], [])
 * // => undefined
 *
 * ran.dependence.kendall([1, 2, 3], [1, 2, 3, 4])
 * // => undefined
 *
 * ran.dependence.kendall([1, 2, 3], [4, 5, 6])
 * // => 1
 *
 * ran.dependence.kendall([1, 2, 3], [1, 4, 2])
 * // => 0.3333333333333333
 */
function kendall (x, y) {
  if (invalidInput(x, y)) {
    return undefined
  }

  // Numerator.
  const num = concordant(x, y) - discordant(x, y);

  // Correction for ties.
  const n0 = x.length * (x.length - 1) / 2;
  const n1 = nTies(x);
  const n2 = nTies(y);

  // Return the final value.
  return num / Math.sqrt((n0 - n1) * (n0 - n2))
}

function invalidInput (x, y) {
  return x.length === 0 || y.length === 0 || x.length !== y.length
}

/**
 * Calculates the (discrete) [Kullback-Leibler divergence]{@link https://en.wikipedia.org/wiki/Kullback%E2%80%93Leibler_divergence}
 * for two probability distributions:
 *
 * $$D\_\mathrm{KL}(P \parallel Q) = \sum\_{x \in \mathcal{X}} P(x) \log\bigg(\frac{P(x)}{Q(x)}\bigg).$$
 *
 * @method kullbackLeibler
 * @memberof ran.dependence
 * @param {number[]} p Array representing the probabilities for the i-th value in the base distribution (P).
 * @param {number[]} q Array representing the probabilities for the i-th value in compared distribution (Q).
 * @returns {(number|undefined)} The Kullback-Leibler divergence if none of the distributions are empty and Q(x) = 0
 * implies that P(x) = 0 for all x, otherwise undefined.
 * @example
 *
 * ran.dependence.kullbackLeibler([0.1, 0.2, 0.7], [])
 * // => undefined
 *
 * ran.dependence.kullbackLeibler([0.1, 0.2, 0.7], [0.1, 0.2, 0.3, 0.4])
 * // => undefined
 *
 * ran.dependence.kullbackLeibler([0.1, 0.3, 0.6], [0.333, 0.333, 0.334])
 * // => 0.19986796234715937
 *
 * ran.dependence.kullbackLeibler([0.333, 0.333, 0.334], [0.1, 0.3, 0.6])
 * // => 0.2396882491444514
 */
function kullbackLeibler (p, q) {
  if (!isValid(p, q)) {
    return undefined
  }

  // Check Q(x) = 0 => P(x) = 0 implication.
  if (hasZeroQWithNonZeroP(p, q)) {
    return undefined
  }

  // Calculate sum over all P(x) > 0 elements.
  return neumaier(p.filter(d => d > 0).map((pi, i) => pi * Math.log(pi / q[i])))
}

function isValid (p, q) {
  return p.length !== 0 && q.length !== 0 && p.length === q.length
}

function hasZeroQWithNonZeroP (p, q) {
  return q.filter((qi, i) => qi === 0 && p[i] !== 0).length > 0
}

/**
 * Calculates the [odds ratio]{@link https://en.wikipedia.org/wiki/Odds_ratio} for the joint probabilities of two binary
 * variables:
 *
 * $$OR(p_{00}, p_{01}, p_{10}, p_{11}) = \frac{p_{00} p_{11}}{p_{01} p_{10}}.$$
 *
 * @method oddsRatio
 * @memberof ran.dependence
 * @param {number} p00 The probability of X = 0 and Y = 0.
 * @param {number} p01 The probability of X = 0 and Y = 1.
 * @param {number} p10 The probability of X = 1 and Y = 0.
 * @param {number} p11 The probability of X = 1 and Y = 1.
 * @returns {(number|undefined)} The odds ratio if p01 and p10 are positive, undefined otherwise.
 * @example
 *
 * ran.dependence.oddsRatio(0.3, 0, 0.3, 0.4)
 * // => undefined
 *
 * ran.dependence.oddsRatio(0.3, 0.3, 0, 0.4)
 * // => undefined
 *
 * ran.dependence.oddsRatio(0.1, 0.2, 0.3, 0.4)
 * // => 0.6666666666666669
 */
function oddsRatio (p00, p01, p10, p11) {
  const denominator = p01 * p10;
  return denominator === 0 ? undefined : p00 * p11 / denominator
}

/**
 * Calculates the unbiased sample variance of an array of values using [Welford's algorithm]{@link https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance#Welford's_online_algorithm}.
 *
 * @method variance
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate variance for.
 * @returns {(number|undefined)} Variance of the values if there are more than two, undefined otherwise.
 * @example
 *
 * ran.dispersion.variance([])
 * // => undefined
 *
 * ran.dispersion.variance([1])
 * // => undefined
 *
 * ran.dispersion.variance([1, 2, 3])
 * // => 2.5
 */
function variance (values) {
  if (values.length > 1) {
    let n = 0;
    let diff = 0;
    let mean = 0;
    let M = 0;
    for (const x of values) {
      diff = x - mean;
      mean += diff / ++n;
      M += diff * (x - mean);
    }
    return M / (n - 1)
  }
}

/**
 * Calculates the unbiased standard deviation of an array of values.
 *
 * @method stdev
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate standard deviation for.
 * @returns {(number|undefined)} Standard deviation of the values if there are more than two, undefined otherwise.
 * @example
 *
 * ran.dispersion.stdev([])
 * // => undefined
 *
 * ran.dispersion.stdev([1])
 * // => undefined
 *
 * ran.dispersion.stdev([1, 2, 3, 4, 5])
 * // => 1.5811388300841898
 */
function stdev (values) {
  // TODO Check for undefined in unit test.
  const v = variance(values);
  return v && Math.abs(Math.sqrt(v))
}

/**
 * Calculates the [Pearson correlation coefficient]{@link https://en.wikipedia.org/wiki/Pearson_correlation_coefficient}
 * for paired arrays of values.
 *
 * @method pearson
 * @memberof ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values.
 * @returns {(number|undefined)} The Pearson correlation coefficient if none of the arrays are empty, they have the
 * same length and each has a positive variance, undefined otherwise.
 * @example
 *
 * ran.dependence.pearson([], [])
 * // => undefined
 *
 * ran.dependence.pearson([1, 2, 3], [1, 2, 3, 4])
 * // => undefined
 *
 * ran.dependence.pearson([1, 2, 3], [1, 1, 1])
 * // => undefined
 *
 * ran.dependence.pearson([1, 2, 3], [4, 5, 6])
 * // => 1
 *
 * ran.dependence.pearson([1, 9, 10], [1, 2, 10])
 * // => 0.6643835616438358
 */
function pearson (x, y) {
  // TODO Check if length is below 2.
  const cov = covariance(x, y);
  const sx = stdev(x);
  const sy = stdev(y);
  return typeof cov === 'undefined' || sx * sy === 0 ? undefined : cov / (sx * sy)
}

/**
 * Calculates the [point-biserial correlation coefficient]{@link https://en.wikipedia.org/wiki/Point-biserial_correlation_coefficient}
 * for paired arrays of values.
 *
 * @method pointBiserial
 * @memberof ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values. Must contain 0s and 1s only.
 * @returns {(number|undefined)} The point-biserial correlation coefficient if none of the arrays are empty, they have
 * the same length and each has a positive variance, undefined otherwise.
 * @example
 *
 * ran.dependence.pointBiserial([], [])
 * // => undefined
 *
 * ran.dependence.pointBiserial([1, 2, 3], [0, 0, 1, 1])
 * // => undefined
 *
 * ran.dependence.pointBiserial([2, 2, 2], [0, 0, 1])
 * // => undefined
 *
 * ran.dependence.pointBiserial([1, 2, 3], [4, 5, 6])
 * // => 0.8660254037844386
 */
function pointBiserial (x, y) {
  if (!validInputs(x, y)) {
    return undefined
  }

  const s = stdev(x);
  if (s === 0) {
    return undefined
  }

  const x0 = x.filter((d, i) => y[i] === 0);
  const x1 = x.filter((d, i) => y[i] === 1);
  const n0 = x0.length;
  const n1 = x1.length;
  const m0 = mean(x0);
  const m1 = mean(x1);
  return (m1 - m0) * Math.sqrt(n0 * n1 / (x.length * (x.length - 1))) / s
}

function validInputs (x, y) {
  return (x.length !== 0 &&
    y.length !== 0 &&
    x.length === y.length)
}

function tau (a, b) {
  return (concordant(a, b) - discordant(a, b)) / (a.length * (a.length - 1))
}

/**
 * Calculates [Somers' D]{@link https://en.wikipedia.org/wiki/Somers%27_D} for paired arrays of values.
 *
 * @method somersD
 * @memberof ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values.
 * @returns {(number|undefined)} Somers' D if none of the arrays are empty, they have the same length, undefined
 * otherwise.
 * @example
 *
 * ran.dependence.somersD([], [])
 * // => undefined
 *
 * ran.dependence.somersD([1, 2, 3], [1, 2, 3, 4])
 * // => undefined
 *
 * ran.dependence.somersD([1, 2, 3], [4, 6, 6])
 * // => 0.6666666666666666
 *
 * ran.dependence.somersD([1, 1, 0], [4, 5, 6])
 * // => -1
 */
function somersD (x, y) {
  if (isInvalidInput(x, y)) {
    return undefined
  }

  return tau(x, y) / tau(x, x)
}

function isInvalidInput (x, y) {
  return x.length === 0 || y.length === 0 || x.length !== y.length
}

/**
 * Calculates the fractional rank for an array of values.
 *
 * @method rank
 * @memberof ran.shape
 * @param {number[]} values Array of values to calculate ranks for.
 * @returns {(number|undefined)} The ranks of the values if there are any, undefined otherwise.
 * @example
 *
 * ran.shape.rank([])
 * // => undefined
 *
 * ran.shape.rank([1, 2, 2, 3])
 * // => [1, 2.5, 2.5, 4]
 */
function rank (values) {
  if (values.length === 0) {
    return undefined
  }

  const sorted = values.slice().sort((a, b) => a - b);
  const reversed = sorted.slice().reverse();
  return values.map(d => (sorted.indexOf(d) + 1 + reversed.length - reversed.indexOf(d)) / 2)
}

/**
 * Calculates [Spearman's rank correlation coefficient]{@link https://en.wikipedia.org/wiki/Spearman%27s_rank_correlation_coefficient}
 * for two paired arrays of values.
 *
 * @method spearman
 * @memberof ran.dependence
 * @param {number[]} x First array of values.
 * @param {number[]} y Second array of values.
 * @returns {(number|undefined)} Spearman's rank correlation coefficient if none of the arrays are empty and they have
 * the same length, undefined otherwise.
 * @example
 *
 * ran.dependence.spearman([], [])
 * // => undefined
 *
 * ran.dependence.spearman([1, 2, 3], [1, 2, 3, 4])
 * // => undefined
 *
 * ran.dependence.spearman([1, 2, 3], [1, 4, 2])
 * // => 0.5
 *
 * ran.dependence.spearman([1, 9, 10], [1, 2, 10])
 * // => 1
 */
function spearman (x, y) {
  if (!isValidInput(x, y)) {
    return undefined
  }

  return pearson(rank(x), rank(y))
}

function isValidInput (x, y) {
  return x.length !== 0 && y.length !== 0 && x.length === y.length
}

/**
 * Calculates [Yule's Q]{@link https://en.wikipedia.org/wiki/Goodman_and_Kruskal%27s_gamma#Yule's_Q} for the joint
 * probabilities of two binary variables:
 *
 * $$Q(p_{00}, p_{01}, p_{10}, p_{11}) = \frac{p_{00} p_{11} - p_{01} p_{10}}{p_{00} p_{11} + p_{01} p_{10}}.$$
 *
 * @method yuleQ
 * @memberof ran.dependence
 * @param {number} p00 The probability of X = 0 and Y = 0.
 * @param {number} p01 The probability of X = 0 and Y = 1.
 * @param {number} p10 The probability of X = 1 and Y = 0.
 * @param {number} p11 The probability of X = 1 and Y = 1.
 * @returns {(number|undefined)} Yule's Q if p01 and p10 are positive, undefined otherwise.
 * @example
 *
 * ran.dependence.yuleQ(0.3, 0, 0.3, 0.4)
 * // => undefined
 *
 * ran.dependence.yuleQ(0.3, 0.3, 0, 0.4)
 * // => undefined
 *
 * ran.dependence.yuleQ(0.1, 0.2, 0.3, 0.4)
 * // => -0.19999999999999984
 */
function yuleQ (p00, p01, p10, p11) {
  const or = oddsRatio(p00, p01, p10, p11);
  if (typeof or === 'undefined') {
    return undefined
  }

  return (or - 1) / (or + 1)
}

/**
 * Calculates [Yule's Y]{@link https://en.wikipedia.org/wiki/Coefficient_of_colligation} for the joint probabilities of
 * two binary variables:
 *
 * $$Y(p_{00}, p_{01}, p_{10}, p_{11}) = \frac{\sqrt{p_{00} p_{11}} - \sqrt{p_{01} p_{10}}}{\sqrt{p_{00} p_{11}} + \sqrt{p_{01} p_{10}}}.$$
 *
 * @method yuleY
 * @memberof ran.dependence
 * @param {number} p00 The probability of X = 0 and Y = 0.
 * @param {number} p01 The probability of X = 0 and Y = 1.
 * @param {number} p10 The probability of X = 1 and Y = 0.
 * @param {number} p11 The probability of X = 1 and Y = 1.
 * @returns {(number|undefined)} Yule's Y if p01 and p10 are positive, undefined otherwise.
 * @example
 *
 * ran.dependence.yuleY(0.3, 0, 0.3, 0.4)
 * // => undefined
 *
 * ran.dependence.yuleY(0.3, 0.3, 0, 0.4)
 * // => undefined
 *
 * ran.dependence.yuleY(0.1, 0.2, 0.3, 0.4)
 * // => -0.10102051443364372
 */
function yuleY (p00, p01, p10, p11) {
  const or = oddsRatio(p00, p01, p10, p11);
  if (typeof or === 'undefined') {
    return undefined
  }

  const sqrtOr = Math.sqrt(or);
  return (sqrtOr - 1) / (sqrtOr + 1)
}

/**
 * Namespaces containing various dependence metrics.
 *
 * @namespace dependence
 * @memberof ran
 */

var index$4 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  covariance: covariance,
  dCor: distanceCorrelation,
  dCov: distanceCovariance,
  kendall: kendall,
  kullbackLeibler: kullbackLeibler,
  oddsRatio: oddsRatio,
  pearson: pearson,
  pointBiserial: pointBiserial,
  somersD: somersD,
  spearman: spearman,
  yuleQ: yuleQ,
  yuleY: yuleY
});

/**
 * Calculates the [coefficient of variation]{@link https://en.wikipedia.org/wiki/Coefficient_of_variation} of an array
 * of values.
 *
 * @method cv
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate coefficient of variation for.
 * @returns {(number|undefined)} Coefficient of variation of the values if there are more than two and the mean is not
 * zero, undefined otherwise.
 * @example
 *
 * ran.dispersion.cv([])
 * // => undefined
 *
 * ran.dispersion.cv([1])
 * // => undefined
 *
 * ran.dispersion.cv([-1, 0, 1])
 * // => undefined
 *
 * ran.dispersion.cv([1, 2, 3, 4, 5])
 * // => 0.5270462766947299
 */
function cv (values) {
  const s = stdev(values);
  const m = mean(values);
  return m === 0 ? undefined : s && s / m
}

/**
 * Calculates the [distance variance]{@link https://en.wikipedia.org/wiki/Distance_correlation#Distance_variance} for
 * paired arrays of values.
 *
 * @method dVar
 * @memberof ran.dispersion
 * @param {number[]} x Array of values.
 * @returns {(number|undefined)} The distance variance if the array os not empty, undefined otherwise.
 * @example
 *
 * ran.dependence.dVar([])
 * // => undefined
 *
 * ran.dependence.dVar([1, 2, 3])
 * // => 0.7027283689263066
 */
function distanceVariance (x) {
  if (x.length === 0) {
    return undefined
  }

  // Calculate distance matrix.
  const a = distanceMatrix(x);
  return Math.sqrt(mean([].concat(...a.hadamard(a).m())))
}

function _log (base) {
  const logBase = typeof base === 'undefined' ? 1 : Math.log(base);
  return x => Math.log(x) / logBase
}

/**
 * Calculates the [Shannon entropy]{@link https://en.wikipedia.org/wiki/Entropy_(information_theory)} for a probability
 * distribution.
 *
 * @method entropy
 * @memberof ran.dispersion
 * @param {number[]} probabilities Array representing the probabilities for the i-th value.
 * @param {number=} base Base for the logarithm. If not specified, natural logarithm is used.
 * @returns {(number|undefined)} Entropy of the probabilities if there are any, undefined otherwise.
 * @example
 *
 * ran.dispersion.entropy([])
 * // => undefined
 *
 * ran.dispersion.entropy([0.1, 0.1, 0.8])
 * // => 0.639031859650177
 *
 * ran.dispersion.entropy([0.3, 0.3, 0.4])
 * // => 1.0888999753452238
 */
function entropy (probabilities, base) {
  if (probabilities.length === 0) {
    return undefined
  }

  // Create logarithm using the specified base.
  const logFunc = _log(base);

  // Return the sum using the accurate Neumaier summation.
  return -neumaier(probabilities.map(d => d * logFunc(d)))
}

/**
 * Calculates the [mean absolute difference]{@link https://en.wikipedia.org/wiki/Mean_absolute_difference} of an array
 * of values.
 *
 * @method md
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate mean absolute difference for.
 * @returns {(number|undefined)} Mean absolute difference of the values if there are more than two, undefined otherwise.
 * @example
 *
 * ran.dispersion.md([])
 * // => undefined
 *
 * ran.dispersion.md([1])
 * // => undefined
 *
 * ran.dispersion.md([1, 2, 3, 4])
 * // => 1.25
 */
function md (values) {
  if (values.length < 2) {
    return undefined
  }

  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    for (let j = 0; j < values.length; j++) {
      if (j > i) {
        sum += Math.abs(values[i] - values[j]);
      }
    }
  }
  return 2 * sum / (values.length * values.length)
}

/**
 * Calculates the [relative mean absolute difference]{@link https://en.wikipedia.org/wiki/Mean_absolute_difference#Relative_mean_absolute_difference} of an array of values.
 *
 * @method rmd
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate relative mean absolute difference for.
 * @returns {(number|undefined)} Relative mean absolute difference of the values if there are more than two, undefined
 * otherwise.
 * @example
 *
 * ran.dispersion.rmd([])
 * // => undefined
 *
 * ran.dispersion.rmd([1])
 * // => undefined
 *
 * ran.dispersion.rmd([-1, 0, 1])
 * // => undefined
 *
 * ran.dispersion.rmd([1, 2, 3, 4])
 * // => 0.5
 */
function rmd (values) {
  const mad = md(values);
  const m = mean(values);
  return m === 0 ? undefined : mad && mad / m
}

/**
 * Calculates the [Gini coefficient]{@link https://en.wikipedia.org/wiki/Gini_coefficient} for a sample of values.
 *
 * @method gini
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate the Gini coefficient for.
 * @return {(number|undefined)} The Gini coefficient of the values if there are more than one, undefined otherwise.
 * @example
 *
 * ran.dispersion.gini([])
 * // => undefined
 *
 * ran.dispersion.gini([1])
 * // => undefined
 *
 * ran.dispersion.gini([-1, 0, 1])
 * // => undefined
 *
 * ran.dispersion.gini([1, 2, 3, 4])
 * // => 0.25
 *
 * ran.dispersion.gini([1, 1, 1, 7])
 * // => 0.45
 */
function gini (values) {
  const r = rmd(values);
  return r && r / 2
}

/**
 * Calculates the [interquartile range]{@link https://en.wikipedia.org/wiki/Interquartile_range} for a sample of values.
 *
 * @method iqr
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate the interquartile range for.
 * @return {(number|undefined)} The interquartile range of the values if there is any, undefined otherwise.
 * @example
 *
 * ran.dispersion.iqr([])
 * // => undefined
 *
 * ran.dispersion.iqr([1, 1, 2, 3, 3])
 * // => 2
 */
function iqr (values) {
  if (values.length === 0) {
    return undefined
  }

  return quantile(values, 0.75) - quantile(values, 0.25)
}

/**
 * Calculates the [midhinge]{@link https://en.wikipedia.org/wiki/Midhinge} for a sample of values.
 *
 * @method midhinge
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate midhinge for.
 * @returns {(number|undefined)} The midhinge of the values if there is any, undefined otherwise.
 * @example
 *
 * ran.dispersion.midhinge([])
 * // => undefined
 *
 * ran.dispersion.midhinge([1, 1, 1, 2, 3])
 * // => 1.5
 */
function midhinge (values) {
  if (values.length === 0) {
    return undefined
  }

  return (quantile(values, 0.25) + quantile(values, 0.75)) / 2
}

function max (values) {
  let max = values[0];
  for (const x of values) {
    max = Math.max(x, max);
  }
  return max
}

function min (values) {
  let min = values[0];
  for (const x of values) {
    min = Math.min(x, min);
  }
  return min
}

/**
 * Calculates the [range]{@link https://en.wikipedia.org/wiki/Range_(statistics)} for a sample of values.
 *
 * @method range
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate range for.
 * @return {(number|undefined)} The range of the values if there is any, undefined otherwise.
 * @example
 *
 * ran.dispersion.range([])
 * // => undefined
 *
 * ran.dispersion.range([0, 1, 2, 2])
 * // => 2
 */
function range (values) {
  if (values.length === 0) {
    return undefined
  }

  return max(values) - min(values)
}

/**
 * Calculates the [quartile coefficient of dispersion]{@link https://en.wikipedia.org/wiki/Quartile_coefficient_of_dispersion}
 * for a sample of values.
 *
 * @method qcd
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate quartile coefficient of dispersion for.
 * @return {(number|undefined)} The quartile coefficient of dispersion of the values if there is any, undefined
 * otherwise.
 * @example
 *
 * ran.dispersion.qcd([])
 * // => undefined
 *
 * ran.dispersion.qcd([1, 2, 3])
 * // => 0.25
 */
function qcd (values) {
  if (values.length === 0) {
    return undefined
  }

  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  return (q3 - q1) / (q1 + q3)
}

/**
 * Calculates the [variance-to-mean ratio]{@link https://en.wikipedia.org/wiki/Index_of_dispersion} of an array
 * of values.
 *
 * @method vmr
 * @memberof ran.dispersion
 * @param {number[]} values Array of values to calculate variance-to-mean ratio for.
 * @returns {(number|undefined)} Variance-to-mean ratio of the values if there are more than two and the mean is not
 * zero, undefined otherwise.
 * @example
 *
 * ran.dispersion.vmr([])
 * // => undefined
 *
 * ran.dispersion.vmr([1])
 * // => undefined
 *
 * ran.dispersion.vmr([-1, 0, 1])
 * // => undefined
 *
 * ran.dispersion.vmr([1, 2, 3, 4, 5])
 * // => 0.8333333333333334
 */
function vmr (values) {
  const v = variance(values);
  const m = mean(values);
  return m === 0 ? undefined : v && v / m
}

/**
 * Namespaces containing various dispersion metrics.
 *
 * @namespace dispersion
 * @memberof ran
 */

var index$3 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  cv: cv,
  dVar: distanceVariance,
  entropy: entropy,
  gini: gini,
  iqr: iqr,
  md: md,
  midhinge: midhinge,
  qcd: qcd,
  range: range,
  rmd: rmd,
  stdev: stdev,
  variance: variance,
  vmr: vmr
});

/**
 * Table containing critical values for the chi square test at 99% of confidence for low degrees of freedom.
 *
 * @var {number[]} _CHI_TABLE_LO
 * @memberof ran.dist
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
];

/**
 * Table containing critical values for the chi square test at 99% of confidence for high degrees of freedom.
 *
 * @var {number[]} _CHI_TABLE_HI
 * @memberof ran.dist
 * @private
 */
const _CHI_TABLE_HI = [
  359.906, 414.474, 468.724, 522.717, 576.493, 630.084, 683.516, 736.807, 789.974, 843.029,
  895.984, 948.848, 1001.630, 1054.334, 1106.969
];

/**
 * Performs a chi square test for an array of values and a probability mass function.
 *
 * @method chi2
 * @memberof ran.dist
 * @param values {number[]} Array of values to perform test for.
 * @param pmf {Function} Probability mass function to perform test against.
 * @param c {number} Number of parameters for the distribution.
 * @returns {{statistics: number, passed: boolean}} Test results, containing the raw chi square statistics and a
 * boolean to tell whether the distribution passed the test.
 * @private
 */
function chi2$1 (values, pmf, c) {
  // Calculate observed distribution
  const p = new Map();
  values.forEach(function (v) {
    p.set(v, p.has(v) ? p.get(v) + 1 : 1);
  });

  // Calculate chi-square
  let chi2 = 0;
  let bin = 0;
  let pBin = 0;
  let k = 0;
  p.forEach((px, x) => {
    // Add frequency to current bin
    bin += pmf(parseInt(x)) * values.length;
    pBin += px;

    // If bin count is above 20 (for central limit theorem), consider this a class and clear bin
    if (bin > 20) {
      chi2 += Math.pow(pBin - bin, 2) / bin;
      bin = 0;
      pBin = 0;
      k++;
    }
  });

  // Get critical value
  const df = Math.max(1, k - c - 1);

  const crit = df <= 250 ? _CHI_TABLE_LO[df] : _CHI_TABLE_HI[Math.floor(df / 50)];

  // Return comparison results
  return {
    statistics: chi2,
    passed: chi2 <= crit
  }
}

/**
 * Performs a Kolmogorov-Smirnov test for an array of values and a cumulative distribution function.
 *
 * @method kolmogorovSmirnov
 * @memberof ran.dist
 * @param values {number[]} Array of values to perform test for.
 * @param cdf {Function} Cumulative distribution function to perform test against.
 * @returns {{statistics: number, passed: boolean}} Test results, containing the raw K-S statistics and a
 * boolean to tell whether the distribution passed the test.
 * @private
 */
function kolmogorovSmirnov (values, cdf) {
  // Sort values for estimated CDF
  values.sort((a, b) => a - b);

  // Calculate D value
  let D = 0;
  for (let i = 0; i < values.length; i++) {
    D = Math.max(D, Math.abs((i + 1) / values.length - cdf(values[i])));
  }

  // Return comparison results
  return {
    statistics: D,
    passed: D <= 1.628 / Math.sqrt(values.length)
  }
}

/**
 * The distribution generator base class, all distribution generators extend this class. The methods listed here
 * are available for all distribution generators. Integer parameters of a distribution are rounded. The examples provided for this class are using a Pareto
 * distribution.
 *
 * @class Distribution
 * @memberof ran.dist
 * @constructor
 */
class Distribution {
  constructor (type, k) {
    // Distribution type: discrete or continuous
    this.t = type;

    // Number of parameters
    this.k = k;

    // The parameters
    this.p = {};

    // Distribution support
    this.s = [];

    // Pseudo random number generator
    this.r = new Xoshiro128p();

    // Speed-up constants
    this.c = [];
  }

  /**
   * Validates a set of parameters using a list of constraints.
   *
   * @method validate
   * @memberof Distribution
   * @param {Object} params Object containing the parameters to validate.
   * @param {string[]} constraints Array of strings defining the parameter constraints.
   * @throws {Error} If any of the parameters don't satisfy the constraints.
   * @ignore
   */
  static validate (params, constraints) {
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
        default:
          return false
      }
    });

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
    return this.t === 'discrete' ? Math.round(x) : x
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
   * @returns {number} The lower boundary of the interval that satisfies F(x) = p if found, undefined otherwise.
   * @protected
   * @ignore
   */
  _qEstimateTable (p) {
    // Find upper bound
    let k1 = 0;
    let k2 = 0;
    let delta = 1;
    for (let i = 0; i < MAX_ITER; i++) {
      const q = this.cdf(k2);
      if (q >= p) {
        break
      }

      k1 = k2;
      k2 += delta;
      delta = Math.ceil(1.618 * delta);
    }

    // Find quantile within bracket
    for (let i = 0; i < MAX_ITER; i++) {
      if (k2 - k1 <= 1) {
        return k2
      }

      const k = Math.floor((k1 + k2) / 2);
      const q = this.cdf(k);
      if (p > q) {
        k1 = k;
      } else {
        k2 = k;
      }
    }
  }

  /**
   * Estimates the quantile function by solving F(x) = p using Brent's method.
   *
   * @method _qEstimateRoot
   * @memberof ran.dist.Distribution
   * @param {number} p Probability to find value for.
   * @returns {(number|undefined)} The value where the probability coincides with the specified value if found,
   * undefined otherwise.
   * @protected
   * @ignore
   */
  _qEstimateRoot (p) {
    // Guess range.
    const delta = ((Number.isFinite(this.s[1].value) ? this.s[1].value : 10) -
      (Number.isFinite(this.s[0].value) ? this.s[0].value : -10)) / 2;

    // Set initial guess for lower boundary.
    let a0 = Math.random();
    if (this.s[0].closed) {
      a0 = this.s[0].value + Number.EPSILON;
    } else if (Number.isFinite(this.s[0].value)) {
      a0 = this.s[0].value + delta * Math.random();
    }

    // Set initial guess for upper boundary.
    let b0 = a0 + Math.random();
    if (this.s[1].closed) {
      b0 = this.s[1].value - Number.EPSILON;
    } else if (Number.isFinite(this.s[1].value)) {
      b0 = this.s[1].value - delta * Math.random();
    }

    // Find brackets.
    const bounds = bracket(t => this.cdf(t) - p, a0, b0, this.s);

    // Perform root-finding using Brent's method.
    if (typeof bounds !== 'undefined') {
      return Math.min(Math.max(
        brent(t => this.cdf(t) - p, ...bounds), this.s[0].value), this.s[1].value
      )
    }
  }

  /**
   * Returns the type of the distribution (either discrete or continuous).
   *
   * @method type
   * @memberof ran.dist.Distribution
   * @returns {string} Distribution type.
   */
  type () {
    return this.t
  }

  /**
   * Returns the support of the probability distribution (based on the current parameters). Note that the support
   * for the probability distribution is not necessarily the same as the support of the cumulative distribution.
   *
   * @method support
   * @memberof ran.dist.Distribution
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
   * @memberof ran.dist.Distribution
   * @param {(number|string)} value The value of the seed, either a number or a string (for the ease of tracking seeds).
   * @returns {ran.dist.Distribution} Reference to the current distribution.
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
    this.r.seed(value);
    return this
  }

  /**
   * Returns the current state of the generator. The object returned by this method contains all information necessary
   * to set up another generator of the same distribution (parameters, state of the pseudo random generator, etc).
   *
   * @method save
   * @memberof ran.dist.Distribution
   * @return {Object} Object representing the inner state of the current generator.
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
   * @returns {ran.dist.Distribution} Reference to the current distribution.
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
    this.p = state.params;

    // Set helper constants
    this.c = state.constants;

    // Set support
    this.s = state.support;

    // Set PRNG state
    this.r.load(state.prngState);

    return this
  }

  /**
   * Generates some random variate.
   *
   * @method sample
   * @memberof ran.dist.Distribution
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
    const z = this._toInt(x);

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
    const z = this._toInt(x);

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
   * @returns {(number|undefined)} The value of the quantile function at the specified probability if $p \in [0, 1]$ and the quantile could be found,
   * undefined otherwise.
   */
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
      // If quantile function is implemented, use that, otherwise use the estimators: look-up table for discrete and
      // root-finder for continuous
      return typeof this._q === 'function'
        ? this._q(p)
        : this.t === 'discrete'
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
    return Math.log(this._pdf(x))
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
   * @returns {Object} Object with two properties representing the result of the test:
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
    return this.t === 'discrete'
      ? chi2$1(values, x => this.pdf(x), this.k)
      : kolmogorovSmirnov(values, x => this.cdf(x))
  }
}

/**
 * Generator of an invalid (not implemented) distribution. Only for testing purposes.
 *
 * @class InvalidDiscrete
 * @memberof ran.dist
 * @private
 */
class _invalid extends Distribution {
  constructor () {
    super('discrete', arguments.length);
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }
}

// Coefficients
const coeffs = [
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.6150291621406,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7
];
const SQRT_PI2 = Math.sqrt(2 * Math.PI);

/**
   * Gamma function, using the Lanczos approximation.
   *
   * @method gamma
   * @memberof ran.special
   * @param {number} z Value to evaluate Gamma function at.
   * @returns {number} Gamma function value.
   * @private
   */
function _gamma (z) {
  let y;
  if (z < 0.5) {
    y = Math.PI / (Math.sin(Math.PI * z) * _gamma(1 - z));
  } else {
    z--;
    let x = 0.99999999999980993;

    const l = coeffs.length;
    coeffs.forEach((c, i) => {
      x += c / (z + i + 1);
    });
    const t = z + l - 0.5;
    y = SQRT_PI2 * Math.pow(t, (z + 0.5)) * Math.exp(-t) * x;
  }
  return y
}

/**
 * Computes the modified Bessel function of the first kind with order zero.
 * This algorithm simply applies the definition:
 * https://en.wikipedia.org/wiki/Bessel_function#Modified_Bessel_functions:_I%CE%B1,_K%CE%B1
 *
 * @method _I0
 * @memberof ran.special
 * @param {number} x Value to evaluate the function at.
 * @return {number} The function value.
 * @private
 */
function _I0 (x) {
  let dz = 1;
  let z = dz;
  for (let m = 1; m < MAX_ITER; m++) {
    dz *= (x / 2) ** 2 / m ** 2;
    z += dz;
    if (Math.abs(dz / z) < EPS) { break }
  }
  return z
}

/**
 * Computes the modified Bessel function of the first kind with order one.
 *
 * @method _I1
 * @memberof ran.special
 * @param {number} x Value to evaluate the function at.
 * @return {number} The function value.
 * @private
 */
function _I1 (x) {
  const y = Math.abs(x);
  let z;
  let t;

  if (y < 3.75) {
    t = x / 3.75;
    t *= t;
    z = y * (0.5 + t * (0.87890594 + t * (0.51498869 + t * (0.15084934 + t * (0.2658733e-1 + t * (0.301532e-2 + t * 0.32411e-3))))));
  } else {
    t = 3.75 / y;
    z = 0.2282967e-1 + t * (-0.02895312 + t * (0.1787654e-1 - t * 0.420059e-2));
    z = 0.39894228 + t * (-0.03988024 + t * (-362018e-8 + t * (0.163801e-2 + t * (-0.01031555 + t * z))));
    z *= Math.exp(y) / Math.sqrt(y);
  }
  return x < 0 ? -z : z
}

/**
 * Computes the modified spherical Bessel function of the second kind.
 *
 * @method _kn
 * @memberof ran.special
 * @param {number} n Order of the Bessel function.
 * @param {number} x Value to evaluate the function at.
 * @return {(number|number[])} The function value at the specified order and one order less if order is larger than 1, single function value otherwise.
 * @private
 */
function _kn (n, x) {
  // Upwards recurrence relation
  let k1 = 1 + 1 / x;
  let k2 = 1;
  let k;
  for (let i = 2; i <= n; i++) {
    k = (i + i - 1) * k1 / x + k2;
    k2 = k1;
    k1 = k;
  }
  return [
    Math.exp(-x) * k / x,
    Math.exp(-x) * k2 / x
  ]
}

/**
 * Computes the ratio of two modified Bessel functions (same for spherical).
 *
 * @method _hi
 * @memberof ran.special
 * @param {number} n Order of the Bessel function in the numerator.
 * @param {number} x Value to evaluate the function at.
 * @return {number} The function value.
 * @private
 */
function _hi (n, x) {
  // Continued fraction (from Numerical methods for special functions)
  let d = x / (n + n + 1);
  let del = d;
  let h = del;
  let b = (n + n + 3) / x;
  for (let i = 1; i < MAX_ITER; i++) {
    d = 1 / (b + d);
    del = (b * d - 1) * del;
    h += del;
    b += 2 / x;

    if (Math.abs(del / h) < EPS) { break }
  }
  return h
}

/**
 * Computes the modified Bessel function of the first kind. Only integer order.
 *
 * @method besselI
 * @memberof ran.special
 * @param {number} n Order of the Bessel function. Must be an integer.
 * @param {number} x Value to evaluate the function at.
 * @return {number} The modified Bessel function of the first kind.
 * @private
 */
function besselI (n, x) {
  let bi;
  let bim;
  let bip;
  let y;

  if (n === 0) {
    return _I0(x)
  }

  if (n === 1) {
    return _I1(x)
  }

  if (x === 0) {
    return 0
  }

  const tox = 2 / Math.abs(x);
  bip = 0;
  y = 0;
  bi = 1;
  for (let j = 2 * (n + Math.round(Math.sqrt(40 * n))); j > 0; j--) {
    bim = bip + j * tox * bi;
    bip = bi;
    bi = bim;
    if (Math.abs(bi) > 1 / EPS) {
      y *= EPS;
      bi *= EPS;
      bip *= EPS;
    }
    if (j === n) {
      y = bip;
    }
  }
  y *= _I0(x) / bi;
  return y
}

/**
 * Computes the modified spherical Bessel function of the first kind. Only integer order is supported.
 * Source: http://cpc.cs.qub.ac.uk/summaries/ADGM_v1_0.html (Numerical methods for special functions).
 *
 * @method besselISpherical
 * @memberof ran.special
 * @param {number} n Order of the spherical Bessel function. Must be an integer.
 * @param {number} x Value to evaluate the function at.
 * @returns {number} The modified spherical Bessel function of the first kind.
 * @private
 */
function besselISpherical (n, x) {
  switch (n) {
    case 0:
      // i0 separately
      return x === 0 ? 1 : Math.sinh(x) / x
    case 1:
      // i1 separately
      return x === 0 ? 0 : (Math.cosh(x) - Math.sinh(x) / x) / x
    default:
      if (n > 0) {
        // Use Wronskian with single run k-calculation
        const k = _kn(n + 1, x);
        return x === 0 ? 0 : 1 / (x * x * (_hi(n + 1, x) * k[1] + k[0]))
      } else {
        // Backward recurrence for negative orders
        return (n + n + 3) * besselISpherical(n + 1, x) / x + besselISpherical(n + 2, x)
      }
  }
}

/* eslint no-loss-of-precision: 0 */

// Coefficients
const COEFFS = [
  76.18009172947146,
  -86.50532032941678,
  24.01409824083091,
  -1.231739572450155,
  0.1208650973866179e-2,
  -5395239384953e-18
];

/**
   * Computes the logarithm of the gamma function for positive arguments.
   *
   * @method logGamma
   * @memberof ran.special
   * @param {number} z Value to evaluate log(gamma) at.
   * @returns {number} The log(gamma) value.
   * @private
   */
function logGamma$1 (z) {
  const x = z;

  let y = z;

  let res = x + 5.5;
  res = (x + 0.5) * Math.log(res) - res;
  let sum = 1.000000000190015;
  for (let j = 0; j < 6; j++) {
    y++;
    sum += COEFFS[j] / y;
  }
  return res + Math.log(2.5066282746310005 * sum / x)
}

/**
 * Beta function.
 *
 * @method beta
 * @memberof ran.special
 * @param {number} x First argument.
 * @param {number} y Second argument.
 * @returns {number} The value of the beta function.
 * @private
 */
function beta (x, y) {
  return Math.exp(logGamma$1(x) + logGamma$1(y) - logGamma$1(x + y))
}

// Incomplete beta generator using the continued fraction expansion
function _biContinuedFraction (a, b, x) {
  const qab = a + b;

  const qap = a + 1;

  const qam = a - 1;

  let c = 1;

  let d = 1 - qab * x / qap;
  d = Math.max(Math.abs(d), DELTA);
  d = 1 / d;
  let h = d;

  for (let i = 1; i < MAX_ITER; i++) {
    const m2 = 2 * i;

    let aa = i * (b - i) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    d = Math.max(Math.abs(d), DELTA);
    c = 1 + aa / c;
    c = Math.max(Math.abs(c), DELTA);
    d = 1 / d;
    h *= d * c;
    aa = -(a + i) * (qab + i) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    d = Math.max(Math.abs(d), DELTA);
    c = 1 + aa / c;
    c = Math.max(Math.abs(c), DELTA);
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) { break }
  }
  return h
}

/**
 * Incomplete beta function.
 *
 * @method betaIncomplete
 * @memberof ran.special
 * @param {number} a First parameter of the function.
 * @param {number} b Second parameter of the function.
 * @param {number} x Upper boundary of the integral.
 * @returns {number} Value of the incomplete beta function.
 * @private
 */
function betaIncomplete (a, b, x) {
  const bt = (x <= 0 || x >= 1)
    ? 0
    : Math.exp(a * Math.log(x) + b * Math.log(1 - x));
  // Use I(b, a, x) only if b != 0
  return a !== 0 && (x < (a + 1) / (a + b + 2) || b === 0)
    ? bt * _biContinuedFraction(a, b, x) / a
    : 1 - bt * _biContinuedFraction(b, a, 1 - x) / b
}

/**
   * Regularized incomplete beta function.
   *
   * @method regularizedBetaIncomplete
   * @memberof ran.special
   * @param {number} a First parameter of the function.
   * @param {number} b Second parameter of the function.
   * @param {number} x Upper boundary of the integral.
   * @returns {number} Value of the incomplete beta function.
   * @private
   */
function regularizedBetaIncomplete (a, b, x) {
  const bt = (x <= 0 || x >= 1)
    ? 0
    : Math.exp(logGamma$1(a + b) - logGamma$1(a) - logGamma$1(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? bt * _biContinuedFraction(a, b, x) / a
    : 1 - bt * _biContinuedFraction(b, a, 1 - x) / b
}

/**
 * Computes the regularized lower incomplete gamma function.
 *
 * @method _gli
 * @memberof ran.special
 * @param {number} s Exponent of the integrand.
 * @param {number} x Upper boundary of the integration.
 * @return {number} The regularized lower incomplete gamma function.
 * @private
 */
function _gli (s, x) {
  if (x < 0) {
    return 0
  } else {
    let si = s;

    let y = 1 / s;

    let f = y;
    for (let i = 0; i < MAX_ITER; i++) {
      si++;
      y *= x / si;
      f += y;
      if (Math.abs(y) < Math.abs(f) * EPS) {
        break
      }
    }
    return f * Math.exp(-x + s * Math.log(x) - logGamma$1(s))
  }
}

/**
 * Computes the regularized upper incomplete gamma function.
 *
 * @method _gui
 * @memberof ran.special
 * @param {number} s Exponent of the integrand.
 * @param {number} x Lower boundary of the integration.
 * @return {number} The regularized upper incomplete gamma function.
 * @private
 */
function _gui (s, x) {
  let b = x + 1 - s;

  let c = 1 / DELTA;

  let d = 1 / b;

  let f = d;

  let fi;
  let y;
  for (let i = 1; i < MAX_ITER; i++) {
    fi = i * (s - i);
    b += 2;
    d = fi * d + b;
    d = Math.max(Math.abs(d), DELTA);
    d = 1 / d;
    c = b + fi / c;
    c = Math.max(Math.abs(c), DELTA);
    y = c * d;
    f *= y;
    if (Math.abs(y - 1) < EPS) {
      break
    }
  }
  return f * Math.exp(-x + s * Math.log(x) - logGamma$1(s))
}

/**
 * Computes the regularized lower incomplete gamma function.
 *
 * @method gammaLowerIncomplete
 * @memberof ran.special
 * @param {number} s Exponent of the integrand.
 * @param {number} x Upper boundary of the integration.
 * @return {number} The regularized lower incomplete gamma function.
 * @private
 */
function gammaLowerIncomplete (s, x) {
  return x < s + 1 ? _gli(s, x) : 1 - _gui(s, x)
}

/**
 * Computes the regularized upper incomplete gamma function.
 *
 * @method gammaUpperIncomplete
 * @memberof ran.special
 * @param {number} s Exponent of the integrand.
 * @param {number} x Lower boundary of the integration.
 * @return {number} The regularized upper incomplete gamma function.
 * @private
 */
function gammaUpperIncomplete (s, x) {
  return x < s + 1 ? 1 - _gli(s, x) : _gui(s, x)
}

const CErfInv = [
  0.0833333333333333,
  0.0145833333333333,
  0.0031498015873016,
  0.00075248704806,
  0.0001907475361251
];

/**
 * Computes the error function.
 *
 * @method erf
 * @memberof ran.special
 * @param {number} x Value to evaluate the error function at.
 * @returns {number} Error function value.
 * @private
 */
function erf (x) {
  // TODO Replace with continued fraction
  return x < 0
    ? -gammaLowerIncomplete(0.5, x * x)
    : gammaLowerIncomplete(0.5, x * x)
}

/**
 * Computes the complementary error function.
 *
 * @method erfc
 * @memberof ran.special
 * @param {number} x Value to evaluate the complementary error function at.
 * @returns {number} Complementary error function value.
 * @private
 */
function erfc (x) {
  // TODO Replace with continued fraction
  return x < 0
    ? 1 + gammaLowerIncomplete(0.5, x * x)
    : gammaUpperIncomplete(0.5, x * x)
}

/**
 * Computes the inverse error function.
 *
 * @method erfinv
 * @memberof ran.special
 * @param {number} x Value to evaluate the inverse error function at.
 * @return {number} The inverse error function value.
 * @private
 */
function erfinv (x) {
  // Estimate initial guess using the polynomial
  let x0 = 0;
  const x2 = x * x;
  let c = 0.5 * Math.pow(Math.PI, 5.5);
  for (let i = CErfInv.length - 1; i >= 0; i--) {
    x0 = (x0 + CErfInv[i] * c) * x2;
    c /= Math.PI;
  }
  x0 = (x0 + 1) * x;

  // Polish with Newton's method
  return newton(
    t => erf(t) - x,
    t => 2 * Math.exp(-t * t) / Math.sqrt(Math.PI),
    x0
  )
}

/**
 * Computes Riemann zeta function (only real values outside the critical strip) using the alternating series.
 * Source: https://projecteuclid.org/download/pdf_1/euclid.em/1046889587
 *
 * @method riemannZeta
 * @memberof ran.special
 * @param {number} s Value to evaluate Riemann zeta at.
 * @return {number} Value of the Riemann zeta function.
 * @private
 */
function riemannZeta (s) {
  const z = acceleratedSum(k => Math.pow(k + 1, -s));
  return z / (1 - Math.pow(2, 1 - s))
}

/**
 * The first couple of even indexed Bernoulli numbers starting at B_2.
 *
 * @var {number[]} B
 * @memberof ran.constants
 * @private
 */
const B2k = [
  0.16666666666666666,
  -0.03333333333333333,
  0.023809523809523808,
  -0.03333333333333333,
  0.07575757575757576,
  -0.2531135531135531,
  1.1666666666666667,
  -7.092156862745098,
  54.971177944862156,
  -529.1242424242424,
  6192.123188405797,
  -86580.25311355312,
  1425517.1666666667,
  -27298231.067816094,
  601580873.9006424,
  -15116315767.092157,
  429614643061.1667,
  -13711655205088.334
];

/**
 * Computes the Hurwitz zeta function (only real values outside the critical strip) using the alternating series.
 * Source: https://projecteuclid.org/download/pdf_1/euclid.em/1046889587
 *
 * @method hurwitzZeta
 * @memberof ran.special
 * @param {number} s Exponent.
 * @param {number} a Shift.
 * @return {number} Value of the Hurwitz zeta function.
 * @private
 */
function hurwitzZeta (s, a) {
  const n = 20;

  // First sum
  let z = 0;
  for (let k = 0; k <= n; k++) {
    z += Math.pow(a + k, -s);
  }
  z += Math.pow(a + n, 1 - s) / (s - 1) - 0.5 / Math.pow(a + n, s);

  // Second sum
  let c = 1;
  for (let k = 1; k < B2k.length; k++) {
    // Update coefficient
    let m = logGamma$1(s + 4 * k - 3) - logGamma$1(s + 2 * k - 2);
    m -= (s + 2 * k - 1) * Math.log(a + n);
    m -= logGamma$1(2 * k + 1);
    c *= B2k[k - 1] * Math.exp(m);

    // Increment sum
    z += c;

    // Stop if precision achieved
    if (Math.abs(c / z) < EPS) { break }
  }

  return z
}

/**
 * Computes the generalized harmonic number H(n, m).
 *
 * @method generalizedHarmonic
 * @memberof ran.special
 * @param {number} n Number of terms in the sum.
 * @param {number} m Exponent of the sum.
 * @return {number} The generalized harmonic number H(n, m).
 * @private
 */
function generalizedHarmonic (n, m) {
  if (n < 20) {
    // If n is small, just calculate it exactly.
    let z = 0;
    for (let k = 1; k <= n; k++) {
      z += 1 / k ** m;
    }
    return z
  }

  // Otherwise use the zeta functions.
  return riemannZeta(m) - hurwitzZeta(m, n + 1)
}

// TODO Implementation: https://people.maths.ox.ac.uk/porterm/papers/hypergeometric-final.pdf

/* function _isInteger (x) {
  return Math.abs(Math.floor(x) - x) < Number.EPSILON
} */

function _f11TaylorSeries (a, b, z) {
  // Replace with faster method (Method b)
  return 1 + recursiveSum({
    a: a * z / b
  }, (t, i) => {
    t.a *= (a + i) * z / ((b + i) * (i + 1));
    return t
  }, t => t.a)
}

function _f11AsymptoticSeries (a, b, z) {
  const s = 1 + recursiveSum({
    c: (b - a) * (1 - a) / z
  }, (t, i) => {
    t.c *= (b - a + i) * (1 - a + i) / ((i + 1) * z);
    return t
  }, t => t.c);
  return Math.exp(z + (a - b) * Math.log(z) + logGamma$1(b) - logGamma$1(a)) * s
}

/* function _f21TaylorSeries (a, b, c, z) {
  return 1 + recursiveSum({
    c: a * b * z / c
  }, (t, i) => {
    t.c *= (a + i) * (b + i) * z / ((c + i) * (i + 1))
    return t
  }, t => t.c)
} */

function f11 (a, b, z) {
  // Special cases
  if (Math.abs(a) < Number.EPSILON) {
    return 1
  }

  if (Math.abs(z) < 50) {
    return _f11TaylorSeries(a, b, z)
  } else {
    return _f11AsymptoticSeries(a, b, z)
  }
}

/* function f21 (a, b, c, z) {
  // 15.3.8 in Abramowitz & Stegun
  // TODO Handle a - b
  if (z < -1) {
    let y = 1 / (1 - z)
    let f1 = Math.exp(-a * Math.log(1 - z) + logGamma(c) + logGamma(b - a) - logGamma(b) - logGamma(c - a)) * _f21TaylorSeries(a, c - b, a - b + 1, y)
    let f2 = Math.exp(-b * Math.log(1 - z) + logGamma(c) + logGamma(a - b) - logGamma(a) - logGamma(c - b)) * _f21TaylorSeries(b, c - a, b - a + 1, y)
    return f1 + f2
  }

  // 15.3.4 in Abramowitz & Stegun
  if (z < 0) {
    return Math.pow(1 - z, -a) * _f21TaylorSeries(a, c - b, c, z / (1 - z))
  }

  // z -> z
  if (z <= 0.5) {
    return _f21TaylorSeries(a, b, c, z)
  }

  if (z <= 1) {
    // Eq. (4.7): z -> 1 - z
    let y = 1 - z
    let d = c - a - b
    let f1 = Math.exp(-logGamma(c - a) - logGamma(c - b)) * _f21TaylorSeries(a, b, 1 - d, y)
    let f2 = Math.exp(d * Math.log(y) - logGamma(a) - logGamma(b)) * _f21TaylorSeries(c - a, c - b, d + 1, y)
    return Math.PI * (f1 + f2) / Math.sin(Math.PI * d)
  }

  if (z <= 2) {
    // Eq. (4.8): z -> 1 - 1 / z
    let y = 1 - 1 / z
    let d = c - a - b
    let f1 = Math.pow(z, -a) * Math.exp(-logGamma(c - a) - logGamma(c - b)) * _f21TaylorSeries(a, a - c + 1, 1 - d, y)
    let f2 = Math.pow(1 - z, d) * Math.exp((a - c) * Math.log(z) - logGamma(a) - logGamma(b)) * _f21TaylorSeries(c - a, 1 - a, d + 1, y)
    return Math.PI * (f1 + f2) / Math.sin(Math.PI * d)
  }

  // Eq. (4.9): z -> 1 / z
  let y = 1 / z
  let f1 = Math.pow(-z, -a) * Math.exp(-logGamma(b) - logGamma(c - a)) * _f21TaylorSeries(a, a - c + 1, a - b + 1, y)
  let f2 = Math.pow(-z, -b) * Math.exp(-logGamma(z) - logGamma(c - b)) * _f21TaylorSeries(b - c + 1, b, b - a + 1, y)
  return Math.PI * (f1 + f2)  / Math.sin(Math.PI * (b - a))
} */

function _halley (z, w0) {
  let w = w0;
  let dw = 0;

  for (let i = 0; i < MAX_ITER; i++) {
    const y = w * Math.exp(w) - z;
    dw = y / ((w + 1) * Math.exp(w) - (w + 2) * y / (2 * w + 2));
    w -= dw;
    if (Math.abs(dw / w) < EPS) { break }
  }

  return w
}

/**
 * Computes the Lambert W function (branch -1) using Halley's method.
 * Source: Corless et al: On the Lambert W Function (https://cs.uwaterloo.ca/research/tr/1993/03/W.pdf)
 *
 * @method lamberW1m
 * @memberof ran.special
 * @param z {number} Value to evaluate the Lambert W function at.
 * @returns {number} Value of the Lambert W function.
 * @private
 */
function lambertW1m (z) {
  // TODO Find better w0
  return _halley(z, -2)
}

/**
 * Computes the Lambert W function (principal branch) using Halley's method.
 * Source: Corless et al: On the Lambert W Function (https://cs.uwaterloo.ca/research/tr/1993/03/W.pdf)
 *
 *
 * @method lambertW0
 * @memberof ran.special
 * @param {number} z Value to evaluate the Lambert W function at.
 * @returns {number} Value of the Lambert W function.
 * @private
 */
function lambertW0 (z) {
  return _halley(z, z < 1 ? 0 : Math.log(z))
}

/**
 * Logarithm of the beta function.
 *
 * @method logBeta
 * @memberof ran.special
 * @param {number} x First argument.
 * @param {number} y Second argument.
 * @returns {number} The logarithm of the beta function.
 * @private
 */
function logBeta (x, y) {
  return logGamma$1(x) + logGamma$1(y) - logGamma$1(x + y)
}

/**
 * Computes the logarithm of the binomial coefficient for two numbers.
 *
 * @method logBinomial
 * @memberof ran.special
 * @param {number} n Number of samples.
 * @param {number} k Number of draws
 * @return {number} The logarithm of the binomial coefficient.
 * @private
 */
function logBinomial (n, k) {
  return logGamma$1(n + 1) - logGamma$1(k + 1) - logGamma$1(n - k + 1)
}

/**
 * Series expansion of the Marcum-Q function. Section 3 in https://arxiv.org/pdf/1311.0681.pdf.
 *
 * @namespace _seriesExpansion
 * @memberof ran.special
 * @private
 */
const _seriesExpansion = {
  q (mu, x, y) {
    // Initialize terms with k = 0, Eq. (7)
    // ck = x^k / k!
    let ck = 1;

    // qck = y^{mu + k - 1} e^{-y} / gamma(mu + k - 1)
    let qck = Math.exp((mu - 1) * Math.log(y) - y - logGamma$1(mu));

    // qk = Q_{mu + k}(y)
    let qk = gammaUpperIncomplete(mu, y);
    let dz = ck * qk;
    let z = dz;

    for (let k = 1; k < MAX_ITER; k++) {
      // Update coefficients
      // Eq. (18)
      qck *= y / (mu + k - 1);
      qk += qck;
      ck *= x / k;
      dz = ck * qk;

      // Update sum
      z += dz;

      // Check if we should stop
      if (dz / z < EPS) { break }
    }

    return Math.exp(-x) * z
  },

  p (mu, x, y) {
    // Find truncation number using Eqs. (26) - (27)
    // Define some constants to speed up search
    const c0 = mu + logGamma$1(mu) - Math.log(2 * Math.PI * EPS);
    const c1 = Math.log(x * y);
    const c2 = x * y;
    let n = newton(
      t => (t + mu) * Math.log(t + mu) + t * Math.log(t) - 2 * t - t * c1 - c0,
      t => Math.log(t * (t + mu) / c2),
      0.5 * (Math.sqrt(mu * mu + 4 * x * y) - mu) + 1
    );
    n = Math.ceil(n);

    // Initialize terms with last index, Eq. (7)
    // ck = x^k / k!
    let ck = Math.exp(n * Math.log(x) - logGamma$1(n + 1));

    // qck = y^{mu + k} e^{-y} / gamma(mu + k)
    let pck = Math.exp((mu + n) * Math.log(y) - y - logGamma$1(mu + n + 1));

    // pk = P_{\mu + k}(y)
    let pk = gammaLowerIncomplete(mu + n, y);
    let dz = ck * pk;
    let z = dz;

    for (let k = n - 1; k >= 0; k--) {
      // Update coefficients
      // Eq. (19)
      pck *= (mu + k + 1) / y;
      pk += pck;
      ck *= (k + 1) / x;
      dz = ck * pk;

      // Update sum
      z += dz;
    }

    return 1 - Math.exp(-x) * z
  }
};

/**
 * Asymptotic expansion for large xi. Section 4.1 in https://arxiv.org/pdf/1311.0681.pdf.
 *
 * @namespace _seriesExpansion
 * @memberof ran.special
 * @private
 */
/* const _asymptoticExpansionLargeXi = (function() {
  function _aelx(mu, x, y, complementary) {
    // Calculate scale variables
    let xi = 2 * Math.sqrt(x * y)
    let sigma = Math.pow(Math.sqrt(y) - Math.sqrt(x), 2) / xi
    let rho = Math.sqrt(y / x)

    // am = A_n(mu)
    // am1 = A_n(mu - 1)
    let am = 1
    let am1 = 1

    // phic = e^{-sigma xi} xi^{-n + 1/2}
    let phic = Math.exp(-sigma * xi) * Math.sqrt(xi)
    let phi = Math.sqrt(Math.PI / sigma) * erfc(Math.sqrt(y) - Math.sqrt(x))

    // psic = (-1)^n rho^mu / (2 sqrt(pi))
    let psic = 0.5 * Math.pow(rho, mu) / Math.sqrt(2 * Math.PI)
    let psi = complementary ? 0.5 * Math.pow(rho, mu - 0.5) * erfc(Math.sqrt(y) - Math.sqrt(x)) : psic * (am1 - am / rho) * phi
    let z = psi

    // TODO Reverse iteration: n0 = sigma * xi and backwards for numerical stability
    for (let n = 1; n < MAX_ITER; n++) {
      // A_n(mu) and A_n(mu - 1)
      am *= -(Math.pow(2 * n - 1, 2) - 4 * mu * mu) / (8 * n)
      am1 *= -(Math.pow(2 * n - 1, 2) - 4 * (mu - 1) * (mu - 1)) / (8 * n)

      // Phi
      phic /= xi
      phi = (phic - sigma * phi) / (n - 0.5)

      // Psi
      psic *= -1
      psi = psic * (am1 - am / rho) * phi

      // Update Q or P
      z = complementary ? z - psi : z + psi

      // Check if we should stop
      if (Math.abs(psi) / z < EPS) { break }
    }

    return z
  }

  return {
    q (mu, x, y) {
      return _aelx(mu, x, y, false)
    },

    p (mu, x, y) {
      return 1 - _aelx(mu, x, y, true)
    }
  }
})() */

/**
 * Recurrence relation evaluation.
 *
 * @namespace _recurrence
 * @memberof ran.special
 * @private
 */
/* const _recurrence = (function() {
  function _fc(pnu, z) {
    let m = 0
    let b = 2 * pnu / z
    let a = 1
    let res = DELTA
    let c0 = res
    let d0 = 0
    let delta = 0
    do {
      d0 = b + a * d0
      if (Math.abs(d0) < DELTA){
        d0 = DELTA
      }
      c0 = b + a / c0
      if (Math.abs(c0) < DELTA) {
        c0 = DELTA
      }
      d0 = 1 / d0
      delta = c0 * d0
      res = res * delta
      m = m + 1
      a = 1
      b = 2 * (pnu + m) / z
    } while (Math.abs(delta - 1) > EPS)
    return res
  }

  function _pqTrap(mu, x, y, p, q, ierr) {
    let xs = x / mu
    let ys = y / mu
    let xis2 = 4 * xs * ys
    let wxis = Math.sqrt(1 + xis2)
    let a = 0
    let b= 3
    let epstrap = 1e-13
    let pq = _trap(a, b, epstrap, xis2, mu, wxis, ys)
    let zeta = _zetaxy(xs, ys)
    if ((-mu * 0.5 * zeta * zeta) < Math.log(DELTA)) {
      if (y > x + mu) {
        return {
          q: 0,
          p: 1
        }
      } else {
        return {
          q: 1,
          p: 0
        }
      }
    } else {
      pq = pq * Math.exp(-mu * 0.5 * zeta * zeta) / Math.PI
      if (zeta < 0) {
        return {
          q: pq,
          p: 1 - pq
        }
      } else {
        return {
          q: 1 + pq,
          p: -pq
        }
      }
    }
  }

  return {
    q(mu, x, y) {
      return undefined
    },

    p(mu, x, y) {
      let b = 1
      let nu = y - x + b * b + b * Math.sqrt(2 * (x + y) + b * b)
      let n1 = Math.floor(mu)
      let n2 = Math.floor(nu) + 2
      let n3 = n2 - n1
      let mur = mu + n3
      let xi = 2 * Math.sqrt(x * y)
      let cmu = Math.sqrt(y / x) * _fc(mur, xi)
      let p1 = _pqTrap(mur, x, y)
      let p0 = _pqTrap(mur, x, y)
      let z = 0
      for (let n = 0; n < n3 - 1; n++) {
        z = ((1 + cmu) * p0 - p1) / cmu
        p1 = p0
        p0 = z
        cmu = y / (mur - n - 1 + x * cmu)
      }
      return 1 - z
    }
  }
})() */

/**
 * Computes the generalized Marcum-Q function. Only accurate in x < 30.
 * Implementation source: https://arxiv.org/pdf/1311.0681.pdf.
 *
 * @method marcumQ
 * @memberof ran.special
 * @param {number} mu The order of the function.
 * @param {number} x First variable.
 * @param {number} y Second variable.
 * @return {(number|undefined)} The generalized Marcum-Q function at the specified values. If evaluated at an unsupported point, it
 * returns undefined.
 * @private
 */
function marcumQ (mu, x, y) {
  // Pick primary function
  const primary = y > x + mu ? 'q' : 'p';
  // console.log(primary)

  // Special cases
  if (y === 0) {
    return 1
  }
  if (x === 0) {
    return gammaUpperIncomplete(mu, y)
  }

  // Series expansion
  // if (x < 30) {
  return _seriesExpansion[primary](mu, x, y)
  // }

  // Asymptotic expansion
  /* let xi = 2 * Math.sqrt(x * y)
  if (xi > 30 && mu * mu < 2 * xi) {
    return _asymptoticExpansionLargeXi[primary](mu, x, y)
  }

  /*let s = Math.sqrt(4 * x + 2 * mu)
  let f1 = x + mu - s
  let f2 = x + mu + s
  if (f1 < y && y < f2) {
    if (mu < 135) {
      // TODO recurrence relations
      console.log('recurrence')
      return _recurrence[primary](mu, x, y)
    } else {
      // TODO asymptotic expansion
      console.log('asymptotic large mu')
      return undefined
    }
  }
  console.log('integral')

  // Integral
  return undefined */
}

/* eslint no-loss-of-precision: 0 */

// Constants
const PI2_SQRT_INV = 1 / Math.sqrt(2 * Math.PI);
const HALF_PI_INV = 0.5 / Math.PI;

// Ranges for a and h to select algorithm
const A_RANGES = [
  0.025,
  0.09,
  0.15,
  0.36,
  0.5,
  0.9,
  0.99999
];
const H_RANGES = [
  0.02,
  0.06,
  0.09,
  0.125,
  0.26,
  0.4,
  0.6,
  1.6,
  1.7,
  2.33,
  2.4,
  3.36,
  3.4,
  4.8
];

// Algorithm sector codes
const CODES = [
  [0, 0, 1, 12, 12, 12, 12, 12, 12, 12, 12, 15, 15, 15, 8],
  [0, 1, 1, 2, 2, 4, 4, 13, 13, 14, 14, 15, 15, 15, 8],
  [1, 1, 2, 2, 2, 4, 4, 14, 14, 14, 14, 15, 15, 15, 9],
  [1, 1, 2, 4, 4, 4, 4, 6, 6, 15, 15, 15, 15, 15, 9],
  [1, 2, 2, 4, 4, 5, 5, 7, 7, 16, 16, 16, 11, 11, 10],
  [1, 2, 4, 4, 4, 5, 5, 7, 7, 16, 16, 16, 11, 11, 11],
  [1, 2, 3, 3, 5, 5, 7, 7, 16, 16, 16, 16, 16, 11, 11],
  [1, 2, 3, 3, 5, 5, 17, 17, 17, 17, 16, 16, 16, 11, 11]
];

// Method to use
const METHODS = [
  1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 4, 4, 4, 4, 5, 6
];

// Order of approximation
const ORDERS = [
  2, 3, 4, 5, 7, 10, 12, 18, 10, 20, 30, 20, 4, 7, 8, 20, 13, 0
];

// Some constants for the algorithms
const C2 = [
  0.99999999999999987510,
  -0.999999999999888,
  0.99999999998290743652,
  -0.999999998962825,
  0.99999996660459362918,
  -0.9999993398627247,
  0.99999125611136965852,
  -0.9999177762446338,
  0.99942835555870132569,
  -0.99697311720723,
  0.98751448037275303682,
  -0.9591585798057288,
  0.89246305511006708555,
  -0.76893425990464,
  0.58893528468484693250,
  -0.38380345160440255,
  0.20317601701045299653,
  -0.08281363160700499,
  0.24167984735759576523e-01,
  -0.004467656666397183,
  0.39141169402373836468e-03
];
const PTS = [
  0.35082039676451715489e-02,
  0.31279042338030753740e-01,
  0.85266826283219451090e-01,
  0.16245071730812277011,
  0.25851196049125434828,
  0.36807553840697533536,
  0.48501092905604697475,
  0.60277514152618576821,
  0.71477884217753226516,
  0.81475510988760098605,
  0.89711029755948965867,
  0.95723808085944261843,
  0.99178832974629703586
];

const WTS = [
  0.18831438115323502887e-01,
  0.18567086243977649478e-01,
  0.18042093461223385584e-01,
  0.17263829606398753364e-01,
  0.16243219975989856730e-01,
  0.14994592034116704829e-01,
  0.13535474469662088392e-01,
  0.11886351605820165233e-01,
  0.10070377242777431897e-01,
  0.81130545742299586629e-02,
  0.60419009528470238773e-02,
  0.38862217010742057883e-02,
  0.16793031084546090448e-02
];

// Some helper functions
function _phi (z) {
  return 0.5 * erf(z / Math.SQRT2)
}

function _phiComp (z) {
  return 0.5 * erfc(z / Math.SQRT2)
}

// T1
function _t1 (h, a, m) {
  const hh = -0.5 * h * h;
  const dhs = Math.exp(hh);
  const aa = a * a;
  let aj = HALF_PI_INV * a;
  let dj = dhs - 1;
  let gj = hh * dhs;
  let z = HALF_PI_INV * Math.atan(a);

  for (let i = 2, j = 1; i <= m; i++, j += 2) {
    z += dj * aj / j;
    aj *= aa;
    dj = gj - dj;
    gj *= hh / i;
  }
  return z
}

// T2
function _t2 (h, a, ah, m) {
  const hh = h * h;
  const aa = -a * a;
  let vi = PI2_SQRT_INV * a * Math.exp(-0.5 * ah * ah);
  let ph = _phi(ah) / h;
  const y = 1 / hh;
  let z = 0;

  const iMax = m + m + 1;
  for (let i = 1; i < iMax; i += 2) {
    z += ph;
    ph = y * (vi - i * ph);
    vi *= aa;
  }
  return PI2_SQRT_INV * Math.exp(-0.5 * hh) * z
}

// T3
function _t3 (h, a, ah, m) {
  const hh = h * h;
  const aa = a * a;
  let vi = PI2_SQRT_INV * a * Math.exp(-0.5 * ah * ah);
  let ph = _phi(ah) / h;
  const y = 1 / hh;
  let z = 0;

  for (let i = 1, ii = 1; i <= m; i++, ii += 2) {
    z += ph * C2[i - 1];
    ph = y * (ii * ph - vi);
    vi *= aa;
  }
  return PI2_SQRT_INV * Math.exp(-0.5 * hh) * z
}

// T4
function _t4 (h, a, m) {
  const hh = h * h;
  const aa = -a * a;
  let z = 0;
  let ai = HALF_PI_INV * a * Math.exp(-0.5 * hh * (1 - aa));
  let yi = 1;

  const iMax = m + m + 1;
  for (let i = 3; i <= iMax; i += 2) {
    z += ai * yi;
    yi = (1 - hh * yi) / i;
    ai *= aa;
  }
  return z
}

// T5
function _t5 (h, a, m) {
  const hh = -0.5 * h * h;
  const aa = a * a;
  let z = 0;

  for (let i = 0; i < m; i++) {
    const r = 1 + aa * PTS[i];
    z += WTS[i] * Math.exp(hh * r) / r;
  }
  return a * z
}

// T6
function _t6 (h, a) {
  const phi = _phiComp(h);
  const y = 1 - a;
  const r = Math.atan(y / (1 + a));
  let z = 0.5 * phi * (1 - phi);

  if (r !== 0) {
    z -= HALF_PI_INV * r * Math.exp(-0.5 * y * h * h / r);
  }
  return z
}

function _t (h, a, ah) {
  const row = findSectorRow(a);
  const col = findSectorColumn(h);
  const code = getCode(row, col);
  const order = getOrder(code);
  return runAlgorithm(code, order, h, a, ah)
}

function findSectorRow (a) {
  let row = 7;
  for (let i = 0; i < 7; i++) {
    if (a <= A_RANGES[i]) {
      row = i;
      break
    }
  }
  return row
}

function findSectorColumn (h) {
  let col = 14;
  for (let i = 0; i < 14; i++) {
    if (h <= H_RANGES[i]) {
      col = i;
      break
    }
  }
  return col
}

function getCode (row, col) {
  return CODES[row][col]
}

function getOrder (code) {
  return ORDERS[code]
}

function runAlgorithm (code, order, h, a, ah) {
  switch (METHODS[code]) {
    case 2:
      return _t2.call(this, h, a, ah, order)
    case 3:
      return _t3.call(this, h, a, ah, order)
    case 4:
      return _t4.call(this, h, a, order)
    case 5:
      return _t5.call(this, h, a, order)
    case 6:
      return _t6.call(this, h, a)
    case 1:
    default:
      return _t1.call(this, h, a, order)
  }
}

/**
 * Computes the Owen's T function based on the paper https://www.jstatsoft.org/article/view/v005i05/t.pdf.
 * Translated from the python code: https://people.math.sc.edu/Burkardt/py_src/owens/owens.html
 *
 * @method owenT
 * @memberof ran.special
 * @param {number} h First parameter.
 * @param {number} a Second parameter.
 * @returns {number} Owen's T function at the specified values.
 * @private
 */
function owenT (h, a) {
  const cut = 0.67;
  const hAbs = Math.abs(h);
  const aAbs = Math.abs(a);
  const ah = aAbs * hAbs;
  let z;

  if (aAbs <= 1) {
    z = _t(hAbs, aAbs, ah);
  } else if (hAbs <= cut) {
    z = 0.25 - _phi(hAbs) * _phi(ah) - _t(ah, 1 / aAbs, hAbs);
  } else {
    const phiH = _phiComp(hAbs);
    const phiAh = _phiComp(ah);
    z = 0.5 * (phiH + phiAh) - phiH * phiAh - _t(ah, 1 / aAbs, hAbs);
  }

  return a < 0 ? -z : z
}

/**
 * Generator for the [alpha distribution]{@link https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/alppdf.htm}:
 *
 * $$f(x; \alpha, \beta) = \frac{\phi\Big(\alpha - \frac{\beta}{x}\Big)}{x^2 \Phi(\alpha)},$$
 *
 * where $\alpha, \beta > 0$ and $\phi(x), \Phi(x)$ denote the probability density and cumulative probability
 * functions of the [normal distribution]{@link #dist.Normal}.
 * Support: $x > 0$.
 *
 * @class Alpha
 * @memberof ran.dist
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @param {number=} beta Scale parameter. Default value is 1.
 * @constructor
 */
class alpha extends Distribution {
  // Source: Johnson, Kotz, and Balakrishnan (1994). Continuous Univariate Distributions — Volume 1, Second Edition,
  // John Wiley and Sons, p. 173.
  constructor (alpha = 1, beta = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { alpha, beta };
    Distribution.validate({ alpha, beta }, [
      'alpha > 0',
      'beta > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      this._phi(alpha),
      this._phi(alpha) * Math.sqrt(2 * Math.PI)
    ];
  }

  _phi (x) {
    return 0.5 * (1 + erf(x / Math.SQRT2))
  }

  _phiInv (x) {
    return Math.SQRT2 * erfinv(2 * x - 1)
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.p.beta * Math.exp(-0.5 * Math.pow(this.p.alpha - this.p.beta / x, 2)) / (x * x * this.c[1])
  }

  _cdf (x) {
    return this._phi(this.p.alpha - this.p.beta / x) / this.c[0]
  }

  _q (p) {
    return this.p.beta / (this.p.alpha - this._phiInv(p * this.c[0]))
  }
}

/**
 * Generator for the [anglit distribution]{@link https://docs.scipy.org/doc/scipy-1.0.0/reference/tutorial/stats/continuous_anglit.html}:
 *
 * $$f(x; \mu, \beta) = \frac{1}{\beta} \cos\bigg(2 \frac{x - \mu}{\beta}\bigg),$$
 *
 * where $\mu \in \mathbb{R}$ and $\beta > 0$.
 * Support: $x \in \Big\[\mu-\frac{\beta \pi}{4}, \mu + \frac{\beta \pi}{4}\Big\]$.
 *
 * @class Anglit
 * @memberof ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} beta Scale parameter. Default value is 1.
 * @constructor
 */
class anglit extends Distribution {
  // Source: King (2017). Statistics for Process control engineers, John Wiley and Sons, p. 472.
  constructor (mu = 0, beta = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { mu, beta };
    Distribution.validate({ mu, beta }, [
      'beta > 0'
    ]);

    // Set support
    this.s = [{
      value: mu - Math.PI * beta / 4,
      closed: true
    }, {
      value: mu + Math.PI * beta / 4,
      closed: true
    }];

    // Speed-up constants
    this.c = [
      2 / beta,
      2 * mu / beta,
      1 / beta,
      mu / beta - Math.PI / 4
    ];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return Math.cos(this.c[0] * x - this.c[1]) / this.p.beta
  }

  _cdf (x) {
    return Math.pow(Math.sin(this.c[2] * x - this.c[3]), 2)
  }

  _q (p) {
    return this.p.mu + this.p.beta * (Math.asin(Math.sqrt(p)) - Math.PI / 4)
  }
}

/**
 * Generator for the [arbitrarily bounded arcsine distribution]{@link https://en.wikipedia.org/wiki/Arcsine_distribution#Arbitrary_bounded_support}:
 *
 * $$f(x; a, b) = \frac{1}{\pi \sqrt{(x -a) (b - x)}},$$
 *
 * where $a, b \in \mathbb{R}$ and $a < b$.
 * Support: $x \in \[a, b\]$.
 *
 * @class Arcsine
 * @memberof ran.dist
 * @param {number=} a Lower boundary. Default value is 0.
 * @param {number=} b Upper boundary. Default value is 1.
 * @constructor
 */
class arcsine extends Distribution {
  // Source: Feller (1991). An Introduction to Probability Theory and Its Applications — Volume 2, Second Edition,
  // John Wiley and Sons, p. 79.
  constructor (a = 0, b = 1) {
    super('continuous', arguments.length);

    // Set parameters
    this.p = { a, b };
    Distribution.validate({ a, b }, [
      'a < b'
    ]);

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }];

    // Speed-up constants
    this.c = [
      1 / Math.PI,
      b - a,
      0.5 * Math.PI
    ];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.c[0] / Math.sqrt((x - this.p.a) * (this.p.b - x))
  }

  _cdf (x) {
    return 2 * this.c[0] * Math.asin(Math.sqrt((x - this.p.a) / this.c[1]))
  }

  _q (p) {
    const s = Math.sin(this.c[2] * p);
    return (s * s) * this.c[1] + this.p.a
  }
}

/**
 * Generates a normally distributed random variate.
 *
 * @method normal
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number=} mu Distribution mean. Default value is 0.
 * @param {number=} sigma Distribution standard deviation. Default value is 1.
 * @returns {number} Random variate.
 * @ignore
 */
function normal (r, mu = 0, sigma = 1) {
  const u = r.next();

  const v = r.next();
  return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) + mu
}

/**
 * Generates a gamma random variate with the rate parametrization.
 *
 * @method gamma
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number} a Shape parameter.
 * @param {number=} b Rate parameter. Default value is 1.
 * @returns {number} Random variate.
 * @ignore
 */
function gamma (r, a, b = 1) {
  if (a > 1) {
    const d = a - 1 / 3;

    const c = 1 / Math.sqrt(9 * d);

    let Z;
    let V;
    let U;

    // Max 1000 trials
    for (let trials = 0; trials < 1000; trials++) {
      Z = normal(r);
      if (Z > -1 / c) {
        V = Math.pow(1 + c * Z, 3);
        U = r.next();
        if (Math.log(U) < 0.5 * Z * Z + d * (1 - V + Math.log(V))) { return d * V / b }
      }
    }
  } else {
    return gamma(r, a + 1, b) * Math.pow(r.next(), 1 / a)
  }
}

/**
 * Generates a beta distributed random variate.
 *
 * @method normal
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number=} a First shape parameter.
 * @param {number=} b Second shape parameter.
 * @returns {number} Random variate.
 * @ignore
 */
function rBeta (r, a, b) {
  const x = gamma(r, a, 1);
  const y = gamma(r, b, 1);
  const z = x / (x + y);

  // Handle 1 - z << 1 case
  return Math.abs(1 - z) < Number.EPSILON ? 1 - y / x : z
}

/**
 * Generator for the [beta distribution]{@link https://en.wikipedia.org/wiki/Beta_distribution}:
 *
 * $$f(x; \alpha, \beta) = \frac{x^{\alpha - 1}(1 - x)^{\beta - 1}}{\mathrm{B}(\alpha, \beta)},$$
 *
 * with $\alpha, \beta > 0$ and $\mathrm{B}(\alpha, \beta)$ is the beta function.
 * Support: $x \in (0, 1)$.
 *
 * @class Beta
 * @memberof ran.dist
 * @param {number=} alpha First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @constructor
 */
class Beta extends Distribution {
  constructor (alpha = 1, beta = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { alpha, beta };
    Distribution.validate({ alpha, beta }, [
      'alpha > 0',
      'beta > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: alpha >= 1
    }, {
      value: 1,
      closed: beta >= 1
    }];

    // Speed-up constants
    this.c = [
      logBeta(alpha, beta),
      alpha - 1,
      beta - 1
    ];
  }

  _generator () {
    // Direct generation
    return rBeta(this.r, this.p.alpha, this.p.beta)
  }

  _pdf (x) {
    if (this.c[1] === 0 && this.c[2] === 0) {
      return 1
    }

    const a = this.c[1] * Math.log(x);

    const b = this.c[2] * Math.log(1 - x);

    // Handle x = 0 and x = 1 cases
    return Math.exp(a + b - this.c[0])
  }

  _cdf (x) {
    return regularizedBetaIncomplete(this.p.alpha, this.p.beta, x)
  }
}

/**
 * Generator for the [Balding-Nichols distribution]{@link https://en.wikipedia.org/wiki/Balding%E2%80%93Nichols_model}:
 *
 * $$f(x; \alpha, \beta) = \frac{x^{\alpha - 1} (1 - x)^{\beta - 1}}{\mathrm{B}(\alpha, \beta)},$$
 *
 * where $\alpha = \frac{1 - F}{F} p$, $\beta = \frac{1 - F}{F} (1 - p)$ and $F, p \in (0, 1)$.
 * Support: $x \in (0, 1)$. It is simply a re-parametrization of the [beta distribution]{@link #dist.Beta}.
 *
 * @class BaldingNichols
 * @memberof ran.dist
 * @param {number=} F Fixation index. Default value is 0.5.
 * @param {number=} p Allele frequency. Default value is 0.5.
 * @constructor
 */
class baldingNichols extends Beta {
  // Special parametrization of the beta distribution
  // Source: Balding and Nichols. A method for quantifying differentiation between populations at multi-allelic loci and
  // its implications for investigating identity and paternity. Genetica (96) 3-12, 1995.
  constructor (F = 0.5, p = 0.5) {
    Distribution.validate({ F, p }, [
      'F > 0', 'F < 1',
      'p > 0', 'p < 1'
    ]);
    const f = (1 - F) / F;
    super(f * p, f * (1 - p));

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: 1,
      closed: false
    }];
  }
}

/**
 * Generator for the [Irwin-Hall distribution]{@link https://en.wikipedia.org/wiki/Irwin%E2%80%93Hall_distribution}:
 *
 * $$f(x; n) = \frac{1}{(n - 1)!} \sum_{k = 0}^{\lfloor x\rfloor} (-1)^k \begin{pmatrix}n \\\\ k \\\\ \end{pmatrix} (x - k)^{n - 1},$$
 *
 * with $n \in \mathbb{N}^+$. Support: $x \in \[0, n\]$.
 *
 * @class IrwinHall
 * @memberof ran.dist
 * @param {number=} n Number of uniform variates to sum. If not an integer, it is rounded to the nearest one. Default
 * value is 1.
 * @constructor
 */
class IrwinHall extends Distribution {
  constructor (n = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    const ni = Math.round(n);
    this.p = { n: ni };
    Distribution.validate({ n: ni }, [
      'n > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: ni,
      closed: true
    }];

    // Speed-up constants
    this.c = Array.from({ length: ni + 1 }, (d, k) => logGamma$1(k + 1) + logGamma$1(ni - k + 1));
  }

  _generator () {
    // Direct sampling
    return neumaier(Array.from({ length: this.p.n }, () => this.r.next()))
  }

  _pdf (x) {
    // Use symmetry property for large x values
    const y = x < this.p.n / 2 ? x : this.p.n - x;

    // Compute terms
    const terms = Array.from({ length: Math.floor(y) + 1 }, (d, k) => {
      const z = (this.p.n - 1) * Math.log(y - k) - this.c[k];

      return k % 2 === 0 ? Math.exp(z) : -Math.exp(z)
    });

    // Sort terms
    terms.sort((a, b) => a - b);

    // Calculate sum
    return this.p.n * neumaier(terms)
  }

  _cdf (x) {
    // Use symmetry property for large x values
    const y = x < this.p.n / 2 ? x : this.p.n - x;

    // Compute terms
    const terms = Array.from({ length: Math.floor(y) + 1 }, (d, k) => {
      const z = this.p.n * Math.log(y - k) - this.c[k];

      return k % 2 === 0 ? Math.exp(z) : -Math.exp(z)
    });

    // Sort terms
    const sum = neumaier(terms.sort((a, b) => a - b));

    // Calculate sum
    return x < this.p.n / 2 ? sum : 1 - sum
  }
}

/**
 * Generator for the [Bates distribution]{@link https://en.wikipedia.org/wiki/Bates_distribution}:
 *
 * $$f(x; n, a, b) = \frac{n}{(b - a)(n - 1)!} \sum_{k = 0}^{\lfloor nz \rfloor} (-1)^k \begin{pmatrix}n \\\\ k \\\\ \end{pmatrix} (nz - k)^{n - 1},$$
 *
 * with $z = \frac{x - a}{b - a}$, $n \in \mathbb{N}^+$ and $a, b \in \mathbb{R}, a < b$.
 * Support: $x \in \[a, b\]$.
 *
 * @class Bates
 * @memberof ran.dist
 * @param {number=} n Number of uniform variates to sum. If not an integer, it is rounded to the nearest one. Default value is 10.
 * @param {number=} a Lower boundary of the uniform variate. Default value is 0.
 * @param {number=} b Upper boundary of the uniform variate. Default value is 1.
 * @constructor
 */
class bates extends IrwinHall {
  // Transformation of Irwin-Hall
  constructor (n = 3, a = 0, b = 1) {
    const ni = Math.round(n);
    super(ni);

    // Validate parameters
    this.p = Object.assign(this.p, { a, b });
    Distribution.validate({ a, b, n: ni }, [
      'n > 0',
      'a < b'
    ]);

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }];

    // Extend speed-up constants. Note that c in IrwinHall has a length of n + 1
    this.c = this.c.concat([
      n / (b - a),
      n * a / (b - a)
    ]);
  }

  _generator () {
    // Direct sampling by transforming Irwin-Hall variate
    return super._generator() / this.c[this.p.n + 1] + this.p.a
  }

  _pdf (x) {
    return this.c[this.p.n + 1] * super._pdf(this.c[this.p.n + 1] * x - this.c[this.p.n + 2])
  }

  _cdf (x) {
    return super._cdf(this.c[this.p.n + 1] * x - this.c[this.p.n + 2])
  }
}

/**
 * Generator for the [Benini distribution]{@link https://en.wikipedia.org/wiki/Benini_distribution}:
 *
 * $$f(x; \alpha, \beta, \sigma) = \bigg(\frac{\alpha}{x} + \frac{2 \beta \ln \frac{x}{\sigma}}{x}\bigg) e^{-\alpha \ln \frac{x}{\sigma} - \beta \ln^2 \frac{x}{\sigma}},$$
 *
 * with $\alpha, \beta, \sigma > 0$. Support: $x \in (\sigma, \infty)$.
 *
 * @class Benini
 * @memberof ran.dist
 * @param {number=} alpha First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @constructor
 */
class benini extends Distribution {
  constructor (alpha = 1, beta = 1, sigma = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { alpha, beta, sigma };
    Distribution.validate({ alpha, beta, sigma }, [
      'alpha > 0',
      'beta > 0',
      'sigma > 0'
    ]);

    // Set support
    this.s = [{
      value: sigma,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      alpha * alpha,
      4 * beta,
      0.5 / beta
    ];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const y = Math.log(x / this.p.sigma);
    const z = this.p.alpha + this.p.beta * y;
    return Math.exp(-y * z) * (z + this.p.beta * y) / x
  }

  _cdf (x) {
    const y = Math.log(x / this.p.sigma);
    return 1 - Math.exp(-y * (this.p.alpha + this.p.beta * y))
  }

  _q (p) {
    return this.p.sigma * Math.exp(this.c[2] * (Math.sqrt(this.c[0] - this.c[1] * Math.log(1 - p)) - this.p.alpha))
  }
}

/**
 * Generator for the [Benktander type II distribution]{@link https://en.wikipedia.org/wiki/Benktander_type_II_distribution}:
 *
 * $$f(x; a, b) = e^{\frac{a}{b}(1 - x^b)} x^{b-2} (ax^b - b + 1),$$
 *
 * with $a > 0$ and $b \in (0, 1]$. Support: $x \in [1, \infty)$.
 *
 * @class BenktanderII
 * @memberof ran.dist
 * @param {number=} a Scale parameter. Default value is 1.
 * @param {number=} b Shape parameter. Default value is 0.5.
 * @constructor
 */
class benktanderIi extends Distribution {
  constructor (a = 1, b = 0.5) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { a, b };
    Distribution.validate({ a, b }, [
      'a > 0',
      'b > 0', 'b <= 1'
    ]);

    // Set support
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      (1 - b) / a,
      Math.exp(-a / b),
      b / (b - 1),
      Math.log(a / (1 - b)) + a / (1 - b),
      1 - b < Number.EPSILON
    ];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    // b = 1
    if (this.c[4]) {
      return this.p.a * Math.exp(this.p.a * (1 - x))
    }

    // All other cases
    const y = Math.pow(x, this.p.b);
    return Math.exp(this.p.a * (1 - y) / this.p.b) * Math.pow(x, this.p.b - 2) * (this.p.a * y - this.p.b + 1)
  }

  _cdf (x) {
    // b = 1
    if (this.c[4]) {
      return 1 - Math.exp(this.p.a * (1 - x))
    }

    // All other cases
    return 1 - Math.pow(x, this.p.b - 1) * Math.exp(this.p.a * (1 - Math.pow(x, this.p.b)) / this.p.b)
  }

  _q (p) {
    // b = 1
    if (this.c[4]) {
      return 1 - Math.log(1 - p) / this.p.a
    }

    // Check if b is too close to 1
    const w = lambertW0(Math.pow(this.c[1] * (1 - p), this.c[2]) / this.c[0]);
    if (!Number.isFinite(w)) {
      // 1 - b << 1, use logarithms
      const l1 = this.c[3] + this.c[2] * Math.log(1 - p);
      const l2 = Math.log(l1);

      // W(x) ~= ln(x) - ln ln(x) - ln(x) / (ln ln(x))
      return Math.pow(this.c[0] * (l1 - l2 + l2 / l1), 1 / this.p.b)
    } else {
      // All other cases
      return Math.pow(this.c[0] * w, 1 / this.p.b)
    }
  }
}

/**
 * Class implementing an [alias table]{@link https://en.wikipedia.org/wiki/Alias_method} with a sampler.
 *
 * @class AliasTable
 * @memberof ran.dist
 * @param {number[]} weights The (unnormalized) weights for the alias table.
 * @constructor
 * @ignore
 */
class AliasTable {
  constructor (weights) {
    // Pre-compute tables
    this.n = weights.length;

    this.prob = [0];

    this.alias = [0];

    let total = 0;
    if (weights.length > 1) {
      // Get sum (for normalization)
      for (let i = 0; i < this.n; i++) { total += weights[i]; }

      // Fill up small and large work lists
      const p = [];

      const small = [];

      const large = [];
      for (let i = 0; i < this.n; i++) {
        p.push(this.n * weights[i] / total);
        if (p[i] < 1.0) { small.push(i); } else { large.push(i); }
      }

      // Init tables
      this.prob = [];
      this.alias = [];
      for (let i = 0; i < this.n; i++) {
        this.prob.push(1.0);
        this.alias.push(i);
      }

      // Fill up alias table
      let s = 0;

      let l = 0;
      while (small.length > 0 && large.length > 0) {
        s = small.shift();
        l = large.shift();

        this.prob[s] = p[s];
        this.alias[s] = l;

        p[l] += p[s] - 1.0;
        if (p[l] < 1.0) { small.push(l); } else { large.push(l); }
      }
      while (large.length > 0) {
        l = large.shift();
        this.prob[l] = 1.0;
        this.alias[l] = l;
      }
      while (small.length > 0) {
        s = small.shift();
        this.prob[s] = 1.0;
        this.alias[s] = s;
      }
    }

    // Normalized weights
    this.weights = weights.map(d => d / total);
  }

  /**
   * Returns a sample from the alias table.
   *
   * @method sample
   * @memberof ran.dist.AliasTable
   * @param {ran.core.Xoshiro128p} r Pseudo random number generator to use.
   * @returns {number} The random sample.
   */
  sample (r) {
    if (this.n <= 1) {
      return 0
    }

    const i = Math.floor(r.next() * this.n);
    return r.next() < this.prob[i] ? i : this.alias[i]
  }

  /**
   * Returns the i-th weight of the alias table.
   *
   * @method weight
   * @memberof ran.dist.AliasTable
   * @param {number} i Index of the weight to return.
   * @returns {number} The i-th weight.
   */
  weight (i) {
    return this.weights[i]
  }
}

/**
 * Generator for a [categorical distribution]{@link https://en.wikipedia.org/wiki/Categorical_distribution}:
 *
 * $$f(k; \{w\}) = \frac{w_k}{\sum_j w_j},$$
 *
 * where $w_k > 0$. Support: $k \in \mathbb{N}_0$.
 *
 * @class Categorical
 * @memberof ran.dist
 * @param {number[]=} weights Weights for the distribution (doesn't need to be normalized). Default value is an array with a single value of 1.
 * @param {number=} min Lowest value to sample (support starts at this value). Default value is [1, 1, 1].
 * @constructor
 */
class Categorical extends Distribution {
  constructor (weights = [1, 1, 1], min = 0) {
    super('discrete', arguments.length);

    // Validate parameters
    this.p = { n: weights.length, weights, min };
    Distribution.validate({
      w_i: (() => {
        const allPositive = weights.reduce((acc, d) => acc && (d >= 0), true);
        return allPositive ? 1 : -1
      })(),
      min
    }, [
      'w_i >= 0'
    ]);

    // Set support
    this.s = [{
      value: min,
      closed: true
    }, {
      value: Math.max(0, weights.length - 1) + min,
      closed: true
    }];

    // Build alias table
    this.aliasTable = new AliasTable(weights);

    // Build pmf and cdf
    let weight = this.aliasTable.weight(0);
    this.pdfTable = [weight];
    this.cdfTable = [weight];
    for (let i = 1; i < weights.length; i++) {
      weight = this.aliasTable.weight(i);
      this.pdfTable.push(weight);
      this.cdfTable.push(this.cdfTable[i - 1] + weight);
    }
  }

  _generator () {
    // Direct sampling
    return this.p.min + this.aliasTable.sample(this.r)
  }

  _pdf (x) {
    if (this.p.n <= 1) {
      return 1
    } else {
      return this.pdfTable[x - this.p.min]
    }
  }

  _cdf (x) {
    return Math.min(1, this.cdfTable[x - this.p.min])
  }
}

/**
 * Generator for the [Bernoulli distribution]{@link https://en.wikipedia.org/wiki/Bernoulli_distribution}:
 *
 * $$f(k; p) = \begin{cases}p &\quad\text{if $k = 1$},\\\1 - p &\quad\text{if $k = 0$},\\\\\end{cases},$$
 *
 * where $p \in \[0, 1\]$. Support: $k \in \\{0, 1\\}$.
 *
 * @class Bernoulli
 * @memberof ran.dist
 * @param {number=} p Probability of the outcome 1. Default value is 0.5.
 * @constructor
 */
class bernoulli extends Categorical {
  // Special case of categorical
  constructor (p = 0.5) {
    super([1 - p, p]);

    // Validate parameter
    Distribution.validate({ p }, [
      'p >= 0',
      'p <= 1'
    ]);
  }

  _q (p) {
    return p > 1 - this.p.p ? 1 : 0
  }
}

/**
 * Generator for the [beta-binomial distribution]{@link https://en.wikipedia.org/wiki/Beta-binomial_distribution}:
 *
 * $$f(k; n, \alpha, \beta) = \begin{pmatrix}n \\\\ k \\\\ \end{pmatrix} \frac{\mathrm{B}(\alpha + k, \beta + n - k)}{\mathrm{B}(\alpha, \beta)},$$
 *
 * with $n \in \mathbb{N}_0$ and $\alpha, \beta > 0$. Support: $k \in \{0, ..., n\}$.
 *
 * @class BetaBinomial
 * @memberof ran.dist
 * @param {number=} n Number of trials. Default value is 10.
 * @param {number=} alpha First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 2.
 * @constructor
 */
class betaBinomial extends Categorical {
  // Special case of categorical
  constructor (n = 10, alpha = 1, beta = 2) {
    const ni = Math.round(n);
    super(Array.from({ length: ni + 1 }, (d, i) => Math.exp(logBinomial(ni, i) + logBeta(i + alpha, ni - i + beta) - logBeta(alpha, beta))));

    // Validate parameters
    Distribution.validate({ n: ni, alpha, beta }, [
      'n >= 0',
      'alpha > 0',
      'beta > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: ni,
      closed: true
    }];
  }
}

/**
 * Generator for the [beta prime distribution]{@link https://en.wikipedia.org/wiki/Beta_prime_distribution} (also
 * known as inverted beta):
 *
 * $$f(x; \alpha, \beta) = \frac{x^{\alpha - 1}(1 + x)^{-\alpha - \beta}}{\mathrm{B}(\alpha, \beta)},$$
 *
 * with $\alpha, \beta > 0$ and $\mathrm{B}(x, y)$ is the beta function.
 * Support: $x > 0$.
 *
 * @class BetaPrime
 * @memberof ran.dist
 * @param {number=} alpha First shape parameter. Default value is 2.
 * @param {number=} beta Second shape parameter. Default value is 2.
 * @constructor
 */
class betaPrime extends Beta {
  // Transformation of beta distribution
  constructor (alpha = 2, beta = 2) {
    super(alpha, beta);

    // Set support
    this.s = [{
      value: 0,
      closed: alpha >= 1
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling from gamma (ignoring super)
    const x = gamma(this.r, this.p.alpha, 1);

    const y = gamma(this.r, this.p.beta, 1);
    return x / y
  }

  _pdf (x) {
    return super._pdf(x / (1 + x)) / Math.pow(1 + x, 2)
  }

  _cdf (x) {
    return super._cdf(x / (1 + x))
  }
}

/**
 * Generator for the [beta-rectangular distribution]{@link https://en.wikipedia.org/wiki/Beta_rectangular_distribution}:
 *
 * $$f(x; \alpha, \beta, \theta, a, b) = \theta \frac{(x - a)^{\alpha - 1} (b - x)^{\beta - 1}}{\mathrm{B}(\alpha, \beta) (b - a)^{\alpha + \beta - 1}} + \frac{1 - \theta}{b - a},$$
 *
 * with $\alpha, \beta > 0$, $\theta \in \[0, 1\]$, $a, b \in \mathbb{R}$, $a < b$ and $\mathrm{B}(x, y)$ is the beta function. Support: $x \in \[a, b\]$.
 *
 * @class BetaRectangular
 * @memberof ran.dist
 * @param {number=} alpha First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @param {number=} theta Mixture parameter. Default value is 0.5.
 * @param {number=} a Lower boundary of the support. Default value is 0.
 * @param {number=} b Upper boundary of the support. Default value is 1.
 * @constructor
 */
class betaRectangular extends Beta {
  constructor (alpha = 1, beta = 1, theta = 0.5, a = 0, b = 1) {
    super(alpha, beta);

    // Validate parameters
    this.p = Object.assign(this.p, { theta, a, b });
    Distribution.validate({ theta, a, b }, [
      'theta >= 0', 'theta <= 1',
      'a < b'
    ]);

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }];

    // Speed-up constants. Note that Beta has 3 speed-up constants
    this.c = this.c.concat([
      b - a,
      1 - theta
    ]);
  }

  _generator () {
    // Direct sampling by mixing beta and uniform variates
    return this.r.next() < this.p.theta
      ? super._generator() * this.c[3] + this.p.a
      : this.r.next() * this.c[3] + this.p.a
  }

  _pdf (x) {
    return (this.p.theta * super._pdf((x - this.p.a) / this.c[3]) + this.c[4]) / this.c[3]
  }

  _cdf (x) {
    const y = x - this.p.a;
    return this.p.theta * super._cdf(y / this.c[3]) + this.c[4] * y / this.c[3]
  }
}

/**
 * Generator for the [binomial distribution]{@link https://en.wikipedia.org/wiki/Binomial_distribution}:
 *
 * $$f(k; n, p) = \begin{pmatrix}n \\\\ k \\\\ \end{pmatrix} p^k (1 - p)^{n - k},$$
 *
 * with $n \in \mathbb{N}_0$ and $p \in \[0, 1\]$. Support: $k \in \{0, ..., n\}$.
 *
 * @class Binomial
 * @memberof ran.dist
 * @param {number=} n Number of trials. Default value is 100.
 * @param {number=} p Probability of success. Default value is 0.5.
 * @constructor
 */
class binomial extends Categorical {
  // Special case of categorical
  constructor (n = 100, p = 0.5) {
    const ni = Math.round(n);
    super(Array.from({ length: ni + 1 }, (d, k) => Math.exp(logBinomial(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p))));

    // Validate parameters
    Distribution.validate({ n: ni, p }, [
      'n >= 0',
      'p >= 0', 'p <= 1'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: ni,
      closed: true
    }];
  }
}

/**
 * Generator for the [normal distribution]{@link https://en.wikipedia.org/wiki/Normal_distribution}:
 *
 * $$f(x; \mu, \sigma) = \frac{1}{\sqrt{2 \pi \sigma^2}} e^{-\frac{(x - \mu)^2}{2\sigma^2}},$$
 *
 * with $\mu \in \mathbb{R}$ and $\sigma > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class Normal
 * @memberof ran.dist
 * @param {number=} mu Location parameter (mean). Default value is 0.
 * @param {number=} sigma Squared scale parameter (variance). Default value is 1.
 * @constructor
 */
class Normal extends Distribution {
  constructor (mu = 0, sigma = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { mu, sigma };
    Distribution.validate({ mu, sigma }, [
      'sigma > 0'
    ]);

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      sigma * Math.sqrt(2 * Math.PI),
      sigma * Math.SQRT2
    ];
  }

  _generator () {
    // Direct sampling
    return normal(this.r, this.p.mu, this.p.sigma)
  }

  _pdf (x) {
    return Math.exp(-0.5 * Math.pow((x - this.p.mu) / this.p.sigma, 2)) / this.c[0]
  }

  _cdf (x) {
    return 0.5 * (1 + erf((x - this.p.mu) / this.c[1]))
  }

  _q (p) {
    return this.p.mu + this.c[1] * erfinv(2 * p - 1)
  }
}

/**
 * Generator for the [Birnbaum-Saunders distribution]{@link https://en.wikipedia.org/wiki/Birnbaum%E2%80%93Saunders_distribution} (also known as fatigue life distribution):
 *
 * $$f(x; \mu, \beta, \gamma) = \frac{z + 1 / z}{2 \gamma (x - \mu)} \phi\Big(\frac{z - 1 / z}{\gamma}\Big),$$
 *
 * with $\mu \in \mathbb{R}$, $\beta, \gamma > 0$, $z = \sqrt{\frac{x - \mu}{\beta}}$ and $\phi(x)$ is the probability density function of the standard [normal distribution]{@link #dist.Normal}. Support: $x \in (\mu, \infty)$.
 *
 * @class BirnbaumSaunders
 * @memberof ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} beta Scale parameter. Default value is 1.
 * @param {number=} gamma Shape parameter. Default value is 1.
 * @constructor
 */
class birnbaumSaunders extends Normal {
  // Transformation of normal distribution
  constructor (mu = 0, beta = 1, gamma = 1) {
    super();

    // Validate parameters
    this.p = Object.assign(this.p, { mu2: mu, beta, gamma });
    Distribution.validate({ mu, beta, gamma }, [
      'beta > 0',
      'gamma > 0'
    ]);

    // Set support
    this.s = [{
      value: mu,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling by transforming normal variate
    const n = this.p.gamma * super._generator();
    return this.p.beta * 0.25 * Math.pow(n + Math.sqrt(4 + Math.pow(n, 2)), 2) + this.p.mu2
  }

  _pdf (x) {
    const z = Math.sqrt((x - this.p.mu2) / this.p.beta);
    return (z + 1 / z) * super._pdf((z - 1 / z) / this.p.gamma) / (2 * this.p.gamma * (x - this.p.mu2))
  }

  _cdf (x) {
    const z = Math.sqrt((x - this.p.mu2) / this.p.beta);
    return super._cdf((z - 1 / z) / this.p.gamma)
  }

  _q (p) {
    const n = this.p.gamma * super._q(p);
    return this.p.beta * 0.25 * Math.pow(n + Math.sqrt(4 + Math.pow(n, 2)), 2) + this.p.mu2
  }
}

/**
 * Base class representing a discrete distribution with pre-computed arrays. This class should be used only when the
 * cumulative probability function is not available in closed form. A basic adaptive alias table is also implemented for
 * the case when there is no simple method to generate random variates.
 *
 * @class PreComputed
 * @memberof ran.dist
 * @abstract
 * @private
 */
class PreComputed extends Distribution {
  constructor (logP = false) {
    super('discrete', arguments.length);

    // Constants
    this.TABLE_SIZE = 1000;
    this.MAX_NUMBER_OF_TABLES = 100;

    // Logarithmic pdf
    this.logP = logP;

    // Look-up tables
    this.aliasTables = [];
    this.pdfTable = [];
    this.cdfTable = [];
  }

  /**
   * Computes the probability mass value for a specified index.
   *
   * @method _pk
   * @memberof ran.dist.PreComputed
   * @param {number} k Index to computed probability for.
   * @returns {number} The probability for the specified index.
   * @private
   */
  _pk (k) {
    throw Error('PreComputed._pk() is not implemented')
  }

  /**
   * Advances look-up tables for PDF and CDF up to a specific index.
   *
   * @method _advance
   * @memberof ran.dist.PreComputed
   * @param {number} x The index to advance look-up tables to.
   * @private
   */
  _advance (x) {
    for (let k = this.pdfTable.length; k <= x; k++) {
      // Update probability mass
      const pdf = this._pk(k);
      this.pdfTable.push(pdf);

      // Update cumulative function
      if (typeof this._ck === 'function') {
        this.cdfTable.push(this._ck(k));
      } else {
        this.cdfTable.push((this.cdfTable[this.cdfTable.length - 1] || 0) + (this.logP ? Math.exp(pdf) : pdf));
      }
    }
  }

  /**
   * Adds a new alias table.
   *
   * @method _addAliasTable
   * @memberof ran.dist.PreComputed
   * @private
   */
  _addAliasTable () {
    // Calculate index offset
    const offset = this.aliasTables.length;

    // Compute weights and total weight
    const weights = Array.from({ length: this.TABLE_SIZE }, (d, i) => this._pdf(this.TABLE_SIZE * offset + i));
    let total = weights.reduce((acc, d) => acc + d, 0);
    if (offset > 0) {
      // Add previously accumulated total weight
      total += this.aliasTables[offset - 1].total;
    }

    // Add table
    this.aliasTables.push({
      table: new AliasTable(weights.concat([1 - total])),
      total
    });
  }

  _generator () {
    // Start with first table
    let tableIndex = 0;
    do {
      // Add table if needed
      if (tableIndex >= this.aliasTables.length) {
        this._addAliasTable();
      }

      // Sample from current table
      const i = this.aliasTables[tableIndex].table.sample(this.r);

      // Check if sample is outside of table domain
      if (i === this.TABLE_SIZE) {
        // Increment table index and add new table if needed
        tableIndex++;
      } else {
        // Otherwise, return sample
        return i + tableIndex * this.TABLE_SIZE
      }
    } while (tableIndex < this.MAX_NUMBER_OF_TABLES)

    // TODO Should throw an error
    // If did not find sample in max number of tables, return undefined
  }

  _pdf (x) {
    // Check if we already have it in the look-up table
    if (x < this.pdfTable.length) {
      return this.logP ? Math.exp(this.pdfTable[x]) : this.pdfTable[x]
    }

    // If not, compute new values and return f(x)
    this._advance(x);
    return this.logP ? Math.exp(this.pdfTable[x]) : this.pdfTable[x]
  }

  _cdf (x) {
    // If already in table, return value
    if (x < this.cdfTable.length) {
      return this.cdfTable[x]
    }

    // Otherwise, advance to current index and return F(x)
    this._advance(x);
    return Math.min(1, this.cdfTable[x])
  }
}

/**
 * Generator for the [Borel distribution]{@link https://en.wikipedia.org/wiki/Borel_distribution}:
 *
 * $$f(k; \mu) = \frac{e^{-\mu k} (\mu k)^{k - 1}}{k!},$$
 *
 * where $\mu \in \[0, 1\]$. Support: $k \in \mathbb{N}^+$.
 *
 * @class Borel
 * @memberof ran.dist
 * @param {number} mu Distribution parameter. Default value is 0.5.
 * @constructor
 */
class borel extends PreComputed {
  constructor (mu = 0.5) {
    super(true);

    // Validate parameters
    this.p = { mu };
    Distribution.validate({ mu }, [
      'mu >= 0', 'mu <= 1'
    ]);

    // Set support
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _pk (k) {
    if (k < 1) {
      return -Infinity
    }

    // mu = 0 case
    if (this.p.mu < Number.EPSILON) {
      return k === 1 ? 0 : -Infinity
    }

    return (k - 1) * Math.log(this.p.mu * k) - this.p.mu * k - logGamma$1(k + 1)
  }
}

/**
 * Generator for the [Borel-Tanner distribution]{@link https://en.wikipedia.org/wiki/Borel_distribution#Borel%E2%80%93Tanner_distribution}:
 *
 * $$f(k; \mu, n) = \frac{n}{k}\frac{e^{-\mu k} (\mu k)^{k - n}}{(k - n)!},$$
 *
 * where $\mu \in \[0, 1\]$ and $n \in \mathbb{N}^+$. Support: $k \ge n$.
 *
 * @class BorelTanner
 * @memberof ran.dist
 * @param {number} mu Distribution parameter. Default value is 0.5.
 * @param {number} n Number of Borel distributed variates to add. If not an integer, it is rounded to the nearest one.
 * Default value is 2.
 * @constructor
 */
class borelTanner extends PreComputed {
  constructor (mu = 0.5, n = 2) {
    super();

    // Validate parameters
    const ni = Math.round(n);
    this.p = { mu, n: ni };
    Distribution.validate({ mu, n: ni }, [
      'mu >= 0', 'mu <= 1',
      'n > 0'
    ]);

    // Set support
    this.s = [{
      value: ni,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _pk (k) {
    if (k < this.p.n) {
      return 0
    }

    // mu = 0 case
    if (this.p.mu < Number.EPSILON) {
      return k === this.p.n ? 1 : 0
    }

    const kn = k - this.p.n;
    return (this.p.n / k) * Math.exp(kn * Math.log(this.p.mu * k) - this.p.mu * k - logGamma$1(kn + 1))
  }
}

/**
 * Generator for the [bounded Pareto distribution]{@link https://en.wikipedia.org/wiki/Pareto_distribution#Bounded_Pareto_distribution}:
 *
 * $$f(x; L, H, \alpha) = \frac{\alpha L^\alpha x^{-\alpha - 1}}{1 - \big(\frac{L}{H}\big)^\alpha},$$
 *
 * with $L, H > 0$, $H > L$ and $\alpha > 0$. Support: $x \in \[L, H\]$.
 *
 * @class BoundedPareto
 * @memberof ran.dist
 * @param {number=} L Lower boundary. Default value is 1.
 * @param {number=} H Upper boundary. Default value is 10.
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @constructor
 */
class boundedPareto extends Distribution {
  constructor (L = 1, H = 10, alpha = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { L, H, alpha };
    Distribution.validate({ L, H, alpha }, [
      'L > 0',
      'H > 0',
      'L < H',
      'alpha > 0'
    ]);

    // Set support
    this.s = [{
      value: L,
      closed: true
    }, {
      value: H,
      closed: true
    }];

    // Speed-up constants
    this.c = [
      Math.pow(L, alpha),
      Math.pow(H, alpha),
      (1 - Math.pow(L / H, alpha))
    ];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.p.alpha * Math.pow(this.p.L / x, this.p.alpha) / (x * this.c[2])
  }

  _cdf (x) {
    return (1 - this.c[0] * Math.pow(x, -this.p.alpha)) / this.c[2]
  }

  _q (p) {
    return Math.pow((this.c[1] + p * (this.c[0] - this.c[1])) / (this.c[0] * this.c[1]), -1 / this.p.alpha)
  }
}

/**
 * Generator for the [Bradford distribution]{@link https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.bradford.html}:
 *
 * $$f(x; c) = \frac{c}{\ln(1 + c) (1 + c x)},$$
 *
 * with $c > 0$. Support: $x \in \[0, 1\]$.
 *
 * @class Bradford
 * @memberof ran.dist
 * @param {number=} c Shape parameter. Default value is 1.
 * @constructor
 */
class bradford extends Distribution {
  constructor (c = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { c };
    Distribution.validate({ c }, [
      'c > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: 1,
      closed: true
    }];

    // Speed-up constants
    const c0 = Math.log(1 + c);
    this.c = [
      c0,
      c / c0
    ];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.c[1] / (1 + this.p.c * x)
  }

  _cdf (x) {
    return Math.log(1 + this.p.c * x) / this.c[0]
  }

  _q (p) {
    return (Math.exp(this.c[0] * p) - 1) / this.p.c
  }
}

/**
 * Generator for the [Burr (XII) distribution]{@link https://en.wikipedia.org/wiki/Burr_distribution} (also known as
 * Singh-Maddala distribution):
 *
 * $$f(x; c, k) = c k \frac{x^{c - 1}}{(1 + x^c)^{k + 1}},$$
 *
 * with $c, k > 0$. Support: $x > 0$.
 *
 * @class Burr
 * @memberof ran.dist
 * @param {number=} c First shape parameter. Default value is 1.
 * @param {number=} k Second shape parameter. Default value is 1.
 * @constructor
 */
class burr extends Distribution {
  constructor (c = 1, k = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { c, k };
    Distribution.validate({ c, k }, [
      'c > 0',
      'k > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      c * k,
      -1 / k,
      1 / c
    ];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const y = Math.pow(x, this.p.c);
    return this.c[0] * y / (x * Math.pow(1 + y, this.p.k + 1))
  }

  _cdf (x) {
    return 1 - Math.pow(1 + Math.pow(x, this.p.c), -this.p.k)
  }

  _q (p) {
    return Math.pow(Math.pow(1 - p, this.c[1]) - 1, this.c[2])
  }
}

/**
 * Generator for the [Cauchy distribution]{@link https://en.wikipedia.org/wiki/Cauchy_distribution}:
 *
 * $$f(x; x_0, \gamma) = \frac{1}{\pi\gamma\bigg\[1 + \Big(\frac{x - x_0}{\gamma}\Big)^2\bigg\]}$$
 *
 * where $x_0 \in \mathbb{R}$ and $\gamma > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class Cauchy
 * @memberof ran.dist
 * @param {number=} x0 Location parameter. Default value is 0.
 * @param {number=} gamma Scale parameter. Default value is 1.
 * @constructor
 */
class Cauchy extends Distribution {
  constructor (x0 = 0, gamma = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { x0, gamma };
    Distribution.validate({ x0, gamma }, [
      'gamma > 0'
    ]);

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      Math.PI * this.p.gamma
    ];
  }

  _generator () {
    // Inverse transform sampling
    return this.p.x0 + this.p.gamma * (Math.tan(Math.PI * (this.r.next() - 0.5)))
  }

  _pdf (x) {
    const y = (x - this.p.x0) / this.p.gamma;
    return 1 / (this.c[0] * (1 + y * y))
  }

  _cdf (x) {
    return 0.5 + Math.atan2(x - this.p.x0, this.p.gamma) / Math.PI
  }

  _q (p) {
    return this.p.x0 + this.p.gamma * (Math.tan(Math.PI * (p - 0.5)))
  }
}

/**
 * Generator for the [gamma distribution]{@link https://en.wikipedia.org/wiki/Gamma_distribution} using the
 * shape/rate parametrization:
 *
 * $$f(x; \alpha, \beta) = \frac{\beta^\alpha}{\Gamma(\alpha)} x^{\alpha - 1} e^{-\beta x},$$
 *
 * where $\alpha, \beta > 0$. Support: $x > 0$.
 *
 * @class Gamma
 * @memberof ran.dist
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @param {number=} beta Rate parameter. Default value is 1.
 * @constructor
 */
class Gamma extends Distribution {
  constructor (alpha = 1, beta = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { alpha, beta };
    Distribution.validate({ alpha, beta }, [
      'alpha > 0',
      'beta > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: alpha >= 1
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling
    return gamma(this.r, this.p.alpha, this.p.beta)
  }

  _pdf (x) {
    return Math.exp(this.p.alpha * Math.log(this.p.beta) - this.p.beta * x - logGamma$1(this.p.alpha)) * Math.pow(x, this.p.alpha - 1)
  }

  _cdf (x) {
    return gammaLowerIncomplete(this.p.alpha, this.p.beta * x)
  }
}

/**
 * Generator for the [$\chi^2$ distribution]{@link https://en.wikipedia.org/wiki/Chi-squared_distribution}:
 *
 * $$f(x; k) = \frac{1}{2^{k/2} \Gamma(k/2)} x^{k/2 - 1} e^{-x/2},$$
 *
 * where $k \in \mathbb{N}^+$. Support: $x > 0$.
 *
 * @class Chi2
 * @memberof ran.dist
 * @param {number=} k Degrees of freedom. If not an integer, is rounded to the nearest one. Default value is 2.
 * @constructor
 */
class Chi2 extends Gamma {
  // Special case of gamma
  constructor (k = 2) {
    super(Math.round(k) / 2, 0.5);

    // Validate parameters
    Distribution.validate({ k }, [
      'k > 0'
    ]);
  }
}

/**
 * Generator for the [$\chi$ distribution]{@link https://en.wikipedia.org/wiki/Chi_distribution}:
 *
 * $$f(x; k) = \frac{1}{2^{k/2 - 1} \Gamma(k/2)} x^{k - 1} e^{-x^2/2},$$
 *
 * where $k \in \mathbb{N}^+$. Support: $x > 0$.
 *
 * @class Chi
 * @memberof ran.dist
 * @param {number=} k Degrees of freedom. If not an integer, is rounded to the nearest integer. Default value is 2.
 * @constructor
 */
class chi extends Chi2 {
  // Transformation of chi2 distribution
  constructor (k = 2) {
    super(k);

    // Validate parameters
    const ki = Math.round(k);
    this.p = Object.assign(this.p, { k: ki });
    Distribution.validate({ k: ki }, [
      'k > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling by transforming chi2 variate
    return Math.sqrt(super._generator())
  }

  _pdf (x) {
    if (this.p.k === 1 && x === 0) {
      return Math.sqrt(2 / Math.PI)
    } else {
      return 2 * x * super._pdf(x * x)
    }
  }

  _cdf (x) {
    return super._cdf(x * x)
  }
}

/**
 * Generator for the [Dagum distribution]{@link https://en.wikipedia.org/wiki/Dagum_distribution}:
 *
 * $$f(x; p, a, b) = \frac{ap}{x} \frac{\big(\frac{x}{b}\big)^{ap}}{\Big\[\big(\frac{x}{b}\big)^a + 1\Big\]^{p + 1}},$$
 *
 * with $p, a, b > 0$. Support: $x > 0$.
 *
 * @class Dagum
 * @memberof ran.dist
 * @param {number=} p First shape parameter. Default value is 1.
 * @param {number=} a Second shape parameter. Default value is 1.
 * @param {number=} b Scale parameter. Default value is 1.
 */
class Dagum extends Distribution {
  constructor (p = 1, a = 1, b = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { p, a, b };
    Distribution.validate({ p, a, b }, [
      'p > 0',
      'a > 0',
      'b > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const y = Math.pow(x / this.p.b, this.p.a);
    return this.p.a * this.p.p * Math.pow(y, this.p.p) / (x * Math.pow(y + 1, this.p.p + 1))
  }

  _cdf (x) {
    return Math.pow(1 + Math.pow(x / this.p.b, -this.p.a), -this.p.p)
  }

  _q (p) {
    return this.p.b * Math.pow(Math.pow(p, -1 / this.p.p) - 1, -1 / this.p.a)
  }
}

/**
 * Generator for the [degenerate distribution]{@link https://en.wikipedia.org/wiki/Degenerate_distribution}:
 *
 * $$f(x; x_0) = \begin{cases}1 &\quad\text{if $x = x_0$}\\\\0 &\quad\text{otherwise}\\\\\\end{cases},$$
 *
 * where $x_0 \in \mathbb{R}$. Support: $x \in \mathbb{R}$.
 *
 * @class Degenerate
 * @memberof ran.dist
 * @param {number=} x0 Location of the distribution. Default value is 0.
 * @constructor
 */
class degenerate extends Distribution {
  constructor (x0 = 0) {
    super('continuous', arguments.length);
    this.p = { x0 };
    this.s = [{
      value: x0,
      closed: true
    }, {
      value: x0,
      closed: true
    }];
  }

  _generator () {
    // Direct sampling
    return this.p.x0
  }

  _pdf () {
    return 1
  }
}

/**
 * Generates a Poisson random variate.
 *
 * @method poisson
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number} lambda Mean of the distribution.
 * @returns {number} Random variate.
 * @ignore
 */
function poisson$1 (r, lambda) {
  if (lambda < 30) {
    // Small lambda, Knuth's method
    const l = Math.exp(-lambda);

    let k = 0;

    let p = 1;
    do {
      k++;
      p *= r.next();
    } while (p > l)
    return k - 1
  } else {
    // Large lambda, normal approximation
    const c = 0.767 - 3.36 / lambda;

    const b = Math.PI / Math.sqrt(3 * lambda);

    const alpha = b * lambda;

    const k = Math.log(c) - lambda - Math.log(b);

    // Max 1000 trials
    for (let trials = 0; trials < 1000; trials++) {
      let u, x, n;
      do {
        u = r.next();
        x = (alpha - Math.log((1 - u) / u)) / b;
        n = Math.floor(x + 0.5);
      } while (n < 0)
      const v = r.next();

      const y = alpha - b * x;

      const lhs = y + Math.log(v / Math.pow(1.0 + Math.exp(y), 2));

      const rhs = k + n * Math.log(lambda) - logGamma$1(n + 1);
      if (lhs <= rhs) { return n }
    }
  }
}

/**
 * Generator for the [Delaporte distribution]{@link https://en.wikipedia.org/wiki/Delaporte_distribution}:
 *
 * $$f(k; \alpha, \beta, \lambda) = \frac{e^{-\lambda}}{\Gamma(\alpha)}\sum_{j = 0}^k \frac{\Gamma(\alpha + j) \beta^j \lambda^{k - j}}{j! (1 + \beta)^{\alpha + j} (k - j)!},$$
 *
 * with $\alpha, \beta, \lambda > 0$. Support: $k \in \mathbb{N}_0$. For $\lambda = 0$, it is the [negative binomial]{@link #dist.NegativeBinomial}, and for $\alpha = \beta = 0$ it is the [Poisson distribution]{@link #dist.Poisson}. Note that these special cases are not covered by this class. For these distributions, please refer to the corresponding generators.
 *
 * @class Delaporte
 * @memberof ran.dist
 * @param {number=} alpha Shape parameter of the gamma component. Default component is 1.
 * @param {number=} beta Scale parameter of the gamma component. Default value is 1.
 * @param {number=} lambda Mean of the Poisson component. Default value is 1.
 * @constructor
 */
class delaporte extends PreComputed {
  constructor (alpha = 1, beta = 1, lambda = 1) {
    // Using raw probability mass values
    super(true);

    // Validate parameters
    this.p = { alpha, beta, lambda };
    Distribution.validate({ alpha, beta, lambda }, [
      'alpha > 0',
      'beta > 0',
      'lambda > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      beta / (lambda * (1 + beta)),
      -lambda - alpha * Math.log(1 + beta),
      Math.log(lambda)
    ];
  }

  _pk (k) {
    // Set i = 0 term
    let ki = k;
    let dz = 1;
    let z = dz;

    // Advance until k - 1
    for (let j = 1; j < k; j++) {
      dz *= (this.p.alpha + j - 1) * this.c[0] * ki / j;
      ki--;
      z += dz;
    }

    // If k > 0, add last term
    if (k > 0) {
      dz *= (this.p.alpha + k - 1) * this.c[0] / k;
      z += dz;
    }

    // Return sum with constants
    return Math.log(z) + k * this.c[2] - logGamma$1(k + 1) + this.c[1]
  }

  _generator () {
    // Direct sampling as compound Poisson
    const j = gamma(this.r, this.p.alpha, 1 / this.p.beta);
    return poisson$1(this.r, this.p.lambda + j)
  }
}

/**
 * Generator for the discrete
 * [uniform distribution]{@link https://en.wikipedia.org/wiki/Discrete_uniform_distribution}:
 *
 * $$f(k; x_\mathrm{min}, x_\mathrm{max}) = \frac{1}{x_\mathrm{max} - x_\mathrm{min} + 1},$$
 *
 * with $x_\mathrm{min}, x_\mathrm{max} \in \mathbb{Z}$ and $x_\mathrm{min} < x_\mathrm{max}$. Support: $k \in \{x_\mathrm{min}, ..., x_\mathrm{max}\}$.
 *
 * @class DiscreteUniform
 * @memberof ran.dist
 * @param {number=} xmin Lower boundary. If not an integer, it is rounded to the nearest one. Default value is 0.
 * @param {number=} xmax Upper boundary. If not an integer, it is rounded to the nearest one. Default value is 100.
 * @constructor
 */
class discreteUniform extends Distribution {
  constructor (xmin = 0, xmax = 100) {
    super('discrete', arguments.length);

    // Validate parameters
    const xmini = Math.round(xmin);
    const xmaxi = Math.round(xmax);
    this.p = { xmin: xmini, xmax: xmaxi };
    Distribution.validate({ xmin: xmini, xmax: xmaxi }, [
      'xmin <= xmax'
    ]);

    // Set support
    this.s = [{
      value: this.p.xmin,
      closed: true
    }, {
      value: this.p.xmax,
      closed: true
    }];

    // Speed-up constants
    this.c = [
      this.p.xmax - this.p.xmin + 1
    ];
  }

  _generator () {
    // Direct sampling
    return this._q(this.r.next())
  }

  _pdf () {
    return 1 / this.c[0]
  }

  _cdf (x) {
    return (1 + x - this.p.xmin) / this.c[0]
  }

  _q (p) {
    return Math.floor(p * this.c[0]) + this.p.xmin
  }
}

/**
 * Generator for the [discrete Weibull distribution]{@link https://en.wikipedia.org/wiki/Discrete_Weibull_distribution} (using the original parametrization):
 *
 * $$f(k; q, \beta) = q^{k^\beta} - q^{(k + 1)^\beta},$$
 *
 * with $q \in (0, 1)$ and $\beta > 0$. Support: $k \in \mathbb{N}_0$.
 *
 * @class DiscreteWeibull
 * @memberof ran.dist
 * @param {number=} q First shape parameter. Default value is 0.5.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @constructor
 */
class discreteWeibull extends Distribution {
  constructor (q = 0.5, beta = 1) {
    super('discrete', arguments.length);

    // Validate parameters
    this.p = { q, beta };
    Distribution.validate({ q, beta }, [
      'q > 0', 'q < 1',
      'beta > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return Math.pow(this.p.q, Math.pow(x, this.p.beta)) - Math.pow(this.p.q, Math.pow(x + 1, this.p.beta))
  }

  _cdf (x) {
    return 1 - Math.pow(this.p.q, Math.pow(x + 1, this.p.beta))
  }

  _q (p) {
    return Math.floor(Math.pow(Math.log(1 - p) / Math.log(this.p.q), 1 / this.p.beta))
  }
}

/**
 * Generator for the [double gamma distribution]{@link https://docs.scipy.org/doc/scipy/tutorial/stats/continuous_dgamma.html}
 * (with the same shape/rate parametrization that the [gamma distribution]{@link #dist.Gamma} uses):
 *
 * $$f(x; \alpha, \beta) = \frac{\beta^\alpha}{2 \Gamma(\alpha)} |x|^{\alpha - 1} e^{-\beta |x|},$$
 *
 * where $\alpha, \beta > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class DoubleGamma
 * @memberof ran.dist
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @param {number=} beta Rate parameter. Default value is 1.
 * @constructor
 */
class doubleGamma extends Gamma {
  // Transformation of gamma
  constructor (alpha = 1, beta = 1) {
    super(alpha, beta);

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    return super._generator() * (this.r.next() < 0.5 ? -1 : 1)
  }

  _pdf (x) {
    return super._pdf(Math.abs(x)) / 2
  }

  _cdf (x) {
    const y = super._cdf(Math.abs(x));
    return (x > 0 ? 1 + y : 1 - y) / 2
  }
}

/**
 * Generates a exponential random variate.
 *
 * @method exponential
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number=} lambda Rate parameter. Default value is 1.
 * @returns {number} Random variate.
 * @ignore
 */
function exponential (r, lambda = 1) {
  return -Math.log(r.next()) / lambda
}

/**
 * Generator for the [exponential distribution]{@link https://en.wikipedia.org/wiki/Exponential_distribution}:
 *
 * $$f(x; \lambda) = \lambda e^{-\lambda x},$$
 *
 * with $\lambda > 0$. Support: $x \ge 0$.
 *
 * @class Exponential
 * @memberof ran.dist
 * @param {number=} lambda Rate parameter. Default value is 1.
 * @constructor
 */
class Exponential extends Distribution {
  constructor (lambda = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { lambda };
    Distribution.validate({ lambda }, [
      'lambda > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      Math.exp(-lambda)
    ];
  }

  _generator () {
    // Inverse transform sampling
    return exponential(this.r, this.p.lambda)
  }

  _pdf (x) {
    return this.p.lambda * Math.pow(this.c[0], x)
  }

  _cdf (x) {
    return 1 - Math.pow(this.c[0], x)
  }

  _q (p) {
    return -Math.log(1 - p) / this.p.lambda
  }
}

/**
 * Generator for the [Weibull distribution]{@link https://en.wikipedia.org/wiki/Weibull_distribution}:
 *
 * $$f(x; \lambda, k) = \frac{k}{\lambda}\bigg(\frac{x}{\lambda}\bigg)^{k - 1} e^{-(x / \lambda)^k},$$
 *
 * with $\lambda, k > 0$. Support: $x \ge 0$.
 *
 * @class Weibull
 * @memberof ran.dist
 * @param {number=} lambda Scale parameter. Default value is 1.
 * @param {number=} k Shape parameter. Default value is 1.
 * @constructor
 */
class Weibull extends Exponential {
  // Transformation of exponential distribution
  constructor (lambda = 1, k = 1) {
    super(1);

    // Validate parameters
    this.p = Object.assign(this.p, { lambda2: lambda, k });
    Distribution.validate({ lambda, k }, [
      'lambda > 0',
      'k > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: k >= 1
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Inverse transform sampling.
    return this._q(this.r.next())
  }

  _pdf (x) {
    const t = x / this.p.lambda2;
    return this.p.k * Math.pow(t, this.p.k - 1) * super._pdf(Math.pow(t, this.p.k)) / this.p.lambda2
  }

  _cdf (x) {
    return super._cdf(Math.pow(x / this.p.lambda2, this.p.k))
  }

  _q (p) {
    return this.p.lambda2 * Math.pow(-Math.log(1 - p), 1 / this.p.k)
  }
}

/**
 * Generator for the [double Weibull distribution]{@link https://docs.scipy.org/doc/scipy/tutorial/stats/continuous_dweibull.html}:
 *
 * $$f(x; \lambda, k) = \frac{k}{\lambda}\bigg(\frac{|x|}{\lambda}\bigg)^{k - 1} e^{-(|x| / \lambda)^k},$$
 *
 * with $\lambda, k > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class DoubleWeibull
 * @memberof ran.dist
 * @param {number=} lambda Scale parameter. Default value is 1.
 * @param {number=} k Shape parameter. Default value is 1.
 * @constructor
 */
class doubleWeibull extends Weibull {
  // Transformation of Weibull
  constructor (lambda = 1, k = 1) {
    super(lambda, k);

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    return super._generator() * (this.r.next() < 0.5 ? -1 : 1)
  }

  _pdf (x) {
    return super._pdf(Math.abs(x)) / 2
  }

  _cdf (x) {
    const y = super._cdf(Math.abs(x));
    return (x > 0 ? 1 + y : 1 - y) / 2
  }

  _q (p) {
    return p > 0.5
      ? super._q(2 * p - 1)
      : -super._q(1 - 2 * p)
  }
}

/**
 * Clamps a value between a specific range.
 *
 * @method clamp
 * @memberof ran.utils
 * @param {number} x Value to clamp.
 * @param {number=} a Lower bound of the clamping range. Default value is 0.
 * @param {number=} b Upper bound of the clamping range. Default value is 1.
 * @return {number} The clamped value.
 * @private
 */
function clamp (x, a = 0, b = 1) {
  return Math.max(a, Math.min(b, x))
}

/**
 * Generates a non-central chi2 random variate.
 *
 * @method noncentralChi2
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number} k Degrees of freedom.
 * @param {number} lambda Non-centrality parameter.
 * @returns {number} Random variate.
 * @ignore
 */
function noncentralChi2 (r, k, lambda) {
  // Generated by a compound Poisson
  const j = poisson$1(r, lambda / 2);
  return gamma(r, k / 2 + j, 0.5)
}

/**
 * Generator for the [doubly non-central beta distribution]{@link https://rdrr.io/cran/sadists/f/inst/doc/sadists.pdf}:
 *
 * $$f(x; \alpha, \beta, \lambda_1, \lambda_2) = e^{-\frac{\lambda_1 + \lambda_2}{2}} \sum\_{k = 0}^\infty \sum\_{l = 0}^\infty \frac{\big(\frac{\lambda_1}{2}\big)^k}{k!} \frac{\big(\frac{\lambda_2}{2}\big)^l}{l!} \frac{x^{\alpha + k - 1} (1 - x)^{\beta + l - 1}}{\mathrm{B}\big(\alpha + k, \beta + l\big)},$$
 *
 * where $\alpha, \beta > 0$ and $\lambda_1, \lambda_2 \ge 0$. Support: $x \in (0, 1)$.
 *
 * @class DoublyNoncentralBeta
 * @memberof ran.dist
 * @param {number=} alpha First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @param {number=} lambda1 First non-centrality parameter. Default value is 1.
 * @param {number=} lambda2 Second non-centrality parameter. Default value is 1.
 * @constructor
 */
class DoublyNoncentralBeta extends Distribution {
  constructor (alpha = 1, beta = 1, lambda1 = 1, lambda2 = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { alpha, beta, lambda1, lambda2 };
    Distribution.validate({ alpha, beta, lambda1, lambda2 }, [
      'alpha > 0',
      'beta > 0',
      'lambda1 >= 0',
      'lambda2 >= 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: 1,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling from non-central chi2
    const x = noncentralChi2(this.r, 2 * this.p.alpha, this.p.lambda1);
    const y = noncentralChi2(this.r, 2 * this.p.beta, this.p.lambda2);
    const z = x / (x + y);

    // Handle 1 - z << 1 case
    if (z === 1) {
      return 1 - y / x
    } else {
      return z
    }
  }

  _pdf (x) {
    // Using outward summation
    const y = x / (1 - x);
    const ab = this.p.alpha + this.p.beta;

    // Speed-up constants
    const l1 = this.p.lambda1 / 2;
    const l2 = this.p.lambda2 / 2;

    // Initial indices
    const r0 = Math.round(l1);
    const s0 = Math.round(l2);

    // Init terms
    const pr0 = Math.exp(r0 * Math.log(l1) - logGamma$1(r0 + 1));
    const ps0 = Math.exp(s0 * Math.log(l2) - logGamma$1(s0 + 1));
    const psf0 = (s0 > 0 ? s0 : 1) * ps0 / l2;
    const yr0 = Math.pow(y, this.p.alpha + r0 - 2);
    const ys0 = Math.pow(1 + y, this.p.alpha + r0 + this.p.beta + s0 - 2);
    const b0 = beta(this.p.alpha + r0, this.p.beta + s0);
    let bf0 = b0;
    let bb0 = b0;

    // Init delta and sum
    let z = 0;

    // Forward r
    let ysf0 = ys0;
    let pyrf = yr0 * pr0 * (r0 > 0 ? r0 : 1) / l1;
    for (let kr = 0; kr < MAX_ITER; kr++) {
      const r = r0 + kr;
      const rAlpha = this.p.alpha + r;
      let dz = 0;

      // Update terms
      ysf0 *= 1 + y;
      pyrf *= y * l1 / (r > 0 ? r : 1);

      // Forward s
      dz += recursiveSum({
        y: ysf0 * (1 + y),
        p: psf0 * l2 / (s0 > 0 ? s0 : 1),
        b: bf0
      }, (t, i) => {
        const s = s0 + i;
        t.y *= 1 + y;
        t.p *= l2 / (s > 0 ? s : 1);
        return t
      }, t => pyrf * t.p / (t.b * t.y), (t, i) => {
        const s = s0 + i;
        t.b *= (this.p.beta + s) / (ab + r + s);
        return t
      });

      // Backward s
      if (s0 > 0) {
        dz += recursiveSum({
          y: ysf0,
          p: s0 * ps0 / l2,
          b: bf0 * (ab + r + s0 - 1) / (this.p.beta + s0 - 1)
        }, (t, i) => {
          const s = s0 - i - 1;
          if (s >= 0) {
            t.y /= 1 + y;
            t.p *= (s + 1) / l2;
            t.b *= (ab + r + s) / (this.p.beta + s);
          } else {
            t.p = 0;
          }
          return t
        }, t => pyrf * t.p / (t.b * t.y));
      }

      // Add s-terms
      z += dz;
      if (Math.abs(dz / z) < EPS) {
        break
      } else {
        bf0 *= rAlpha / (ab + r + s0);
      }
    }

    // Backward r
    if (r0 > 0) {
      let ysb0 = (1 + y) * ys0;
      let pyrb = y * yr0 * pr0;
      for (let r = r0 - 1; r >= 0; r--) {
        let dz = 0;
        const rAlpha = this.p.alpha + r;

        // Update terms
        ysb0 /= 1 + y;
        pyrb *= (r + 1) / (y * l1);
        bb0 *= (ab + r + s0) / rAlpha;

        // Forward s
        dz += recursiveSum({
          y: ysb0 * (1 + y),
          p: psf0 * l2 / (s0 > 0 ? s0 : 1),
          b: bb0
        }, (t, i) => {
          const s = s0 + i;
          t.y *= 1 + y;
          t.p *= l2 / (s > 0 ? s : 1);
          return t
        }, t => pyrb * t.p / (t.b * t.y), (t, i) => {
          const s = s0 + i;
          t.b *= (this.p.beta + s) / (ab + r + s);
          return t
        });

        // Backward s
        if (s0 > 0) {
          dz += recursiveSum({
            y: ysb0,
            p: ps0 * s0 / l2,
            b: bb0 * (ab + r + s0 - 1) / (this.p.beta + s0 - 1)
          }, (t, i) => {
            const s = s0 - i - 1;
            if (s >= 0) {
              t.y /= 1 + y;
              t.p *= (s + 1) / l2;
              t.b *= (ab + r + s) / (this.p.beta + s);
            } else {
              t.p = 0;
            }
            return t
          }, t => pyrb * t.p / (t.b * t.y));
        }

        // Add s-terms
        z += dz;
        if (Math.abs(dz / z) < EPS) {
          break
        }
      }
    }

    return Math.exp(-l1 - l2) * z / Math.pow(1 - x, 2)
  }

  _cdf (x) {
    // Using outward summation
    const r0 = Math.round(this.p.lambda1 / 2);
    const s0 = Math.round(this.p.lambda2 / 2);
    const sBeta0 = this.p.beta + s0 - 1;

    // Speed-up constants
    const l1 = this.p.lambda1 / 2;
    const l2 = this.p.lambda2 / 2;

    // Init terms
    const pr0 = Math.exp(r0 * Math.log(l1) - logGamma$1(r0 + 1));
    const ps0 = Math.exp(s0 * Math.log(l2) - logGamma$1(s0 + 1));
    const psf0 = (s0 > 0 ? s0 : 1) * ps0 / l2;
    const xa0 = Math.pow(x, this.p.alpha + r0);
    const xb0 = Math.pow(1 - x, this.p.beta + s0);
    const b0 = beta(this.p.alpha + r0, this.p.beta + s0);
    const ib0 = regularizedBetaIncomplete(this.p.alpha + r0, this.p.beta + s0, x);

    // Delta and sum
    let z = 0;

    // Forward r
    let prf = (r0 > 0 ? r0 : 1) * pr0 / l1;
    let xaf = xa0;
    let bf0 = b0;
    let ibf0 = ib0;
    for (let kr = 0; kr < MAX_ITER; kr++) {
      const r = r0 + kr;
      const rAlpha = this.p.alpha + r;
      let dz = 0;

      // Update terms
      prf *= l1 / (r > 0 ? r : 1);

      // Forward s
      dz += recursiveSum({
        p: psf0 * l2 / (s0 > 0 ? s0 : 1),
        xb: xb0,
        b: bf0,
        ib: ibf0
      }, (t, i) => {
        const s = s0 + i;
        t.p *= l2 / (s > 0 ? s : 1);
        return t
      }, t => prf * t.p * t.ib, (t, i) => {
        const s = s0 + i;
        const sBeta = this.p.beta + s;
        t.ib += xaf * t.xb / (sBeta * t.b);
        t.b *= sBeta / (rAlpha + sBeta);
        t.xb *= 1 - x;
        return t
      });

      // Backward s
      if (s0 > 0) {
        const xb = xb0 / (1 - x);
        const bfb = bf0 * (rAlpha + sBeta0) / sBeta0;
        dz += recursiveSum({
          p: ps0 * s0 / l2,
          xb,
          b: bfb,
          ib: ibf0 - xaf * xb / (sBeta0 * bfb)
        }, (t, i) => {
          const s = s0 - i - 1;
          const sBeta = this.p.beta + s;
          if (s >= 0) {
            t.p *= (s + 1) / l2;
            t.xb /= 1 - x;
            t.b *= (rAlpha + sBeta) / sBeta;
            t.ib -= xaf * t.xb / (sBeta * t.b);
          } else {
            t.p = 0;
            t.ib = 0;
          }

          return t
        }, t => prf * t.p * t.ib);
      }

      // Add s-terms
      z += dz;
      if (Math.abs(dz / z) < EPS) {
        break
      } else {
        ibf0 -= xaf * xb0 / (rAlpha * bf0);
        bf0 *= rAlpha / (rAlpha + this.p.beta + s0);
        xaf *= x;
      }
    }

    // Backward r
    if (r0 > 0) {
      let prb = pr0;
      let xab = xa0;
      let bb0 = b0;
      let ibb0 = ib0;
      for (let r = r0 - 1; r >= 0; r--) {
        let dz = 0;
        const rAlpha = this.p.alpha + r;

        // Update terms
        prb *= (r + 1) / l1;
        xab /= x;
        bb0 *= (rAlpha + this.p.beta + s0) / rAlpha;
        ibb0 += xab * xb0 / (rAlpha * bb0);

        // Forward s
        dz += recursiveSum({
          p: psf0 * l2 / (s0 > 0 ? s0 : 1),
          xb: xb0,
          b: bb0,
          ib: ibb0
        }, (t, i) => {
          const s = s0 + i;
          t.p *= l2 / (s > 0 ? s : 1);
          return t
        }, t => prb * t.p * t.ib, (t, i) => {
          const s = s0 + i;
          const sBeta = this.p.beta + s;
          t.ib += xab * t.xb / (sBeta * t.b);
          t.b *= sBeta / (rAlpha + sBeta);
          t.xb *= 1 - x;
          return t
        });

        // Backward s
        if (s0 > 0) {
          const xbb = xb0 / (1 - x);
          const bbb = bb0 * (rAlpha + sBeta0) / sBeta0;
          dz += recursiveSum({
            p: ps0 * s0 / l2,
            xb: xb0 / (1 - x),
            b: bb0 * (rAlpha + sBeta0) / sBeta0,
            ib: ibb0 - xab * xbb / (sBeta0 * bbb)
          }, (t, i) => {
            const s = s0 - i - 1;
            const sBeta = this.p.beta + s;
            if (s >= 0) {
              t.p *= (s + 1) / l2;
              t.xb /= 1 - x;
              t.b *= (rAlpha + sBeta) / sBeta;
              t.ib -= xab * t.xb / (sBeta * t.b);
            } else {
              t.p = 0;
            }
            return t
          }, t => prb * t.p * t.ib);
        }

        // Add s-terms
        z += dz;
        if (Math.abs(dz / z) < EPS) {
          break
        }
      }
    }

    return clamp(Math.exp(-l1 - l2) * z)
  }
}

/**
 * Generator for the [doubly non-central F distribution]{@link https://rdrr.io/cran/sadists/f/inst/doc/sadists.pdf}:
 *
 * $$f(x; d_1, d_2, \lambda_1, \lambda_2) = \frac{d_1}{d_2} e^{-\frac{\lambda_1 + \lambda_2}{2}} \sum\_{k = 0}^\infty \sum\_{l = 0}^\infty \frac{\big(\frac{\lambda_1}{2}\big)^k}{k!} \frac{\big(\frac{\lambda_2}{2}\big)^l}{l!} \frac{\big(\frac{d_1 x}{d_2}\big)^{\frac{d_1}{2} + k - 1}}{\big(1 + \frac{d_1 x}{d_2}\big)^{\frac{d_1 + d_2}{2} + k + l}} \frac{1}{\mathrm{B}\big(\frac{d_1}{2} + k, \frac{d_2}{2} + l\big)},$$
 *
 * where $d_1, d_2 \in \mathbb{N}^+$ and $\lambda_1, \lambda_2 \ge 0$. Support: $x > 0$.
 *
 * @class DoublyNoncentralF
 * @memberof ran.dist
 * @param {number=} d1 First degrees of freedom. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @param {number=} d2 Second degrees of freedom. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @param {number=} lambda1 First non-centrality parameter. Default value is 1.
 * @param {number=} lambda2 Second non-centrality parameter. Default value is 1.
 * @constructor
 */
class doublyNoncentralF extends DoublyNoncentralBeta {
  // Transformation of double non-central beta
  constructor (d1 = 2, d2 = 2, lambda1 = 1, lambda2 = 1) {
    super(d1 / 2, d2 / 2, lambda1, lambda2);

    // Validate parameters
    const d1i = Math.round(d1);
    const d2i = Math.round(d2);
    this.p = Object.assign(this.p, { d1: d1i, d2: d2i });

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling by transforming a doubly non-central beta
    const x = super._generator();
    return this.p.d2 * x / (this.p.d1 * (1 - x))
  }

  _pdf (x) {
    const n = this.p.d1 / this.p.d2;
    return n * super._pdf(x / (1 / n + x)) / Math.pow(1 + n * x, 2)
  }

  _cdf (x) {
    return super._cdf(x / (this.p.d2 / this.p.d1 + x))
  }
}

/**
 * Generates a chi2 random variate.
 *
 * @method chi2
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number=} nu Degrees of freedom.
 * @returns {number} Random variate.
 * @ignore
 */
function chi2 (r, nu) {
  return gamma(r, nu / 2, 0.5)
}

/**
 * Generator for the [non-central t distribution]{@link https://en.wikipedia.org/wiki/Noncentral_t-distribution}:
 *
 * $$f(x; \nu, \mu) = \frac{\nu^\frac{\nu}{2} \exp\Big(-\frac{\nu \mu^2}{2 (x^2 + \nu)}\Big)}{\sqrt{\pi} \Gamma\big(\frac{\nu}{2}\big) 2^\frac{\nu - 1}{2} (x^2 + \nu)^\frac{\nu + 1}{2}} \int_0^\infty y^\nu \exp\bigg(-\frac{1}{2}\bigg\[y - \frac{\mu x}{\sqrt{x^2 + \nu}}\bigg\]^2\bigg) \mathrm{d}y,$$
 *
 * with $\nu \in \mathbb{N}^+$ and $\mu \in \mathbb{R}$. Support: $x \in \mathbb{R}$.
 *
 * @class NoncentralT
 * @memberof ran.dist
 * @param {number=} nu Degrees of freedom. If not an integer, it is rounded to the nearest one. Default value is 1.
 * @param {number=} mu Non-centrality parameter. Default value is 1.
 * @constructor
 */
class NoncentralT extends Distribution {
  constructor (nu = 1, mu = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    const nui = Math.round(nu);
    this.p = { nu: nui, mu };
    Distribution.validate({ nu: nui, mu }, [
      'nu > 0'
    ]);

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    const mu2 = mu * mu / 2;
    this.c = [
      Math.sqrt(1 + 2 / nui),
      Math.exp(logGamma$1((nui + 1) / 2) - logGamma$1(nui / 2) - mu2) / Math.sqrt(Math.PI * nui)
    ];
  }

  /**
   * Calculates the cumulative distribution function for a specific pairs of parameters and value.
   * Source: http://www.ucs.louisiana.edu/~kxk4695/CSDA-03.pdf
   *
   * @method fnm
   * @memberof ran.dist.NoncentralT
   * @param {number} nu Degrees of freedom.
   * @param {number} mu Non-centrality parameter.
   * @param {number} x Value to evaluate distribution function at.
   * @returns {number} The cumulative probability.
   * @static
   * @ignore
   */
  static fnm (nu, mu, x) {
    // If mu = 0, return CDF for central t
    if (Math.abs(mu) < Number.EPSILON) {
      return x > 0
        ? 1 - 0.5 * regularizedBetaIncomplete(nu / 2, 0.5, nu / (x * x + nu))
        : 0.5 * regularizedBetaIncomplete(nu / 2, 0.5, nu / (x * x + nu))
    }

    const delta = x < 0 ? -mu : mu;
    const phi = 0.5 * (1 + erf(-delta / Math.SQRT2));

    // If x = 0, return normal part
    if (Math.abs(x) < Number.EPSILON) {
      return phi
    }

    // Initialize iterators
    const y = x * x / (nu + x * x);
    const mu2 = delta * delta / 2;
    const nu2 = nu / 2;
    const k0 = Math.floor(mu2);
    const gnu = logGamma$1(nu2);
    const gk1 = logGamma$1(k0 + 1);
    const gk15 = logGamma$1(k0 + 1.5);
    const ly = Math.log(y);
    const p0 = Math.exp(-mu2 - logGamma$1(k0 + 1) + k0 * Math.log(mu2));
    const q0 = delta * Math.exp(-mu2 - logGamma$1(k0 + 1.5) + k0 * Math.log(mu2)) / Math.SQRT2;
    const ap = k0 + 0.5;
    const aq = k0 + 1;
    const apb = ap + nu2;
    const aqb = aq + nu2;
    const bl1y = nu2 * Math.log(1 - y);
    const gp0 = Math.exp(logGamma$1(k0 + nu2 + 0.5) - gnu - gk15 + ap * ly + bl1y);
    const gq0 = Math.exp(logGamma$1(k0 + nu2) - gnu - gk1 + (aq - 1) * ly + bl1y);
    const ip0 = regularizedBetaIncomplete(ap, nu2, y);
    const iq0 = regularizedBetaIncomplete(aq, nu2, y);

    // Forward summation
    const gq = gq0 * y * (aqb - 1) / aq;
    let z = recursiveSum({
      p: p0 * mu2 / (k0 + 1),
      gp: gp0 * y * apb / (ap + 1),
      ip: ip0 - gp0,
      q: q0 * mu2 / (k0 + 1.5),
      gq: gq,
      iq: iq0 - gq
    }, (t, i) => {
      const j = i + 1;
      t.p *= mu2 / (k0 + j);
      t.ip -= t.gp;
      t.gp *= y * (apb + i) / (ap + j);
      t.q *= mu2 / (k0 + j + 0.5);
      t.gq *= y * (aqb + i - 1) / (aq + i);
      t.iq -= t.gq;
      return t
    }, t => t.p * t.ip + t.q * t.iq);

    // Backward summation
    z += recursiveSum({
      p: p0,
      gp: gp0,
      ip: ip0,
      q: q0,
      gq: gq0 * y * (aqb - 1) / aq,
      iq: iq0
    }, (t, i) => {
      const j = i - 1;
      if (j < k0) {
        t.p *= (k0 - j) / mu2;
        t.gp *= (ap - j) / (y * (apb - i));
        t.ip += t.gp;
        t.q *= (k0 - j + 0.5) / mu2;
        t.gq *= (aq - j) / (y * (aqb - i));
        t.iq += t.gq;
      } else {
        t.p = 0;
        t.ip = 0;
        t.q = 0;
        t.iq = 0;
      }
      return t
    }, t => t.p * t.ip + t.q * t.iq);

    z = z / 2 + phi;
    return Math.min(Math.max(x >= 0 ? z : 1 - z, 0), 1)
  }

  _generator () {
    // Direct sampling from a normal and a chi2
    const x = normal(this.r);
    const y = chi2(this.r, this.p.nu);
    return (x + this.p.mu) / Math.sqrt(y / this.p.nu)
  }

  _pdf (x) {
    if (Math.abs(x) < Number.EPSILON) {
      return this.c[1]
    } else {
      return Math.max(0, this.p.nu * (NoncentralT.fnm(this.p.nu + 2, this.p.mu, x * this.c[0]) - NoncentralT.fnm(this.p.nu, this.p.mu, x)) / x)
    }
  }

  _cdf (x) {
    return NoncentralT.fnm(this.p.nu, this.p.mu, x)
  }
}

/**
 * Generator for the [doubly non-central t distribution]{@link https://cran.r-project.org/web/packages/sadists/sadists.pdf}:
 *
 * $$f(x; \nu, \mu, \theta) = \frac{e^{-\frac{\theta + \mu^2}{2}}}{\sqrt{\pi \nu}} \sum_{j = 0}^\infty \frac{1}{j!} \frac{(x \mu \sqrt{2 / \nu})^j}{(1 + x^2 / \nu)^{\frac{\nu + j + 1}{2}}} \frac{\Gamma\big(\frac{\nu + j + 1}{2}\big)}{\Gamma\big(\frac{\nu}{2}\big)} {}_1F_1\bigg(\frac{\nu + j + 1}{2}, \frac{\nu}{2}; \frac{\theta}{2 (1 + x^2 / \nu)}\bigg),$$
 *
 * where $\nu \in \mathbb{N}^+$, $\mu \in \mathbb{R}$ and $\theta > 0$. Support: $x \in \mathbb{R}$.
 * Implementation is based on Section 10.4.1.2 in Marc S. Paolella. Intermediate Probability: A Computational Approach. (2007)
 *
 * @class DoublyNoncentralT
 * @memberof ran.dist
 * @param {number} nu Degrees of freedom. If not an integer, it is rounded to the nearest one. Default value is 1.
 * @param {number} mu Location parameter. Default value is 1.
 * @param {number} theta Shape parameter. Default value is 1.
 * @constructor
 */
class doublyNoncentralT extends Distribution {
  constructor (nu = 1, mu = 1, theta = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    const nui = Math.round(nu);
    this.p = { nu: nui, mu, theta };
    Distribution.validate({ nu: nui, mu, theta }, [
      'nu > 0',
      'theta >= 0'
    ]);

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      -0.5 * (theta + mu * mu + Math.log(Math.PI * nui)) - logGamma$1(nui / 2),
      Math.exp(-theta / 2)
    ];
  }

  /**
   * Finds the index corresponding to the largest term in a series.
   *
   * @method startIndex
   * @memberof ran.dist.DoublyNoncentralT
   * @param {Function} term Function that accepts an index and returns the term value.
   * @returns {number} The index of the largest term.
   * @private
   */
  _findStartIndex (term) {
    // Find bracket that contains the maximum value.
    let j1 = 1;
    let f1 = term(j1);
    let j2 = 2;
    let f2 = term(j2);
    let j = 3;
    let f = term(j);
    while (f2 >= f1) {
      // Calculate new value: advance index according to a Fibonacci series.
      j = j1 + j2;
      f = term(j);

      // Keep advancing the index if new value is larger.
      if (f >= f2) {
        j1 = j2;
        j2 = j;
        f1 = f2;
        f2 = f;
      } else {
        break
      }
    }

    // Narrow bracket to find the exact index.
    while (j1 !== j2) {
      // Add bisection point.
      j = Math.floor((j1 + j2) / 2);
      f = term(j);

      // Check if current boundary is small enough.
      if (j === j1 || j === j2) {
        break
      }

      // Update the right index.
      if (f1 > f2) {
        f2 = f;
        j2 = j;
      } else {
        f1 = f;
        j1 = j;
      }
    }

    return j
  }

  /**
   * Advances the hypergeometric function forward in its first argument.
   *
   * @method _f11Forward
   * @memberof ran.dist.DoublyNoncentralT
   * @param {number} f1 Function value for one iteration before.
   * @param {number} f2 Function value for two iterations before.
   * @param {number} a First argument.
   * @param {number} b Second argument.
   * @param {number} z Third argument.
   * @returns {number} The function value at the current iteration.
   * @private
   */
  _f11Forward (f1, f2, a, b, z) {
    return ((2 * a - b + z) * f1 + (b - a) * f2) / a
  }

  /**
   * Advances the hypergeometric function backward in its first argument.
   *
   * @method _f11Backward
   * @memberof ran.dist.DoublyNoncentralT
   * @param {number} f1 Function value for one iteration ahead.
   * @param {number} f2 Function value for two iterations ahead.
   * @param {number} a First argument.
   * @param {number} b Second argument.
   * @param {number} z Third argument.
   * @returns {number} The function value at the current iteration.
   * @private
   */
  _f11Backward (f1, f2, a, b, z) {
    return (a * f2 - (2 * a - b + z) * f1) / (b - a)
  }

  /**
   * Logarithm of the term in the probability density function.
   *
   * @method _logA
   * @memberof ran.dist.DoublyNoncentralT
   * @param {number} x Value to evaluate density at.
   * @param {number} j Index of the term to evaluate.
   * @returns {number} The logarithm of the term.
   * @private
   */
  _logA (x, j) {
    const tk = 1 + x * x / this.p.nu;
    const kj = (this.p.nu + j + 1) / 2;
    return j * Math.log(Math.abs(x * this.p.mu / Math.sqrt(this.p.nu / 2))) +
      logGamma$1(kj) -
      kj * Math.log(tk) -
      logGamma$1(j + 1) +
      Math.log(f11(kj, this.p.nu / 2, this.p.theta / (2 * tk)))
  }

  _generator () {
    // Direct sampling from a normal and a non-central chi2
    const x = normal(this.r, this.p.mu);
    const y = noncentralChi2(this.r, this.p.nu, this.p.theta);
    return x / Math.sqrt(y / this.p.nu)
  }

  _pdf (x) {
    // Some pre-computed constants
    const nu2 = this.p.nu / 2;
    const tk = 1 + x * x / this.p.nu;
    const srtk = Math.sqrt(tk);
    const lntk = Math.log(tk);
    const tmuk = Math.abs(x * this.p.mu / Math.sqrt(nu2));
    const lntmuk = Math.log(tmuk);
    const thetatk = this.p.theta / (2 * tk);

    // Find index with highest amplitude
    const j0 = this._findStartIndex(j => this._logA(x, j));

    let z = 0;
    if (x * this.p.mu >= 0) {
      // Init terms
      let kj0 = (this.p.nu + j0 + 1) / 2;
      let gp = Math.exp(this.c[0] + j0 * lntmuk - logGamma$1(j0 + 1) - kj0 * lntk);
      let gk0 = _gamma(kj0);
      let f10 = f11(kj0, nu2, thetatk);

      // Forward
      z = recursiveSum({
        gp,
        gk: [
          gk0,
          _gamma(kj0 - 0.5)
        ],
        g: gp * gk0,
        f1: [
          f10,
          f11(kj0 - 0.5, nu2, thetatk)
        ],
        f2: [
          f11(kj0 - 1, nu2, thetatk),
          f11(kj0 - 1.5, nu2, thetatk)
        ],
        f: f10
      }, (t, i) => {
        const j = j0 + i;
        const j2 = i % 2;
        const kj = (this.p.nu + j + 1) / 2;
        t.gp *= tmuk / (j * srtk);
        t.gk[j2] *= kj - 1;
        t.g = t.gp * t.gk[j2];

        t.f = this._f11Forward(t.f1[j2], t.f2[j2], kj - 1, nu2, thetatk);
        t.f2[j2] = t.f1[j2];
        t.f1[j2] = t.f;
        return t
      }, t => t.g * t.f);

      // Backward
      if (j0 > 0) {
        kj0 -= 0.5;
        gp *= j0 * srtk / tmuk;
        gk0 = _gamma(kj0);
        f10 = f11(kj0, nu2, thetatk);
        z += recursiveSum({
          gp: gp,
          gk: [
            gk0,
            _gamma(kj0 + 0.5)
          ],
          g: gp * gk0,
          f1: [
            f10,
            f11(kj0 + 0.5, this.p.nu / 2, thetatk)
          ],
          f2: [
            f11(kj0 + 1, this.p.nu / 2, thetatk),
            f11(kj0 + 1.5, this.p.nu / 2, thetatk)
          ],
          f: f10
        }, (t, i) => {
          const j = j0 - i;
          if (j > 0) {
            const j2 = i % 2;
            const kj = (this.p.nu + j) / 2;

            t.gp /= tmuk / (j * srtk);
            t.gk[j2] /= kj;
            t.g = t.gp * t.gk[j2];

            t.f = this._f11Backward(t.f1[j2], t.f2[j2], kj + 1, nu2, thetatk);
            t.f2[j2] = t.f1[j2];
            t.f1[j2] = t.f;
          } else {
            t.g = 0;
            t.f = 0;
          }
          return t
        }, t => t.g * t.f);
      }
    } else {
      // Forward
      let kj0 = (this.p.nu + j0 + 1) / 2;
      const gp0 = Math.exp(this.c[0] + (j0 - 1) * lntmuk - logGamma$1(j0) - (kj0 - 0.5) * lntk);
      const gk0 = _gamma(kj0 - 1);
      const gk1 = _gamma(kj0 - 0.5);
      let gk = [gk0, gk1];
      let f2 = [
        f11(kj0 - 2, nu2, thetatk),
        f11(kj0 - 1.5, nu2, thetatk)
      ];
      let f1 = [
        f11(kj0 - 1, nu2, thetatk),
        f11(kj0 - 0.5, nu2, thetatk)
      ];

      let gp = gp0;
      z += acceleratedSum(i => {
        const j = j0 + i;
        const j2 = i % 2;
        const kj = (this.p.nu + j + 1) / 2;

        gp *= tmuk / (j * srtk);
        gk[j2] *= kj - 1;
        const g = gp * gk[j2];

        const f = this._f11Forward(f1[j2], f2[j2], kj - 1, nu2, thetatk);
        f2[j2] = f1[j2];
        f1[j2] = f;

        return g * f
      });

      // Backward
      if (j0 > 0) {
        kj0 -= 0.5;
        let gp = gp0 * tmuk / (j0 * srtk);
        gk = [gk1 * kj0, gk0 * (kj0 - 0.5)];
        f2 = [
          f11(kj0 + 2, nu2, thetatk),
          f11(kj0 + 1.5, nu2, thetatk)
        ];
        f1 = [
          f11(kj0 + 1, nu2, thetatk),
          f11(kj0 + 0.5, nu2, thetatk)
        ];
        z -= acceleratedSum(i => {
          const j = j0 - i;
          const j2 = i % 2;
          const kj = (this.p.nu + j) / 2;
          let dz = 0;

          if (j > 0) {
            gp /= tmuk / (j * srtk);
            gk[j2] /= kj;
            const g = gp * gk[j2];

            const f = this._f11Backward(f1[j2], f2[j2], kj + 1, nu2, thetatk);
            f2[j2] = f1[j2];
            f1[j2] = f;

            dz = g * f;
          }

          return dz
        });
      }
    }

    return Math.abs(z)
  }

  _cdf (x) {
    // Sum of the product of Poisson weights and single non-central t CDF
    // Source: https://www.wiley.com/en-us/Intermediate+Probability%3A+A+Computational+Approach-p-9780470026373

    const y = Math.abs(x);
    const mu = x < 0 ? -this.p.mu : this.p.mu;
    const z = recursiveSum({
      p: this.c[1],
      f: NoncentralT.fnm(this.p.nu, mu, y)
    }, (t, i) => {
      const i2 = 2 * i;
      t.p *= this.p.theta / i2;
      t.f = NoncentralT.fnm(this.p.nu + i2, mu, y * Math.sqrt(1 + i2 / this.p.nu));
      return t
    }, t => t.p * t.f);
    return clamp(x < 0 ? 1 - z : z)
  }
}

/**
 * Generator for the [Erlang distribution]{@link https://en.wikipedia.org/wiki/Erlang_distribution}:
 *
 * $$f(x; k, \lambda) = \frac{\lambda^k x^{k - 1} e^{-\lambda x}}{(k - 1)!},$$
 *
 * where $k \in \mathbb{N}^+$ and $\lambda > 0$. Support: $x \ge 0$.
 *
 * @class Erlang
 * @memberof ran.dist
 * @param {number=} k Shape parameter. It is rounded to the nearest integer. Default value is 1.
 * @param {number=} lambda Rate parameter. Default value is 1.
 * @constructor
 */
class erlang extends Gamma {
  // Special case of gamma
  constructor (k = 1, lambda = 1) {
    const ki = Math.round(k);
    super(ki, lambda);

    // Validate parameters
    Distribution.validate({ k: ki, lambda }, [
      'k > 0',
      'lambda > 0'
    ]);
  }
}

/**
 * Generator for the [exponential-logarithmic distribution]{@link https://en.wikipedia.org/wiki/Exponential-logarithmic_distribution#Related_distribution}:
 *
 * $$f(x; p, \beta) = -\frac{1}{\ln p} \frac{\beta (1 - p) e^{-\beta x}}{1 - (1 - p) e^{-\beta x}},$$
 *
 * with $p \in (0, 1)$ and $\beta > 0$. Support: $x \ge 0$.
 *
 * @class ExponentialLogarithmic
 * @memberof ran.dist
 * @param {number=} p Shape parameter. Default value is 0.5.
 * @param {number=} beta Scale parameter. Default value is 1.
 * @constructor
 */
class exponentialLogarithmic extends Distribution {
  constructor (p = 0.5, beta = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { p, beta };
    Distribution.validate({ p, beta }, [
      'p > 0', 'p < 1',
      'beta > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const y = (1 - this.p.p) * Math.exp(-this.p.beta * x);
    return this.p.beta * y / ((y - 1) * Math.log(this.p.p))
  }

  _cdf (x) {
    return 1 - Math.log(1 - (1 - this.p.p) * Math.exp(-this.p.beta * x)) / Math.log(this.p.p)
  }

  _q (p) {
    return (Math.log(1 - this.p.p) - Math.log(1 - Math.pow(this.p.p, 1 - p))) / this.p.beta
  }
}

/**
 * Generator for the [exponentiated Weibull distribution]{@link https://en.wikipedia.org/wiki/Exponentiated_Weibull_distribution}:
 *
 * $$f(x; \lambda, k) = \alpha \frac{k}{\lambda}\bigg(\frac{x}{\lambda}\bigg)^{k - 1} \bigg[1 - e^{-(x / \lambda)^k}\bigg]^{\alpha - 1} e^{-(x / \lambda)^k},$$
 *
 * with $\lambda, k, \alpha > 0$. Support: $x \ge 0$.
 *
 * @class ExponentiatedWeibull
 * @memberof ran.dist
 * @param {number=} lambda Scale parameter. Default value is 1.
 * @param {number=} k First shape parameter. Default value is 1.
 * @param {number=} alpha Second shape parameter. Default value is 1.
 * @constructor
 */
class exponentiatedWeibull extends Weibull {
  // Transformation of Weibull distribution.
  constructor (lambda = 1, k = 1, alpha = 1) {
    super(lambda, k);

    // Validate parameters.
    this.p = Object.assign(this.p, { lambda2: lambda, alpha });
    Distribution.validate({ lambda, k, alpha }, [
      'lambda > 0',
      'k > 0',
      'alpha > 0'
    ]);

    // Set support.
    this.s = [{
      value: 0,
      closed: k >= 1
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Inverse transform sampling.
    return this._q(this.r.next())
  }

  _pdf (x) {
    return super._pdf(x) * this.p.alpha * Math.pow(this._cdf(x), (this.p.alpha - 1) / this.p.alpha)
  }

  _cdf (x) {
    return Math.pow(super._cdf(x), this.p.alpha)
  }

  _q (p) {
    return super._q(Math.pow(p, 1 / this.p.alpha))
  }
}

/**
 * Generator for the [F distribution]{@link https://en.wikipedia.org/wiki/F-distribution} (or Fisher-Snedecor's F
 * distribution):
 *
 * $$f(x; d_1, d_2) = \frac{\sqrt{\frac{(d_1 x)^{d_1} d_2^{d_2}}{(d_1x + d_2)^{d_1 + d_2}}}}{x \mathrm{B}\big(\frac{d_1}{2}, \frac{d_2}{2}\big)},$$
 *
 * with $d_1, d_2 > 0$. Support: $x > 0$.
 *
 * @class F
 * @memberof ran.dist
 * @param {number=} d1 First degree of freedom. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @param {number=} d2 Second degree of freedom. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @constructor
 */
class F extends Beta {
  // Transformation of beta distribution
  constructor (d1 = 2, d2 = 2) {
    const d1i = Math.round(d1);
    const d2i = Math.round(d2);
    super(d1i / 2, d2i / 2);

    // Validate parameters
    this.p = Object.assign(this.p, { d1: d1i, d2: d2i });
    Distribution.validate({ d1: d1i, d2: d2i }, [
      'd1 > 0',
      'd2 > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: d1i !== 1
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling by transforming beta variate
    const x = super._generator();
    return this.p.d2 * x / (this.p.d1 * (1 - x))
  }

  _pdf (x) {
    const y = this.p.d2 + this.p.d1 * x;
    return this.p.d1 * this.p.d2 * super._pdf(this.p.d1 * x / y) / Math.pow(y, 2)
  }

  _cdf (x) {
    const y = this.p.d1 * x;
    return super._cdf(1 / (1 + this.p.d2 / y))
  }
}

/**
 * Generator for the [Flory-Schulz distribution]{@link https://en.wikipedia.org/wiki/Flory%E2%80%93Schulz_distribution}:
 *
 * $$f(k; a) = a^2 k (1 - a)^{k - 1},$$
 *
 * with $a \in (0, 1)$. Support: $k \in \mathbb{N}^+$.
 *
 * @class FlorySchulz
 * @memberof ran.dist
 * @param {number=} a Shape parameter. Default value is 0.5.
 * @constructor
 */
class florySchulz extends Distribution {
  constructor (a = 0.5) {
    super('discrete', arguments.length);

    // Validate parameters
    this.p = { a };
    Distribution.validate({ a }, [
      'a > 0', 'a < 1'
    ]);

    // Set support
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: Infinity,
      closed: true
    }];

    // Speed-up constants
    this.c = [
      1 - a
    ];
  }

  _generator () {
    let k = 1;
    const r = this.r.next();
    let ak = 1 + this.p.a;
    let p = this.c[0];
    while (r < p * ak) {
      ak += this.p.a;
      p *= this.c[0];
      k++;
    }
    return k
  }

  _pdf (x) {
    return this.p.a * this.p.a * x * Math.pow(this.c[0], x - 1)
  }

  _cdf (x) {
    return 1 - Math.pow(this.c[0], x) * (1 + this.p.a * x)
  }
}

/**
 * Generator for the [Frechet distribution]{@link https://en.wikipedia.org/wiki/Frechet_distribution}:
 *
 * $$f(x; \alpha, s, m) = \frac{\alpha z^{-1 -\alpha} e^{-z^{-\alpha}}}{s},$$
 *
 * with $z = \frac{x - m}{s}$. and $\alpha, s > 0$, $m \in \mathbb{R}$. Support: $x \in \mathbb{R}, x > m$.
 *
 * @class Frechet
 * @memberof ran.dist
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @param {number=} s Scale parameter. Default value is 1.
 * @param {number=} m Location parameter. Default value is 0.
 * @constructor
 */
class frechet extends Distribution {
  constructor (alpha = 1, s = 1, m = 0) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { alpha, s, m };
    Distribution.validate({ alpha, s, m }, [
      'alpha > 0',
      's > 0'
    ]);

    // Set support
    this.s = [{
      value: m,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const z = (x - this.p.m) / this.p.s;
    return this.p.alpha * Math.exp(-Math.log(z) * (1 + this.p.alpha) - Math.pow(z, -this.p.alpha)) / this.p.s
  }

  _cdf (x) {
    return Math.exp(-Math.pow((x - this.p.m) / this.p.s, -this.p.alpha))
  }

  _q (p) {
    return this.p.m + this.p.s * Math.pow(-Math.log(p), -1 / this.p.alpha)
  }
}

/**
 * Generator for [Fisher's z distribution]{@link https://en.wikipedia.org/wiki/Fisher%27s_z-distribution}:
 *
 * $$f(x; d_1, d_2) = \sqrt{\frac{d_1^{d_1} d_2^{d_2}}{(d_1 e^{2 x} + d_2)^{d_1 + d_2}}} \frac{2 e^{d_1 x}}{\mathrm{B}\big(\frac{d_1}{2}, \frac{d_2}{2}\big)},$$
 *
 * with $d_1, d_2 > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class FisherZ
 * @memberof ran.dist
 * @param {number=} d1 First degree of freedom. Default value is 2.
 * @param {number=} d2 Second degree of freedom. Default value is 2.
 * @constructor
 */
class fisherZ extends F {
  // Transformation of F
  constructor (d1 = 1, d2 = 1) {
    const d1i = Math.round(d1);
    const d2i = Math.round(d2);
    super(d1i / 2, d2i / 2);

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling by transforming F variate
    return 0.5 * Math.log(super._generator())
  }

  _pdf (x) {
    const y = Math.exp(2 * x);
    return super._pdf(y) * 2 * y
  }

  _cdf (x) {
    return super._cdf(Math.exp(2 * x))
  }
}

/**
 * Generator for the [Gamma/Gompertz distribution]{@link https://en.wikipedia.org/wiki/Gamma/Gompertz_distribution}:
 *
 * $$f(x; b, s, \beta) = \frac{b s e^{b x} \beta^s}{(\beta - 1 + e^{b x})^{s + 1}},$$
 *
 * with $b, s, \beta > 0$. Support: $x \ge 0$.
 *
 * @class GammaGompertz
 * @memberof ran.dist
 * @param {number=} b Scale parameter. Default value is 1.
 * @param {number=} s First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @constructor
 */
class gammaGompertz extends Distribution {
  constructor (b = 1, s = 1, beta = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { b, s, beta };
    Distribution.validate({ b, s, beta }, [
      'b > 0',
      's > 0',
      'beta > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const y = Math.exp(this.p.b * x);
    const z = Math.pow(this.p.beta - 1 + y, this.p.s + 1);
    return Number.isFinite(y) && Number.isFinite(z) ? this.p.b * this.p.s * Math.pow(this.p.beta, this.p.s) * y / z : 0
  }

  _cdf (x) {
    return 1 - Math.pow(1 + (Math.exp(this.p.b * x) - 1) / this.p.beta, -this.p.s)
  }

  _q (p) {
    return Math.log(1 + this.p.beta * (Math.pow(1 - p, -1 / this.p.s) - 1)) / this.p.b
  }
}

/**
 * Generator for the [generalized exponential distribution]{@link https://docs.scipy.org/doc/scipy/tutorial/stats/continuous_genexpon.html}:
 *
 * $$f(x; a, b, c) = \big(a + b (1 - e^{-c x})\big) e^{-(a + b)x + \frac{b}{c} (1 - e^{-c x})},$$
 *
 * where $a, b, c > 0$. Support> $x \ge 0$.
 *
 * @class GeneralizedExponential
 * @memberof ran.dist
 * @param {number=} a First shape parameter. Default value is 1.
 * @param {number=} b Second shape parameter. Default value is 1.
 * @param {number=} c Third shape parameter. Default value is 1.
 * @constructor
 */
class generalizedExponential extends Distribution {
  constructor (a = 1, b = 1, c = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { a, b, c };
    Distribution.validate({ a, b, c }, [
      'a > 0',
      'b > 0',
      'c > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const z = this.p.b * (1 - Math.exp(-this.p.c * x));
    return (this.p.a + z) * Math.exp(-(this.p.a + this.p.b) * x + z / this.p.c)
  }

  _cdf (x) {
    return 1 - Math.exp(-(this.p.a + this.p.b) * x + this.p.b * (1 - Math.exp(-this.p.c * x)) / this.p.c)
  }

  _q (p) {
    const ab = this.p.a + this.p.b;
    const w = lambertW0(-this.p.b * Math.exp((this.p.c * Math.log(1 - p) - this.p.b) / ab) / ab);
    return (this.p.b * w + this.p.a * w + this.p.b - this.p.c * Math.log(1 - p)) / (this.p.c * ab)
  }
}

/**
 * Generator for the [generalized extreme value distribution]{@link https://en.wikipedia.org/wiki/Generalized_extreme_value_distribution}:
 *
 * $$f(x; c) = (1 - cx)^{1 / c - 1} e^{-(1 - cx)^{1 / c}},$$
 *
 * with $c \ne 0$. Support: $x \in (-\infty, 1 / c]$ if $c > 0$, $x \in [1 / c, \infty)$ otherwise.
 *
 * @class GeneralizedExtremeValue
 * @memberof ran.dist
 * @param {number=} c Shape parameter. Default value is 2.
 * @constructor
 */
class generalizedExtremeValue extends Distribution {
  constructor (c = 2) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { c };
    Distribution.validate({ c }, [
      'c != 0'
    ]);

    // Set support
    this.s = [{
      value: c > 0 ? -Infinity : 1 / c,
      closed: c < 0
    }, {
      value: c > 0 ? 1 / c : Infinity,
      closed: c > 0
    }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return Math.exp(-Math.pow(1 - this.p.c * x, 1 / this.p.c)) * Math.pow(1 - this.p.c * x, 1 / this.p.c - 1)
  }

  _cdf (x) {
    return Math.exp(-Math.pow(1 - this.p.c * x, 1 / this.p.c))
  }

  _q (p) {
    return (1 - Math.pow(-Math.log(p), this.p.c)) / this.p.c
  }
}

/**
 * Generator for the [generalized gamma distribution]{@link https://en.wikipedia.org/wiki/Generalized_gamma_distribution}:
 *
 * $$f(x; a, d, p) = \frac{p/a^d}{\Gamma(d/p)} x^{d - 1} e^{-(x/a)^p},$$
 *
 * where $a, d, p > 0$. Support: $x > 0$.
 *
 * @class GeneralizedGamma
 * @memberof ran.dist
 * @param {number=} a Scale parameter. Default value is 1.
 * @param {number=} d Shape parameter. Default value is 1.
 * @param {number=} p Shape parameter. Default value is 1.
 * @constructor
 */
class GeneralizedGamma extends Gamma {
  // Transformation of gamma distribution
  constructor (a = 1, d = 1, p = 1) {
    super(d / p, Math.pow(a, -p));

    // Validate parameters
    this.p = Object.assign(this.p, { a, d, p });
    Distribution.validate({ a, d, p }, [
      'a > 0',
      'd > 0',
      'p > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: d >= 1 && p >= 1 && d >= p
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling by transforming gamma variate
    return Math.pow(super._generator(), 1 / this.p.p)
  }

  _pdf (x) {
    return this.p.p * Math.pow(x, this.p.p - 1) * super._pdf(Math.pow(x, this.p.p))
  }

  _cdf (x) {
    return super._cdf(Math.pow(x, this.p.p))
  }
}

/**
 * Generator for the [generalized Hermite distribution]{@link https://journal.r-project.org/archive/2015/RJ-2015-035/RJ-2015-035.pdf}:
 *
 * $$f(k; a_1, a_m, m) = p_0 \frac{\mu^k (m - d)^k}{(m - 1)^k} \sum\_{j = 0}^{\lfloor k / m \rfloor} \frac{(d - 1)^j (m - 1)^{(m - 1)j}}{m^j \mu^{(m - 1)j} (m - d)^{mj} (k - mj)! j!},$$
 *
 * where $p_0 = e^{\mu \big\[\frac{d - 1}{m} - 1\big\]}$, $\mu = a_1 + m a_m$, $d = \frac{a_1 + m^2 a_m}{a_1 + m a_m}$,
 * $a_1, a_m > 0$ and $m \in \mathbb{N}^+ \setminus \{ 1 \}$.
 * Support: $k \in \mathbb{N}$. It is the distribution of $X_1 + m X_m$ where $X_1, X_2$ are Poisson variates with
 * parameters $a_1, a_m$ respectively.
 *
 * @class GeneralizedHermite
 * @memberof ran.dist
 * @param {number=} a1 Mean of the first Poisson component. Default value is 1.
 * @param {number=} am Mean of the second Poisson component. Default value is 1.
 * @param {number=} m Multiplier of the second Poisson. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @constructor
 */
class generalizedHermite extends PreComputed {
  constructor (a1 = 1, a2 = 1, m = 2) {
    // Using raw probability mass values
    super(true);

    // Validate parameters
    const mi = Math.round(m);
    this.p = { a1, a2, m: mi };
    Distribution.validate({ a1, a2, m: mi }, [
      'a1 > 0',
      'a2 > 0',
      'm > 1'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      Math.log(a1 + m * a2),
      (a1 + m * m * a2) / (a1 + m * a2),
      -a1 - a2
    ];
  }

  _pk (k) {
    if (k === 0) {
      return this.c[2]
    }

    if (k < this.p.m) {
      return this.c[2] + k * this.c[0] - logGamma$1(k + 1) + k * Math.log((this.p.m - this.c[1]) / (this.p.m - 1))
    }

    return this.c[0] +
      Math.log((this.c[1] - 1) * Math.exp(this.pdfTable[k - this.p.m]) + (this.p.m - this.c[1]) * Math.exp(this.pdfTable[k - 1])) -
      Math.log((k * (this.p.m - 1)))
  }

  _generator () {
    return poisson$1(this.r, this.p.a1) + this.p.m * poisson$1(this.r, this.p.a2)
  }
}

/**
 * Generator for the [generalized logistic distribution]{@link https://en.wikipedia.org/wiki/Generalized_logistic_distribution}:
 *
 * $$f(x; \mu, s, c) = \frac{c e^{-z}}{s (1 + e^{-z})^{c + 1}},$$
 *
 * with $z = \frac{x - \mu}{s}$, $\mu \in \mathbb{R}$ and $s, c > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class GeneralizedLogistic
 * @memberof ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} s Scale parameter. Default value is 1.
 * @param {number=} c Shape parameter. Default value is 1.
 * @constructor
 */
class generalizedLogistic extends Distribution {
  constructor (mu = 0, s = 1, c = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { mu, s, c };
    Distribution.validate({ mu, s, c }, [
      's > 0',
      'c > 0'
    ]);

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const z = Math.exp(-(x - this.p.mu) / this.p.s);
    return Number.isFinite(z * z)
      ? this.p.c * z / (this.p.s * Math.pow(1 + z, this.p.c + 1))
      : 0
  }

  _cdf (x) {
    return 1 / Math.pow(1 + Math.exp(-(x - this.p.mu) / this.p.s), this.p.c)
  }

  _q (p) {
    return this.p.mu - this.p.s * Math.log(Math.pow(p, -1 / this.p.c) - 1)
  }
}

/**
 * Generator for the [generalized normal distribution]{@link https://en.wikipedia.org/wiki/Generalized_normal_distribution}:
 *
 * $$f(x; \mu, \alpha, \beta) = \frac{\beta}{2 \alpha \Gamma\big(\frac{1}{\beta}\big)} e^{-\big(\frac{|x - \mu|}{\alpha}\big)^\beta},$$
 *
 * where $\mu \in \mathbb{R}$ and $\alpha, \beta > 0$. Support: $x \in \mathbb{R}$. It is also a special case of the
 * [generalized gamma distribution]{@link #dist.GeneralizedGamma}.
 *
 * @class GeneralizedNormal
 * @memberof ran.dist
 * @param {number=} mu Location paramameter. Default value is 0.
 * @param {number=} alpha Scale parameter. Default value is 1.
 * @param {number=} beta Shape parameter. Default value is 1.
 * @constructor
 */
class GeneralizedNormal extends GeneralizedGamma {
  constructor (mu = 0, alpha = 1, beta = 1) {
    super(alpha, 1, beta);

    // Validate parameters
    this.p = Object.assign(this.p, { mu, alpha2: alpha, beta2: beta });
    Distribution.validate({ mu, alpha, beta }, [
      'alpha > 0',
      'beta > 0'
    ]);

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Transforming generalized gamma variate
    return (this.r.next() > 0.5 ? 1 : -1) * Math.abs(super._generator()) + this.p.mu
  }

  _pdf (x) {
    return super._pdf(Math.abs(x - this.p.mu)) / 2
  }

  _cdf (x) {
    return 0.5 * (1 + Math.sign(x - this.p.mu) * super._cdf(Math.abs(x - this.p.mu)))
  }
}

/**
 * Generator for the [generalized Pareto distribution]{@link https://en.wikipedia.org/wiki/Generalized_Pareto_distribution}:
 *
 * $$f(x; \mu, \sigma, \xi) = \begin{cases}\frac{1}{\sigma} (1 + \xi z)^{-(1/\xi + 1)} &\quad\text{if $\xi \ne 0$},\\\\\frac{1}{\sigma} e^{-z} &\quad\text{if $\xi = 0$}\\\\\end{cases},$$
 *
 * with $\mu, \xi \in \mathbb{R}$, $\sigma > 0$ and $z = \frac{x - \mu}{\sigma}$. Support: $x \in [\mu, \infty)$ if $\xi \ge 0$, $x \in \[\mu, \mu - \sigma / \xi\]$ otherwise.
 *
 * @class GeneralizedPareto
 * @memberof ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @param {number=} xi Shape parameter. Default value is 1.
 * @constructor
 */
class GeneralizedPareto extends Distribution {
  constructor (mu = 0, sigma = 1, xi = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { mu, sigma, xi };
    Distribution.validate({ mu, sigma, xi }, [
      'sigma > 0'
    ]);

    // Set support
    this.s = [{
      value: mu,
      closed: true
    }, {
      value: xi < 0 ? mu - sigma / xi : Infinity,
      closed: xi < 0
    }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const z = (x - this.p.mu) / this.p.sigma;
    return this.p.xi === 0
      ? Math.exp(-z) / this.p.sigma
      : Math.pow(1 + this.p.xi * z, -1 / this.p.xi - 1) / this.p.sigma
  }

  _cdf (x) {
    const z = (x - this.p.mu) / this.p.sigma;
    return this.p.xi === 0
      ? 1 - Math.exp(-z)
      : 1 - Math.pow(1 + this.p.xi * z, -1 / this.p.xi)
  }

  _q (p) {
    const y = this.p.xi === 0 ? -Math.log(1 - p) : (Math.pow(1 - p, -this.p.xi) - 1) / this.p.xi;
    return this.p.mu + this.p.sigma * y
  }
}

/**
 * Generator for the [geometric distribution]{@link https://en.wikipedia.org/wiki/Geometric_distribution} (the number of
 * failures before the first success definition):
 *
 * $$f(k; p) = p (1 - p)^k,$$
 *
 * with $p \in (0, 1]$. Support: $k \in \{0, 1, 2, ...\}$. Note that the [discrete exponential distribution]{@link https://docs.scipy.org/doc/scipy/reference/tutorial/stats/discrete_planck.html} is also a geometric distribution with rate parameter equal to $-\ln(1 - p)$.
 *
 * @class Geometric
 * @memberof ran.dist
 * @param {number} p Probability of success. Default value is 0.5.
 * @constructor
 */
class geometric extends Distribution {
  constructor (p = 0.5) {
    super('discrete', arguments.length);

    // Validate parameters
    this.p = { p };
    Distribution.validate({ p }, [
      'p > 0', 'p <= 1'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.p.p * Math.pow(1 - this.p.p, x)
  }

  _cdf (x) {
    return 1 - Math.pow(1 - this.p.p, x + 1)
  }

  _q (p) {
    return Math.floor(Math.log(1 - p) / Math.log(1 - this.p.p))
  }
}

/**
 * Generator for the [log-normal distribution]{@link https://en.wikipedia.org/wiki/Log-normal_distribution}:
 *
 * $$f(x; \mu, \sigma) = \frac{1}{x \sigma \sqrt{2 \pi}}e^{-\frac{(\ln x - \mu)^2}{2\sigma^2}},$$
 *
 * where $\mu \in \mathbb{R}$ and $\sigma > 0$. Support: $x > 0$.
 *
 * @class LogNormal
 * @memberof ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @constructor
 */
class LogNormal extends Normal {
  // Transforming normal distribution
  constructor (mu = 0, sigma = 1) {
    super(mu, sigma);

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling by transforming normal variate
    return Math.exp(super._generator())
  }

  _pdf (x) {
    return super._pdf(Math.log(x)) / x
  }

  _cdf (x) {
    return super._cdf(Math.log(x))
  }

  _q (p) {
    return Math.exp(super._q(p))
  }
}

/**
 * Generator for the [Gilbrat's distribution]{@link http://mathworld.wolfram.com/GibratsDistribution.html}:
 *
 * $$f(x) = \frac{1}{x \sqrt{2 \pi}}e^{-\frac{\ln x^2}{2}}.$$
 *
 * Support: $x > 0$. Note that this distribution is simply a special case of the [log-normal]{@link #dist.LogNormal}.
 *
 * @class Gilbrat
 * @memberof ran.dist
 * @constructor
 */
class gilbrat extends LogNormal {
  // Special case of log-normal
  constructor () {
    super(0, 1);
  }
}

/**
 * Generator for the [Gompertz distribution]{@link https://en.wikipedia.org/wiki/Gompertz_distribution}:
 *
 * $$f(x; \eta, b) = b \eta e^{\eta + bx - \eta e^{bx}} ,$$
 *
 * with $\eta, b > 0$. Support: $x \ge 0$.
 *
 * @class Gompertz
 * @memberof ran.dist
 * @param {number=} eta Shape parameter. Default value is 1.
 * @param {number=} beta Scale parameter. Default value is 1.
 * @constructor
 */
class gompertz extends Distribution {
  constructor (eta = 1, b = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { eta, b };
    Distribution.validate({ eta, b }, [
      'eta > 0',
      'b > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.p.b * this.p.eta * Math.exp(this.p.eta + this.p.b * x - this.p.eta * Math.exp(this.p.b * x))
  }

  _cdf (x) {
    return 1 - Math.exp(-this.p.eta * (Math.exp(this.p.b * x) - 1))
  }

  _q (p) {
    return Math.log(1 - Math.log(1 - p) / this.p.eta) / this.p.b
  }
}

/**
 * Generator for the [Gumbel distribution]{@link https://en.wikipedia.org/wiki/Gumbel_distribution}:
 *
 * $$f(x; \mu, \beta) = \frac{1}{\beta} e^{-(z + e^{-z})},$$
 *
 * with $z = \frac{x - \mu}{\beta}$ and $\mu \in \mathbb{R}$, $\beta > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class Gumbel
 * @memberof ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} beta Scale parameter. Default value is 1.
 * @constructor
 */
class gumbel extends Distribution {
  constructor (mu = 0, beta = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { mu, beta };
    Distribution.validate({ mu, beta }, [
      'beta > 0'
    ]);

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const z = (x - this.p.mu) / this.p.beta;
    return Math.exp(-(z + Math.exp(-z))) / this.p.beta
  }

  _cdf (x) {
    return Math.exp(-Math.exp(-(x - this.p.mu) / this.p.beta))
  }

  _q (p) {
    return this.p.mu - this.p.beta * Math.log(-Math.log(p))
  }
}

/**
 * Generator for the [half generalized normal distribution]{@link https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.halfgennorm.html}:
 *
 * $$f(x; \alpha, \beta) = \frac{\beta}{\Gamma\big(\frac{1}{\beta}\big)} e^{-|x|^\beta},$$
 *
 * with $\alpha, \beta > 0$. Support: $x > 0$.
 *
 * @class HalfGeneralizedNormal
 * @memberof ran.dist
 * @param {number=} alpha Scale parameter. Default value is 1.
 * @param {number=} beta Shape parameter. Default value is 1.
 * @constructor
 */
class halfGeneralizedNormal extends GeneralizedNormal {
  constructor (alpha = 1, beta = 1) {
    super(0, alpha, beta);

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling by transforming normal variate
    return Math.abs(super._generator())
  }

  _pdf (x) {
    return 2 * super._pdf(x)
  }

  _cdf (x) {
    return 2 * super._cdf(x) - 1
  }
}

/**
 * Generator for the [half-logistic distribution]{@link https://en.wikipedia.org/wiki/Half-logistic_distribution}:
 *
 * $$f(x) = \frac{2 e^{-x}}{(1 + e^{-x})^2}.$$
 *
 * Support: $x \in [0, \infty)$.
 *
 * @class HalfLogistic
 * @memberof ran.dist
 * @constructor
 */
class halfLogistic extends Distribution {
  constructor () {
    super('continuous', arguments.length);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const y = Math.exp(-x);
    return 2 * y / Math.pow(1 + y, 2)
  }

  _cdf (x) {
    const y = Math.exp(-x);
    return (1 - y) / (1 + y)
  }

  _q (p) {
    return -Math.log((1 - p) / (1 + p))
  }
}

/**
 * Generator for the [half-normal distribution]{@link https://en.wikipedia.org/wiki/Half-normal_distribution}:
 *
 * $$f(x; \sigma) = \frac{\sqrt{2}}{\sigma\sqrt{\pi}} e^{-\frac{x^2}{2\sigma^2}},$$
 *
 * with $\sigma > 0$. Support: $x \ge 0$.
 *
 * @class HalfNormal
 * @memberof ran.dist
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @constructor
 */
class halfNormal extends Normal {
  // Transformation of normal distribution
  constructor (sigma = 1) {
    super(0, sigma);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling by transforming normal variate
    return Math.abs(super._generator())
  }

  _pdf (x) {
    return 2 * super._pdf(x)
  }

  _cdf (x) {
    return 2 * super._cdf(x) - 1
  }

  _q (p) {
    return this.p.sigma * 1.414213562373095 * erfinv(p)
  }
}

/**
 * Generator for the [heads-minus-tails distribution]{@link http://mathworld.wolfram.com/Heads-Minus-TailsDistribution.html}:
 *
 * $$f(k; n) = \begin{cases}\Big(\frac{1}{2}\Big)^{2n} \begin{pmatrix}2n \\\\ n \\\\ \end{pmatrix} &\quad\text{if $k = 0$},\\\\2 \Big(\frac{1}{2}\Big)^{2n} \begin{pmatrix}2n \\\\ m + n \\\\ \end{pmatrix} &\quad\text{if $k = 2m$},\\\\0 &\quad\text{else}\\\\ \end{cases}$$
 *
 * where $n \in \mathbb{N}^+$. Support: $k \in \[0, n\]$.
 *
 * @class HeadsMinusTails
 * @memberof ran.dist
 * @param {number=} n Half number of trials. Default value is 10.
 * @constructor
 */
class headsMinusTails extends PreComputed {
  constructor (n = 10) {
    super(true);

    // Validate parameters
    const ni = Math.round(n);
    this.p = { n: ni };
    Distribution.validate({ n: ni }, [
      'n >= 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: 2 * ni,
      closed: true
    }];

    // Speed-up constants
    this.c = [
      2 * ni * Math.log(0.5)
    ];
  }

  _pk (k) {
    if (k === 0) {
      return this.c[0] + logBinomial(2 * this.p.n, this.p.n)
    } else {
      return k % 2 === 0
        ? Math.log(2) + this.c[0] + logBinomial(2 * this.p.n, Math.round(k / 2) + this.p.n)
        : -Infinity
    }
  }

  _generator () {
    let heads = 0;
    for (let i = 0; i < 2 * this.p.n; i++) {
      heads += this.r.next() > 0.5 ? 0 : 1;
    }
    return Math.abs(2 * heads - 2 * this.p.n)
  }
}

/**
 * Generator for the [Hoyt distribution]{@link https://en.wikipedia.org/wiki/Nakagami_distribution} (also known as
 * Nakagami-q distribution):
 *
 * $$f(x; q, \omega) = \frac{2q^q}{\Gamma(q) \omega^q} x^{2q - 1} e^{-\frac{q}{\omega} x^2},$$
 *
 * where $q \in (0, 1]$ and $\omega > 0$. Support: $x > 0$.
 *
 * @class Hoyt
 * @memberof ran.dist
 * @param {number=} q Shape parameter. Default value is 0.5.
 * @param {number=} omega Spread parameter. Default value is 1.
 * @constructor
 */
class hoyt extends Distribution {
  constructor (q = 0.5, omega = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { q, omega };
    Distribution.validate({ q, omega }, [
      'q > 0', 'q <= 1',
      'omega > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      2 * Math.pow(this.p.q, this.p.q) / Math.pow(this.p.omega, this.p.q)
    ];
  }

  _generator () {
    // Direct sampling from gamma
    return Math.sqrt(gamma(this.r, this.p.q, this.p.q / this.p.omega))
  }

  _pdf (x) {
    const z = Math.pow(x, 2 * this.p.q - 1);

    // Handle q < 0.5 and x << 0 case
    if (!Number.isFinite(z)) {
      return 0
    } else {
      return 2 * Math.exp(this.p.q * Math.log(this.p.q) - this.p.q * x * x / this.p.omega - logGamma$1(this.p.q) - this.p.q * Math.log(this.p.omega)) * z
    }
  }

  _cdf (x) {
    return gammaLowerIncomplete(this.p.q, this.p.q * x * x / this.p.omega)
  }
}

/**
 * Generator for the [hyperbolic secant distribution]{@link https://en.wikipedia.org/wiki/Hyperbolic_secant_distribution}:
 *
 * $$f(x) = \frac{1}{2}\mathrm{sech}\Big(\frac{\pi}{2} x\Big).$$
 *
 * Support: $x \in \mathbb{R}$.
 *
 * @class HyperbolicSecant
 * @memberof ran.dist
 * @constructor
 */
class hyperbolicSecant extends Distribution {
  constructor () {
    super('continuous', arguments.length);
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return 0.5 / Math.cosh(0.5 * Math.PI * x)
  }

  _cdf (x) {
    return 2 * Math.atan(Math.exp(0.5 * Math.PI * x)) / Math.PI
  }

  _q (p) {
    return 2 * Math.log(Math.tan(0.5 * Math.PI * p)) / Math.PI
  }
}

/**
 * Generator for the [hyperexponential distribution]{@link https://en.wikipedia.org/wiki/Hyperexponential_distribution}:
 *
 * $$f(x; \{w\}, \{\lambda\}) = \frac{1}{\sum_j w_j} \sum_i w_i \lambda_i e^{-\lambda_i x},$$
 *
 * where $w_i, \lambda_i > 0$. Support: $x \ge 0$.
 *
 * @class Hyperexponential
 * @memberof ran.dist
 * @param {Object[]=} parameters Array containing the rates and corresponding weights. Each array element must be an
 * object with twp properties: weight and rate. Default value is
 * <code>[{weight: 1, rate: 1}, {weight: 1, rate: 1}]</code>.
 * @constructor
 */
class hyperexponential extends Distribution {
  constructor (parameters = [{ weight: 1, rate: 1 }, { weight: 1, rate: 1 }]) {
    super('continuous', parameters.length);

    // Validate parameters
    const weights = parameters.map(d => d.weight);
    const norm = weights.reduce((acc, d) => d + acc, 0);
    this.p = Object.assign(this.p, {
      weights: weights.map(d => d / norm),
      rates: parameters.map(d => d.rate),
      n: weights.length
    });
    Distribution.validate({
      lambda_i: parameters.reduce((acc, d) => acc * d.rate, 1),
      n: weights.length
    }, [
      'lambda_i > 0',
      'n > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];

    // Categorical generator for weight
    this.aliasTable = new AliasTable(parameters.map(d => d.weight));
  }

  _generator () {
    // Direct sampling
    const i = this.aliasTable.sample(this.r);
    return exponential(this.r, this.p.rates[i])
  }

  _pdf (x) {
    return neumaier(this.p.rates.map((d, i) => this.p.weights[i] * d * Math.exp(-d * x)))
  }

  _cdf (x) {
    return Math.min(neumaier(this.p.rates.map((d, i) => this.p.weights[i] * (1 - Math.exp(-d * x)))), 1)
  }
}

/**
 * Generator for the [hypergeometric distribution]{@link https://en.wikipedia.org/wiki/Hypergeometric_distribution}:
 *
 * $$f(k; N, K, n) = \frac{\begin{pmatrix}K \\\\ k \\\\ \end{pmatrix} \begin{pmatrix}N - k \\\\ n - k \\\\ \end{pmatrix}}{\begin{pmatrix}N \\\\ n \\\\ \end{pmatrix}},$$
 *
 * with $N \in \mathbb{N}^+$, $K \in \{0, 1, ..., N\}$ and $n \in \{0, 1, ..., N\}$. Support: $k \in \{\mathrm{max}(0, n+K-N), ..., \mathrm{min}(n, K)\}$.
 *
 * @class Hypergeometric
 * @memberof ran.dist
 * @param {number=} N Total number of elements to sample from. If not an integer, it is rounded to the nearest one. Default value is 10.
 * @param {number=} K Total number of successes. If not an integer, it is rounded to the nearest one. Default value is 5.
 * @param {number=} n If not an integer, it is rounded to the nearest one. Number of draws. Default value is 5.
 * @constructor
 */
class hypergeometric extends Categorical {
  // Special case of categorical
  constructor (N = 10, K = 5, n = 5) {
    const Ni = Math.round(N);
    const Ki = Math.round(K);
    const ni = Math.round(n);

    const weights = [];
    const min = Math.max(0, ni + Ki - Ni);
    const max = Math.min(ni, Ki);
    for (let k = min; k <= max; k++) {
      weights.push(Math.exp(logBinomial(Ki, k) + logBinomial(Ni - Ki, ni - k) - logBinomial(Ni, ni)));
    }
    super(weights);

    // Validate parameters
    Distribution.validate({ N: Ni, K: Ki, n: ni }, [
      'N > 0',
      'K >= 0', 'K <= N',
      'n >= 0', 'n <= N'
    ]);
  }
}

/**
 * Generator for the [inverse $\chi^2$ distribution]{@link https://en.wikipedia.org/wiki/Inverse-chi-squared_distribution}:
 *
 * $$f(x; \nu) = \frac{2^{-\nu/2}}{\Gamma(\nu / 2)} x^{-\nu/2 - 1} e^{-1/(2x)},$$
 *
 * with $\nu \in \mathbb{N}^+$. Support: $x > 0$.
 *
 * @class InverseChi2
 * @memberof ran.dist
 * @param {number=} nu Degrees of freedom. Default value is 1.
 * @constructor
 */
class inverseChi2 extends Distribution {
  constructor (nu = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    const nui = Math.round(nu);
    this.p = { nu: nui };
    Distribution.validate({ nu: nui }, [
      'nu > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling
    return 1 / chi2(this.r, this.p.nu)
  }

  _pdf (x) {
    return Math.pow(2, -this.p.nu / 2) * Math.pow(x, -this.p.nu / 2 - 1) * Math.exp(-0.5 / x - logGamma$1(this.p.nu / 2))
  }

  _cdf (x) {
    return 1 - gammaLowerIncomplete(this.p.nu / 2, 0.5 / x)
  }
}

/**
 * Generator for the [inverse gamma distribution]{@link https://en.wikipedia.org/wiki/Inverse-gamma_distribution}:
 *
 * $$f(x; \alpha, \beta) = \frac{\beta^\alpha}{\Gamma(\alpha)} x^{-\alpha - 1} e^{-\beta/x},$$
 *
 * where $\alpha, \beta > 0$. Support: $x > 0$.
 *
 * @class InverseGamma
 * @memberof ran.dist
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @param {number=} beta Scale parameter. Default value is 1.
 * @constructor
 */
class inverseGamma extends Gamma {
  // Transformation of gamma distribution
  constructor (alpha = 1, beta = 1) {
    super(alpha, beta);

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [Math.pow(beta, alpha)];
  }

  _generator () {
    // Direct sampling by transforming gamma variate
    return 1 / super._generator()
  }

  _pdf (x) {
    return super._pdf(1 / x) / (x * x)
  }

  _cdf (x) {
    return 1 - super._cdf(1 / x)
  }
}

/**
 * Generator for the Wald or [inverse Gaussian distribution]{@link https://en.wikipedia.org/wiki/Inverse_Gaussian_distribution}:
 *
 * $$f(x; \lambda, \mu) = \bigg\[\frac{\lambda}{2 \pi x^3}\bigg\]^{1/2} e^{\frac{-\lambda (x - \mu)^2}{2 x \mu^2}},$$
 *
 * with $\mu, \lambda > 0$. Support: $x > 0$.
 *
 * @class InverseGaussian
 * @memberof ran.dist
 * @param {number=} mu Mean of the distribution. Default value is 1.
 * @param {number=} lambda Shape parameter. Default value is 1.
 * @constructor
 */
class InverseGaussian extends Distribution {
  constructor (mu = 1, lambda = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { mu, lambda };
    Distribution.validate({ mu, lambda }, [
      'mu > 0',
      'lambda > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      0.5 * mu / lambda,
      Math.exp(2 * lambda / mu),
      Math.sqrt(lambda / (mu * mu))
    ];
  }

  _generator () {
    // Direct sampling
    const nu = normal(this.r);

    const y = nu * nu;

    const x = this.p.mu + this.c[0] * this.p.mu * y - this.c[0] * Math.sqrt(this.p.mu * y * (4 * this.p.lambda + this.p.mu * y));
    return this.r.next() > this.p.mu / (this.p.mu + x) ? this.p.mu * this.p.mu / x : x
  }

  _pdf (x) {
    return Math.sqrt(this.p.lambda / (2 * Math.PI * Math.pow(x, 3))) * Math.exp(-this.p.lambda * Math.pow(x - this.p.mu, 2) / (2 * this.p.mu * this.p.mu * x))
  }

  _cdf (x) {
    const s = Math.sqrt(this.p.lambda / x);
    const st = Math.sqrt(x) * this.c[2];
    const z = erf(Math.SQRT1_2 * (st - s));

    // Handle 1 - z << 1 case
    if (1 - z > Number.EPSILON) {
      return Math.min(1, 0.5 * (1 + z + this.c[1] * erfc(Math.SQRT1_2 * (st + s))))
    } else {
      return Math.min(1, 0.5 * (erfc(Math.SQRT1_2 * (s - st)) + this.c[1] * erfc(Math.SQRT1_2 * (st + s))))
    }
  }
}

/**
 * Generator for the [inverted Weibull distribution]{@link https://docs.scipy.org/doc/scipy/tutorial/stats/continuous_invweibull.html}:
 *
 * $$f(x; c) = c x^{-c - 1} e^{-x^{-c}},$$
 *
 * with $c > 0$. Support: $x \ge 0$.
 *
 * @class InvertedWeibull
 * @memberof ran.dist
 * @param {number=} c Shape parameter. Default value is 2.
 * @constructor
 */
class invertedWeibull extends Distribution {
  constructor (c = 2) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { c };
    Distribution.validate({ c }, [
      'c > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.p.c * Math.pow(x, -1 - this.p.c) * Math.exp(-1 / Math.pow(x, this.p.c))
  }

  _cdf (x) {
    return Math.exp(-1 / Math.pow(x, this.p.c))
  }

  _q (p) {
    return Math.pow(-Math.log(p), -1 / this.p.c)
  }
}

/**
 * Generator for [Johnson's $S_B$ distribution]{@link https://en.wikipedia.org/wiki/Johnson%27s_SU-distribution#Johnson's_SB-distribution}:
 *
 * $$f(x; \gamma, \delta, \lambda, \xi) = \frac{\delta \lambda}{\sqrt{2 \pi} z (\lambda - z)} e^{-\frac{1}{2}\big\[\gamma + \delta \ln \frac{z}{\lambda - z}\big\]^2},$$
 *
 * with $\gamma, \xi \in \mathbb{R}$, $\delta, \lambda > 0$ and $z = x - \xi$. Support: $x \in (\xi, \xi + \lambda)$.
 *
 * @class JohnsonSB
 * @memberof ran.dist
 * @param {number=} gamma First location parameter. Default value is 0.
 * @param {number=} delta First scale parameter. Default value is 1.
 * @param {number=} lambda Second scale parameter. Default value is 1.
 * @param {number=} xi Second location parameter. Default value is 0.
 * @constructor
 */
class johnsonSb extends Normal {
  // Transformation of normal distribution
  constructor (gamma = 0, delta = 1, lambda = 1, xi = 0) {
    super();

    // Validate parameters
    this.p = Object.assign(this.p, { gamma, delta, lambda, xi });
    Distribution.validate({ gamma, delta, lambda, xi }, [
      'delta > 0',
      'lambda > 0'
    ]);

    // Set support
    this.s = [{
      value: xi,
      closed: true
    }, {
      value: xi + lambda,
      closed: true
    }];
  }

  _generator () {
    // Direct sampling by transforming normal variate
    return this.p.xi + this.p.lambda / (1 + Math.exp(-(super._generator() - this.p.gamma) / this.p.delta))
  }

  _pdf (x) {
    const z = x - this.p.xi;
    return this.p.delta * this.p.lambda * super._pdf(this.p.gamma + this.p.delta * Math.log(z / (this.p.lambda - z))) / (z * (this.p.lambda - z))
  }

  _cdf (x) {
    const z = x - this.p.xi;
    const lnz = Math.log(z / (this.p.lambda - z));
    return Number.isFinite(lnz) ? super._cdf(this.p.gamma + this.p.delta * lnz) : 0
  }

  _q (p) {
    return this.p.xi + this.p.lambda / (1 + Math.exp(-(super._q(p) - this.p.gamma) / this.p.delta))
  }
}

/**
 * Generator for [Johnson's $S_U$ distribution]{@link https://en.wikipedia.org/wiki/Johnson%27s_SU-distribution}:
 *
 * $$f(x; \gamma, \delta, \lambda, \xi) = \frac{\delta}{\lambda \sqrt{2 \pi}} \frac{e^{-\frac{1}{2}\big\[\gamma + \delta \mathrm{sinh}^{-1} z \big\]^2}}{\sqrt{1 + z^2}},$$
 *
 * with $\gamma, \xi \in \mathbb{R}$, $\delta, \lambda > 0$ and $z = \frac{x - \xi}{\lambda}$. Support: $x \in \mathbb{R}$.
 *
 * @class JohnsonSU
 * @memberof ran.dist
 * @param {number=} gamma First location parameter. Default value is 0.
 * @param {number=} delta First scale parameter. Default value is 1.
 * @param {number=} lambda Second scale parameter. Default value is 1.
 * @param {number=} xi Second location parameter. Default value is 0.
 * @constructor
 */
class johnsonSu extends Normal {
  // Transformation of normal distribution
  constructor (gamma = 0, delta = 1, lambda = 1, xi = 0) {
    super();

    // Validate parameters
    this.p = Object.assign(this.p, { gamma, delta, lambda, xi });
    Distribution.validate({ gamma, delta, lambda, xi }, [
      'delta > 0',
      'lambda > 0'
    ]);

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling by transforming normal variate
    return this.p.xi + this.p.lambda * Math.sinh((super._generator() - this.p.gamma) / this.p.delta)
  }

  _pdf (x) {
    const z = (x - this.p.xi) / this.p.lambda;
    return this.p.delta * super._pdf(this.p.gamma + this.p.delta * Math.asinh(z)) / (this.p.lambda * Math.sqrt(1 + z * z))
  }

  _cdf (x) {
    return super._cdf(this.p.gamma + this.p.delta * Math.asinh((x - this.p.xi) / this.p.lambda))
  }

  _q (p) {
    return this.p.xi + this.p.lambda * Math.sinh((super._q(p) - this.p.gamma) / this.p.delta)
  }
}

/**
 * Generator for the [Kolmogorov distribution]{@link https://en.wikipedia.org/wiki/Kolmogorov%E2%80%93Smirnov_test#Kolmogorov_distribution}:
 *
 * $$f(x) = 8 \sum_{k=1}^\infty (-1)^{k - 1} k^2 x e^{-2 k^2 x^2}.$$
 *
 * Support: $x > 0$.
 *
 * @class Kolmogorov
 * @memberof ran.dist
 * @constructor
 */
class Davis extends Distribution {
  constructor () {
    super('continuous', arguments.length);

    // Set support.
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    return this.q(this.r.next())
  }

  _pdf (x) {
    let y = 0;
    for (let k = 0; k < MAX_ITER; k++) {
      const dy = (k % 2 === 0 ? 1 : -1) * k ** 2 * x * Math.exp(-2 * (k * x) ** 2);
      y += dy;
      if (Math.abs(dy) < EPS * Math.abs(y)) {
        return -8 * y
      }
    }
    return -8 * y
  }

  _cdf (x) {
    if (x <= 0) return 0
    let y = 0;
    for (let k = 1; k < MAX_ITER; k++) {
      const dy = (k % 2 === 0 ? 1 : -1) * Math.exp(-2 * (k * x) ** 2);
      y += dy;
      if (Math.abs(dy) < EPS * Math.abs(y)) {
        return 1 + 2 * y
      }
    }
    return 1 + 2 * y
  }
}

/**
 * Generator for the [Kumaraswamy distribution]{@link https://en.wikipedia.org/wiki/Kumaraswamy_distribution} (also
 * known as Minimax distribution):
 *
 * $$f(x; a, b) = a b x^{a-1} (1 - x^a)^{b - 1},$$
 *
 * with $a, b > 0$. Support: $x \in (0, 1)$.
 *
 * @class Kumaraswamy
 * @memberof ran.dist
 * @param {number=} alpha First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @constructor
 */
class Kumaraswamy extends Distribution {
  constructor (a = 1, b = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { a, b };
    Distribution.validate({ a, b }, [
      'a > 0',
      'b > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: 1,
      closed: true
    }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    // Handle case a < 1 and x << 1
    const a = Math.pow(x, this.p.a - 1);
    if (!Number.isFinite(a)) {
      return 0
    }

    // Handle case b < 1 and 1 - x << 1
    const b = Math.pow(1 - a * x, this.p.b - 1);
    if (!Number.isFinite(b)) {
      return 0
    }
    return this.p.a * this.p.b * a * b
  }

  _cdf (x) {
    return 1 - Math.pow(1 - Math.pow(x, this.p.a), this.p.b)
  }

  _q (p) {
    return Math.pow(1 - Math.pow(1 - p, 1 / this.p.b), 1 / this.p.a)
  }
}

/**
 * Generator for the [Laplace distribution]{@link https://en.wikipedia.org/wiki/Laplace_distribution} (also known as double exponential distribution):
 *
 * $$f(x; \mu, b) = \frac{1}{2b}e^{-\frac{|x - \mu|}{b}},$$
 *
 * where $\mu \in \mathbb{R}$ and $b > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class Laplace
 * @memberof ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} b Scale parameter. Default value is 1.
 * @constructor
 */
class Laplace extends Distribution {
  constructor (mu = 0, b = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { mu, b };
    Distribution.validate({ mu, b }, [
      'b > 0'
    ]);

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling from uniform
    return this.p.mu + this.p.b * Math.log(this.r.next() / this.r.next())
  }

  _pdf (x) {
    return 0.5 * Math.exp(-Math.abs(x - this.p.mu) / this.p.b) / this.p.b
  }

  _cdf (x) {
    const z = Math.exp((x - this.p.mu) / this.p.b);
    return x < this.p.mu ? 0.5 * z : 1 - 0.5 / z
  }

  _q (p) {
    return p < 0.5
      ? this.p.mu + this.p.b * Math.log(2 * p)
      : this.p.mu - this.p.b * Math.log(2 - 2 * p)
  }
}

/**
 * Generator for the [Lévy distribution]{@link https://en.wikipedia.org/wiki/Lévy_distribution}:
 *
 * $$f(x; \mu, c) = \sqrt{\frac{c}{2 \pi}}\frac{e^{-\frac{c}{2(x - \mu)}}}{(x - \mu)^{3/2}},$$
 *
 * with $\mu \in \mathbb{R}$ and $c > 0$. Support: $x \in [\mu, \infty)$.
 *
 * @class Levy
 * @memberof ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} c Scale parameter. Default value is 1.
 * @constructor
 */
class levy extends Distribution {
  constructor (mu = 0, c = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { mu, c };
    Distribution.validate({ mu, c }, [
      'c > 0'
    ]);

    // Set support
    this.s = [{
      value: mu,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling by transforming normal variate
    const y = normal(this.r, 0, 1 / Math.sqrt(this.p.c));
    return this.p.mu + 1 / (y * y)
  }

  _pdf (x) {
    const z = x - this.p.mu;
    return Math.sqrt(0.5 * this.p.c / Math.PI) * Math.exp(-0.5 * this.p.c / z - 1.5 * Math.log(z))
  }

  _cdf (x) {
    return x === this.p.mu ? 0 : erfc(Math.sqrt(0.5 * this.p.c / (x - this.p.mu)))
  }
}

/**
 * Generator for the [Lindley distribution]{@link http://www.hjms.hacettepe.edu.tr/uploads/b35d591c-22f6-4136-8735-20c82936cd64.pdf}:
 *
 * $$f(x; \theta) = \frac{\theta^2}{1 + \theta} (1 + x) e^{-\theta x},$$
 *
 * with $\theta > 0$. Support: $x \ge 0$.
 *
 * @class Lindley
 * @memberof ran.dist
 * @param {number=} theta Shape parameter. Default value is 1.
 * @constructor
 */
class lindley extends Distribution {
  constructor (theta = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { theta };
    Distribution.validate({ theta }, [
      'theta > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      1 + theta,
      Math.exp(-theta - 1) * (1 + theta)
    ];
  }

  _generator () {
    // Inverse transform sampling using Lambert W.
    return -(lambertW1m(-this.r.next() * this.c[1]) + this.c[0]) / this.p.theta
  }

  _pdf (x) {
    return this.p.theta * this.p.theta * (1 + x) * Math.exp(-this.p.theta * x) / this.c[0]
  }

  _cdf (x) {
    return 1 - Math.exp(-this.p.theta * x) * (this.c[0] + this.p.theta * x) / this.c[0]
  }
}

/**
 * Generator for the (continuous) [logarithmic distribution]{@link http://mathworld.wolfram.com/LogarithmicDistribution.html}:
 *
 * $$f(x; a, b) = \frac{\ln x}{a (1 - \ln a) - b (1 - \ln b)},$$
 *
 * with $a, b \in [1, \infty)$ and $a < b$. Support: $x \in \[a, b\]$.
 *
 * @class Logarithmic
 * @memberof ran.dist
 * @param {number=} a Lower boundary of the distribution. Default value is 1.
 * @param {number=} b Upper boundary of the distribution. Default value is 2.
 * @constructor
 */
class logarithmic extends Distribution {
  constructor (a = 1, b = 2) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { a, b };
    Distribution.validate({ a, b }, [
      'a >= 1',
      'b >= 1',
      'a < b'
    ]);

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }];

    // Speed-up constants
    this.c = [
      a * (1 - Math.log(a)),
      b * (1 - Math.log(b))
    ];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return Math.log(x) / (this.c[0] - this.c[1])
  }

  _cdf (x) {
    return (this.c[0] - x * (1 - Math.log(x))) / (this.c[0] - this.c[1])
  }

  _q (p) {
    const z = p * (this.c[0] - this.c[1]) - this.c[0];
    return z / lambertW0(z / Math.E)
  }
}

/**
 * Generator for the [log-Cauchy distribution]{@link https://en.wikipedia.org/wiki/Log-Cauchy_distribution}:
 *
 * $$f(x; \mu, \sigma) = \frac{1}{\pi x}\bigg\[\frac{\sigma}{(\ln x - \mu)^2 + \sigma^2}\bigg\],$$
 *
 * with $\mu \in \mathbb{R}$ and $\sigma > 0$. Support: $x > 0$.
 *
 * @class LogCauchy
 * @memberof ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @constructor
 */
class logCauchy extends Cauchy {
  // Transforming Cauchy distribution
  constructor (mu = 0, sigma = 1) {
    super(mu, sigma);

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling by transforming Cauchy variate
    const z = super._generator();

    // Handle |z| >> 1 cases
    return Math.max(Math.min(Number.MAX_VALUE, Math.exp(z)), Number.MIN_VALUE)
  }

  _pdf (x) {
    return super._pdf(Math.log(x)) / x
  }

  _cdf (x) {
    return super._cdf(Math.log(x))
  }

  _q (p) {
    return Math.exp(super._q(p))
  }
}

/**
 * Generator for the [log-gamma distribution]{@link https://reference.wolfram.com/language/ref/LogGammaDistribution.html} using the
 * shape/rate parametrization:
 *
 * $$f(x; \alpha, \beta, \mu) = \frac{\beta^\alpha}{\Gamma(\alpha)} \ln^{\alpha - 1}(x - \mu + 1) (x - \mu + 1)^{-(1 + \beta)},$$
 *
 * where $\alpha, \beta > 0$ and $\mu \ge 0$. Support: $x \in [\mu, \infty)$.
 *
 * @class LogGamma
 * @memberof ran.dist
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @param {number=} beta Rate parameter. Default value is 1.
 * @param {number=} mu Location parameter. Default value is 0.
 * @constructor
 */
class logGamma extends Gamma {
  constructor (alpha = 1, beta = 1, mu = 0) {
    super(alpha, beta);

    // Validate parameters
    this.p = Object.assign(this.p, { mu });
    Distribution.validate({ mu }, [
      'mu >= 0'
    ]);

    // Set support
    this.s = [{
      value: mu,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling by transforming gamma variate
    return Math.exp(super._generator()) + this.p.mu - 1
  }

  _pdf (x) {
    return super._pdf(Math.log(x - this.p.mu + 1)) / (x - this.p.mu + 1)
  }

  _cdf (x) {
    return super._cdf(Math.log(x - this.p.mu + 1))
  }
}

/**
 * Generator for the [logistic distribution]{@link https://en.wikipedia.org/wiki/Logistic_distribution}:
 *
 * $$f(x; \mu, s) = \frac{e^{-z}}{s (1 + e^{-z})^2},$$
 *
 * with $z = \frac{x - \mu}{s}$, $\mu \in \mathbb{R}$ and $s > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class Logistic
 * @memberof ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} s Scale parameter. Default value is 1.
 * @constructor
 */
class logistic extends Distribution {
  constructor (mu = 0, s = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { mu, s };
    Distribution.validate({ mu, s }, [
      's > 0'
    ]);

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const z = Math.exp(-(x - this.p.mu) / this.p.s);
    return Number.isFinite(z * z)
      ? z / (this.p.s * Math.pow(1 + z, 2))
      : 0
  }

  _cdf (x) {
    return 1 / (1 + Math.exp(-(x - this.p.mu) / this.p.s))
  }

  _q (p) {
    return this.p.mu - this.p.s * Math.log(1 / p - 1)
  }
}

/**
 * Generator for the [logistic-exponential distribution]{@link http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.295.8653&rep=rep1&type=pdf}:
 *
 * $$f(x; \lambda, \kappa) = \frac{\lambda \kappa (e^{\lambda x} - 1)^{\kappa - 1} e^{\lambda x}}{\[1 + (e^{\lambda x} - 1)^\kappa\]^2},$$
 *
 * where $\lambda, \kappa > 0$. Support: $x > 0$.
 *
 * @class LogisticExponential
 * @memberof ran.dist
 * @param {number=} lambda Scale parameter. Default value is 1.
 * @param {number=} kappa Shape parameter. Default value is 1.
 * @constructor
 */
class logisticExponential extends Distribution {
  constructor (lambda = 1, kappa = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { lambda, kappa };
    Distribution.validate({ lambda, kappa }, [
      'lambda > 0',
      'kappa > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: kappa >= 1
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const y = Math.exp(this.p.lambda * x);
    return Number.isFinite(Math.pow(y, 2 * this.p.kappa)) ? this.p.lambda * this.p.kappa * Math.pow(y - 1, this.p.kappa - 1) * y / Math.pow(1 + Math.pow(y - 1, this.p.kappa), 2) : 0
  }

  _cdf (x) {
    // Calculate 1 - S for robustness
    return 1 - 1 / (1 + Math.pow(Math.exp(this.p.lambda * x) - 1, this.p.kappa))
  }

  _q (p) {
    const z = Math.pow(p / (1 - p), 1 / this.p.kappa);

    // Handle z << 1 cases
    return 1 + z === 1
      ? z / this.p.lambda
      : Math.log(1 + z) / this.p.lambda
  }
}

/**
 * Generator for the [logit-normal distribution]{@link https://en.wikipedia.org/wiki/Logit-normal_distribution}:
 *
 * $$f(x; \mu, \sigma) = \frac{1}{\sigma \sqrt{2 \pi} x (1 - x)} e^{-\frac{\[\mathrm{logit}(x) - \mu\]^2}{2 \sigma^2}},$$
 *
 * with $\mu \in \mathbb{R}$, $\sigma > 0$ and $\mathrm{logit}(x) = \ln \frac{x}{1 - x}$. Support: $x \in (0, 1)$.
 *
 * @class LogitNormal
 * @memberof ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @constructor
 */
class logitNormal extends Normal {
  // Transforming normal distribution
  constructor (mu = 0, sigma = 1) {
    super(mu, sigma);

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: 1,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling by transforming normal variate
    return 1 / (1 + Math.exp(-super._generator()))
  }

  _pdf (x) {
    return super._pdf(Math.log(x / (1 - x))) / (x * (1 - x))
  }

  _cdf (x) {
    return super._cdf(Math.log(x / (1 - x)))
  }

  _q (p) {
    return 1 / (1 + Math.exp(-super._q(p)))
  }
}

/**
 * Generator for the [log-Laplace distribution]{@link https://en.wikipedia.org/wiki/Log-Laplace_distribution}:
 *
 * $$f(x; \mu, b) = \frac{1}{2bx}e^{-\frac{|\mathrm{ln} x - \mu|}{b}},$$
 *
 * where $\mu \in \mathbb{R}$ and $b > 0$. Support: $x > 0$.
 *
 * @class LogLaplace
 * @memberof ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} b Scale parameter. Default value is 1.
 * @constructor
 */
class logLaplace extends Laplace {
  // Transforming Laplace distribution
  constructor (mu = 0, b = 1) {
    super(mu, b);

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling by transforming Laplace variate
    return Math.exp(super._generator())
  }

  _pdf (x) {
    return super._pdf(Math.log(x)) / x
  }

  _cdf (x) {
    return super._cdf(Math.log(x))
  }

  _q (p) {
    return Math.exp(super._q(p))
  }
}

/**
 * Generator for the [log-logistic distribution]{@link https://en.wikipedia.org/wiki/Log-logistic_distribution} (also known as Fisk distribution):
 *
 * $$f(x; \alpha, \beta) = \frac{(\beta / \alpha) (x / \alpha)^{\beta - 1}}{\[1 + (x / \alpha)^\beta\]^2},$$
 *
 * with $\alpha, \beta > 0$. Support: $x \in [0, \infty)$.
 *
 * @class LogLogistic
 * @memberof ran.dist
 * @param {number=} alpha Scale parameter. Default value is 1.
 * @param {number=} beta Shape parameter. Default value is 1.
 * @constructor
 */
class logLogistic extends Distribution {
  constructor (alpha = 1, beta = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { alpha, beta };
    Distribution.validate({ alpha, beta }, [
      'alpha > 0',
      'beta > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      beta / alpha
    ];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    const xa = x / this.p.alpha;
    const y = Math.pow(xa, this.p.beta - 1);
    return this.c[0] * y / Math.pow(1 + xa * y, 2)
  }

  _cdf (x) {
    return 1 / (1 + Math.pow(x / this.p.alpha, -this.p.beta))
  }

  _q (p) {
    return this.p.alpha * Math.pow(1 / p - 1, -1 / this.p.beta)
  }
}

/**
 * Generator for the [log-series distribution]{@link https://en.wikipedia.org/wiki/Logarithmic_distribution}:
 *
 * $$f(k; p) = \frac{-1}{\ln(1 - p)}\frac{p^k}{k},$$
 *
 * with $p \in (0, 1)$. Support: $k \in \mathbb{N}^+$.
 *
 * @class LogSeries
 * @memberof ran.dist
 * @param {number=} p Distribution parameter. Default value is 0.5.
 * @constructor
 */
class logSeries extends Distribution {
  constructor (p = 0.5) {
    super('discrete', arguments.length);

    // Validate parameters
    this.p = { p };
    Distribution.validate({ p }, [
      'p > 0', 'p < 1'
    ]);

    // Set support
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling
    return Math.floor(1 + Math.log(this.r.next()) / Math.log(1 - Math.pow(1 - this.p.p, this.r.next())))
  }

  _pdf (x) {
    return -Math.pow(this.p.p, x) / (x * Math.log(1 - this.p.p))
  }

  _cdf (x) {
    return 1 + betaIncomplete(x + 1, 0, this.p.p) / Math.log(1 - this.p.p)
  }
}

/**
 * Generator for the [Lomax distribution]{@link https://en.wikipedia.org/wiki/Lomax_distribution}:
 *
 * $$f(x; \lambda, \alpha) = \frac{\alpha}{\lambda}\bigg\[1 + \frac{x}{\lambda}\bigg\]^{-(\alpha + 1)},$$
 *
 * with $\lambda, \alpha > 0$. Support: $x \ge 0$.
 *
 * @class Lomax
 * @memberof ran.dist
 * @param {number=} lambda Scale parameter. Default value is 1.
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @constructor
 */
class lomax extends Distribution {
  constructor (lambda = 1, alpha = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { lambda, alpha };
    Distribution.validate({ lambda, alpha }, [
      'lambda > 0',
      'alpha > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.p.alpha * Math.pow(1 + x / this.p.lambda, -1 - this.p.alpha) / this.p.lambda
  }

  _cdf (x) {
    return 1 - Math.pow(1 + x / this.p.lambda, -this.p.alpha)
  }

  _q (p) {
    return this.p.lambda * (Math.pow(1 - p, -1 / this.p.alpha) - 1)
  }
}

/**
 * Generator for the [Makeham distribution]{@link https://en.wikipedia.org/wiki/Gompertz%E2%80%93Makeham_law_of_mortality}
 * (also known as Gompertz-Makeham distribution):
 *
 * $$f(x; \alpha, \beta, \lambda) = (\alpha e^{\beta x} + \lambda) \exp\Big\[{-\lambda x - \frac{\alpha}{\beta}(e^{\beta x} - 1)}\Big\],$$
 *
 * with $\alpha, \beta, \lambda > 0$. Support: $x > 0$.
 *
 * @class Makeham
 * @memberof ran.dist
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @param {number=} beta Rate parameter. Default value is 1.
 * @param {number=} lambda Scale parameter. Default value is 1.
 */
class makeham extends Distribution {
  constructor (alpha = 1, beta = 1, lambda = 1) {
    super('continuous', arguments.length);

    // Validate parameters.
    this.p = { alpha, beta, lambda };
    Distribution.validate({ alpha, beta, lambda }, [
      'alpha > 0',
      'beta > 0',
      'lambda > 0'
    ]);

    // Set support.
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants.
    this.c = [
      alpha / (beta * lambda),
      alpha * Math.exp(alpha / lambda) / lambda,
      -beta / lambda
    ];
  }

  _generator () {
    // Inverse transform sampling.
    return this._q(this.r.next())
  }

  _pdf (x) {
    const y = Math.exp(this.p.beta * x);

    // Handle y >> 1 cases.
    if (Number.isFinite(Math.exp(y))) {
      return (this.p.alpha * y + this.p.lambda) * Math.exp(-this.p.lambda * x - this.p.alpha * (y - 1) / this.p.beta)
    } else {
      return 0
    }
  }

  _cdf (x) {
    return 1 - Math.exp(-this.p.lambda * x - this.p.alpha * (Math.exp(this.p.beta * x) - 1) / this.p.beta)
  }

  _q (p) {
    const z = this.c[1] * Math.pow(1 - p, this.c[2]);

    // Handle z >> 1 case.
    const w = lambertW0(z);
    if (Number.isFinite(w)) {
      return this.c[0] - Math.log(1 - p) / this.p.lambda - w / this.p.beta
    } else {
      const t = Math.log(this.c[1]) + this.c[2] * Math.log(1 - p);
      return this.c[0] - Math.log(1 - p) / this.p.lambda - (t - Math.log(t)) / this.p.beta
    }
  }
}

/**
 * Generator for the [Maxwell-Boltzmann distribution]{@link https://en.wikipedia.org/wiki/Maxwell%E2%80%93Boltzmann_distribution}:
 *
 * $$f(x; a) = \sqrt{\frac{2}{\pi}}\frac{x^2 e^{-x^2 / (2a^2)}}{a^3},$$
 *
 * with $a > 0$. Support: $x > 0$.
 *
 * @class MaxwellBoltzmann
 * @memberof ran.dist
 * @param {number=} a Scale parameter. Default value is 1.
 * @constructor
 */
class maxwellBoltzmann extends Gamma {
  constructor (a = 1) {
    super(1.5, 2 * a * a);

    // Validate parameters
    Distribution.validate({ a }, [
      'a > 0'
    ]);
  }
}

/**
 * Generator for the [Mielke distribution]{@link https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.mielke.html#r7049b665a02e-2}:
 *
 * $$f(x; k, s) = \frac{k x^{k - 1}}{(1 + x^s)^{1 + k/s}},$$
 *
 * with $k, s > 0$. Support: $x > 0$. It can be viewed as a re-parametrization of the [Dagum distribution]{@link #dist.Dagum}.
 *
 * @class Mielke
 * @memberof ran.dist
 * @param {number=} k First shape parameter. Default value is 2.
 * @param {number=} s Second shape parameter. Default value is 1.
 * @constructor
 */
class mielke extends Dagum {
  constructor (k = 2, s = 1) {
    super(k / s, s, 1);

    // Validate parameters
    Distribution.validate({ k, s }, [
      'k > 0',
      's > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }
}

/**
 * Performs rejection sampling.
 *
 * @method rejection
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {Function} g Generator for the sample (major function).
 * @param {Function} accept The function that returns the acceptance threshold.
 * @param {Function=} transform Optional transformation to apply once the sample is accepted (for transformed
 * distributions).
 * @return {(number|undefined)} The sampled random variate.
 * @ignore
 */
function rejection (r, g, accept, transform) {
  for (let trial = 0; trial < MAX_ITER; trial++) {
    const x = g();
    if (r.next() < accept(x)) {
      return typeof transform !== 'undefined' ? transform(x) : x
    }
  }
}

/**
 * Generator for the [Moyal distribution]{@link https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.moyal.html#r7049b665a02e-2}:
 *
 * $$f(x; \mu, \sigma) = \frac{1}{\sqrt{2 \pi}}e^{-\frac{1}{2}(z + e^{-z})},$$
 *
 * where $z = \frac{x - \mu}{\sigma}$, $\mu \in \mathbb{R}$ and $\sigma > 0$. Support: $x \in \mathbb{R}$.
 *
 * @class Moyal
 * @memberof ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @constructor
 */
class moyal extends Distribution {
  constructor (mu = 0, sigma = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { mu, sigma };
    Distribution.validate({ mu, sigma }, [
      'sigma > 0'
    ]);

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      sigma * Math.sqrt(2 * Math.PI)
    ];
  }

  _generator () {
    return rejection(
      this.r,
      () => Math.PI * this.r.next() - Math.PI / 2,
      t => {
        const z = Math.tan(t);
        return Math.exp(-0.5 * (z + Math.exp(-z))) / (Math.sqrt(2 * Math.PI) * Math.pow(Math.cos(t), 2))
      }, t => this.p.sigma * Math.tan(t) + this.p.mu
    )
  }

  _pdf (x) {
    const z = (x - this.p.mu) / this.p.sigma;
    return Math.exp(-0.5 * (z + Math.exp(-z))) / this.c[0]
  }

  _cdf (x) {
    return 1 - gammaLowerIncomplete(0.5, 0.5 * Math.exp((this.p.mu - x) / this.p.sigma))
  }
}

// https://journals.vgtu.lt/index.php/MMA/article/view/1001/767


/**
 * Generator for the [Muth distribution]{@link https://www.tandfonline.com/doi/abs/10.3846/13926292.2015.1048540:
 *
 * $$f(x; \alpha) = (e^{\alpha x} - \alpha) \exp\bigg(\alpha x - \frac{1}{\alpha} (e^{\alpha x} - 1)\bigg),$$
 *
 * with $\alpha \in (0, 1]$. Support: $x > 0$.
 *
 * @class Muth
 * @memberof ran.dist
 * @param {number=} alpha Shape parameter. Default value is 0.5.
 * @constructor
 */
class muth extends Distribution {
  constructor (alpha = 0.5) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { alpha };
    Distribution.validate({ alpha }, [
      'alpha > 0', 'alpha <= 1'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _survival (x) {
    return Math.exp(this.p.alpha * x - (Math.exp(this.p.alpha * x) - 1) / this.p.alpha)
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return (Math.exp(this.p.alpha * x) - this.p.alpha) * this._survival(x)
  }

  _cdf (x) {
    return 1 - this._survival(x)
  }

  _q (p) {
    // Using Eq. (3.2) in Jodra et al: On the Muth Distribution
    return (Math.log(1 - p) - lambertW1m((p - 1) / (this.p.alpha * Math.exp(1 / this.p.alpha))) - 1 / this.p.alpha) / this.p.alpha
  }
}

/**
 * Generator for the [Nakagami distribution]{@link https://en.wikipedia.org/wiki/Nakagami_distribution}:
 *
 * $$f(x; m, \Omega) = \frac{2m^m}{\Gamma(m) \Omega^m} x^{2m - 1} e^{-\frac{m}{\Omega} x^2},$$
 *
 * where $m \in \mathbb{R}$, $m \ge 0.5$ and $\Omega > 0$. Support: $x > 0$.
 *
 * @class Nakagami
 * @memberof ran.dist
 * @param {number=} m Shape parameter. Default value is 1.
 * @param {number=} omega Spread parameter. Default value is 1.
 * @constructor
 */
class nakagami extends Distribution {
  constructor (m = 1, omega = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { m, omega };
    Distribution.validate({ m, omega }, [
      'm >= 0.5',
      'omega > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      2 * Math.pow(this.p.m, this.p.m) / Math.pow(this.p.omega, this.p.m)
    ];
  }

  _generator () {
    // Direct sampling from gamma
    return Math.sqrt(gamma(this.r, this.p.m, this.p.m / this.p.omega))
  }

  _pdf (x) {
    return this.c[0] * Math.pow(x, 2 * this.p.m - 1) * Math.exp(-this.p.m * x * x / this.p.omega - logGamma$1(this.p.m))
  }

  _cdf (x) {
    return gammaLowerIncomplete(this.p.m, this.p.m * x * x / this.p.omega)
  }
}

/**
 * Generator for the [negative-binomial distribution]{@link https://en.wikipedia.org/wiki/Negative_binomial_distribution}
 * (also known as Gamma-Poisson, Pascal or Pólya distribution):
 *
 * $$f(k; r, p) = \begin{pmatrix}k + r - 1 \\\\ k \\\\ \end{pmatrix} (1 - p)^r p^k,$$
 *
 * with $r \in \mathbb{N}^+$ and $p \in \[0, 1\]$. Support: $k \in \mathbb{N}_0$.
 *
 * @class NegativeBinomial
 * @memberof ran.dist
 * @param {number=} r Number of failures until the experiment is stopped. If not an integer, it is rounded to the nearest
 * integer. Default value is 10.
 * @param {number=} p Probability of success. Default value is 0.5.
 * @constructor
 */
class negativeBinomial extends Distribution {
  constructor (r = 10, p = 0.5) {
    super('discrete', arguments.length);

    // Validate parameters
    const ri = Math.round(r);
    this.p = { r: ri, p };
    Distribution.validate({ r: ri, p }, [
      'r > 0',
      'p >= 0', 'p <= 1'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling by compounding Poisson and gamma
    return poisson$1(this.r, gamma(this.r, this.p.r, 1 / this.p.p - 1))
  }

  _pdf (x) {
    return Math.exp(logBinomial(x + this.p.r - 1, x) + this.p.r * Math.log(1 - this.p.p) + x * Math.log(this.p.p))
  }

  _cdf (x) {
    return 1 - regularizedBetaIncomplete(x + 1, this.p.r, this.p.p)
  }
}

/**
 * Generator for the [negative hypergeometric distribution]{@link https://en.wikipedia.org/wiki/Negative_hypergeometric_distribution}:
 *
 * $$f(k; N, K, r) = \frac{\begin{pmatrix}k + r - 1 \\\\ k \\\\ \end{pmatrix} \begin{pmatrix}N - r - k \\\\ K - k \\\\ \end{pmatrix}}{\begin{pmatrix}N \\\\ K \\\\ \end{pmatrix}},$$
 *
 * with $N \in \mathbb{N}_0$, $K \in \{0, 1, ..., N\}$ and $r \in \{0, 1, ..., N - K\}$. Support: $k \in \{0, ..., K\}$.
 *
 * @class NegativeHypergeometric
 * @memberof ran.dist
 * @param {number=} N Total number of elements to sample from. If not an integer, it is rounded to the nearest one. Default value is 10.
 * @param {number=} K Total number of successes. If not an integer, it is rounded to the nearest one. Default value is 5.
 * @param {number=} r Total number of failures to stop at. If not an integer, it is rounded to the nearest one. Default value is 5.
 * @constructor
 */
class negativeHypergeometric extends Categorical {
  constructor (N = 10, K = 5, r = 5) {
    // Validate parameters
    const Ni = Math.round(N);
    const Ki = Math.round(K);
    const ri = Math.round(r);
    Distribution.validate({ N: Ni, K: Ki, r: ri, 'N - K': Ni - Ki }, [
      'N >= 0',
      'K > 0', 'K <= N',
      'r > 0', 'r <= N - K'
    ]);

    // Build weights
    const weights = [];
    for (let k = 0; k <= Ki; k++) {
      weights.push(Math.exp(logBinomial(Ki + ri - 1, k) + logBinomial(Ni - ri - k, Ki - k) - logBinomial(Ni, Ki)));
    }
    super(weights);
  }
}

/**
 * Generator for the [Neyman type A distribution]{@link http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.527.574&rep=rep1&type=pdf}:
 *
 *$$f(k; \lambda, \phi) = \frac{e^{-\lambda + \lambda e^{-\phi}} \phi^k}{k!} \sum_{j=1}^k S(k, j) \lambda^k e^{-\phi k},$$
 *
 * where $\lambda, \theta > 0$ and $S(n, m)$ denotes the [Stirling number of the second kind]{@link https://en.wikipedia.org/wiki/Stirling_numbers_of_the_second_kind}. Support: $k \in \mathbb{N}_0$.
 *
 * @class NeymanA
 * @memberof ran.dist
 * @param {number=} lambda Mean of the number of clusters. Default value is 1.
 * @param {number=} phi Mean of the cluster size. Default value is 1.
 * @constructor
 */
class neymanA extends PreComputed {
  constructor (lambda = 1, phi = 1) {
    // Using raw probability mass values
    super();

    // Validate parameters
    this.p = { lambda, phi };
    Distribution.validate({ lambda, phi }, [
      'lambda > 0',
      'phi > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      Math.exp(-lambda * (1 - Math.exp(-phi))),
      lambda * phi * Math.exp(-phi)
    ];
  }

  // Using Eq. (131) in Johnson, Kotz, Kemp: Univariate Discrete Distributions.
  _pk (k) {
    if (k === 0) {
      return this.c[0]
    }

    let dz = 1;
    let z = this.pdfTable[k - 1];
    for (let j = 1; j < k; j++) {
      dz *= this.p.phi / j;
      z += dz * this.pdfTable[k - j - 1];
    }
    return this.c[1] * z / k
  }

  _generator () {
    const N = poisson$1(this.r, this.p.lambda);
    let z = 0;
    for (let i = 0; i < N; i++) {
      z += poisson$1(this.r, this.p.phi);
    }
    return Math.round(z)
  }
}

/**
 * Generator for the [non-central beta distribution]{@link https://en.wikipedia.org/wiki/Noncentral_beta_distribution}:
 *
 * $$f(x; \alpha, \beta, \lambda) = e^{-\frac{\lambda}{2}} \sum\_{k = 0}^\infty \frac{1}{k!} \bigg(\frac{\lambda}{2}\bigg)^k \frac{x^{\alpha + k - 1} (1 - x)^{\beta - 1}}{\mathrm{B}(\alpha + k, \beta)},$$
 *
 * where $\alpha, \beta > 0$ and $\lambda \ge 0$. Support: $x \in \[0, 1\]$.
 *
 * @class NoncentralBeta
 * @memberof ran.dist
 * @param {number=} alpha First shape parameter. Default value is 1.
 * @param {number=} beta Second shape parameter. Default value is 1.
 * @param {number=} lambda Non-centrality parameter. Default value is 1.
 * @constructor
 */
class NoncentralBeta extends Distribution {
  // TODO Use outward iteration
  constructor (alpha = 1, beta$1 = 1, lambda = 1) {
    super('continuous', arguments.length);

    // Validate parameters.
    this.p = { alpha, beta: beta$1, lambda };
    Distribution.validate({ alpha, beta: beta$1, lambda }, [
      'alpha > 0',
      'beta > 0',
      'lambda >= 0'
    ]);

    // Set support.
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: 1,
      closed: true
    }];

    // Speed-up constants.
    this.c = [
      Math.exp(-lambda / 2),
      beta(alpha, beta$1)
    ];
  }

  _generator () {
    // Direct sampling from non-central chi2 and chi2.
    const x = noncentralChi2(this.r, 2 * this.p.alpha, this.p.lambda);
    const y = chi2(this.r, 2 * this.p.beta);
    const z = x / (x + y);

    // Handle 1 - z << 1 case.
    if (Math.abs(1 - z) < Number.EPSILON) {
      return 1 - y / x
    } else {
      return z
    }
  }

  _pdf (x) {
    // Speed-up variables.
    const l2 = this.p.lambda / 2;
    const i0 = Math.round(l2);
    let iAlpha0 = this.p.alpha + i0;

    // Init variables.
    const p0 = Math.exp(-l2 + i0 * Math.log(l2) - logGamma$1(i0 + 1));
    const xa0 = Math.pow(x, iAlpha0 - 1);
    const xb = Math.pow(1 - x, this.p.beta - 1);
    const b0 = beta(iAlpha0, this.p.beta);

    // Forward sum.
    let z = recursiveSum({
      p: p0,
      xa: xa0,
      b: b0
    }, (t, i) => {
      t.p *= l2 / (i + i0);
      return t
    }, t => t.p * t.xa * xb / t.b, (t, i) => {
      const iAlpha = iAlpha0 + i;
      t.xa *= x;
      t.b *= iAlpha / (iAlpha + this.p.beta);
      return t
    });

    // Backward sum.
    if (i0 > 0) {
      iAlpha0--;
      const xa = xa0 / x;
      const b = b0 * (iAlpha0 + this.p.beta) / iAlpha0;
      z += recursiveSum({
        p: p0 * i0 / l2,
        xa,
        b
      }, (t, i) => {
        const j = i0 - i - 1;
        const iAlpha = iAlpha0 - i;
        if (j >= 0) {
          t.p /= l2 / (j + 1);
          t.xa /= x;
          t.b /= iAlpha / (iAlpha + this.p.beta);
        } else {
          t.p = 0;
          t.ib = 0;
        }
        return t
      }, t => t.p * t.xa * xb / t.b);
    }

    return z
  }

  _cdf (x) {
    // Speed-up variables
    const l2 = this.p.lambda / 2;
    const i0 = Math.round(l2);
    let iAlpha0 = this.p.alpha + i0;

    // Init variables
    const p0 = Math.exp(-l2 + i0 * Math.log(l2) - logGamma$1(i0 + 1));
    const xa0 = Math.pow(x, iAlpha0);
    const xb = Math.pow(1 - x, this.p.beta);
    const b0 = beta(iAlpha0, this.p.beta);
    const ib0 = regularizedBetaIncomplete(iAlpha0, this.p.beta, x);

    // Forward sum.
    let z = recursiveSum({
      p: p0,
      xa: xa0,
      b: b0,
      ib: ib0
    }, (t, i) => {
      t.p *= l2 / (i + i0);
      return t
    }, t => t.p * t.ib, (t, i) => {
      const iAlpha = iAlpha0 + i;
      t.ib -= t.xa * xb / (iAlpha * t.b);
      t.xa *= x;
      t.b *= iAlpha / (iAlpha + this.p.beta);
      return t
    });

    // Backward sum.
    if (i0 > 0) {
      iAlpha0--;
      const xa = xa0 / x;
      const b = b0 * (iAlpha0 + this.p.beta) / iAlpha0;
      z += recursiveSum({
        p: p0 * i0 / l2,
        xa,
        b,
        ib: ib0 + xa * xb / (iAlpha0 * b)
      }, (t, i) => {
        const j = i0 - i - 1;
        const iAlpha = iAlpha0 - i;
        if (j >= 0) {
          t.p /= l2 / (j + 1);
          t.xa /= x;
          t.b /= iAlpha / (iAlpha + this.p.beta);
          t.ib += t.xa * xb / (iAlpha * t.b);
        } else {
          t.p = 0;
          t.ib = 0;
        }
        return t
      }, t => t.p * t.ib);
    }

    return Math.min(1, z)
  }
}

/**
 * Generator for the [non-central $\chi^2$ distribution]{@link https://en.wikipedia.org/wiki/Noncentral_chi-squared_distribution}:
 *
 * $$f(x; k; \lambda) = \frac{1}{2}e^{-\frac{x + \lambda}{2}} \bigg(\frac{x}{\lambda}\bigg)^{k/4 - 1/2} I_{k/2 - 1}\big(\sqrt{\lambda x}\big),$$
 *
 * with $k \in \mathbb{N}^+$, $\lambda > 0$ and $I_n(x)$ is the modified Bessel function of the first kind with order $n$. Support: $x \in [0, \infty)$.
 *
 * @class NoncentralChi2
 * @memberof ran.dist
 * @param {number=} k Degrees of freedom. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @param {number=} lambda Non-centrality parameter. Default value is 1.
 * @constructor
 */
class NoncentralChi2 extends Distribution {
  constructor (k = 2, lambda = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    const ki = Math.round(k);
    this.p = { k: ki, lambda };
    Distribution.validate({ k: ki, lambda }, [
      'k > 0',
      'lambda > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      this.p.k % 2 === 0
    ];
  }

  _generator () {
    // Direct sampling
    return noncentralChi2(this.r, this.p.k, this.p.lambda)
  }

  _pdf (x) {
    if (this.c[0]) {
      // k is even
      if (this.p.k === 2 && x === 0) {
        // k = 2, x -> 0, by differentiating F(x)
        return 0.5 * Math.exp(-0.5 * this.p.lambda)
      } else {
        return 0.5 * Math.exp(-0.5 * (x + this.p.lambda) + (this.p.k / 4 - 0.5) * Math.log(x / this.p.lambda)) * besselI(Math.round(this.p.k / 2) - 1, Math.sqrt(this.p.lambda * x))
        // return 0.5 * Math.exp(-0.5 * (x + this.p.lambda)) * Math.pow(x / this.p.lambda, this.p.k / 4 - 0.5) * besselI(Math.abs(Math.floor(this.p.k / 2) - 1), Math.sqrt(this.p.lambda * x))
      }
    } else {
      // k is odd
      if (this.p.k === 1 && x === 0) {
        // k = 1, x -> 0, by differentiating F(x)
        return 0.5 * Math.exp(-0.5 * this.p.lambda) * Math.sqrt(2 / Math.PI)
      } else {
        return 0.5 * Math.exp(-0.5 * (x + this.p.lambda)) * Math.pow(x / this.p.lambda, this.p.k / 4 - 0.5) * besselISpherical(Math.floor((this.p.k - 3) / 2), Math.sqrt(this.p.lambda * x)) * Math.sqrt(2 * Math.sqrt(x * this.p.lambda) / Math.PI)
      }
    }
  }

  _cdf (x) {
    return 1 - marcumQ(this.p.k / 2, this.p.lambda / 2, x / 2)
  }
}

/**
 * Generator for the [non-central $\chi$ distribution]{@link https://en.wikipedia.org/wiki/Noncentral_chi_distribution}:
 *
 * $$f(x; k; \lambda) = \frac{x^k \lambda}{(\lambda x)^{k/2}} e^{-\frac{x^2 + \lambda^2}{2}} I_{k/2 - 1}(\lambda x),$$
 *
 * with $k \in \mathbb{N}^+$, $\lambda > 0$ and $I_n(x)$ is the modified Bessel function of the first kind with order $n$. Support: $x \in [0, \infty)$.
 *
 * @class NoncentralChi
 * @memberof ran.dist
 * @param {number=} k Degrees of freedom. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @param {number=} lambda Non-centrality parameter. Default value is 1.
 * @constructor
 */
class noncentralChi extends NoncentralChi2 {
  // Transformation of non-central chi2 distribution
  constructor (k = 2, lambda = 1) {
    const ki = Math.round(k);
    super(ki, lambda * lambda);

    // Validate parameters
    Distribution.validate({ k: ki, lambda }, [
      'lambda > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling by transforming non-central chi2 variate
    return Math.sqrt(super._generator())
  }

  _pdf (x) {
    return 2 * x * super._pdf(x * x)
  }

  _cdf (x) {
    return super._cdf(x * x)
  }
}

/**
 * Generator for the [non-central F distribution]{@link https://en.wikipedia.org/wiki/Noncentral_F-distribution}:
 *
 * $$f(x; d\_1, d\_2, \lambda) = e^{-\frac{\lambda}{2}} \sum\_{k=0}^\infty \frac{1}{k!} \bigg(\frac{\lambda}{2}\bigg)^k \frac{\Big(\frac{d_1}{d_2}\Big)^{\frac{d_1}{2} + k} \Big(\frac{d_2}{d_2 + d_1 x}\Big)^{\frac{d_1 + d_2}{2} + k}}{\mathrm{B}\Big(\frac{d_2}{2}, \frac{d_1}{2} + k\Big)} x^{\frac{d_1}{2} -1 + k},$$
 *
 * where $d_1, d_2 \in \mathbb{N}^+$ and $\lambda > 0$. Support: $x \ge 0$.
 *
 * @class NoncentralF
 * @memberof ran.dist
 * @param {number=} d1 First degree of freedom. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @param {number=} d2 Second degree of freedom. If not an integer, it is rounded to the nearest one. Default value is 2.
 * @param {number=} lambda Non-centrality parameter. Default value is 1.
 * @constructor
 */
class noncentralF extends NoncentralBeta {
  // Transformation of non-central beta distribution
  constructor (d1 = 2, d2 = 2, lambda = 1) {
    const d1i = Math.round(d1);
    const d2i = Math.round(d2);
    super(d1i / 2, d2i / 2, lambda);

    // Validate parameters
    this.p = Object.assign(this.p, { d1: d1i, d2: d2i, lambda });
    Distribution.validate({ d1: d1i, d2: d2i, lambda }, [
      'd1 > 0',
      'd2 > 0',
      'lambda > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling by transforming non-central beta variate
    const x = super._generator();
    return this.p.d2 * x / (this.p.d1 * (1 - x))
  }

  _pdf (x) {
    return this.p.d1 * this.p.d2 * super._pdf(this.p.d1 * x / (this.p.d2 + this.p.d1 * x)) / Math.pow(this.p.d2 + this.p.d1 * x, 2)
  }

  _cdf (x) {
    const y = this.p.d1 * x;
    return super._cdf(1 / (1 + this.p.d2 / y))
  }
}

/**
 * Generator for the [Pareto distribution]{@link https://en.wikipedia.org/wiki/Pareto_distribution}:
 *
 * $$f(x; x_\mathrm{min}, \alpha) = \frac{\alpha x_\mathrm{min}^\alpha}{x^{\alpha + 1}},$$
 *
 * with $x_\mathrm{min}, \alpha > 0$. Support: $x \in [x_\mathrm{min}, \infty)$.
 *
 * @class Pareto
 * @memberof ran.dist
 * @param {number=} xmin Scale parameter. Default value is 1.
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @constructor
 */
class pareto extends Distribution {
  constructor (xmin = 1, alpha = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { xmin, alpha };
    Distribution.validate({ xmin, alpha }, [
      'xmin > 0',
      'alpha > 0'
    ]);

    // Set support
    this.s = [{
      value: xmin,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.p.alpha * Math.pow(this.p.xmin / x, this.p.alpha) / x
  }

  _cdf (x) {
    return 1 - Math.pow(this.p.xmin / x, this.p.alpha)
  }

  _q (p) {
    return this.p.xmin / Math.pow(1 - p, 1 / this.p.alpha)
  }
}

/**
 * Generator for the [PERT distribution]{@link https://en.wikipedia.org/wiki/PERT_distribution}:
 *
 * $$f(x; a, b, c) = \frac{(x - a)^{\alpha - 1} (c - x)^{\beta - 1}}{\mathrm{B}(\alpha, \beta) (c - a)^{\alpha + \beta + 1}},$$
 *
 * where $a, b, c \in \mathbb{R}$, $a < b < c$, $\alpha = \frac{4b + c - 5a}{c - a}$, $\beta = \frac{5c - a -4b}{c - a}$ and $\mathrm{B}(x, y)$ is the beta function. Support: $x \in [a, c]$.
 *
 * @class PERT
 * @memberof ran.dist
 * @param {number=} a Lower boundary of the support. Default value is 0.
 * @param {number=} b Mode of the distribution. Default value is 0.5.
 * @param {number=} c Upper boundary of the support. Default value is 1.
 * @constructor
 */
class pert extends Beta {
  constructor (a = 0, b = 0.5, c = 1) {
    super((4 * b + c - 5 * a) / (c - a), (5 * c - a - 4 * b) / (c - a));

    // Validate parameters
    this.p = Object.assign(this.p, { a, b, c });
    Distribution.validate({ a, b, c }, [
      'a < b',
      'b < c'
    ]);

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: c,
      closed: true
    }];
  }

  _generator () {
    // Direct sampling by transforming beta variate
    return super._generator() * (this.p.c - this.p.a) + this.p.a
  }

  _pdf (x) {
    return super._pdf((x - this.p.a) / (this.p.c - this.p.a)) / (this.p.c - this.p.a)
  }

  _cdf (x) {
    return super._cdf((x - this.p.a) / (this.p.c - this.p.a))
  }
}

/**
 * Generator for the [Poisson distribution]{@link https://en.wikipedia.org/wiki/Poisson_distribution}:
 *
 * $$f(k; \lambda) = \frac{\lambda^k e^{-\lambda}}{k!},$$
 *
 * with $\lambda > 0$. Support: $k \in \mathbb{N}_0$.
 *
 * @class Poisson
 * @memberof ran.dist
 * @param {number=} lambda Mean of the distribution. Default value is 1.
 * @constructor
 */
class poisson extends Distribution {
  constructor (lambda = 1) {
    super('discrete', arguments.length);

    // Validate parameters
    this.p = { lambda };
    Distribution.validate({ lambda }, [
      'lambda > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    return poisson$1(this.r, this.p.lambda)
  }

  _pdf (x) {
    return Math.exp(x * Math.log(this.p.lambda) - this.p.lambda - logGamma$1(x + 1))
  }

  _cdf (x) {
    return 1 - gammaLowerIncomplete(x + 1, this.p.lambda)
  }
}

/**
 * Generator for the [Pólya-Aeppli distribution]{@link https://arxiv.org/abs/1406.2780} (also known as geometric Poisson distribution):
 *
 * $$f(k; \lambda, \theta) = \begin{cases}e^{-\lambda} &\quad\text{if $k = 0$},\\\\ e^{-\lambda} \sum_{j = 1}^k \frac{\lambda^j}{j!} \begin{pmatrix}k - 1 \\\\ j - 1 \\\\ \end{pmatrix} \theta^{k - j} (1 - \theta)^j &\quad\text{otherwise}\\\\ \end{cases},$$
 *
 * where $\lambda > 0$ and $\theta \in (0, 1)$. Support: $k \in \mathbb{N}_0$.
 *
 * @class PolyaAeppli
 * @memberof ran.dist
 * @param {number=} lambda Mean of the Poisson component. Default value is 1.
 * @param {number=} theta Parameter of the shifted geometric component. Default value is 0.5.
 * @constructor
 */
class polyaAeppli extends PreComputed {
  constructor (lambda = 1, theta = 0.5) {
    // Using logarithmic probability mass values
    super(true);

    // Validate parameters
    this.p = { lambda, theta };
    Distribution.validate({ lambda, theta }, [
      'lambda > 0',
      'theta > 0', 'theta < 1'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      Math.log(lambda * (1 - theta)) - lambda
    ];
  }

  _pk (k) {
    if (k === 0) {
      return -this.p.lambda
    }

    if (k === 1) {
      return this.c[0]
    }

    return this.pdfTable[k - 1] + Math.log((this.p.lambda * (1 - this.p.theta) + 2 * (k - 1) * this.p.theta - this.p.theta * this.p.theta * (k - 2) * Math.exp(this.pdfTable[k - 2] - this.pdfTable[k - 1])) / k)
  }

  _generator () {
    const N = poisson$1(this.r, this.p.lambda);
    let z = 0;
    for (let i = 0; i < N; i++) {
      z += Math.floor(Math.log(this.r.next()) / Math.log(this.p.theta)) + 1;
    }
    return Math.round(z)
  }
}

/**
 * Generator for the [power-law distribution]{@link https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.powerlaw.html} (also called power-law distribution):
 *
 * $$f(x; a) = a x^{a - 1},$$
 *
 * with $a > 0$. Support: $x \in (0, 1)$. It is a special case of the [Kumaraswamy distribution]{@link #dist.Kumaraswamy}.
 *
 * @class PowerLaw
 * @memberof ran.dist
 * @param {number=} a One plus the exponent of the distribution. Default value is 1.
 * @constructor
 */
class powerLaw extends Kumaraswamy {
  // Special case of Kumaraswamy.
  constructor (a = 1) {
    super(a, 1);
  }
}

/**
 * Generator for the [q-exponential distribution]{@link https://en.wikipedia.org/wiki/Q-exponential_distribution}:
 *
 * $$f(x; q, \lambda) = (2 - q) \lambda e^{-\lambda x}_q,$$
 *
 * where $q < 2$, $\lambda > 0$ and $e^x_q$ denotes the [q-exponential function]{@link https://en.wikipedia.org/wiki/Tsallis_statistics#q-exponential}. Support: $x > 0$ if $q \ge 1$, otherwise $x \in \big[0, \frac{1}{\lambda (1 - q)}\big)$.
 *
 * @class QExponential
 * @memberof ran.dist
 * @param {number=} q Shape parameter. Default value is 1.5.
 * @param {number=} lambda Rate parameter. Default value is 1.
 * @constructor
 */
class qExponential extends GeneralizedPareto {
  constructor (q = 1.5, lambda = 1) {
    super(0, 1 / (lambda * (2 - q)), (q - 1) / (2 - q));

    // Validate parameters
    Distribution.validate({ q, lambda }, [
      'q < 2',
      'lambda > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: q < 1 ? 1 / (lambda * (1 - q)) : Infinity,
      closed: false
    }];
  }
}

/**
 * Generator for the [R distribution]{@link https://docs.scipy.org/doc/scipy-1.5.4/reference/tutorial/stats/continuous_rdist.html}:
 *
 * $$f(x; c) = \frac{(1 - x^2)^{\frac{c}{2} - 1}}{\mathrm{B}\big(\frac{1}{2}, \frac{c}{2}\big)},$$
 *
 * where $c > 0$. Support: $x \in \[-1, 1\]$.
 *
 * @class R
 * @memberof ran.dist
 * @param {number=} c Shape parameter. Default value is 1.
 * @constructor
 */
class r extends Beta {
  constructor (c = 1) {
    super(0.5, c / 2);

    // Validate parameters
    this.p = Object.assign(this.p, { c });
    Distribution.validate({ c }, [
      'c > 0'
    ]);

    // Set support
    this.s = [{
      value: -1,
      closed: true
    }, {
      value: 1,
      closed: true
    }];
  }

  _generator () {
    return 2 * Math.sqrt(super._generator()) - 1
  }

  _pdf (x) {
    const y = (x + 1) / 2;
    return y * super._pdf(y * y)
  }

  _cdf (x) {
    const y = (x + 1) / 2;
    return super._cdf(y * y)
  }
}

/**
 * Generator for the [Rademacher distribution]{@link https://en.wikipedia.org/wiki/Rademacher_distribution}:
 *
 * $$f(k) = \begin{cases}1/2 &\quad\text{if $k = -1$},\\\\ 1/2 &\quad\text{if $k = 1$},\\\\ 0 &\quad\text{otherwise}.\\\\ \end{cases}$$
 *
 * Support: $k \in \{-1, 1\}$.
 *
 * @class Rademacher
 * @memberof ran.dist
 * @constructor
 */
class rademacher extends Categorical {
  // Special case of categorical
  constructor () {
    super([0.5, 0, 0.5], -1);
  }

  _q (p) {
    return p > 0.5 ? 1 : -1
  }
}

/**
 * Generator for the [raised cosine distribution]{@link https://en.wikipedia.org/wiki/Raised_cosine_distribution}:
 *
 * $$f(x; \mu, s) = \frac{1}{2s} \Big\[1 + \cos\Big(\frac{x - \mu}{s} \pi\Big)\Big\],$$
 *
 * where $\mu \in \mathbb{R}$ and $s > 0$. Support: $x \in \[\mu - s, \mu + s\]$.
 *
 * @class RaisedCosine
 * @memberof ran.dist
 * @param {number=} mu Location paramter. Default value is 0.
 * @param {number=} s Scale parameter. Default value is 1.
 * @constructor
 */
class raisedCosine extends Distribution {
  constructor (mu = 0, s = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { mu, s };
    Distribution.validate({ mu, s }, [
      's > 0'
    ]);

    // Set support
    this.s = [{
      value: mu - s,
      closed: true
    }, {
      value: mu + s,
      closed: true
    }];
  }

  _generator () {
    // Rejection sampling with uniform distribution as major
    return rejection(
      this.r,
      () => this.p.mu - this.p.s + 2 * this.p.s * this.r.next(),
      x => {
        return 0.5 * (1 + Math.cos(Math.PI * (x - this.p.mu) / this.p.s))
      }
    )
  }

  _pdf (x) {
    return 0.5 * (1 + Math.cos(Math.PI * (x - this.p.mu) / this.p.s)) / this.p.s
  }

  _cdf (x) {
    const z = (x - this.p.mu) / this.p.s;
    return 0.5 * (1 + z + Math.sin(Math.PI * z) / Math.PI)
  }
}

/**
 * Generator for the [Rayleigh distribution]{@link https://en.wikipedia.org/wiki/Rayleigh_distribution}:
 *
 * $$f(x; \sigma) = \frac{x}{\sigma^2} e^{-\frac{x^2}{2\sigma^2}},$$
 *
 * with $\sigma > 0$. Support: $x \ge 0$.
 *
 * @class Rayleigh
 * @memberof ran.dist
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @constructor
 */
class rayleigh extends Weibull {
  // Special case of Weibull
  constructor (sigma = 1) {
    super(sigma * Math.SQRT2, 2);
  }
}

/**
 * Generator for the [reciprocal distribution]{@link https://en.wikipedia.org/wiki/Reciprocal_distribution}:
 *
 * $$f(x; a, b) = \frac{1}{x \[\ln b - \ln a\]},$$
 *
 * with $a, b > 0$ and $a < b$. Support: $x \in \[a, b\]$.
 *
 * @class Reciprocal
 * @memberof ran.dist
 * @param {number=} a Lower boundary of the support. Default value is 1.
 * @param {number=} b Upper boundary of the support. Default value is 2.
 * @constructor
 */
class reciprocal extends Distribution {
  constructor (a = 1, b = 2) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { a, b };
    Distribution.validate({ a, b }, [
      'a > 0',
      'b > 0',
      'a < b'
    ]);

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }];

    // Speed-up constants
    this.c = [
      Math.log(a),
      Math.log(b)
    ];
  }

  _generator () {
    // Direct sampling
    return this.p.a * Math.exp((this.c[1] - this.c[0]) * this.r.next())
  }

  _pdf (x) {
    return 1 / (x * (this.c[1] - this.c[0]))
  }

  _cdf (x) {
    return (Math.log(x) - this.c[0]) / (this.c[1] - this.c[0])
  }
}

/**
 * Generator for the [reciprocal inverse Gaussian distribution (RIG)]{@link https://docs.scipy.org/doc/scipy-1.7.0/reference/tutorial/stats/continuous_recipinvgauss.html}:
 *
 * $$f(x; \lambda, \mu) = \bigg\[\frac{\lambda}{2 \pi x}\bigg\]^{1/2} e^{\frac{-\lambda (1 - \mu x)^2}{2 \mu^2 x}},$$
 *
 * with $\mu, \lambda > 0$. Support: $x > 0$.
 *
 * @class ReciprocalInverseGaussian
 * @memberof ran.dist
 * @param {number=} mu Mean of the inverse Gaussian distribution. Default value is 1.
 * @param {number=} lambda Shape parameter. Default value is 1.
 * @constructor
 */
class reciprocalInverseGaussian extends InverseGaussian {
  constructor (mu = 1, lambda = 1) {
    super(mu, lambda);

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    return 1 / super._generator()
  }

  _pdf (x) {
    return super._pdf(1 / x) / (x * x)
  }

  _cdf (x) {
    return 1 - super._cdf(1 / x)
  }
}

/**
 * Generator for the [Rice distribution]{@link https://en.wikipedia.org/wiki/Rice_distribution}:
 *
 * $$f(x; \nu, \sigma) = \frac{x}{\sigma^2} e^{-\frac{x^2 + \nu^2}{2 \sigma^2}} I_0\bigg(\frac{\nu x}{\sigma^2}\bigg),$$
 *
 * with $\nu, \sigma > 0$ and $I_0(x)$ is the modified Bessel function of the first kind with order zero. Support: $x \in [0, \infty)$.
 *
 * @class Rice
 * @memberof ran.dist
 * @param {number=} nu First shape parameter. Default value is 1.
 * @param {number=} sigma Second shape parameter. Default value is 1.
 * @constructor
 */
class rice extends Distribution {
  constructor (nu = 1, sigma = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { nu, sigma };
    Distribution.validate({ nu, sigma }, [
      'nu > 0',
      'sigma > 0'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];

    // Speet-up constants
    this.c = [
      0.5 * Math.pow(nu / sigma, 2),
      sigma * sigma,
      nu / (sigma * sigma),
      nu * nu
    ];
  }

  _generator () {
    // Direct sampling using Poisson and gamma
    const p = poisson$1(this.r, this.c[0]);
    const x = gamma(this.r, p + 1, 0.5);
    return this.p.sigma * Math.sqrt(x)
  }

  _pdf (x) {
    const z = x * this.p.nu / this.c[1];
    const b = besselI(0, z);

    // Handle z >> 1 case (using asymptotic form of Bessel)
    if (Number.isFinite(b)) {
      return x * Math.exp(-0.5 * (x * x + this.c[3]) / this.c[1]) * besselI(0, x * this.c[2]) / this.c[1]
    } else {
      return x * Math.exp(-0.5 * (x * x + this.c[3]) / this.c[1] + z - 0.5 * Math.log(2 * Math.PI * z)) / this.c[1]
    }
  }

  _cdf (x) {
    return 1 - marcumQ(1, this.c[0], Math.pow(x / this.p.sigma, 2) / 2)
  }
}

/**
 * Generator for the [shifted log-logistic distribution]{@link https://en.wikipedia.org/wiki/Shifted_log-logistic_distribution}:
 *
 * $$f(x; \mu, \sigma, \xi) = \frac{(1 + \xi z)^{-(1/\xi + 1)}}{\sigma \[1 + (1 + \xi z)^{-1/\xi}\]^2},$$
 *
 * with $z = \frac{x - \mu}{\sigma}$, $\mu, \xi \in \mathbb{R}$ and $\sigma > 0$. Support: $x \ge \mu - \sigma/\xi$ if $\xi > 0$, $x \le \mu - \sigma/\xi$ if $\xi < 0$, $x \in \mathbb{R}$ otherwise.
 *
 * @class ShiftedLogLogistic
 * @memberof ran.dist
 * @param {number=} mu Location parameter. Default value is 0.
 * @param {number=} sigma Scale parameter. Default value is 1.
 * @param {number=} xi Shape parameter. Default value is 1.
 * @constructor
 */
class shiftedLogLogistic extends Distribution {
  constructor (mu = 0, sigma = 1, xi = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { mu, sigma, xi };
    Distribution.validate({ mu, sigma, xi }, [
      'sigma > 0'
    ]);

    // Set support
    this.s = xi === 0
      ? [{ value: -Infinity, closed: false }, { value: Infinity, closed: false }]
      : [{ value: xi > 0 ? mu - sigma / xi : -Infinity, closed: xi > 0 },
          { value: xi < 0 ? mu - sigma / xi : Infinity, closed: xi < 0 }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    if (this.p.xi === 0) {
      // Fall back to logistic
      const z = Math.exp(-(x - this.p.mu) / this.p.sigma);
      return Number.isFinite(z * z)
        ? z / (this.p.sigma * Math.pow(1 + z, 2))
        : 0
    } else {
      const z = (x - this.p.mu) / this.p.sigma;

      return Math.pow(1 + this.p.xi * z, -(1 / this.p.xi + 1)) / (this.p.sigma * Math.pow(1 + Math.pow(1 + this.p.xi * z, -1 / this.p.xi), 2))
    }
  }

  _cdf (x) {
    if (this.p.xi === 0) {
      // Fall back to logistic
      return 1 / (1 + Math.exp(-(x - this.p.mu) / this.p.sigma))
    } else {
      const z = (x - this.p.mu) / this.p.sigma;
      const y = Math.pow(1 + this.p.xi * z, -1 / this.p.xi);
      return Number.isFinite(y) ? 1 / (1 + y) : 0
    }
  }

  _q (p) {
    if (this.p.xi === 0) {
      // Fall back to logistic
      return this.p.mu - this.p.sigma * Math.log(1 / p - 1)
    } else {
      return this.p.mu + this.p.sigma * (Math.pow(1 / p - 1, -this.p.xi) - 1) / this.p.xi
    }
  }
}

/**
 * Generator for the [Skellam distribution]{@link https://en.wikipedia.org/wiki/Skellam_distribution}:
 *
 * $$f(k; \mu_1, \mu_2) = e^{-(\mu_1 + \mu_2)}\Big(\frac{\mu_1}{\mu_2}\Big)^{k/2} I_k(2 \sqrt{\mu_1 \mu_2}),$$
 *
 * with $\mu_1, \mu_2 \ge 0$ and $I_n(x)$ is the modified Bessel function of the first kind with order $n$. Support: $k \in \mathbb{N}$.
 *
 * @class Skellam
 * @memberof ran.dist
 * @param {number=} mu1 Mean of the first Poisson distribution. Default value is 1.
 * @param {number=} mu2 Mean of the second Poisson distribution. Default value is 1.
 * @constructor
 */
class skellam extends Distribution {
  constructor (mu1 = 1, mu2 = 1) {
    super('discrete', arguments.length);

    // Validate parameters
    this.p = { mu1, mu2 };
    Distribution.validate({ mu1, mu2 }, [
      'mu1 > 0',
      'mu2 > 0'
    ]);

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      Math.exp(-mu1 - mu2),
      Math.sqrt(mu1 / mu2),
      2 * Math.sqrt(mu1 * mu2),
      marcumQ(1, mu2, mu1)
    ];
  }

  _generator () {
    // Direct sampling
    return poisson$1(this.r, this.p.mu1) - poisson$1(this.r, this.p.mu2)
  }

  _pdf (x) {
    return this.c[0] * Math.pow(this.c[1], x) * besselI(Math.abs(x), this.c[2])
  }

  _cdf (x) {
    if (x <= -1) {
      return 1 - marcumQ(-x, this.p.mu1, this.p.mu2)
    }
    if (x >= 1) {
      return marcumQ(x + 1, this.p.mu2, this.p.mu1)
    }
    return this.c[3]
  }

  _q (p) {
    return Math.floor(this._qEstimateRoot(p))
  }
}

/**
 * Generator for the [skew normal distribution]{@link https://en.wikipedia.org/wiki/Skew_normal_distribution}:
 *
 * $$f(x; \xi, \omega, \alpha) = \frac{2}{\omega} \phi\bigg(\frac{x - \xi}{\omega}\bigg) \Phi\bigg(\alpha \frac{x - \xi}{\omega}\bigg),$$
 *
 * where $\xi, \alpha \in \mathbb{R}$, $\omega > 0$ and $\phi(x)$, $\Phi(x)$ denote the probability density and
 * cumulative distribution functions of the standard [normal distribution]{@link #dist.Normal}.
 * Support: $x \in \mathbb{R}$.
 *
 * @class SkewNormal
 * @memberof ran.dist
 * @param {number=} xi Location parameter. Default value is 0.
 * @param {number=} omega Scale parameter. Default value is 1.
 * @param {number=} alpha Shape parameter. Default value is 1.
 * @constructor
 */
class skewNormal extends Normal {
  constructor (xi = 0, omega = 1, alpha = 1) {
    super(xi, omega);

    // Add new parameter
    this.p = Object.assign(this.p, { xi, omega, alpha });

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants (be aware of the constants for the parent)
    const delta = this.p.alpha / Math.sqrt(1 + this.p.alpha * this.p.alpha);
    this.c1 = [
      delta,
      Math.sqrt(1 - delta * delta)
    ];
  }

  _generator () {
    // Method from http://azzalini.stat.unipd.it/SN/faq-r.html
    const u0 = normal(this.r);
    const v = normal(this.r);
    const u1 = this.c1[0] * u0 + this.c1[1] * v;
    const z = u0 >= 0 ? u1 : -u1;
    return this.p.xi + this.p.omega * z
  }

  _pdf (x) {
    return super._pdf(x) * (1 + erf(this.p.alpha * Math.SQRT1_2 * (x - this.p.xi) / this.p.omega))
  }

  _cdf (x) {
    const z = super._cdf(x) - 2 * owenT((x - this.p.xi) / this.p.omega, this.p.alpha);
    return clamp(z)
  }

  _q (p) {
    return this._qEstimateRoot(p)
  }
}

/**
 * Generator for the [slash distribution]{@link https://en.wikipedia.org/wiki/Slash_distribution}:
 *
 * $$f(x) = \begin{cases}\frac{\phi(0) - \phi(x)}{x^2} &\quad\text{if $x \ne 0$},\\\\ \frac{1}{2 \sqrt{2 \pi}} &\quad\text{if $x = 0$}\\\\ \end{cases},$$
 *
 * where $\phi(x)$ is the probability density function of the standard [normal distribution]{@link #dist.Normal}.
 * Support: $x \in \mathbb{R}$.
 *
 * @class Slash
 * @memberof ran.dist
 * @constructor
 */
class slash extends Normal {
  constructor () {
    super(0, 1);
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
    this.c1 = [
      0.5 / Math.sqrt(2 * Math.PI)
    ];
  }

  _generator () {
    // Direct sampling by the ratio of normal and uniform variates
    return super._generator() / this.r.next()
  }

  _pdf (x) {
    return x === 0
      ? this.c1[0]
      : (super._pdf(0) - super._pdf(x)) / (x * x)
  }

  _cdf (x) {
    return x === 0
      ? 0.5
      : super._cdf(x) - (super._pdf(0) - super._pdf(x)) / x
  }

  _q (p) {
    return this._qEstimateRoot(p)
  }
}

/**
 * Generator for the (ideal) [soliton distribution]{@link https://en.wikipedia.org/wiki/Soliton_distribution}:
 *
 * $$f(k; N) = \begin{cases}\frac{1}{N} &\quad\text{if $k = 1$},\\\\ \frac{1}{k (1 - k)} &\quad\text{otherwise}\\\\ \end{cases},$$
 *
 * with $N \in \mathbb{N}^+$. Support: $k \in \{1, 2, ..., N\}$.
 *
 * @class Soliton
 * @memberof ran.dist
 * @param {number=} N Number of blocks in the messaging model. If not an integer, it is rounded to the nearest one. Default value is 1.
 * @constructor
 */
class soliton extends Categorical {
  // Special case of categorical.
  constructor (N = 10) {
    // Define weights
    const Ni = Math.round(N);
    super([1 / Ni].concat(Array.from({ length: Ni - 2 }, (d, i) => 1 / ((i + 1) * (i + 2)))), 1);

    // Update number of parameters.
    this.k = 1;

    // Validate parameters
    Distribution.validate({ N: Ni }, [
      'N > 0'
    ]);
  }
}

/**
 * Generates a random sign.
 *
 * @method sign
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number=} p Probability of +1. Default value is 0.5.
 * @return {number} Random sign (-1 or +1).
 * @ignore
 */
function sign (r, p = 0.5) {
  return r.next() < p ? 1 : -1
}

/**
 * Generator for [Student's t-distribution]{@link https://en.wikipedia.org/wiki/Student%27s_t-distribution}:
 *
 * $$f(x; \nu) = \frac{1}{\sqrt{\nu}\mathrm{B}\big(\frac{1}{2}, \frac{\nu}{2}\big)} \Big(1 + \frac{x^2}{\nu}\Big)^{-\frac{\nu + 1}{2}},$$
 *
 * with $\nu > 0$ and $\mathrm{B}(x, y)$ is the beta function. Support: $x \in \mathbb{R}$.
 *
 * @class StudentT
 * @memberof ran.dist
 * @param {number=} nu Degrees of freedom. Default value is 1.
 * @constructor
 */
class StudentT extends Distribution {
  constructor (nu = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { nu };
    Distribution.validate({ nu }, [
      'nu > 0'
    ]);

    // Set support
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    // Direct sampling using gamma variates
    return sign(this.r) * Math.sqrt(this.p.nu * gamma(this.r, 0.5) / gamma(this.r, this.p.nu / 2))
  }

  _pdf (x) {
    return Math.pow(1 + x * x / this.p.nu, -0.5 * (this.p.nu + 1)) / (Math.sqrt(this.p.nu) * beta(0.5, this.p.nu / 2))
  }

  _cdf (x) {
    return x > 0
      ? 1 - 0.5 * regularizedBetaIncomplete(this.p.nu / 2, 0.5, this.p.nu / (x * x + this.p.nu))
      : 0.5 * regularizedBetaIncomplete(this.p.nu / 2, 0.5, this.p.nu / (x * x + this.p.nu))
  }
}

/**
 * Generator for [Student's Z distribution]{@link http://mathworld.wolfram.com/Studentsz-Distribution.html}:
 *
 * $$f(x; n) = \frac{\Gamma\Big(\frac{n}{2}\Big)}{\sqrt{\pi} \Gamma\Big(\frac{n - 1}{2}\Big)} (1 + x^2)^{-\frac{n}{2}},$$
 *
 * with $n > 1$. Support: $x \in \mathbb{R}$.
 *
 * @class StudentZ
 * @memberof ran.dist
 * @param {number=} n Degrees of freedom. Default value is 2.
 * @constructor
 */
class studentZ extends StudentT {
  constructor (n = 2) {
    // Validate parameter
    Distribution.validate({ n }, [
      'n > 1'
    ]);

    super(n - 1);
  }

  _generator () {
    return super._generator() / Math.sqrt(this.p.nu)
  }

  _pdf (x) {
    return super._pdf(x * Math.sqrt(this.p.nu)) * Math.sqrt(this.p.nu)
  }

  _cdf (x) {
    return super._cdf(x * Math.sqrt(this.p.nu))
  }
}

/**
 * Generator for the [trapezoidal distribution]{@link https://en.wikipedia.org/wiki/Trapezoidal_distribution}:
 *
 * $$f(x; a, b, c, d) = \begin{cases}0 &\quad\text{for $x < a$},\\\\ \frac{2 (x - a)}{(b - a) (d + c - a - b)} &\quad\text{for $a \le x < b$}\\\\ \frac{2}{d + c - a - b} &\quad\text{for $b \le x < c$}\\\\ \frac{2 (d - x)}{(d - c) (d + c - a - b)} &\quad\text{for $c \le x \le d$}\\\\ 0 &\quad\text{for $d < x$} \\\\ \end{cases},$$
 *
 * where $a, b, c, d \in \mathbb{R}$, $a < d$, $a \le b < c$ and $c \le d$. Support: $x \in \[a, d\]$.
 *
 * @class Trapezoidal
 * @memberof ran.dist
 * @param {number=} a Lower bound of the support. Default value is 0.
 * @param {number=} b Start of the level part. Default value is 0.33.
 * @param {number=} c End of the level part. Default value is 0.67.
 * @param {number=} d Upper bound of the support. Default value is 1.
 * @constructor
 */
class trapezoidal extends Distribution {
  constructor (a = 0, b = 0.33, c = 0.67, d = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { a, b, c, d };
    Distribution.validate({ a, b, c, d }, [
      'a < d',
      'a <= b', 'b < c',
      'c <= d'
    ]);

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: d,
      closed: true
    }];

    // Speed-up constants
    this.c = [
      d + c - a - b,
      b - a,
      d - c,
      a + b
    ];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    if (x < this.p.b) {
      return 2 * (x - this.p.a) / (this.c[1] * this.c[0])
    } else if (x < this.p.c) {
      return 2 / this.c[0]
    } else {
      return 2 * (this.p.d - x) / (this.c[2] * this.c[0])
    }
  }

  _cdf (x) {
    if (x < this.p.b) {
      return Math.pow(x - this.p.a, 2) / (this.c[1] * this.c[0])
    } else if (x < this.p.c) {
      return (2 * x - this.c[3]) / this.c[0]
    } else {
      return 1 - Math.pow(this.p.d - x, 2) / (this.c[2] * this.c[0])
    }
  }

  _q (p) {
    if (p < this.c[1] / this.c[0]) {
      return this.p.a + Math.sqrt(this.c[0] * this.c[1] * p)
    } else if (p < (2 * this.p.c - this.c[3]) / this.c[0]) {
      return (this.c[0] * p + this.c[3]) / 2
    } else {
      return this.p.d - Math.sqrt(this.c[0] * this.c[2] * (1 - p))
    }
  }
}

/**
 * Generator for the asymmetric [triangular distribution]{@link https://en.wikipedia.org/wiki/Triangular_distribution}:
 *
 * $$f(x; a, b, c) = \begin{cases}0 &\quad\text{for $x < a$},\\\\ \frac{2 (x - a)}{(b - a) (c - a)} &\quad\text{for $a \le x < c$} \\\\ \frac{2 (b - x)}{(b - a) (b - c)} &\quad\text{for $c \le x \le b$} \\\\ 0 &\quad\text{for $b < x$} \\\\ \end{cases},$$
 *
 * with $a, b, c \in \mathbb{R}$, $a < b$ and $a \le c \le b$. Support: $x \in \[a, b\]$.
 *
 * @class Triangular
 * @memberof ran.dist
 * @param {number=} a Lower bound of the support. Default value is 0.
 * @param {number=} b Upper bound of the support. Default value is 1.
 * @param {number=} c Mode of the distribution. Default value is 0.5.
 * @constructor
 */
class triangular extends Distribution {
  constructor (a = 0, b = 1, c = 0.5) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { a, b, c };
    Distribution.validate({ a, b, c }, [
      'a < b',
      'a <= c', 'c <= b'
    ]);

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }];

    // Speed-up constants
    const ba = b - a;
    const bc = b - c;
    const ca = c - a;
    this.c = [
      ba,
      bc,
      ca,
      ba * bc,
      ba * ca
    ];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return x < this.p.c
      ? 2 * (x - this.p.a) / this.c[4]
      : 2 * (this.p.b - x) / this.c[3]
  }

  _cdf (x) {
    return x < this.p.c
      ? Math.pow(x - this.p.a, 2) / this.c[4]
      : 1 - Math.pow(this.p.b - x, 2) / this.c[3]
  }

  _q (p) {
    return p < this.c[2] / this.c[0]
      ? this.p.a + Math.sqrt(p * this.c[4])
      : this.p.b - Math.sqrt((1 - p) * this.c[3])
  }
}

/**
 * Generator for the [truncated normal distribution]{@link https://en.wikipedia.org/wiki/Truncated_normal_distribution}:
 *
 * $$f(x; \mu, \sigma, a, b) = \frac{\phi(\xi)}{\Phi(\beta) - \Phi(\alpha)},$$
 *
 * where $\xi = \frac{x - \mu}{\sigma}, \alpha = \frac{a - \mu}{\sigma}$ and $\beta = \frac{b - \mu}{\sigma}$.
 * The functions $\phi$ and $\Phi$ denote the probability density and cumulative distribution functions of the normal
 * distribution. Finally, $\mu \in \mathbb{R}$, $\sigma > 0$ and $b > a$. Support: $x \in [a, b]$.
 *
 * @class TruncatedNormal
 * @memberof ran.dist
 * @param {number=} mu Mean of the underlying normal distribution. Default value is 0.
 * @param {number=} sigma Variance of the underlying normal distribution. Default value is 1.
 * @param {number=} a Lower boundary of the support. Default value is 0.
 * @param {number=} b Upper boundary of the support. Default value is 1.
 * @constructor
 */
class truncatedNormal extends Normal {
  constructor (mu = 0, sigma = 1, a = 0, b = 1) {
    // Call super and update number of parameters.
    super(mu, sigma);
    this.k = arguments.length;

    // Validate parameters.
    this.p = { mu, sigma, a, b };
    Distribution.validate({ mu, sigma, a, b }, [
      'sigma > 0',
      'b > a'
    ]);

    // Set support.
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }];

    // Speed-up constants.
    this.c2 = [
      super._cdf(a),
      super._cdf(b) - super._cdf(a),
      super._cdf((a + b) / 2)
    ];
  }

  _generator () {
    return this._q(this.r.next())
  }

  _pdf (x) {
    return super._pdf(x) / this.c2[1]
  }

  _cdf (x) {
    return (super._cdf(x) - this.c2[0]) / this.c2[1]
  }

  _q (p) {
    return super._q(this.c2[0] + p * this.c2[1])
  }
}

/**
 * Generator for the [Tukey lambda distribution]{@link https://en.wikipedia.org/wiki/Tukey_lambda_distribution}:
 *
 * $$f(x; \lambda) = \frac{1}{Q^{-1}(F(x))},$$
 *
 * where $Q(p) = \frac{p^\lambda - (1 - p)^\lambda}{\lambda}$ and $F(x) = Q^{-1}(x)$. Support: $x \in \[-1/\lambda, 1/\lambda\]$ if $\lambda > 0$, otherwise $x \in \mathbb{R}$.
 *
 * @class TukeyLambda
 * @memberof ran.dist
 * @param {number=} lambda Shape parameter. Default value is 1.5.
 * @constructor
 */
class tukeyLambda extends Distribution {
  constructor (lambda = 1.5) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { lambda };

    // Set support
    this.s = [{
      value: lambda > 0 ? -1 / lambda : -Infinity,
      closed: lambda > 0
    }, {
      value: lambda > 0 ? 1 / lambda : Infinity,
      closed: lambda > 0
    }];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    if (this.p.lambda === 0) {
      const y = Math.exp(-x);
      return y / Math.pow(1 + y, 2)
    } else {
      if (x === 0) {
        return Math.pow(2, this.p.lambda) / 4
      } else {
        // f(x) = Q^(-1)[F(x)]
        const z = this._cdf(x);
        return 1 / (Math.pow(z, this.p.lambda - 1) + Math.pow(1 - z, this.p.lambda - 1))
      }
    }
  }

  _cdf (x) {
    // If lambda != 0, F(x) is the inverse of quantile function
    return this.p.lambda === 0
      ? 1 / (1 + Math.exp(-x))
      : brent(
        t => (Math.pow(t, this.p.lambda) - Math.pow(1 - t, this.p.lambda)) / this.p.lambda - x,
        0, 1
      )
  }

  _q (p) {
    return this.p.lambda === 0
      ? Math.log(p / (1 - p))
      : (Math.pow(p, this.p.lambda) - Math.pow(1 - p, this.p.lambda)) / this.p.lambda
  }
}

/**
 * Generator for the continuous
 * [uniform distribution]{@link https://en.wikipedia.org/wiki/Uniform_distribution_(continuous)}:
 *
 * $$f(x; x_\mathrm{min}, x_\mathrm{max}) = \frac{1}{x_\mathrm{max} - x_\mathrm{min}},$$
 *
 * with $x_\mathrm{min}, x_\mathrm{max} \in \mathbb{R}$ and $x_\mathrm{min} < x_\mathrm{max}$.
 * Support: $x \in \[x_\mathrm{min}, x_\mathrm{max}\]$.
 *
 * @class Uniform
 * @memberof ran.dist
 * @param {number=} xmin Lower boundary. Default value is 0.
 * @param {number=} xmax Upper boundary. Default value is 1.
 * @constructor
 */
class uniform extends Distribution {
  constructor (xmin = 0, xmax = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { xmin, xmax };
    Distribution.validate({ xmin, xmax }, [
      'xmin < xmax'
    ]);

    // Set support
    this.s = [{
      value: xmin,
      closed: true
    }, {
      value: xmax,
      closed: true
    }];

    // Speed-up constants
    this.c = [
      xmax - xmin
    ];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf () {
    return 1 / this.c[0]
  }

  _cdf (x) {
    return (x - this.p.xmin) / this.c[0]
  }

  _q (p) {
    return p * this.c[0] + this.p.xmin
  }
}

// TODO Docs
class uniformProduct extends Distribution {
  constructor (n = 2) {
    super('continuous', arguments.length);

    // Validate parameters
    const ni = Math.round(n);
    this.p = { n: ni };
    Distribution.validate({ n: ni }, [
      'n > 1'
    ]);

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: 1,
      closed: true
    }];
  }

  _generator () {
    return Math.exp(neumaier(Array.from({ length: this.p.n }, () => Math.log(this.r.next()))))
  }

  _pdf (x) {
    return Math.pow(-Math.log(x), this.p.n - 1) / _gamma(this.p.n)
  }

  _cdf (x) {
    return gammaUpperIncomplete(this.p.n, -Math.log(x))
  }
}

// TODO Docs
/**
 * Generator for the [uniform ratio distribution]{@link https://en.wikipedia.org/wiki/Ratio_distribution#Uniform_ratio_distribution}:
 *
 * $$f(x) = \begin{cases}\frac{1}{2} &\quad\text{if $x < 1$},\\\\ \frac{1}{2x^2} &\quad\text{if $x \ge 1$},\\\\ \end{cases}.$$
 *
 * Support: $x > 0$.
 *
 * @class UniformRatio
 * @memberof ran.dist
 * @constructor
 */
class uniformRatio extends Distribution {
  constructor () {
    super('continuous', arguments.length);

    // Set support
    this.s = [{
      value: 0,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];
  }

  _generator () {
    return this.r.next() / this.r.next()
  }

  _pdf (x) {
    return x <= 1 ? 0.5 : 0.5 / (x * x)
  }

  _cdf (x) {
    return x <= 1 ? 0.5 * x : 1 - 0.5 / x
  }

  _q (p) {
    return p <= 0.5 ? 2 * p : 0.5 / (1 - p)
  }
}

/**
 * Generator for the [u-quadratic distribution]{@link https://en.wikipedia.org/wiki/U-quadratic_distribution}:
 *
 * $$f(x; a, b) = \alpha (x - \beta)^2,$$
 *
 * where $\alpha = \frac{12}{(b - a)^3}$, $\beta = \frac{a + b}{2}$, $a, b \in \mathbb{R}$ and $a < b$.
 * Support: $x \in \[a, b\]$.
 *
 * @class UQuadratic
 * @memberof ran.dist
 * @param {number=} a Lower bound of the support. Default value is 0.
 * @param {number=} b Upper bound of the support. Default value is 1.
 * @constructor
 */
class uQuadratic extends Distribution {
  constructor (a = 0, b = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { a, b };
    Distribution.validate({ a, b }, [
      'a < b'
    ]);

    // Set support
    this.s = [{
      value: a,
      closed: true
    }, {
      value: b,
      closed: true
    }];

    // Speed-up constants
    this.c = [
      12 / Math.pow(b - a, 3),
      (a + b) / 2,
      Math.pow((b - a) / 2, 3)
    ];
  }

  _generator () {
    // Inverse transform sampling
    return this._q(this.r.next())
  }

  _pdf (x) {
    return this.c[0] * Math.pow(x - this.c[1], 2)
  }

  _cdf (x) {
    return this.c[0] * (Math.pow(x - this.c[1], 3) + this.c[2]) / 3
  }

  _q (p) {
    return Math.cbrt(3 * p / this.c[0] - this.c[2]) + this.c[1]
  }
}

/**
 * Generator for the [von Mises distribution]{@link https://en.wikipedia.org/wiki/Von_Mises_distribution}:
 *
 * $$f(x; \kappa) = \frac{e^{\kappa \cos(x)}}{2 \pi I_0(\kappa)},$$
 *
 * with $\kappa > 0$. Support: $x \in \[-\pi, \pi\]$. Note that originally this distribution is periodic and therefore it is defined over $\mathbb{R}$, but (without the loss of general usage) this implementation still does limit the support on the bounded interval $\[-\pi, \pi\]$.
 *
 * @class VonMises
 * @memberof ran.dist
 * @param {number=} kappa Shape parameter. Default value is 1.
 * @constructor
 */
class vonMises extends Distribution {
  constructor (kappa = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { kappa };
    Distribution.validate({ kappa }, [
      'kappa > 0'
    ]);

    // Set support
    this.s = [{
      value: -Math.PI,
      closed: true
    }, {
      value: Math.PI,
      closed: true
    }];
  }

  _generator () {
    // Sampling method from here: http://sa-ijas.stat.unipd.it/sites/sa-ijas.stat.unipd.it/files/417-426.pdf
    // Source: Barabesi. Generating von Mises variates by the ratio-of-uniforms method. Statistica Applicata 7 (4), 1995.
    const s = this.p.kappa > 1.3 ? 1 / Math.sqrt(this.p.kappa) : Math.PI * Math.exp(-this.p.kappa);

    for (let i = 0; i < MAX_ITER; i++) {
      const R1 = this.r.next();
      const R2 = this.r.next();
      const theta = s * (2 * R2 - 1) / R1;
      if (Math.abs(theta) > Math.PI) {
        continue
      }

      if (this.p.kappa * theta * theta < 4 - 4 * R1) {
        return theta
      } else {
        if (this.p.kappa * Math.cos(theta) < 2 * Math.log(R1) + this.p.kappa) {
          continue
        }
        return theta
      }
    }
  }

  _pdf (x) {
    return Math.exp(this.p.kappa * Math.cos(x)) / (2 * Math.PI * besselI(0, this.p.kappa))
  }

  _cdf (x) {
    // F(x) is computed according to the sum in https://docs.scipy.org/doc/scipy/reference/tutorial/stats/continuous_vonmises.html
    return 0.5 * (1 + x / Math.PI) + recursiveSum({
      c: 0
    }, (t, i) => {
      t.c = besselI(i, this.p.kappa) * Math.sin(i * x) / (besselI(0, this.p.kappa) * i);
      return t
    }, t => t.c) / Math.PI
  }
}

/**
 * Generator for [Wigner distribution]{@link https://en.wikipedia.org/wiki/Wigner_semicircle_distribution} (also known
 * as semicircle distribution):
 *
 * $$f(x; R) = \frac{2}{\pi R^2} \sqrt{R^2 - x^2},$$
 *
 * with $R > 0$. Support: $x \in \[-R, R\]$.
 *
 * @class Wigner
 * @memberof ran.dist
 * @param {number=} R Radius of the distribution. Default value is 1.
 * @constructor
 */
class wigner extends Distribution {
  constructor (R = 1) {
    super('continuous', arguments.length);

    // Validate parameters
    this.p = { R };
    Distribution.validate({ R }, [
      'R > 0'
    ]);

    // Set support
    this.s = [{
      value: -R,
      closed: true
    }, {
      value: R,
      closed: true
    }];
  }

  _generator () {
    // Direct sampling by transforming beta variate
    const x = gamma(this.r, 1.5, 1);
    const y = gamma(this.r, 1.5, 1);
    return 2 * this.p.R * x / (x + y) - this.p.R
  }

  _pdf (x) {
    const r = this.p.R * this.p.R;
    return 2 * Math.sqrt(r - x * x) / (Math.PI * r)
  }

  _cdf (x) {
    const r = this.p.R * this.p.R;
    return 0.5 + x * Math.sqrt(r - x * x) / (Math.PI * r) + Math.asin(x / this.p.R) / Math.PI
  }
}

/**
 * Generator for the [Yule-Simon distribution]{@link https://en.wikipedia.org/wiki/Yule%E2%80%93Simon_distribution}:
 *
 * $$f(k; \rho) = \rho \mathrm{B}(k, \rho + 1),$$
 *
 * with $\rho > 0$ and $\mathrm{B}(x, y)$ is the beta function. Support: $k \in \mathbb{N}^+$.
 *
 * @class YuleSimon
 * @memberof ran.dist
 * @param {number=} rho Shape parameter. Default value is 1.
 * @constructor
 */
class yuleSimon extends Distribution {
  constructor (rho = 2) {
    super('discrete', arguments.length);

    // Validate parameters
    this.p = { rho };
    Distribution.validate({ rho }, [
      'rho > 0'
    ]);

    // Set support
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      this.p.rho + 1
    ];
  }

  _generator () {
    // Direct sampling by compounding exponential and geometric
    const e1 = -Math.log(this.r.next());
    const e2 = -Math.log(this.r.next());
    const z = Math.exp(-e2 / this.p.rho);

    // Handle z << 1 case
    return 1 - z === 1
      ? Math.ceil(e1 / z)
      : Math.ceil(-e1 / Math.log(1 - z))
  }

  _pdf (x) {
    return this.p.rho * beta(x, this.c[0])
  }

  _cdf (x) {
    return 1 - x * beta(x, this.c[0])
  }
}

/**
 * Generates a zeta random variate
 *
 * @method zeta
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {number} s Exponent.
 * @returns {number} Random variate.
 * @ignore
 */
function zeta$1 (r, s) {
  // Rejection sampling
  const b = Math.pow(2, s - 1);
  for (let trials = 0; trials < 100; trials++) {
    const x = Math.floor(Math.pow(r.next(), -1 / (s - 1)));
    const t = Math.pow(1 + 1 / x, s - 1);
    if (r.next() * x * (t - 1) / (b - 1) <= t / b) {
      return x
    }
  }
}

/**
 * Generator for the [zeta distribution]{@link https://en.wikipedia.org/wiki/Zeta_distribution}:
 *
 * $$f(k; s) = \frac{k^{-s}}{\zeta(s)},$$
 *
 * with $s \in (1, \infty)$ and $\zeta(x)$ is the Riemann zeta function. Support: $k \in \mathbb{N}^+$.
 *
 * @class Zeta
 * @memberof ran.dist
 * @param {number=} s Exponent of the distribution. Default value is 3.
 * @constructor
 */
class zeta extends Distribution {
  constructor (s = 3) {
    super('discrete', arguments.length);

    // Validate parameters
    this.p = { s };
    Distribution.validate({ s }, [
      's > 1'
    ]);

    // Set support
    this.s = [{
      value: 1,
      closed: true
    }, {
      value: Infinity,
      closed: false
    }];

    // Speed-up constants
    this.c = [
      riemannZeta(s), Math.pow(2, s - 1)
    ];
  }

  _generator () {
    // Rejection sampling
    return zeta$1(this.r, this.p.s)
  }

  _pdf (x) {
    return Math.pow(x, -this.p.s) / this.c[0]
  }

  _cdf (x) {
    return generalizedHarmonic(x, this.p.s) / this.c[0]
  }
}

/**
 * Generator for the [Zipf distribution]{@link https://en.wikipedia.org/wiki/Zipf%27s_law}:
 *
 * $$f(k; s, N) = \frac{k^{-s}}{H_{N, s}},$$
 *
 * with $s \ge 0$, $N \in \mathbb{N}^+$ and $H_{N, s}$ denotes the generalized harmonic number. Support: $k \in \{1, 2, ..., N\}$.
 *
 * @class Zipf
 * @memberof ran.dist
 * @param {number=} s Exponent of the distribution. Default value is 1.
 * @param {number=} N Number of words. If not an integer, it is rounded to the nearest integer. Default is 100.
 * @constructor
 */
class zipf extends Categorical {
  // Special case of categorical
  constructor (s = 1, N = 100) {
    const Ni = Math.round(N);
    super(Array.from({ length: Ni }, (d, i) => Math.pow(i + 1, -s)), 1);

    // Validate parameters
    Distribution.validate({ s, N: Ni }, [
      's >= 0',
      'N > 0'
    ]);
  }
}

/**
 * A collection of random number generators for well-known distributions.
 *
 * @namespace dist
 * @memberof ran
 */

var index$2 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  Alpha: alpha,
  Anglit: anglit,
  Arcsine: arcsine,
  BaldingNichols: baldingNichols,
  Bates: bates,
  Benini: benini,
  BenktanderII: benktanderIi,
  Bernoulli: bernoulli,
  Beta: Beta,
  BetaBinomial: betaBinomial,
  BetaPrime: betaPrime,
  BetaRectangular: betaRectangular,
  Binomial: binomial,
  BirnbaumSaunders: birnbaumSaunders,
  Borel: borel,
  BorelTanner: borelTanner,
  BoundedPareto: boundedPareto,
  Bradford: bradford,
  Burr: burr,
  Categorical: Categorical,
  Cauchy: Cauchy,
  Chi: chi,
  Chi2: Chi2,
  Dagum: Dagum,
  Degenerate: degenerate,
  Delaporte: delaporte,
  DiscreteUniform: discreteUniform,
  DiscreteWeibull: discreteWeibull,
  DoubleGamma: doubleGamma,
  DoubleWeibull: doubleWeibull,
  DoublyNoncentralBeta: DoublyNoncentralBeta,
  DoublyNoncentralF: doublyNoncentralF,
  DoublyNoncentralT: doublyNoncentralT,
  Erlang: erlang,
  Exponential: Exponential,
  ExponentialLogarithmic: exponentialLogarithmic,
  ExponentiatedWeibull: exponentiatedWeibull,
  F: F,
  FisherZ: fisherZ,
  FlorySchulz: florySchulz,
  Frechet: frechet,
  Gamma: Gamma,
  GammaGompertz: gammaGompertz,
  GeneralizedExponential: generalizedExponential,
  GeneralizedExtremeValue: generalizedExtremeValue,
  GeneralizedGamma: GeneralizedGamma,
  GeneralizedHermite: generalizedHermite,
  GeneralizedLogistic: generalizedLogistic,
  GeneralizedNormal: GeneralizedNormal,
  GeneralizedPareto: GeneralizedPareto,
  Geometric: geometric,
  Gilbrat: gilbrat,
  Gompertz: gompertz,
  Gumbel: gumbel,
  HalfGeneralizedNormal: halfGeneralizedNormal,
  HalfLogistic: halfLogistic,
  HalfNormal: halfNormal,
  HeadsMinusTails: headsMinusTails,
  Hoyt: hoyt,
  HyperbolicSecant: hyperbolicSecant,
  Hyperexponential: hyperexponential,
  Hypergeometric: hypergeometric,
  InvalidDiscrete: _invalid,
  InverseChi2: inverseChi2,
  InverseGamma: inverseGamma,
  InverseGaussian: InverseGaussian,
  InvertedWeibull: invertedWeibull,
  IrwinHall: IrwinHall,
  JohnsonSB: johnsonSb,
  JohnsonSU: johnsonSu,
  Kolmogorov: Davis,
  Kumaraswamy: Kumaraswamy,
  Laplace: Laplace,
  Levy: levy,
  Lindley: lindley,
  LogCauchy: logCauchy,
  LogGamma: logGamma,
  LogLaplace: logLaplace,
  LogLogistic: logLogistic,
  LogNormal: LogNormal,
  LogSeries: logSeries,
  Logarithmic: logarithmic,
  Logistic: logistic,
  LogisticExponential: logisticExponential,
  LogitNormal: logitNormal,
  Lomax: lomax,
  Makeham: makeham,
  MaxwellBoltzmann: maxwellBoltzmann,
  Mielke: mielke,
  Moyal: moyal,
  Muth: muth,
  Nakagami: nakagami,
  NegativeBinomial: negativeBinomial,
  NegativeHypergeometric: negativeHypergeometric,
  NeymanA: neymanA,
  NoncentralBeta: NoncentralBeta,
  NoncentralChi: noncentralChi,
  NoncentralChi2: NoncentralChi2,
  NoncentralF: noncentralF,
  NoncentralT: NoncentralT,
  Normal: Normal,
  PERT: pert,
  Pareto: pareto,
  Poisson: poisson,
  PolyaAeppli: polyaAeppli,
  PowerLaw: powerLaw,
  QExponential: qExponential,
  R: r,
  Rademacher: rademacher,
  RaisedCosine: raisedCosine,
  Rayleigh: rayleigh,
  Reciprocal: reciprocal,
  ReciprocalInverseGaussian: reciprocalInverseGaussian,
  Rice: rice,
  ShiftedLogLogistic: shiftedLogLogistic,
  Skellam: skellam,
  SkewNormal: skewNormal,
  Slash: slash,
  Soliton: soliton,
  StudentT: StudentT,
  StudentZ: studentZ,
  Trapezoidal: trapezoidal,
  Triangular: triangular,
  TruncatedNormal: truncatedNormal,
  TukeyLambda: tukeyLambda,
  UQuadratic: uQuadratic,
  Uniform: uniform,
  UniformProduct: uniformProduct,
  UniformRatio: uniformRatio,
  VonMises: vonMises,
  Weibull: Weibull,
  Wigner: wigner,
  YuleSimon: yuleSimon,
  Zeta: zeta,
  Zipf: zipf
});

/**
 * Calculates the [k-th raw moment]{@link https://en.wikipedia.org/wiki/Moment_(mathematics)} for a sample of values.
 *
 * @method moment
 * @memberof ran.shape
 * @param {number[]} values Array of values to calculate moment for.
 * @param {number} k Order of the moment.
 * @param {number} [c = 0] Value to shift the distribution by before calculating the moment.
 * @return {(number|undefined)} The k-th moment of the values if there is any, undefined otherwise.
 * @example
 *
 * ran.shape.moment([], 2)
 * // => undefined
 *
 * ran.shape.moment([1, 2, 3], 0)
 * // => 1
 *
 * ran.shape.moment([1, 2, 3], 2)
 * // => 4.666666666666667
 */
function moment (values, k, c = 0) {
  return values.length > 0 ? mean(values.map(d => Math.pow(d - c, k))) : undefined
}

/**
 * Calculates the [sample excess kurtosis]{@link https://en.wikipedia.org/wiki/Kurtosis#Estimators_of_population_kurtosis}
 * which is unbiased for the normal distribution.
 *
 * @method kurtosis
 * @memberof ran.shape
 * @param {number[]} values Array of values to calculate kurtosis for.
 * @returns {(number|undefined)} The sample kurtosis of values if there are more than two and their variance is nonzero,
 * undefined otherwise.
 * @example
 *
 * ran.shape.kurtosis([])
 * // => undefined
 *
 * ran.shape.kurtosis([1, 2])
 * // => undefined
 *
 * ran.shape.kurtosis([1, 1, 1])
 * // => undefined
 *
 * ran.shape.kurtosis([1, 1, 3, 1, 1])
 * // => 5.000000000000003
 *
 * ran.shape.kurtosis([1, 2, 2, 2, 1])
 * // => -3.3333333333333326
 */
function kurtosis (values) {
  if (values.length < 3) {
    return undefined
  }

  const n = values.length;
  const m = mean(values);
  const m2 = moment(values, 2, m);
  const m4 = moment(values, 4, m);
  return m2 === 0 ? undefined : (n - 1) * ((n + 1) * m4 / (m2 * m2) - 3 * (n - 1)) / ((n - 2) * (n - 3))
}

/**
 * Calculates the [Fisher-Pearson standardized sample skewness]{@link https://en.wikipedia.org/wiki/Skewness#Sample_skewness}
 * for a sample of values.
 *
 * @method skewness
 * @memberof ran.shape
 * @param {number[]} values Array of values to calculate skewness for.
 * @returns {(number|undefined)} The sample skewness of values if there are more than two and their variance is nonzero,
 * undefined otherwise.
 * @example
 *
 * ran.shape.skewness([])
 * // => undefined
 *
 * ran.shape.skewness([1, 2])
 * // => undefined
 *
 * ran.shape.skewness([1, 1, 1])
 * // => undefined
 *
 * ran.shape.skewness([1, 1, 1, 2])
 * // => 2
 *
 * ran.shape.skewness([1, 2, 2, 2])
 * // => -2
 */
function skewness (values) {
  if (values.length < 3) {
    return undefined
  }

  const n = values.length;
  const m = mean(values);
  const m2 = moment(values, 2, m);
  const m3 = moment(values, 3, m);
  return m2 === 0 ? undefined : Math.sqrt(n * (n - 1)) * m3 / ((n - 2) * Math.pow(m2, 1.5))
}

/**
 * Calculates [Yule's coefficient]{@link https://en.wikipedia.org/wiki/Skewness#Quantile-based_measures} which is a
 * measure of skewness based on quantiles.
 *
 * @method yule
 * @memberof ran.shape
 * @param {number[]} values Array of values to calculate Yule's coefficient for.
 * @returns {(number|undefined)} Yule's coefficient of the values if the lower and upper quartiles differ, undefined
 * otherwise.
 * @example
 *
 * ran.shape.yule([])
 * // => undefined
 *
 * ran.shape.yule([1, 1, 1])
 * // => undefined
 *
 * ran.shape.yule([1, 1, 1, 2])
 * // => 1
 *
 * ran.shape.yule([1, 2, 2, 2])
 * // => -1
 */
function yule (values) {
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);

  return q1 === q3 ? undefined : (q1 + q3 - 2 * median(values)) / (q3 - q1)
}

/**
 * Namespaces containing various shape metrics.
 *
 * @namespace shape
 * @memberof ran
 */

var index$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  kurtosis: kurtosis,
  moment: moment,
  quantile: quantile,
  rank: rank,
  skewness: skewness,
  yule: yule
});

/**
 * Calculates the [Bartlett statistics]{@link https://en.wikipedia.org/wiki/Bartlett%27s_test} for multiple data sets.
 *
 * @method bartlett
 * @memberof ran.test
 * @param {Array[]} dataSets Array containing the data sets.
 * @param {number} [alpha = 0.05] Confidence level.
 * @returns {Object} Object containing the test statistics (chi2) and whether the data sets passed the null hypothesis that
 * their variances are the same.
 * @throws {Error} If the number of data sets is less than 2.
 * @throws {Error} If the size of any data set is less than 2 elements.
 * @example
 *
 * let normal1 = new ran.dist.Normal(1, 2)
 * let normal2 = new ran.dist.Normal(1, 3)
 * let normal3 = new ran.dist.Normal(1, 5)
 *
 * ran.test.bartlett([normal1.sample(100), normal1.sample(100), normal1.sample(100)], 0.1)
 * // => { stat: 0.09827551592930094, passed: true }
 *
 * ran.test.bartlett([normal1.sample(100), normal2.sample(100), normal3.sample(100)], 0.1)
 * // => { stat: 104.31185521417476, passed: false }
 */
function bartlett (dataSets, alpha = 0.05) {
  // Check number of data sets.
  if (dataSets.length < 2) {
    throw Error('dataSet must contain multiple data sets')
  }

  // Check size of data sets.
  for (let i = 0; i < dataSets.length; i++) {
    if (dataSets[i].length < 2) {
      throw Error('Data sets in dataSet must have multiple elements')
    }
  }

  // Number of samples.
  const k = dataSets.length;

  // Compute statistics.
  const N = dataSets.reduce((acc, d) => acc + d.length, 0);
  const nInv = dataSets.reduce((acc, d) => acc + 1 / (d.length - 1), 0);
  const Si = dataSets.map(variance);
  const Sp = dataSets.reduce((acc, d, i) => acc + (d.length - 1) * Si[i], 0) / (N - k);
  const lnSi = dataSets.reduce((acc, d, i) => acc + (d.length - 1) * Math.log(Si[i]), 0);
  const chi2 = ((N - k) * Math.log(Sp) - lnSi) / (1 + (nInv - 1 / (N - k)) / (3 * (k - 1)));

  // Compare against critical value.
  return {
    stat: chi2,
    passed: chi2 <= (new Chi2(k - 1)).q(1 - alpha)
  }
}

/**
 * Calculates the general Levene test with the specified aggregator. For mean it is the Leven test, for median it gives the Brown-Forsythe test.
 *
 * @method generalLevene
 * @memberOf ran.test
 * @param {Array[]} dataSets Array containing the data sets.
 * @param {number} [alpha = 0.05] Confidence level.
 * @param aggregator
 * @returns {Object} Object containing the test statistics and whether the data sets passed the null hypothesis that
 * their variances are the same.
 * @throws {Error} If the number of data sets is less than 2.
 * @throws {Error} If the size of any data set is less than 2 elements.
 * @ignore
 */
function generalLevene (dataSets, alpha, aggregator) {
// Check number of data sets.
  if (dataSets.length < 2) {
    throw Error('dataSet must contain multiple data sets')
  }

  // Number of samples.
  const k = dataSets.length;
  const Ni = dataSets.map(data => data.length);
  const N = Ni.reduce((sum, d) => sum + d, 0);

  // Compute statistics.
  const Yi = dataSets.map(aggregator);
  const Zij = dataSets.map((data, i) => data.map(d => Math.abs(d - Yi[i])));
  const Zi = Zij.map(mean);
  const Z = mean(Zij.flat());
  const num = Ni.reduce((sum, n, i) => sum + n * (Zi[i] - Z) ** 2, 0);
  let denom = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < Ni[i]; j++) {
      denom += (Zij[i][j] - Zi[i]) ** 2;
    }
  }
  const stat = (N - k) * num / ((k - 1) * denom);

  return {
    stat,
    passed: stat <= (new F(k - 1, N - k)).q(1 - alpha)
  }
}

/**
 * Calculates the [Levene's test]{@link https://en.wikipedia.org/wiki/Levene%27s_test} statistic for multiple data sets.
 *
 * @method levene
 * @memberof ran.test
 * @param {Array[]} dataSets Array containing the data sets.
 * @param {number} [alpha = 0.05] Confidence level.
 * @returns {Object} Object containing the test statistics (W) and whether the data sets passed the null hypothesis that
 * their variances are the same.
 * @throws {Error} If the number of data sets is less than 2.
 * @throws {Error} If the size of any data set is less than 2 elements.
 * @example
 *
 * let normal1 = new ran.dist.Normal(1, 2)
 * let normal2 = new ran.dist.Normal(1, 3)
 * let normal3 = new ran.dist.Normal(1, 5)
 *
 * ran.test.levene([normal1.sample(100), normal1.sample(100), normal1.sample(100)], 0.1)
 * // => { stat: 0.019917137672045088, passed: true }
 *
 * ran.test.levene([normal1.sample(100), normal2.sample(100), normal3.sample(100)], 0.1)
 * // => { stat: 29.06345994086687, passed: false }
 */
function levene (dataSets, alpha = 0.05) {
  return generalLevene(dataSets, alpha, mean)
}

/**
 * Calculates the [Brown-Forsythe test]{@link https://en.wikipedia.org/wiki/Brown%E2%80%93Forsythe_test} statistic for multiple data sets.
 *
 * @method brownForsythe
 * @memberof ran.test
 * @param {Array[]} dataSets Array containing the data sets.
 * @param {number} [alpha = 0.05] Confidence level.
 * @returns {Object} Object containing the test statistics (W) and whether the data sets passed the null hypothesis that
 * their variances are the same.
 * @throws {Error} If the number of data sets is less than 2.
 * @throws {Error} If the size of any data set is less than 2 elements.
 * @example
 *
 * let normal1 = new ran.dist.Normal(1, 2)
 * let normal2 = new ran.dist.Normal(1, 3)
 * let normal3 = new ran.dist.Normal(1, 5)
 *
 * ran.test.brownForsythe([normal1.sample(100), normal1.sample(100), normal1.sample(100)], 0.1)
 * // => { stat: 1.0664885130451343, passed: true }
 *
 * ran.test.brownForsythe([normal1.sample(100), normal2.sample(100), normal3.sample(100)], 0.1)
 * // => { stat: 27.495614343570345, passed: false }
 */
function brownForsythe (dataSets, alpha = 0.05) {
  return generalLevene(dataSets, alpha, median)
}

/**
 * Calculates the radial basis function inner product of two vectors.
 * Direct implementation of the Matlab code by Arthur Gretton.
 * Source: https://github.com/amber0309/HSIC/blob/master/MATLAB_version/rbf_dot.m
 *
 * @method rbfDot
 * @memberof ran.dependence
 * @param {ran.la.Vector} x First data vector.
 * @param {ran.la.Vector} y Second data vector.
 * @param {number} deg Kernel size.
 * @return {ran.la.Matrix} The inner product.
 * @private
 */
function rbfDot (x, y, deg) {
  const n1 = x.dim();
  const n2 = y.dim();

  const G = x.f((d, i) => d * x.i(i));
  let H = y.f((d, i) => d * y.i(i));

  const Q = new Matrix(G.v().map(d => Array(n1).fill(d)));
  const R = new Matrix(Array(n2).fill(H.v()));

  H = Q.add(R).sub(new Matrix(x.outer(y)).scale(2));

  H = H.f(d => Math.exp(-0.5 * d / (deg * deg)));

  return H
}

/**
 * Calculates the median distance between data points.
 * Direct implementation of the Matlab code by Arthur Gretton.
 * Source: https://github.com/amber0309/HSIC/blob/master/MATLAB_version/hsicTestGamma.m
 *
 * @method medianDist
 * @memberof ran.dependence
 * @param {ran.la.Vector} x Vector containing the data points.
 * @return {number} The median distance.
 * @private
 */
function medianDist (x) {
  const n = x.dim();

  const G = x.f((d, i) => d * x.i(i));

  const Q = new Matrix(G.v().map(d => Array(n).fill(d)));
  const R = new Matrix(Array(n).fill(G.v()));

  const dists = Q.add(R).sub(new Matrix(x.outer(x)).scale(2));
  return Math.sqrt(0.5 * median(dists.f((d, i, j) => i >= j ? d : 0).m().flat().filter(d => d > 0).sort((a, b) => a - b)))
}

/**
 * Calculates the Hilbert-Schmidt independence criterion (HSIC) for paired arrays of values. HSIC tests if two data sets are statistically independent.
 * Source: A. Gretton et al. A Kernel Statistical Test of Independence in Advances in Neural Information Processing Systems (2008).
 *
 * @method hsic
 * @memberof ran.test
 * @param {Array[]} dataSets Array containing the two data sets.
 * @param {number} [alpha = 0.05] Confidence level.
 * @return {Object} Object containing the test statistics and whether the data sets passed the null hypothesis that
 * they are statistically independent.
 * @throws {Error} If the number of data sets is less than 2.
 * @throws {Error} If the data sets have different sample size.
 * @throws {Error} If the sample size is less than 6.
 * @example
 *
 * let sample1 = Array.from({length: 50}, (d, i) => i)
 * let sample2 = sample1.map(d => d + Math.random() - 0.5)
 * ran.test.hsic([sample1, sample2])
 * // => { stat: 6.197628059960943, passed: false }
 *
 * sample1 = ran.core.float(0, 10, 50)
 * sample2 = ran.core.float(0, 10, 50)
 * ran.test.hsic([sample1, sample2])
 * // => { stat: 0.3876607680368274, passed: true }
 */
function hsic (dataSets, alpha = 0.05) {
  // Check data sets.
  if (dataSets.length !== 2) {
    throw Error('dataSets must contain two data sets')
  }

  // Check for equal sample size.
  if (dataSets[0].length !== dataSets[1].length) {
    throw Error('Data sets must have the same length')
  }

  // Check size of data sets.
  for (let i = 0; i < dataSets.length; i++) {
    if (dataSets[i].length < 6) {
      throw Error('Data sets in dataSet must have at least 6 elements')
    }
  }

  // Convert data sets to vectors.
  const vx = new Vector(dataSets[0]);
  const vy = new Vector(dataSets[1]);
  const n = vx.dim();

  // Calculate median distance.
  const widthX = medianDist(vx);
  const widthY = medianDist(vy);

  // Calculate centered Gram matrices.
  const H = new Matrix(n).sub(new Matrix(n).f(() => 1 / n));
  let K = rbfDot(vx, vx, widthX);
  let L = rbfDot(vy, vy, widthY);
  const Kc = H.mult(K).mult(H);
  const Lc = H.mult(L).mult(H);

  // Variance under H0.
  let variance = Kc.hadamard(Lc).f(d => Math.pow(d / 6, 2));
  variance = (neumaier(variance.rowSum()) - variance.trace()) / (n * (n - 1));
  variance = variance * 72 * (n - 4) * (n - 5) / n / (n - 1) / (n - 2) / (n - 3);

  // Mean under H0.
  const ones = new Vector(n).f(() => 1);
  K = K.f((d, i, j) => i === j ? 0 : d);
  L = L.f((d, i, j) => i === j ? 0 : d);
  const muX = K.apply(ones).dot(ones) / (n * (n - 1));
  const muY = L.apply(ones).dot(ones) / (n * (n - 1));
  const mean = (1 + muX * muY - muX - muY) / n;

  // Gamma distribution parameters.
  const a = mean * mean / variance;
  const b = variance * n / mean;

  // Test statistics and threshold.
  const stat = neumaier(Kc.t().hadamard(Lc).rowSum()) / n;
  return {
    stat,
    passed: stat < new Gamma(a, b).q(alpha)
  }
}

/**
 * Marks an array of values with a type.
 *
 * @method _markData
 * @memberof ran.test
 * @param {number[]} data Array of numbers to mark.
 * @param {number} type Type of the data to mark with.
 * @returns {Object[]} Array of objects containing the data as value properties and type as the type properties.
 * @private
 */
function _markData (data, type) {
  return data.map(d => ({
    value: d,
    type
  }))
}

function _mergeAndSortData (data) {
  return data
    .sort((a, b) => a.value - b.value)
    .map((d, i) => ({
      value: d.value,
      type: d.type,
      rank: i + 1
    }))
}

function _updateRanks (rankedData, lo, hi) {
  const midpoint = (rankedData[hi].rank + rankedData[lo].rank) / 2;
  for (let j = lo; j <= hi; j++) {
    rankedData[j].rank = midpoint;
  }
}

function _adjustRanksForTies (rankedData) {
  let lo = 0;
  let hi = lo;
  for (let i = 1; i < rankedData.length; i++) {
    if (rankedData[i].value === rankedData[lo].value) {
      hi = i;
    } else {
      if (hi !== lo) {
        _updateRanks(rankedData, lo, hi);
      }
      lo = i;
      hi = lo;
    }
  }
}

/**
 * Computes the ranks for an array of marked data.
 *
 * @method _computeRanks
 * @memberof ran.test
 * @param {Object[]} data Array of objects containing the marked data sets.
 * @returns {Object[]} Array of objects containing the marked data along with the ranks.
 * @private
 */
function _computeRanks (data) {
  const rankedData = _mergeAndSortData(data);
  _adjustRanksForTies(rankedData);
  return rankedData
}

/**
 * Calculates the [Mann-Whitney statistics]{@link https://en.wikipedia.org/wiki/Mann%E2%80%93Whitney_U_test} for two
 * data sets.
 *
 * @method mannWhitney
 * @memberof ran.test
 * @param {Array[]} dataSets Array containing the two data sets.
 * @param {number} [alpha = 0.05] Confidence level.
 * @returns {Object} Object containing the (non-standardized) test statistics (U) and whether the data sets passed the null hypothesis that
 * the samples come from the same distribution.
 * @throws {Error} If the number of data sets is different from 2.
 * @example
 *
 * let pareto = new ran.dist.Pareto(1, 2)
 * let uniform = new ran.dist.Uniform(1, 10)
 *
 * ran.test.mannWhitney([pareto.sample(100), pareto.sample(100)], 0.1)
 * // => { stat: 4941, passed: true }
 *
 * ran.test.mannWhitney([pareto.sample(100), uniform.sample(100)], 0.1)
 * // => { stat: 132, passed: false }
 */
function mannWhitney (dataSets, alpha = 0.05) {
  // Check data sets.
  if (dataSets.length !== 2) {
    throw Error('dataSets must contain two data sets')
  }

  // Flag data sets.
  const markedData1 = _markData(dataSets[0], 1);
  const markedData2 = _markData(dataSets[1], 2);

  // Assign ranks.
  const ranks = _computeRanks(markedData1.concat(markedData2));

  // Compute statistics.
  const n1 = dataSets[0].length;
  const n2 = dataSets[1].length;
  const r1 = ranks.filter(d => d.type === 1)
    .reduce((sum, d) => sum + d.rank, 0);
  const U1 = r1 - n1 * (n1 + 1) / 2;
  const U = Math.min(U1, n1 * n2 - U1);

  // Standardize U.
  const m = n1 * n2 / 2;
  const s = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12);

  // Compare against critical value.
  return {
    stat: U,
    passed: Math.abs((U - m) / s) <= (new Normal()).q(1 - 2 * alpha)
  }
}

/**
 * A collection of statistical tests.
 *
 * @namespace test
 * @memberof ran
 */

var index = /*#__PURE__*/Object.freeze({
  __proto__: null,
  bartlett: bartlett,
  brownForsythe: brownForsythe,
  hsic: hsic,
  levene: levene,
  mannWhitney: mannWhitney
});

exports.core = index$6;
exports.dependence = index$4;
exports.dispersion = index$3;
exports.dist = index$2;
exports.location = index$5;
exports.shape = index$1;
exports.test = index;
