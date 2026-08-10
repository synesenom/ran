import { assert } from 'chai'
import { describe, it } from 'mocha'
import Process from '../../src/process/_process'
import BrownianMotion from '../../src/process/brownian-motion'

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

class ArrayParamProcess extends Process {
  constructor (weights) {
    super()
    this.p = { weights }
    this.x = 0
    this.x0 = 0
  }

  _next () {
    return this.x + 1
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

    describe('.marginal()', () => {
      it('should throw when not implemented', () => {
        const p = new BareProcess()
        assert.throws(() => p.marginal(1), 'Process.marginal() is not implemented')
      })
    })

    describe('.lnL()', () => {
      it('should throw when the transition density is not implemented', () => {
        const p = new BareProcess()
        assert.throws(() => p.lnL([0, 1]), 'Process._transitionLnPdf() is not implemented')
      })

      it('should throw when path has fewer than 2 states', () => {
        const p = new BareProcess()
        assert.throws(() => p.lnL([0]), /at least 2 states/)
      })

      it('should throw when path is not an array', () => {
        const p = new BareProcess()
        assert.throws(() => p.lnL(null), /at least 2 states/)
      })
    })

    describe('.fit()', () => {
      it('should throw when not implemented', () => {
        assert.throws(() => BareProcess.fit([0, 1, 2]), 'Process.fit() is not implemented')
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

    describe('.params()', () => {
      it('should return the parameter object', () => {
        const bm = new BrownianMotion(0.5, 1, 2)
        assert.deepEqual(bm.params(), { mu: 0.5, sigma: 1, dt: 2 })
      })

      it('should return an empty object for a process with no parameters', () => {
        const p = new StubProcess()
        assert.deepEqual(p.params(), {})
      })

      it('should return a shallow copy, not the live this.p reference', () => {
        const bm = new BrownianMotion(0.5, 1, 2)
        assert.notStrictEqual(bm.params(), bm.p)
      })

      it('mutating the returned object should not corrupt the instance', () => {
        const bm = new BrownianMotion(0.5, 1, 2)
        const p = bm.params()
        p.mu = 999
        assert.strictEqual(bm.params().mu, 0.5)
      })

      it('mutating an array-valued field of the returned object should not corrupt the instance', () => {
        const ap = new ArrayParamProcess([1, 2, 3])
        const p = ap.params()
        p.weights[0] = 999
        assert.deepEqual(ap.params().weights, [1, 2, 3])
      })
    })
  })
})
