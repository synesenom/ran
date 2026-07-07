import { assert } from 'chai'
import { describe, it } from 'mocha'
import Process from '../src/process/_process'
import BrownianMotion from '../src/process/brownian-motion'
import OrnsteinUhlenbeck from '../src/process/ornstein-uhlenbeck'
import PoissonProcess from '../src/process/poisson-process'
import { Normal, Poisson } from '../src/dist'
import { ksTest, chiTest } from './test-utils'

describe('process._Process', () => {
  describe('.validate()', () => {
    it('should throw on undefined parameter', () => {
      assert.throws(() => Process.validate({ x: undefined }, []), /Required parameters missing/)
    })

    it('should throw on null parameter', () => {
      assert.throws(() => Process.validate({ x: null }, []), /Required parameters missing/)
    })

    it('should throw on NaN parameter', () => {
      assert.throws(() => Process.validate({ x: NaN }, []), /Required parameters missing/)
    })

    it('should throw when constraint is violated (<)', () => {
      assert.throws(() => Process.validate({ x: 5 }, ['x < 3']), /Parameters must satisfy/)
    })

    it('should throw when constraint is violated (<=)', () => {
      assert.throws(() => Process.validate({ x: 5 }, ['x <= 3']), /Parameters must satisfy/)
    })

    it('should throw when constraint is violated (>)', () => {
      assert.throws(() => Process.validate({ x: 1 }, ['x > 3']), /Parameters must satisfy/)
    })

    it('should throw when constraint is violated (>=)', () => {
      assert.throws(() => Process.validate({ x: 1 }, ['x >= 3']), /Parameters must satisfy/)
    })

    it('should throw when constraint is violated (!=)', () => {
      assert.throws(() => Process.validate({ x: 3 }, ['x != 3']), /Parameters must satisfy/)
    })

    it('should not throw when all params are valid and constraints pass', () => {
      assert.doesNotThrow(() => Process.validate({ mu: 0, sigma: 1 }, ['sigma > 0']))
    })

    it('should support literal on left side of constraint', () => {
      assert.doesNotThrow(() => Process.validate({ x: 5 }, ['0 < x']))
      assert.throws(() => Process.validate({ x: 5 }, ['10 < x']), /Parameters must satisfy/)
    })
  })
})

class RngProcess extends Process {
  constructor () {
    super()
    this.x = 0
    this.x0 = 0
  }

  _next () {
    return this.r.next()
  }
}

class StubProcess extends Process {
  constructor () {
    super()
    this.x = 0
    this.x0 = 0
  }

  _next () {
    return this.x + 1
  }
}

class BareProcess extends Process {
  constructor () {
    super()
    this.x = 0
    this.x0 = 0
  }
}

