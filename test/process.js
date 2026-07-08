import { assert } from 'chai'
import { describe, it } from 'mocha'
import Process from '../src/process/_process'
import AR1 from '../src/process/ar1'
import BrownianBridge from '../src/process/brownian-bridge'
import BrownianMotion from '../src/process/brownian-motion'
import CoxIngersollRoss from '../src/process/cox-ingersoll-ross'
import GeometricBrownianMotion from '../src/process/geometric-brownian-motion'
import OrnsteinUhlenbeck from '../src/process/ornstein-uhlenbeck'
import CompoundPoissonProcess from '../src/process/compound-poisson-process'
import PoissonProcess from '../src/process/poisson-process'
import RandomWalk from '../src/process/random-walk'
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

    describe('.covariogram()', () => {
      it('should throw when not implemented', () => {
        const p = new BareProcess()
        assert.throws(() => p.covariogram(1, 2), 'Process.covariogram() is not implemented')
      })
    })

    describe('.mean()', () => {
      it('should throw when not implemented', () => {
        const p = new BareProcess()
        assert.throws(() => p.mean(1), 'Process.mean() is not implemented')
      })
    })

    describe('.variance()', () => {
      it('should throw when not implemented', () => {
        const p = new BareProcess()
        assert.throws(() => p.variance(1), 'Process.variance() is not implemented')
      })
    })

    describe('.pdf()', () => {
      it('should throw when not implemented', () => {
        const p = new BareProcess()
        assert.throws(() => p.pdf(0, 1), 'Process.pdf() is not implemented')
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

      it('should advance the PRNG stream', () => {
        const p1 = new RngProcess()
        p1.seed(42)
        p1.path(20)
        const a1 = p1.next()
        const p2 = new RngProcess()
        p2.seed(42)
        const b1 = p2.next()
        assert.notStrictEqual(a1, b1)
      })

      it('should return independent paths on consecutive calls', () => {
        const p = new RngProcess()
        p.seed(42)
        const path1 = p.path(20)
        const path2 = p.path(20)
        assert.notDeepEqual(path1, path2)
      })
    })

    describe('.ensemble()', () => {
      it('should return m paths', () => {
        const p = new RngProcess()
        p.seed(42)
        assert.strictEqual(p.ensemble(5, 10).length, 5)
      })

      it('should return paths of length n+1', () => {
        const p = new RngProcess()
        p.seed(42)
        const e = p.ensemble(3, 7)
        for (const path of e) {
          assert.strictEqual(path.length, 8)
        }
      })

      it('should return independent paths', () => {
        const p = new RngProcess()
        p.seed(42)
        const e = p.ensemble(3, 20)
        assert.notDeepEqual(e[0], e[1])
        assert.notDeepEqual(e[1], e[2])
      })

      it('should throw for m < 1', () => {
        const p = new RngProcess()
        assert.throws(() => p.ensemble(0, 5), /Parameters must satisfy/)
      })

      it('should throw for n < 1', () => {
        const p = new RngProcess()
        assert.throws(() => p.ensemble(3, 0), /Parameters must satisfy/)
      })

      it('should throw for NaN m', () => {
        const p = new RngProcess()
        assert.throws(() => p.ensemble(NaN, 5), /Required parameters missing/)
      })

      it('should throw for NaN n', () => {
        const p = new RngProcess()
        assert.throws(() => p.ensemble(3, NaN), /Required parameters missing/)
      })

      it('should produce different ensembles on consecutive calls', () => {
        const p = new RngProcess()
        p.seed(42)
        const e1 = p.ensemble(2, 10)
        const e2 = p.ensemble(2, 10)
        assert.notDeepEqual(e1, e2)
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
      // exact rational: mu*t = 0.5*2 = 1
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
      // exact rational: sigma^2*t = 2^2*3 = 12
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

  describe('.pdf()', () => {
    it('should return NaN for t = 0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert(Number.isNaN(bm.pdf(0, 0)))
    })

    it('should return NaN for t < 0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert(Number.isNaN(bm.pdf(0, -1)))
    })

    it('should return Normal(0,1) density at x=0, t=1 for mu=0, sigma=1', () => {
      const bm = new BrownianMotion(0, 1, 1)
      // scipy: stats.norm.pdf(0, loc=0, scale=1) = 0.3989422804014327
      assert.closeTo(bm.pdf(0, 1), 0.3989422804014327, 1e-10)
    })

    it('should return Normal(mu*t, sigma^2*t) density for general parameters', () => {
      const bm = new BrownianMotion(0.5, 2, 1)
      // scipy: stats.norm.pdf(1, loc=0.5*2, scale=sqrt(4*2)) = 0.1410473958869391
      assert.closeTo(bm.pdf(1, 2), 0.1410473958869391, 1e-10)
    })

    it('should match Normal distribution with correct parameters', () => {
      const bm = new BrownianMotion(-0.2, 1.5, 1)
      // scipy: stats.norm.pdf(0, loc=-0.2*3, scale=sqrt(1.5^2*3)) = 0.1495123243667221
      assert.closeTo(bm.pdf(0, 3), 0.1495123243667221, 1e-10)
    })
  })

  describe('.covariogram()', () => {
    it('should return sigma^2 * min(s, t)', () => {
      const bm = new BrownianMotion(0, 2, 1)
      assert.closeTo(bm.covariogram(2, 3), 4 * 2, 1e-10)
    })

    it('should be symmetric', () => {
      const bm = new BrownianMotion(0, 2, 1)
      assert.closeTo(bm.covariogram(1, 4), bm.covariogram(4, 1), 1e-10)
    })

    it('should equal variance at s = t', () => {
      const bm = new BrownianMotion(0, 2, 1)
      assert.closeTo(bm.covariogram(3, 3), bm.variance(3), 1e-10)
    })

    it('should return NaN for s < 0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert(Number.isNaN(bm.covariogram(-1, 2)))
    })

    it('should return NaN for t < 0', () => {
      const bm = new BrownianMotion(0, 1, 1)
      assert(Number.isNaN(bm.covariogram(2, -1)))
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

describe('process.GeometricBrownianMotion', () => {
  describe('constructor', () => {
    it('should throw on sigma = 0', () => {
      assert.throws(() => new GeometricBrownianMotion(0, 0, 1), /Invalid parameters/)
    })

    it('should throw on sigma < 0', () => {
      assert.throws(() => new GeometricBrownianMotion(0, -1, 1), /Invalid parameters/)
    })

    it('should throw on dt = 0', () => {
      assert.throws(() => new GeometricBrownianMotion(0, 1, 0), /Invalid parameters/)
    })

    it('should throw on dt < 0', () => {
      assert.throws(() => new GeometricBrownianMotion(0, 1, -0.5), /Invalid parameters/)
    })

    it('should throw on mu = NaN', () => {
      assert.throws(() => new GeometricBrownianMotion(NaN, 1, 1), /Invalid parameters/)
    })

    it('should accept valid parameters', () => {
      assert.doesNotThrow(() => new GeometricBrownianMotion(0, 1, 1))
      assert.doesNotThrow(() => new GeometricBrownianMotion(0.05, 0.2, 0.01))
    })

    it('should use all defaults when called with no arguments', () => {
      const gbm = new GeometricBrownianMotion()
      assert.strictEqual(gbm.state(), 1)
    })

    it('should start at state 1', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert.strictEqual(gbm.state(), 1)
    })
  })

  describe('.path()', () => {
    it('should have length n+1', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert.strictEqual(gbm.path(10).length, 11)
    })

    it('first element should be 1', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert.strictEqual(gbm.path(5)[0], 1)
    })

    it('all path values should remain positive', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      gbm.seed(42)
      const path = gbm.path(500)
      assert(path.every(v => v > 0))
    })
  })

  describe('.reset()', () => {
    it('should restore initial state to 1', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      for (let i = 0; i < 10; i++) gbm.next()
      gbm.reset()
      assert.strictEqual(gbm.state(), 1)
    })
  })

  describe('.mean()', () => {
    it('should return 1 at t=0', () => {
      const gbm = new GeometricBrownianMotion(0.1, 0.2, 1)
      assert.strictEqual(gbm.mean(0), 1)
    })

    it('should return exp(mu*t)', () => {
      const gbm = new GeometricBrownianMotion(0.1, 0.2, 1)
      // mpmath mp.dps=50: exp(0.1*3) = exp(0.3) → 1.3498588075760032
      assert.closeTo(gbm.mean(3), 1.3498588075760032, 1e-10)
    })

    it('should return NaN for t < 0', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert(Number.isNaN(gbm.mean(-1)))
    })

    it('should be stable after advancing the simulation', () => {
      const gbm = new GeometricBrownianMotion(0.05, 0.2, 1)
      const before = gbm.mean(2)
      for (let i = 0; i < 20; i++) gbm.next()
      assert.closeTo(gbm.mean(2), before, 1e-10)
    })
  })

  describe('.variance()', () => {
    it('should return 0 at t=0', () => {
      const gbm = new GeometricBrownianMotion(0.1, 0.2, 1)
      assert.strictEqual(gbm.variance(0), 0)
    })

    it('should return exp(2*mu*t)*(exp(sigma^2*t)-1)', () => {
      const gbm = new GeometricBrownianMotion(0.05, 0.3, 1)
      // mpmath mp.dps=50: exp(0.1)*(exp(0.09)-1) → 0.10407867958160391
      assert.closeTo(gbm.variance(1), 0.10407867958160391, 1e-10)
    })

    it('should return NaN for t < 0', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert(Number.isNaN(gbm.variance(-1)))
    })
  })

  describe('.pdf()', () => {
    it('should return NaN for t = 0', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert(Number.isNaN(gbm.pdf(1, 0)))
    })

    it('should return NaN for t < 0', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert(Number.isNaN(gbm.pdf(1, -1)))
    })

    it('should return 0 for x = 0 (outside log-normal support)', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert.strictEqual(gbm.pdf(0, 1), 0)
    })

    it('should return 0 for x < 0 (outside log-normal support)', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert.strictEqual(gbm.pdf(-1, 1), 0)
    })

    it('should return log-normal density for mu=0.1, sigma=0.3, t=1, x=1', () => {
      const gbm = new GeometricBrownianMotion(0.1, 0.3, 1)
      // scipy: stats.lognorm.pdf(1, s=0.3*sqrt(1), scale=exp(log(1)+(0.1-0.09/2)*1)) = 1.3076461848524421
      assert.closeTo(gbm.pdf(1.0, 1), 1.3076461848524421, 1e-10)
    })

    it('should return log-normal density for mu=0.05, sigma=0.2, t=2, x=1.5', () => {
      const gbm = new GeometricBrownianMotion(0.05, 0.2, 1)
      // scipy: stats.lognorm.pdf(1.5, s=0.2*sqrt(2), scale=exp((0.05-0.02)*2)) = 0.4459926977250626
      assert.closeTo(gbm.pdf(1.5, 2), 0.4459926977250626, 1e-10)
    })

    it('should return log-normal density for mu=0, sigma=0.5, t=0.5, x=0.8', () => {
      const gbm = new GeometricBrownianMotion(0, 0.5, 1)
      // scipy: stats.lognorm.pdf(0.8, s=0.5*sqrt(0.5), scale=exp(-0.0625*0.5)) = 1.2721398281078873
      assert.closeTo(gbm.pdf(0.8, 0.5), 1.2721398281078873, 1e-10)
    })
  })

  describe('.covariogram()', () => {
    it('should return exp(mu*(s+t)) * (exp(sigma^2*min(s,t)) - 1)', () => {
      const gbm = new GeometricBrownianMotion(0.05, 0.2, 1)
      // scipy: exp(0.05*(1+3)) * (exp(0.2**2*min(1,3)) - 1) → 0.049846392161234841
      assert.closeTo(gbm.covariogram(1, 3), 0.049846392161234841, 1e-10)
    })

    it('should be symmetric', () => {
      const gbm = new GeometricBrownianMotion(0.05, 0.2, 1)
      assert.closeTo(gbm.covariogram(1, 4), gbm.covariogram(4, 1), 1e-10)
    })

    it('should equal variance at s = t', () => {
      const gbm = new GeometricBrownianMotion(0.05, 0.3, 1)
      assert.closeTo(gbm.covariogram(2, 2), gbm.variance(2), 1e-10)
    })

    it('should return NaN for s < 0', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert(Number.isNaN(gbm.covariogram(-1, 2)))
    })

    it('should return NaN for t < 0', () => {
      const gbm = new GeometricBrownianMotion(0, 1, 1)
      assert(Number.isNaN(gbm.covariogram(2, -1)))
    })
  })

  describe('log-returns', () => {
    it('should be normally distributed (KS test)', () => {
      const mu = 0.05
      const sigma = 0.2
      const dt = 1
      const gbm = new GeometricBrownianMotion(mu, sigma, dt)
      const n = 1000
      const logReturns = []
      for (let i = 0; i < n; i++) {
        const prev = gbm.state()
        gbm.next()
        logReturns.push(Math.log(gbm.state() / prev))
      }
      const meanLR = (mu - 0.5 * sigma * sigma) * dt
      const stdLR = sigma * Math.sqrt(dt)
      const ref = new Normal(meanLR, stdLR)
      assert(ksTest(logReturns, x => ref.cdf(x)))
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
      // mpmath mp.dps=50: 3*(1-exp(-2)) → 2.593994150290162
      assert.closeTo(ou.mean(1), 2.593994150290162, 1e-10)
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
      const ou = new OrnsteinUhlenbeck(2, 0, 0.5, 0.1)
      // mpmath mp.dps=50: sigma^2*(1-exp(-2*theta*t))/(2*theta) = 0.25*(1-exp(-4))/4 → 0.06135527256945411
      assert.closeTo(ou.variance(1), 0.06135527256945411, 1e-10)
    })

    it('should return 0 at t=0', () => {
      const ou = new OrnsteinUhlenbeck(1, 0, 1, 1)
      assert.strictEqual(ou.variance(0), 0)
    })

    it('should approach stationary variance sigma^2/(2*theta) as t -> infinity', () => {
      const theta = 2; const sigma = 0.5
      const ou = new OrnsteinUhlenbeck(theta, 0, sigma, 0.1)
      // exact rational: sigma^2/(2*theta) = 0.25/4 = 0.0625
      assert.closeTo(ou.variance(1000), 0.0625, 1e-6)
    })

    it('should return NaN for t < 0', () => {
      const ou = new OrnsteinUhlenbeck(1, 0, 1, 1)
      assert(isNaN(ou.variance(-1)))
    })
  })

  describe('.pdf()', () => {
    it('should return NaN for t = 0', () => {
      const ou = new OrnsteinUhlenbeck(1, 0, 1, 1)
      assert(Number.isNaN(ou.pdf(0, 0)))
    })

    it('should return NaN for t < 0', () => {
      const ou = new OrnsteinUhlenbeck(1, 0, 1, 1)
      assert(Number.isNaN(ou.pdf(0, -1)))
    })

    it('should return Normal(mean(t), variance(t)) density for theta=1 mu=2 sigma=1 t=1 x=1', () => {
      const ou = new OrnsteinUhlenbeck(1, 2, 1, 0.1)
      // scipy: mu=2*(1-exp(-1)), var=(1-exp(-2))/2; stats.norm.pdf(1, mu, sqrt(var)) = 0.5596687594392821
      assert.closeTo(ou.pdf(1, 1), 0.5596687594392821, 1e-10)
    })

    it('should return correct density for theta=2 mu=0 sigma=0.5 t=0.5 x=0', () => {
      const ou = new OrnsteinUhlenbeck(2, 0, 0.5, 0.1)
      // scipy: mu=0, var=0.25*(1-exp(-2))/4; stats.norm.pdf(0, 0, sqrt(var)) = 1.7161142135258760
      assert.closeTo(ou.pdf(0, 0.5), 1.7161142135258760, 1e-10)
    })

    it('should return correct density for theta=0.5 mu=3 sigma=2 t=2 x=2', () => {
      const ou = new OrnsteinUhlenbeck(0.5, 3, 2, 0.1)
      // scipy: mu=3*(1-exp(-1)), var=4*(1-exp(-2))/1; stats.norm.pdf(2, mu, sqrt(var)) = 0.2141814469689605
      assert.closeTo(ou.pdf(2, 2), 0.2141814469689605, 1e-10)
    })
  })

  describe('.covariogram()', () => {
    it('should return (sigma^2/2theta)*(exp(-theta*|t-s|) - exp(-theta*(t+s)))', () => {
      const ou = new OrnsteinUhlenbeck(2, 0, 0.5, 0.1)
      // scipy: (0.5**2/(2*2)) * (exp(-2*abs(3-1)) - exp(-2*(3+1))) → 0.0011237610163019791
      assert.closeTo(ou.covariogram(1, 3), 0.0011237610163019791, 1e-10)
    })

    it('should be symmetric', () => {
      const ou = new OrnsteinUhlenbeck(2, 0, 0.5, 0.1)
      assert.closeTo(ou.covariogram(1, 3), ou.covariogram(3, 1), 1e-10)
    })

    it('should equal variance at s = t', () => {
      const ou = new OrnsteinUhlenbeck(2, 0, 0.5, 0.1)
      assert.closeTo(ou.covariogram(2, 2), ou.variance(2), 1e-10)
    })

    it('should return NaN for s < 0', () => {
      const ou = new OrnsteinUhlenbeck(1, 0, 1, 1)
      assert(Number.isNaN(ou.covariogram(-1, 2)))
    })

    it('should return NaN for t < 0', () => {
      const ou = new OrnsteinUhlenbeck(1, 0, 1, 1)
      assert(Number.isNaN(ou.covariogram(2, -1)))
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
      ou.seed(42)
      for (let i = 0; i < 500; i++) ou.next()
      // lag-1 autocorrelation is exp(-theta*dt)=exp(-0.2)≈0.82; thin by 20 to get
      // independent draws (lag-20 autocorrelation ≈ 0.018) so the KS critical
      // value 1.628/sqrt(1000) is valid
      const samples = []
      for (let i = 0; i < 20000; i++) {
        ou.next()
        if (i % 20 === 0) samples.push(ou.state())
      }
      const stationaryStd = sigma / Math.sqrt(2 * theta)
      const ref = new Normal(mu, stationaryStd)
      assert(ksTest(samples, x => ref.cdf(x)))
    })
  })
})

