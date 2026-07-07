import { assert } from 'chai'
import { describe, it } from 'mocha'
import Process from '../src/process/_process'

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
