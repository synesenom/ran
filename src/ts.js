/**
 * Namespace containing various exposed methods related to time series
 *
 * @namespace ts
 * @memberOf ran
 */
export { default as OnlineCovariance } from './ts/online-covariance'

/**
   * Class representing an [auto-correlation]{@link https://en.wikipedia.org/wiki/Autocorrelation} function:
   *
   * $$R_i(\tau) = \mathbb{E}[X_i(t) X_i(t + \tau)],$$
   *
   * where \(X_i(t)\) is the time series corresponding to the i-th variable and \(\tau\) denotes the lag. The elements are accumulated sequentially and the auto-correlation is computed from historical values.
   *
   * @class AC
   * @memberOf ran.ts
   * @param {number} dimension The dimension of the auto-correlation. Default is 1.
   * @param {number} range The maximum lag used in the calculation of the correlation. Default is 100.
   * @param {number} maxSize The maximum historical data that is stored to compute the correlation. All
   * observations older than this number are dropped. Default is 10K.
   * @constructor
   */
export class AC {
  constructor (dimension = 1, range = 100, maxSize = 1e4) {
    this.dim = dimension
    this.range = range
    this.maxSize = maxSize
    this.history = Array.from({ length: dimension }, () => [])
  }

  /**
     * Calculates the auto-correlation from a single historical data.
     *
     * @method _aci
     * @memberOf ran.ts.AC
     * @param {Array} h Array containing the history of a single variable.
     * @returns {number[]} The auto-correlation vs lag function.
     * @private
     */
  _aci (h) {
    // Get average
    let m = h.reduce((s, d) => s + d) / h.length

    let m2 = h.reduce((s, d) => s + d * d)

    let rho = new Array(this.range).fill(0)
    for (let i = 0; i < h.length; i++) {
      for (let r = 0; r < rho.length; r++) {
        if (i - r > 0) {
          rho[r] += (h[i] - m) * (h[i - r] - m)
        }
      }
    }

    return rho.map(function (d) {
      return d / (m2 - h.length * m * m)
    })
  }

  /**
     * Resets the auto-correlation history.
     *
     * @method reset
     * @memberOf ran.ts.AC
     */
  reset () {
    this.history = Array.from({ length: this.dim }, () => [])
  }

  /**
     * Updates the internal history that is used for the calculation of the correlation function.
     * Also drops old observations.
     *
     * @method update
     * @memberOf ran.ts.AC
     * @param {Array} x Array of new variables to update history with.
     */
  update (x) {
    this.history.forEach((d, i) => d.push(x[i]))
    if (this.history[0].length >= this.maxSize) {
      this.history.forEach(d => d.shift())
    }
  }

  /**
     * Computes the auto-correlation function based on the current historical data.
     *
     * @method compute
     * @memberOf ran.ts.AC
     * @returns {Array[]} Array containing the auto-correlation function (correlation vs lag) for each component.
     */
  compute () {
    if (this.history.reduce((acc, d) => acc + d.length, 0) > 0) {
      return this.history.map(d => this._aci(d))
    } else {
      return Array.from({ length: this.dim }, () => Array.from({ length: this.range }, () => undefined))
    }
  }
}

export { default as Covariance } from './ts/online-covariance'
