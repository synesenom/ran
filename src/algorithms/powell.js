import { EPS } from '../core/constants'

// Powell's conjugate-direction method (Powell 1964; Press et al., Numerical Recipes §10.5).
// A derivative-free optimiser: it needs no gradient, so it remains valid on the Infinity-barrier
// MLE objective (invalid parameters return Infinity) and on likelihoods that are discontinuous or
// non-differentiable in their parameters (e.g. Uniform, Triangular) — exactly the cases that rule
// out gradient-based methods. It improves on Nelder-Mead by building up mutually conjugate search
// directions, giving quadratic termination on smooth objectives and far less stagnation.
// See decisions/0016-distribution-fit-powell-and-exact-mle.md.

// Golden ratio and 1-D bracketing/Brent constants (Numerical Recipes §10.1-10.2).
const GOLD = 1.618034
const GLIMIT = 100
const TINY = 1e-20
const CGOLD = 0.3819660
// Brent floor on the bracket width; √EPS is the precision limit of a function-value 1-D minimiser.
const ZEPS = Math.sqrt(EPS)

// SIGN(a, b): magnitude of a with the sign of b, never zero magnitude (Numerical Recipes idiom).
function sign (a, b) {
  return b >= 0 ? Math.abs(a) : -Math.abs(a)
}

// Parabolic interpolation coefficients through (x, w, v); normalises sign convention so q > 0.
function _computeParabolicStep (state) {
  const { x, w, v, fx, fw, fv } = state
  const r = (x - w) * (fx - fv)
  let q = (x - v) * (fx - fw)
  let p = (x - v) * q - (x - w) * r
  q = 2 * (q - r)
  if (q > 0) p = -p
  q = Math.abs(q)
  return { p, q }
}

// True when the parabolic trial step is too large, or falls outside either end of the bracket.
function _isParabolicStepRejected (p, q, etemp, state) {
  const { a, b, x } = state
  return (
    Math.abs(p) >= Math.abs(0.5 * q * etemp) ||
    p <= q * (a - x) ||
    p >= q * (b - x)
  )
}

// Chooses {d, e} for one Brent iteration: parabolic when valid, golden-section otherwise.
function _chooseBrentStep (state, tol1) {
  const { x, a, b, e: e0, d: d0 } = state
  const xm = 0.5 * (a + b)
  if (Math.abs(e0) > tol1) {
    const { p, q } = _computeParabolicStep(state)
    if (_isParabolicStepRejected(p, q, e0, state)) {
      const e = x >= xm ? a - x : b - x
      return { d: CGOLD * e, e }
    }
    const d = p / q
    const u = x + d
    const tol2 = 2 * tol1
    return {
      d: (u - a < tol2 || b - u < tol2) ? sign(tol1, xm - x) : d,
      e: d0
    }
  }
  const e = x >= xm ? a - x : b - x
  return { d: CGOLD * e, e }
}

// Which three-point tracking slot (w=best secondary, v=third best, null=none) should absorb u.
function _brentSlot (fu, state) {
  const { fw, fv, w, v, x } = state
  if (fu <= fw || w === x) return 'w'
  if (fu <= fv || v === x || v === w) return 'v'
  return null
}

// Updates the Brent bracket and three-point tracker after evaluating the trial point (u, fu).
function _updateBrentState (state, u, fu) {
  const { a, b, x, w, v, fx, fw, fv } = state
  if (fu <= fx) {
    return {
      a: u >= x ? x : a,
      b: u >= x ? b : x,
      x: u,
      w: x,
      v: w,
      fx: fu,
      fw: fx,
      fv: fw
    }
  }
  const newA = u < x ? u : a
  const newB = u < x ? b : u
  const slot = _brentSlot(fu, state)
  if (slot === 'w') return { a: newA, b: newB, x, w: u, v: w, fx, fw: fu, fv: fw }
  if (slot === 'v') return { a: newA, b: newB, x, w, v: u, fx, fw, fv: fu }
  return { a: newA, b: newB, x, w, v, fx, fw, fv }
}

