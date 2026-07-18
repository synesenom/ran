import { assert } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import MCMC from '../src/mc/_mcmc'
import RWM from '../src/mc/rwm'
import AdaptiveMetropolis from '../src/mc/adaptive-metropolis'
import Gibbs from '../src/mc/gibbs'
import HMC from '../src/mc/hmc'
import MALA from '../src/mc/mala'
import NUTS from '../src/mc/nuts'
import ARS from '../src/mc/ars'
import Slice from '../src/mc/slice'
import gelmanRubin from '../src/mc/gelman-rubin'
import runChains from '../src/mc/run-chains'
import ParallelTempering from '../src/mc/parallel-tempering'
import { Normal, Gamma, Beta } from '../src/dist'
import pearson from '../src/dependence/pearson'
import { ksTest, ess } from './test-utils'

// ksTest's critical value (test/test-utils.js) is the standard two-sided KS asymptotic
// constant at alpha=0.01 (D <= 1.628/sqrt(n)) -- every unseeded call has an inherent ~1%
// false-positive rate per CI run. Every distributional/margin-recovery KS assertion in this
// file therefore sweeps a fixed, pre-verified seed set -- [0, 42, 12345] (or, for Gibbs,
// [0, 7, 42] -- see that block's own comment for why) -- instead of relying on a single seed,
// so a real regression must break at least one of three independent trajectories reproducibly
// instead of the whole block carrying a permanent flake rate or, worse, having its seed
// hand-picked because it happened to pass. See
// solutions/testing/2026-07-15-1044-ars-unseeded-ks-test-flake-fixed-seeds.md,
// solutions/testing/2026-07-15-2015-gibbs-conditionals-fresh-normal-seed-noop.md, and
// solutions/testing/2026-07-17-1615-mcmc-ks-test-seed-sweep-file-wide-policy.md
const SEEDS = [0, 42, 12345]

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

// Shared parity check for a migrated sampler's two constructor forms, reused by every sampler's
// options-object block (RWM, Slice, ...) so the assertion lives in exactly one place.
// Verifies the options-object form yields an identical sampler to the positional form: same
// resolved config, same initial position, same serialized internal state (RWM's proposal,
// Slice's w, ...), and the same first iteration once both are seeded alike.
// maxLag/arWindow are intentionally left out of `config` by callers so a match can only happen if
// _resolveConstructorArgs threads the options-form config through _resolveConfig's defaulting the
// same way the positional form does — a pass-through-only comparison couldn't catch that.
function assertConstructorFormsMatch (Ctor, logDensity, config, initialState) {
  const positional = new Ctor(logDensity, config, initialState)
  const options = new Ctor({ logDensity, config, initialState })
  assert.strictEqual(options.dim, positional.dim)
  assert.strictEqual(options.maxLag, positional.maxLag)
  assert.strictEqual(options._arWindow, positional._arWindow)
  assert.deepStrictEqual(options.x, positional.x)
  assert.deepStrictEqual(options.state().internal, positional.state().internal)
  options.seed(11)
  positional.seed(11)
  assert.deepStrictEqual(options.iterate(), positional.iterate())
}

// Same purpose as assertConstructorFormsMatch, extended for HMC/MALA/NUTS's extra
// gradLogDensity argument between logDensity and config.
function assertGradientConstructorFormsMatch (Ctor, logDensity, gradLogDensity, config, initialState) {
  const positional = new Ctor(logDensity, gradLogDensity, config, initialState)
  const options = new Ctor({ logDensity, gradLogDensity, config, initialState })
  assert.strictEqual(options.dim, positional.dim)
  assert.strictEqual(options.maxLag, positional.maxLag)
  assert.strictEqual(options._arWindow, positional._arWindow)
  assert.deepStrictEqual(options.x, positional.x)
  assert.deepStrictEqual(options.state().internal, positional.state().internal)
  options.seed(11)
  positional.seed(11)
  assert.deepStrictEqual(options.iterate(), positional.iterate())
}