describe('process.BrownianBridge', () => {
  describe('constructor', () => {
    it('should throw on sigma = 0', () => {
      assert.throws(() => new BrownianBridge(0, 1, 0.1), /Invalid parameters/)
    })

    it('should throw on sigma < 0', () => {
      assert.throws(() => new BrownianBridge(-1, 1, 0.1), /Invalid parameters/)
    })

    it('should throw on T = 0', () => {
      assert.throws(() => new BrownianBridge(1, 0, 0.1), /Invalid parameters/)
    })

    it('should throw on T < 0', () => {
      assert.throws(() => new BrownianBridge(1, -1, 0.1), /Invalid parameters/)
    })

    it('should throw on dt = 0', () => {
      assert.throws(() => new BrownianBridge(1, 1, 0), /Invalid parameters/)
    })

    it('should throw on dt < 0', () => {
      assert.throws(() => new BrownianBridge(1, 1, -0.1), /Invalid parameters/)
    })

    it('should throw on sigma = NaN', () => {
      assert.throws(() => new BrownianBridge(NaN, 1, 0.1), /Invalid parameters/)
    })

    it('should accept valid parameters', () => {
      assert.doesNotThrow(() => new BrownianBridge(1, 1, 0.1))
      assert.doesNotThrow(() => new BrownianBridge(0.5, 2, 0.5))
    })

    it('should start at state 0', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert.strictEqual(bb.state(), 0)
    })
  })

  describe('terminal value', () => {
    it('should return 0 exactly at terminal step N = T/dt', () => {
      const T = 1
      const dt = 0.1
      const N = Math.round(T / dt)
      const bb = new BrownianBridge(1, T, dt)
      bb.seed(42)
      for (let i = 0; i < N; i++) bb.next()
      assert.strictEqual(bb.state(), 0)
    })

    it('should stay at 0 after terminal time', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      bb.seed(42)
      const N = 10
      for (let i = 0; i < N + 5; i++) bb.next()
      assert.strictEqual(bb.state(), 0)
    })
  })

  describe('.reset()', () => {
    it('should restore initial state and time index', () => {
      const T = 1
      const dt = 0.1
      const N = Math.round(T / dt)
      const bb = new BrownianBridge(1, T, dt)
      bb.seed(42)
      for (let i = 0; i < N; i++) bb.next()
      bb.reset()
      assert.strictEqual(bb.state(), 0)
      for (let i = 0; i < N; i++) bb.next()
      assert.strictEqual(bb.state(), 0)
    })
  })

  describe('.path()', () => {
    it('should return N+1 states starting from 0', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      const path = bb.path(10)
      assert.strictEqual(path.length, 11)
      assert.strictEqual(path[0], 0)
    })

    it('should end at 0 at the terminal step', () => {
      const T = 1
      const dt = 0.1
      const N = Math.round(T / dt)
      const bb = new BrownianBridge(1, T, dt)
      bb.seed(42)
      const path = bb.path(N)
      assert.strictEqual(path[N], 0)
    })

    it('should not mutate the current state or time index', () => {
      const T = 1
      const dt = 0.1
      const N = Math.round(T / dt)
      const bb = new BrownianBridge(1, T, dt)
      bb.seed(42)
      for (let i = 0; i < 5; i++) bb.next()
      const stateBefore = bb.state()
      bb.path(N)
      assert.strictEqual(bb.state(), stateBefore)
      // Remaining 5 steps should still reach 0
      for (let i = 0; i < 5; i++) bb.next()
      assert.strictEqual(bb.state(), 0)
    })
  })

  describe('.mean()', () => {
    it('should return 0 for t >= 0', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert.strictEqual(bb.mean(0), 0)
      assert.strictEqual(bb.mean(0.5), 0)
      assert.strictEqual(bb.mean(1), 0)
      assert.strictEqual(bb.mean(2), 0)
    })

    it('should return NaN for t < 0', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert(Number.isNaN(bb.mean(-1)))
    })
  })

  describe('.variance()', () => {
    it('should return sigma^2 * t * (T-t) / T for 0 < t < T', () => {
      const sigma = 2
      const T = 1
      const bb = new BrownianBridge(sigma, T, 0.1)
      // exact rational: sigma^2*t*(T-t)/T = 4*0.5*0.5/1 = 1
      assert.closeTo(bb.variance(0.5), 1, 1e-10)
    })

    it('should return 0 at t=0', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert.strictEqual(bb.variance(0), 0)
    })

    it('should return 0 at t=T', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert.strictEqual(bb.variance(1), 0)
    })

    it('should return 0 for t > T', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert.strictEqual(bb.variance(2), 0)
    })

    it('should return NaN for t < 0', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert(Number.isNaN(bb.variance(-1)))
    })
  })

  describe('.covariogram()', () => {
    it('should return sigma^2 * min(s,t) * (T - max(s,t)) / T for 0 <= s <= t <= T', () => {
      const sigma = 2; const T = 1
      const bb = new BrownianBridge(sigma, T, 0.1)
      // exact rational: sigma^2*s*(T-t)/T = 4*0.25*0.5/1 = 0.5
      assert.closeTo(bb.covariogram(0.25, 0.5), 0.5, 1e-10)
    })

    it('should be symmetric', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      assert.closeTo(bb.covariogram(0.5, 1.5), bb.covariogram(1.5, 0.5), 1e-10)
    })

    it('should equal variance at s = t', () => {
      const sigma = 2; const T = 1
      const bb = new BrownianBridge(sigma, T, 0.1)
      assert.closeTo(bb.covariogram(0.4, 0.4), bb.variance(0.4), 1e-10)
    })

    it('should return 0 for s > T', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert.strictEqual(bb.covariogram(1.5, 0.5), 0)
    })

    it('should return 0 for t > T', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert.strictEqual(bb.covariogram(0.5, 1.5), 0)
    })

    it('should return 0 at t = T', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert.strictEqual(bb.covariogram(0.5, 1), 0)
    })

    it('should return NaN for s < 0', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert(Number.isNaN(bb.covariogram(-0.5, 0.5)))
    })

    it('should return NaN for t < 0', () => {
      const bb = new BrownianBridge(1, 1, 0.1)
      assert(Number.isNaN(bb.covariogram(0.5, -0.5)))
    })
  })

  describe('.pdf()', () => {
    it('should return NaN for t < 0', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      assert(Number.isNaN(bb.pdf(0, -1)))
    })

    it('should return Infinity at x=0 when t=0 (point mass at origin)', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      assert.strictEqual(bb.pdf(0, 0), Infinity)
    })

    it('should return 0 at x≠0 when t=0', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      assert.strictEqual(bb.pdf(1, 0), 0)
    })

    it('should return Infinity at x=0 when t=T (pinned to 0)', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      assert.strictEqual(bb.pdf(0, 2), Infinity)
    })

    it('should return 0 at x≠0 when t=T', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      assert.strictEqual(bb.pdf(1, 2), 0)
    })

    it('should return Infinity at x=0 for t > T', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      assert.strictEqual(bb.pdf(0, 3), Infinity)
    })

    it('should return 0 at x≠0 for t > T', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      assert.strictEqual(bb.pdf(1, 3), 0)
    })

    it('should return Normal(0, sigma^2*t*(T-t)/T) density at x=0 for sigma=1, T=2, t=1', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      // scipy: stats.norm.pdf(0, 0, sqrt(1*1*1/2)) = 0.5641895835477563
      assert.closeTo(bb.pdf(0, 1), 0.5641895835477563, 1e-10)
    })

    it('should return correct density at x=1 for sigma=1, T=2, t=1', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      // scipy: stats.norm.pdf(1, 0, sqrt(0.5)) = 0.20755374871029736
      assert.closeTo(bb.pdf(1, 1), 0.20755374871029736, 1e-10)
    })

    it('should be symmetric around 0 (pdf(-x, t) = pdf(x, t))', () => {
      const bb = new BrownianBridge(1, 2, 0.1)
      assert.closeTo(bb.pdf(-1, 1), bb.pdf(1, 1), 1e-10)
    })

    it('should return correct density at x=0 for sigma=2, T=4, t=2', () => {
      const bb = new BrownianBridge(2, 4, 0.1)
      // scipy: stats.norm.pdf(0, 0, sqrt(4*2*2/4)) = stats.norm.pdf(0, 0, 2) = 0.19947114020071635
      assert.closeTo(bb.pdf(0, 2), 0.19947114020071635, 1e-10)
    })
  })

  describe('increments', () => {
    it('should be normally distributed at t=0 (KS test)', () => {
      // At t=0, X_0=0 so drift=0; increment is exactly sigma*sqrt(dt)*Z ~ N(0, sigma*sqrt(dt))
      const sigma = 1.5
      const T = 100
      const dt = 1
      const bb = new BrownianBridge(sigma, T, dt)
      bb.seed(42)
      const n = 1000
      const increments = []
      for (let i = 0; i < n; i++) {
        bb.reset()
        bb.next()
        increments.push(bb.state())
      }
      const ref = new Normal(0, sigma * Math.sqrt(dt))
      assert(ksTest(increments, x => ref.cdf(x)))
    })
  })
})

