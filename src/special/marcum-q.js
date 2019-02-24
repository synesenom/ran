import { MAX_ITER, EPS } from './_core'
import newton from '../algorithms/newton'
import gammaLn from './gamma-log'
import { gammaLowerIncomplete, gammaUpperIncomplete } from './gamma-incomplete'

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
    // qk = Q_{mu + k}(y)
    let ck = 1
    let qk = gammaUpperIncomplete(mu, y)
    let dz = ck * qk
    let z = dz

    for (let k = 1; k < MAX_ITER; k++) {
      // Update coefficients
      // Eq. (18)
      qk = qk + Math.exp((mu + k - 1) * Math.log(y) - y - gammaLn(mu + k))
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
    let n = newton(
      t => (t + mu) * Math.log(t + mu) + t * Math.log(t) - 2 * t - t * Math.log(x * y) - mu - gammaLn(mu) + Math.log(2 * Math.PI * EPS),
      t => Math.log(t * (t + mu) / (x * y)),
      0.5 * (Math.sqrt(mu * mu + 4 * x * y) - mu) + 1
    )
    n = Math.ceil(n)

    // Initialize terms with last index, Eq. (7)
    // ck = x^k / k!
    // pk = P_{\mu + k}(y)
    let ck = Math.exp(n * Math.log(x) - gammaLn(n + 1))
    let pk = gammaLowerIncomplete(mu + n, y)
    let dz = ck * pk
    let z = dz

    for (let k = n - 1; k >= 0; k--) {
      // Update coefficients
      // Eq. (19)
      pk = pk + Math.exp((mu + k) * Math.log(y) - y - gammaLn(mu + k + 1))
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
};

/**
 * Computes the generalized Marcum-Q function. Currently only x < 30 values are reliable. We use the definition as given in Eq. (1) in https://arxiv.org/pdf/1311.0681.pdf.
 *
 * @method marcumQ
 * @memberOf ran.special
 * @param {number} mu The order of the function.
 * @param {number} x First variable.
 * @param {number} y Second variable.
 * @return {?number} The generalized Marcum-Q function at the specified values. If evaluated at an unsupported point, it returns null.
 */
export default function (mu, x, y) {
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
    // TODO asymptotic expansion
    return null
  }

  let s = Math.sqrt(4 * x + 2 * mu)
  let f1 = x + mu - s
  let f2 = x + mu + s
  if (f1 < y && y < f2) {
    if (mu < 135) {
      // TODO recurrence relations
      return null
    } else {
      // TODO asymptotic expansion
      return null
    }
  }

  // Integral
  return null */
}
