import { assert } from 'chai'
import { describe, it } from 'mocha'
import MCMC from '../src/mc/_mcmc'
import RWM from '../src/mc/rwm'
import gelmanRubin from '../src/mc/gelman-rubin'
import { Normal } from '../src/dist'
import { ksTest } from './test-utils'

// Concrete subclass that replays a pre-built sequence, enabling deterministic
// accumulator testing without involving the PRNG.
class TestMCMC extends MCMC {
  constructor (sequence, config = {}) {
    super(() => 0, { dim: 1, ...config }, { x: [0] })
    this._seq = sequence
    this._i = 0
  }

  _internal () { return {} }
  _adjust () {}
  _iter () { return this._seq[this._i++] }
}

// Bare subclass with no method overrides, used to verify that the base-class
// abstract stubs throw the expected errors when called unoverridden.
class UnimplementedMCMC extends MCMC {
  constructor () {
    super(() => 0, { dim: 1 }, { x: [0] })
  }
}

describe('mc.MCMC', () => {
  describe('constructor', () => {
    it('should throw when instantiated directly', () => {
      assert.throws(() => new MCMC(() => 0), /abstract/)
    })

    it('should throw for dim: 0', () => {
      assert.throws(() => new RWM(() => 0, { dim: 0 }), /dim must be a positive integer/)
    })

    it('should throw for a negative dim', () => {
      assert.throws(() => new RWM(() => 0, { dim: -2 }), /dim must be a positive integer/)
    })

    it('should throw for a non-integer dim', () => {
      assert.throws(() => new RWM(() => 0, { dim: 1.5 }), /dim must be a positive integer/)
    })

    it('should throw for a dim above the maximum allowed', () => {
      assert.throws(() => new RWM(() => 0, { dim: 1e9 }), /dim must be at most/)
      assert.throws(() => new RWM(() => 0, { dim: 10001 }), /dim must be at most/)
    })

    it('should not throw for a dim at the maximum allowed', () => {
      assert.doesNotThrow(() => new RWM(() => 0, { dim: 10000 }))
    })

    it('should default to dim: 1 when omitted', () => {
      const rwm = new RWM(x => -0.5 * x[0] * x[0])
      assert.strictEqual(rwm.dim, 1)
      assert.strictEqual(rwm.sample(null, 1)[0].length, 1)
    })

    it('should not throw for a valid multi-dimensional dim', () => {
      const rwm = new RWM(x => -0.5 * (x[0] * x[0] + x[1] * x[1] + x[2] * x[2]), { dim: 3 })
      assert.strictEqual(rwm.dim, 3)
      assert.strictEqual(rwm.sample(null, 1)[0].length, 3)
    })

    it('should throw for arWindow: 0', () => {
      assert.throws(() => new RWM(() => 0, { arWindow: 0 }), /arWindow must be a positive integer/)
    })

    it('should throw for a negative arWindow', () => {
      assert.throws(() => new RWM(() => 0, { arWindow: -2 }), /arWindow must be a positive integer/)
    })

    it('should throw for a non-integer arWindow', () => {
      assert.throws(() => new RWM(() => 0, { arWindow: 2.5 }), /arWindow must be a positive integer/)
    })

    it('should not throw for a valid arWindow and use it for ar()', () => {
      const mc = new TestMCMC([1, 2].map(v => ({ x: [v], accepted: true })), { arWindow: 2 })
      assert.doesNotThrow(() => mc.iterate())
      // exact rational: 1 accepted / min(1, 2) = 1
      assert.strictEqual(mc.ar(), 1)
    })
  })

  describe('.statistics()', () => {
    it('should compute Welford mean, std and cv for a known sequence', () => {
      const mc = new TestMCMC([1, 2, 3, 4, 5].map(v => ({ x: [v], accepted: true })))
      for (let i = 0; i < 5; i++) mc.iterate()
      const stats = mc.statistics()
      // exact rational: mean = 15/5 = 3
      assert.closeTo(stats[0].mean, 3.0, 1e-14)
      // mpmath mp.dps=50: sqrt(mpf('2.5')) → 1.5811388300841898
      assert.closeTo(stats[0].std, 1.5811388300841898, 1e-14)
      // mpmath: mpf('1.5811388300841898') / 3 → 0.5270462766947299
      assert.closeTo(stats[0].cv, 0.5270462766947299, 1e-14)
    })

    it('should return NaN for cv when mean is 0', () => {
      const mc = new TestMCMC([-1, 1].map(v => ({ x: [v], accepted: true })))
      for (let i = 0; i < 2; i++) mc.iterate()
      const stats = mc.statistics()
      // exact rational: (-1 + 1) / 2 = 0
      assert.strictEqual(stats[0].mean, 0)
      // mpmath mp.dps=50: sqrt(mpf('2')) → 1.4142135623730951
      assert.closeTo(stats[0].std, 1.4142135623730951, 1e-14)
      assert(Number.isNaN(stats[0].cv))
    })
  })

  describe('.ar()', () => {
    it('should return 0 before any iterations', () => {
      const mc = new TestMCMC([])
      assert.strictEqual(mc.ar(), 0)
    })

    it('should return the correct acceptance fraction after mixed iterations', () => {
      const seq = [
        { x: [1], accepted: true },
        { x: [2], accepted: true },
        { x: [3], accepted: true },
        { x: [4], accepted: false },
        { x: [5], accepted: false }
      ]
      const mc = new TestMCMC(seq)
      for (let i = 0; i < 5; i++) mc.iterate()
      // exact rational: 3 accepted / 5 total = 0.6
      assert.closeTo(mc.ar(), 0.6, 1e-14)
    })

    it('should match the exact cumulative ratio during the partial-fill phase', () => {
      const seq = [
        { x: [1], accepted: true },
        { x: [2], accepted: true },
        { x: [3], accepted: false }
      ]
      // arWindow (1000) far exceeds the 3 iterations run, so the window is still partially filled
      const mc = new TestMCMC(seq, { arWindow: 1000 })
      for (let i = 0; i < 3; i++) mc.iterate()
      // exact rational: 2 accepted / 3 total = 2/3, identical to the cumulative-since-reset formula
      assert.closeTo(mc.ar(), 2 / 3, 1e-14)
    })

    it('should compute the exact rate at the window boundary', () => {
      const seq = [
        { x: [1], accepted: true },
        { x: [2], accepted: true },
        { x: [3], accepted: false }
      ]
      const mc = new TestMCMC(seq, { arWindow: 3 })
      for (let i = 0; i < 3; i++) mc.iterate()
      // exact rational: 2 accepted / 3 total (= arWindow, the transition point) = 2/3
      assert.closeTo(mc.ar(), 2 / 3, 1e-14)
    })

    it('should reflect only the last arWindow iterations once the window is exceeded', () => {
      const seq = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => ({ x: [v], accepted: v <= 5 }))
      const mc = new TestMCMC(seq, { arWindow: 3 })
      for (let i = 0; i < 10; i++) mc.iterate()
      // exact rational: the last 3 iterations (8, 9, 10) are all rejected → 0 / 3 = 0,
      // even though 5 of the 10 iterations overall were accepted
      assert.strictEqual(mc.ar(), 0)
    })

    it('should use a custom config.arWindow to size the sliding window', () => {
      const seq = [1, 2, 3, 4].map(v => ({ x: [v], accepted: v <= 2 }))
      const mc = new TestMCMC(seq, { arWindow: 2 })
      for (let i = 0; i < 4; i++) mc.iterate()
      // exact rational: the last 2 iterations (3, 4) are both rejected → 0 / 2 = 0
      assert.strictEqual(mc.ar(), 0)
    })
  })

  describe('.ar() during warmUp()', () => {
    // Deterministic subclass whose acceptance outcome step-changes partway through a run,
    // used to verify ar() forgets an early untuned phase instead of staying cumulative over it.
    class PhaseMCMC extends MCMC {
      constructor (config, flipAt) {
        super(() => 0, config, { x: [0] })
        this._n = 0
        this._flipAt = flipAt
      }

      _internal () { return {} }
      _adjust () {}
      _iter (x) {
        this._n++
        return { x, accepted: this._n > this._flipAt }
      }
    }

    it('should reflect only the tuned phase, not the untuned start, after warmUp()', () => {
      // maxBatches: 1 → warmUp() runs 2 batches of 1e4 iterations = 20000 total (batch <= maxBatches)
      const mc = new PhaseMCMC({ dim: 1, arWindow: 500 }, 10000)
      mc.warmUp(null, 1)
      // exact rational: the last 500 iterations (19501-20000) all occur after the 10000-iteration
      // flip point → 500/500 = 1, unlike the cumulative rate over all 20000 (which would be 0.5)
      assert.strictEqual(mc.ar(), 1)
    })
  })

  describe('.ac()', () => {
    it('should return NaN for all lags before any iterations', () => {
      const mc = new TestMCMC([])
      const ac = mc.ac()
      assert.strictEqual(ac.length, 1)
      assert(Number.isNaN(ac[0][0]))
    })

    it('should return 1.0 at lag-0 after a known sequence', () => {
      const mc = new TestMCMC([1, 2, 3, 4, 5].map(v => ({ x: [v], accepted: true })))
      for (let i = 0; i < 5; i++) mc.iterate()
      const ac = mc.ac()
      // exact rational: (cross[0]/n - mean^2) / pop_var = (55/5 - 9) / 2 = 1.0
      assert.closeTo(ac[0][0], 1.0, 1e-14)
    })

    it('should return NaN for lags beyond the number of samples seen', () => {
      const mc = new TestMCMC([1, 2, 3, 4, 5].map(v => ({ x: [v], accepted: true })))
      for (let i = 0; i < 5; i++) mc.iterate()
      const ac = mc.ac()
      assert(Number.isNaN(ac[0][5]))
    })
  })

  describe('abstract method stubs', () => {
    it('_internal() should throw when not overridden', () => {
      const mc = new UnimplementedMCMC()
      assert.throws(() => mc._internal(), /not implemented/)
    })

    it('_iter() should throw when not overridden', () => {
      const mc = new UnimplementedMCMC()
      assert.throws(() => mc._iter(), /not implemented/)
    })

    it('_adjust() should throw when not overridden', () => {
      const mc = new UnimplementedMCMC()
      assert.throws(() => mc._adjust(), /not implemented/)
    })
  })
})