describe('process.AR1', () => {
  describe('constructor', () => {
    it('should throw on sigma = 0', () => {
      assert.throws(() => new AR1(0.5, 0), /Invalid parameters/)
    })

    it('should throw on sigma < 0', () => {
      assert.throws(() => new AR1(0.5, -1), /Invalid parameters/)
    })

    it('should throw on sigma = NaN', () => {
      assert.throws(() => new AR1(0.5, NaN), /Invalid parameters/)
    })

    it('should throw on phi = NaN', () => {
      assert.throws(() => new AR1(NaN, 1), /Invalid parameters/)
    })

    it('should accept |phi| >= 1 without throwing (non-stationary)', () => {
      assert.doesNotThrow(() => new AR1(1, 1))
      assert.doesNotThrow(() => new AR1(1.5, 1))
      assert.doesNotThrow(() => new AR1(-1.2, 1))
    })

    it('should accept valid stationary parameters', () => {
      assert.doesNotThrow(() => new AR1(0.5, 1))
      assert.doesNotThrow(() => new AR1(-0.9, 2))
    })

    it('should start at state 0', () => {
      assert.strictEqual(new AR1(0.5, 1).state(), 0)
    })

    it('should use all defaults when called with no arguments', () => {
      assert.doesNotThrow(() => new AR1())
      assert.strictEqual(new AR1().state(), 0)
    })
  })

  describe('.mean()', () => {
    it('should return 0 for t >= 0', () => {
      const ar1 = new AR1(0.5, 1)
      assert.strictEqual(ar1.mean(0), 0)
      assert.strictEqual(ar1.mean(5), 0)
      assert.strictEqual(ar1.mean(100), 0)
    })

    it('should return NaN for t < 0', () => {
      const ar1 = new AR1(0.5, 1)
      assert(Number.isNaN(ar1.mean(-1)))
    })
  })

  describe('.variance()', () => {
    it('should return 0 at t = 0', () => {
      const ar1 = new AR1(0.5, 1)
      assert.strictEqual(ar1.variance(0), 0)
    })

    it('should return sigma^2 at t = 1', () => {
      const ar1 = new AR1(0.5, 2)
      // exact rational: Var(X_1) = sigma^2 = 4
      assert.closeTo(ar1.variance(1), 4, 1e-10)
    })

    it('should return sigma^2*(1+phi^2) at t = 2', () => {
      const ar1 = new AR1(0.5, 2)
      // exact rational: Var(X_2) = sigma^2*(1 + phi^2) = 4*(1+0.25) = 5
      assert.closeTo(ar1.variance(2), 5, 1e-10)
    })

    it('should approach stationary variance sigma^2/(1-phi^2) as t -> infinity', () => {
      const ar1 = new AR1(0.5, 1)
      // exact rational: sigma^2/(1-phi^2) = 1/(1-0.25) = 4/3
      assert.closeTo(ar1.variance(1000), 4 / 3, 1e-6)
    })

    it('should return NaN for t < 0', () => {
      const ar1 = new AR1(0.5, 1)
      assert(Number.isNaN(ar1.variance(-1)))
    })

    it('should grow monotonically for |phi| > 1', () => {
      const ar1 = new AR1(1.5, 1)
      // exact rational: Var(X_3) = sigma^2*(1 + phi^2 + phi^4) = 1 + 2.25 + 5.0625 = 8.3125
      assert.closeTo(ar1.variance(3), 8.3125, 1e-10)
      assert(ar1.variance(10) > ar1.variance(5))
      assert(ar1.variance(20) > ar1.variance(10))
    })
  })

  describe('.pdf()', () => {
    it('should return NaN for t = 0', () => {
      const ar1 = new AR1(0.5, 1)
      assert(Number.isNaN(ar1.pdf(0, 0)))
    })

    it('should return NaN for t < 0', () => {
      const ar1 = new AR1(0.5, 1)
      assert(Number.isNaN(ar1.pdf(0, -1)))
    })

    it('should return Normal(0, sigma^2) density at t = 1', () => {
      const ar1 = new AR1(0.5, 1)
      // scipy: stats.norm.pdf(0, 0, 1) = 0.3989422804014327
      assert.closeTo(ar1.pdf(0, 1), 0.3989422804014327, 1e-10)
    })

    it('should return Normal(0, sigma^2*(1+phi^2)) density at t = 2', () => {
      const ar1 = new AR1(0.5, 1)
      // scipy: stats.norm.pdf(0, 0, sqrt(1.25)) = 0.3568248232305543
      assert.closeTo(ar1.pdf(0, 2), 0.3568248232305543, 1e-10)
    })

    it('should be symmetric around 0', () => {
      const ar1 = new AR1(0.5, 1)
      // scipy: stats.norm.pdf(1, 0, sqrt(1.3125)) = 0.2379112029210874
      assert.closeTo(ar1.pdf(1, 3), 0.2379112029210874, 1e-10)
      assert.closeTo(ar1.pdf(-1, 3), ar1.pdf(1, 3), 1e-10)
    })
  })

  describe('.covariogram()', () => {
    it('should equal variance at s = t', () => {
      const ar1 = new AR1(0.5, 1)
      assert.closeTo(ar1.covariogram(2, 2), ar1.variance(2), 1e-10)
    })

    it('should be symmetric: covariogram(s, t) = covariogram(t, s)', () => {
      const ar1 = new AR1(0.5, 1)
      // exact rational: Cov(X_2, X_3) = phi * Var(X_2) = 0.5 * (1 + 0.25) = 0.625
      assert.closeTo(ar1.covariogram(2, 3), 0.625, 1e-10)
      assert.closeTo(ar1.covariogram(2, 3), ar1.covariogram(3, 2), 1e-10)
    })

    it('should return phi * Var(X_1) for s=1, t=2', () => {
      const ar1 = new AR1(0.5, 1)
      // exact rational: Cov(X_1, X_2) = phi^1 * Var(X_1) = 0.5 * 1 = 0.5
      assert.closeTo(ar1.covariogram(1, 2), 0.5, 1e-10)
    })

    it('should return phi^2 * Var(X_1) for s=1, t=3', () => {
      const ar1 = new AR1(0.5, 1)
      // exact rational: Cov(X_1, X_3) = phi^2 * Var(X_1) = 0.25 * 1 = 0.25
      assert.closeTo(ar1.covariogram(1, 3), 0.25, 1e-10)
    })

    it('should return NaN for s < 0', () => {
      const ar1 = new AR1(0.5, 1)
      assert(Number.isNaN(ar1.covariogram(-1, 2)))
    })

    it('should return NaN for t < 0', () => {
      const ar1 = new AR1(0.5, 1)
      assert(Number.isNaN(ar1.covariogram(2, -1)))
    })
  })

  describe('.reset()', () => {
    it('should restore initial state to 0', () => {
      const ar1 = new AR1(0.5, 1)
      ar1.seed(42)
      for (let i = 0; i < 10; i++) ar1.next()
      ar1.reset()
      assert.strictEqual(ar1.state(), 0)
    })
  })

  describe('stationarity', () => {
    it('should converge to stationary distribution for |phi| < 1 (KS test)', () => {
      const phi = 0.5
      const sigma = 1
      const ar1 = new AR1(phi, sigma)
      ar1.seed(42)
      // burn in to reach stationarity
      for (let i = 0; i < 500; i++) ar1.next()
      // thin by 10: lag-10 autocorrelation = phi^10 ≈ 0.001, effectively independent
      const samples = []
      for (let i = 0; i < 10000; i++) {
        ar1.next()
        if (i % 10 === 0) samples.push(ar1.state())
      }
      const stationarySd = sigma / Math.sqrt(1 - phi * phi)
      const ref = new Normal(0, stationarySd)
      assert(ksTest(samples, x => ref.cdf(x)))
    })
  })

  describe('explosive growth', () => {
    it('should exhibit growing variance for |phi| > 1', () => {
      const ar1 = new AR1(1.5, 1)
      ar1.seed(42)
      // run ensemble of 30 paths; at step 30 theoretical Var ≈ phi^60/1.25 ≈ 3.5e10
      const paths = ar1.ensemble(20, 30)
      const earlyMSV = paths.map(p => p[1] * p[1]).reduce((a, b) => a + b) / paths.length
      const lateMSV = paths.map(p => p[30] * p[30]).reduce((a, b) => a + b) / paths.length
      assert(lateMSV > earlyMSV * 100)
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

  describe('.mean()', () => {
    it('should return lambda*t', () => {
      const pp = new PoissonProcess(2, 0.5)
      // exact rational: lambda*t = 2*3 = 6
      assert.closeTo(pp.mean(3), 6, 1e-10)
    })

    it('should return 0 at t=0', () => {
      const pp = new PoissonProcess(2, 0.5)
      assert.strictEqual(pp.mean(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const pp = new PoissonProcess(2, 0.5)
      assert(Number.isNaN(pp.mean(-1)))
    })
  })

  describe('.variance()', () => {
    it('should return lambda*t', () => {
      const pp = new PoissonProcess(2, 0.5)
      // exact rational: lambda*t = 2*3 = 6
      assert.closeTo(pp.variance(3), 6, 1e-10)
    })

    it('should return 0 at t=0', () => {
      const pp = new PoissonProcess(2, 0.5)
      assert.strictEqual(pp.variance(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const pp = new PoissonProcess(2, 0.5)
      assert(Number.isNaN(pp.variance(-1)))
    })
  })

  describe('.pdf()', () => {
    it('should return NaN for t < 0', () => {
      const pp = new PoissonProcess(1, 1)
      assert(Number.isNaN(pp.pdf(0, -1)))
    })

    it('should return 0 for non-integer x', () => {
      const pp = new PoissonProcess(2, 1)
      assert.strictEqual(pp.pdf(1.5, 1), 0)
    })

    it('should return 0 for negative integer x', () => {
      const pp = new PoissonProcess(2, 1)
      assert.strictEqual(pp.pdf(-1, 1), 0)
    })

    it('should return 1 for x=0 at t=0', () => {
      const pp = new PoissonProcess(1, 1)
      assert.strictEqual(pp.pdf(0, 0), 1)
    })

    it('should return 0 for x=1 at t=0', () => {
      const pp = new PoissonProcess(1, 1)
      assert.strictEqual(pp.pdf(1, 0), 0)
    })

    it('should return Poisson(lambda*t) PMF for lambda=2 t=1 x=2', () => {
      const pp = new PoissonProcess(2, 1)
      // scipy: stats.poisson.pmf(2, 2) = 0.2706705664732255
      assert.closeTo(pp.pdf(2, 1), 0.2706705664732255, 1e-10)
    })

    it('should return Poisson(lambda*t) PMF for lambda=0.5 t=3 x=1', () => {
      const pp = new PoissonProcess(0.5, 1)
      // scipy: stats.poisson.pmf(1, 1.5) = 0.3346952402226447
      assert.closeTo(pp.pdf(1, 3), 0.3346952402226447, 1e-10)
    })

    it('should return Poisson(lambda*t) PMF for lambda=3 t=2 x=5', () => {
      const pp = new PoissonProcess(3, 1)
      // scipy: stats.poisson.pmf(5, 6) = 0.1606231410479798
      assert.closeTo(pp.pdf(5, 2), 0.1606231410479798, 1e-10)
    })
  })

  describe('.covariogram()', () => {
    it('should return lambda * min(s, t)', () => {
      const pp = new PoissonProcess(3, 0.5)
      assert.closeTo(pp.covariogram(2, 5), 3 * 2, 1e-10)
    })

    it('should be symmetric', () => {
      const pp = new PoissonProcess(3, 0.5)
      assert.closeTo(pp.covariogram(2, 5), pp.covariogram(5, 2), 1e-10)
    })

    it('should equal variance at s = t', () => {
      const pp = new PoissonProcess(3, 0.5)
      assert.closeTo(pp.covariogram(4, 4), pp.variance(4), 1e-10)
    })

    it('should return NaN for s < 0', () => {
      const pp = new PoissonProcess(1, 1)
      assert(Number.isNaN(pp.covariogram(-1, 2)))
    })

    it('should return NaN for t < 0', () => {
      const pp = new PoissonProcess(1, 1)
      assert(Number.isNaN(pp.covariogram(2, -1)))
    })
  })
})
describe('process.CompoundPoissonProcess', () => {
  describe('constructor', () => {
    it('should throw on lambda = 0', () => {
      assert.throws(() => new CompoundPoissonProcess(0, new Normal(1, 1), 1), /Invalid parameters/)
    })

    it('should throw on lambda < 0', () => {
      assert.throws(() => new CompoundPoissonProcess(-1, new Normal(1, 1), 1), /Invalid parameters/)
    })

    it('should throw on dt = 0', () => {
      assert.throws(() => new CompoundPoissonProcess(1, new Normal(1, 1), 0), /Invalid parameters/)
    })

    it('should throw on dt < 0', () => {
      assert.throws(() => new CompoundPoissonProcess(1, new Normal(1, 1), -0.5), /Invalid parameters/)
    })

    it('should throw on lambda = NaN', () => {
      assert.throws(() => new CompoundPoissonProcess(NaN, new Normal(1, 1), 1), /Invalid parameters/)
    })

    it('should throw when jumpDist is undefined', () => {
      assert.throws(() => new CompoundPoissonProcess(1, undefined, 1), /Invalid parameters/)
    })

    it('should throw when jumpDist is null', () => {
      assert.throws(() => new CompoundPoissonProcess(1, null, 1), /Invalid parameters/)
    })

    it('should throw when jumpDist has no .sample() method', () => {
      assert.throws(() => new CompoundPoissonProcess(1, { mean: () => 0 }, 1), /Invalid parameters/)
    })

    it('should accept valid parameters', () => {
      assert.doesNotThrow(() => new CompoundPoissonProcess(2, new Normal(1, 1), 0.5))
    })

    it('should accept default lambda and dt when jumpDist is provided', () => {
      assert.doesNotThrow(() => new CompoundPoissonProcess(1, new Normal(0, 1), 1))
    })

    it('should start at state 0', () => {
      const cpp = new CompoundPoissonProcess(2, new Normal(1, 1), 1)
      assert.strictEqual(cpp.state(), 0)
    })
  })

  describe('path', () => {
    it('should start at 0', () => {
      const cpp = new CompoundPoissonProcess(2, new Poisson(1), 1)
      assert.strictEqual(cpp.path(10)[0], 0)
    })

    it('should be non-decreasing with non-negative jumps', () => {
      const cpp = new CompoundPoissonProcess(3, new Poisson(2), 0.5)
      cpp.seed(42)
      const path = cpp.path(200)
      for (let i = 1; i < path.length; i++) {
        assert(path[i] >= path[i - 1])
      }
    })
  })

  describe('.mean()', () => {
    it('should return lambda*t*E[J]', () => {
      const cpp = new CompoundPoissonProcess(3, new Normal(2, 1), 1)
      // exact rational: lambda*t*mu = 3*5*2 = 30
      assert.closeTo(cpp.mean(5), 30, 1e-10)
    })

    it('should return 0 at t=0', () => {
      const cpp = new CompoundPoissonProcess(3, new Normal(2, 1), 1)
      assert.strictEqual(cpp.mean(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const cpp = new CompoundPoissonProcess(2, new Normal(1, 1), 1)
      assert(Number.isNaN(cpp.mean(-1)))
    })
  })

  describe('.variance()', () => {
    it('should return lambda*t*E[J^2]', () => {
      const cpp = new CompoundPoissonProcess(3, new Normal(2, 1), 1)
      // exact rational: lambda*t*(sigma^2 + mu^2) = 3*4*(1+4) = 60
      assert.closeTo(cpp.variance(4), 60, 1e-10)
    })

    it('should return 0 at t=0', () => {
      const cpp = new CompoundPoissonProcess(2, new Normal(1, 1), 1)
      assert.strictEqual(cpp.variance(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const cpp = new CompoundPoissonProcess(2, new Normal(1, 1), 1)
      assert(Number.isNaN(cpp.variance(-1)))
    })
  })

  describe('.covariogram()', () => {
    it('should return lambda*E[J^2]*min(s,t)', () => {
      const cpp = new CompoundPoissonProcess(3, new Normal(2, 1), 1)
      // exact rational: lambda*E[J^2]*min(s,t) = 3*(1+4)*2 = 30
      assert.closeTo(cpp.covariogram(2, 5), 30, 1e-10)
    })

    it('should be symmetric', () => {
      const cpp = new CompoundPoissonProcess(3, new Normal(2, 1), 1)
      assert.closeTo(cpp.covariogram(2, 5), cpp.covariogram(5, 2), 1e-10)
    })

    it('should equal variance at s = t', () => {
      const cpp = new CompoundPoissonProcess(3, new Normal(2, 1), 1)
      // exact rational: variance(3) = covariogram(3, 3) = 3*3*(1+4) = 45
      assert.closeTo(cpp.covariogram(3, 3), cpp.variance(3), 1e-10)
    })

    it('should return NaN for s < 0', () => {
      const cpp = new CompoundPoissonProcess(2, new Normal(1, 1), 1)
      assert(Number.isNaN(cpp.covariogram(-1, 2)))
    })

    it('should return NaN for t < 0', () => {
      const cpp = new CompoundPoissonProcess(2, new Normal(1, 1), 1)
      assert(Number.isNaN(cpp.covariogram(2, -1)))
    })
  })

  describe('.seed()', () => {
    it('should produce identical paths when seeded identically', () => {
      const cpp = new CompoundPoissonProcess(2, new Normal(1, 1), 1)
      cpp.seed(42)
      const path1 = cpp.path(30)
      cpp.seed(42)
      const path2 = cpp.path(30)
      assert.deepEqual(path1, path2)
    })

    it('should produce different paths for different seeds', () => {
      const cpp = new CompoundPoissonProcess(2, new Normal(1, 1), 1)
      cpp.seed(1)
      const path1 = cpp.path(30)
      cpp.seed(2)
      const path2 = cpp.path(30)
      assert.notDeepEqual(path1, path2)
    })

    it('should return this for chaining', () => {
      const cpp = new CompoundPoissonProcess(2, new Normal(1, 1), 1)
      assert.strictEqual(cpp.seed(0), cpp)
    })
  })

  describe('.reset()', () => {
    it('should restore initial state to 0', () => {
      const cpp = new CompoundPoissonProcess(2, new Normal(0, 1), 1)
      cpp.seed(42)
      for (let i = 0; i < 10; i++) cpp.next()
      cpp.reset()
      assert.strictEqual(cpp.state(), 0)
    })
  })

  describe('mean increment', () => {
    it('should have increments with mean close to lambda*dt*E[J]', () => {
      const lambda = 2
      const dt = 0.5
      const muJ = 1
      const cpp = new CompoundPoissonProcess(lambda, new Normal(muJ, 1), dt)
      const n = 5000
      let sum = 0
      for (let i = 0; i < n; i++) {
        cpp.reset()
        cpp.next()
        sum += cpp.state()
      }
      // exact rational: E[increment] = lambda*dt*muJ = 2*0.5*1 = 1
      assert.closeTo(sum / n, lambda * dt * muJ, 0.1)
    })
  })
})

describe('process.CoxIngersollRoss', () => {
  describe('constructor', () => {
    it('should throw on kappa = 0', () => {
      assert.throws(() => new CoxIngersollRoss(0, 1, 1, 1), /Invalid parameters/)
    })

    it('should throw on kappa < 0', () => {
      assert.throws(() => new CoxIngersollRoss(-1, 1, 1, 1), /Invalid parameters/)
    })

    it('should throw on theta = 0', () => {
      assert.throws(() => new CoxIngersollRoss(1, 0, 1, 1), /Invalid parameters/)
    })

    it('should throw on theta < 0', () => {
      assert.throws(() => new CoxIngersollRoss(1, -1, 1, 1), /Invalid parameters/)
    })

    it('should throw on sigma = 0', () => {
      assert.throws(() => new CoxIngersollRoss(1, 1, 0, 1), /Invalid parameters/)
    })

    it('should throw on sigma < 0', () => {
      assert.throws(() => new CoxIngersollRoss(1, 1, -1, 1), /Invalid parameters/)
    })

    it('should throw on dt = 0', () => {
      assert.throws(() => new CoxIngersollRoss(1, 1, 1, 0), /Invalid parameters/)
    })

    it('should throw on dt < 0', () => {
      assert.throws(() => new CoxIngersollRoss(1, 1, 1, -0.5), /Invalid parameters/)
    })

    it('should throw on kappa = NaN', () => {
      assert.throws(() => new CoxIngersollRoss(NaN, 1, 1, 1), /Invalid parameters/)
    })

    it('should accept valid parameters', () => {
      assert.doesNotThrow(() => new CoxIngersollRoss(2, 1, 0.5, 0.1))
    })

    it('should not throw when Feller condition is not met', () => {
      // 2*0.5*1 = 1 <= 4 = sigma^2; Feller not satisfied, but only a warning
      assert.doesNotThrow(() => new CoxIngersollRoss(0.5, 1, 2, 1))
    })

    it('should start at state 0', () => {
      const cir = new CoxIngersollRoss(2, 1, 0.5, 0.1)
      assert.strictEqual(cir.state(), 0)
    })
  })

  describe('.mean()', () => {
    it('should return theta*(1-exp(-kappa*t)) for zero initial state', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      // mpmath mp.dps=50: 3*(1-exp(-2)) → 2.59399415029016
      assert.closeTo(cir.mean(1), 2.59399415029016, 1e-10)
    })

    it('should return 0 at t=0', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      assert.strictEqual(cir.mean(0), 0)
    })

    it('should approach theta as t -> infinity', () => {
      const cir = new CoxIngersollRoss(1, 4, 1, 0.1)
      assert.closeTo(cir.mean(1000), 4, 1e-6)
    })

    it('should return NaN for t < 0', () => {
      const cir = new CoxIngersollRoss(1, 1, 1, 1)
      assert(isNaN(cir.mean(-1)))
    })

    it('should be stable after advancing the simulation', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      const before = cir.mean(1)
      for (let i = 0; i < 20; i++) cir.next()
      assert.closeTo(cir.mean(1), before, 1e-10)
    })
  })

  describe('.variance()', () => {
    it('should return theta*sigma^2/(2*kappa)*(1-exp(-kappa*t))^2 for zero initial state', () => {
      const cir = new CoxIngersollRoss(2, 3, 0.5, 0.1)
      // mpmath mp.dps=50: 3*(0.25/(2*2))*(1-exp(-2))^2 → 0.14018345107791
      assert.closeTo(cir.variance(1), 0.14018345107791, 1e-10)
    })

    it('should return 0 at t=0', () => {
      const cir = new CoxIngersollRoss(1, 1, 1, 1)
      assert.strictEqual(cir.variance(0), 0)
    })

    it('should approach stationary variance theta*sigma^2/(2*kappa) as t -> infinity', () => {
      const kappa = 2; const theta = 3; const sigma = 0.5
      const cir = new CoxIngersollRoss(kappa, theta, sigma, 0.1)
      // exact rational: theta*sigma^2/(2*kappa) = 3*0.25/4 = 0.1875
      assert.closeTo(cir.variance(1000), 0.1875, 1e-6)
    })

    it('should return NaN for t < 0', () => {
      const cir = new CoxIngersollRoss(1, 1, 1, 1)
      assert(isNaN(cir.variance(-1)))
    })
  })

  describe('positivity', () => {
    it('should produce non-negative paths when Feller condition holds', () => {
      // 2*kappa*theta = 2*2*1 = 4 > 1 = sigma^2; Feller condition met
      const cir = new CoxIngersollRoss(2, 1, 1, 0.01)
      cir.seed(0)
      const path = cir.path(10000)
      assert(path.every(x => x >= 0))
    })
  })

  describe('stationarity', () => {
    it('should converge to stationary mean theta (time-average test)', () => {
      const theta = 1.5
      const cir = new CoxIngersollRoss(2, theta, 0.5, 0.01)
      cir.seed(42)
      for (let i = 0; i < 5000; i++) cir.next()
      let sum = 0
      const n = 10000
      for (let i = 0; i < n; i++) sum += cir.next()
      assert.closeTo(sum / n, theta, 0.05)
    })
  })

  describe('.reset()', () => {
    it('should restore initial state to 0', () => {
      const cir = new CoxIngersollRoss(2, 1, 0.5, 0.1)
      for (let i = 0; i < 10; i++) cir.next()
      cir.reset()
      assert.strictEqual(cir.state(), 0)
    })
  })

  describe('.pdf()', () => {
    it('should return NaN for t = 0', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      assert(Number.isNaN(cir.pdf(1, 0)))
    })

    it('should return NaN for t < 0', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      assert(Number.isNaN(cir.pdf(1, -1)))
    })

    it('should return 0 for x < 0', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      assert.strictEqual(cir.pdf(-0.1, 0.5), 0)
    })

    it('should return 0 for x = 0 when Feller condition holds (alpha > 1)', () => {
      // kappa=2, theta=3, sigma=1: alpha = 2*kappa*theta/sigma^2 = 12 > 1
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      assert.strictEqual(cir.pdf(0, 0.5), 0)
    })

    it('should return Gamma density for x=0.5, kappa=2, theta=3, sigma=1, t=0.5', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      // alpha=12, scale=0.5/2*(1-exp(-1)); Python3 math: gamma_pdf = 0.002130824749883
      assert.closeTo(cir.pdf(0.5, 0.5), 0.002130824749883, 1e-10)
    })

    it('should return Gamma density for x=2.0, kappa=2, theta=3, sigma=1, t=0.5', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      // alpha=12, scale=0.5/2*(1-exp(-1)); Python3 math: gamma_pdf = 0.674442782399143
      assert.closeTo(cir.pdf(2.0, 0.5), 0.674442782399143, 1e-10)
    })

    it('should return Gamma density for x=1.5, kappa=2, theta=3, sigma=1, t=1', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      // alpha=12, scale=0.5/2*(1-exp(-2)); Python3 math: gamma_pdf = 0.201734321913609
      assert.closeTo(cir.pdf(1.5, 1), 0.201734321913609, 1e-10)
    })

    it('should be stable after advancing the simulation', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      const before = cir.pdf(1.0, 0.5)
      for (let i = 0; i < 20; i++) cir.next()
      assert.closeTo(cir.pdf(1.0, 0.5), before, 1e-10)
    })
  })

  describe('.covariogram()', () => {
    it('should return NaN for s < 0', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      assert(Number.isNaN(cir.covariogram(-1, 2)))
    })

    it('should return NaN for t < 0', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      assert(Number.isNaN(cir.covariogram(2, -1)))
    })

    it('should be symmetric', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      assert.closeTo(cir.covariogram(1, 3), cir.covariogram(3, 1), 1e-10)
    })

    it('should equal variance at s = t', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      // Python3 math: cov(2,2) = variance(2) = 0.722778138637826
      assert.closeTo(cir.covariogram(2, 2), cir.variance(2), 1e-10)
    })

    it('should return correct value for s=1, t=3, kappa=2, theta=3, sigma=1', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      // theta*sigma2OverKappa/2*(1-exp(-2))^2*exp(-4); Python3 math: 0.010270197872478
      assert.closeTo(cir.covariogram(1, 3), 0.010270197872478, 1e-10)
    })

    it('should return correct value for s=0.5, t=2, kappa=2, theta=3, sigma=1', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      // Python3 math: 0.014920303192111
      assert.closeTo(cir.covariogram(0.5, 2), 0.014920303192111, 1e-10)
    })

    it('should return 0 at s=0 or t=0', () => {
      const cir = new CoxIngersollRoss(2, 3, 1, 0.1)
      // exact rational: min(s,t)=0 so (1-exp(0))^2 = 0
      assert.strictEqual(cir.covariogram(0, 2), 0)
      assert.strictEqual(cir.covariogram(2, 0), 0)
    })
  })
})

