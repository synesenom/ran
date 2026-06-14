import Categorical from './categorical'
import Distribution from './_distribution'

/**
 * Probability mass function for the (ideal) [soliton distribution]{@link https://en.wikipedia.org/wiki/Soliton_distribution}:
 *
 * $f(k; N) = \begin{cases}\frac{1}{N} &\quad\text{if $k = 1$},\\\\ \frac{1}{k (k - 1)} &\quad\text{otherwise}\\\\ \end{cases},$
 *
 * with $N \in \mathbb{N}^+$. Support: $k \in \{1, 2, ..., N\}$.
 *
 * @class Soliton
 * @memberof ran.dist
 * @constructor
 */
export default class Soliton extends Categorical {
  // Special case of categorical.
  /**
   * @param {number} N Number of blocks in the messaging model. If not an integer, it is rounded to the nearest one.
   */
  constructor (N) {
    // Define weights
    const Ni = Math.round(N)
    super([1 / Ni].concat(Array.from({ length: Ni - 1 }, (d, i) => 1 / ((i + 1) * (i + 2)))), 1)
    this.p = { N: Ni }

    // Update number of parameters.
    this.k = 1

    // Validate parameters
    Distribution.validate({ N: Ni }, [
      'N > 0'
    ])
  }

  static _fitInit (data) {
    // Support is {1,…,N}; the largest observation is a lower bound for N (reduce avoids spreading a large array onto the call stack)
    return [Math.round(data.reduce((m, x) => x > m ? x : m, 1))]
  }

  /**
   * @returns {number} The mean of the distribution.
   */
  mean () {
    const N = this.p.N
    // E[X] = 1/N + H_{N-1} where H_m = sum_{k=1}^{m} 1/k
    let H = 0
    for (let k = 1; k < N; k++) H += 1 / k
    return 1 / N + H
  }

  /**
   * @returns {number} The variance of the distribution.
   */
  variance () {
    const N = this.p.N
    let H = 0
    for (let k = 1; k < N; k++) H += 1 / k
    const mu = 1 / N + H
    // E[X²] = 1/N + (N-1) + H_{N-1}
    const e2 = 1 / N + (N - 1) + H
    return e2 - mu * mu
  }

  /**
   * @returns {number} The skewness of the distribution.
   */
  skewness () {
    const N = this.p.N
    let H = 0
    for (let k = 1; k < N; k++) H += 1 / k
    const mu = 1 / N + H
    const e2 = 1 / N + (N - 1) + H
    // E[X³] = 1/N + (N-1)*N/2 + 2*(N-1) + H_{N-1}
    const e3 = 1 / N + (N - 1) * N / 2 + 2 * (N - 1) + H
    const v = e2 - mu * mu
    const mu3 = e3 - 3 * mu * e2 + 2 * mu * mu * mu
    return mu3 / Math.pow(v, 1.5)
  }

  /**
   * @returns {number} The excess kurtosis of the distribution.
   */
  kurtosis () {
    const N = this.p.N
    let H = 0
    for (let k = 1; k < N; k++) H += 1 / k
    const mu = 1 / N + H
    const e2 = 1 / N + (N - 1) + H
    const e3 = 1 / N + (N - 1) * N / 2 + 2 * (N - 1) + H
    // E[X⁴] = 1/N + (N-1)*N*(2*N-1)/6 + 3*(N-1)*N/2 + 3*(N-1) + H_{N-1}
    const e4 = 1 / N + (N - 1) * N * (2 * N - 1) / 6 + 3 * (N - 1) * N / 2 + 3 * (N - 1) + H
    const v = e2 - mu * mu
    const mu4 = e4 - 4 * mu * e3 + 6 * mu * mu * e2 - 3 * mu * mu * mu * mu
    return mu4 / (v * v) - 3
  }

  /**
   * @param {number[]} data Array of sample values.
   * @returns {Soliton} Fitted distribution.
   */
  static fit (data) {
    const Cls = this
    const [NSeed] = Cls._fitInit(data)
    const w = Distribution._adaptiveHalfWidth(N => { try { return new Cls(N).lnL(data) } catch (_) { return -Infinity } }, NSeed, 1)
    const NLo = Math.max(1, NSeed - w)
    const NHi = NSeed + w
    let bestN = NSeed
    let bestLnL = -Infinity
    for (let N = NLo; N <= NHi; N++) {
      try {
        const lnL = new Cls(N).lnL(data)
        if (lnL > bestLnL) { bestLnL = lnL; bestN = N }
      } catch (_) {}
    }
    return new Cls(bestN)
  }
}
