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

    it('should throw for a malformed resumed prngQ', () => {
      assert.throws(
        () => new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 }, initialState: { internal: { prngQ: [1, 2, 3] } } }),
        /NUTS: prng state must be an array of 4 finite numbers/
      )
    })

    it('should throw when resumed daMu/daHbar/daLogEpsBar are not finite', () => {
      assert.throws(
        () => new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 }, initialState: { internal: { daMu: Infinity } } }),
        /NUTS: resumed daMu must be a finite number/
      )
      assert.throws(
        () => new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 }, initialState: { internal: { daHbar: NaN } } }),
        /NUTS: resumed daHbar must be a finite number/
      )
      assert.throws(
        () => new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 }, initialState: { internal: { daLogEpsBar: Infinity } } }),
        /NUTS: resumed daLogEpsBar must be a finite number/
      )
    })

    it('should throw when resumed daT is not a non-negative integer', () => {
      assert.throws(
        () => new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 }, initialState: { internal: { daT: -1 } } }),
        /NUTS: resumed daT must be a non-negative integer/
      )
    })
  })

  describe('constructor — metric', () => {
    it('should default to a diagonal metric when config.metric is omitted', () => {
      const nuts = new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } })
      assert.strictEqual(nuts.state().internal.metric.type, 'diag')
    })

    it('should throw when config.metric is neither diag nor dense', () => {
      assert.throws(
        () => new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, metric: 'full' } }),
        /metric must be 'diag' or 'dense'/
      )
    })

    it('should throw when a dense metric is requested with a dimension above the dense cap', () => {
      // Mirrors HMC's dense-dim guard: a dense covariance accumulator is dim x dim, which the base
      // class's dim*maxLag footprint check does not bound.
      assert.throws(
        () => new NUTS({ logDensity: () => 0, gradLogDensity: () => new Array(1001).fill(0), config: { dim: 1001, metric: 'dense' } }),
        /metric: 'dense' requires dim to be at most/
      )
    })

    it('should throw when a resumed internal.metric type does not match the resolved metric', () => {
      // initialState.internal is caller-supplied the same way config is — a mismatched resumed
      // metric must be rejected, not silently reinterpreted.
      assert.throws(
        () => new NUTS({
          logDensity: logDensity1D,
          gradLogDensity: gradLogDensity1D,
          config: { dim: 1 },
          initialState: { internal: { metric: { type: 'dense', L: [[1]], D: [1] } } }
        }),
        /resumed metric type does not match/
      )
    })

    it('should throw when a resumed diagonal metric.variance is not an array of positive finite numbers', () => {
      assert.throws(
        () => new NUTS({
          logDensity: logDensity1D,
          gradLogDensity: gradLogDensity1D,
          config: { dim: 1 },
          initialState: { internal: { metric: { type: 'diag', variance: [-1] } } }
        }),
        /resumed metric.variance must be an array of dim positive finite numbers/
      )
    })

    it('should throw when a resumed dense metric.D is not an array of positive finite numbers', () => {
      assert.throws(
        () => new NUTS({
          logDensity: logDensity2D,
          gradLogDensity: gradLogDensity2D,
          config: { dim: 2, metric: 'dense' },
          initialState: { internal: { metric: { type: 'dense', L: [[1, 0], [0, 1]], D: [1, -1] } } }
        }),
        /resumed metric.D must be an array of dim positive finite numbers/
      )
    })

    it('should throw when a resumed dense metric.L is not a dim x dim array of finite numbers', () => {
      assert.throws(
        () => new NUTS({
          logDensity: logDensity2D,
          gradLogDensity: gradLogDensity2D,
          config: { dim: 2, metric: 'dense' },
          initialState: { internal: { metric: { type: 'dense', L: [[1, 0]], D: [1, 1] } } }
        }),
        /resumed metric.L must be a dim x dim array of finite numbers/
      )
    })

    it('should not throw for a valid dense metric on a small dimension', () => {
      assert.doesNotThrow(() => new NUTS({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2, metric: 'dense' } }))
    })

    it('should throw when a resumed metAccumulator has a malformed metN', () => {
      assert.throws(
        () => new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 }, initialState: { internal: { metAccumulator: { metN: -1, metMean: [0], metM2: [0] } } } }),
        /NUTS: resumed metAccumulator.metN must be a non-negative integer/
      )
    })

    it('should throw when a resumed diagonal metAccumulator.metM2 has the wrong length', () => {
      assert.throws(
        () => new NUTS({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2 }, initialState: { internal: { metAccumulator: { metN: 5, metMean: [0, 0], metM2: [0] } } } }),
        /NUTS: resumed metAccumulator.metM2 must be an array of 2 finite numbers/
      )
    })

    it('should throw when a resumed dense metAccumulator.metCovS is not a dim x dim matrix', () => {
      assert.throws(
        () => new NUTS({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2, metric: 'dense' }, initialState: { internal: { metAccumulator: { metN: 5, metMean: [0, 0], metCovS: [[1, 2], [3]] } } } }),
        /NUTS: resumed metAccumulator.metCovS must be a 2 x 2 array of finite numbers/
      )
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

    it('should not let a NaN acceptance statistic permanently freeze the dual-averaging step size', () => {
      // A hand-written gradient that returns NaN once the chain wanders past a boundary (instead of
      // a rigorous -Infinity) makes the tree-averaged acceptance statistic NaN. Without a finiteness
      // guard in _adjust, that NaN is sticky: it propagates through the Robbins-Monro recursion into
      // stepSize and freezes the sampler permanently. The tuned step size must stay finite/positive.
      const lnp = x => -0.5 * x[0] * x[0]
      const grad = x => [x[0] > 1 ? NaN : -x[0]]
      const nuts = new NUTS({ logDensity: lnp, gradLogDensity: grad, config: { dim: 1 }, initialState: { x: [0] } }).seed(42)
      nuts.warmUp(null, 2)
      const step = nuts.state().internal.stepSize
      assert(Number.isFinite(step) && step > 0, `stepSize should stay finite and positive, got ${step}`)
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

  describe('.state() stream-level reproducible resume', () => {
    // Mirrors what warmUp() does per-iteration (iterate(null, true) + _adjust) — iterate() alone
    // never calls _adjust(), so exercising dual averaging requires driving both explicitly. This
    // also exercises this.r.next() draws NUTS consumes directly inside _growTree for
    // direction/slice/subtree-selection, since this.r is restored by the base class alone.
    const runAdapted = (nuts, n) => {
      const positions = []
      for (let i = 0; i < n; i++) {
        nuts._adjust(nuts.iterate(null, true))
        positions.push(nuts.x.slice())
      }
      return positions
    }

    it('should produce bit-for-bit identical subsequent draws after resuming mid-warm-up', () => {
      const nuts1 = new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(11)
      runAdapted(nuts1, 20)
      const state = nuts1.state()

      const nuts2 = new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 }, initialState: state })

      const continued1 = runAdapted(nuts1, 20)
      const continued2 = runAdapted(nuts2, 20)
      assert.deepEqual(continued1, continued2)
      assert.deepEqual(nuts1.state().internal, nuts2.state().internal)
    })

    it('should produce bit-for-bit identical subsequent draws after resuming mid-warm-up (dense metric)', () => {
      // NUTS gained Euclidean metric adaptation (diag/dense) after this issue's initial
      // implementation landed — extending resume coverage to the metric accumulator here keeps
      // NUTS at parity with HMC's own diag/dense resume coverage rather than leaving a gap.
      const nuts1 = new NUTS({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2, metric: 'dense' } }).seed(11)
      runAdapted(nuts1, 20)
      const state = nuts1.state()

      const nuts2 = new NUTS({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2, metric: 'dense' }, initialState: state })

      const continued1 = runAdapted(nuts1, 20)
      const continued2 = runAdapted(nuts2, 20)
      assert.deepEqual(continued1, continued2)
      assert.deepEqual(nuts1.state().internal, nuts2.state().internal)
    })
  })

  describe('mass matrix adaptation', () => {
    describe('diagonal metric (default)', () => {
      // Independent 10D Normal with per-dimension sigma spanning ~60x — the issue's "10-dimensional
      // differently-scaled Normal" acceptance target. With an identity metric a single step size
      // cannot suit both the widest and narrowest directions, so per-dimension ESS is markedly
      // imbalanced; the adapted diagonal metric rescales every direction to unit variance and
      // balances it. Scales kept moderate (not 1000x) so the *unadapted* baseline's leapfrog stays
      // within its stability margin instead of diverging, matching HMC's diagonal-metric test.
      const sigma = [0.2, 0.3, 0.5, 0.8, 1, 1.5, 2.5, 4, 7, 12]
      const variance = sigma.map(s => s * s)
      const dim = sigma.length
      const lnp = x => -0.5 * x.reduce((s, xi, i) => s + xi * xi / variance[i], 0)
      const grad = x => x.map((xi, i) => -xi / variance[i])
      const zeros = new Array(dim).fill(0)

      it('should balance per-dimension ESS on a target with very different scales, and leave it unbalanced without warm-up', () => {
        const warmUpBatches = 20
        const sampleSize = 2000
        // A single seed's ratio is a noisy point estimate — average over 3 independent seeds, as
        // HMC's diagonal-metric ESS-balance test does for the same reason.
        const seeds = [1, 2, 3]
        const adaptedRatios = seeds.map(seed => {
          const adapted = new NUTS({ logDensity: lnp, gradLogDensity: grad, config: { dim }, initialState: { x: zeros } }).seed(seed)
          adapted.warmUp(null, warmUpBatches)
          adapted.sample(null, sampleSize)
          const e = adapted.ess()
          return Math.max(...e) / Math.min(...e)
        })
        // No warmUp(): _adjust never runs, so the metric stays at its identity default (stepSize
        // stays at 0.1 too) — the identity-metric baseline the issue compares against.
        const unadaptedRatios = seeds.map(seed => {
          const unadapted = new NUTS({ logDensity: lnp, gradLogDensity: grad, config: { dim }, initialState: { x: zeros } }).seed(seed)
          unadapted.sample(null, sampleSize)
          const e = unadapted.ess()
          return Math.max(...e) / Math.min(...e)
        })
        const meanAdapted = adaptedRatios.reduce((a, b) => a + b, 0) / adaptedRatios.length
        const meanUnadapted = unadaptedRatios.reduce((a, b) => a + b, 0) / unadaptedRatios.length

        // Two independent absolute bounds (mirroring HMC's diagonal-metric ESS-balance test),
        // not a single relative one: the adapted metric must be *well* balanced in absolute terms
        // AND the identity baseline must be markedly imbalanced, so neither a mildly-imbalanced
        // baseline nor a partially-balancing metric can trivially satisfy the assertion. Bounds
        // derived empirically from the fixed seeds [1,2,3] (deterministic given the seed): observed
        // meanAdapted ≈ 1.25 (per-seed 1.21–1.29), meanUnadapted ≈ 7.71 (per-seed 6.54–10.03).
        assert(meanAdapted < 2, `adapted per-dimension ESS ratio (${meanAdapted}) should be well balanced (< 2)`)
        assert(meanUnadapted > 5, `identity-baseline per-dimension ESS ratio (${meanUnadapted}) should be markedly imbalanced (> 5)`)
      })

      SEEDS.forEach(seed => {
        it(`should still recover the correct per-dimension margins under metric adaptation (KS test, seed ${seed})`, () => {
          // Guards against an *inconsistent* use of M vs M⁻¹ across the sampling paths (e.g.
          // _sampleMomentum and _applyInverseMetric disagreeing), which biases the sampled
          // distribution — the ESS-balance test above does not inspect the distribution. Note the
          // limit of this guard: NUTS's stationary distribution is invariant under any consistent
          // positive-definite metric, so a systematically-swapped-but-internally-consistent M/M⁻¹
          // (a valid, merely inefficient metric) is invisible here and is caught only by the
          // ESS-balance test's efficiency check.
          const smallSigma = [1, 3, 0.5]
          const smallVar = smallSigma.map(s => s * s)
          const lnp3 = x => -0.5 * (x[0] * x[0] / smallVar[0] + x[1] * x[1] / smallVar[1] + x[2] * x[2] / smallVar[2])
          const grad3 = x => [-x[0] / smallVar[0], -x[1] / smallVar[1], -x[2] / smallVar[2]]
          const nuts = new NUTS({ logDensity: lnp3, gradLogDensity: grad3, config: { dim: 3 }, initialState: { x: [0, 0, 0] } }).seed(seed)
          nuts.warmUp(null, 20)
          const samples = nuts.sample(null, 2000)
          smallSigma.forEach((s, i) => {
            const ref = new Normal(0, s)
            assert(ksTest(samples.map(x => x[i]), x => ref.cdf(x)), `margin ${i} (sigma=${s}) failed KS test`)
          })
        })
      })
    })

    describe('dense metric (opt-in)', () => {
      it('should restore the adapted L/D factors on a state round-trip', () => {
        const nuts1 = new NUTS({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2, metric: 'dense' } }).seed(11)
        nuts1.warmUp(null, 5)
        for (let i = 0; i < 100; i++) nuts1.iterate()
        const state = nuts1.state()
        // An empirical sample covariance is never bit-for-bit equal to the identity default.
        assert.notDeepEqual(state.internal.metric.D, [1, 1])
        const nuts2 = new NUTS({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2, metric: 'dense' }, initialState: state })
        assert.deepEqual(nuts2.state().internal, state.internal)
      })

      SEEDS.forEach(seed => {
        it(`should still recover the correct margins of a correlated target under metric adaptation (KS test, seed ${seed})`, () => {
          // Exercises the dense sampling path (_sampleMomentum back-substitution and
          // _applyInverseMetric's L*D*L^T*p product) — both margins are standard Normal regardless
          // of rho (see logDensity2D above).
          const nuts = new NUTS({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2, metric: 'dense' } }).seed(seed)
          nuts.warmUp(null, 10)
          const samples = nuts.sample(null, 2000)
          const ref = new Normal(0, 1)
          assert(ksTest(samples.map(s => s[0]), x => ref.cdf(x)))
          assert(ksTest(samples.map(s => s[1]), x => ref.cdf(x)))
        })
      })
    })

    it('should evaluate the no-U-turn criterion on the velocity M⁻¹r, not the raw momentum r', () => {
      // The PR's central correctness fix: under a non-identity metric the U-turn test must dot
      // (x⁺−x⁻) with the velocity M⁻¹r (Betancourt 2017), not the raw momentum. This locks that
      // NUTS._noUTurn returns the verdict of whatever vectors it is handed as its 2nd/4th args, and
      // exhibits a concrete case where the raw-momentum and velocity verdicts DIFFER — so a
      // regression that reverted the tree to passing raw momenta would flip this result.
      const xMinus = [0, 0]
      const xPlus = [1, 1] // dx = (x⁺−x⁻) = [1, 1]
      const momentum = [3, -1] // dx·r = 3 − 1 = 2 ≥ 0  → raw-momentum criterion says "keep going"
      // Diagonal metric variance [0.1, 10] ⇒ M⁻¹ is elementwise multiply by variance, so the
      // velocity is [0.1·3, 10·(−1)] = [0.3, −10]; dx·vel = 0.3 − 10 = −9.7 < 0 → "U-turn".
      const velocity = [0.3, -10]
      assert.strictEqual(NUTS._noUTurn(xMinus, velocity, xPlus, velocity), 0, 'velocity-based criterion should detect the U-turn')
      assert.strictEqual(NUTS._noUTurn(xMinus, momentum, xPlus, momentum), 1, 'raw-momentum criterion would wrongly continue — confirming the two disagree')
    })

    it('should serialize the diagonal metric variance in state().internal.metric after warm-up', () => {
      const nuts = new NUTS({ logDensity: logDensity2D, gradLogDensity: gradLogDensity2D, config: { dim: 2 } }).seed(3)
      nuts.warmUp(null, 10)
      const metric = nuts.state().internal.metric
      assert.strictEqual(metric.type, 'diag')
      assert.strictEqual(metric.variance.length, 2)
      // Adapted away from the all-ones identity default.
      assert.notDeepEqual(metric.variance, [1, 1])
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

        const hmc = new HMC({ logDensity: essLogDensity, gradLogDensity: essGradLogDensity, config: { dim: 2 } }).seed(seed)
        hmc.warmUp(null, warmUpBatches)
        const hmcSamples = hmc.sample(null, sampleSize)
        const hmcEssPerIter = ess(hmc) / (hmc.samplingRate * hmcSamples.length)

        return nutsEssPerIter / hmcEssPerIter
      })
      const meanRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length

      assert(meanRatio > 2, `NUTS/HMC mean ESS-per-iteration ratio (${meanRatio}) over seeds ${seeds} should exceed 2`)
    })
  })

  describe('sampler-health diagnostics', () => {
    it('should expose boolean divergent and maxDepthHit fields on each iterate() result', () => {
      const nuts = new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(0)
      const i = nuts.iterate()
      assert.strictEqual(typeof i.divergent, 'boolean')
      assert.strictEqual(typeof i.maxDepthHit, 'boolean')
      // Concrete values, not just types: a benign default-stepSize standard-Normal transition is
      // neither divergent nor depth-saturated, so a bug that hard-codes either flag is caught here.
      assert.strictEqual(i.divergent, false)
      assert.strictEqual(i.maxDepthHit, false)
    })

    it('should report zero divergent transitions and zero max-depth hits for a well-behaved standard-Normal target', () => {
      // A tuned standard Normal is the most benign NUTS target: no energy divergences and a
      // trajectory that U-turns well before MAX_TREE_DEPTH. Swept over the fixed seed set so a
      // regression must break reproducibly, not carry a flake rate (see _helpers.js).
      SEEDS.forEach(seed => {
        const nuts = new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(seed)
        nuts.warmUp(null, 3)
        nuts.sample(null, 200)
        assert.strictEqual(nuts.divergenceCount(), 0, `seed ${seed}: expected no divergences`)
        assert.strictEqual(nuts.maxDepthCount(), 0, `seed ${seed}: expected no max-depth hits`)
      })
    })

    it('should report zero counts before any sampling (fresh construction)', () => {
      const nuts = new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1 } }).seed(0)
      assert.strictEqual(nuts.divergenceCount(), 0)
      assert.strictEqual(nuts.maxDepthCount(), 0)
    })

    it('should report divergent transitions for an aggressively oversized step size', () => {
      // An untuned, deliberately huge fixed step size on a standard Normal makes every leapfrog leaf
      // overshoot so far that its Hamiltonian drifts past DELTA_MAX, tripping the energy-divergence
      // guard. No warm-up, so dual averaging never tunes the step down. Divergence must be counted
      // distinctly from the U-turn stops a healthy chain produces.
      SEEDS.forEach(seed => {
        const nuts = new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, stepSize: 25 } }).seed(seed)
        nuts.sample(null, 200)
        // Bound well above 1: at stepSize 25 essentially every one of the 200 transitions diverges
        // (measured 199–200 across the seed set). A plain > 0 would still pass if the counter
        // fired once and then stopped incrementing, so require the diagnostic to fire on the vast
        // majority of transitions, not merely at least one.
        assert(nuts.divergenceCount() > 150, `seed ${seed}: expected divergenceCount > 150, got ${nuts.divergenceCount()}`)
      })
    })

    it('should report max-depth hits for an aggressively undersized step size', () => {
      // A tiny fixed step size means many transitions need more than 2^MAX_TREE_DEPTH leapfrog steps
      // before the trajectory can U-turn, so the doubling loop saturates at MAX_TREE_DEPTH on a large
      // fraction of the 30 transitions (measured 14–24 across the seed set — not literally every one,
      // since some trajectories still U-turn within the cap). No divergences arise (tiny steps keep
      // the energy error negligible). Bound above 1 so a fire-once-then-stop accumulation bug fails.
      SEEDS.forEach(seed => {
        const nuts = new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, stepSize: 1e-3 } }).seed(seed)
        nuts.sample(null, 30)
        assert(nuts.maxDepthCount() > 5, `seed ${seed}: expected maxDepthCount > 5, got ${nuts.maxDepthCount()}`)
        assert.strictEqual(nuts.divergenceCount(), 0, `seed ${seed}: tiny step should not diverge`)
      })
    })

    it('should reset counts at sample() start so warm-up divergences do not leak into the sampling phase', () => {
      // Constructed with a huge step so early warm-up diverges; dual averaging then tunes the step
      // down. Reading divergenceCount() after warmUp() sees the accumulated warm-up divergences
      // (ADR-0023: no reset between/within warm-up), and sample() resets so the sampling-phase count
      // starts fresh — proving the counter is per-phase, not cumulative. Swept over the fixed seed
      // set per the _helpers.js policy, since the assertion depends on the RNG trajectory.
      SEEDS.forEach(seed => {
        const nuts = new NUTS({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, stepSize: 25 } }).seed(seed)
        nuts.warmUp(null, 1)
        const warmUpDivergences = nuts.divergenceCount()
        assert(warmUpDivergences > 0, `seed ${seed}: expected warm-up to record divergences, got ${warmUpDivergences}`)
        nuts.sample(null, 200)
        assert(nuts.divergenceCount() < warmUpDivergences, `seed ${seed}: sampling-phase count (${nuts.divergenceCount()}) should reset below the warm-up count (${warmUpDivergences})`)
      })
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