describe('process', () => {
  describe('Process', () => {
    describe('._next()', () => {
      it('should throw when not implemented', () => {
        const p = new BareProcess()
        assert.throws(() => p.next(), 'Process._next() is not implemented')
      })
    })

    describe('.next()', () => {
      it('should advance state and return the new value', () => {
        const p = new StubProcess()
        const s = p.next()
        assert.strictEqual(s, 1)
        assert.strictEqual(p.state(), 1)
      })
    })

    describe('.path()', () => {
      it('should return n+1 states starting from initial state', () => {
        const p = new StubProcess()
        assert.deepEqual(p.path(5), [0, 1, 2, 3, 4, 5])
      })

      it('should return 1 state for n=0', () => {
        const p = new StubProcess()
        const path = p.path(0)
        assert.strictEqual(path.length, 1)
        assert.strictEqual(path[0], 0)
      })

      it('should not mutate the current state', () => {
        const p = new StubProcess()
        p.next()
        p.path(5)
        assert.strictEqual(p.state(), 1)
      })

      it('should not advance the PRNG stream', () => {
        const p1 = new RngProcess()
        p1.seed(42)
        p1.path(20)
        const a1 = p1.next()
        const a2 = p1.next()
        const p2 = new RngProcess()
        p2.seed(42)
        const b1 = p2.next()
        const b2 = p2.next()
        assert.strictEqual(a1, b1)
        assert.strictEqual(a2, b2)
      })
    })

    describe('.reset()', () => {
      it('should restore the initial state', () => {
        const p = new StubProcess()
        p.next()
        p.next()
        p.reset()
        assert.strictEqual(p.state(), 0)
      })
    })

    describe('.state()', () => {
      it('should return the current state', () => {
        const p = new StubProcess()
        p.next()
        assert.strictEqual(p.state(), 1)
      })
    })

    describe('.seed()', () => {
      it('should produce identical paths when seeded identically', () => {
        const p = new RngProcess()
        p.seed(42)
        const path1 = p.path(20)
        // Advance the PRNG past its post-seed state so that only a working
        // seed() can restore it; without this, path()'s save/restore would
        // make the test pass even if seed() were a no-op.
        p.next()
        p.next()
        p.next()
        p.seed(42)
        const path2 = p.path(20)
        assert.deepEqual(path1, path2)
      })

      it('should produce different paths for different seeds', () => {
        const p = new RngProcess()
        p.seed(1)
        const path1 = p.path(20)
        p.reset()
        p.seed(2)
        const path2 = p.path(20)
        assert.notDeepEqual(path1, path2)
      })

      it('should return this for chaining', () => {
        const p = new RngProcess()
        assert.strictEqual(p.seed(0), p)
      })
    })
  })
})

describe('process.BrownianMotion', () => {
  describe('constructor', () => {
    it('should throw on sigma = 0', () => {
      assert.throws(() => new BrownianMotion(0, 0, 1), /Invalid parameters/)
    })

    it('should throw on sigma < 0', () => {
      assert.throws(() => new BrownianMotion(0, -1, 1), /Invalid parameters/)
    })

    it('should throw on dt = 0', () => {
      assert.throws(() => new BrownianMotion(0, 1, 0), /Invalid parameters/)
    })

    it('should throw on dt < 0', () => {
      assert.throws(() => new BrownianMotion(0, 1, -0.5), /Invalid parameters/)
    })

    it('should throw on mu = NaN', () => {
      assert.throws(() => new BrownianMotion(NaN, 1, 1), /Invalid parameters/)
    })

    it('should accept valid parameters', () => {
      assert.doesNotThrow(() => new BrownianMotion(0, 1, 1))
      assert.doesNotThrow(() => new BrownianMotion(-2, 0.5, 0.01))
    })

    it('should start at state 0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert.strictEqual(bm.state(), 0)
    })
  })

  describe('.mean()', () => {
    it('should return mu*t for zero initial state', () => {
      const bm = new BrownianMotion(0.5, 1, 1)
      assert.closeTo(bm.mean(2), 1.0, 1e-10)
    })

    it('should return 0 for zero drift at any t', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert.strictEqual(bm.mean(3), 0)
      assert.strictEqual(bm.mean(100), 0)
    })

    it('should return 0 at t=0', () => {
      const bm = new BrownianMotion(1, 1, 1)
      assert.strictEqual(bm.mean(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert(Number.isNaN(bm.mean(-1)))
    })
  })

  describe('.variance()', () => {
    it('should return sigma^2 * t', () => {
      const bm = new BrownianMotion(0, 2, 1)
      assert.closeTo(bm.variance(3), 12, 1e-10)
    })

    it('should return 0 at t=0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert.strictEqual(bm.variance(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert(Number.isNaN(bm.variance(-1)))
    })
  })

  describe('.path()', () => {
    it('should have length n+1', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert.strictEqual(bm.path(10).length, 11)
    })

    it('first element should be initial state 0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert.strictEqual(bm.path(5)[0], 0)
    })
  })

  describe('.reset()', () => {
    it('should restore initial state to 0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      for (let i = 0; i < 10; i++) bm.next()
      bm.reset()
      assert.strictEqual(bm.state(), 0)
    })
  })

  describe('increments', () => {
    it('should be normally distributed (KS test)', () => {
      const mu = 0.1
      const sigma = 1.5
      const dt = 0.5
      const bm = new BrownianMotion(mu, sigma, dt)
      const n = 1000
      const increments = []
      for (let i = 0; i < n; i++) {
        const prev = bm.state()
        bm.next()
        increments.push(bm.state() - prev)
      }
      const ref = new Normal(mu * dt, sigma * Math.sqrt(dt))
      assert(ksTest(increments, x => ref.cdf(x)))
    })
  })
})

