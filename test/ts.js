import { assert } from 'chai'
import { describe, it } from 'mocha'
import * as la from '../src/la'
import * as ts from '../src/ts'
import utils from './test-utils'


// Constants
const MAX_LENGTH = 10
const PRECISION = 1e-10


describe('ts', () => {
  return
  describe('Covariance', () => {
    it('should calculate the covariance matrix online', () => {
      const data1 = Array.from({length: MAX_LENGTH}, Math.random)
      const data2 = Array.from({length: MAX_LENGTH}, Math.random)
      const covariance = new ts.Covariance(2)
      data1.forEach((d, i) => {
        const n = i + 1
        const sub1 = data1.slice(0, i + 1)
        const sub2 = data2.slice(0, i + 1)
        const x1 = sub1.reduce((sum, d) => sum + d, 0)
        const x2 = sub1.reduce((sum, d) => sum + d * d, 0)
        const y1 = sub2.reduce((sum, d) => sum + d, 0)
        const y2 = sub2.reduce((sum, d) => sum + d * d, 0)
        const xy = sub1.reduce((sum, d, i) => sum + d * sub2[i], 0)
        const cov = new la.Matrix([
          [(x2 - x1 * x1 / n) / n, (xy - x1 * y1 / n) / n],
          [(xy - y1 * x1 / n) / n, (y2 - y1 * y1 / n) / n],
        ])
        covariance.update([d, data2[i]])
        if (i > 0) {
          cov.sub(covariance.compute()).m().forEach((row, i) => {
            row.forEach((d, j) => {
              assert.equal(Math.abs(d / cov.ij(i, j)) < PRECISION, true)
            })
          })
        }
      })
    })
  })

  /*

  describe('AC', () => {
    describe('.compute()', () => {
      it('should compute the auto-correlation', () => {
        utils.repeat(() => {
          const ac = new ts.AC()
          for (let i = 1; i < 10010; i++) {
            ac.update([i % 2 === 0 ? 1 : -1])
          }
          let res = ac.compute()[0]
          assert.equal(res.filter((d, i) => i % 2 === 0).reduce((acc, d) => acc + d, 0) > 0.9 * 50, true)
          assert.equal(res.filter((d, i) => i % 2 === 1).reduce((acc, d) => acc + d, 0) < 0.9 * 50, true)
        }, LAPS)
      })
    })
    describe('.reset()', () => {
      it('should clear history', () => {
        utils.repeat(() => {
          const ac = new ts.AC(2, 3)
          for (let i = 0; i < 10; i++) {
            ac.update([i + Math.random(), i + 1 / Math.random()])
          }
          ac.reset()
          assert.deepEqual(ac.compute(), [[undefined, undefined, undefined], [undefined, undefined, undefined]])
        }, LAPS)
      })
    })
  })*/
})