// Direct unit tests for the ess() test-utils helper, which reduces a sampler's per-dimension
// ess() (ran.mc.MCMC#ess) to a single scalar via Math.min -- the ESS truncation arithmetic
// itself is covered directly against MCMC#ess() in the 'mc.MCMC .ess()' block above; these
// tests isolate the min-reduction wrapper using mock samplers with a stubbed ess() method.
describe('test-utils.ess', () => {
  it('should pass through a single-dimension ess() value unchanged', () => {
    const mock = { ess: () => [30] }
    assert.strictEqual(ess(mock), 30)
  })

  it('should return the minimum across dimensions, not the first or the maximum', () => {
    // The first entry is deliberately larger than the second so a bug that picked
    // Math.max, or just the first element, would be caught.
    const mock = { ess: () => [76.923076923077, 50] }
    assert.strictEqual(ess(mock), 50)
  })
})

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

  describe('.ess()', () => {
    it('should return 0 for an unstarted sampler (no observations)', () => {
      // n = _acN = 0, ac()'s lag-1 entry is NaN, the loop breaks immediately with sum = 0,
      // so ess() = 0/(1+0) = 0 -- deliberately not NaN, unlike ac()'s own no-data convention.
      const mc = new TestMCMC([])
      const essVal = mc.ess()
      assert.strictEqual(essVal.length, 1)
      assert.strictEqual(essVal[0], 0)
    })

    it('should match a hand-calculated value for a known sequence', () => {
      const mc = new TestMCMC([1, 2, 3, 4, 5].map(v => ({ x: [v], accepted: true })))
      for (let i = 0; i < 5; i++) mc.iterate()
      const essVal = mc.ess()
      // exact rational: rho[1] = 0.5, rho[2] = -1/6 (< 0, stops the sum), so
      // ess = n / (1 + 2*rho[1]) = 5 / (1 + 1.0) = 2.5
      assert.closeTo(essVal[0], 2.5, 1e-12)
    })

    it('should compute an independent ess() per dimension for a known 2D sequence', () => {
      // dim 0 replays the [1,2,3,4,5] case above (ess = 2.5); dim 1 alternates sign, giving
      // rho[1] < 0 (immediate truncation) and thus ess = n = 5 exactly.
      const seq = [[1, 1], [2, -1], [3, 1], [4, -1], [5, 1]].map(x => ({ x, accepted: true }))
      const mc = new TestMCMC(seq, { dim: 2 })
      for (let i = 0; i < 5; i++) mc.iterate()
      const essVal = mc.ess()
      assert.strictEqual(essVal.length, 2)
      assert.closeTo(essVal[0], 2.5, 1e-12)
      assert.closeTo(essVal[1], 5, 1e-12)
    })

    it('should stay close to N for a genuinely independent (seeded) sequence', () => {
      const normal = new Normal(0, 1).seed(42)
      const n = 2000
      const seq = Array.from({ length: n }, () => ({ x: [normal.sample()], accepted: true }))
      const mc = new TestMCMC(seq)
      for (let i = 0; i < n; i++) mc.iterate()
      const essVal = mc.ess()
      // Sample autocorrelation of a genuinely iid sequence is small and centered at 0, so
      // Geyer's estimator truncates near lag 1 and ess() should stay close to N.
      assert(essVal[0] > n * 0.8, `ess (${essVal[0]}) should stay close to N=${n} for an iid sequence`)
    })

    it('should fall well below N for a strongly autocorrelated (seeded AR(1)) sequence', () => {
      const noise = new Normal(0, 0.1).seed(7)
      const n = 2000
      const phi = 0.98
      let x = 0
      const seq = Array.from({ length: n }, () => {
        x = phi * x + noise.sample()
        return { x: [x], accepted: true }
      })
      const mc = new TestMCMC(seq)
      for (let i = 0; i < n; i++) mc.iterate()
      const essVal = mc.ess()
      // Theoretical AR(1) ESS is N*(1-phi)/(1+phi) = 2000*0.02/1.98 ~= 20, roughly two orders
      // of magnitude below N -- n * 0.1 leaves comfortable margin without being a loose bound.
      assert(essVal[0] < n * 0.1, `ess (${essVal[0]}) should be well below N=${n} for a strongly autocorrelated sequence`)
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

  describe('options-object constructor form', () => {
    let originalWarn
    let warnCalls

    beforeEach(() => {
      originalWarn = console.warn
      warnCalls = []
      console.warn = (...args) => warnCalls.push(args)
    })

    afterEach(() => {
      console.warn = originalWarn
    })

    it('should behave identically to the positional form, including config defaults never explicitly passed', () => {
      assertConstructorFormsMatch(RWM, x => -0.5 * x[0] * x[0], { dim: 1 }, { x: [2] })
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

    it('should validate config the same way as the positional form', () => {
      assert.throws(() => new RWM({ logDensity: () => 0, config: { dim: 0 } }), /dim must be a positive integer/)
    })

    it('should not emit a deprecation warning for the options-object form', () => {
      assert.doesNotThrow(() => new RWM({ logDensity: () => 0 }))
      assert.strictEqual(warnCalls.length, 0)
    })

    it('should emit exactly one deprecation warning per instantiation for the positional form', () => {
      assert.doesNotThrow(() => new RWM(() => 0))
      assert.strictEqual(warnCalls.length, 1)
      assert.match(warnCalls[0][0], /\[ranjs] positional MCMC constructor arguments are deprecated/)
      assert.match(warnCalls[0][0], /new RWM\({ logDensity, config, initialState }\)/)

      assert.doesNotThrow(() => new RWM(() => 0))
      assert.strictEqual(warnCalls.length, 2)
    })

    it('should not emit a deprecation warning for a sampler not yet migrated to the options form', () => {
      // Gibbs always forwards `null` (not a genuine logDensity function) to the MCMC base
      // constructor and has no options-object support yet; warning here would point users at
      // `new Gibbs({ logDensity, config, initialState })`, which Gibbs's own array-typed first
      // argument would then reject outright. See MCMC._supportsOptionsConstructor (default false).
      assert.doesNotThrow(() => new Gibbs([() => 0], { dim: 1 }))
      assert.strictEqual(warnCalls.length, 0)
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

    SEEDS.forEach(seed => {
      it(`should recover both margins of an independent 2D standard Normal target (KS test, seed ${seed})`, () => {
        const rwm = new RWM(x => -0.5 * (x[0] * x[0] + x[1] * x[1]), { dim: 2 }).seed(seed)
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
    SEEDS.forEach(seed => {
      it(`should produce samples matching Normal(0,1) target (KS test, seed ${seed})`, () => {
        const rwm = new RWM(x => -0.5 * x[0] * x[0], { dim: 1 }).seed(seed)
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

  describe('options-object constructor form', () => {
    let originalWarn
    let warnCalls

    beforeEach(() => {
      originalWarn = console.warn
      warnCalls = []
      console.warn = (...args) => warnCalls.push(args)
    })

    afterEach(() => {
      console.warn = originalWarn
    })

    it('should behave identically to the positional form, including config defaults never explicitly passed', () => {
      const logDensity = x => -0.5 * x[0] * x[0]
      const positional = new AdaptiveMetropolis(logDensity, { dim: 1 }, { x: [2] })
      const options = new AdaptiveMetropolis({ logDensity, config: { dim: 1 }, initialState: { x: [2] } })
      assert.strictEqual(options.dim, positional.dim)
      // maxLag/arWindow are not passed on either side, so a match here can only happen if
      // _resolveConstructorArgs threads the options-form config through _resolveConfig's
      // defaulting the same way the positional form's config does — a pass-through-only test
      // (e.g. comparing an explicitly-passed field back to itself) couldn't catch that.
      assert.strictEqual(options.maxLag, positional.maxLag)
      assert.strictEqual(options._arWindow, positional._arWindow)
      assert.deepStrictEqual(options.x, positional.x)
      options.seed(11)
      positional.seed(11)
      assert.deepStrictEqual(options.iterate(), positional.iterate())
    })

    it('should default config and initialState when omitted entirely from the options object', () => {
      const am = new AdaptiveMetropolis({ logDensity: x => -0.5 * x[0] * x[0] })
      assert.strictEqual(am.dim, 1)
      assert.strictEqual(am.maxLag, 100)
    })

    it('should resolve config when initialState is omitted from the options object', () => {
      const am = new AdaptiveMetropolis({ logDensity: x => -0.5 * (x[0] * x[0] + x[1] * x[1]), config: { dim: 2 } })
      assert.strictEqual(am.dim, 2)
    })

    it('should resolve initialState when config is omitted from the options object', () => {
      const am = new AdaptiveMetropolis({ logDensity: () => 0, initialState: { x: [7] } })
      assert.deepStrictEqual(am.x, [7])
    })

    it('should validate config the same way as the positional form', () => {
      assert.throws(() => new AdaptiveMetropolis({ logDensity: () => 0, config: { dim: 0 } }), /dim must be a positive integer/)
    })

    it('should not emit a deprecation warning for the options-object form', () => {
      assert.doesNotThrow(() => new AdaptiveMetropolis({ logDensity: () => 0 }))
      assert.strictEqual(warnCalls.length, 0)
    })

    it('should emit exactly one deprecation warning per instantiation for the positional form', () => {
      assert.doesNotThrow(() => new AdaptiveMetropolis(() => 0))
      assert.strictEqual(warnCalls.length, 1)
      assert.match(warnCalls[0][0], /\[ranjs] positional MCMC constructor arguments are deprecated/)
      assert.match(warnCalls[0][0], /new AdaptiveMetropolis\({ logDensity, config, initialState }\)/)

      assert.doesNotThrow(() => new AdaptiveMetropolis(() => 0))
      assert.strictEqual(warnCalls.length, 2)
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

  describe('EPS regularization under near-singular covariance', () => {
    it('should not throw and should regularize the proposal transform to exactly EPS * I when warmUp() sees an all-rejecting target', () => {
      // lnp = () => -Infinity: every proposal is rejected (see "._iter() rejection" above), so x
      // never moves and the online covariance accumulator stays exactly rank-deficient (all-zero)
      // throughout warm-up -- the near-singular case EPS * I exists to guard against.
      const dim = 3
      const am = new AdaptiveMetropolis(() => -Infinity, { dim }, { x: new Array(dim).fill(0) })
      assert.doesNotThrow(() => am.warmUp(null, 1))
      const { proposal } = am.state().internal
      // exact rational: Sigma_proposal = _sd * Cov(x) + EPS * I collapses to EPS * I since Cov(x)
      // is exactly zero (every proposal rejected), so ldl() yields L = I, D = EPS * I, and
      // A = L * sqrt(D) = diag(sqrt(EPS), sqrt(EPS), sqrt(EPS)) with zero off-diagonal entries.
      proposal.forEach((row, i) => row.forEach((v, j) => {
        assert.closeTo(v, i === j ? Math.sqrt(1e-6) : 0, 1e-9)
      }))
    })
  })

  describe('joint proposals', () => {
    it('should perturb every component during warm-up, not one at a time', () => {
      const am = new AdaptiveMetropolis(() => 0, { dim: 3 }, { x: [0, 0, 0] }).seed(42)
      const prev = am.x.slice()
      const { x } = am.iterate(null, true)
      assert.strictEqual(x.filter((v, j) => v !== prev[j]).length, 3)
    })

    SEEDS.forEach(seed => {
      it(`should recover both margins of an independent 2D standard Normal target (KS test, seed ${seed})`, () => {
        const am = new AdaptiveMetropolis(x => -0.5 * (x[0] * x[0] + x[1] * x[1]), { dim: 2 }).seed(seed)
        am.warmUp(null, 10)
        const samples = am.sample(null, 2000)
        const ref = new Normal(0, 1)
        assert(ksTest(samples.map(s => s[0]), x => ref.cdf(x)))
        assert(ksTest(samples.map(s => s[1]), x => ref.cdf(x)))
      })
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
    SEEDS.forEach(seed => {
      it(`should produce samples matching Normal(0,1) target (KS test, seed ${seed})`, () => {
        const am = new AdaptiveMetropolis(x => -0.5 * x[0] * x[0], { dim: 1 }).seed(seed)
        am.warmUp(null, 10)
        const samples = am.sample(null, 2000)
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
        am.sample(null, sampleSize)
        const amEss = ess(am)

        const rwm = new RWM(lnp, { dim: 5 }).seed(seed)
        rwm.warmUp(null, warmUpBatches)
        rwm.sample(null, sampleSize)
        const rwmEss = ess(rwm)

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

    it('should throw for a pathLength above the maximum allowed', () => {
      assert.throws(() => new HMC(logDensity1D, gradLogDensity1D, { dim: 1, pathLength: 1e9 }), /pathLength must be at most/)
      assert.throws(() => new HMC(logDensity1D, gradLogDensity1D, { dim: 1, pathLength: 10001 }), /pathLength must be at most/)
    })

    it('should not throw for a pathLength at the maximum allowed', () => {
      assert.doesNotThrow(() => new HMC(logDensity1D, gradLogDensity1D, { dim: 1, pathLength: 10000 }))
    })

    it('should not throw for valid stepSize and pathLength', () => {
      assert.doesNotThrow(() => new HMC(logDensity1D, gradLogDensity1D, { dim: 1, stepSize: 0.2, pathLength: 5 }))
    })

    it('should default to metric: diag when config.metric is omitted', () => {
      const hmc = new HMC(logDensity1D, gradLogDensity1D, { dim: 1 })
      assert.strictEqual(hmc.state().internal.metric.type, 'diag')
    })

    it('should accept metric: dense', () => {
      const hmc = new HMC(logDensity2D, gradLogDensity2D, { dim: 2, metric: 'dense' })
      assert.strictEqual(hmc.state().internal.metric.type, 'dense')
    })

    it('should throw when metric is neither diag nor dense', () => {
      assert.throws(() => new HMC(logDensity1D, gradLogDensity1D, { dim: 1, metric: 'bogus' }), /metric must be/)
    })

    it('should throw when metric: dense exceeds the dense dimension cap', () => {
      assert.throws(() => new HMC(logDensity1D, gradLogDensity1D, { dim: 1001, metric: 'dense' }), /dense/i)
    })

    it('should not throw for metric: dense at the dimension cap boundary or at dim: 1', () => {
      assert.doesNotThrow(() => new HMC(logDensity1D, gradLogDensity1D, { dim: 1000, metric: 'dense' }))
      const hmc = new HMC(logDensity1D, gradLogDensity1D, { dim: 1, metric: 'dense' })
      assert.doesNotThrow(() => hmc.iterate())
    })

    it('should throw when a resumed internal.metric.type mismatches the resolved metric type', () => {
      assert.throws(
        () => new HMC(logDensity1D, gradLogDensity1D, { dim: 1 }, { internal: { stepSize: 0.1, pathLength: 10, metric: { type: 'dense', L: [[1]], D: [1] } } }),
        /metric/i
      )
    })

    it('should throw when a resumed diagonal internal.metric.variance has the wrong length', () => {
      assert.throws(
        () => new HMC(logDensity2D, gradLogDensity2D, { dim: 2 }, { internal: { stepSize: 0.1, pathLength: 10, metric: { type: 'diag', variance: [1] } } }),
        /metric/i
      )
    })

    it('should throw when a resumed diagonal internal.metric.variance contains a non-positive value', () => {
      assert.throws(
        () => new HMC(logDensity1D, gradLogDensity1D, { dim: 1 }, { internal: { stepSize: 0.1, pathLength: 10, metric: { type: 'diag', variance: [0] } } }),
        /metric/i
      )
    })

    it('should throw when a resumed diagonal internal.metric.variance contains a non-finite value', () => {
      assert.throws(
        () => new HMC(logDensity1D, gradLogDensity1D, { dim: 1 }, { internal: { stepSize: 0.1, pathLength: 10, metric: { type: 'diag', variance: [Infinity] } } }),
        /metric/i
      )
    })

    it('should throw when a resumed dense internal.metric.D has the wrong length', () => {
      assert.throws(
        () => new HMC(logDensity2D, gradLogDensity2D, { dim: 2, metric: 'dense' }, { internal: { stepSize: 0.1, pathLength: 10, metric: { type: 'dense', L: [[1, 0], [0, 1]], D: [1] } } }),
        /metric/i
      )
    })

    it('should throw when a resumed dense internal.metric.L is malformed', () => {
      assert.throws(
        () => new HMC(logDensity2D, gradLogDensity2D, { dim: 2, metric: 'dense' }, { internal: { stepSize: 0.1, pathLength: 10, metric: { type: 'dense', L: [[1, 0]], D: [1, 1] } } }),
        /metric/i
      )
    })
  })

  describe('options-object constructor form', () => {
    let originalWarn
    let warnCalls

    beforeEach(() => {
      originalWarn = console.warn
      warnCalls = []
      console.warn = (...args) => warnCalls.push(args)
    })

    afterEach(() => {
      console.warn = originalWarn
    })

    it('should behave identically to the positional form, including config defaults never explicitly passed', () => {
      assertGradientConstructorFormsMatch(HMC, logDensity1D, gradLogDensity1D, { dim: 1 }, { x: [2] })
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

    it('should validate gradLogDensity the same way as the positional form', () => {
      assert.throws(
        () => new HMC({ logDensity: logDensity1D, gradLogDensity: null, config: { dim: 1 } }),
        /gradLogDensity must be a function/
      )
    })

    it('should validate config the same way as the positional form', () => {
      assert.throws(
        () => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, stepSize: 0 } }),
        /stepSize must be a positive number/
      )
      assert.throws(
        () => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, pathLength: 0 } }),
        /pathLength must be a positive integer/
      )
      assert.throws(
        () => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D, config: { dim: 1, metric: 'bogus' } }),
        /metric must be/
      )
    })

    it('should not emit a deprecation warning for the options-object form', () => {
      assert.doesNotThrow(() => new HMC({ logDensity: logDensity1D, gradLogDensity: gradLogDensity1D }))
      assert.strictEqual(warnCalls.length, 0)
    })

    it('should emit exactly one deprecation warning per instantiation for the positional form', () => {
      assert.doesNotThrow(() => new HMC(logDensity1D, gradLogDensity1D))
      assert.strictEqual(warnCalls.length, 1)
      assert.match(warnCalls[0][0], /\[ranjs] positional MCMC constructor arguments are deprecated/)
      assert.match(warnCalls[0][0], /new HMC\({ logDensity, gradLogDensity, config, initialState }\)/)

      assert.doesNotThrow(() => new HMC(logDensity1D, gradLogDensity1D))
      assert.strictEqual(warnCalls.length, 2)
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
      // The diagonal metric adapts alongside stepSize; an empirical sample variance from a
      // continuous target is never bit-for-bit equal to the identity default of 1.
      assert.notStrictEqual(state.internal.metric.variance[0], 1)
      const hmc2 = new HMC(logDensity1D, gradLogDensity1D, { dim: 1 }, state)
      assert.deepEqual(hmc2.x, state.x)
      assert.strictEqual(hmc2.samplingRate, state.samplingRate)
      // Full-object deepEqual, not a spot-checked field — see
      // solutions/correctness/2026-07-11-1230-mcmc-state-key-mismatch-silent-sigma-loss.md
      assert.deepEqual(hmc2.state().internal, state.internal)
    })
  })

  describe('mass matrix adaptation', () => {
    // Per-dimension ESS, mirroring test-utils.js's ess() truncation rule but returning one value
    // per dimension instead of collapsing to the minimum -- needed to compare dimensions against
    // each other rather than just against a different sampler.
    const essPerDimension = (sampler, totalIterations) => sampler.ac().map(rho => {
      let tau = 1
      for (let k = 1; k < rho.length; k++) {
        if (Number.isNaN(rho[k]) || rho[k] < 0) break
        tau += 2 * rho[k]
      }
      return totalIterations / tau
    })

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
          const adapted = new HMC(lnp, grad, { dim: 3 }, { x: [0, 0, 0] }).seed(seed)
          adapted.warmUp(null, warmUpBatches)
          const adaptedSamples = adapted.sample(null, sampleSize)
          const adaptedEss = essPerDimension(adapted, adapted.samplingRate * adaptedSamples.length)
          return Math.max(...adaptedEss) / Math.min(...adaptedEss)
        })
        // No warmUp(): _adjust never runs, so the metric/step size stay at their identity defaults.
        const unadaptedRatios = seeds.map(seed => {
          const unadapted = new HMC(lnp, grad, { dim: 3 }, { x: [0, 0, 0] }).seed(seed)
          const unadaptedSamples = unadapted.sample(null, sampleSize)
          const unadaptedEss = essPerDimension(unadapted, unadapted.samplingRate * unadaptedSamples.length)
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
          const hmc = new HMC(lnp, grad, { dim: 3 }, { x: [0, 0, 0] }).seed(seed)
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
        const hmc1 = new HMC(logDensity2D, gradLogDensity2D, { dim: 2, metric: 'dense' }).seed(11)
        hmc1.warmUp(null, 5)
        for (let i = 0; i < 100; i++) hmc1.iterate()
        const state = hmc1.state()
        // An empirical sample covariance is never bit-for-bit equal to the identity default.
        assert.notDeepEqual(state.internal.metric.D, [1, 1])
        const hmc2 = new HMC(logDensity2D, gradLogDensity2D, { dim: 2, metric: 'dense' }, state)
        assert.deepEqual(hmc2.state().internal, state.internal)
      })

      SEEDS.forEach(seed => {
        it(`should still recover the correct margins of a correlated target under metric adaptation (KS test, seed ${seed})`, () => {
          // Same rationale as the diagonal metric's KS test above, applied to the dense metric's
          // sampling path (_sampleMomentum's back-substitution and _applyInverseMetric's L*D*L^T*p
          // product) -- both margins are standard Normal regardless of rho (see logDensity2D above).
          const hmc = new HMC(logDensity2D, gradLogDensity2D, { dim: 2, metric: 'dense' }).seed(seed)
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
        // Dense and diagonal auto-tune different samplingRate (thinning), so comparing
        // ess(sampler, samplingRate*sampleSize.length) would compare different raw-iteration
        // budgets -- fixing a raw count via sample(null, 0) + manual iterate() avoids that confound.
        const rawIterations = 6000

        const seeds = [1, 2, 3]
        const ratios = seeds.map(seed => {
          const dense = new HMC(lnp, grad, { dim: 2, metric: 'dense' }).seed(seed)
          dense.warmUp(null, warmUpBatches)
          dense.sample(null, 0)
          for (let i = 0; i < rawIterations; i++) dense.iterate()
          const denseEss = essPerDimension(dense, rawIterations)

          const diag = new HMC(lnp, grad, { dim: 2 }).seed(seed)
          diag.warmUp(null, warmUpBatches)
          diag.sample(null, 0)
          for (let i = 0; i < rawIterations; i++) diag.iterate()
          const diagEss = essPerDimension(diag, rawIterations)

          const meanDense = denseEss.reduce((a, b) => a + b, 0) / denseEss.length
          const meanDiag = diagEss.reduce((a, b) => a + b, 0) / diagEss.length
          return meanDense / meanDiag
        })
        const meanRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length

        assert(meanRatio > 1.1, `dense/diagonal mean ESS ratio (${meanRatio}) over seeds ${seeds} should exceed 1.1`)
      })
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
    SEEDS.forEach(seed => {
      it(`should recover both margins of a correlated bivariate Normal target (KS test, seed ${seed})`, () => {
        const hmc = new HMC(logDensity2D, gradLogDensity2D, { dim: 2 }).seed(seed)
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
      // See solutions/testing/2026-07-16-1600-mala-log-scale-storage-strict-equal-trap.md
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
    SEEDS.forEach(seed => {
      it(`should recover both margins of a correlated bivariate Normal target (KS test, seed ${seed})`, () => {
        const mala = new MALA(logDensity2D, gradLogDensity2D, { dim: 2 }).seed(seed)
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
        const mala = new MALA(lnp, gradLnp, { dim: 5 }).seed(seed)
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
      assert.doesNotThrow(() => new NUTS(logDensity2D, gradLogDensity2D, { dim: 2 }))
    })

    it('should default to stepSize: 0.1 when omitted', () => {
      const nuts = new NUTS(logDensity1D, gradLogDensity1D, { dim: 1 })
      assert.strictEqual(nuts.state().internal.stepSize, 0.1)
    })

    it('should throw when gradLogDensity is not a function', () => {
      assert.throws(() => new NUTS(logDensity1D, null, { dim: 1 }), /gradLogDensity must be a function/)
    })

    it('should throw when stepSize is zero', () => {
      assert.throws(() => new NUTS(logDensity1D, gradLogDensity1D, { dim: 1, stepSize: 0 }), /stepSize must be a positive number/)
    })

    it('should throw when stepSize is negative', () => {
      assert.throws(() => new NUTS(logDensity1D, gradLogDensity1D, { dim: 1, stepSize: -0.1 }), /stepSize must be a positive number/)
    })

    it('should throw when stepSize is Infinity', () => {
      assert.throws(() => new NUTS(logDensity1D, gradLogDensity1D, { dim: 1, stepSize: Infinity }), /stepSize must be a positive number/)
    })

    it('should throw when a resumed initialState.internal.stepSize is invalid', () => {
      // initialState.internal is caller-supplied the same way config is (e.g. round-tripped
      // through state()) — a corrupted/adversarial value must be rejected the same way.
      assert.throws(
        () => new NUTS(logDensity1D, gradLogDensity1D, { dim: 1 }, { internal: { stepSize: Infinity } }),
        /stepSize must be a positive number/
      )
    })

    it('should not throw for a valid stepSize', () => {
      assert.doesNotThrow(() => new NUTS(logDensity1D, gradLogDensity1D, { dim: 1, stepSize: 0.2 }))
    })
  })

  describe('._iter() rejection', () => {
    it('should return accepted: false and leave position unchanged when the target is degenerate', () => {
      // logDensity = -Infinity everywhere: every leapfrog point fails the slice/divergence
      // checks, so the tree never accepts a new point and the position is unchanged.
      const nuts = new NUTS(() => -Infinity, () => [0], { dim: 1 }, { x: [42] })
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
      const nuts = new NUTS(logDensity1D, gradLogDensity1D, { dim: 1, stepSize: 1e-4 }, { x: [1] }).seed(1)
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
      const nuts = new NUTS(logDensitySteep, gradLogDensitySteep, { dim: 1, stepSize: 5 }, { x: [1] }).seed(1)
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
      const nuts1 = new NUTS(logDensity1D, gradLogDensity1D, { dim: 1 }).seed(11)
      // warmUp() first so dual averaging actually moves _stepSize away from its 0.1
      // construction-time default — otherwise the round-trip would trivially "pass" against a
      // corrupted read that silently falls back to the same default.
      nuts1.warmUp(null, 5)
      for (let i = 0; i < 20; i++) nuts1.iterate()
      const state = nuts1.state()
      assert.notStrictEqual(state.internal.stepSize, 0.1)
      const nuts2 = new NUTS(logDensity1D, gradLogDensity1D, { dim: 1 }, state)
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
        const nuts = new NUTS(logDensity1D, gradLogDensity1D, { dim: 1 }).seed(seed)
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
        const nuts = new NUTS(logDensity2D, gradLogDensity2D, { dim: 2 }).seed(seed)
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
        const nuts = new NUTS(essLogDensity, essGradLogDensity, { dim: 2 }).seed(seed)
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
        const nuts1 = new NUTS(logDensity1D, gradLogDensity1D, { dim: 1 }).seed(seed)
        nuts1.warmUp(null, 3)
        const samples1 = nuts1.sample(null, 20)

        const nuts2 = new NUTS(logDensity1D, gradLogDensity1D, { dim: 1 }).seed(seed)
        nuts2.warmUp(null, 3)
        const samples2 = nuts2.sample(null, 20)

        assert.deepEqual(samples1, samples2)
      })
    })

    it('should produce different samples for different seeds', () => {
      const nuts1 = new NUTS(logDensity1D, gradLogDensity1D, { dim: 1 }).seed(1)
      nuts1.warmUp(null, 3)
      const samples1 = nuts1.sample(null, 20)

      const nuts2 = new NUTS(logDensity1D, gradLogDensity1D, { dim: 1 }).seed(2)
      nuts2.warmUp(null, 3)
      const samples2 = nuts2.sample(null, 20)

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

  describe('._tangentIntersection()', () => {
    it('should fall back to the midpoint when two slopes differ by less than the finite-difference noise floor', () => {
      const ars = new ARS(x => -0.5 * x * x, [-8, 8], x => -x)
      // A dh difference of 1e-10 is far above raw Number.EPSILON (~2.22e-16) -- so the old
      // raw-EPS guard would not fire -- but far below the Math.cbrt(EPSILON) (~6.06e-6) noise
      // floor the finite-difference slopes actually carry. Left ungated, the division puts the
      // breakpoint at roughly -2e10, wildly outside the [pi.x, pj.x] = [-1, 1] bracket a hull
      // breakpoint must lie in; the fix must instead return the midpoint.
      const pi = { x: -1, h: 0, dh: 1 }
      const pj = { x: 1, h: 0, dh: 1 - 1e-10 }
      assert.strictEqual(ars._tangentIntersection(pi, pj), 0)
    })

    it('should compute the closed-form intersection when slopes differ by more than the noise floor', () => {
      const ars = new ARS(x => -0.5 * x * x, [-8, 8], x => -x)
      const pi = { x: -1, h: 1, dh: 2 }
      const pj = { x: 3, h: -1, dh: -2 }
      // exact rational: (pj.h - pi.h - pj.x*pj.dh + pi.x*pi.dh) / (pi.dh - pj.dh)
      //               = (-1 - 1 - 3*(-2) + (-1)*2) / (2 - (-2)) = (-2 + 6 - 2) / 4 = 0.5
      // distinct from the midpoint (pi.x + pj.x) / 2 = 1, confirming the closed-form branch ran
      assert.strictEqual(ars._tangentIntersection(pi, pj), 0.5)
    })

    it('should switch branches on either side of the tolerance boundary', () => {
      const ars = new ARS(x => -0.5 * x * x, [-8, 8], x => -x)
      // With |pi.dh| = 1 and |pj.dh| close to 1, tol = CBRT_EPS * max(1, |pi.dh|, |pj.dh|)
      // reduces to CBRT_EPS itself, so the two cases below straddle the guard's own threshold
      // from just inside to just outside, rather than only exercising each branch deep in its
      // interior as the two tests above do.
      const tol = Math.cbrt(Number.EPSILON)
      const pi = { x: -1, h: 0, dh: 1 }

      const justInside = { x: 1, h: 0, dh: 1 - tol * 0.5 }
      assert.strictEqual(ars._tangentIntersection(pi, justInside), 0)

      const justOutside = { x: 1, h: 0, dh: 1 - tol * 1.5 }
      // exact rational: (pj.h - pi.h - pj.x*pj.dh + pi.x*pi.dh) / (pi.dh - pj.dh)
      //               = (0 - 0 - (1 - 1.5*tol) - 1) / (1.5*tol) = (1.5*tol - 2) / (1.5*tol)
      // dominated by -2 / (1.5*tol) once tol is this small, landing far outside [pi.x, pj.x] --
      // confirms the closed-form (division) branch ran rather than the midpoint fallback
      assert(Math.abs(ars._tangentIntersection(pi, justOutside)) > 100,
        'expected the closed-form division branch, not the midpoint fallback, just past the tolerance boundary')
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

    // The middle of the three initial quartile abscissae falls exactly at the support midpoint
    // (x = 0 for a symmetric bracket). A vanishingly small mu shifts its tangent slope away from
    // the exact dh = 0 special case (already covered by the Normal(0,1) test above) into the
    // near-degenerate regime: strictly nonzero but far below the finite-difference noise floor.
    // This exercises the code path #941 fixed, but cannot regress-test the underlying
    // catastrophic-cancellation bug itself to a tight bound: dividing by a near-zero dh in the
    // buggy general-case inversion formula can in principle distort the drawn x away from the
    // exponential shape the accept/reject step assumes, but any such distortion is bounded by
    // the same tiny dh-scale error that motivated the fix -- far below what a 2000-sample KS
    // test can resolve at any seed we could practically pin. This test's role is coverage of the
    // near-degenerate branch, not a precision bound. See https://github.com/synesenom/ran/issues/941
    ;[0, 42, 12345].forEach(seed => {
      it(`should produce samples matching a Normal target whose midpoint abscissa has a near-zero-but-nonzero slope (KS test, seed ${seed})`, () => {
        const lo = -8
        const hi = 8
        const mu = 1e-13
        const ars = new ARS(x => -0.5 * (x - mu) * (x - mu), [lo, hi], x => -(x - mu)).seed(seed)
        const samples = ars.sample(2000)
        const ref = new Normal(mu, 1)
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

describe('mc.Slice', () => {
  describe('constructor', () => {
    it('should instantiate without error for a 1D Normal target', () => {
      assert.doesNotThrow(() => new Slice(x => -0.5 * x[0] * x[0], { dim: 1 }))
    })

    it('should default w to 1.0 per dimension when omitted', () => {
      const slice = new Slice(x => -0.5 * x[0] * x[0], { dim: 1 })
      assert.deepEqual(slice.state().internal.w, [1.0])
    })

    it('should broadcast an explicit scalar w from initialState.internal to every dimension', () => {
      const slice = new Slice(x => -0.5 * (x[0] * x[0] + x[1] * x[1]), { dim: 2 }, { internal: { w: 2.5 } })
      assert.deepEqual(slice.state().internal.w, [2.5, 2.5])
    })

    it('should throw for w: 0', () => {
      assert.throws(() => new Slice(x => -0.5 * x[0] * x[0], { dim: 1 }, { internal: { w: 0 } }), /w must be a positive number/)
    })

    it('should throw for a negative w', () => {
      assert.throws(() => new Slice(x => -0.5 * x[0] * x[0], { dim: 1 }, { internal: { w: -1 } }), /w must be a positive number/)
    })

    it('should throw for a non-finite w', () => {
      assert.throws(() => new Slice(x => -0.5 * x[0] * x[0], { dim: 1 }, { internal: { w: NaN } }), /w must be a positive number/)
    })

    it('should throw for w: Infinity', () => {
      // Infinity passes a naive `typeof w === 'number' && w > 0` check but breaks _stepOut
      // (l = x0 - Infinity * U = -Infinity, r = l + Infinity = NaN), so it must be rejected here.
      assert.throws(() => new Slice(x => -0.5 * x[0] * x[0], { dim: 1 }, { internal: { w: Infinity } }), /w must be a positive number/)
    })

    it('should throw when a per-dimension w array contains a non-positive entry', () => {
      assert.throws(() => new Slice(x => -0.5 * (x[0] * x[0] + x[1] * x[1]), { dim: 2 }, { internal: { w: [1, 0] } }), /w must be a positive number/)
    })

    it('should throw when a per-dimension w array length does not match dim', () => {
      assert.throws(() => new Slice(x => -0.5 * (x[0] * x[0] + x[1] * x[1]), { dim: 2 }, { internal: { w: [1] } }), /w must be a positive number/)
    })
  })

  describe('options-object constructor form', () => {
    let originalWarn
    let warnCalls

    beforeEach(() => {
      originalWarn = console.warn
      warnCalls = []
      console.warn = (...args) => warnCalls.push(args)
    })

    afterEach(() => {
      console.warn = originalWarn
    })

    it('should behave identically to the positional form, including config defaults never explicitly passed', () => {
      // internal.w exercises the Slice-specific state channel: state().internal (compared
      // wholesale inside the helper) covers w the same way it covers RWM's proposal.
      assertConstructorFormsMatch(Slice, x => -0.5 * x[0] * x[0], { dim: 1 }, { x: [2], internal: { w: 2.5 } })
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

    it('should validate config the same way as the positional form', () => {
      assert.throws(() => new Slice({ logDensity: () => 0, config: { dim: 0 } }), /dim must be a positive integer/)
    })

    it('should validate w the same way as the positional form', () => {
      assert.throws(() => new Slice({ logDensity: () => 0, initialState: { internal: { w: 0 } } }), /w must be a positive number/)
    })

    it('should not emit a deprecation warning for the options-object form', () => {
      assert.doesNotThrow(() => new Slice({ logDensity: () => 0 }))
      assert.strictEqual(warnCalls.length, 0)
    })

    it('should emit exactly one deprecation warning per instantiation for the positional form', () => {
      assert.doesNotThrow(() => new Slice(() => 0))
      assert.strictEqual(warnCalls.length, 1)
      assert.match(warnCalls[0][0], /\[ranjs] positional MCMC constructor arguments are deprecated/)
      assert.match(warnCalls[0][0], /new Slice\({ logDensity, config, initialState }\)/)

      assert.doesNotThrow(() => new Slice(() => 0))
      assert.strictEqual(warnCalls.length, 2)
    })
  })

  describe('._iter()', () => {
    it('should update every dimension within one sweep', () => {
      // Continuous target: P(new coordinate === old coordinate) = 0, so any
      // accepted draw differing in every dimension confirms the full sweep ran,
      // not just a subset of dimensions.
      const slice = new Slice(x => -0.5 * (x[0] * x[0] + x[1] * x[1]), { dim: 2 }, { x: [0, 0] }).seed(11)
      const prev = slice.x.slice()
      const { x, accepted } = slice.iterate()
      assert.strictEqual(accepted, true)
      assert.notStrictEqual(x[0], prev[0])
      assert.notStrictEqual(x[1], prev[1])
    })
  })

  describe('.ar()', () => {
    it('should always be 1.0 regardless of the number of iterations', () => {
      const slice = new Slice(x => -0.5 * x[0] * x[0], { dim: 1 })
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
      const slice1 = new Slice(lnp, { dim: 1 }).seed(3)
      slice1.warmUp(null, 3)
      const state = slice1.state()
      const slice2 = new Slice(lnp, { dim: 1 }, state)
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
      const slice = new Slice(x => -0.5 * x[0] * x[0] / 100, { dim: 1 }).seed(13)
      slice.warmUp(null, 10)
      const w = slice.state().internal.w[0]
      assert(w > 2 && w < 200, `w = ${w}, expected to settle near the target's scale, neither stuck near the default nor diverging`)
    })
  })

  describe('.sample() distributional test', () => {
    SEEDS.forEach(seed => {
      it(`should produce samples matching Normal(0,1) target (KS test, seed ${seed})`, () => {
        const slice = new Slice(x => -0.5 * x[0] * x[0], { dim: 1 }).seed(seed)
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
        const slice = new Slice(lnp, { dim: 2 }, { x: [0, 0] }).seed(seed)
        slice.warmUp(null, 10)
        const samples = slice.sample(null, 2000)
        const ref = new Normal(0, 1)
        assert(ksTest(samples.map(s => s[0]), x => ref.cdf(x)))
        assert(ksTest(samples.map(s => s[1]), x => ref.cdf(x)))
      })
    })
  })
})

describe('mc.ParallelTempering', () => {
  const logDensity = x => -0.5 * x[0] * x[0]

  describe('constructor', () => {
    it('should throw when logDensity is not a function', () => {
      assert.throws(() => new ParallelTempering(null, { temperatures: [1, 0.5] }), /logDensity must be a function/)
    })

    it('should throw when neither temperatures nor nReplicas/tempMax are provided', () => {
      assert.throws(() => new ParallelTempering(logDensity, {}), /temperatures.*nReplicas.*tempMax|Either/)
    })

    it('should throw when temperatures is not an array', () => {
      assert.throws(() => new ParallelTempering(logDensity, { temperatures: 'nope' }), /temperatures must be an array/)
    })

    it('should throw when temperatures has fewer than two entries', () => {
      assert.throws(() => new ParallelTempering(logDensity, { temperatures: [1] }), /temperatures must be an array of at least two/)
    })

    it('should throw when temperatures does not start at 1', () => {
      assert.throws(() => new ParallelTempering(logDensity, { temperatures: [0.9, 0.5] }), /temperatures\[0\] must equal 1/)
    })

    it('should throw when temperatures is not strictly descending', () => {
      assert.throws(() => new ParallelTempering(logDensity, { temperatures: [1, 1, 0.5] }), /temperatures must be strictly descending/)
      assert.throws(() => new ParallelTempering(logDensity, { temperatures: [1, 0.5, 0.6] }), /temperatures must be strictly descending/)
    })

    it('should throw when temperatures contains a non-positive or non-finite value', () => {
      assert.throws(() => new ParallelTempering(logDensity, { temperatures: [1, 0] }), /temperatures must contain only positive finite/)
      assert.throws(() => new ParallelTempering(logDensity, { temperatures: [1, NaN] }), /temperatures must contain only positive finite/)
      assert.throws(() => new ParallelTempering(logDensity, { temperatures: [1, -Infinity] }), /temperatures must contain only positive finite/)
    })

    it('should not throw for a valid temperatures array', () => {
      assert.doesNotThrow(() => new ParallelTempering(logDensity, { temperatures: [1, 0.5, 0.25] }))
    })

    it('should throw when nReplicas is not an integer of at least two', () => {
      assert.throws(() => new ParallelTempering(logDensity, { nReplicas: 1, tempMax: 10 }), /nReplicas must be an integer/)
      assert.throws(() => new ParallelTempering(logDensity, { nReplicas: 2.5, tempMax: 10 }), /nReplicas must be an integer/)
    })

    it('should throw when nReplicas exceeds the maximum allowed', () => {
      assert.throws(() => new ParallelTempering(logDensity, { nReplicas: 10001, tempMax: 10 }), /nReplicas must be at most/)
    })

    it('should throw when tempMax is not a finite number greater than 1', () => {
      assert.throws(() => new ParallelTempering(logDensity, { nReplicas: 3, tempMax: 1 }), /tempMax must be a finite number greater than 1/)
      assert.throws(() => new ParallelTempering(logDensity, { nReplicas: 3, tempMax: Infinity }), /tempMax must be a finite number greater than 1/)
      assert.throws(() => new ParallelTempering(logDensity, { nReplicas: 3, tempMax: NaN }), /tempMax must be a finite number greater than 1/)
    })

    it('should not throw for valid nReplicas and tempMax', () => {
      assert.doesNotThrow(() => new ParallelTempering(logDensity, { nReplicas: 4, tempMax: 100 }))
    })

    it('should auto-generate a strictly descending geometric ladder from nReplicas and tempMax', () => {
      const pt = new ParallelTempering(logDensity, { nReplicas: 4, tempMax: 100 })
      // beta_i = tempMax^(-i/(nReplicas-1)) for i = 0..3 -> [1, 100^(-1/3), 100^(-2/3), 0.01].
      // Interior values checked against 10^(-2/3) and 10^(-4/3) (100^(-1/3) === 10^(-2/3) algebraically),
      // a different exponent/base decomposition than the source's Math.pow(tempMax, -i/(n-1)) call,
      // so this can't pass merely by re-deriving the same formula the implementation uses.
      assert.strictEqual(pt.temperatures.length, 4)
      assert.strictEqual(pt.temperatures[0], 1)
      // exact rational: 10^(-2/3) -> 0.2154434690031884
      assert.closeTo(pt.temperatures[1], 0.2154434690031884, 1e-12)
      // exact rational: 10^(-4/3) -> 0.046415888336127795
      assert.closeTo(pt.temperatures[2], 0.046415888336127795, 1e-12)
      assert.closeTo(pt.temperatures[3], 0.01, 1e-12)
      for (let i = 0; i < 3; i++) {
        assert.isBelow(pt.temperatures[i + 1], pt.temperatures[i])
      }
    })

    it('should expose the caller-supplied temperatures array unchanged', () => {
      const pt = new ParallelTempering(logDensity, { temperatures: [1, 0.6, 0.3] })
      assert.deepEqual(pt.temperatures, [1, 0.6, 0.3])
    })
  })

  describe('.state', () => {
    it('should not be resumable — state() is not implemented', () => {
      const pt = new ParallelTempering(logDensity, { temperatures: [1, 0.5] })
      assert.notStrictEqual(typeof pt.state, 'function')
    })
  })

  describe('swap mechanics', () => {
    it('should exchange positions and recompute each replica\'s cached scaled log-density on an accepted swap', () => {
      const pt = new ParallelTempering(logDensity, { temperatures: [1, 0.5] })
      // Positions chosen so (beta_0 - beta_1) * (lnp(x1) - lnp(x0)) = 0.5 * (0 - (-12.5)) = 6.25 >= 0
      // (the hotter replica currently holds the higher-density position), making the acceptance
      // probability exp(6.25) > 1 -- the swap is accepted for ANY draw in [0,1), so the test is
      // deterministic without needing to control the coordinator's RNG. See the _proposeSwap
      // implementation comment for why the formula uses (lnpJ - lnpI), not (lnpI - lnpJ).
      pt._replicas[0].x = [5]
      pt._replicas[1].x = [0]
      pt._proposeSwap(0)
      assert.deepEqual(pt._replicas[0].x, [0])
      assert.deepEqual(pt._replicas[1].x, [5])
      assert.strictEqual(pt._replicas[0].lastLnp, pt._replicas[0].lnp(pt._replicas[0].x))
      assert.strictEqual(pt._replicas[1].lastLnp, pt._replicas[1].lnp(pt._replicas[1].x))
      assert.strictEqual(pt._swapAttempts[0], 1)
      assert.strictEqual(pt._swapAccepts[0], 1)
    })

    it('should count an attempted-but-rejected swap without exchanging positions', () => {
      const pt = new ParallelTempering(logDensity, { temperatures: [1, 0.5] })
      // Reversed positions: (beta_0 - beta_1) * (lnp(x1) - lnp(x0)) = 0.5 * (-12.5 - 0) = -6.25,
      // acceptance probability exp(-6.25) ~= 0.00193. Stubbing r.next() to return a value
      // comfortably above that threshold makes rejection deterministic instead of depending on
      // a fixed seed happening to draw above it -- a future change to Xoshiro128p, the swap loop,
      // or the seed-derivation in seed() could otherwise flip the draw and silently stop this test
      // from exercising its own assertions.
      pt._replicas[0].x = [0]
      pt._replicas[1].x = [5]
      const before0 = pt._replicas[0].x.slice()
      const before1 = pt._replicas[1].x.slice()
      pt.r.next = () => 0.99
      pt._proposeSwap(0)
      assert.strictEqual(pt._swapAttempts[0], 1)
      assert.strictEqual(pt._swapAccepts[0], 0)
      assert.deepEqual(pt._replicas[0].x, before0)
      assert.deepEqual(pt._replicas[1].x, before1)
    })
  })

  describe('.warmUp() and .sample()', () => {
    it('should return size samples of the correct dimensionality from the cold replica', () => {
      const pt = new ParallelTempering(logDensity, { nReplicas: 3, tempMax: 10 }).seed(1)
      pt.warmUp(null, 3)
      const samples = pt.sample(null, 50)
      assert.strictEqual(samples.length, 50)
      assert(samples.every(s => s.length === 1 && Number.isFinite(s[0])))
    })

    it('should report warmUp() progress once per replica, ending at 100', () => {
      const pt = new ParallelTempering(logDensity, { nReplicas: 3, tempMax: 10 })
      const pcts = []
      pt.warmUp(p => pcts.push(p), 2)
      assert.strictEqual(pcts.length, 3)
      assert.strictEqual(pcts[pcts.length - 1], 100)
    })

    it('should report each integer percent of sample() progress once, in increasing order', () => {
      const pt = new ParallelTempering(logDensity, { nReplicas: 3, tempMax: 10 }).seed(1)
      pt.warmUp(null, 3)
      const pcts = []
      pt.sample(p => pcts.push(p), 50)
      assert(pcts.every(p => Number.isInteger(p) && p >= 0 && p < 100))
      assert.deepEqual(pcts, pcts.slice().sort((a, b) => a - b))
      assert.strictEqual(new Set(pcts).size, pcts.length)
    })
  })

  describe('.swapRate()', () => {
    it('should return one entry per adjacent pair, each in [0, 1], with at least one non-zero for a well-spaced ladder', () => {
      const pt = new ParallelTempering(logDensity, { nReplicas: 4, tempMax: 20 }).seed(2)
      pt.warmUp(null, 5)
      pt.sample(null, 500)
      const rates = pt.swapRate()
      assert.strictEqual(rates.length, 3)
      assert(rates.every(r => r >= 0 && r <= 1))
      assert(rates.some(r => r > 0), `expected at least one non-zero swap rate, got ${rates}`)
    })
  })

  describe('.seed()', () => {
    it('should produce bitwise-identical samples when the same seed is applied twice', () => {
      const pt1 = new ParallelTempering(logDensity, { nReplicas: 3, tempMax: 10 }).seed(42)
      pt1.warmUp(null, 3)
      const samples1 = pt1.sample(null, 50)

      const pt2 = new ParallelTempering(logDensity, { nReplicas: 3, tempMax: 10 }).seed(42)
      pt2.warmUp(null, 3)
      const samples2 = pt2.sample(null, 50)

      assert.deepEqual(samples1, samples2)
    })

    it('should produce different samples for different seeds', () => {
      const pt1 = new ParallelTempering(logDensity, { nReplicas: 3, tempMax: 10 }).seed(1)
      pt1.warmUp(null, 3)
      const samples1 = pt1.sample(null, 50)

      const pt2 = new ParallelTempering(logDensity, { nReplicas: 3, tempMax: 10 }).seed(2)
      pt2.warmUp(null, 3)
      const samples2 = pt2.sample(null, 50)

      assert.notDeepEqual(samples1, samples2)
    })
  })

  describe('bimodal target coverage', () => {
    // Sum of two well-separated 1D Gaussians (mu = +-10, sigma = 1): a single RWM chain at beta=1
    // cannot cross the ~50-log-density barrier between modes, but the hottest replica's flattened
    // target (beta ~ 1/tempMax) can, and swaps carry that mixing down to the cold (beta=1) chain.
    const mu = 10
    const g1 = new Normal(-mu, 1)
    const g2 = new Normal(mu, 1)
    const bimodalLogDensity = x => Math.log(
      0.5 * Math.exp(-0.5 * (x[0] + mu) * (x[0] + mu)) + 0.5 * Math.exp(-0.5 * (x[0] - mu) * (x[0] - mu))
    )
    const mixtureCdf = x => 0.5 * g1.cdf(x) + 0.5 * g2.cdf(x)

    ;[0, 42, 12345].forEach(seed => {
      it(`should visit both modes and match the true bimodal distribution (KS test, seed ${seed})`, () => {
        // nReplicas: 4 keeps the hot-to-cold swap relay short (each successful mode-crossing at the
        // hottest replica needs only 3 successful adjacent swaps to reach the cold chain); a longer
        // ladder (e.g. 6-8 replicas) was empirically slower to decorrelate the cold chain's mode
        // occupancy at a matched sample size, pushing the KS statistic above its critical value for
        // some seeds. warmUp: 15 / size: 4000 (vs. the 10/2000 used by unimodal samplers elsewhere in
        // this file) gives the swap relay enough rounds to equilibrate before and during sampling.
        const pt = new ParallelTempering(bimodalLogDensity, { nReplicas: 4, tempMax: 100 }).seed(seed)
        pt.warmUp(null, 15)
        const samples = pt.sample(null, 4000)
        const values = samples.map(s => s[0])
        assert(values.some(v => v < 0), 'expected some samples in the negative mode')
        assert(values.some(v => v > 0), 'expected some samples in the positive mode')
        assert(ksTest(values, mixtureCdf))
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
