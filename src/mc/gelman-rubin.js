// Computes the G-R diagnostic for one dimension at a fixed chain prefix length.
function _gri (chains, dim) {
  const n = chains[0].length
  const m = chains.length
  const means = chains.map(chain => chain.reduce((s, x) => s + x[dim], 0) / n)
  const grandMean = means.reduce((s, v) => s + v, 0) / m
  const W = chains.reduce((s, chain, k) => {
    return s + chain.reduce((ss, x) => ss + (x[dim] - means[k]) * (x[dim] - means[k]), 0) / (n - 1)
  }, 0) / m
  const B = n * means.reduce((s, v) => s + (v - grandMean) * (v - grandMean), 0) / (m - 1)
  return Math.sqrt(((n - 1) * W + B) / (n * W))
}

/**
 * Calculates the [Gelman-Rubin]{@link http://www.stat.columbia.edu/~gelman/research/published/brooksgelman2.pdf}
 * convergence diagnostic for a set of independent chains. Returns the R-hat statistic as a function
 * of iteration count for each state dimension, starting from the minimum of 2 samples.
 *
 * @method gelmanRubin
 * @memberof ran.mc
 * @param {Array} samples Array of chains, where each chain is an array of states returned by
 * [RWM#sample]{@link ran.mc.RWM#sample}. At least two chains are required.
 * @param {number=} maxLength Maximum number of diagnostic values to return per dimension. Defaults
 * to the full chain length.
 * @returns {number[][]} Array of R-hat-vs-iteration arrays, one per state dimension.
 * @throws {Error} If fewer than two chains are provided.
 */
export default function gelmanRubin (samples, maxLength) {
  if (!Array.isArray(samples) || samples.length < 2) {
    throw Error('gelmanRubin requires at least two chains')
  }
  // _gri divides by chains[0].length for every chain, so unequal lengths silently corrupt the
  // R-hat (a shorter chain reads past its end as undefined -> NaN, and its (n-1) divisor mismatches
  // its true sample count). runChains always produces equal-length chains, but gelmanRubin is a
  // public, directly-callable export, so guard the contract here rather than assume the pipeline.
  const n0 = samples[0].length
  if (!samples.every(chain => Array.isArray(chain) && chain.length === n0)) {
    throw Error('gelmanRubin requires all chains to have the same length')
  }
  const nPoints = maxLength !== undefined
    ? Math.min(samples[0].length - 1, maxLength)
    : samples[0].length - 1
  const dim = samples[0][0].length
  return Array.from({ length: dim }, (_, j) =>
    Array.from({ length: nPoints }, (_, i) =>
      _gri(samples.map(chain => chain.slice(0, i + 2)), j)
    )
  )
}
