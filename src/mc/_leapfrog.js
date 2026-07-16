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
  let xCur = x.slice()
  let rCur = r.slice()
  for (let l = 0; l < steps; l++) {
    const grad0 = gradLogDensity(xCur)
    rCur = rCur.map((ri, i) => ri + 0.5 * eps * grad0[i])
    xCur = xCur.map((xi, i) => xi + eps * rCur[i])
    const grad1 = gradLogDensity(xCur)
    rCur = rCur.map((ri, i) => ri + 0.5 * eps * grad1[i])
  }
  return { x: xCur, r: rCur }
}
