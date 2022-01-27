import { neumaier } from '../algorithms'
import { Vector, Matrix } from '../la'
import { Gamma } from '../dist'
import { median } from '../location'

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
function rbfDot(x, y, deg) {
  const n1 = x.dim()
  const n2 = y.dim()

  const G = x.f((d, i) => d * x.i(i))
  let H = y.f((d, i) => d * y.i(i))

  const Q = new Matrix(G.v().map(d => Array(n1).fill(d)))
  const R = new Matrix(Array(n2).fill(H.v()))

  H = Q.add(R).sub(new Matrix(x.outer(y)).scale(2))

  H = H.f(d => Math.exp(-0.5 * d / (deg * deg)))

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
  const n = x.dim()

  const G = x.f((d, i) => d * x.i(i))

  const Q = new Matrix(G.v().map(d => Array(n).fill(d)))
  const R = new Matrix(Array(n).fill(G.v()))

  const dists = Q.add(R).sub(new Matrix(x.outer(x)).scale(2))
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
export default function hsic (dataSets, alpha = 0.05) {
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
  const vx = new Vector(dataSets[0])
  const vy = new Vector(dataSets[1])
  const n = vx.dim()

  // Calculate median distance.
  const widthX = medianDist(vx)
  const widthY = medianDist(vy)

  // Calculate centered Gram matrices.
  const H = new Matrix(n).sub(new Matrix(n).f(() => 1 / n))
  let K = rbfDot(vx, vx, widthX)
  let L = rbfDot(vy, vy, widthY)
  const Kc = H.mult(K).mult(H)
  const Lc = H.mult(L).mult(H)

  // Variance under H0.
  let variance = Kc.hadamard(Lc).f(d => Math.pow(d / 6, 2))
  variance = (neumaier(variance.rowSum()) - variance.trace()) / (n * (n - 1))
  variance = variance * 72 * (n - 4) * (n - 5) / n / (n - 1) / (n - 2) / (n - 3)

  // Mean under H0.
  const ones = new Vector(n).f(() => 1)
  K = K.f((d, i, j) => i === j ? 0 : d)
  L = L.f((d, i, j) => i === j ? 0 : d)
  const muX = K.apply(ones).dot(ones) / (n * (n - 1))
  const muY = L.apply(ones).dot(ones) / (n * (n - 1))
  const mean = (1 + muX * muY - muX - muY) / n

  // Gamma distribution parameters.
  const a = mean * mean / variance
  const b = variance * n / mean

  // Test statistics and threshold.
  const stat = neumaier(Kc.t().hadamard(Lc).rowSum()) / n
  return {
    stat,
    passed: stat < new Gamma(a, b).q(alpha)
  }
}
