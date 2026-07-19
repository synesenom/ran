import { assert } from 'chai'
import { describe, it } from 'mocha'
import Slice from '../../src/mc/slice'
import { Normal } from '../../src/dist'
import { ksTest } from '../test-utils'
import { SEEDS } from './_helpers'

describe('mc.Slice', () => {
  describe('constructor', () => {
    it('should instantiate without error for a 1D Normal target', () => {
      assert.doesNotThrow(() => new Slice({ logDensity: x => -0.5 * x[0] * x[0], config: { dim: 1 } }))
    })

    it('should default w to 1.0 per dimension when omitted', () => {
      const slice = new Slice({ logDensity: x => -0.5 * x[0] * x[0], config: { dim: 1 } })
      assert.deepEqual(slice.state().internal.w, [1.0])
    })

    it('should broadcast an explicit scalar w from initialState.internal to every dimension', () => {
      const slice = new Slice({ logDensity: x => -0.5 * (x[0] * x[0] + x[1] * x[1]), config: { dim: 2 }, initialState: { internal: { w: 2.5 } } })
      assert.deepEqual(slice.state().internal.w, [2.5, 2.5])
    })

    it('should throw for w: 0', () => {
      assert.throws(() => new Slice({ logDensity: x => -0.5 * x[0] * x[0], config: { dim: 1 }, initialState: { internal: { w: 0 } } }), /w must be a positive number/)
    })

    it('should throw for a negative w', () => {
      assert.throws(() => new Slice({ logDensity: x => -0.5 * x[0] * x[0], config: { dim: 1 }, initialState: { internal: { w: -1 } } }), /w must be a positive number/)
    })

    it('should throw for a non-finite w', () => {
      assert.throws(() => new Slice({ logDensity: x => -0.5 * x[0] * x[0], config: { dim: 1 }, initialState: { internal: { w: NaN } } }), /w must be a positive number/)
    })

    it('should throw for w: Infinity', () => {
      // Infinity passes a naive `typeof w === 'number' && w > 0` check but breaks _stepOut
      // (l = x0 - Infinity * U = -Infinity, r = l + Infinity = NaN), so it must be rejected here.
      assert.throws(() => new Slice({ logDensity: x => -0.5 * x[0] * x[0], config: { dim: 1 }, initialState: { internal: { w: Infinity } } }), /w must be a positive number/)
    })

    it('should throw when a per-dimension w array contains a non-positive entry', () => {
      assert.throws(() => new Slice({ logDensity: x => -0.5 * (x[0] * x[0] + x[1] * x[1]), config: { dim: 2 }, initialState: { internal: { w: [1, 0] } } }), /w must be a positive number/)
    })

    it('should throw when w is neither a number nor an array (e.g. a string)', () => {
      assert.throws(() => new Slice({ logDensity: x => -0.5 * x[0] * x[0], config: { dim: 1 }, initialState: { internal: { w: 'oops' } } }), /w must be a positive number/)
    })

    it('should throw when w is null (an object, silently coerced to the default before this fix)', () => {
      assert.throws(() => new Slice({ logDensity: x => -0.5 * x[0] * x[0], config: { dim: 1 }, initialState: { internal: { w: null } } }), /w must be a positive number/)
    })

    it('should throw when a per-dimension w array length does not match dim', () => {
      assert.throws(() => new Slice({ logDensity: x => -0.5 * (x[0] * x[0] + x[1] * x[1]), config: { dim: 2 }, initialState: { internal: { w: [1] } } }), /w must be a positive number/)
    })

    it('should default config and initialState when omitted entirely from the options object', () => {
      const slice = new Slice({ logDensity: x => -0.5 * x[0] * x[0] })
      assert.strictEqual(slice.dim, 1)
      assert.strictEqual(slice.maxLag, 100)
      assert.deepEqual(slice.state().internal.w, [1.0])
    })

    it('should resolve config when initialState is omitted from the options object', () => {
      const slice = new Slice({ logDensity: x => -0.5 * (x[0] * x[0] + x[1] * x[1]), config: { dim: 2 } })
      assert.strictEqual(slice.dim, 2)
    })

    it('should resolve initialState when config is omitted from the options object', () => {
      const slice = new Slice({ logDensity: () => 0, initialState: { x: [7] } })
      assert.deepStrictEqual(slice.x, [7])
    })

    it('should validate config', () => {
      assert.throws(() => new Slice({ logDensity: () => 0, config: { dim: 0 } }), /dim must be a positive integer/)
    })

    it('should validate w when config is omitted', () => {
      assert.throws(() => new Slice({ logDensity: () => 0, initialState: { internal: { w: 0 } } }), /w must be a positive number/)
    })

    it('should throw a clear error when called with no arguments', () => {
      assert.throws(() => new Slice(), /Slice: constructor requires an options object/)
    })

    it('should throw a clear error when called with null', () => {
      assert.throws(() => new Slice(null), /Slice: constructor requires an options object/)
    })

    it('should throw a clear error when called with an array', () => {
      assert.throws(() => new Slice([1, 2]), /Slice: constructor requires an options object/)
    })

    it('should throw a clear error when called with a non-object primitive', () => {
      assert.throws(() => new Slice(42), /Slice: constructor requires an options object/)
      assert.throws(() => new Slice('logDensity'), /Slice: constructor requires an options object/)
    })
  })

  describe('._iter()', () => {
    it('should update every dimension within one sweep', () => {
      // Continuous target: P(new coordinate === old coordinate) = 0, so any
      // accepted draw differing in every dimension confirms the full sweep ran,
      // not just a subset of dimensions.
      const slice = new Slice({ logDensity: x => -0.5 * (x[0] * x[0] + x[1] * x[1]), config: { dim: 2 }, initialState: { x: [0, 0] } }).seed(11)
      const prev = slice.x.slice()
      const { x, accepted } = slice.iterate()
      assert.strictEqual(accepted, true)
      assert.notStrictEqual(x[0], prev[0])
      assert.notStrictEqual(x[1], prev[1])
    })

    it('should throw rather than hang when logDensity returns NaN inside the bracket', () => {
      // logY = lnp(x1) - (-log U) becomes NaN when lnp is NaN, so lnp(candidate) > logY is always
      // false and _shrink narrows the interval forever without ever accepting — the same
      // infinite-loop failure class already guarded for w: Infinity, but in the shrink step. A
      // bounded cap must convert the runaway into a thrown error instead of an unbounded hang.
      const slice = new Slice({ logDensity: () => NaN, config: { dim: 1 }, initialState: { x: [0] } }).seed(1)
      assert.throws(() => slice.iterate(), /shrink/i)
    })
  })

  describe('.ar()', () => {
    it('should always be 1.0 regardless of the number of iterations', () => {
      const slice = new Slice({ logDensity: x => -0.5 * x[0] * x[0], config: { dim: 1 } })
      for (let i = 0; i < 5; i++) {
        slice.iterate()
        assert.strictEqual(slice.ar(), 1.0)
      }
      for (let i = 0; i < 200; i++) slice.iterate()
      assert.strictEqual(slice.ar(), 1.0)
    })
  })

  describe('.state() round-trip', () => {
    it('should restore position, samplingRate, and the adapted w', () => {
      const lnp = x => -0.5 * x[0] * x[0]
      const slice1 = new Slice({ logDensity: lnp, config: { dim: 1 } }).seed(3)
      slice1.warmUp(null, 3)
      const state = slice1.state()
      const slice2 = new Slice({ logDensity: lnp, config: { dim: 1 }, initialState: state })
      assert.deepEqual(slice2.x, state.x)
      assert.strictEqual(slice2.samplingRate, state.samplingRate)
      assert.deepEqual(slice2.state().internal.w, state.internal.w)
    })
  })

  describe('.state() stream-level reproducible resume', () => {
    // Mirrors what warmUp() does per-iteration (iterate(null, true) + _adjust), without its
    // coarse 1e4-iteration batching, so a snapshot can land strictly mid-adaptation-window —
    // iterate() alone never calls _adjust() (only warmUp() does), so exercising the batch
    // adaptation accumulators requires driving both explicitly.
    const runAdapted = (slice, n) => {
      const positions = []
      for (let i = 0; i < n; i++) {
        slice._adjust(slice.iterate(null, true))
        positions.push(slice.x.slice())
      }
      return positions
    }

    it('should produce bit-for-bit identical subsequent draws (including w adaptation) after resuming mid-warm-up', () => {
      const lnp = x => -0.5 * x[0] * x[0]
      const slice1 = new Slice({ logDensity: lnp, config: { dim: 1 } }).seed(7)
      // 150 iterations crosses one BATCH=100 adaptation window, so the snapshot below captures
      // mid-second-window state, not just a fresh/aligned start.
      runAdapted(slice1, 150)
      const state = slice1.state()

      const slice2 = new Slice({ logDensity: lnp, config: { dim: 1 }, initialState: state })

      // 150 more iterations crosses a second adaptation-batch boundary post-resume.
      const continued1 = runAdapted(slice1, 150)
      const continued2 = runAdapted(slice2, 150)
      assert.deepEqual(continued1, continued2)
      assert.deepEqual(slice1.state().internal, slice2.state().internal)
    })
  })

  describe('warm-up adaptation', () => {
    it('should grow w toward the target scale, not diverge unboundedly', () => {
      // Normal(0, 10): lnp(x) = -0.5 * x^2 / 100. Two-sided bound: a lower bound alone would
      // still pass if the Robbins-Monro sign were inverted-but-always-grows (w can reach
      // ~exp(1000 * 0.01) = ~22026 if the adaptation never settles toward an equilibrium), so
      // the upper bound catches runaway growth that a one-sided check would miss.
      const slice = new Slice({ logDensity: x => -0.5 * x[0] * x[0] / 100, config: { dim: 1 } }).seed(13)
      slice.warmUp(null, 10)
      const w = slice.state().internal.w[0]
      assert(w > 2 && w < 200, `w = ${w}, expected to settle near the target's scale, neither stuck near the default nor diverging`)
    })
  })

  describe('.sample() distributional test', () => {
    SEEDS.forEach(seed => {
      it(`should produce samples matching Normal(0,1) target (KS test, seed ${seed})`, () => {
        const slice = new Slice({ logDensity: x => -0.5 * x[0] * x[0], config: { dim: 1 } }).seed(seed)
        slice.warmUp(null, 10)
        const samples = slice.sample(null, 2000)
        const values = samples.map(s => s[0])
        const ref = new Normal(0, 1)
        assert(ksTest(values, x => ref.cdf(x)))
      })
    })

    SEEDS.forEach(seed => {
      it(`should recover both margins of a correlated bivariate Normal target (KS test, seed ${seed})`, () => {
        const rho = 0.5
        const lnp = x => -0.5 / (1 - rho * rho) * (x[0] * x[0] - 2 * rho * x[0] * x[1] + x[1] * x[1])
        const slice = new Slice({ logDensity: lnp, config: { dim: 2 }, initialState: { x: [0, 0] } }).seed(seed)
        slice.warmUp(null, 10)
        const samples = slice.sample(null, 2000)
        const ref = new Normal(0, 1)
        assert(ksTest(samples.map(s => s[0]), x => ref.cdf(x)))
        assert(ksTest(samples.map(s => s[1]), x => ref.cdf(x)))
      })
    })
  })
})
