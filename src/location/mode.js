/**
 * Calculates the mode(s) for a sample of discrete values.
 *
 * @method discreteMode
 * @methodOf ran.location
 * @param {number[]} values Array containing the sample.
 * @return {number[]} Array containing the modes of the sample.
 * @private
 */
function discreteMode (values) {
  // Count occurrences.
  const counts = Array.from(values.reduce((count, d) => count.set(d, (count.get(d) || 0) + 1), new Map()))
    .sort((a, b) => b[1] - a[1])

  // Find highest count.
  const maxCounts = counts[0][1]

  // Return values with highest count.
  return counts.filter(d => d[1] === maxCounts).map(d => d[0])
}

/**
 * Calculates the mode for continuous sample using the half sample mode: https://arxiv.org/pdf/math/0505419.pdf.
 *
 * @method continuousMode
 * @methodOf ran.location.mode
 * @param {number[]} values Array containing the continuous sample.
 * @return {number} The estimated mode.
 * @private
 */
function continuousMode (values) {
  // Sort values.
  values.sort((a, b) => a - b)

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
    default:
      let j = 0
      let wMin = values[values.length - 1] - values[0]
      let N = Math.ceil(values.length / 2)
      let n = values.length
      for (let i = 0; i < n - N + 1; i++) {
        let w = values[i + N - 1] - values[i]
        if (w < wMin) {
          wMin = w
          j = i
        }
      }
      return continuousMode(values.slice(j, j + N))
  }
}

/**
 * Calculates the mode(s) of a sample. In case of discrete values (integers), it returns the values corresponding to the
 * highest frequencies. For continuous sample, the mode is estimated using the [half-sample mode algorithm]{@link https://arxiv.org/pdf/math/0505419.pdf}.
 *
 * @method mode
 * @methodOf ran.location
 * @param {number[]} values Array of values to calculate mode for.
 * @returns {number|number[]|undefined} The estimated mode (continuous sample), an array of modes (discrete sample) or
 * undefined (empty sample).
 */
// TODO Add examples.
export default function (values) {
  if (values.length === 0) {
    return undefined
  }

  if (values.reduce((int, d) => int && Number.isInteger(d), true)) {
    return discreteMode(values)
  } else {
    return continuousMode(values)
  }
}
