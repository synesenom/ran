import { assert } from 'chai'
import { describe, it } from 'mocha'
import MCMC from '../src/mc/_mcmc'
import RWM from '../src/mc/rwm'
import AdaptiveMetropolis from '../src/mc/adaptive-metropolis'
import Gibbs from '../src/mc/gibbs'
import HMC from '../src/mc/hmc'
import MALA from '../src/mc/mala'
import ARS from '../src/mc/ars'
import SliceSampler from '../src/mc/slice'
import gelmanRubin from '../src/mc/gelman-rubin'
import runChains from '../src/mc/run-chains'
import { Normal, Gamma, Beta } from '../src/dist'
import pearson from '../src/dependence/pearson'
import { ksTest, ess } from './test-utils'

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

    it('should throw for maxLag: 0', () => {
      assert.throws(() => new RWM(() => 0, { maxLag: 0 }), /maxLag must be a positive integer/)
    })

    it('should throw for a negative maxLag', () => {
      assert.throws(() => new RWM(() => 0, { maxLag: -2 }), /maxLag must be a positive integer/)
    })

    it('should throw for a non-integer maxLag', () => {
      assert.throws(() => new RWM(() => 0, { maxLag: 1.5 }), /maxLag must be a positive integer/)
    })

    it('should throw for a maxLag above the maximum allowed', () => {
      assert.throws(() => new RWM(() => 0, { maxLag: 1e9 }), /maxLag must be at most/)
      assert.throws(() => new RWM(() => 0, { maxLag: 10001 }), /maxLag must be at most/)
    })

    it('should not throw for a maxLag at the maximum allowed', () => {
      assert.doesNotThrow(() => new RWM(() => 0, { maxLag: 10000 }))
    })

    it('should throw when dim and maxLag are each individually valid but their product exceeds the combined bound', () => {
      assert.throws(() => new RWM(() => 0, { dim: 10000, maxLag: 10000 }), /dim \* maxLag must be at most/)
    })

    it('should not throw when dim*maxLag is exactly at the combined bound', () => {
      assert.doesNotThrow(() => new RWM(() => 0, { dim: 10000, maxLag: 625 }))
    })

    it('should throw when dim*maxLag is just above the combined bound', () => {
      assert.throws(() => new RWM(() => 0, { dim: 10000, maxLag: 626 }), /dim \* maxLag must be at most/)
    })

    it('should default to maxLag: 100 when omitted', () => {
      const rwm = new RWM(x => -0.5 * x[0] * x[0])
      assert.strictEqual(rwm.maxLag, 100)
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

    it('should throw for an arWindow above the maximum allowed', () => {
      assert.throws(() => new RWM(() => 0, { arWindow: 1e9 }), /arWindow must be at most/)
      assert.throws(() => new RWM(() => 0, { arWindow: 10001 }), /arWindow must be at most/)
    })

    it('should not throw for an arWindow at the maximum allowed', () => {
      assert.doesNotThrow(() => new RWM(() => 0, { arWindow: 10000 }))
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
      // warmUp() runs exactly maxBatches batches of 1e4 iterations; maxBatches: 2 → 20000 total.
      const mc = new PhaseMCMC({ dim: 1, arWindow: 500 }, 10000)
      mc.warmUp(null, 2)
      // exact rational: the last 500 iterations (19501-20000) all occur after the 10000-iteration
      // flip point → 500/500 = 1, unlike the cumulative rate over all 20000 (which would be 0.5)
      assert.strictEqual(mc.ar(), 1)
    })
  })

  describe('.warmUp() batch count', () => {
    it('should run exactly maxBatches batches and report 100% at completion', () => {
      // 4e4 entries covers even the old off-by-one (maxBatches+1 = 4 batches × 1e4) without
      // running dry, so the failure surfaces as a count assertion rather than a crash.
      const seq = Array.from({ length: 4e4 }, () => ({ x: [0], accepted: true }))
      const mc = new TestMCMC(seq)
      const pcts = []
      mc.warmUp(p => pcts.push(p), 3)
      // one progress callback per batch → exactly maxBatches callbacks, not maxBatches + 1
      assert.strictEqual(pcts.length, 3)
      assert.strictEqual(pcts[pcts.length - 1], 100)
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

  describe('._thinningLag()', () => {
    it('should return a small lag for a rapidly-decorrelating (alternating) sequence', () => {
      // A ±1 alternating chain has ac(1) ≈ -1, ac(2) ≈ +1, ...; |ac| never stays
      // below 0.05, so this exercises the "found nothing" path deliberately too —
      // but its short-lag structure is the well-mixing baseline to contrast with
      // the monotone case below. Here we only assert the direction is not inverted.
      const seq = Array.from({ length: 50 }, (_, i) => ({ x: [i % 2 === 0 ? 1 : -1], accepted: true }))
      const mc = new TestMCMC(seq, { maxLag: 5 })
      for (let i = 0; i < seq.length; i++) mc.iterate()
      // maxLag 5 → lags 0..3 inspected; alternating |ac|≈1 everywhere, no lag ≤ 0.05,
      // so the fallback is the largest inspected lag (maxLag - 2 = 3), NOT 0.
      assert.strictEqual(mc._thinningLag(), 3)
    })

    it('should fall back to the largest measured lag when a chain never decorrelates', () => {
      // A strictly increasing ramp has |ac| > 0.05 at every measurable lag. A lag of 0
      // would signal "already decorrelated" and drive samplingRate DOWN for the
      // slowest-mixing dimension — inverting ADR-0020 §3. The correct fallback is the
      // largest lag we could evaluate (maxLag - 2 = 3 for maxLag 5).
      const seq = Array.from({ length: 50 }, (_, i) => ({ x: [i], accepted: true }))
      const mc = new TestMCMC(seq, { maxLag: 5 })
      for (let i = 0; i < seq.length; i++) mc.iterate()
      assert.strictEqual(mc._thinningLag(), 3)
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

  describe('joint proposals', () => {
    it('should perturb every component during warm-up, not one at a time', () => {
      // Constant log-density: exp(0) = 1 > any r in [0,1), so the proposal is always
      // accepted and the accepted move reveals which components were perturbed. A joint
      // proposal moves all three; the old Metropolis-within-Gibbs warm-up moved only one.
      const rwm = new RWM(() => 0, { dim: 3 }, { x: [0, 0, 0] }).seed(42)
      const prev = rwm.x.slice()
      const { x } = rwm.iterate(null, true)
      assert.strictEqual(x.filter((v, j) => v !== prev[j]).length, 3)
    })

    it('should recover both margins of an independent 2D standard Normal target', () => {
      const rwm = new RWM(x => -0.5 * (x[0] * x[0] + x[1] * x[1]), { dim: 2 }).seed(7)
      rwm.warmUp(null, 10)
      const samples = rwm.sample(null, 2000)
      const ref = new Normal(0, 1)
      assert(ksTest(samples.map(s => s[0]), x => ref.cdf(x)))
      assert(ksTest(samples.map(s => s[1]), x => ref.cdf(x)))
    })
  })

  describe('.sample() progress reporting', () => {
    it('should report each integer percent once, even when the iteration count is not a multiple of 100', () => {
      // samplingRate 3, size 250 → 750 iterations, deliberately not a multiple of 100. The old
      // `i % (iMax/100)` float-modulus check under-reported here (only even percents fired).
      const rwm = new RWM(x => -0.5 * x[0] * x[0], { dim: 1 }, { x: [0], samplingRate: 3 })
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

describe('mc.AdaptiveMetropolis', () => {
  describe('constructor', () => {
    it('should instantiate without error for a 1D Normal target', () => {
      assert.doesNotThrow(() => new AdaptiveMetropolis(x => -0.5 * x[0] * x[0], { dim: 1 }))
    })

    it('should instantiate without error for a 5D target', () => {
      assert.doesNotThrow(() => new AdaptiveMetropolis(x => -0.5 * x.reduce((s, v) => s + v * v, 0), { dim: 5 }))
    })
  })

  describe('._iter() rejection', () => {
    it('should return accepted: false and leave position unchanged when all proposals are rejected', () => {
      // lnp = () => -Infinity: Math.exp(-Inf - (-Inf)) = NaN; float() < NaN = false always
      const am = new AdaptiveMetropolis(() => -Infinity, { dim: 1 }, { x: [42] })
      const result = am.iterate()
      assert.strictEqual(result.accepted, false)
      assert.strictEqual(am.x[0], 42)
    })
  })

  describe('joint proposals', () => {
    it('should perturb every component during warm-up, not one at a time', () => {
      const am = new AdaptiveMetropolis(() => 0, { dim: 3 }, { x: [0, 0, 0] }).seed(42)
      const prev = am.x.slice()
      const { x } = am.iterate(null, true)
      assert.strictEqual(x.filter((v, j) => v !== prev[j]).length, 3)
    })

    it('should recover both margins of an independent 2D standard Normal target', () => {
      const am = new AdaptiveMetropolis(x => -0.5 * (x[0] * x[0] + x[1] * x[1]), { dim: 2 }).seed(7)
      am.warmUp(null, 10)
      const samples = am.sample(null, 2000)
      const ref = new Normal(0, 1)
      assert(ksTest(samples.map(s => s[0]), x => ref.cdf(x)))
      assert(ksTest(samples.map(s => s[1]), x => ref.cdf(x)))
    })
  })

  describe('.state() round-trip', () => {
    it('should restore position, samplingRate, and proposal covariance', () => {
      const lnp = x => -0.5 * x[0] * x[0]
      const am1 = new AdaptiveMetropolis(lnp, { dim: 1 })
      for (let i = 0; i < 100; i++) am1.iterate()
      const state = am1.state()
      const am2 = new AdaptiveMetropolis(lnp, { dim: 1 }, state)
      assert.deepEqual(am2.x, state.x)
      assert.strictEqual(am2.samplingRate, state.samplingRate)
      assert.deepEqual(am2.state().internal.proposal, state.internal.proposal)
    })
  })

  describe('frozen covariance during sampling', () => {
    it('should not change the proposal covariance once sample() starts', () => {
      const am = new AdaptiveMetropolis(x => -0.5 * (x[0] * x[0] + x[1] * x[1]), { dim: 2 }).seed(3)
      am.warmUp(null, 5)
      const before = am.state().internal.proposal
      am.sample(null, 500)
      const after = am.state().internal.proposal
      assert.deepEqual(before, after)
    })
  })

  describe('.ar() during sampling', () => {
    it('should lie in a reasonable range for a well-tuned 1D Normal target', () => {
      const am = new AdaptiveMetropolis(x => -0.5 * x[0] * x[0], { dim: 1 })
      am.warmUp(null, 5)
      am.sample(null, 1000)
      const ar = am.ar()
      assert(ar >= 0.15 && ar <= 0.85, `acceptance rate ${ar} outside [0.15, 0.85]`)
    })
  })

  describe('.sample() distributional test', () => {
    it('should produce samples matching Normal(0,1) target (KS test)', () => {
      const am = new AdaptiveMetropolis(x => -0.5 * x[0] * x[0], { dim: 1 })
      am.warmUp(null, 10)
      const samples = am.sample(null, 2000)
      const values = samples.map(s => s[0])
      const ref = new Normal(0, 1)
      assert(ksTest(values, x => ref.cdf(x)))
    })
  })

  describe('.seed()', () => {
    const logDensity = x => -0.5 * x[0] ** 2;

    [0, 42, 12345].forEach(seed => {
      it(`should produce bitwise-identical samples when seed ${seed} is applied twice`, () => {
        const am1 = new AdaptiveMetropolis(logDensity, { dim: 1 }).seed(seed)
        am1.warmUp(null, 3)
        const samples1 = am1.sample(null, 50)

        const am2 = new AdaptiveMetropolis(logDensity, { dim: 1 }).seed(seed)
        am2.warmUp(null, 3)
        const samples2 = am2.sample(null, 50)

        assert.deepEqual(samples1, samples2)
      })
    })

    it('should produce different samples for different seeds', () => {
      const am0 = new AdaptiveMetropolis(logDensity, { dim: 1 }).seed(0)
      am0.warmUp(null, 3)
      const samples0 = am0.sample(null, 50)

      const am1 = new AdaptiveMetropolis(logDensity, { dim: 1 }).seed(1)
      am1.warmUp(null, 3)
      const samples1 = am1.sample(null, 50)

      assert.notDeepEqual(samples0, samples1)
    })
  })

  describe('5D correlated Normal ESS comparison', () => {
    it('should achieve higher effective sample size than RWM for equal iteration counts', () => {
      // AR(1)-correlation target: Sigma_ij = 0.7^|i-j|, dim = 5. The exact inverse of an
      // AR(1) correlation matrix is tridiagonal (standard result), avoiding a runtime matrix
      // inversion inside the test's hot log-density path.
      const rho = 0.7
      const denom = 1 - rho * rho
      const diagEdge = 1 / denom
      const diagMid = (1 + rho * rho) / denom
      const offDiag = -rho / denom
      const lnp = x => {
        let q = 0
        for (let i = 0; i < 5; i++) {
          const dii = (i === 0 || i === 4) ? diagEdge : diagMid
          q += dii * x[i] * x[i]
        }
        for (let i = 0; i < 4; i++) {
          q += 2 * offDiag * x[i] * x[i + 1]
        }
        return -0.5 * q
      }

      const warmUpBatches = 20
      const sampleSize = 2000

      // A single seed's ESS estimate is a noisy point estimate (ess() truncates its
      // autocorrelation sum at maxLag if it never crosses zero, so one unlucky chain could
      // flip the comparison). Averaging the AM/RWM ESS ratio over several independent seeds
      // and requiring a safety margin makes the assertion robust to that per-seed noise.
      const seeds = [1, 2, 3, 4, 5]
      const ratios = seeds.map(seed => {
        const am = new AdaptiveMetropolis(lnp, { dim: 5 }).seed(seed)
        am.warmUp(null, warmUpBatches)
        const amSamples = am.sample(null, sampleSize)
        const amEss = ess(am, am.samplingRate * amSamples.length)

        const rwm = new RWM(lnp, { dim: 5 }).seed(seed)
        rwm.warmUp(null, warmUpBatches)
        const rwmSamples = rwm.sample(null, sampleSize)
        const rwmEss = ess(rwm, rwm.samplingRate * rwmSamples.length)

        return amEss / rwmEss
      })
      const meanRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length

      assert(meanRatio > 1.1, `AdaptiveMetropolis/RWM mean ESS ratio (${meanRatio}) over seeds ${seeds} should exceed 1.1`)
    })
  })
})

describe('mc.Gibbs', () => {
  // Full conditionals for a bivariate standard Normal with correlation rho:
  // x_i | x_j ~ Normal(rho * x_j, sqrt(1 - rho^2))
  const rho = 0.5
  const sigma = Math.sqrt(1 - rho * rho)
  const conditionals = [
    x => new Normal(rho * x[1], sigma).sample(),
    x => new Normal(rho * x[0], sigma).sample()
  ]

  describe('constructor', () => {
    it('should instantiate without error when config.dim matches conditionals.length', () => {
      assert.doesNotThrow(() => new Gibbs(conditionals, { dim: 2 }))
    })

    it('should default dim to conditionals.length when config.dim is omitted', () => {
      const gibbs = new Gibbs(conditionals)
      assert.strictEqual(gibbs.dim, 2)
    })

    it('should throw when conditionals is empty', () => {
      assert.throws(() => new Gibbs([]), /conditionals must be a non-empty array/)
    })

    it('should throw when conditionals is not an array', () => {
      assert.throws(() => new Gibbs(null), /conditionals must be a non-empty array/)
    })

    it('should throw when config.dim does not match conditionals.length', () => {
      assert.throws(() => new Gibbs(conditionals, { dim: 3 }), /config.dim must match conditionals.length/)
    })
  })

  describe('._iter()', () => {
    it('should replace one coordinate at a time using the current full state', () => {
      // Deterministic conditionals (no sampling) isolate the sweep order from randomness:
      // dim 0 sees the state as constructed, dim 1 must see dim 0 already replaced.
      const seen = []
      const det = [
        x => { seen.push(x.slice()); return 10 },
        x => { seen.push(x.slice()); return 20 }
      ]
      const gibbs = new Gibbs(det, { dim: 2 }, { x: [1, 2] })
      const result = gibbs.iterate()
      assert.deepEqual(seen[0], [1, 2])
      assert.deepEqual(seen[1], [10, 2])
      assert.deepEqual(result.x, [10, 20])
      assert.strictEqual(result.accepted, true)
    })
  })

  describe('.ar()', () => {
    it('should always be 1.0 regardless of the number of iterations', () => {
      const gibbs = new Gibbs(conditionals, { dim: 2 }, { x: [0, 0] })
      for (let i = 0; i < 5; i++) {
        gibbs.iterate()
        assert.strictEqual(gibbs.ar(), 1.0)
      }
      for (let i = 0; i < 200; i++) gibbs.iterate()
      assert.strictEqual(gibbs.ar(), 1.0)
    })
  })

  describe('.sample() distributional test', () => {
    // gibbs.seed() only reseeds Gibbs's own this.r, which _iter() never reads — Gibbs's actual
    // randomness comes entirely from the caller-supplied conditionals. The module-scope
    // `conditionals` above construct a fresh `new Normal(...)` on every call, and Distribution's
    // constructor seeds its own PRNG from Math.random() when no seed is given, so those draws are
    // never reproducible regardless of what gibbs.seed(x) is called with. Fixed here by reusing a
    // single, explicitly-seeded standard-Normal generator across every conditional call instead
    // of constructing a new (unseeded) one per call. See
    // solutions/testing/2026-07-15-2015-gibbs-conditionals-fresh-normal-seed-noop.md
    ;[0, 7, 42].forEach(seed => {
      it(`should recover both margins of a correlated bivariate Normal target (KS test, seed ${seed})`, () => {
        const z = new Normal(0, 1).seed(seed)
        const seededConditionals = [
          x => rho * x[1] + sigma * z.sample(),
          x => rho * x[0] + sigma * z.sample()
        ]
        const gibbs = new Gibbs(seededConditionals, { dim: 2 }, { x: [0, 0] })
        gibbs.warmUp(null, 5)
        const samples = gibbs.sample(null, 2000)
        const ref = new Normal(0, 1)
        assert(ksTest(samples.map(s => s[0]), x => ref.cdf(x)))
        assert(ksTest(samples.map(s => s[1]), x => ref.cdf(x)))
        // Both margins are standard Normal regardless of rho, so the KS tests above
        // cannot detect a sign flip or a swapped source dimension in the conditionals;
        // the joint correlation is the only statistic that distinguishes them.
        // SE(r) ~= (1 - rho^2) / sqrt(n - 1) ~= 0.0168 for rho=0.5, n=2000, so 0.1 is ~6 SE.
        const r = pearson(samples.map(s => s[0]), samples.map(s => s[1]))
        assert.approximately(r, rho, 0.1)
      })
    })
  })

  describe('.state() round-trip', () => {
    it('should restore position and samplingRate, resuming the chain correctly', () => {
      const gibbs1 = new Gibbs(conditionals, { dim: 2 }, { x: [0, 0] })
      for (let i = 0; i < 50; i++) gibbs1.iterate()
      const state = gibbs1.state()
      assert.deepEqual(state.internal, {})

      const gibbs2 = new Gibbs(conditionals, { dim: 2 }, state)
      assert.deepEqual(gibbs2.x, state.x)
      assert.strictEqual(gibbs2.samplingRate, state.samplingRate)
      assert.doesNotThrow(() => gibbs2.iterate())
    })
  })

  describe('.seed()', () => {
    // Deliberately not a statistically meaningful conditional (distributional
    // correctness is already covered by the KS test above) — this exists only
    // to exercise rng.next() so the assertion tests the actual seeded data
    // path, not merely that .seed() was called. See
    // solutions/testing/2026-07-15-2015-gibbs-conditionals-fresh-normal-seed-noop.md
    const rngConditionals = [
      (x, rng) => rho * x[1] + sigma * rng.next(),
      (x, rng) => rho * x[0] + sigma * rng.next()
    ];

    [0, 42, 12345].forEach(seed => {
      it(`should produce bitwise-identical samples when seed ${seed} is applied twice`, () => {
        const gibbs1 = new Gibbs(rngConditionals, { dim: 2 }, { x: [0, 0] }).seed(seed)
        gibbs1.warmUp(null, 3)
        const samples1 = gibbs1.sample(null, 50)

        const gibbs2 = new Gibbs(rngConditionals, { dim: 2 }, { x: [0, 0] }).seed(seed)
        gibbs2.warmUp(null, 3)
        const samples2 = gibbs2.sample(null, 50)

        assert.deepEqual(samples1, samples2)
      })
    })

    it('should produce different samples for different seeds', () => {
      const gibbs0 = new Gibbs(rngConditionals, { dim: 2 }, { x: [0, 0] }).seed(0)
      gibbs0.warmUp(null, 3)
      const samples0 = gibbs0.sample(null, 50)

      const gibbs1 = new Gibbs(rngConditionals, { dim: 2 }, { x: [0, 0] }).seed(1)
      gibbs1.warmUp(null, 3)
      const samples1 = gibbs1.sample(null, 50)

      assert.notDeepEqual(samples0, samples1)
    })

    it('should still produce finite, well-formed samples for conditionals that ignore the second (rng) argument', () => {
      const gibbs = new Gibbs(conditionals, { dim: 2 }, { x: [0, 0] }).seed(42)
      const samples = gibbs.sample(null, 10)
      assert.strictEqual(samples.length, 10)
      assert(samples.every(s => s.length === 2 && s.every(Number.isFinite)))
    })
  })
})

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
      assert.doesNotThrow(() => new HMC(logDensity2D, gradLogDensity2D, { dim: 2 }))
    })

    it('should default to stepSize: 0.1 and pathLength: 10 when omitted', () => {
      const hmc = new HMC(logDensity1D, gradLogDensity1D, { dim: 1 })
      assert.strictEqual(hmc.state().internal.stepSize, 0.1)
      assert.strictEqual(hmc.state().internal.pathLength, 10)
    })

    it('should throw when gradLogDensity is not a function', () => {
      assert.throws(() => new HMC(logDensity1D, null, { dim: 1 }), /gradLogDensity must be a function/)
    })

    it('should throw when stepSize is zero', () => {
      assert.throws(() => new HMC(logDensity1D, gradLogDensity1D, { dim: 1, stepSize: 0 }), /stepSize must be a positive number/)
    })

    it('should throw when stepSize is negative', () => {
      assert.throws(() => new HMC(logDensity1D, gradLogDensity1D, { dim: 1, stepSize: -0.1 }), /stepSize must be a positive number/)
    })

    it('should throw when stepSize is Infinity', () => {
      assert.throws(() => new HMC(logDensity1D, gradLogDensity1D, { dim: 1, stepSize: Infinity }), /stepSize must be a positive number/)
    })

    it('should throw when a resumed initialState.internal.stepSize is invalid', () => {
      // initialState.internal is caller-supplied the same way config is (e.g. round-tripped
      // through state()) — a corrupted/adversarial value must be rejected the same way.
      assert.throws(
        () => new HMC(logDensity1D, gradLogDensity1D, { dim: 1 }, { internal: { stepSize: Infinity, pathLength: 10 } }),
        /stepSize must be a positive number/
      )
    })

    it('should throw when a resumed initialState.internal.pathLength is invalid', () => {
      assert.throws(
        () => new HMC(logDensity1D, gradLogDensity1D, { dim: 1 }, { internal: { stepSize: 0.1, pathLength: Infinity } }),
        /pathLength must be a positive integer/
      )
    })

    it('should throw when pathLength is zero', () => {
      assert.throws(() => new HMC(logDensity1D, gradLogDensity1D, { dim: 1, pathLength: 0 }), /pathLength must be a positive integer/)
    })

    it('should throw when pathLength is negative', () => {
      assert.throws(() => new HMC(logDensity1D, gradLogDensity1D, { dim: 1, pathLength: -5 }), /pathLength must be a positive integer/)
    })

    it('should throw when pathLength is not an integer', () => {
      assert.throws(() => new HMC(logDensity1D, gradLogDensity1D, { dim: 1, pathLength: 2.5 }), /pathLength must be a positive integer/)
    })

    it('should not throw for valid stepSize and pathLength', () => {
      assert.doesNotThrow(() => new HMC(logDensity1D, gradLogDensity1D, { dim: 1, stepSize: 0.2, pathLength: 5 }))
    })
  })

  describe('._iter() rejection', () => {
    it('should return accepted: false and leave position unchanged when the target is degenerate', () => {
      // logDensity = -Infinity everywhere: the Hamiltonian difference is -Infinity - (-Infinity) = NaN,
      // so exp(NaN) = NaN and float() < NaN is false always — mirrors RWM's analogous rejection test.
      const hmc = new HMC(() => -Infinity, () => [0], { dim: 1 }, { x: [42] })
      const result = hmc.iterate()
      assert.strictEqual(result.accepted, false)
      assert.strictEqual(hmc.x[0], 42)
    })
  })

  describe('.state() round-trip', () => {
    it('should restore position, samplingRate, and the full internal state', () => {
      const hmc1 = new HMC(logDensity1D, gradLogDensity1D, { dim: 1 }).seed(11)
      // warmUp() first so dual averaging actually moves _stepSize away from its 0.1
      // construction-time default — otherwise the round-trip would trivially "pass" against a
      // corrupted read that silently falls back to the same default, the exact failure mode in
      // solutions/correctness/2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md.
      hmc1.warmUp(null, 5)
      for (let i = 0; i < 100; i++) hmc1.iterate()
      const state = hmc1.state()
      assert.notStrictEqual(state.internal.stepSize, 0.1)
      const hmc2 = new HMC(logDensity1D, gradLogDensity1D, { dim: 1 }, state)
      assert.deepEqual(hmc2.x, state.x)
      assert.strictEqual(hmc2.samplingRate, state.samplingRate)
      // Full-object deepEqual, not a spot-checked field — see
      // solutions/correctness/2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md
      assert.deepEqual(hmc2.state().internal, state.internal)
    })
  })

  describe('.ar() during sampling', () => {
    [1, 2, 3].forEach(seed => {
      it(`should lie in [0.6, 0.9] for a well-tuned 1D Normal target, seed ${seed}`, () => {
        const hmc = new HMC(logDensity1D, gradLogDensity1D, { dim: 1 }).seed(seed)
        hmc.warmUp(null, 10)
        hmc.sample(null, 1000)
        const ar = hmc.ar()
        assert(ar >= 0.6 && ar <= 0.9, `acceptance rate ${ar} outside [0.6, 0.9]`)
      })
    })
  })

  describe('.sample() distributional test', () => {
    it('should recover both margins of a correlated bivariate Normal target (KS test)', () => {
      const hmc = new HMC(logDensity2D, gradLogDensity2D, { dim: 2 }).seed(3)
      hmc.warmUp(null, 10)
      const samples = hmc.sample(null, 2000)
      const ref = new Normal(0, 1)
      assert(ksTest(samples.map(s => s[0]), x => ref.cdf(x)))
      assert(ksTest(samples.map(s => s[1]), x => ref.cdf(x)))
    })
  })

  describe('.seed()', () => {
    [0, 42, 12345].forEach(seed => {
      it(`should produce bitwise-identical samples when seed ${seed} is applied twice`, () => {
        const hmc1 = new HMC(logDensity1D, gradLogDensity1D, { dim: 1 }).seed(seed)
        hmc1.warmUp(null, 3)
        const samples1 = hmc1.sample(null, 50)

        const hmc2 = new HMC(logDensity1D, gradLogDensity1D, { dim: 1 }).seed(seed)
        hmc2.warmUp(null, 3)
        const samples2 = hmc2.sample(null, 50)

        assert.deepEqual(samples1, samples2)
      })
    })

    it('should produce different samples for different seeds', () => {
      const hmc1 = new HMC(logDensity1D, gradLogDensity1D, { dim: 1 }).seed(1)
      hmc1.warmUp(null, 3)
      const samples1 = hmc1.sample(null, 50)

      const hmc2 = new HMC(logDensity1D, gradLogDensity1D, { dim: 1 }).seed(2)
      hmc2.warmUp(null, 3)
      const samples2 = hmc2.sample(null, 50)

      assert.notDeepEqual(samples1, samples2)
    })
  })
})

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
      assert.doesNotThrow(() => new MALA(logDensity2D, gradLogDensity2D, { dim: 2 }))
    })

    it('should default to stepSize: 0.1 when omitted', () => {
      const mala = new MALA(logDensity1D, gradLogDensity1D, { dim: 1 })
      // Log-scale storage (Math.log/Math.exp round-trip) introduces a ~1e-17 float error,
      // unlike HMC's linear _stepSize storage which reports the input bit-exact.
      assert.closeTo(mala.state().internal.stepSize, 0.1, 1e-15)
    })

    it('should throw when gradLogDensity is not a function', () => {
      assert.throws(() => new MALA(logDensity1D, null, { dim: 1 }), /gradLogDensity must be a function/)
    })

    it('should throw when stepSize is zero', () => {
      assert.throws(() => new MALA(logDensity1D, gradLogDensity1D, { dim: 1, stepSize: 0 }), /stepSize must be a positive number/)
    })

    it('should throw when stepSize is negative', () => {
      assert.throws(() => new MALA(logDensity1D, gradLogDensity1D, { dim: 1, stepSize: -0.1 }), /stepSize must be a positive number/)
    })

    it('should throw when stepSize is Infinity', () => {
      assert.throws(() => new MALA(logDensity1D, gradLogDensity1D, { dim: 1, stepSize: Infinity }), /stepSize must be a positive number/)
    })

    it('should throw when a resumed initialState.internal.stepSize is invalid', () => {
      // initialState.internal is caller-supplied the same way config is (e.g. round-tripped
      // through state()) — a corrupted/adversarial value must be rejected the same way.
      assert.throws(
        () => new MALA(logDensity1D, gradLogDensity1D, { dim: 1 }, { internal: { stepSize: Infinity } }),
        /stepSize must be a positive number/
      )
    })

    it('should not throw for a valid explicit stepSize', () => {
      assert.doesNotThrow(() => new MALA(logDensity1D, gradLogDensity1D, { dim: 1, stepSize: 0.2 }))
    })
  })

  describe('._iter() rejection', () => {
    it('should return accepted: false and leave position unchanged when the target is degenerate', () => {
      // logDensity = -Infinity everywhere: the MH log-ratio is -Infinity - (-Infinity) = NaN,
      // so exp(NaN) = NaN and float() < NaN is false always — mirrors HMC's/RWM's analogous test.
      const mala = new MALA(() => -Infinity, () => [0], { dim: 1 }, { x: [42] })
      const result = mala.iterate()
      assert.strictEqual(result.accepted, false)
      assert.strictEqual(mala.x[0], 42)
    })
  })

  describe('.state() round-trip', () => {
    it('should restore position, samplingRate, and the full internal state', () => {
      const mala1 = new MALA(logDensity1D, gradLogDensity1D, { dim: 1 }).seed(11)
      // warmUp() first so batch Robbins-Monro actually moves stepSize away from its 0.1
      // construction-time default — see solutions/correctness/2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md
      mala1.warmUp(null, 5)
      for (let i = 0; i < 100; i++) mala1.iterate()
      const state = mala1.state()
      assert.notStrictEqual(state.internal.stepSize, 0.1)
      const mala2 = new MALA(logDensity1D, gradLogDensity1D, { dim: 1 }, state)
      assert.deepEqual(mala2.x, state.x)
      assert.strictEqual(mala2.samplingRate, state.samplingRate)
      assert.deepEqual(mala2.state().internal, state.internal)
    })
  })

  describe('.ar() during sampling', () => {
    [1, 2, 3].forEach(seed => {
      it(`should lie in [0.5, 0.65] for a well-tuned 1D Normal target, seed ${seed}`, () => {
        const mala = new MALA(logDensity1D, gradLogDensity1D, { dim: 1 }).seed(seed)
        mala.warmUp(null, 10)
        mala.sample(null, 1000)
        const ar = mala.ar()
        assert(ar >= 0.5 && ar <= 0.65, `acceptance rate ${ar} outside [0.5, 0.65]`)
      })
    })
  })

  describe('.sample() distributional test', () => {
    it('should recover both margins of a correlated bivariate Normal target (KS test)', () => {
      const mala = new MALA(logDensity2D, gradLogDensity2D, { dim: 2 }).seed(3)
      mala.warmUp(null, 10)
      const samples = mala.sample(null, 2000)
      const ref = new Normal(0, 1)
      assert(ksTest(samples.map(s => s[0]), x => ref.cdf(x)))
      assert(ksTest(samples.map(s => s[1]), x => ref.cdf(x)))
    })
  })

  // Same AR(1)-correlation target as the AdaptiveMetropolis/RWM ESS comparison, plus its
  // analytical gradient (grad log p(x) = -Q x for a zero-mean Normal with precision Q).
  // Split into small single-purpose functions so no one function's cyclomatic complexity
  // combines the density loop, the gradient loop, and the diagonal-entry selection.
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
        const mala = new MALA(lnp, gradLnp, { dim: 5 }).seed(seed)
        mala.warmUp(null, warmUpBatches)
        const malaSamples = mala.sample(null, sampleSize)
        const malaEss = ess(mala, mala.samplingRate * malaSamples.length)

        const rwm = new RWM(lnp, { dim: 5 }).seed(seed)
        rwm.warmUp(null, warmUpBatches)
        const rwmSamples = rwm.sample(null, sampleSize)
        const rwmEss = ess(rwm, rwm.samplingRate * rwmSamples.length)

        return malaEss / rwmEss
      })
      const meanRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length

      assert(meanRatio > 1.1, `MALA/RWM mean ESS ratio (${meanRatio}) over seeds ${seeds} should exceed 1.1`)
    })
  })

  describe('.seed()', () => {
    [0, 42, 12345].forEach(seed => {
      it(`should produce bitwise-identical samples when seed ${seed} is applied twice`, () => {
        const mala1 = new MALA(logDensity1D, gradLogDensity1D, { dim: 1 }).seed(seed)
        mala1.warmUp(null, 3)
        const samples1 = mala1.sample(null, 50)

        const mala2 = new MALA(logDensity1D, gradLogDensity1D, { dim: 1 }).seed(seed)
        mala2.warmUp(null, 3)
        const samples2 = mala2.sample(null, 50)

        assert.deepEqual(samples1, samples2)
      })
    })

    it('should produce different samples for different seeds', () => {
      const mala1 = new MALA(logDensity1D, gradLogDensity1D, { dim: 1 }).seed(1)
      mala1.warmUp(null, 3)
      const samples1 = mala1.sample(null, 50)

      const mala2 = new MALA(logDensity1D, gradLogDensity1D, { dim: 1 }).seed(2)
      mala2.warmUp(null, 3)
      const samples2 = mala2.sample(null, 50)

      assert.notDeepEqual(samples1, samples2)
    })
  })
})

