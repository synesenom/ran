// Standard Nelder-Mead (simplex) coefficients from Nelder & Mead (1965).
const ALPHA = 1 // reflection
const GAMMA = 2 // expansion
const RHO = 0.5 // contraction
const SIGMA = 0.5 // shrink

/**
 * Minimises a function using the Nelder-Mead simplex method.
 *
 * @method nelderMead
 * @memberof ran.algorithms
 * @param {Function} f Objective function to minimise; accepts a number[] and returns number.
 * @param {number[]} x0 Initial parameter vector.
 * @param {Object} [opts] Options.
 * @param {number} [opts.tol=1e-8] Stopping tolerance on simplex diameter (max distance from best vertex to any other vertex in parameter space).
 * @param {number} [opts.maxIter=1000] Maximum number of iterations.
 * @returns {number[]} Parameter vector at the approximate minimum.
 * @private
 */
export default function nelderMead (f, x0, opts = {}) {
  const { tol = 1e-8, maxIter = 1000 } = opts
  const k = x0.length

  // Build k+1 initial vertices: x0 plus one perturbation along each axis.
  const vertices = [x0.slice()]
  for (let i = 0; i < k; i++) {
    const v = x0.slice()
    v[i] += v[i] !== 0 ? 0.05 * Math.abs(v[i]) : 0.05
    vertices.push(v)
  }

  const fvals = vertices.map(v => f(v))

  for (let iter = 0; iter < maxIter; iter++) {
    // Sort so vertices[0] is best (lowest f) and vertices[k] is worst.
    const idx = fvals.map((fv, i) => i).sort((a, b) => fvals[a] - fvals[b])
    const sortedV = idx.map(i => vertices[i])
    const sortedF = idx.map(i => fvals[i])
    for (let i = 0; i <= k; i++) {
      vertices[i] = sortedV[i]
      fvals[i] = sortedF[i]
    }

    // Convergence: simplex diameter (max distance from best vertex) falls below tolerance.
    // x-space criterion avoids premature exit when f-values are symmetric around the minimum.
    let maxDist = 0
    for (let i = 1; i <= k; i++) {
      let dist = 0
      for (let j = 0; j < k; j++) dist += (vertices[i][j] - vertices[0][j]) ** 2
      maxDist = Math.max(maxDist, Math.sqrt(dist))
    }
    if (maxDist < tol) break

    const fBest = fvals[0]
    const fSecondWorst = fvals[k - 1]
    const fWorst = fvals[k]

    // Centroid of all vertices except worst.
    const xo = Array(k).fill(0)
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) xo[j] += vertices[i][j]
    }
    for (let j = 0; j < k; j++) xo[j] /= k

    // Reflect worst through centroid.
    const xr = xo.map((c, j) => c + ALPHA * (c - vertices[k][j]))
    const fr = f(xr)

    if (fr < fBest) {
      // Expand: try going further in the reflected direction.
      const xe = xo.map((c, j) => c + GAMMA * (xr[j] - c))
      const fe = f(xe)
      vertices[k] = fe < fr ? xe : xr
      fvals[k] = fe < fr ? fe : fr
      continue
    }

    if (fr < fSecondWorst) {
      // Reflected point is better than second-worst: accept it.
      vertices[k] = xr
      fvals[k] = fr
      continue
    }

    // Contract: reflected point not an improvement.
    if (fr < fWorst) {
      // Outside contraction.
      const xc = xo.map((c, j) => c + RHO * (xr[j] - c))
      const fc = f(xc)
      if (fc <= fr) {
        vertices[k] = xc
        fvals[k] = fc
        continue
      }
    } else {
      // Inside contraction.
      const xc = xo.map((c, j) => c + RHO * (vertices[k][j] - c))
      const fc = f(xc)
      if (fc < fWorst) {
        vertices[k] = xc
        fvals[k] = fc
        continue
      }
    }

    // Shrink all vertices toward the best.
    for (let i = 1; i <= k; i++) {
      vertices[i] = vertices[0].map((c, j) => c + SIGMA * (vertices[i][j] - c))
      fvals[i] = f(vertices[i])
    }
  }

  // Return the best vertex found.
  const bestIdx = fvals.indexOf(Math.min(...fvals))
  return vertices[bestIdx]
}