describe('process.OrnsteinUhlenbeck', () => {
  describe('constructor', () => {
    it('should throw on theta = 0', () => {
      assert.throws(() => new OrnsteinUhlenbeck(0, 0, 1, 1), /Invalid parameters/)
    })

    it('should throw on theta < 0', () => {
      assert.throws(() => new OrnsteinUhlenbeck(-1, 0, 1, 1), /Invalid parameters/)
    })

    it('should throw on sigma = 0', () => {
      assert.throws(() => new OrnsteinUhlenbeck(1, 0, 0, 1), /Invalid parameters/)
    })

    it('should throw on sigma < 0', () => {
      assert.throws(() => new OrnsteinUhlenbeck(1, 0, -1, 1), /Invalid parameters/)
    })

    it('should throw on dt = 0', () => {
      assert.throws(() => new OrnsteinUhlenbeck(1, 0, 1, 0), /Invalid parameters/)
    })

    it('should throw on dt < 0', () => {
      assert.throws(() => new OrnsteinUhlenbeck(1, 0, 1, -0.5), /Invalid parameters/)
    })

    it('should throw on mu = NaN', () => {
      assert.throws(() => new OrnsteinUhlenbeck(1, NaN, 1, 1), /Invalid parameters/)
    })

    it('should accept valid parameters', () => {
      assert.doesNotThrow(() => new OrnsteinUhlenbeck(2, 1, 0.5, 0.1))
    })

    it('should start at state 0', () => {
      const ou = new OrnsteinUhlenbeck(1, 2, 0.5, 0.1)
      assert.strictEqual(ou.state(), 0)
    })
  })

  describe('.mean()', () => {
    it('should return mu*(1 - exp(-theta*t)) for zero initial state', () => {
      const ou = new OrnsteinUhlenbeck(2, 3, 1, 0.1)
      assert.closeTo(ou.mean(1), 3 * (1 - Math.exp(-2)), 1e-10)
    })

    it('should return 0 at t=0', () => {
      const ou = new OrnsteinUhlenbeck(1, 5, 1, 0.1)
      assert.strictEqual(ou.mean(0), 0)
    })

    it('should approach mu as t -> infinity', () => {
      const ou = new OrnsteinUhlenbeck(1, 4, 1, 0.1)
      assert.closeTo(ou.mean(1000), 4, 1e-6)
    })

    it('should return NaN for t < 0', () => {
      const ou = new OrnsteinUhlenbeck(1, 0, 1, 1)
      assert(isNaN(ou.mean(-1)))
    })

    it('should be stable after advancing the simulation', () => {
      const ou = new OrnsteinUhlenbeck(2, 3, 1, 0.1)
      const before = ou.mean(1)
      for (let i = 0; i < 20; i++) ou.next()
      assert.closeTo(ou.mean(1), before, 1e-10)
    })
  })

  describe('.variance()', () => {
    it('should return sigma^2*(1-exp(-2*theta*t))/(2*theta)', () => {
      const theta = 2; const sigma = 0.5; const t = 1
      const ou = new OrnsteinUhlenbeck(theta, 0, sigma, 0.1)
      const expected = sigma * sigma * (1 - Math.exp(-2 * theta * t)) / (2 * theta)
      assert.closeTo(ou.variance(t), expected, 1e-10)
    })

    it('should return 0 at t=0', () => {
      const ou = new OrnsteinUhlenbeck(1, 0, 1, 1)
      assert.strictEqual(ou.variance(0), 0)
    })

    it('should approach stationary variance sigma^2/(2*theta) as t -> infinity', () => {
      const theta = 2; const sigma = 0.5
      const ou = new OrnsteinUhlenbeck(theta, 0, sigma, 0.1)
      assert.closeTo(ou.variance(1000), sigma * sigma / (2 * theta), 1e-6)
    })

    it('should return NaN for t < 0', () => {
      const ou = new OrnsteinUhlenbeck(1, 0, 1, 1)
      assert(isNaN(ou.variance(-1)))
    })
  })

  describe('.reset()', () => {
    it('should restore initial state to 0', () => {
      const ou = new OrnsteinUhlenbeck(1, 2, 0.5, 0.1)
      for (let i = 0; i < 10; i++) ou.next()
      ou.reset()
      assert.strictEqual(ou.state(), 0)
    })
  })

  describe('stationarity', () => {
    it('should converge to stationary distribution (KS test)', () => {
      const theta = 2; const mu = 3; const sigma = 1; const dt = 0.1
      const ou = new OrnsteinUhlenbeck(theta, mu, sigma, dt)
      for (let i = 0; i < 500; i++) ou.next()
      const samples = []
      for (let i = 0; i < 1000; i++) {
        ou.next()
        samples.push(ou.state())
      }
      const stationaryStd = sigma / Math.sqrt(2 * theta)
      const ref = new Normal(mu, stationaryStd)
      assert(ksTest(samples, x => ref.cdf(x)))
    })
  })
})

