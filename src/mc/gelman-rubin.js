function sum(arr, exponent = 1) {
  if (exponent === 1) {
    return arr.reduce((s, d) => s + d, 0)
  } else {
    return arr.reduce((s, d) => s + Math.pow(d, exponent), 0)
  }
}

export default (function () {
  /**
   * Calculates the G-R diagnostic for a single set of samples and a specified state dimension.
   *
   * @method _gri
   * @memberOf ran.mc
   * @param {Array} samples Array of samples.
   * @param {number} dim Index of the state dimension to consider.
   * @returns {number} The G-R diagnostic.
   * @private
   */
  function _gri (samples, dim) {
    // Calculate sample statistics
    let m = []

    let s = []
    samples.forEach(function (d) {
      let di = d.map(function (x) {
        return x[dim]
      })
      let mi = sum(di) / di.length

      let si = (sum(di, 2) - di.length * mi * mi) / (di.length - 1)
      m.push(mi)
      s.push(si)
    })

    // Calculate within and between variances
    let w = sum(s) / samples.length

    let mm = sum(m) / samples.length

    let b = (sum(m, 2) - samples.length * mm * mm) * samples[0].length / (samples.length - 1)

    let v = ((samples[0].length - 1) * w + b) / samples[0].length
    return Math.sqrt(v / w)
  }

  /**
   * Calculates the [Gelman-Rubin]{@link http://www.stat.columbia.edu/~gelman/research/published/brooksgelman2.pdf} diagnostics for a set
   * of samples. The statistics can be used to monitor the convergence of an MCMC model.
   *
   * @method gelmanRubin
   * @memberOf ran.mc
   * @param {Array} samples Array of samples, where each sample is an array of states.
   * @param {number=} maxLength Maximum length of the diagnostic function. Default value is 1000.
   * @returns {Array} Array of Gelman-Rubin diagnostic versus iteration number for each state variable.
   */
  return function (samples, maxLength) {
    return samples[0][0].map(function (s, j) {
      return new Array(maxLength || 1000).fill(0).map(function (d, i) {
        return _gri(samples.map(function (dd) {
          return dd.slice(0, i + 2)
        }), j)
      })
    })
  }
})()
