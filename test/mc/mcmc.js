import { assert } from 'chai'
import { describe, it } from 'mocha'
import MCMC from '../../src/mc/_mcmc'
import RWM from '../../src/mc/rwm'
import { Normal } from '../../src/dist'
import { ess } from '../test-utils'

// Concrete subclass that replays a pre-built sequence, enabling deterministic
// accumulator testing without involving the PRNG.
class TestMCMC extends MCMC {
  constructor (sequence, config = {}, initialState = { x: [0] }) {
    super(() => 0, { dim: 1, ...config }, initialState)
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

// Direct unit tests for the ess() test-utils helper, which reduces a sampler's per-dimension
// ess() (ran.mc.MCMC#ess) to a single scalar via Math.min -- the ESS truncation arithmetic
// itself is covered directly against MCMC#ess() in the 'mc.MCMC .ess()' block below; these
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
      assert.throws(() => new RWM({ logDensity: () => 0, config: { dim: 0 } }), /dim must be a positive integer/)
    })

    it('should throw for a negative dim', () => {
      assert.throws(() => new RWM({ logDensity: () => 0, config: { dim: -2 } }), /dim must be a positive integer/)
    })

    it('should throw for a non-integer dim', () => {
      assert.throws(() => new RWM({ logDensity: () => 0, config: { dim: 1.5 } }), /dim must be a positive integer/)
    })

    it('should throw for a dim above the maximum allowed', () => {
      assert.throws(() => new RWM({ logDensity: () => 0, config: { dim: 1e9 } }), /dim must be at most/)
      assert.throws(() => new RWM({ logDensity: () => 0, config: { dim: 10001 } }), /dim must be at most/)
    })

    it('should not throw for a dim at the maximum allowed', () => {
      assert.doesNotThrow(() => new RWM({ logDensity: () => 0, config: { dim: 10000 } }))
    })

    it('should throw for maxLag: 0', () => {
      assert.throws(() => new RWM({ logDensity: () => 0, config: { maxLag: 0 } }), /maxLag must be a positive integer/)
    })

    it('should throw for a negative maxLag', () => {
      assert.throws(() => new RWM({ logDensity: () => 0, config: { maxLag: -2 } }), /maxLag must be a positive integer/)
    })

    it('should throw for a non-integer maxLag', () => {
      assert.throws(() => new RWM({ logDensity: () => 0, config: { maxLag: 1.5 } }), /maxLag must be a positive integer/)
    })

    it('should throw for a maxLag above the maximum allowed', () => {
      assert.throws(() => new RWM({ logDensity: () => 0, config: { maxLag: 1e9 } }), /maxLag must be at most/)
      assert.throws(() => new RWM({ logDensity: () => 0, config: { maxLag: 10001 } }), /maxLag must be at most/)
    })

    it('should not throw for a maxLag at the maximum allowed', () => {
      assert.doesNotThrow(() => new RWM({ logDensity: () => 0, config: { maxLag: 10000 } }))
    })

    it('should throw when dim and maxLag are each individually valid but their product exceeds the combined bound', () => {
      assert.throws(() => new RWM({ logDensity: () => 0, config: { dim: 10000, maxLag: 10000 } }), /dim \* maxLag must be at most/)
    })

    it('should not throw when dim*maxLag is exactly at the combined bound', () => {
      assert.doesNotThrow(() => new RWM({ logDensity: () => 0, config: { dim: 10000, maxLag: 625 } }))
    })

    it('should throw when dim*maxLag is just above the combined bound', () => {
      assert.throws(() => new RWM({ logDensity: () => 0, config: { dim: 10000, maxLag: 626 } }), /dim \* maxLag must be at most/)
    })

    it('should default to maxLag: 100 when omitted', () => {
      const rwm = new RWM({ logDensity: x => -0.5 * x[0] * x[0] })
      assert.strictEqual(rwm.maxLag, 100)
    })

    it('should default to dim: 1 when omitted', () => {
      const rwm = new RWM({ logDensity: x => -0.5 * x[0] * x[0] })
      assert.strictEqual(rwm.dim, 1)
      assert.strictEqual(rwm.sample(null, 1)[0].length, 1)
    })

    it('should not throw for a valid multi-dimensional dim', () => {
      const rwm = new RWM({ logDensity: x => -0.5 * (x[0] * x[0] + x[1] * x[1] + x[2] * x[2]), config: { dim: 3 } })
      assert.strictEqual(rwm.dim, 3)
      assert.strictEqual(rwm.sample(null, 1)[0].length, 3)
    })

    it('should throw for arWindow: 0', () => {
      assert.throws(() => new RWM({ logDensity: () => 0, config: { arWindow: 0 } }), /arWindow must be a positive integer/)
    })

    it('should throw for a negative arWindow', () => {
      assert.throws(() => new RWM({ logDensity: () => 0, config: { arWindow: -2 } }), /arWindow must be a positive integer/)
    })

    it('should throw for a non-integer arWindow', () => {
      assert.throws(() => new RWM({ logDensity: () => 0, config: { arWindow: 2.5 } }), /arWindow must be a positive integer/)
    })

    it('should throw for an arWindow above the maximum allowed', () => {
      assert.throws(() => new RWM({ logDensity: () => 0, config: { arWindow: 1e9 } }), /arWindow must be at most/)
      assert.throws(() => new RWM({ logDensity: () => 0, config: { arWindow: 10001 } }), /arWindow must be at most/)
    })

    it('should not throw for an arWindow at the maximum allowed', () => {
      assert.doesNotThrow(() => new RWM({ logDensity: () => 0, config: { arWindow: 10000 } }))
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
      // exact rational: rho[0] = 1, rho[1] = 0.5, rho[2] = -1/6, rho[3] = -1, rho[4] = -2.
      // Geyer's IPSM pairs lags starting at lag 0: Gamma_0 = rho[0]+rho[1] = 1.5 (> 0, kept,
      // prevGamma = 1.5); Gamma_1 = rho[2]+rho[3] = -7/6, clamped to min(-7/6, 1.5) = -7/6
      // (<= 0, stops the sum), so ess = n / (-1 + 2*Gamma_0) = 5 / (-1 + 3) = 5 / 2 = 2.5
      assert.closeTo(essVal[0], 2.5, 1e-12)
    })

    it('should compute an independent ess() per dimension for a known 2D sequence', () => {
      // dim 0 replays the [1,2,3,4,5] case above (ess = 2.5); dim 1 alternates sign, giving
      // rho[1] ~= -1.0833 (< -1, this codebase's biased finite-sample ac() estimator is not
      // bounded to [-1,1] -- decisions/0023-mcmc-accumulator-mechanics.md), so
      // Gamma_0 = rho[0]+rho[1] ~= -0.0833 (<= 0, immediate truncation) and thus ess = n = 5
      // exactly -- even anchoring the pair at the always-1 rho[0] can't save an ess = n
      // saturation when the anti-correlation is this extreme.
      const seq = [[1, 1], [2, -1], [3, 1], [4, -1], [5, 1]].map(x => ({ x, accepted: true }))
      const mc = new TestMCMC(seq, { dim: 2 })
      for (let i = 0; i < 5; i++) mc.iterate()
      const essVal = mc.ess()
      assert.strictEqual(essVal.length, 2)
      assert.closeTo(essVal[0], 2.5, 1e-12)
      assert.closeTo(essVal[1], 5, 1e-12)
    })

    it('should not truncate prematurely on a single noisy negative lag-1 in an otherwise well-mixing chain', () => {
      // exact rational (sequence [4, 0, 4, 3, 0, 0], n=6): rho[0] = 1, rho[1] = -173/625,
      // rho[2] = 23/125, rho[3] = 23/125, rho[4] = -121/125, rho[5] = -121/125. The single-lag
      // rule sees rho[1] < 0 and stops immediately, reporting ess = n = 6 -- as if the chain
      // were perfectly independent, despite rho[2] and rho[3] showing real positive dependence
      // right after. Geyer's IPSM anchors the first pair at rho[0] = 1, so
      // Gamma_0 = rho[0]+rho[1] = 452/625 (> 0, kept -- a single mildly negative rho[1] can
      // never flip this pair negative on its own); Gamma_1 = rho[2]+rho[3] = 230/625, clamped
      // to min(230/625, 452/625) = 230/625 (> 0, also kept); Gamma_2 = rho[4]+rho[5] =
      // -1210/625, clamped to min(-1210/625, 230/625) = -1210/625 (<= 0, stops the sum), giving
      // tau = -1 + 2*(452/625 + 230/625) = 739/625 and ess = 6 / (739/625) = 3750/739 ~= 5.0744
      // -- materially lower than the old rule's inflated ess = 6, confirming the noisy lag-1 no
      // longer causes premature truncation to the maximum possible value.
      const mc = new TestMCMC([4, 0, 4, 3, 0, 0].map(v => ({ x: [v], accepted: true })))
      for (let i = 0; i < 6; i++) mc.iterate()
      const essVal = mc.ess()
      assert.closeTo(essVal[0], 3750 / 739, 1e-12)
      assert(essVal[0] < 6, `ess (${essVal[0]}) should be below the old rule's inflated n=6`)
    })

    it('should return 1, not the total iteration count, for a fully stuck (zero-variance) chain', () => {
      // A chain that never moves has population variance 0, so ac()'s lag-1 entry is 0/0 =
      // NaN -- distinct from the n === 0 "no observations yet" case above, which must still
      // return 0. A stuck chain produced zero effectively-independent samples, so ess() must
      // not report ess === n (the old bug: NaN broke the loop immediately, giving ess = n/1 = n).
      const mc = new TestMCMC(Array.from({ length: 10 }, () => ({ x: [5], accepted: true })))
      for (let i = 0; i < 10; i++) mc.iterate()
      const essVal = mc.ess()
      assert.strictEqual(essVal[0], 1)
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

  describe('.state() prng round-trip', () => {
    it('should include a 4-element prng array', () => {
      const mc = new TestMCMC([])
      mc.r.next()
      const state = mc.state()
      assert(Array.isArray(state.prng))
      assert.strictEqual(state.prng.length, 4)
    })

    it('should resume the exact PRNG stream position via initialState.prng', () => {
      const mc1 = new TestMCMC([])
      for (let i = 0; i < 25; i++) mc1.r.next()
      const state = mc1.state()
      const expected = Array.from({ length: 10 }, () => mc1.r.next())

      const mc2 = new TestMCMC([], {}, { x: [0], prng: state.prng })
      const actual = Array.from({ length: 10 }, () => mc2.r.next())
      assert.deepEqual(actual, expected)
    })

    it('should leave the PRNG fresh-seeded when initialState.prng is omitted', () => {
      // No prng key at all — the pre-#1033 shape — must still construct a valid,
      // fresh-seeded instance rather than throwing.
      assert.doesNotThrow(() => new TestMCMC([], {}, { x: [0] }))
    })

    it('should throw for a malformed prng state', () => {
      assert.throws(
        () => new TestMCMC([], {}, { x: [0], prng: [1, 2, 3] }),
        /prng state must be an array of 4 finite numbers/
      )
    })

    it('should throw for a non-array prng state', () => {
      assert.throws(
        () => new TestMCMC([], {}, { x: [0], prng: 'not-an-array' }),
        /prng state must be an array of 4 finite numbers/
      )
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
