import { assert } from 'chai'
import { describe, it } from 'mocha'
import NUTS from '../../src/mc/nuts'
import HMC from '../../src/mc/hmc'
import { Normal } from '../../src/dist'
import { ksTest, ess } from '../test-utils'
import { SEEDS } from './_helpers'

describe('mc.NUTS', () => {
  // Same targets as the HMC block, so the two samplers are directly comparable on identical densities.
  const rho = 0.5
  const c = 1 - rho * rho
  const logDensity2D = x => -0.5 * (x[0] * x[0] - 2 * rho * x[0] * x[1] + x[1] * x[1]) / c
  const gradLogDensity2D = x => [-(x[0] - rho * x[1]) / c, -(x[1] - rho * x[0]) / c]

  const logDensity1D = x => -0.5 * x[0] * x[0]
  const gradLogDensity1D = x => [-x[0]]

  describe('constructor', () => {
    it('should instantiate without error for a 2D correlated Normal target', () => {
      assert.doesNotThrow(() => new NUTS({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2 } }))
    })

    it('should default to stepSize: 0.1 when omitted', () => {
      const nuts = new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } })
      assert.strictEqual(nuts.state().internal.stepSize, 0.1)
    })

    it('should throw when gradLogDensity is not a function', () => {
      assert.throws(() => new NUTS({ logDensity: logDensity1D, gradLogDensity: null, config: { dim: 1 } }), /gradLogDensity must be a function/)
    })

    it('should throw when stepSize is zero', () => {
      assert.throws(() => new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, stepSize: 0 } }), /stepSize must be a positive number/)
    })

    it('should throw when stepSize is negative', () => {
      assert.throws(() => new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, stepSize: -0.1 } }), /stepSize must be a positive number/)
    })

    it('should throw when stepSize is Infinity', () => {
      assert.throws(() => new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, stepSize: Infinity } }), /stepSize must be a positive number/)
    })

    it('should throw when a resumed initialState.internal.stepSize is invalid', () => {
      // initialState.internal is caller-supplied the same way config is (e.g. round-tripped
      // through state()) — a corrupted/adversarial value must be rejected the same way.
      assert.throws(
        () => new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 }, initialState: { internal: { stepSize: Infinity } } }),
        /stepSize must be a positive number/
      )
    })

    it('should not throw for a valid stepSize', () => {
      assert.doesNotThrow(() => new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, stepSize: 0.2 } }))
    })

    it('should default config and initialState when omitted entirely from the options object', () => {
      const nuts = new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D })
      assert.strictEqual(nuts.dim, 1)
      assert.strictEqual(nuts.maxLag, 100)
    })

    it('should throw a clear error for the old positional constructor form', () => {
      assert.throws(
        () => new NUTS(logDensity1D, gradLogDensity1D, { dim: 1 }),
        /NUTS: constructor requires an options object/
      )
    })

    it('should throw a clear error when called with no arguments', () => {
      assert.throws(() => new NUTS(), /NUTS: constructor requires an options object/)
    })

    it('should throw a clear error when called with null', () => {
      assert.throws(() => new NUTS(null), /NUTS: constructor requires an options object/)
    })

    it('should throw a clear error when called with an array', () => {
      assert.throws(() => new NUTS([logDensity1D, gradLogDensity1D]), /NUTS: constructor requires an options object/)
    })
  })

  describe('._iter() rejection', () => {
    it('should return accepted: false and leave position unchanged when the target is degenerate', () => {
      // logDensity = -Infinity everywhere: every leapfrog point fails the slice/divergence
      // checks, so the tree never accepts a new point and the position is unchanged.
      const nuts = new NUTS({ logDensity: () => -Infinity, gradLogDensity: () => [0], config: { dim: 1 }, initialState: { x: [42] } })
      const result = nuts.iterate()
      assert.strictEqual(result.accepted, false)
      assert.strictEqual(nuts.x[0], 42)
    })
  })

  describe('numerical safety guards', () => {
    it('should terminate at MAX_TREE_DEPTH and still produce finite samples when no U-turn is found', () => {
      // A step size several orders of magnitude below what warm-up would tune to means even
      // 2^MAX_TREE_DEPTH = 1024 leapfrog steps cover only a tiny fraction of the target's
      // oscillation period, so the doubling loop exhausts MAX_TREE_DEPTH on every iteration
      // instead of stopping on a U-turn — exercising the depth cap itself, not the U-turn path.
      const nuts = new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, stepSize: 1e-4 }, initialState: { x: [1] } }).seed(1)
      for (let i = 0; i < 20; i++) {
        const result = nuts.iterate()
        assert(Number.isFinite(result.x[0]), `position ${result.x[0]} not finite at iteration ${i}`)
      }
    })

    it('should reject a diverging trajectory from a finite start without corrupting state', () => {
      // A steep quartic target with an aggressive step size makes the leapfrog integrator diverge
      // numerically within the first step, taking the proposal's log-density to -Infinity while
      // the starting position's is still finite (h0 finite, h = -Infinity) — the energy-divergence
      // guard (DELTA_MAX) path, distinct from the both-endpoints-Infinity/NaN case above.
      const logDensitySteep = x => -0.5 * Math.pow(x[0], 4)
      const gradLogDensitySteep = x => [-2 * Math.pow(x[0], 3)]
      const nuts = new NUTS({ logDensity: logDensitySteep, gradLogDensity: gradLogDensitySteep, config: { dim: 1, stepSize: 5 }, initialState: { x: [1] } }).seed(1)
      for (let i = 0; i < 10; i++) {
        const result = nuts.iterate()
        assert.strictEqual(result.accepted, false)
        assert.strictEqual(result.x[0], 1)
        assert(Number.isFinite(result.alpha), `alpha ${result.alpha} not finite at iteration ${i}`)
      }
    })
  })

  describe('.state() round-trip', () => {
    it('should restore position, samplingRate, and the full internal state', () => {
      const nuts1 = new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(11)
      // warmUp() first so dual averaging actually moves _stepSize away from its 0.1
      // construction-time default — otherwise the round-trip would trivially "pass" against a
      // corrupted read that silently falls back to the same default.
      nuts1.warmUp(null, 5)
      for (let i = 0; i < 20; i++) nuts1.iterate()
      const state = nuts1.state()
      assert.notStrictEqual(state.internal.stepSize, 0.1)
      const nuts2 = new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 }, initialState: state })
      assert.deepEqual(nuts2.x, state.x)
      assert.strictEqual(nuts2.samplingRate, state.samplingRate)
      // Full-object deepEqual, not a spot-checked field.
      assert.deepEqual(nuts2.state().internal, state.internal)
    })
  })

  describe('.ar() during sampling', () => {
    // The [0.6, 0.9] band is the issue's own acceptance criterion, carried over from HMC's test —
    // but the mechanism differs: HMC's `accepted` is a direct Bernoulli draw with parameter `alpha`
    // (the leaf Metropolis ratio), while NUTS's `accepted` (xNew !== x) is decided by progressive
    // slice sampling across every leapfrog point visited while growing the tree, and `alpha` is the
    // separate tree-averaged statistic dual averaging targets (decisions/0025-hmc-iter-alpha-field.md).
    // Because the very first leapfrog point is accepted into xNew with probability 1 whenever it
    // lands in the slice, NUTS's per-iteration accept fraction runs consistently high (~0.85-0.88
    // across 15 seeds on this target) — comfortably inside [0.6, 0.9] but near its ceiling, unlike
    // HMC's ~0.65-0.8. This is expected NUTS behavior (Stan/PyMC document near-universal per-tree
    // acceptance), not test fragility.
    [1, 2, 3].forEach(seed => {
      it(`should lie in [0.6, 0.9] for a well-tuned 1D Normal target, seed ${seed}`, () => {
        const nuts = new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(seed)
        nuts.warmUp(null, 10)
        nuts.sample(null, 1000)
        const ar = nuts.ar()
        assert(ar >= 0.6 && ar <= 0.9, `acceptance rate ${ar} outside [0.6, 0.9]`)
      })
    })
  })

  describe('.sample() distributional test', () => {
    SEEDS.forEach(seed => {
      it(`should recover both margins of a correlated bivariate Normal target (KS test, seed ${seed})`, () => {
        const nuts = new NUTS({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2 } }).seed(seed)
        nuts.warmUp(null, 10)
        const samples = nuts.sample(null, 2000)
        const ref = new Normal(0, 1)
        assert(ksTest(samples.map(s => s[0]), x => ref.cdf(x)))
        assert(ksTest(samples.map(s => s[1]), x => ref.cdf(x)))
      })
    })
  })

  describe('ESS/iteration comparison vs HMC', () => {
    it('should achieve a higher effective sample size per iteration than HMC on a strongly correlated target', () => {
      // A more strongly correlated target than the rho=0.5 KS-test target above: HMC's fixed
      // pathLength=10 is already reasonably well-matched to the mild rho=0.5 case (both samplers
      // land within ~10% ESS/iteration of each other there), which does not exercise NUTS's actual
      // advantage — adaptively extending the trajectory only as far as each iteration's geometry
      // needs, instead of paying for a fixed number of leapfrog steps regardless of fit. At
      // rho=0.8, HMC's fixed length under-explores the elongated posterior on every iteration,
      // while NUTS's doubling adapts; empirically this gives NUTS a consistent ~4.7-7x ESS/iteration
      // advantage across seeds (well above the 2x margin asserted below).
      // See solutions/testing/2026-07-16-1417-nuts-hmc-ess-comparison-target-choice.md — do not
      // "simplify" this back to the shared rho=0.5 target; that silently flips the ratio below 1.
      const essRho = 0.8
      const essC = 1 - essRho * essRho
      const essLogDensity = x => -0.5 * (x[0] * x[0] - 2 * essRho * x[0] * x[1] + x[1] * x[1]) / essC
      const essGradLogDensity = x => [-(x[0] - essRho * x[1]) / essC, -(x[1] - essRho * x[0]) / essC]

      const warmUpBatches = 10
      const sampleSize = 2000

      // A single seed's ESS estimate is a noisy point estimate (see the AdaptiveMetropolis/RWM
      // ESS comparison above for the same rationale) — average the NUTS/HMC ESS-per-iteration
      // ratio over several independent seeds.
      const seeds = [1, 2, 3, 4, 5]
      const ratios = seeds.map(seed => {
        const nuts = new NUTS({ logDensity: essLogDensity, gradLogDensity: essGradLogDensity, config: { dim: 2 } }).seed(seed)
        nuts.warmUp(null, warmUpBatches)
        const nutsSamples = nuts.sample(null, sampleSize)
        const nutsEssPerIter = ess(nuts) / (nuts.samplingRate * nutsSamples.length)

        const hmc = new HMC(essLogDensity, essGradLogDensity, { dim: 2 }).seed(seed)
        hmc.warmUp(null, warmUpBatches)
        const hmcSamples = hmc.sample(null, sampleSize)
        const hmcEssPerIter = ess(hmc) / (hmc.samplingRate * hmcSamples.length)

        return nutsEssPerIter / hmcEssPerIter
      })
      const meanRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length

      assert(meanRatio > 2, `NUTS/HMC mean ESS-per-iteration ratio (${meanRatio}) over seeds ${seeds} should exceed 2`)
    })
  })

  describe('.seed()', () => {
    [0, 42, 12345].forEach(seed => {
      it(`should produce bitwise-identical samples when seed ${seed} is applied twice`, () => {
        const nuts1 = new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(seed)
        nuts1.warmUp(null, 3)
        const samples1 = nuts1.sample(null, 20)

        const nuts2 = new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(seed)
        nuts2.warmUp(null, 3)
        const samples2 = nuts2.sample(null, 20)

        assert.deepEqual(samples1, samples2)
      })
    })

    it('should produce different samples for different seeds', () => {
      const nuts1 = new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(1)
      nuts1.warmUp(null, 3)
      const samples1 = nuts1.sample(null, 20)

      const nuts2 = new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(2)
      nuts2.warmUp(null, 3)
      const samples2 = nuts2.sample(null, 20)

      assert.notDeepEqual(samples1, samples2)
    })
  })
})