describe('process.PoissonProcess', () => {
  describe('constructor', () => {
    it('should throw on lambda = 0', () => {
      assert.throws(() => new PoissonProcess(0, 1), /Invalid parameters/)
    })

    it('should throw on lambda < 0', () => {
      assert.throws(() => new PoissonProcess(-1, 1), /Invalid parameters/)
    })

    it('should throw on dt = 0', () => {
      assert.throws(() => new PoissonProcess(1, 0), /Invalid parameters/)
    })

    it('should throw on dt < 0', () => {
      assert.throws(() => new PoissonProcess(1, -0.5), /Invalid parameters/)
    })

    it('should throw on lambda = NaN', () => {
      assert.throws(() => new PoissonProcess(NaN, 1), /Invalid parameters/)
    })

    it('should accept valid parameters', () => {
      assert.doesNotThrow(() => new PoissonProcess(2, 0.5))
    })

    it('should accept default parameters', () => {
      assert.doesNotThrow(() => new PoissonProcess())
    })

    it('should start at state 0', () => {
      const pp = new PoissonProcess(1, 1)
      assert.strictEqual(pp.state(), 0)
    })
  })

  describe('path', () => {
    it('should be non-decreasing', () => {
      const pp = new PoissonProcess(2, 0.1)
      const path = pp.path(200)
      for (let i = 1; i < path.length; i++) {
        assert(path[i] >= path[i - 1])
      }
    })

    it('should be integer-valued', () => {
      const pp = new PoissonProcess(2, 0.1)
      const path = pp.path(200)
      for (const x of path) {
        assert.strictEqual(x, Math.floor(x))
      }
    })
  })

  describe('increments', () => {
    it('should follow Poisson(lambda*dt) distribution (chi-squared test)', () => {
      const lambda = 3
      const dt = 0.5
      const pp = new PoissonProcess(lambda, dt)
      const n = 2000
      const increments = []
      for (let i = 0; i < n; i++) {
        const prev = pp.state()
        pp.next()
        increments.push(pp.state() - prev)
      }
      const ref = new Poisson(lambda * dt)
      assert(chiTest(increments, k => ref.pdf(k), 0))
    })
  })
})
