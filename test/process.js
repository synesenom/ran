import { assert } from 'chai'
import { describe, it } from 'mocha'
import Process from '../src/process/_process'
import BrownianBridge from '../src/process/brownian-bridge'
import BrownianMotion from '../src/process/brownian-motion'
import GeometricBrownianMotion from '../src/process/geometric-brownian-motion'
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

    describe('.covariogram()', () => {
      it('should throw when not implemented', () => {
        const p = new BareProcess()
        assert.throws(() => p.covariogram(1, 2), 'Process.covariogram() is not implemented')
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

  describe('.covariogram()', () => {
    it('should return exp(mu*(s+t)) * (exp(sigma^2*min(s,t)) - 1)', () => {
      const mu = 0.05; const sigma = 0.2; const s = 1; const t = 3
      const gbm = new GeometricBrownianMotion(mu, sigma, 1)
      const expected = Math.exp(mu * (s + t)) * (Math.exp(sigma * sigma * Math.min(s, t)) - 1)
      assert.closeTo(gbm.covariogram(s, t), expected, 1e-10)
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

  describe('.covariogram()', () => {
    it('should return (sigma^2/2theta)*(exp(-theta*|t-s|) - exp(-theta*(t+s)))', () => {
      const theta = 2; const sigma = 0.5; const s = 1; const t = 3
      const ou = new OrnsteinUhlenbeck(theta, 0, sigma, 0.1)
      const expected = (sigma * sigma / (2 * theta)) * (Math.exp(-theta * Math.abs(t - s)) - Math.exp(-theta * (t + s)))
      assert.closeTo(ou.covariogram(s, t), expected, 1e-10)
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
