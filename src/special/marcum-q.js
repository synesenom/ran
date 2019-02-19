import { MAX_ITER, EPS } from './_core'
import gammaLn from './gamma-log'
import { gammaLowerIncomplete, gammaUpperIncomplete } from './gamma-incomplete'

function _qSeries (mu, x, y) {
  let ck = 1
  let qk = gammaUpperIncomplete(mu, y)
  let dz = ck * qk
  let z = dz

  for (let k = 1; k < MAX_ITER; k++) {
    // Update coefficients and Q
    qk = qk + Math.exp(mu * Math.log(y) - y - gammaLn(mu + 1))
    ck *= x / k
    dz = ck * qk
    z += dz

    // Check if we should stop
    if (dz < EPS) { break }
  }

  return Math.exp(-x) * z
}

/* function _pSeries (mu, x, y) {
  let n = 30
  let ck = 1
  let pk = gammaLowerIncomplete(mu + n + 1, y)
  let dz = ck * pk
  let z = dz

  for (let k = n; k > 0; k--) {
    // Update coefficients and P
    pk = pk + Math.exp((mu + k) * Math.log(y) - y - gammaLn(mu + k + 1))
    ck *=
  }
} */

export default function (mu, x, y) {
  // Pick primary function
  if (y > x + mu) {
    return _qSeries(mu, x, y)
  } else {
    return 0 // 1 - _pSeries(mu, x, y)
  }
}
