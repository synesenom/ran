import { MAX_ITER, EPS } from './_core'
import newton from '../algorithms/newton'
import gamma from './gamma'
import gammaLn from './gamma-log'
import { gammaLowerIncomplete, gammaUpperIncomplete } from './gamma-incomplete'
import { besselI } from './bessel'

/**
 * Series expansion of the Marcum-Q function.
 *
 * @namespace _seriesExpansion
 * @memberOf ran.special
 * @private
 */
const _seriesExpansion = {
  q (mu, x, y) {
    // Initialize terms with k = 0, Eq. (7)
    // ck = x^k / k!
    let ck = 1

    // qck = y^{mu + k - 1} e^{-y} / gamma(mu + k - 1)
    let qck = Math.exp((mu - 1) * Math.log(y) - y - gammaLn(mu))

    // qk = Q_{mu + k}(y)
    let qk = gammaUpperIncomplete(mu, y)
    let dz = ck * qk
    let z = dz

    for (let k = 1; k < MAX_ITER; k++) {
      // Update coefficients
      // Eq. (18)
      qck *= y / (mu + k - 1)
      qk = qk + qck
      ck *= x / k
      dz = ck * qk

      // Update sum
      z += dz

      // Check if we should stop
      if (dz / z < EPS) { break }
    }

    return Math.exp(-x) * z
  },

  p (mu, x, y) {
    // Find truncation number using Eqs. (26) - (27)
    // Define some constants to speed up search
    let c0 = mu + gammaLn(mu) - Math.log(2 * Math.PI * EPS)
    let c1 = Math.log(x * y)
    let c2 = x * y
    let n = newton(
      t => (t + mu) * Math.log(t + mu) + t * Math.log(t) - 2 * t - t * c1 - c0,
      t => Math.log(t * (t + mu) / c2),
      0.5 * (Math.sqrt(mu * mu + 4 * x * y) - mu) + 1
    )
    n = Math.ceil(n)

    // Initialize terms with last index, Eq. (7)
    // ck = x^k / k!
    let ck = Math.exp(n * Math.log(x) - gammaLn(n + 1))

    // qck = y^{mu + k} e^{-y} / gamma(mu + k)
    let pck = Math.exp((mu + n) * Math.log(y) - y - gammaLn(mu + n + 1))

    // pk = P_{\mu + k}(y)
    let pk = gammaLowerIncomplete(mu + n, y)
    let dz = ck * pk
    let z = dz

    for (let k = n - 1; k >= 0; k--) {
      // Update coefficients
      // Eq. (19)
      pck *= (mu + k + 1) / y
      pk = pk + pck
      ck *= (k + 1) / x
      dz = ck * pk

      // Update sum
      z += dz
    }

    return 1 - Math.exp(-x) * z
  }
}

const _asymptoticExpansionLargeXi = {
  q (mu, x, y) {
    let xi = 2 * Math.sqrt(x * y)
    let sigma = Math.pow(Math.sqrt(y) - Math.sqrt(x), 2) / xi
    let rho = Math.sqrt(y / x)
  },

  p (mu, x, y) {

  }
}

/**
 * Computes the generalized Marcum-Q function. Only accurate in x < 30. Implementation source: https://arxiv.org/pdf/1311.0681.pdf.
 *
 * @method marcumQ
 * @memberOf ran.special
 * @param {number} mu The order of the function.
 * @param {number} x First variable.
 * @param {number} y Second variable.
 * @return {?number} The generalized Marcum-Q function at the specified values. If evaluated at an unsupported point, it returns null.
 * @private
 */
export function marcumQ (mu, x, y) {
  // Pick primary function
  let primary = y > x + mu ? 'q' : 'p'

  // Special cases
  if (y === 0) {
    return 1
  }
  if (x === 0) {
    return gammaUpperIncomplete(mu, y)
  }

  // Series expansion
  // if (x < 30) {
  return _seriesExpansion[primary](mu, x, y)
  // }

  // Asymptotic expansion
  /* let xi = 2 * Math.sqrt(x * y)
  if (xi > 30 && mu * mu < 2 * xi) {
    console.log('asymptotic 1')
    // TODO asymptotic expansion
    return null
  }

  let s = Math.sqrt(4 * x + 2 * mu)
  let f1 = x + mu - s
  let f2 = x + mu + s
  if (f1 < y && y < f2) {
    if (mu < 135) {
      // TODO recurrence relations
      console.log('recurrence')
      return null
    } else {
      // TODO asymptotic expansion
      console.log('asymptotic 2')
      return null
    }
  }
  console.log('integral')

  // Integral
  return null */
}

/*export function marcumQyInv (mu, x, q) {
  return newton(
    t => marcumQ(mu, x, t) - q,
    t => -Math.pow(t / x, (mu - 1) / 2) * Math.exp(-x - t) * besselI(mu - 1, 2 * Math.sqrt(x * t)),
    1
  )
}*/