describe('process.RandomWalk', () => {
  describe('constructor', () => {
    it('should throw on p = 0', () => {
      assert.throws(() => new RandomWalk(0), /Invalid parameters/)
    })

    it('should throw on p = 1', () => {
      assert.throws(() => new RandomWalk(1), /Invalid parameters/)
    })

    it('should throw on p < 0', () => {
      assert.throws(() => new RandomWalk(-0.1), /Invalid parameters/)
    })

    it('should throw on p > 1', () => {
      assert.throws(() => new RandomWalk(1.1), /Invalid parameters/)
    })

    it('should throw on p = NaN', () => {
      assert.throws(() => new RandomWalk(NaN), /Invalid parameters/)
    })

    it('should accept valid probability', () => {
      assert.doesNotThrow(() => new RandomWalk(0.3))
      assert.doesNotThrow(() => new RandomWalk(0.7))
    })

    it('should use p = 0.5 by default', () => {
      assert.doesNotThrow(() => new RandomWalk())
    })

    it('should start at state 0', () => {
      assert.strictEqual(new RandomWalk(0.5).state(), 0)
    })
  })

  describe('path', () => {
    it('should be integer-valued', () => {
      const rw = new RandomWalk(0.5)
      rw.seed(42)
      const path = rw.path(200)
      for (const x of path) {
        assert.strictEqual(x, Math.floor(x))
      }
    })

    it('should change by exactly +1 or -1 at each step', () => {
      const rw = new RandomWalk(0.3)
      rw.seed(7)
      const path = rw.path(100)
      for (let i = 1; i < path.length; i++) {
        const diff = path[i] - path[i - 1]
        assert(diff === 1 || diff === -1, `step ${i} diff = ${diff}`)
      }
    })
  })

  describe('.mean()', () => {
    it('should return t*(2p-1) for biased walk', () => {
      const rw = new RandomWalk(0.7)
      // exact rational: t*(2p-1) = 5*(2*0.7-1) = 5*0.4 = 2
      assert.closeTo(rw.mean(5), 2, 1e-10)
    })

    it('should return 0 for symmetric walk (p=0.5)', () => {
      const rw = new RandomWalk(0.5)
      assert.strictEqual(rw.mean(10), 0)
    })

    it('should return negative mean for p < 0.5', () => {
      const rw = new RandomWalk(0.3)
      // exact rational: t*(2p-1) = 4*(0.6-1) = 4*(-0.4) = -1.6
      assert.closeTo(rw.mean(4), -1.6, 1e-10)
    })

    it('should return 0 at t = 0', () => {
      const rw = new RandomWalk(0.7)
      assert.strictEqual(rw.mean(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const rw = new RandomWalk(0.5)
      assert(Number.isNaN(rw.mean(-1)))
    })
  })

  describe('.variance()', () => {
    it('should return 4p(1-p)*t for symmetric walk', () => {
      const rw = new RandomWalk(0.5)
      // exact rational: 4*0.5*0.5*10 = 10
      assert.closeTo(rw.variance(10), 10, 1e-10)
    })

    it('should return 4p(1-p)*t for biased walk', () => {
      const rw = new RandomWalk(0.7)
      // exact rational: 4*0.7*0.3*5 = 4.2
      assert.closeTo(rw.variance(5), 4.2, 1e-10)
    })

    it('should be reduced by bias (p != 0.5 has less variance than p = 0.5)', () => {
      const sym = new RandomWalk(0.5)
      const biased = new RandomWalk(0.3)
      assert(biased.variance(10) < sym.variance(10))
    })

    it('should return 0 at t = 0', () => {
      const rw = new RandomWalk(0.5)
      assert.strictEqual(rw.variance(0), 0)
    })

    it('should return NaN for t < 0', () => {
      const rw = new RandomWalk(0.5)
      assert(Number.isNaN(rw.variance(-1)))
    })
  })

  describe('.pdf()', () => {
    it('should return NaN for t < 0', () => {
      const rw = new RandomWalk(0.5)
      assert(Number.isNaN(rw.pdf(0, -1)))
    })

    it('should return NaN for non-integer t', () => {
      const rw = new RandomWalk(0.5)
      assert(Number.isNaN(rw.pdf(0, 1.5)))
    })

    it('should return 0 for non-integer x', () => {
      const rw = new RandomWalk(0.5)
      assert.strictEqual(rw.pdf(0.5, 4), 0)
    })

    it('should return 0 when |x| > t', () => {
      const rw = new RandomWalk(0.5)
      assert.strictEqual(rw.pdf(3, 2), 0)
    })

    it('should return 0 when x and t have different parity', () => {
      const rw = new RandomWalk(0.5)
      // t=4 (even), x=1 (odd) — unreachable
      assert.strictEqual(rw.pdf(1, 4), 0)
    })

    it('should return 1 at x=0, t=0 (initial point mass)', () => {
      const rw = new RandomWalk(0.5)
      assert.strictEqual(rw.pdf(0, 0), 1)
    })

    it('should return 0 at x=1, t=0', () => {
      const rw = new RandomWalk(0.5)
      assert.strictEqual(rw.pdf(1, 0), 0)
    })

    it('should return exact binomial PMF for p=0.5, t=4, x=0', () => {
      const rw = new RandomWalk(0.5)
      // exact rational: C(4,2)*0.5^4 = 6/16 = 0.375
      assert.closeTo(rw.pdf(0, 4), 0.375, 1e-10)
    })

    it('should return exact binomial PMF for p=0.5, t=4, x=2', () => {
      const rw = new RandomWalk(0.5)
      // exact rational: C(4,3)*0.5^4 = 4/16 = 0.25
      assert.closeTo(rw.pdf(2, 4), 0.25, 1e-10)
    })

    it('should return exact binomial PMF for p=0.6, t=3, x=1', () => {
      const rw = new RandomWalk(0.6)
      // exact rational: C(3,2)*0.6^2*0.4 = 3*0.36*0.4 = 0.432
      assert.closeTo(rw.pdf(1, 3), 0.432, 1e-10)
    })

    it('should return exact binomial PMF for p=0.7, t=5, x=3', () => {
      const rw = new RandomWalk(0.7)
      // exact rational: C(5,4)*0.7^4*0.3 = 5*0.2401*0.3 = 0.36015
      assert.closeTo(rw.pdf(3, 5), 0.36015, 1e-10)
    })

    it('should sum to 1 over all reachable states at t=6', () => {
      const rw = new RandomWalk(0.4)
      let total = 0
      for (let x = -6; x <= 6; x += 2) total += rw.pdf(x, 6)
      // exact rational: sum of all binomial probabilities = 1
      assert.closeTo(total, 1, 1e-10)
    })
  })

  describe('.covariogram()', () => {
    it('should return 4p(1-p)*min(s,t) for symmetric walk', () => {
      const rw = new RandomWalk(0.5)
      // exact rational: 4*0.5*0.5*min(3,5) = 3
      assert.closeTo(rw.covariogram(3, 5), 3, 1e-10)
    })

    it('should return 4p(1-p)*min(s,t) for biased walk', () => {
      const rw = new RandomWalk(0.7)
      // exact rational: 4*0.7*0.3*min(2,4) = 4*0.21*2 = 1.68
      assert.closeTo(rw.covariogram(2, 4), 1.68, 1e-10)
    })

    it('should be symmetric', () => {
      const rw = new RandomWalk(0.7)
      assert.closeTo(rw.covariogram(2, 4), rw.covariogram(4, 2), 1e-10)
    })

    it('should equal variance at s = t', () => {
      const rw = new RandomWalk(0.6)
      assert.closeTo(rw.covariogram(5, 5), rw.variance(5), 1e-10)
    })

    it('should return NaN for s < 0', () => {
      const rw = new RandomWalk(0.5)
      assert(Number.isNaN(rw.covariogram(-1, 2)))
    })

    it('should return NaN for t < 0', () => {
      const rw = new RandomWalk(0.5)
      assert(Number.isNaN(rw.covariogram(2, -1)))
    })
  })

  describe('.reset()', () => {
    it('should restore initial state to 0', () => {
      const rw = new RandomWalk(0.5)
      rw.seed(42)
      for (let i = 0; i < 10; i++) rw.next()
      rw.reset()
      assert.strictEqual(rw.state(), 0)
    })
  })

  describe('step distribution', () => {
    it('should produce +1/-1 steps matching Bernoulli(p) (chi-squared test)', () => {
      const p = 0.7
      const rw = new RandomWalk(p)
      rw.seed(42)
      const n = 2000
      const steps = []
      for (let i = 0; i < n; i++) {
        const prev = rw.state()
        rw.next()
        steps.push(rw.state() - prev)
      }
      // step ∈ {-1, +1}: model(-1) = 1-p, model(1) = p; c=1 estimated parameter
      assert(chiTest(steps, k => k === 1 ? p : (1 - p), 1))
    })
  })
})
