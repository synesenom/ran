import Vector from '../la/vector'
import Matrix from '../la/matrix'

/**
 * Class representing the aggregate [covariance matrix]{@link https://en.wikipedia.org/wiki/Covariance_matrix} of a time series:
 *
 * $$C_{ij} = \mathbb{E}\big[\big(X_i - \mathbb{E}[X_i]\big)\big(X_j - \mathbb{E}[X_j]\big)\big],$$
 *
 * where \(\mathbb{E}\) denotes the expected value and \(X_i, X_j\) are the i-th and j-th variables in the time series. The covariance matrix is calculated online at each update.
 *
 * @class OnlineCovariance
 * @memberOf ran.ts
 * @param {number} dimension The linear dimension of the covariance. Default is 1.
 * @constructor
 */
export default class {
  constructor (dimension = 1) {
    this.n = 0
    this.mean = new Vector(dimension).scale(0)
    this.cov = new Matrix(dimension).scale(0)
  }

  /**
   * Updates the covariance matrix with new observations.
   *
   * @method update
   * @methodOf ran.ts.OnlineCovariance
   * @param {number[]} x Array of numbers representing the new observations.
   */
  update(x) {
    this.n++
    const vx = new Vector(x)
    const mean = this.mean.add(vx.sub(this.mean).scale(1 / this.n))
    const diff = vx.sub(this.mean)
    const dCov = new Matrix(diff.outer(diff))
    this.mean = mean
    this.cov = this.cov.add(dCov.scale((this.n - 1) / this.n))
  }

  /**
   * Computes the current value of the covariance matrix.
   *
   * @method compute
   * @methodOf ran.ts.OnlineCovariance
   * @returns {(ran.la.Matrix | undefined)} The current covariance matrix if there was any update already, undefined otherwise.
   */
  compute() {
    return this.n > 0 ? this.cov.scale(1 / this.n) : undefined
  }
}
