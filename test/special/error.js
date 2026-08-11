import { assert } from 'chai'
import { describe, it } from 'mocha'
import { equal } from '../test-utils.js'
import * as special from '../../src/special/index.js'

describe('special.error', () => {
  const checkReferenceValues = (fn, cases) => {
    cases.forEach(d => {
      assert(equal(fn(d.x), d.y), `${fn.name}(${d.x})`)
    })
  }

  describe('.erf()', () => {
    it('should return reference values', () => {
      assert(special.erf(0) === 0)
      checkReferenceValues(special.erf, [
        { x: 0.5, y: 0.5204998778130465 },
        { x: 1.0, y: 0.8427007929497149 },
        { x: 1.5, y: 0.9661051464753108 },
        { x: 2.0, y: 0.9953222650189527 },
        { x: 3.0, y: 0.9999779095030014 },
        { x: 5.0, y: 0.9999999999984626 }
      ])
    })

    it('should satisfy erf(-x) = -erf(x)', () => {
      [0.5, 2, 5].forEach(x => {
        assert(equal(special.erf(-x), -special.erf(x)), `erf(-${x})`)
      })
    })
  })

  describe('.erfc()', () => {
    it('should return reference values', () => {
      assert(special.erfc(0) === 1)
      checkReferenceValues(special.erfc, [
        { x: 0.5, y: 0.4795001221869535 },
        { x: 1.0, y: 0.1572992070502851 },
        { x: 2.0, y: 0.004677734981047265 },
        { x: 3.0, y: 2.209049699858544e-5 },
        { x: 5.0, y: 1.537459794428035e-12 },
        { x: 10.0, y: 2.08848758376254e-45 }
      ])
    })

    it('should return 0 for large positive x', () => {
      assert(special.erfc(27) === 0)
    })

    it('should satisfy erfc(-x) = 2 - erfc(x)', () => {
      [0.5, 2, 5].forEach(x => {
        assert(equal(special.erfc(-x), 2 - special.erfc(x)), `erfc(-${x})`)
      })
    })

    it('should maintain relative precision in the far tail', () => {
      // erfc(7/sqrt(2)) appears in Normal(0,2).cdf(14); CF branch must give full precision
      assert(equal(special.erfc(7 / Math.SQRT2), 2.559625087771669924e-12), 'erfc(7/sqrt(2))')
    })
  })

  describe('.erfcx()', () => {
    it('should return 1 at zero', () => {
      assert(equal(special.erfcx(0), 1, 14))
    })

    it('should return reference values', () => {
      ;[
        { x: 0.5, y: 0.6156903441929259 },
        { x: 1.0, y: 0.427583576155807 },
        { x: 2.0, y: 0.25539567631050569 },
        { x: 5.0, y: 0.11070463773306866 }
      ].forEach(d => {
        assert(equal(special.erfcx(d.x), d.y, 14), `erfcx(${d.x})`)
      })
    })

    it('should remain finite for large x where erfc(x) underflows to 0', () => {
      assert(special.erfc(30) === 0, 'erfc(30) underflows in float64')
      assert(equal(special.erfcx(30), 0.018795888861416754, 14), 'erfcx(30) reference value')
    })

    it('should return reference values for negative arguments', () => {
      ;[
        { x: -1, y: 5.0089800807622833 },
        { x: -3, y: 16205.988853999588 }
      ].forEach(d => {
        assert(equal(special.erfcx(d.x), d.y, 14), `erfcx(${d.x})`)
      })
    })
  })

  describe('.erfinv()', () => {
    it('should return zero for zero argument', () => {
      assert(special.erfinv(0) === 0)
    })

    it('should be the inverse of erf', () => {
      [-0.9, -0.5, -0.1, 0.1, 0.5, 0.9].forEach(x => {
        assert(equal(special.erf(special.erfinv(x)), x), `erfinv(${x})`)
      })
    })

    it('should satisfy erfinv(-x) = -erfinv(x)', () => {
      [0.1, 0.5, 0.9].forEach(x => {
        assert(equal(special.erfinv(-x), -special.erfinv(x)), `erfinv(-${x})`)
      })
    })

    it('should be accurate at small arguments where Newton iterates near zero', () => {
      // Newton stopping criterion must handle x near 0; hybrid |dx| < EPS*max(|x|,1) is correct
      [1e-5, 1e-8, 1e-10].forEach(x => {
        assert(equal(special.erf(special.erfinv(x)), x), `erfinv(${x})`)
      })
    })

    it('should be accurate at subnormal-range arguments (x^2 underflows to 0)', () => {
      // For x ~ 1e-300, x^2 underflows to 0 so the polynomial initial guess collapses to x itself.
      // Newton converges in one step because erf is linear at this scale; the hybrid stopping
      // criterion must not exit prematurely before that step is taken.
      assert(equal(special.erf(special.erfinv(1e-300)), 1e-300), 'erfinv(1e-300)')
    })
  })
})
