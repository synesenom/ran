/*import recursiveSum from '../algorithms/recursive-sum'
import logGamma from './log-gamma'
// TODO Implementation: https://people.maths.ox.ac.uk/porterm/papers/hypergeometric-final.pdf


function _f11TaylorSeries(a, b, z) {
  // Replace with faster method (Method b)
  return 1 + recursiveSum({
    a: a * z / b
  }, (t, i) => {
    t.a *= (a + i) * z / ((b + i) * (i + 1))
    console.log(t.a)
    return t
  }, t => t.a)
}

function _f11AsymptoticSeries(a, b, z) {
  return Math.exp(z + (a - b) * Math.log(z) + logGamma(b) - logGamma(a)) * recursiveSum({
    c: (b - a) * (1 - a) / z
  }, (t, i) => {
    t.c *= (b - a + i) * (1 - a + i) / (i * z)
    return t
  }, t => t.c)
}

export function f11(a, b, z) {
  return _f11TaylorSeries(a, b, z)
}*/