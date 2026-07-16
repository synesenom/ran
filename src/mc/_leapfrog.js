/**
 * Leapfrog integrator (Neal 2011, Algorithm 1): half-step momentum, full-step position,
 * half-step momentum, repeated for `steps` steps. Uses the simple unmerged form (two half
 * steps per leapfrog step) rather than the trailing/leading half-step merge optimization, for
 * a direct, easily-verified match to the textbook algorithm. Shared by HMC (fixed `steps` per
 * iteration) and NUTS (always `steps = 1`, with direction folded into a signed `eps`).
 *
 * @param {number[]} x Current position.
 * @param {number[]} r Current momentum.
 * @param {Function} gradLogDensity Gradient of the log target density.
 * @param {number} eps Step size (signed — a negative value integrates backward).
 * @param {number} steps Number of leapfrog steps to take.
 * @returns {{x: number[], r: number[]}} Position and momentum after `steps` leapfrog steps.
 * @ignore
 */
export default function leapfrog (x, r, gradLogDensity, eps, steps) {
  const xCur = x.slice()
  const rCur = r.slice()
  const dim = xCur.length
  for (let l = 0; l < steps; l++) {
    // In-place updates avoid three fresh array allocations per leapfrog step — this runs on the
    // order of a thousand times per NUTS iteration (up to 2^MAX_TREE_DEPTH leaf evaluations).
    const grad0 = gradLogDensity(xCur)
    for (let i = 0; i < dim; i++) rCur[i] += 0.5 * eps * grad0[i]
    for (let i = 0; i < dim; i++) xCur[i] += eps * rCur[i]
    const grad1 = gradLogDensity(xCur)
    for (let i = 0; i < dim; i++) rCur[i] += 0.5 * eps * grad1[i]
  }
  return { x: xCur, r: rCur }
}