describe('mc.ARS', () => {
  describe('constructor', () => {
    it('should throw when support is missing', () => {
      assert.throws(() => new ARS(x => -0.5 * x * x), /support/)
    })

    it('should throw when support does not have length 2', () => {
      assert.throws(() => new ARS(x => -0.5 * x * x, [-1]), /support/)
    })

    it('should throw when support[0] >= support[1]', () => {
      assert.throws(() => new ARS(x => -0.5 * x * x, [1, 1]), /support/)
      assert.throws(() => new ARS(x => -0.5 * x * x, [2, 1]), /support/)
    })

    it('should throw when support contains a non-finite bound', () => {
      assert.throws(() => new ARS(x => -0.5 * x * x, [-Infinity, 8]), /support/)
      assert.throws(() => new ARS(x => -0.5 * x * x, [-8, Infinity]), /support/)
      assert.throws(() => new ARS(x => -0.5 * x * x, [NaN, 8]), /support/)
    })

    it('should throw when logDensity is not a function', () => {
      assert.throws(() => new ARS(null, [-8, 8]), /logDensity/)
    })

    it('should not throw for a valid log-concave target and finite support', () => {
      assert.doesNotThrow(() => new ARS(x => -0.5 * x * x, [-8, 8], x => -x))
    })

    it('should throw when derivative is provided but is not a function', () => {
      assert.throws(() => new ARS(x => -0.5 * x * x, [-8, 8], 5), /derivative/)
    })
  })

  describe('.sample() distributional test', () => {
    // Fixed seeds (matching the mc.RWM.seed() convention) rather than a single unseeded run:
    // a KS test at this significance threshold has an inherent ~1% false-positive rate per draw,
    // so an unseeded test would flake at that rate on every CI run. Pinning specific seeds makes
    // the outcome deterministic and reproducible instead of trading flakiness for a coin flip.
    // See solutions/testing/2026-07-15-1044-ars-unseeded-ks-test-flake-fixed-seeds.md
    const seeds = [0, 42, 12345]

    seeds.forEach(seed => {
      it(`should produce samples matching Normal(0,1) target (KS test, seed ${seed})`, () => {
        const lo = -8
        const hi = 8
        // unnormalized: dropping the -0.5*log(2*pi) constant does not change the sampled shape
        const ars = new ARS(x => -0.5 * x * x, [lo, hi], x => -x).seed(seed)
        const samples = ars.sample(2000)
        const ref = new Normal(0, 1)
        assert(ksTest(samples, x => ref.cdf(x)))
        assert(samples.every(x => x >= lo && x <= hi))
      })
    })

    seeds.forEach(seed => {
      it(`should produce samples matching a Gamma(3, 1.5) target without an explicit derivative (KS test, seed ${seed})`, () => {
        const alpha = 3
        const beta = 1.5
        const lo = 1e-3
        const hi = 15
        // unnormalized: dropping the log(beta^alpha / Gamma(alpha)) constant does not change the sampled shape
        const ars = new ARS(x => (alpha - 1) * Math.log(x) - beta * x, [lo, hi]).seed(seed)
        const samples = ars.sample(2000)
        const ref = new Gamma(alpha, beta)
        assert(ksTest(samples, x => ref.cdf(x)))
        assert(samples.every(x => x >= lo && x <= hi))
      })
    })

    seeds.forEach(seed => {
      it(`should produce samples matching a Beta(2, 3) target (KS test, seed ${seed})`, () => {
        const alpha = 2
        const beta = 3
        const lo = 1e-3
        const hi = 1 - 1e-3
        // unnormalized: dropping the -log(B(alpha, beta)) constant does not change the sampled shape
        const logDensity = x => (alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x)
        const derivative = x => (alpha - 1) / x - (beta - 1) / (1 - x)
        const ars = new ARS(logDensity, [lo, hi], derivative).seed(seed)
        const samples = ars.sample(2000)
        const ref = new Beta(alpha, beta)
        assert(ksTest(samples, x => ref.cdf(x)))
        assert(samples.every(x => x >= lo && x <= hi))
      })
    })
  })

  describe('adaptive envelope tightening', () => {
    // Seeded for a deterministic, reproducible comparison: with only a handful of abscissae,
    // almost all hull-tightening happens in the first few dozen draws, so comparing a small
    // early block against a much larger later block (rather than asserting strict pairwise
    // monotonicity across many same-sized blocks, which is dominated by sampling noise once
    // the envelope has already converged) is the robust way to observe the tightening effect.
    // Extra logDensity calls (beyond the one-per-draw baseline) are counted directly rather
    // than as a ratio, so a block that happens to need zero extra evaluations can't produce a
    // vacuous Infinity/Infinity comparison.
    ;[0, 42, 12345].forEach(seed => {
      it(`should require far fewer extra logDensity evaluations per draw once the envelope has tightened (seed ${seed})`, () => {
        let calls = 0
        const logDensity = x => { calls++; return -0.5 * x * x }
        const ars = new ARS(logDensity, [-8, 8], x => -x).seed(seed)

        const c0 = calls
        ars.sample(50)
        const earlyExtraCalls = calls - c0

        const c1 = calls
        ars.sample(3000)
        const laterExtraCalls = calls - c1

        // the hull is still coarse after only 3 bootstrap points, so tightening it requires
        // at least a few extra evaluations during the small early block
        assert(earlyExtraCalls > 0, 'expected at least one extra logDensity call while the envelope is still forming')
        // once converged, the vast majority of the later block's draws should be accepted via
        // the squeeze test alone — an absolute bound, not just a relative one
        assert(laterExtraCalls / 3000 < 0.05, `later block needed ${laterExtraCalls} extra calls over 3000 draws`)
        assert(earlyExtraCalls / 50 > laterExtraCalls / 3000, 'evaluation rate did not improve from the early to the later block')
      })
    })
  })

  describe('non-log-concave target', () => {
    it('should throw an Error for a clearly non-log-concave (bimodal) density', () => {
      const logDensity = x => Math.log(
        0.5 * Math.exp(-0.5 * (x + 3) * (x + 3)) + 0.5 * Math.exp(-0.5 * (x - 3) * (x - 3))
      )
      assert.throws(() => new ARS(logDensity, [-8, 8]), /log-concave/)
    })
  })

  describe('.seed()', () => {
    it('should produce bitwise-identical samples when the same seed is applied twice', () => {
      const logDensity = x => -0.5 * x * x
      const derivative = x => -x

      const ars1 = new ARS(logDensity, [-8, 8], derivative).seed(42)
      const samples1 = ars1.sample(50)

      const ars2 = new ARS(logDensity, [-8, 8], derivative).seed(42)
      const samples2 = ars2.sample(50)

      assert.deepEqual(samples1, samples2)
    })
  })
})

