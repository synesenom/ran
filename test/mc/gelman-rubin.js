import { assert } from 'chai'
import { describe, it } from 'mocha'
import gelmanRubin from '../../src/mc/gelman-rubin'
import RWM from '../../src/mc/rwm'
import { Normal } from '../../src/dist'

describe('mc.gelmanRubin', () => {
  describe('input validation', () => {
    it('should throw when given an empty array', () => {
      assert.throws(() => gelmanRubin([]), /at least two chains/)
    })

    it('should throw when given a single chain', () => {
      const chain = Array.from({ length: 5 }, (_, i) => [i + 0.5])
      assert.throws(() => gelmanRubin([chain]), /at least two chains/)
    })

    it('should throw for non-array input', () => {
      assert.throws(() => gelmanRubin(null), /at least two chains/)
    })

    it('should not throw for two valid chains', () => {
      const chain1 = Array.from({ length: 5 }, (_, i) => [i + 0.5])
      const chain2 = Array.from({ length: 5 }, (_, i) => [i * 2 + 0.5])
      assert.doesNotThrow(() => gelmanRubin([chain1, chain2]))
    })
  })

  describe('maxLength', () => {
    it('should cap output length to maxLength', () => {
      const chain1 = Array.from({ length: 10 }, (_, i) => [i + 0.5])
      const chain2 = Array.from({ length: 10 }, (_, i) => [i * 2 + 0.5])
      const result = gelmanRubin([chain1, chain2], 3)
      assert.strictEqual(result[0].length, 3)
    })

    it('should return chain.length - 1 values without maxLength', () => {
      const chain1 = Array.from({ length: 10 }, (_, i) => [i + 0.5])
      const chain2 = Array.from({ length: 10 }, (_, i) => [i * 2 + 0.5])
      const result = gelmanRubin([chain1, chain2])
      assert.strictEqual(result[0].length, 9)
    })
  })

  describe('output shape', () => {
    it('should return one array per state dimension', () => {
      const chain1 = Array.from({ length: 20 }, (_, i) => [i * 0.1, -i * 0.1])
      const chain2 = Array.from({ length: 20 }, (_, i) => [i * 0.1 + 0.5, -i * 0.1 + 0.5])
      const result = gelmanRubin([chain1, chain2])
      assert.strictEqual(result.length, 2)
    })
  })

  describe('convergence', () => {
    it('should return R-hat close to 1.0 for two well-mixed i.i.d. Normal chains', () => {
      const normal = new Normal(0, 1)
      const chain1 = Array.from({ length: 500 }, () => [normal.sample()])
      const chain2 = Array.from({ length: 500 }, () => [normal.sample()])
      const result = gelmanRubin([chain1, chain2])
      assert.closeTo(result[0][result[0].length - 1], 1.0, 0.05)
    })
  })

  describe('seeded RWM chains', () => {
    const logDensity = x => -0.5 * x[0] ** 2

    it('should return an R-hat array for two chains seeded with different values', () => {
      const rwm1 = new RWM(logDensity, { dim: 1 }).seed(1)
      rwm1.warmUp(null, 3)
      const chain1 = rwm1.sample(null, 50)

      const rwm2 = new RWM(logDensity, { dim: 1 }).seed(2)
      rwm2.warmUp(null, 3)
      const chain2 = rwm2.sample(null, 50)

      const result = gelmanRubin([chain1, chain2])
      assert.strictEqual(result.length, 1)
      assert.strictEqual(result[0].length, 49)
    })

    it('should converge to R-hat < 1.1 for two long, seeded chains from the same unit-Gaussian target', () => {
      const rwm1 = new RWM(logDensity, { dim: 1 }).seed(100)
      rwm1.warmUp(null, 10)
      const chain1 = rwm1.sample(null, 500)

      const rwm2 = new RWM(logDensity, { dim: 1 }).seed(200)
      rwm2.warmUp(null, 10)
      const chain2 = rwm2.sample(null, 500)

      const result = gelmanRubin([chain1, chain2])
      assert.isBelow(result[0][result[0].length - 1], 1.1)
    })
  })
})
