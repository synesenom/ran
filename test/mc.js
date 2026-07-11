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
  constructor (sequence) {
    super(() => 0, { dim: 1 }, { x: [0] })
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
})
