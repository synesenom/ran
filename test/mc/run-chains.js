import { assert } from 'chai'
import { describe, it } from 'mocha'
import runChains from '../../src/mc/run-chains'
import MCMC from '../../src/mc/_mcmc'
import AdaptiveMetropolis from '../../src/mc/adaptive-metropolis'
import Gibbs from '../../src/mc/gibbs'
import HMC from '../../src/mc/hmc'
import RWM from '../../src/mc/rwm'

describe('mc.runChains', () => {
  const logDensity = x => -0.5 * x[0] ** 2

  describe('input validation', () => {
    it('should throw when chains is fewer than two', () => {
      assert.throws(() => runChains(RWM, { logDensity, config: { dim: 1 } }, { chains: 1 }), /at least two chains/)
    })

    it('should throw when chains is zero', () => {
      assert.throws(() => runChains(RWM, { logDensity, config: { dim: 1 } }, { chains: 0 }), /at least two chains/)
    })

    it('should throw when chains is not an integer', () => {
      assert.throws(() => runChains(RWM, { logDensity, config: { dim: 1 } }, { chains: 2.5 }), /at least two chains/)
    })

    it('should throw when seeds.length does not match chains', () => {
      assert.throws(() => runChains(RWM, { logDensity, config: { dim: 1 } }, { chains: 5, seeds: [1, 2, 3] }), /seeds.length must equal.*chains/)
    })

    it('should throw when chains exceeds the maximum allowed', () => {
      // warmUpBatches/sampleSize: 0 keeps this fast — the bound must be checked
      // before any chain is constructed, not discovered by running out of time.
      assert.throws(
        () => runChains(RWM, { logDensity, config: { dim: 1 } }, { chains: 10001, warmUpBatches: 0, sampleSize: 0 }),
        /chains must be at most/
      )
    })
  })

  describe('defaults', () => {
    it('should default to two chains seeded 1 and 2 when chains/seeds are omitted', () => {
      const { samples } = runChains(RWM, { logDensity, config: { dim: 1 } }, { warmUpBatches: 2, sampleSize: 20 })

      const manual = [1, 2].map(seed => {
        const rwm = new RWM({ logDensity, config: { dim: 1 } }).seed(seed)
        rwm.warmUp(null, 2)
        return rwm.sample(null, 20)
      })

      assert.deepEqual(samples, manual)
    })
  })

  describe('output shape', () => {
    it('should return samples for the requested chain count and sample size', () => {
      const { samples } = runChains(RWM, { logDensity, config: { dim: 1 } }, { chains: 3, warmUpBatches: 2, sampleSize: 15 })
      assert.strictEqual(samples.length, 3)
      samples.forEach(chain => assert.strictEqual(chain.length, 15))
    })

    it('should return one rhat array per state dimension, each of length sampleSize - 1', () => {
      const { rhat } = runChains(RWM, { logDensity, config: { dim: 1 } }, { chains: 2, warmUpBatches: 2, sampleSize: 15 })
      assert.strictEqual(rhat.length, 1)
      assert.strictEqual(rhat[0].length, 14)
    })
  })

  describe('seeded reproducibility', () => {
    it('should match manually constructed chains seeded with the same explicit seeds', () => {
      const { samples } = runChains(RWM, { logDensity, config: { dim: 1 } }, { chains: 3, seeds: [10, 20, 30], warmUpBatches: 2, sampleSize: 15 })

      const manual = [10, 20, 30].map(seed => {
        const rwm = new RWM({ logDensity, config: { dim: 1 } }).seed(seed)
        rwm.warmUp(null, 2)
        return rwm.sample(null, 15)
      })

      assert.deepEqual(samples, manual)
    })
  })

  describe('maxLength', () => {
    it('should cap rhat length the same way gelmanRubin does', () => {
      const { rhat } = runChains(RWM, { logDensity, config: { dim: 1 } }, { chains: 2, warmUpBatches: 2, sampleSize: 15, maxLength: 3 })
      assert.strictEqual(rhat[0].length, 3)
    })
  })

  describe('convergence', () => {
    it('should converge to R-hat < 1.1 for a well-tuned unit-Gaussian target', () => {
      const { rhat } = runChains(RWM, { logDensity, config: { dim: 1 } }, { chains: 2, warmUpBatches: 10, sampleSize: 500, seeds: [100, 200] })
      assert.isBelow(rhat[0][rhat[0].length - 1], 1.1)
    })
  })

  describe('(Sampler, samplerOptions, runOptions) form', () => {
    it('should match manually constructed AdaptiveMetropolis chains using non-default config', () => {
      // Non-default maxLag/arWindow (not just dim) so a bug that drops a config field
      // would be caught instead of masked by every field already being at its default.
      const samplerOptions = { logDensity, config: { dim: 1, maxLag: 20, arWindow: 50 } }
      const { samples } = runChains(
        AdaptiveMetropolis,
        samplerOptions,
        { chains: 3, seeds: [10, 20, 30], warmUpBatches: 2, sampleSize: 15 }
      )

      const manual = [10, 20, 30].map(seed => {
        const am = new AdaptiveMetropolis(samplerOptions).seed(seed)
        am.warmUp(null, 2)
        return am.sample(null, 15)
      })

      assert.deepEqual(samples, manual)
    })

    it('should match manually constructed Gibbs chains driven by the sampler\'s own seeded rng', () => {
      const rho = 0.5
      const sigma = 1
      // Consumes rng.next() (the sampler's own seeded generator) rather than
      // constructing an independent distribution, so reproducibility actually
      // exercises seed() instead of trivially passing regardless of it — see
      // solutions/testing/2026-07-15-2015-gibbs-conditionals-fresh-normal-seed-noop.md
      const conditionals = [
        (x, rng) => rho * x[1] + sigma * rng.next(),
        (x, rng) => rho * x[0] + sigma * rng.next()
      ]
      const samplerOptions = { conditionals, config: { dim: 2 } }

      const { samples } = runChains(
        Gibbs,
        samplerOptions,
        { chains: 2, seeds: [1, 2], warmUpBatches: 2, sampleSize: 10 }
      )

      const manual = [1, 2].map(seed => {
        const gibbs = new Gibbs(samplerOptions).seed(seed)
        gibbs.warmUp(null, 2)
        return gibbs.sample(null, 10)
      })

      assert.deepEqual(samples, manual)
    })

    it('should match manually constructed HMC chains using a non-default stepSize (gradLogDensity carried through samplerOptions)', () => {
      const gradLogDensity = x => [-x[0]]
      const samplerOptions = { logDensity, gradLogDensity, config: { dim: 1, stepSize: 0.05 } }
      const { samples } = runChains(
        HMC,
        samplerOptions,
        { chains: 2, warmUpBatches: 2, sampleSize: 12 }
      )

      const manual = [1, 2].map(seed => {
        const hmc = new HMC(samplerOptions).seed(seed)
        hmc.warmUp(null, 2)
        return hmc.sample(null, 12)
      })

      assert.deepEqual(samples, manual)
    })

    it('should fail fast with MCMC\'s own "abstract" error when the abstract MCMC class itself is passed as Sampler', () => {
      // The abstract-instantiation guard is the first line of MCMC's constructor, so it fires
      // before any argument shape is inspected — passing the wrong class as Sampler still fails
      // fast with a clear error rather than a confusing downstream one.
      assert.throws(
        () => runChains(MCMC, { logDensity, config: { dim: 1 } }, { warmUpBatches: 1, sampleSize: 5 }),
        /MCMC is abstract and cannot be instantiated directly/
      )
    })
  })
})
