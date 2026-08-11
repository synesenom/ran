import { assert } from 'chai'
import { describe, it } from 'mocha'
import { equal } from '../test-utils.js'
import * as special from '../../src/special/index.js'

describe('special.e1', () => {
  describe('.e1()', () => {
    it('should return boundary values', () => {
      assert(special.e1(0) === Infinity, 'e1(0)')
      assert(isNaN(special.e1(-1)), 'e1(-1)')
    })

    it('should return reference values in the series branch (z≤1)', () => {
      // Reference values from mpmath at mp.dps=50
      ;[
        { z: 0.5, y: 0.5597735947761608 },
        { z: 1.0, y: 0.2193839343955203 }
      ].forEach(d => {
        assert(equal(special.e1(d.z), d.y), `e1(${d.z})`)
      })
    })

    it('should return reference values in the continued-fraction branch (z>1)', () => {
      // Reference values from mpmath at mp.dps=50
      ;[
        { z: 2.0, y: 0.04890051070806112 },
        { z: 5.0, y: 0.0011482955912753255 },
        { z: 10.0, y: 4.156968929685321e-6 }
      ].forEach(d => {
        assert(equal(special.e1(d.z), d.y), `e1(${d.z})`)
      })
    })
  })
})
