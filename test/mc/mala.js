import { assert } from 'chai'
import { describe, it } from 'mocha'
import MALA from '../../src/mc/mala'
import RWM from '../../src/mc/rwm'
import { Normal } from '../../src/dist'
import { ksTest, ess } from '../test-utils'
import { SEEDS } from './_helpers'

describe('mc.MALA', () => {
  // Same target as mc.HMC's tests, so the two gradient-based samplers are exercised
  // against an identical correlated bivariate Normal.
  const rho = 0.5
  const c = 1 - rho * rho
  const logDensity2D = x => -0.5 * (x[0] * x[0] - 2 * rho * x[0] * x[1] + x[1] * x[1]) / c
  const gradLogDensity2D = x => [-(x[0] - rho * x[1]) / c, -(x[1] - rho * x[0]) / c]

  const logDensity1D = x => -0.5 * x[0] * x[0]
  const gradLogDensity1D = x => [-x[0]]

  describe('constructor', () => {
    it('should instantiate without error for a 2D correlated Normal target', () => {
      assert.doesNotThrow(() => new MALA({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2 } }))
    })

    it('should default to stepSize: 0.1 when omitted', () => {
      const mala = new MALA({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } })
      // Log-scale storage (Math.log/Math.exp round-trip) introduces a ~1e-17 float error,
      // unlike HMC's linear _stepSize storage which reports the input bit-exact.
      // See solutions/testing/2026-07-16-1600-mala-log-scale-storage-strict-equal-trap.md
      assert.closeTo(mala.state().internal.stepSize, 0.1, 1e-15)
    })

    it('should throw when gradLogDensity is not a function', () => {
      assert.throws(() => new MALA({ logDensity: logDensity1D, gradLogDensity: null, config: { dim: 1 } }), /gradLogDensity must be a function/)
    })

    it('should throw when stepSize is zero', () => {
      assert.throws(() => new MALA({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, stepSize: 0 } }), /stepSize must be a positive number/)
    })

    it('should throw when stepSize is negative', () => {
      assert.throws(() => new MALA({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, stepSize: -0.1 } }), /stepSize must be a positive number/)
    })

    it('should throw when stepSize is Infinity', () => {
      assert.throws(() => new MALA({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, stepSize: Infinity } }), /stepSize must be a positive number/)
    })

    it('should throw when a resumed initialState.internal.stepSize is invalid', () => {
      // initialState.internal is caller-supplied the same way config is (e.g. round-tripped
      // through state()) — a corrupted/adversarial value must be rejected the same way.
      assert.throws(
        () => new MALA({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 }, initialState: { internal: { stepSize: Infinity } } }),
        /stepSize must be a positive number/
      )
    })

    it('should not throw for a valid explicit stepSize', () => {
      assert.doesNotThrow(() => new MALA({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, stepSize: 0.2 } }))
    })

    it('should default config and initialState when omitted entirely from the options object', () => {
      const mala = new MALA({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D })
      assert.strictEqual(mala.dim, 1)
      assert.strictEqual(mala.maxLag, 100)
    })

    it('should throw a clear error for the old positional constructor form', () => {
      assert.throws(
        () => new MALA(logDensity1D, gradLogDensity1D, { dim: 1 }),
        /MALA: constructor requires an options object/
      )
    })

    it('should throw a clear error when called with no arguments', () => {
      assert.throws(() => new MALA(), /MALA: constructor requires an options object/)
    })

    it('should throw a clear error when called with null', () => {
      assert.throws(() => new MALA(null), /MALA: constructor requires an options object/)
    })

    it('should throw a clear error when called with an array', () => {
      assert.throws(() => new MALA([logDensity1D, gradLogDensity1D]), /MALA: constructor requires an options object/)
    })
  })

  describe('._iter() rejection', () => {
    it('should return accepted: false and leave position unchanged when the target is degenerate', () => {
      // logDensity = -Infinity everywhere: the MH log-ratio is -Infinity - (-Infinity) = NaN,
      // so exp(NaN) = NaN and float() < NaN is false always — mirrors HMC's/RWM's analogous test.
      const mala = new MALA({ logDensity: () => -Infinity, gradLogDensity: () => [0], config: { dim: 1 }, initialState: { x: [42] } })
      const result = mala.iterate()
      assert.strictEqual(result.accepted, false)
      assert.strictEqual(mala.x[0], 42)
    })
  })

  describe('.state() round-trip', () => {
    it('should restore position, samplingRate, and the full internal state', () => {
      const mala1 = new MALA({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(11)
      // warmUp() first so batch Robbins-Monro actually moves stepSize away from its 0.1
      // construction-time default — see solutions/correctness/2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md
      mala1.warmUp(null, 5)
      for (let i = 0; i < 100; i++) mala1.iterate()
      const state = mala1.state()
      assert.notStrictEqual(state.internal.stepSize, 0.1)
      const mala2 = new MALA({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 }, initialState: state })
      assert.deepEqual(mala2.x, state.x)
      assert.strictEqual(mala2.samplingRate, state.samplingRate)
      assert.deepEqual(mala2.state().internal, state.internal)
    })
  })

  describe('.ar() during sampling', () => {
    [1, 2, 3].forEach(seed => {
      it(`should lie in [0.5, 0.65] for a well-tuned 1D Normal target, seed ${seed}`, () => {
        const mala = new MALA({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(seed)
        mala.warmUp(null, 10)
        mala.sample(null, 1000)
        const ar = mala.ar()
        assert(ar >= 0.5 && ar <= 0.65, `acceptance rate ${ar} outside [0.5, 0.65]`)
      })
    })
  })

  describe('.sample() distributional test', () => {
    SEEDS.forEach(seed => {
      it(`should recover both margins of a correlated bivariate Normal target (KS test, seed ${seed})`, () => {
        const mala = new MALA({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2 } }).seed(seed)
        mala.warmUp(null, 10)
        const samples = mala.sample(null, 2000)
        const ref = new Normal(0, 1)
        assert(ksTest(samples.map(s => s[0]), x => ref.cdf(x)))
        assert(ksTest(samples.map(s => s[1]), x => ref.cdf(x)))
      })
    })
  })

  // Same AR(1)-correlation target as the AdaptiveMetropolis/RWM ESS comparison, plus its
  // analytical gradient (grad log p(x) = -Q x for a zero-mean Normal with precision Q).
  // Split into small single-purpose functions so no one function's cyclomatic complexity
  // combines the density loop, the gradient loop, and the diagonal-entry selection.
  // See solutions/tooling/2026-07-16-1601-codescene-nested-closure-complexity-attribution.md
  function ar1PrecisionEntries (rho) {
    const denom = 1 - rho * rho
    return { diagEdge: 1 / denom, diagMid: (1 + rho * rho) / denom, offDiag: -rho / denom }
  }

  function ar1Diag (i, diagEdge, diagMid) {
    return (i === 0 || i === 4) ? diagEdge : diagMid
  }

  function ar1LogDensity5D (rho) {
    const { diagEdge, diagMid, offDiag } = ar1PrecisionEntries(rho)
    return x => {
      let q = 0
      for (let i = 0; i < 5; i++) {
        q += ar1Diag(i, diagEdge, diagMid) * x[i] * x[i]
      }
      for (let i = 0; i < 4; i++) {
        q += 2 * offDiag * x[i] * x[i + 1]
      }
      return -0.5 * q
    }
  }

  function ar1GradLogDensity5D (rho) {
    const { diagEdge, diagMid, offDiag } = ar1PrecisionEntries(rho)
    return x => {
      const g = new Array(5)
      for (let i = 0; i < 5; i++) {
        const neighbors = (i > 0 ? x[i - 1] : 0) + (i < 4 ? x[i + 1] : 0)
        g[i] = -(ar1Diag(i, diagEdge, diagMid) * x[i] + offDiag * neighbors)
      }
      return g
    }
  }

  describe('5D correlated Normal ESS comparison', () => {
    it('should achieve higher effective sample size than RWM for equal iteration counts', () => {
      const rho5 = 0.7
      const lnp = ar1LogDensity5D(rho5)
      const gradLnp = ar1GradLogDensity5D(rho5)
      const warmUpBatches = 20
      const sampleSize = 2000

      const seeds = [1, 2, 3, 4, 5]
      const ratios = seeds.map(seed => {
        const mala = new MALA({ logDensity: lnp, gradLogDensity: gradLnp, config: { dim: 5 } }).seed(seed)
        mala.warmUp(null, warmUpBatches)
        mala.sample(null, sampleSize)
        const malaEss = ess(mala)

        const rwm = new RWM(lnp, { dim: 5 }).seed(seed)
        rwm.warmUp(null, warmUpBatches)
        rwm.sample(null, sampleSize)
        const rwmEss = ess(rwm)

        return malaEss / rwmEss
      })
      const meanRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length

      assert(meanRatio > 1.1, `MALA/RWM mean ESS ratio (${meanRatio}) over seeds ${seeds} should exceed 1.1`)
    })
  })

  describe('.seed()', () => {
    [0, 42, 12345].forEach(seed => {
      it(`should produce bitwise-identical samples when seed ${seed} is applied twice`, () => {
        const mala1 = new MALA({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(seed)
        mala1.warmUp(null, 3)
        const samples1 = mala1.sample(null, 50)

        const mala2 = new MALA({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(seed)
        mala2.warmUp(null, 3)
        const samples2 = mala2.sample(null, 50)

        assert.deepEqual(samples1, samples2)
      })
    })

    it('should produce different samples for different seeds', () => {
      const mala1 = new MALA({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(1)
      mala1.warmUp(null, 3)
      const samples1 = mala1.sample(null, 50)

      const mala2 = new MALA({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(2)
      mala2.warmUp(null, 3)
      const samples2 = mala2.sample(null, 50)

      assert.notDeepEqual(samples1, samples2)
    })
  })
})
