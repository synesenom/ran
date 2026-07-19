import { assert } from 'chai'
import { describe, it } from 'mocha'
import HMC from '../../src/mc/hmc'
import { Normal } from '../../src/dist'
import { ksTest } from '../test-utils'
import { SEEDS } from './_helpers'

describe('mc.HMC', () => {
  // Log-density and analytical gradient for a standard bivariate Normal with correlation rho,
  // mirroring the Gibbs bivariate-Normal test target (rho = 0.5) so both margins are themselves
  // standard Normal regardless of the correlation.
  const rho = 0.5
  const c = 1 - rho * rho
  const logDensity2D = x => -0.5 * (x[0] * x[0] - 2 * rho * x[0] * x[1] + x[1] * x[1]) / c
  const gradLogDensity2D = x => [-(x[0] - rho * x[1]) / c, -(x[1] - rho * x[0]) / c]

  const logDensity1D = x => -0.5 * x[0] * x[0]
  const gradLogDensity1D = x => [-x[0]]

  describe('constructor', () => {
    it('should instantiate without error for a 2D correlated Normal target', () => {
      assert.doesNotThrow(() => new HMC({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2 } }))
    })

    it('should default to stepSize: 0.1 and pathLength: 10 when omitted', () => {
      const hmc = new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } })
      assert.strictEqual(hmc.state().internal.stepSize, 0.1)
      assert.strictEqual(hmc.state().internal.pathLength, 10)
    })

    it('should throw when gradLogDensity is not a function', () => {
      assert.throws(() => new HMC({ logDensity: logDensity1D, gradLogDensity: null, config: { dim: 1 } }), /gradLogDensity must be a function/)
    })

    it('should throw when stepSize is zero', () => {
      assert.throws(() => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, stepSize: 0 } }), /stepSize must be a positive number/)
    })

    it('should throw when stepSize is negative', () => {
      assert.throws(() => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, stepSize: -0.1 } }), /stepSize must be a positive number/)
    })

    it('should throw when stepSize is Infinity', () => {
      assert.throws(() => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, stepSize: Infinity } }), /stepSize must be a positive number/)
    })

    it('should throw when a resumed initialState.internal.stepSize is invalid', () => {
      // initialState.internal is caller-supplied the same way config is (e.g. round-tripped
      // through state()) — a corrupted/adversarial value must be rejected the same way.
      assert.throws(
        () => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 }, initialState: { internal: { stepSize: Infinity, pathLength: 10 } } }),
        /stepSize must be a positive number/
      )
    })

    it('should throw when a resumed initialState.internal.pathLength is invalid', () => {
      assert.throws(
        () => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 }, initialState: { internal: { stepSize: 0.1, pathLength: Infinity } } }),
        /pathLength must be a positive integer/
      )
    })

    it('should throw when pathLength is zero', () => {
      assert.throws(() => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, pathLength: 0 } }), /pathLength must be a positive integer/)
    })

    it('should throw when pathLength is negative', () => {
      assert.throws(() => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, pathLength: -5 } }), /pathLength must be a positive integer/)
    })

    it('should throw when pathLength is not an integer', () => {
      assert.throws(() => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, pathLength: 2.5 } }), /pathLength must be a positive integer/)
    })

    it('should throw for a pathLength above the maximum allowed', () => {
      assert.throws(() => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, pathLength: 1e9 } }), /pathLength must be at most/)
      assert.throws(() => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, pathLength: 1025 } }), /pathLength must be at most/)
    })

    it('should not throw for a pathLength at the maximum allowed', () => {
      assert.doesNotThrow(() => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, pathLength: 1024 } }))
    })

    it('should not throw for valid stepSize and pathLength', () => {
      assert.doesNotThrow(() => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, stepSize: 0.2, pathLength: 5 } }))
    })

    it('should default to metric: diag when config.metric is omitted', () => {
      const hmc = new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } })
      assert.strictEqual(hmc.state().internal.metric.type, 'diag')
    })

    it('should accept metric: dense', () => {
      const hmc = new HMC({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2, metric: 'dense' } })
      assert.strictEqual(hmc.state().internal.metric.type, 'dense')
    })

    it('should throw when metric is neither diag nor dense', () => {
      assert.throws(() => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, metric: 'bogus' } }), /metric must be/)
    })

    it('should throw when metric: dense exceeds the dense dimension cap', () => {
      assert.throws(() => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1001, metric: 'dense' } }), /dense/i)
    })

    it('should not throw for metric: dense at the dimension cap boundary or at dim: 1', () => {
      assert.doesNotThrow(() => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1000, metric: 'dense' } }))
      const hmc = new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, metric: 'dense' } })
      assert.doesNotThrow(() => hmc.iterate())
    })

    it('should throw when a resumed internal.metric.type mismatches the resolved metric type', () => {
      assert.throws(
        () => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 }, initialState: { internal: { stepSize: 0.1, pathLength: 10, metric: { type: 'dense', L: [[1]], D: [1] } } } }),
        /metric/i
      )
    })

    it('should throw when a resumed diagonal internal.metric.variance has the wrong length', () => {
      assert.throws(
        () => new HMC({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2 }, initialState: { internal: { stepSize: 0.1, pathLength: 10, metric: { type: 'diag', variance: [1] } } } }),
        /metric/i
      )
    })

    it('should throw when a resumed diagonal internal.metric.variance contains a non-positive value', () => {
      assert.throws(
        () => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 }, initialState: { internal: { stepSize: 0.1, pathLength: 10, metric: { type: 'diag', variance: [0] } } } }),
        /metric/i
      )
    })

    it('should throw when a resumed diagonal internal.metric.variance contains a non-finite value', () => {
      assert.throws(
        () => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 }, initialState: { internal: { stepSize: 0.1, pathLength: 10, metric: { type: 'diag', variance: [Infinity] } } } }),
        /metric/i
      )
    })

    it('should throw when a resumed dense internal.metric.D has the wrong length', () => {
      assert.throws(
        () => new HMC({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2, metric: 'dense' }, initialState: { internal: { stepSize: 0.1, pathLength: 10, metric: { type: 'dense', L: [[1, 0], [0, 1]], D: [1] } } } }),
        /metric/i
      )
    })

    it('should throw when a resumed dense internal.metric.L is malformed', () => {
      assert.throws(
        () => new HMC({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2, metric: 'dense' }, initialState: { internal: { stepSize: 0.1, pathLength: 10, metric: { type: 'dense', L: [[1, 0]], D: [1, 1] } } } }),
        /metric/i
      )
    })

    it('should default config and initialState when omitted entirely from the options object', () => {
      const hmc = new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D })
      assert.strictEqual(hmc.dim, 1)
      assert.strictEqual(hmc.maxLag, 100)
    })

    it('should resolve config when initialState is omitted from the options object', () => {
      const hmc = new HMC({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2 } })
      assert.strictEqual(hmc.dim, 2)
    })

    it('should resolve initialState when config is omitted from the options object', () => {
      const hmc = new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, initialState: { x: [7] } })
      assert.deepStrictEqual(hmc.x, [7])
    })

    it('should throw a clear error when called with null', () => {
      assert.throws(() => new HMC(null), /HMC: constructor requires an options object/)
    })

    it('should throw a clear error when called with an array', () => {
      assert.throws(() => new HMC([logDensity1D, gradLogDensity1D]), /HMC: constructor requires an options object/)
    })

    it('should throw a clear error when called with a non-object primitive', () => {
      assert.throws(() => new HMC(42), /HMC: constructor requires an options object/)
      assert.throws(() => new HMC('logDensity'), /HMC: constructor requires an options object/)
    })
  })

  describe('gradLogDensity array-reuse contract', () => {
    it('should pass the same array object to gradLogDensity on every leapfrog step of one .iterate() call, mutated in place', () => {
      // Pins #948's array-reuse optimization (issue #996) as observed through the public
      // gradLogDensity callback: a caller that retains the raw reference instead of reading it
      // synchronously would observe later steps' values.
      const refs = []
      const snapshots = []
      const gradLogDensity = x => {
        refs.push(x)
        snapshots.push(x.slice())
        return [-x[0]]
      }
      const hmc = new HMC({ logDensity: logDensity1D, gradLogDensity, config: { dim: 1, pathLength: 3 }, initialState: { x: [1] } })
      hmc.iterate()

      refs.forEach(ref => assert.strictEqual(ref, refs[0]))
      assert.notDeepEqual(refs[0], snapshots[0])
      assert.deepEqual(refs[0], snapshots[snapshots.length - 1])
    })
  })

  describe('._iter() rejection', () => {
    it('should return accepted: false and leave position unchanged when the target is degenerate', () => {
      // logDensity = -Infinity everywhere: the Hamiltonian difference is -Infinity - (-Infinity) = NaN,
      // so exp(NaN) = NaN and float() < NaN is false always — mirrors RWM's analogous rejection test.
      const hmc = new HMC({ logDensity: () => -Infinity, gradLogDensity: () => [0], config: { dim: 1 }, initialState: { x: [42] } })
      const result = hmc.iterate()
      assert.strictEqual(result.accepted, false)
      assert.strictEqual(hmc.x[0], 42)
    })
  })

  describe('.state() round-trip', () => {
    it('should restore position, samplingRate, and the full internal state', () => {
      const hmc1 = new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(11)
      // warmUp() first so dual averaging actually moves _stepSize away from its 0.1
      // construction-time default — otherwise the round-trip would trivially "pass" against a
      // corrupted read that silently falls back to the same default, the exact failure mode in
      // solutions/correctness/2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md.
      hmc1.warmUp(null, 5)
      for (let i = 0; i < 100; i++) hmc1.iterate()
      const state = hmc1.state()
      assert.notStrictEqual(state.internal.stepSize, 0.1)
      // The diagonal metric adapts alongside stepSize; an empirical sample variance from a
      // continuous target is never bit-for-bit equal to the identity default of 1.
      assert.notStrictEqual(state.internal.metric.variance[0], 1)
      const hmc2 = new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 }, initialState: state })
      assert.deepEqual(hmc2.x, state.x)
      assert.strictEqual(hmc2.samplingRate, state.samplingRate)
      // Full-object deepEqual, not a spot-checked field — see
      // solutions/correctness/2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md
      assert.deepEqual(hmc2.state().internal, state.internal)
    })
  })

  describe('mass matrix adaptation', () => {
    describe('diagonal metric (default)', () => {
      // Independent 3D Normal, sigma = [1, 100, 0.1] -- a 1000x scale range. 0.1 (not the issue's
      // example 0.01) keeps the *unadapted* baseline within the leapfrog stability margin
      // (eps/sigma must stay below ~2 for stepSize=0.1), avoiding a fully-stuck chain whose
      // zero-variance autocorrelation would make its ESS look spuriously high instead of low.
      const sigma = [1, 100, 0.1]
      const variance = sigma.map(s => s * s)
      const lnp = x => -0.5 * (x[0] * x[0] / variance[0] + x[1] * x[1] / variance[1] + x[2] * x[2] / variance[2])
      const grad = x => [-x[0] / variance[0], -x[1] / variance[1], -x[2] / variance[2]]

      it('should balance per-dimension ESS on a target with very different scales, and leave it unbalanced without warm-up', () => {
        const warmUpBatches = 20
        const sampleSize = 2000
        // A single seed's ratio is a noisy point estimate -- average over 3 independent seeds,
        // as the 5D correlated Normal ESS comparison test below does for the same reason.
        const seeds = [1, 2, 3]
        const adaptedRatios = seeds.map(seed => {
          const adapted = new HMC({ logDensity: lnp, gradLogDensity: grad, config: { dim: 3 }, initialState: { x: [0, 0, 0] } }).seed(seed)
          adapted.warmUp(null, warmUpBatches)
          adapted.sample(null, sampleSize)
          const adaptedEss = adapted.ess()
          return Math.max(...adaptedEss) / Math.min(...adaptedEss)
        })
        // No warmUp(): _adjust never runs, so the metric/step size stay at their identity defaults.
        const unadaptedRatios = seeds.map(seed => {
          const unadapted = new HMC({ logDensity: lnp, gradLogDensity: grad, config: { dim: 3 }, initialState: { x: [0, 0, 0] } }).seed(seed)
          unadapted.sample(null, sampleSize)
          const unadaptedEss = unadapted.ess()
          return Math.max(...unadaptedEss) / Math.min(...unadaptedEss)
        })
        const meanAdaptedRatio = adaptedRatios.reduce((a, b) => a + b, 0) / adaptedRatios.length
        const meanUnadaptedRatio = unadaptedRatios.reduce((a, b) => a + b, 0) / unadaptedRatios.length

        assert(meanAdaptedRatio < 3, `mean adapted per-dimension ESS ratio (${meanAdaptedRatio}) over seeds ${seeds} should be roughly balanced`)
        assert(meanUnadaptedRatio > 10, `mean unadapted per-dimension ESS ratio (${meanUnadaptedRatio}) over seeds ${seeds} should be markedly unbalanced`)
      })

      SEEDS.forEach(seed => {
        it(`should still recover the correct per-dimension margins under metric adaptation (KS test, seed ${seed})`, () => {
          // Guards against an M/M^-1 inversion bug that could improve ESS while silently biasing
          // the sampled distribution -- neither test above inspects the distribution itself.
          const hmc = new HMC({ logDensity: lnp, gradLogDensity: grad, config: { dim: 3 }, initialState: { x: [0, 0, 0] } }).seed(seed)
          hmc.warmUp(null, 20)
          const samples = hmc.sample(null, 2000)
          sigma.forEach((s, i) => {
            const ref = new Normal(0, s)
            assert(ksTest(samples.map(x => x[i]), x => ref.cdf(x)), `margin ${i} (sigma=${s}) failed KS test`)
          })
        })
      })
    })

    describe('dense metric (opt-in)', () => {
      it('should restore the adapted L/D factors on a state round-trip', () => {
        const hmc1 = new HMC({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2, metric: 'dense' } }).seed(11)
        hmc1.warmUp(null, 5)
        for (let i = 0; i < 100; i++) hmc1.iterate()
        const state = hmc1.state()
        // An empirical sample covariance is never bit-for-bit equal to the identity default.
        assert.notDeepEqual(state.internal.metric.D, [1, 1])
        const hmc2 = new HMC({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2, metric: 'dense' }, initialState: state })
        assert.deepEqual(hmc2.state().internal, state.internal)
      })

      SEEDS.forEach(seed => {
        it(`should still recover the correct margins of a correlated target under metric adaptation (KS test, seed ${seed})`, () => {
          // Same rationale as the diagonal metric's KS test above, applied to the dense metric's
          // sampling path (_sampleMomentum's back-substitution and _applyInverseMetric's L*D*L^T*p
          // product) -- both margins are standard Normal regardless of rho (see logDensity2D above).
          const hmc = new HMC({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2, metric: 'dense' } }).seed(seed)
          hmc.warmUp(null, 10)
          const samples = hmc.sample(null, 2000)
          const ref = new Normal(0, 1)
          assert(ksTest(samples.map(s => s[0]), x => ref.cdf(x)))
          assert(ksTest(samples.map(s => s[1]), x => ref.cdf(x)))
        })
      })

      it('should achieve higher effective sample size than the diagonal metric on a strongly correlated target', () => {
        // rho=0.99: both margins have unit variance, so only a dense metric (which captures the
        // correlation) can improve mixing here -- and rho this close to 1 keeps the diagonal
        // chain's autocorrelation positive/slowly-decaying instead of occasionally overshooting
        // into a spuriously ESS-inflating negative lag-1 value.
        const rho = 0.99
        const c = 1 - rho * rho
        const lnp = x => -0.5 * (x[0] * x[0] - 2 * rho * x[0] * x[1] + x[1] * x[1]) / c
        const grad = x => [-(x[0] - rho * x[1]) / c, -(x[1] - rho * x[0]) / c]

        const warmUpBatches = 20
        // Dense and diagonal auto-tune different samplingRate (thinning), so calling sample()
        // and reading its thinned sample count would compare different raw-iteration budgets --
        // fixing a raw count via sample(null, 0) + manual iterate() avoids that confound.
        const rawIterations = 6000

        const seeds = [1, 2, 3]
        const ratios = seeds.map(seed => {
          const dense = new HMC({ logDensity: lnp, gradLogDensity: grad, config: { dim: 2, metric: 'dense' } }).seed(seed)
          dense.warmUp(null, warmUpBatches)
          dense.sample(null, 0)
          for (let i = 0; i < rawIterations; i++) dense.iterate()
          const denseEss = dense.ess()

          const diag = new HMC({ logDensity: lnp, gradLogDensity: grad, config: { dim: 2 } }).seed(seed)
          diag.warmUp(null, warmUpBatches)
          diag.sample(null, 0)
          for (let i = 0; i < rawIterations; i++) diag.iterate()
          const diagEss = diag.ess()

          const meanDense = denseEss.reduce((a, b) => a + b, 0) / denseEss.length
          const meanDiag = diagEss.reduce((a, b) => a + b, 0) / diagEss.length
          return meanDense / meanDiag
        })
        const meanRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length

        assert(meanRatio > 1.1, `dense/diagonal mean ESS ratio (${meanRatio}) over seeds ${seeds} should exceed 1.1`)
      })

      it('should produce identical ESS-balance behavior across two independently constructed dense-metric samplers seeded alike', () => {
        // Reconfirms determinism after the full metric-adaptation pipeline (covariance
        // accumulation across warm-up batches, periodic LDL refresh), not just a single
        // post-construction iterate() call.
        const rho = 0.99
        const c = 1 - rho * rho
        const lnp = x => -0.5 * (x[0] * x[0] - 2 * rho * x[0] * x[1] + x[1] * x[1]) / c
        const grad = x => [-(x[0] - rho * x[1]) / c, -(x[1] - rho * x[0]) / c]

        const a = new HMC({ logDensity: lnp, gradLogDensity: grad, config: { dim: 2, metric: 'dense' } }).seed(7)
        const b = new HMC({ logDensity: lnp, gradLogDensity: grad, config: { dim: 2, metric: 'dense' } }).seed(7)

        const rawIterations = 6000;
        [a, b].forEach(hmc => {
          hmc.warmUp(null, 20)
          hmc.sample(null, 0)
          for (let i = 0; i < rawIterations; i++) hmc.iterate()
        })

        assert.deepStrictEqual(a.ess(), b.ess())
      })
    })
  })

  describe('.ar() during sampling', () => {
    [1, 2, 3].forEach(seed => {
      it(`should lie in [0.6, 0.9] for a well-tuned 1D Normal target, seed ${seed}`, () => {
        const hmc = new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(seed)
        hmc.warmUp(null, 10)
        hmc.sample(null, 1000)
        const ar = hmc.ar()
        assert(ar >= 0.6 && ar <= 0.9, `acceptance rate ${ar} outside [0.6, 0.9]`)
      })
    })
  })

  describe('.sample() distributional test', () => {
    SEEDS.forEach(seed => {
      it(`should recover both margins of a correlated bivariate Normal target (KS test, seed ${seed})`, () => {
        const hmc = new HMC({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2 } }).seed(seed)
        hmc.warmUp(null, 10)
        const samples = hmc.sample(null, 2000)
        const ref = new Normal(0, 1)
        assert(ksTest(samples.map(s => s[0]), x => ref.cdf(x)))
        assert(ksTest(samples.map(s => s[1]), x => ref.cdf(x)))
      })
    })
  })

  describe('.seed()', () => {
    [0, 42, 12345].forEach(seed => {
      it(`should produce bitwise-identical samples when seed ${seed} is applied twice`, () => {
        const hmc1 = new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(seed)
        hmc1.warmUp(null, 3)
        const samples1 = hmc1.sample(null, 50)

        const hmc2 = new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(seed)
        hmc2.warmUp(null, 3)
        const samples2 = hmc2.sample(null, 50)

        assert.deepEqual(samples1, samples2)
      })
    })

    it('should produce different samples for different seeds', () => {
      const hmc1 = new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(1)
      hmc1.warmUp(null, 3)
      const samples1 = hmc1.sample(null, 50)

      const hmc2 = new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(2)
      hmc2.warmUp(null, 3)
      const samples2 = hmc2.sample(null, 50)

      assert.notDeepEqual(samples1, samples2)
    })
  })
})
