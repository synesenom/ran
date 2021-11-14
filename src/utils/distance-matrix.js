import Matrix from '../la/matrix'
import mean from '../location/mean'

/**
 * Calculates the [distance matrix for the distance covariance]{@link https://en.wikipedia.org/wiki/Distance_correlation#Distance_covariance}.
 *
 * @method distanceMatrix
 * @memberof ran.dependence
 * @param {number[]} values Array of values to calculate distance matrix for.
 * @return {ran.la.Matrix} The distance matrix.
 * @private
 */
export default function (values) {
  // Calculate distance matrix.
  const mat = new Matrix(values.map(i => values.map(j => Math.abs(i - j))))

  // Centralize.
  const row = mat.rowSum().map(d => d / values.length)
  const grand = mean(row)
  return mat.f((d, i, j) => d + grand - row[i] - row[j])
}