// One step of the bracketMin search: dispatches on u's position and returns the next bracket state.
function _bracketAdvance (phi, bracket, u, ulim) {
  const { a, b, c, fb, fc } = bracket
  if ((b - u) * (u - c) > 0) {
    // Parabolic minimum between b and c.
    const fu = phi(u)
    if (fu < fc) return { done: true, triple: [b, u, c] }
    if (fu > fb) return { done: true, triple: [a, b, u] }
    const newU = c + GOLD * (c - b)
    return { done: false, a: b, b: c, c: newU, fa: fb, fb: fc, fc: phi(newU) }
  }
  if ((c - u) * (u - ulim) > 0) {
    // Parabolic minimum between c and its allowed limit.
    const fu = phi(u)
    if (fu < fc) {
      const newB = c
      const newC = u
      const extraU = newC + GOLD * (newC - newB)
      return { done: false, a: newB, b: newC, c: extraU, fa: fc, fb: fu, fc: phi(extraU) }
    }
    return { done: false, a: b, b: c, c: u, fa: fb, fb: fc, fc: fu }
  }
  if ((u - ulim) * (ulim - c) >= 0) {
    // Limit parabolic u to its maximum allowed value.
    return { done: false, a: b, b: c, c: ulim, fa: fb, fb: fc, fc: phi(ulim) }
  }
  // Reject parabolic u, use default magnification.
  const goldenU = c + GOLD * (c - b)
  return { done: false, a: b, b: c, c: goldenU, fa: fb, fb: fc, fc: phi(goldenU) }
}

/**
 * Brackets a minimum of a 1-D function. Given two initial abscissas, searches downhill until it
 * finds a triple (a, b, c) with phi(b) below both phi(a) and phi(c).
 *
 * @param {Function} phi 1-D function to bracket.
 * @param {number} a0 First initial abscissa.
 * @param {number} b0 Second initial abscissa.
 * @returns {number[]} Bracketing triple [a, b, c].
 * @private
 */
function bracketMin (phi, a0, b0) {
  let a = a0
  let b = b0
  let fa = phi(a)
  let fb = phi(b)
  // Ensure we go downhill from a to b.
  if (fb > fa) {
    [a, b] = [b, a]
    ;[fa, fb] = [fb, fa]
  }
  let c = b + GOLD * (b - a)
  let fc = phi(c)
  let iter = 0
  while (fb > fc && iter++ < GLIMIT) {
    const r = (b - a) * (fb - fc)
    const q = (b - c) * (fb - fa)
    const u = b - ((b - c) * q - (b - a) * r) / (2 * sign(Math.max(Math.abs(q - r), TINY), q - r))
    const ulim = b + GLIMIT * (c - b)
    const step = _bracketAdvance(phi, { a, b, c, fb, fc }, u, ulim)
    if (step.done) return step.triple
    ;({ a, b, c, fa, fb, fc } = step)
  }
  return [a, b, c]
}

/**
 * Minimises a 1-D function within a bracket using Brent's method (parabolic interpolation with a
 * golden-section fallback).
 *
 * @param {Function} phi 1-D function to minimise.
 * @param {number[]} bracket [ax, bx, cx] bracketing triple from bracketMin.
 * @param {Object} opts
 * @param {number} opts.tol Fractional tolerance on the abscissa.
 * @param {number} opts.maxIter Maximum iterations.
 * @returns {number[]} [xmin, fmin].
 * @private
 */
function brentMin (phi, bracket, opts) {
  const [ax, bx, cx] = bracket
  const { tol, maxIter } = opts
  const fInit = phi(bx)
  const state = {
    a: Math.min(ax, cx),
    b: Math.max(ax, cx),
    x: bx,
    w: bx,
    v: bx,
    fx: fInit,
    fw: fInit,
    fv: fInit,
    d: 0,
    e: 0
  }
  for (let iter = 0; iter < maxIter; iter++) {
    const xm = 0.5 * (state.a + state.b)
    const tol1 = tol * Math.abs(state.x) + ZEPS
    if (Math.abs(state.x - xm) <= 2 * tol1 - 0.5 * (state.b - state.a)) break
    Object.assign(state, _chooseBrentStep(state, tol1))
    const u = Math.abs(state.d) >= tol1 ? state.x + state.d : state.x + sign(tol1, state.d)
    const fu = phi(u)
    Object.assign(state, _updateBrentState(state, u, fu))
  }
  return [state.x, state.fx]
}