describe('mc.SliceSampler', () => {
  describe('constructor', () => {
    it('should instantiate without error for a 1D Normal target', () => {
      assert.doesNotThrow(() => new SliceSampler(x => -0.5 * x[0] * x[0], { dim: 1 }))
    })

    it('should default w to 1.0 per dimension when omitted', () => {
      const slice = new SliceSampler(x => -0.5 * x[0] * x[0], { dim: 1 })
      assert.deepEqual(slice.state().internal.w, [1.0])
    })

    it('should broadcast an explicit scalar w from initialState.internal to every dimension', () => {
      const slice = new SliceSampler(x => -0.5 * (x[0] * x[0] + x[1] * x[1]), { dim: 2 }, { internal: { w: 2.5 } })
      assert.deepEqual(slice.state().internal.w, [2.5, 2.5])
    })

    it('should throw for w: 0', () => {
      assert.throws(() => new SliceSampler(x => -0.5 * x[0] * x[0], { dim: 1 }, { internal: { w: 0 } }), /w must be a positive number/)
    })

    it('should throw for a negative w', () => {
      assert.throws(() => new SliceSampler(x => -0.5 * x[0] * x[0], { dim: 1 }, { internal: { w: -1 } }), /w must be a positive number/)
    })

    it('should throw for a non-finite w', () => {
      assert.throws(() => new SliceSampler(x => -0.5 * x[0] * x[0], { dim: 1 }, { internal: { w: NaN } }), /w must be a positive number/)
    })

    it('should throw for w: Infinity', () => {
      // Infinity passes a naive `typeof w === 'number' && w > 0` check but breaks _stepOut
      // (l = x0 - Infinity * U = -Infinity, r = l + Infinity = NaN), so it must be rejected here.
      assert.throws(() => new SliceSampler(x => -0.5 * x[0] * x[0], { dim: 1 }, { internal: { w: Infinity } }), /w must be a positive number/)
    })

    it('should throw when a per-dimension w array contains a non-positive entry', () => {
      assert.throws(() => new SliceSampler(x => -0.5 * (x[0] * x[0] + x[1] * x[1]), { dim: 2 }, { internal: { w: [1, 0] } }), /w must be a positive number/)
    })

    it('should throw when a per-dimension w array length does not match dim', () => {
      assert.throws(() => new SliceSampler(x => -0.5 * (x[0] * x[0] + x[1] * x[1]), { dim: 2 }, { internal: { w: [1] } }), /w must be a positive number/)
    })
  })

  describe('._iter()', () => {
    it('should update every dimension within one sweep', () => {
      // Continuous target: P(new coordinate === old coordinate) = 0, so any
      // accepted draw differing in every dimension confirms the full sweep ran,
      // not just a subset of dimensions.
      const slice = new SliceSampler(x => -0.5 * (x[0] * x[0] + x[1] * x[1]), { dim: 2 }, { x: [0, 0] }).seed(11)
      const prev = slice.x.slice()
      const { x, accepted } = slice.iterate()
      assert.strictEqual(accepted, true)
      assert.notStrictEqual(x[0], prev[0])
      assert.notStrictEqual(x[1], prev[1])
    })
  })

  describe('.ar()', () => {
    it('should always be 1.0 regardless of the number of iterations', () => {
      const slice = new SliceSampler(x => -0.5 * x[0] * x[0], { dim: 1 })
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
      const slice1 = new SliceSampler(lnp, { dim: 1 }).seed(3)
      slice1.warmUp(null, 3)
      const state = slice1.state()
      const slice2 = new SliceSampler(lnp, { dim: 1 }, state)
      assert.deepEqual(slice2.x, state.x)
      assert.strictEqual(slice2.samplingRate, state.samplingRate)
      assert.deepEqual(slice2.state().internal.w, state.internal.w)
    })
  })

  describe('warm-up adaptation', () => {
    it('should grow w toward the target scale, not diverge unboundedly', () => {
      // Normal(0, 10): lnp(x) = -0.5 * x^2 / 100. Two-sided bound: a lower bound alone would
      // still pass if the Robbins-Monro sign were inverted-but-always-grows (w can reach
      // ~exp(1000 * 0.01) = ~22026 if the adaptation never settles toward an equilibrium), so
      // the upper bound catches runaway growth that a one-sided check would miss.
      const slice = new SliceSampler(x => -0.5 * x[0] * x[0] / 100, { dim: 1 }).seed(13)
      slice.warmUp(null, 10)
      const w = slice.state().internal.w[0]
      assert(w > 2 && w < 200, `w = ${w}, expected to settle near the target's scale, neither stuck near the default nor diverging`)
    })
  })

  describe('.sample() distributional test', () => {
    it('should produce samples matching Normal(0,1) target (KS test)', () => {
      const slice = new SliceSampler(x => -0.5 * x[0] * x[0], { dim: 1 }).seed(5)
      slice.warmUp(null, 10)
      const samples = slice.sample(null, 2000)
      const values = samples.map(s => s[0])
      const ref = new Normal(0, 1)
      assert(ksTest(values, x => ref.cdf(x)))
    })

    it('should recover both margins of a correlated bivariate Normal target (KS test)', () => {
      const rho = 0.5
      const lnp = x => -0.5 / (1 - rho * rho) * (x[0] * x[0] - 2 * rho * x[0] * x[1] + x[1] * x[1])
      const slice = new SliceSampler(lnp, { dim: 2 }, { x: [0, 0] }).seed(7)
      slice.warmUp(null, 10)
      const samples = slice.sample(null, 2000)
      const ref = new Normal(0, 1)
      assert(ksTest(samples.map(s => s[0]), x => ref.cdf(x)))
      assert(ksTest(samples.map(s => s[1]), x => ref.cdf(x)))
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

describe('mc.runChains', () => {
  const logDensity = x => -0.5 * x[0] ** 2

  describe('input validation', () => {
    it('should throw when chains is fewer than two', () => {
      assert.throws(() => runChains(logDensity, { dim: 1 }, { chains: 1 }), /at least two chains/)
    })

    it('should throw when chains is zero', () => {
      assert.throws(() => runChains(logDensity, { dim: 1 }, { chains: 0 }), /at least two chains/)
    })

    it('should throw when chains is not an integer', () => {
      assert.throws(() => runChains(logDensity, { dim: 1 }, { chains: 2.5 }), /at least two chains/)
    })

    it('should throw when seeds.length does not match chains', () => {
      assert.throws(() => runChains(logDensity, { dim: 1 }, { chains: 5, seeds: [1, 2, 3] }), /seeds.length must equal.*chains/)
    })

    it('should throw when chains exceeds the maximum allowed', () => {
      // warmUpBatches/sampleSize: 0 keeps this fast — the bound must be checked
      // before any chain is constructed, not discovered by running out of time.
      assert.throws(
        () => runChains(logDensity, { dim: 1 }, { chains: 10001, warmUpBatches: 0, sampleSize: 0 }),
        /chains must be at most/
      )
    })
  })

  describe('defaults', () => {
    it('should default to two chains seeded 1 and 2 when chains/seeds are omitted', () => {
      const { samples } = runChains(logDensity, { dim: 1 }, { warmUpBatches: 2, sampleSize: 20 })

      const manual = [1, 2].map(seed => {
        const rwm = new RWM(logDensity, { dim: 1 }).seed(seed)
        rwm.warmUp(null, 2)
        return rwm.sample(null, 20)
      })

      assert.deepEqual(samples, manual)
    })
  })

  describe('output shape', () => {
    it('should return samples for the requested chain count and sample size', () => {
      const { samples } = runChains(logDensity, { dim: 1 }, { chains: 3, warmUpBatches: 2, sampleSize: 15 })
      assert.strictEqual(samples.length, 3)
      samples.forEach(chain => assert.strictEqual(chain.length, 15))
    })

    it('should return one rhat array per state dimension, each of length sampleSize - 1', () => {
      const { rhat } = runChains(logDensity, { dim: 1 }, { chains: 2, warmUpBatches: 2, sampleSize: 15 })
      assert.strictEqual(rhat.length, 1)
      assert.strictEqual(rhat[0].length, 14)
    })
  })

  describe('seeded reproducibility', () => {
    it('should match manually constructed chains seeded with the same explicit seeds', () => {
      const { samples } = runChains(logDensity, { dim: 1 }, { chains: 3, seeds: [10, 20, 30], warmUpBatches: 2, sampleSize: 15 })

      const manual = [10, 20, 30].map(seed => {
        const rwm = new RWM(logDensity, { dim: 1 }).seed(seed)
        rwm.warmUp(null, 2)
        return rwm.sample(null, 15)
      })

      assert.deepEqual(samples, manual)
    })
  })

  describe('maxLength', () => {
    it('should cap rhat length the same way gelmanRubin does', () => {
      const { rhat } = runChains(logDensity, { dim: 1 }, { chains: 2, warmUpBatches: 2, sampleSize: 15, maxLength: 3 })
      assert.strictEqual(rhat[0].length, 3)
    })
  })

  describe('convergence', () => {
    it('should converge to R-hat < 1.1 for a well-tuned unit-Gaussian target', () => {
      const { rhat } = runChains(logDensity, { dim: 1 }, { chains: 2, warmUpBatches: 10, sampleSize: 500, seeds: [100, 200] })
      assert.isBelow(rhat[0][rhat[0].length - 1], 1.1)
    })
  })
})