describe('mc.RWM', () => {
  describe('constructor', () => {
    it('should instantiate without error for a 1D Normal target', () => {
      assert.doesNotThrow(() => new RWM(x => -0.5 * x[0] * x[0], { dim: 1 }))
    })
  })

  describe('._iter() rejection', () => {
    it('should return accepted: false and leave position unchanged when all proposals are rejected', () => {
      // lnp = () => -Infinity: Math.exp(-Inf - (-Inf)) = NaN; float() < NaN = false always
      const rwm = new RWM(() => -Infinity, { dim: 1 }, { x: [42] })
      const result = rwm.iterate()
      assert.strictEqual(result.accepted, false)
      assert.strictEqual(rwm.x[0], 42)
    })
  })

  describe('.state() round-trip', () => {
    it('should restore position, samplingRate, and proposal sigmas', () => {
      const lnp = x => -0.5 * x[0] * x[0]
      const rwm1 = new RWM(lnp, { dim: 1 })
      for (let i = 0; i < 100; i++) rwm1.iterate()
      const state = rwm1.state()
      const rwm2 = new RWM(lnp, { dim: 1 }, state)
      assert.deepEqual(rwm2.x, state.x)
      assert.strictEqual(rwm2.samplingRate, state.samplingRate)
      assert.deepEqual(rwm2.state().internal.proposal, state.internal.proposal)
    })
  })

  describe('.ar() during sampling', () => {
    it('should lie in [0.2, 0.8] for a well-tuned 1D Normal target', () => {
      const rwm = new RWM(x => -0.5 * x[0] * x[0], { dim: 1 })
      rwm.warmUp(null, 5)
      rwm.sample(null, 1000)
      const ar = rwm.ar()
      assert(ar >= 0.2 && ar <= 0.8, `acceptance rate ${ar} outside [0.2, 0.8]`)
    })
  })

  describe('.sample() distributional test', () => {
    it('should produce samples matching Normal(0,1) target (KS test)', () => {
      const rwm = new RWM(x => -0.5 * x[0] * x[0], { dim: 1 })
      rwm.warmUp(null, 10)
      const samples = rwm.sample(null, 2000)
      const values = samples.map(s => s[0])
      const ref = new Normal(0, 1)
      assert(ksTest(values, x => ref.cdf(x)))
    })
  })

  describe('.seed()', () => {
    const logDensity = x => -0.5 * x[0] ** 2;

    [0, 42, 12345].forEach(seed => {
      it(`should produce bitwise-identical samples when seed ${seed} is applied twice`, () => {
        const rwm1 = new RWM(logDensity, { dim: 1 }).seed(seed)
        rwm1.warmUp(null, 3)
        const samples1 = rwm1.sample(null, 50)

        const rwm2 = new RWM(logDensity, { dim: 1 }).seed(seed)
        rwm2.warmUp(null, 3)
        const samples2 = rwm2.sample(null, 50)

        assert.deepEqual(samples1, samples2)
      })
    })

    it('should produce different samples for different seeds', () => {
      const rwm0 = new RWM(logDensity, { dim: 1 }).seed(0)
      rwm0.warmUp(null, 3)
      const samples0 = rwm0.sample(null, 50)

      const rwm1 = new RWM(logDensity, { dim: 1 }).seed(1)
      rwm1.warmUp(null, 3)
      const samples1 = rwm1.sample(null, 50)

      assert.notDeepEqual(samples0, samples1)
    });

    [0, 42, 12345].forEach(seed => {
      it(`should recover the unit-Gaussian target's moments and a reasonable acceptance rate for seed ${seed}`, () => {
        const rwm = new RWM(logDensity, { dim: 1 }).seed(seed)
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
