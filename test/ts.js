import assert from 'assert'
import { describe, it } from 'mocha'
import utils from './test-utils'
import * as ts from '../src/ts'

const LAPS = 2

describe('ts', () => {
  describe('Cov', () => {
    describe('.compute()', () => {
      it('should compute covariance', () => {
        utils.repeat(() => {
          const cov = new ts.Cov()

          const s = 1 + Math.random() * 9
          for (let i = 0; i < 10000; i++) {
            cov.update([-Math.log(Math.random()) * s])
          }
          assert.deepEqual(Math.abs(cov.compute().m()[0][0] / (s * s) - 1) < 0.1, true)
        }, LAPS)
      })
    })
    describe('.reset()', () => {
      it('should clear history', () => {
        utils.repeat(() => {
          const cov = new ts.Cov(2)
          for (let i = 0; i < 10; i++) {
            let r = Math.random()
            cov.update([r, 2 * r + 0.1 * Math.random() - 0.05])
          }
          cov.reset()
          assert.deepEqual(cov.compute().m(), [[0, 0], [0, 0]])
        }, LAPS)
      })
    })
  })

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
  })
})
