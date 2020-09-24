import { MAX_ITER, EPS } from './_core'
import newton from '../algorithms/newton'
import logGamma from './log-gamma'
import { gammaLowerIncomplete, gammaUpperIncomplete } from './gamma-incomplete'

/**
 * Series expansion of the Marcum-Q function. Section 3 in https://arxiv.org/pdf/1311.0681.pdf.
 *
 * @namespace _seriesExpansion
 * @memberof ran.special
 * @private
 */
const _seriesExpansion = {
  q (mu, x, y) {
    // Initialize terms with k = 0, Eq. (7)
    // ck = x^k / k!
    let ck = 1

    // qck = y^{mu + k - 1} e^{-y} / gamma(mu + k - 1)
    let qck = Math.exp((mu - 1) * Math.log(y) - y - logGamma(mu))

    // qk = Q_{mu + k}(y)
    let qk = gammaUpperIncomplete(mu, y)
    let dz = ck * qk
    let z = dz

    for (let k = 1; k < MAX_ITER; k++) {
      // Update coefficients
      // Eq. (18)
      qck *= y / (mu + k - 1)
      qk += qck
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
    const c0 = mu + logGamma(mu) - Math.log(2 * Math.PI * EPS)
    const c1 = Math.log(x * y)
    const c2 = x * y
    let n = newton(
      t => (t + mu) * Math.log(t + mu) + t * Math.log(t) - 2 * t - t * c1 - c0,
      t => Math.log(t * (t + mu) / c2),
      0.5 * (Math.sqrt(mu * mu + 4 * x * y) - mu) + 1
    )
    n = Math.ceil(n)

    // Initialize terms with last index, Eq. (7)
    // ck = x^k / k!
    let ck = Math.exp(n * Math.log(x) - logGamma(n + 1))

    // qck = y^{mu + k} e^{-y} / gamma(mu + k)
    let pck = Math.exp((mu + n) * Math.log(y) - y - logGamma(mu + n + 1))

    // pk = P_{\mu + k}(y)
    let pk = gammaLowerIncomplete(mu + n, y)
    let dz = ck * pk
    let z = dz

    for (let k = n - 1; k >= 0; k--) {
      // Update coefficients
      // Eq. (19)
      pck *= (mu + k + 1) / y
      pk += pck
      ck *= (k + 1) / x
      dz = ck * pk

      // Update sum
      z += dz
    }

    return 1 - Math.exp(-x) * z
  }
}

/**
 * Asymptotic expansion for large xi. Section 4.1 in https://arxiv.org/pdf/1311.0681.pdf.
 *
 * @namespace _seriesExpansion
 * @memberof ran.special
 * @private
 */
/* const _asymptoticExpansionLargeXi = (function() {
  function _aelx(mu, x, y, complementary) {
    // Calculate scale variables
    let xi = 2 * Math.sqrt(x * y)
    let sigma = Math.pow(Math.sqrt(y) - Math.sqrt(x), 2) / xi
    let rho = Math.sqrt(y / x)

    // am = A_n(mu)
    // am1 = A_n(mu - 1)
    let am = 1
    let am1 = 1

    // phic = e^{-sigma xi} xi^{-n + 1/2}
    let phic = Math.exp(-sigma * xi) * Math.sqrt(xi)
    let phi = Math.sqrt(Math.PI / sigma) * erfc(Math.sqrt(y) - Math.sqrt(x))

    // psic = (-1)^n rho^mu / (2 sqrt(pi))
    let psic = 0.5 * Math.pow(rho, mu) / Math.sqrt(2 * Math.PI)
    let psi = complementary ? 0.5 * Math.pow(rho, mu - 0.5) * erfc(Math.sqrt(y) - Math.sqrt(x)) : psic * (am1 - am / rho) * phi
    let z = psi

    // TODO Reverse iteration: n0 = sigma * xi and backwards for numerical stability
    for (let n = 1; n < MAX_ITER; n++) {
      // A_n(mu) and A_n(mu - 1)
      am *= -(Math.pow(2 * n - 1, 2) - 4 * mu * mu) / (8 * n)
      am1 *= -(Math.pow(2 * n - 1, 2) - 4 * (mu - 1) * (mu - 1)) / (8 * n)

      // Phi
      phic /= xi
      phi = (phic - sigma * phi) / (n - 0.5)

      // Psi
      psic *= -1
      psi = psic * (am1 - am / rho) * phi

      // Update Q or P
      z = complementary ? z - psi : z + psi

      // Check if we should stop
      if (Math.abs(psi) / z < EPS) { break }
    }

    return z
  }

  return {
    q (mu, x, y) {
      return _aelx(mu, x, y, false)
    },

    p (mu, x, y) {
      return 1 - _aelx(mu, x, y, true)
    }
  }
})() */

/**
 * Recurrence relation evaluation.
 *
 * @namespace _recurrence
 * @memberof ran.special
 * @private
 */
/* const _recurrence = (function() {
  function _fc(pnu, z) {
    let m = 0
    let b = 2 * pnu / z
    let a = 1
    let res = DELTA
    let c0 = res
    let d0 = 0
    let delta = 0
    do {
      d0 = b + a * d0
      if (Math.abs(d0) < DELTA){
        d0 = DELTA
      }
      c0 = b + a / c0
      if (Math.abs(c0) < DELTA) {
        c0 = DELTA
      }
      d0 = 1 / d0
      delta = c0 * d0
      res = res * delta
      m = m + 1
      a = 1
      b = 2 * (pnu + m) / z
    } while (Math.abs(delta - 1) > EPS)
    return res
  }

  function _pqTrap(mu, x, y, p, q, ierr) {
    let xs = x / mu
    let ys = y / mu
    let xis2 = 4 * xs * ys
    let wxis = Math.sqrt(1 + xis2)
    let a = 0
    let b= 3
    let epstrap = 1e-13
    let pq = _trap(a, b, epstrap, xis2, mu, wxis, ys)
    let zeta = _zetaxy(xs, ys)
    if ((-mu * 0.5 * zeta * zeta) < Math.log(DELTA)) {
      if (y > x + mu) {
        return {
          q: 0,
          p: 1
        }
      } else {
        return {
          q: 1,
          p: 0
        }
      }
    } else {
      pq = pq * Math.exp(-mu * 0.5 * zeta * zeta) / Math.PI
      if (zeta < 0) {
        return {
          q: pq,
          p: 1 - pq
        }
      } else {
        return {
          q: 1 + pq,
          p: -pq
        }
      }
    }
  }

  return {
    q(mu, x, y) {
      return undefined
    },

    p(mu, x, y) {
      let b = 1
      let nu = y - x + b * b + b * Math.sqrt(2 * (x + y) + b * b)
      let n1 = Math.floor(mu)
      let n2 = Math.floor(nu) + 2
      let n3 = n2 - n1
      let mur = mu + n3
      let xi = 2 * Math.sqrt(x * y)
      let cmu = Math.sqrt(y / x) * _fc(mur, xi)
      let p1 = _pqTrap(mur, x, y)
      let p0 = _pqTrap(mur, x, y)
      let z = 0
      for (let n = 0; n < n3 - 1; n++) {
        z = ((1 + cmu) * p0 - p1) / cmu
        p1 = p0
        p0 = z
        cmu = y / (mur - n - 1 + x * cmu)
      }
      return 1 - z
    }
  }
})() */

/**
 * Computes the generalized Marcum-Q function. Only accurate in x < 30.
 * Implementation source: https://arxiv.org/pdf/1311.0681.pdf.
 *
 * @method marcumQ
 * @memberof ran.special
 * @param {number} mu The order of the function.
 * @param {number} x First variable.
 * @param {number} y Second variable.
 * @return {?number} The generalized Marcum-Q function at the specified values. If evaluated at an unsupported point, it
 * returns undefined.
 * @private
 */
export default function (mu, x, y) {
  // Pick primary function
  const primary = y > x + mu ? 'q' : 'p'
  // console.log(primary)

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
    return _asymptoticExpansionLargeXi[primary](mu, x, y)
  }

  /*let s = Math.sqrt(4 * x + 2 * mu)
  let f1 = x + mu - s
  let f2 = x + mu + s
  if (f1 < y && y < f2) {
    if (mu < 135) {
      // TODO recurrence relations
      console.log('recurrence')
      return _recurrence[primary](mu, x, y)
    } else {
      // TODO asymptotic expansion
      console.log('asymptotic large mu')
      return undefined
    }
  }
  console.log('integral')

  // Integral
  return undefined */
}
