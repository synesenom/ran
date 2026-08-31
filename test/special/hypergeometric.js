import { assert } from 'chai'
import { describe, it } from 'mocha'
import { equal } from '../test-utils.js'
import * as special from '../../src/special/index.js'

describe('special.hypergeometric', () => {
  describe('.f11()', () => {
    const checkBesselIdentity = (aVals, zVals) => {
      for (const a of aVals) {
        for (const z of zVals) {
          assert(equal(
            special.f11(a, 2 * a, z),
            Math.exp(z / 2 + (0.5 - a) * Math.log(z / 4) + special.logGamma(a + 0.5)) * special.besselInu(a - 0.5, z / 2)
          ))
        }
      }
    }

    const checkF11Recurrence = (aVals, bVals, zVals) => {
      for (const a of aVals) {
        for (const b of bVals) {
          for (const z of zVals) {
            assert(equal(
              a * special.f11(a + 1, b, z),
              (b - a) * special.f11(a - 1, b, z) + (2 * a - b + z) * special.f11(a, b, z)
            ))
          }
        }
      }
    }

    describe('|z| < 50', () => {
      it('f11(0, b, z) = 1', () => {
        for (const b of [0.5, 1, 2]) {
          for (const z of [0, 1, 10, 40]) {
            assert(equal(special.f11(0, b, z), 1))
          }
        }
      })

      it('f11(b, b, z) = exp(z)', () => {
        for (const b of [0.5, 1, 2]) {
          for (const z of [0, 1, 10, 40]) {
            assert(equal(special.f11(b, b, z), Math.exp(z)))
          }
        }
      })

      it('f11(2, 1, z) = (1 + z) * exp(z)', () => {
        for (const z of [0, 1, 10, 40]) {
          assert(equal(special.f11(2, 1, z), (1 + z) * Math.exp(z)))
        }
      })

      it('f11(1, 2, z) = (exp(z) - 1) / z', () => {
        for (const z of [1, 10, 40]) {
          assert(equal(special.f11(1, 2, z), (Math.exp(z) - 1) / z))
        }
      })

      it('(2z / sqrt(pi)) * f11(0.5, 1.5, -z^2) = erf(z)', () => {
        for (const z of [0.1, 0.5, 1]) {
          assert(equal(2 * z * special.f11(0.5, 1.5, -z * z) / Math.sqrt(Math.PI), special.erf(z)))
        }
      })

      it('f11(a, 2a, z) = exp(z/2) (z/4)^(0.5 - a) gamma(a + 0.5) I(a - 0.5; z/2)', () => {
        checkBesselIdentity([0.5, 1, 2], [1, 10, 40])
      })

      it('a f11(a+1, b, z) = (b - a) f11(a-1, b, z) + (2a - b + z) f11(a, b, z)', () => {
        checkF11Recurrence([0.5, 1, 2], [0.5, 1, 2], [0, 1, 10, 40])
      })

      it('f11(1, 2, 49) = (exp(49) - 1) / 49 at 12-digit precision', () => {
        // Taylor series requires ~115 terms to converge at z=49; would fail at 10-digit precision with MAX_ITER=100.
        assert(equal(special.f11(1, 2, 49), (Math.exp(49) - 1) / 49, 12))
      })
    })

    describe('|z| >= 50', () => {
      it('f11(0, b, z) = 1', () => {
        for (const b of [0.5, 1, 2]) {
          for (const z of [50, 60, 75, 90]) {
            assert(equal(special.f11(0, b, z), 1))
          }
        }
      })

      it('f11(b, b, z) = exp(z)', () => {
        for (const b of [0.5, 1, 2]) {
          for (const z of [50, 60, 75, 90]) {
            assert(equal(special.f11(b, b, z), Math.exp(z)))
          }
        }
      })

      it('f11(2, 1, z) = (1 + z) * exp(z)', () => {
        for (const z of [50, 60, 75, 90]) {
          assert(equal(special.f11(2, 1, z), (1 + z) * Math.exp(z)))
        }
      })

      it('f11(1, 2, z) = (exp(z) - 1) / z', () => {
        for (const z of [50, 60, 75, 90]) {
          assert(equal(special.f11(1, 2, z), (Math.exp(z) - 1) / z))
        }
      })

      it('f11(a, 2a, z) = exp(z/2) (z/4)^(0.5 - a) gamma(a + 0.5) I(a - 0.5; z/2)', () => {
        checkBesselIdentity([0.5, 1, 2], [50, 60, 75, 90])
      })

      it('a * f11(a+1, b, z) = (b - a) * f11(a-1, b, z) + (2a - b + z) * f11(a, b, z)', () => {
        checkF11Recurrence([3, 7, 13], [3, 7, 13], [50, 60, 75, 90])
      })

      it('f11(1, 2, 50) = (exp(50) - 1) / 50', () => {
        assert(equal(special.f11(1, 2, 50), (Math.exp(50) - 1) / 50))
      })

      it('f11(1, 2, 100) = (exp(100) - 1) / 100', () => {
        assert(equal(special.f11(1, 2, 100), (Math.exp(100) - 1) / 100))
      })
    })

    describe('b <= 0 integer (pole)', () => {
      it('diverges to +Infinity, not an arbitrarily-signed Infinity, for b = 0, -1, -2', () => {
        // (b)_k Pochhammer denominator hits zero mid-recurrence at a non-positive integer b;
        // without an explicit guard this used to fall through to an unguarded division by zero
        // producing a sign that depended on b's parity (+Infinity at b=0, -Infinity at b=-1,
        // +Infinity at b=-2) rather than this codebase's established pole convention (gamma.js,
        // logGamma.js, riemannZeta.js, hurwitzZeta.js all diverge to +Infinity at their poles).
        for (const b of [0, -1, -2, -5]) {
          assert.strictEqual(special.f11(1, b, 3), Infinity)
        }
      })
    })
  })
})
