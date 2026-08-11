import { assert } from 'chai'
import { describe, it } from 'mocha'
import { equal } from '../test-utils.js'
import * as special from '../../src/special/index.js'

describe('special.lambertW', () => {
  describe('.lambertW0()', () => {
    it('should return NaN for z < -1/e', () => {
      assert(isNaN(special.lambertW0(-1)))
      assert(isNaN(special.lambertW0(-0.5)))
      assert(isNaN(special.lambertW0(-Math.exp(-1) - 1e-10)))
    })

    it('should return -1 at the branch point z = -1/e', () => {
      assert(Math.abs(special.lambertW0(-Math.exp(-1)) + 1) < 1e-6)
    })

    it('should return 0 at z = 0', () => {
      assert(special.lambertW0(0) === 0)
    })

    it('should return 1 at z = e', () => {
      assert(equal(special.lambertW0(Math.E), 1))
    })

    it('should satisfy the W * exp(W) = x equation for x >= 0', () => {
      for (const x of [0, 1e-10, 0.1, 1, Math.E, 5, 10]) {
        const w = special.lambertW0(x)
        assert(equal(w * Math.exp(w), x))
      }
    })

    it('should satisfy the W * exp(W) = x equation for x in [-1/e, 0)', () => {
      for (const x of [-1e-6, -0.1, -0.2, -1 / Math.E + 1e-10]) {
        const w = special.lambertW0(x)
        assert(equal(w * Math.exp(w), x))
      }
    })
  })

  describe('.lambertW1m()', () => {
    it('should return NaN for z < -1/e', () => {
      assert(isNaN(special.lambertW1m(-1)))
      assert(isNaN(special.lambertW1m(-0.5)))
      assert(isNaN(special.lambertW1m(-Math.exp(-1) - 1e-10)))
    })

    it('should return NaN for z >= 0', () => {
      assert(isNaN(special.lambertW1m(0)))
      assert(isNaN(special.lambertW1m(1)))
      assert(isNaN(special.lambertW1m(0.1)))
    })

    it('should return -1 at the branch point z = -1/e', () => {
      assert(Math.abs(special.lambertW1m(-Math.exp(-1)) + 1) < 1e-6)
    })

    it('should return known value at z = -0.1', () => {
      assert(equal(special.lambertW1m(-0.1), -3.577152063957297))
    })

    it('should satisfy the W * exp(W) = x equation', () => {
      for (const x of [-1e-6, -0.1, -0.2, -1 / Math.E + 1e-10]) {
        const w = special.lambertW1m(x)
        assert(equal(w * Math.exp(w), x))
      }
    })

    it('should return known values near the branch cut', () => {
      assert(equal(special.lambertW1m(-0.2), -2.5426413577735265))
      assert(equal(special.lambertW1m(-0.05), -4.499755288523487))
    })

    it('should satisfy W * exp(W) = z near the branch cut (z in [-1/e, -0.1])', () => {
      for (const x of [-0.15, -0.2, -0.3, -1 / Math.E + 1e-10]) {
        const w = special.lambertW1m(x)
        assert(equal(w * Math.exp(w), x))
      }
    })
  })
})
