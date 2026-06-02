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
    // Parabolic extrapolation through a, b, c.
    const r = (b - a) * (fb - fc)
    const q = (b - c) * (fb - fa)
    let u = b - ((b - c) * q - (b - a) * r) / (2 * sign(Math.max(Math.abs(q - r), TINY), q - r))
    const ulim = b + GLIMIT * (c - b)
    let fu
    if ((b - u) * (u - c) > 0) {
      // Parabolic minimum between b and c.
      fu = phi(u)
      if (fu < fc) {
        return [b, u, c]
      } else if (fu > fb) {
        return [a, b, u]
      }
      u = c + GOLD * (c - b)
      fu = phi(u)
    } else if ((c - u) * (u - ulim) > 0) {
      // Parabolic minimum between c and its allowed limit.
      fu = phi(u)
      if (fu < fc) {
        b = c
        c = u
        u = c + GOLD * (c - b)
        fb = fc
        fc = fu
        fu = phi(u)
      }
    } else if ((u - ulim) * (ulim - c) >= 0) {
      // Limit parabolic u to its maximum allowed value.
      u = ulim
      fu = phi(u)
    } else {
      // Reject parabolic u, use default magnification.
      u = c + GOLD * (c - b)
      fu = phi(u)
    }
    a = b
    b = c
    c = u
    fa = fb
    fb = fc
    fc = fu
  }
  return [a, b, c]
}

/**
 * Minimises a 1-D function within a bracket using Brent's method (parabolic interpolation with a
 * golden-section fallback).
 *
 * @param {Function} phi 1-D function to minimise.
 * @param {number} ax Lower bracket abscissa.
 * @param {number} bx Interior abscissa with the lowest value.
 * @param {number} cx Upper bracket abscissa.
 * @param {number} tol Fractional tolerance on the abscissa.
 * @param {number} maxIter Maximum iterations.
 * @returns {number[]} [xmin, fmin].
 * @private
 */
function brentMin (phi, ax, bx, cx, tol, maxIter) {
  let a = Math.min(ax, cx)
  let b = Math.max(ax, cx)
  let x = bx
  let w = bx
  let v = bx
  let fx = phi(x)
  let fw = fx
  let fv = fx
  let d = 0
  let e = 0
  for (let iter = 0; iter < maxIter; iter++) {
    const xm = 0.5 * (a + b)
    const tol1 = tol * Math.abs(x) + ZEPS
    const tol2 = 2 * tol1
    if (Math.abs(x - xm) <= tol2 - 0.5 * (b - a)) {
      break
    }
    if (Math.abs(e) > tol1) {
      // Trial parabolic fit through x, w, v.
      const r = (x - w) * (fx - fv)
      let q = (x - v) * (fx - fw)
      let p = (x - v) * q - (x - w) * r
      q = 2 * (q - r)
      if (q > 0) {
        p = -p
      }
      q = Math.abs(q)
      const etemp = e
      e = d
      if (Math.abs(p) >= Math.abs(0.5 * q * etemp) || p <= q * (a - x) || p >= q * (b - x)) {
        // Parabolic step unacceptable: take a golden-section step instead.
        e = x >= xm ? a - x : b - x
        d = CGOLD * e
      } else {
        // Accept the parabolic step.
        d = p / q
        const u = x + d
        if (u - a < tol2 || b - u < tol2) {
          d = sign(tol1, xm - x)
        }
      }
    } else {
      e = x >= xm ? a - x : b - x
      d = CGOLD * e
    }
    const u = Math.abs(d) >= tol1 ? x + d : x + sign(tol1, d)
    const fu = phi(u)
    if (fu <= fx) {
      if (u >= x) {
        a = x
      } else {
        b = x
      }
      v = w
      w = x
      x = u
      fv = fw
      fw = fx
      fx = fu
    } else {
      if (u < x) {
        a = u
      } else {
        b = u
      }
      if (fu <= fw || w === x) {
        v = w
        w = u
        fv = fw
        fw = fu
      } else if (fu <= fv || v === x || v === w) {
        v = u
        fv = fu
      }
    }
  }
  return [x, fx]
}

// Minimises f along the line p + lambda * dir; returns the new point and its value.
function lineMin (f, p, dir, tol, maxIter) {
  const f0 = f(p)
  const phi = lambda => f(p.map((pi, j) => pi + lambda * dir[j]))
  const [a, b, c] = bracketMin(phi, 0, 1)
  const [lambda, fret] = brentMin(phi, a, b, c, tol, maxIter)
  // Never take an uphill step: if the line search found nothing below the current point — e.g.
  // the whole line lies in the Infinity-barrier infeasible region — stay put. Without this guard
  // a degenerate all-Infinity bracket returns a nonzero lambda and the iterate drifts away.
  if (!(fret < f0)) {
    return { p, fret: f0 }
  }
  return { p: p.map((pi, j) => pi + lambda * dir[j]), fret }
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
  for (let iter = 0; iter < maxIter; iter++) {
    const pStart = p.slice()
    const fStart = fret
    let biggestDrop = 0
    let iBig = 0

    // Minimise along each direction in turn, tracking the direction of largest decrease.
    for (let i = 0; i < n; i++) {
      const fBefore = fret
      const res = lineMin(f, p, dirs[i], tol, maxIter)
      p = res.p
      fret = res.fret
      if (fBefore - fret > biggestDrop) {
        biggestDrop = fBefore - fret
        iBig = i
      }
    }

    // Convergence: relative decrease in the objective value falls below tolerance.
    if (2 * Math.abs(fStart - fret) <= tol * (Math.abs(fStart) + Math.abs(fret)) + TINY) {
      break
    }

    // Powell's update: try the extrapolated point and, if warranted, adopt the net direction
    // of this iteration as a new conjugate direction, discarding the one of largest decrease.
    const pExtrap = p.map((pi, j) => 2 * pi - pStart[j])
    const dirNew = p.map((pi, j) => pi - pStart[j])
    const fExtrap = f(pExtrap)
    if (fExtrap < fStart) {
      const t = 2 * (fStart - 2 * fret + fExtrap) * (fStart - fret - biggestDrop) ** 2 -
        biggestDrop * (fStart - fExtrap) ** 2
      if (t < 0) {
        const res = lineMin(f, p, dirNew, tol, maxIter)
        p = res.p
        fret = res.fret
        dirs[iBig] = dirs[n - 1]
        dirs[n - 1] = dirNew
      }
    }
  }

  return p
}