// Minimises f along the line p + lambda * dir; returns the new point and its value.
function lineMin (f, p, dir, opts) {
  const f0 = f(p)
  const phi = lambda => f(p.map((pi, j) => pi + lambda * dir[j]))
  const [a, b, c] = bracketMin(phi, 0, 1)
  const [lambda, fret] = brentMin(phi, [a, b, c], opts)
  // Never take an uphill step: if the line search found nothing below the current point — e.g.
  // the whole line lies in the Infinity-barrier infeasible region — stay put. Without this guard
  // a degenerate all-Infinity bracket returns a nonzero lambda and the iterate drifts away.
  if (!(fret < f0)) {
    return { p, fret: f0 }
  }
  return { p: p.map((pi, j) => pi + lambda * dir[j]), fret }
}

// True when Powell's curvature test passes: the net direction warrants replacing the direction of
// largest drop. Only called after confirming fExtrap < fStart (short-circuit guard in powell).
function _powellCriterionMet (fStart, fret, fExtrap, biggestDrop) {
  return 2 * (fStart - 2 * fret + fExtrap) * (fStart - fret - biggestDrop) ** 2 -
    biggestDrop * (fStart - fExtrap) ** 2 < 0
}

// Minimises f along each direction in dirs, tracking which direction gave the largest decrease.
function _directionSweep (f, dirs, initial, opts) {
  let { p, fret } = initial
  let biggestDrop = 0
  let iBig = 0
  for (let i = 0; i < dirs.length; i++) {
    const fBefore = fret
    const res = lineMin(f, p, dirs[i], opts)
    p = res.p
    fret = res.fret
    if (fBefore - fret > biggestDrop) {
      biggestDrop = fBefore - fret
      iBig = i
    }
  }
  return { p, fret, biggestDrop, iBig }
}

/**
 * Minimises a function using Powell's conjugate-direction method.
 *
 * @method powell
 * @memberof ran.algorithms
 * @param {Function} f Objective function to minimise; accepts a number[] and returns number.
 * @param {number[]} x0 Initial parameter vector.
 * @param {Object} [opts] Options.
 * @param {number} [opts.tol=1e-8] Fractional tolerance on the objective value for convergence.
 * @param {number} [opts.maxIter=200] Maximum number of outer iterations.
 * @returns {number[]} Parameter vector at the approximate minimum.
 * @private
 */
export default function powell (f, x0, opts = {}) {
  const { tol = 1e-8, maxIter = 200 } = opts
  const n = x0.length
  let p = x0.slice()

  // Direction set initialised to the coordinate unit vectors.
  const dirs = Array.from({ length: n }, (_, i) => {
    const e = Array(n).fill(0)
    e[i] = 1
    return e
  })

  let fret = f(p)
  const lineOpts = { tol, maxIter }
  for (let iter = 0; iter < maxIter; iter++) {
    const pStart = p.slice()
    const fStart = fret
    const sweep = _directionSweep(f, dirs, { p, fret }, lineOpts)
    p = sweep.p
    fret = sweep.fret
    const { biggestDrop, iBig } = sweep

    // Convergence: relative decrease in the objective value falls below tolerance.
    if (2 * Math.abs(fStart - fret) <= tol * (Math.abs(fStart) + Math.abs(fret)) + TINY) {
      break
    }

    // Powell's update: try the extrapolated point and, if warranted, adopt the net direction
    // of this iteration as a new conjugate direction, discarding the one of largest decrease.
    const pExtrap = p.map((pi, j) => 2 * pi - pStart[j])
    const dirNew = p.map((pi, j) => pi - pStart[j])
    const fExtrap = f(pExtrap)
    if (fExtrap < fStart && _powellCriterionMet(fStart, fret, fExtrap, biggestDrop)) {
      const res = lineMin(f, p, dirNew, lineOpts)
      p = res.p
      fret = res.fret
      dirs[iBig] = dirs[n - 1]
      dirs[n - 1] = dirNew
    }
  }

  return p
}
