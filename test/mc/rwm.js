import { assert } from 'chai'
import { describe, it } from 'mocha'
import RWM from '../../src/mc/rwm'
import { Normal } from '../../src/dist'
import { ksTest } from '../test-utils'
import { SEEDS } from './_helpers'

describe('mc.RWM', () => {
  describe('constructor', () => {
    it('should instantiate without error for a 1D Normal target', () => {
      assert.doesNotThrow(() => new RWM({ logDensity: x => -0.5 * x[0] * x[0], config: { dim: 1 } }))
    })

    it('should default config and initialState when omitted entirely from the options object', () => {
      const rwm = new RWM({ logDensity: x => -0.5 * x[0] * x[0] })
      assert.strictEqual(rwm.dim, 1)
      assert.strictEqual(rwm.maxLag, 100)
    })

    it('should resolve config when initialState is omitted from the options object', () => {
      const rwm = new RWM({ logDensity: x => -0.5 * (x[0] * x[0] + x[1] * x[1]), config: { dim: 2 } })
      assert.strictEqual(rwm.dim, 2)
    })

    it('should resolve initialState when config is omitted from the options object', () => {
      const rwm = new RWM({ logDensity: () => 0, initialState: { x: [7] } })
      assert.deepStrictEqual(rwm.x, [7])
    })

    it('should validate config', () => {
      assert.throws(() => new RWM({ logDensity: () => 0, config: { dim: 0 } }), /dim must be a positive integer/)
    })

    it('should throw a clear error when called with null', () => {
      assert.throws(() => new RWM(null), /RWM: constructor requires an options object/)
    })

    it('should throw a clear error when called with an array', () => {
      assert.throws(() => new RWM([1, 2]), /RWM: constructor requires an options object/)
    })

    it('should throw a clear error when called with a non-object primitive', () => {
      assert.throws(() => new RWM(42), /RWM: constructor requires an options object/)
      assert.throws(() => new RWM('logDensity'), /RWM: constructor requires an options object/)
    })
  })

  describe('._iter() rejection', () => {
    it('should return accepted: false and leave position unchanged when all proposals are rejected', () => {
      // lnp = () => -Infinity: Math.exp(-Inf - (-Inf)) = NaN; float() < NaN = false always
      const rwm = new RWM({ logDensity: () => -Infinity, config: { dim: 1 }, initialState: { x: [42] } })
      const result = rwm.iterate()
      assert.strictEqual(result.accepted, false)
      assert.strictEqual(rwm.x[0], 42)
    })
  })

  describe('joint proposals', () => {
    it('should perturb every component during warm-up, not one at a time', () => {
      // Constant log-density: exp(0) = 1 > any r in [0,1), so the proposal is always
      // accepted and the accepted move reveals which components were perturbed. A joint
      // proposal moves all three; the old Metropolis-within-Gibbs warm-up moved only one.
      const rwm = new RWM({ logDensity: () => 0, config: { dim: 3 }, initialState: { x: [0, 0, 0] } }).seed(42)
      const prev = rwm.x.slice()
      const { x } = rwm.iterate(null, true)
      assert.strictEqual(x.filter((v, j) => v !== prev[j]).length, 3)
    })

    SEEDS.forEach(seed => {
      it(`should recover both margins of an independent 2D standard Normal target (KS test, seed ${seed})`, () => {
        const rwm = new RWM({ logDensity: x => -0.5 * (x[0] * x[0] + x[1] * x[1]), config: { dim: 2 } }).seed(seed)
        rwm.warmUp(null, 10)
        const samples = rwm.sample(null, 2000)
        const ref = new Normal(0, 1)
        assert(ksTest(samples.map(s => s[0]), x => ref.cdf(x)))
        assert(ksTest(samples.map(s => s[1]), x => ref.cdf(x)))
      })
    })
  })

  describe('.sample() progress reporting', () => {
    it('should report each integer percent once, even when the iteration count is not a multiple of 100', () => {
      // samplingRate 3, size 250 → 750 iterations, deliberately not a multiple of 100. The old
      // `i % (iMax/100)` float-modulus check under-reported here (only even percents fired).
      const rwm = new RWM({ logDensity: x => -0.5 * x[0] * x[0], config: { dim: 1 }, initialState: { x: [0], samplingRate: 3 } })
      const pcts = []
      rwm.sample(p => pcts.push(p), 250)
      assert.strictEqual(pcts.length, 100)
      assert.strictEqual(new Set(pcts).size, 100)
      assert(pcts.every(p => Number.isInteger(p) && p >= 0 && p < 100))
      assert.deepEqual(pcts, pcts.slice().sort((a, b) => a - b))
    })
  })

  describe('.state() round-trip', () => {
    it('should restore position, samplingRate, and proposal sigmas', () => {
      const lnp = x => -0.5 * x[0] * x[0]
      const rwm1 = new RWM({ logDensity: lnp, config: { dim: 1 } })
      for (let i = 0; i < 100; i++) rwm1.iterate()
      const state = rwm1.state()
      const rwm2 = new RWM({ logDensity: lnp, config: { dim: 1 }, initialState: state })
      assert.deepEqual(rwm2.x, state.x)
      assert.strictEqual(rwm2.samplingRate, state.samplingRate)
      assert.deepEqual(rwm2.state().internal.proposal, state.internal.proposal)
    })
  })

  describe('.ar() during sampling', () => {
    it('should lie in [0.2, 0.8] for a well-tuned 1D Normal target', () => {
      const rwm = new RWM({ logDensity: x => -0.5 * x[0] * x[0], config: { dim: 1 } })
      rwm.warmUp(null, 5)
      rwm.sample(null, 1000)
      const ar = rwm.ar()
      assert(ar >= 0.2 && ar <= 0.8, `acceptance rate ${ar} outside [0.2, 0.8]`)
    })
  })

  describe('.sample() distributional test', () => {
    SEEDS.forEach(seed => {
      it(`should produce samples matching Normal(0,1) target (KS test, seed ${seed})`, () => {
        const rwm = new RWM({ logDensity: x => -0.5 * x[0] * x[0], config: { dim: 1 } }).seed(seed)
        rwm.warmUp(null, 10)
        const samples = rwm.sample(null, 2000)
        const values = samples.map(s => s[0])
        const ref = new Normal(0, 1)
        assert(ksTest(values, x => ref.cdf(x)))
      })
    })
  })

  describe('.seed()', () => {
    const logDensity = x => -0.5 * x[0] ** 2;

    [0, 42, 12345].forEach(seed => {
      it(`should produce bitwise-identical samples when seed ${seed} is applied twice`, () => {
        const rwm1 = new RWM({ logDensity, config: { dim: 1 } }).seed(seed)
        rwm1.warmUp(null, 3)
        const samples1 = rwm1.sample(null, 50)

        const rwm2 = new RWM({ logDensity, config: { dim: 1 } }).seed(seed)
        rwm2.warmUp(null, 3)
        const samples2 = rwm2.sample(null, 50)

        assert.deepEqual(samples1, samples2)
      })
    })

    it('should produce different samples for different seeds', () => {
      const rwm0 = new RWM({ logDensity, config: { dim: 1 } }).seed(0)
      rwm0.warmUp(null, 3)
      const samples0 = rwm0.sample(null, 50)

      const rwm1 = new RWM({ logDensity, config: { dim: 1 } }).seed(1)
      rwm1.warmUp(null, 3)
      const samples1 = rwm1.sample(null, 50)

      assert.notDeepEqual(samples0, samples1)
    });

    [0, 42, 12345].forEach(seed => {
      it(`should recover the unit-Gaussian target's moments and a reasonable acceptance rate for seed ${seed}`, () => {
        const rwm = new RWM({ logDensity, config: { dim: 1 } }).seed(seed)
        rwm.warmUp(null, 10)
        const samples = rwm.sample(null, 2000)
        const values = samples.map(s => s[0])
        const n = values.length
        const mean = values.reduce((a, b) => a + b, 0) / n
        const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)

        // true mean/variance of the unit-Gaussian target, not derived from the implementation
        assert.closeTo(mean, 0, 0.05)
        assert.closeTo(variance, 1.0, 0.1)

        const ref = new Normal(0, 1)
        assert(ksTest(values, x => ref.cdf(x)))

        const ar = rwm.ar()
        assert(ar > 0.2 && ar < 0.7, `acceptance rate ${ar} outside (0.2, 0.7)`)
      })
    })
  })
})
