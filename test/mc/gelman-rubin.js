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

    it('should throw when chains have unequal lengths', () => {
      // _gri uses chains[0].length as the sample-variance divisor for every chain; a shorter chain
      // would silently read past its end (undefined -> NaN) and mismatch the divisor, producing a
      // wrong/NaN R-hat instead of an error. Reachable only via direct calls, not through runChains.
      const chain1 = Array.from({ length: 5 }, (_, i) => [i + 0.5])
      const chain2 = Array.from({ length: 3 }, (_, i) => [i + 0.5])
      assert.throws(() => gelmanRubin([chain1, chain2]), /same length/)
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

  describe('hand-computed reference', () => {
    it('should match exact hand-computed R-hat values for a small deterministic two-chain dataset', () => {
      // chain1 = [1, 2, 3], chain2 = [4, 5, 6] (1D, m = 2 chains).
      //
      // Prefix length n = 2 (chain1 = [1, 2], chain2 = [4, 5]):
      // exact rational: means = [1.5, 4.5], grandMean = 3
      // exact rational: within-chain variance (n-1 = 1 divisor) is (0.5^2 + 0.5^2) / 1 = 0.5
      //   for each chain -> W = (0.5 + 0.5) / 2 = 0.5
      // exact rational: B = n * sum((mean_k - grandMean)^2) / (m - 1)
      //   = 2 * ((1.5 - 3)^2 + (4.5 - 3)^2) / 1 = 2 * 4.5 = 9
      // exact rational: R-hat^2 = ((n-1)*W + B) / (n*W) = (0.5 + 9) / 1 = 9.5, so R-hat = sqrt(9.5)
      // mpmath mp.dps=50: sqrt(mpf('9.5')) -> 3.0822070014844882251250961907271221126178120117223
      //
      // Full length n = 3 (chain1 = [1, 2, 3], chain2 = [4, 5, 6]):
      // exact rational: means = [2, 5], grandMean = 3.5
      // exact rational: within-chain variance (n-1 = 2 divisor) is ((1-2)^2+(2-2)^2+(3-2)^2) / 2 = 1
      //   for each chain -> W = (1 + 1) / 2 = 1
      // exact rational: B = n * sum((mean_k - grandMean)^2) / (m - 1)
      //   = 3 * ((2 - 3.5)^2 + (5 - 3.5)^2) / 1 = 3 * 4.5 = 13.5
      // exact rational: R-hat^2 = ((n-1)*W + B) / (n*W) = (2 + 13.5) / 3 = 31/6, so R-hat = sqrt(31/6)
      // mpmath mp.dps=50: sqrt(mpf(31) / mpf(6)) -> 2.2730302828309759821264329253215987058500140741315
      const chain1 = [[1], [2], [3]]
      const chain2 = [[4], [5], [6]]
      const result = gelmanRubin([chain1, chain2])
      assert.strictEqual(result[0].length, 2)
      assert.closeTo(result[0][0], 3.082207001484488, 1e-14)
      assert.closeTo(result[0][1], 2.273030282830976, 1e-14)
    })
  })

  describe('seeded RWM chains', () => {
    const logDensity = x => -0.5 * x[0] ** 2

    // Shared by both tests below so the construct/warmUp/sample boilerplate for a seeded
    // RWM chain isn't repeated with only the seed/batch/size arguments differing.
    function seededChain (seed, warmUpBatches, sampleSize) {
      const rwm = new RWM({ logDensity, config: { dim: 1 } }).seed(seed)
      rwm.warmUp(null, warmUpBatches)
      return rwm.sample(null, sampleSize)
    }

    it('should return an R-hat array for two chains seeded with different values', () => {
      const chain1 = seededChain(1, 3, 50)
      const chain2 = seededChain(2, 3, 50)

      const result = gelmanRubin([chain1, chain2])
      assert.strictEqual(result.length, 1)
      assert.strictEqual(result[0].length, 49)
    })

    it('should converge to R-hat < 1.1 for two long, seeded chains from the same unit-Gaussian target', () => {
      const chain1 = seededChain(100, 10, 500)
      const chain2 = seededChain(200, 10, 500)

      const result = gelmanRubin([chain1, chain2])
      assert.isBelow(result[0][result[0].length - 1], 1.1)
    })
  })
})
