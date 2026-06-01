import recursiveSum from '../algorithms/recursive-sum'
import logGamma from './log-gamma'
// TODO Implementation: https://people.maths.ox.ac.uk/porterm/papers/hypergeometric-final.pdf

/* function _isInteger (x) {
  return Math.abs(Math.floor(x) - x) < Number.EPSILON
} */

function _f11TaylorSeries (a, b, z) {
  // Replace with faster method (Method b)
  return 1 + recursiveSum({
    a: a * z / b
  }, (t, i) => {
    t.a *= (a + i) * z / ((b + i) * (i + 1))
    return t
  }, t => t.a)
}

function _f11AsymptoticSeries (a, b, z) {
  const prefactor = Math.exp(z + (a - b) * Math.log(z) + logGamma(b) - logGamma(a))

  // When terms decrease from the outset (|ratio₀| < 1) the series reaches its
  // minimum around s ≈ z and then diverges.  EPS-based stopping can miss this
  // because the minimum term may sit just above the EPS·sum threshold, causing
  // recursiveSum to run all MAX_ITER iterations and accumulate the diverging
  // tail.  In this regime truncate at the minimum term instead.
  if (Math.abs((b - a) * (1 - a)) <= z) {
    let term = 1
    let sum = 1
    for (let s = 0; s < 100; s++) {
      const next = term * (b - a + s) * (1 - a + s) / ((s + 1) * z)
      if (Math.abs(next) >= Math.abs(term)) break
      term = next
      sum += term
      if (Math.abs(term) < Number.EPSILON * Math.max(Math.abs(sum), 1)) break
    }
    return prefactor * sum
  }

  // When |ratio₀| > 1 terms grow until the Pochhammer factor (1-a+s) passes
  // through its near-zero at s = a-1, after which they collapse and EPS fires.
  const s = 1 + recursiveSum({
    c: (b - a) * (1 - a) / z
  }, (t, i) => {
    t.c *= (b - a + i) * (1 - a + i) / ((i + 1) * z)
    return t
  }, t => t.c)
  return prefactor * s
}

/* function _f21TaylorSeries (a, b, c, z) {
  return 1 + recursiveSum({
    c: a * b * z / c
  }, (t, i) => {
    t.c *= (a + i) * (b + i) * z / ((c + i) * (i + 1))
    return t
  }, t => t.c)
} */

export function f11 (a, b, z) {
  // Special cases
  if (Math.abs(a) < Number.EPSILON) {
    return 1
  }

  if (Math.abs(z) < 50) {
    return _f11TaylorSeries(a, b, z)
  } else {
    return _f11AsymptoticSeries(a, b, z)
  }
}

/* function f21 (a, b, c, z) {
  // 15.3.8 in Abramowitz & Stegun
  // TODO Handle a - b
  if (z < -1) {
    let y = 1 / (1 - z)
    let f1 = Math.exp(-a * Math.log(1 - z) + logGamma(c) + logGamma(b - a) - logGamma(b) - logGamma(c - a)) * _f21TaylorSeries(a, c - b, a - b + 1, y)
    let f2 = Math.exp(-b * Math.log(1 - z) + logGamma(c) + logGamma(a - b) - logGamma(a) - logGamma(c - b)) * _f21TaylorSeries(b, c - a, b - a + 1, y)
    return f1 + f2
  }

  // 15.3.4 in Abramowitz & Stegun
  if (z < 0) {
    return Math.pow(1 - z, -a) * _f21TaylorSeries(a, c - b, c, z / (1 - z))
  }

  // z -> z
  if (z <= 0.5) {
    return _f21TaylorSeries(a, b, c, z)
  }

  if (z <= 1) {
    // Eq. (4.7): z -> 1 - z
    let y = 1 - z
    let d = c - a - b
    let f1 = Math.exp(-logGamma(c - a) - logGamma(c - b)) * _f21TaylorSeries(a, b, 1 - d, y)
    let f2 = Math.exp(d * Math.log(y) - logGamma(a) - logGamma(b)) * _f21TaylorSeries(c - a, c - b, d + 1, y)
    return Math.PI * (f1 + f2) / Math.sin(Math.PI * d)
  }

  if (z <= 2) {
    // Eq. (4.8): z -> 1 - 1 / z
    let y = 1 - 1 / z
    let d = c - a - b
    let f1 = Math.pow(z, -a) * Math.exp(-logGamma(c - a) - logGamma(c - b)) * _f21TaylorSeries(a, a - c + 1, 1 - d, y)
    let f2 = Math.pow(1 - z, d) * Math.exp((a - c) * Math.log(z) - logGamma(a) - logGamma(b)) * _f21TaylorSeries(c - a, 1 - a, d + 1, y)
    return Math.PI * (f1 + f2) / Math.sin(Math.PI * d)
  }

  // Eq. (4.9): z -> 1 / z
  let y = 1 / z
  let f1 = Math.pow(-z, -a) * Math.exp(-logGamma(b) - logGamma(c - a)) * _f21TaylorSeries(a, a - c + 1, a - b + 1, y)
  let f2 = Math.pow(-z, -b) * Math.exp(-logGamma(z) - logGamma(c - b)) * _f21TaylorSeries(b - c + 1, b, b - a + 1, y)
  return Math.PI * (f1 + f2)  / Math.sin(Math.PI * (b - a))
} */
