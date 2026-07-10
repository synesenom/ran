import { assert } from 'chai'
import { describe, it } from 'mocha'
import validateParams from '../src/utils/validate-params'

describe('utils', () => {
  describe('validateParams', () => {
    describe('missing parameter detection', () => {
      it('should throw if a parameter is undefined', () => {
        assert.throws(() => validateParams({ x: undefined }, []), /missing or not a number/)
      })

      it('should throw if a parameter is null', () => {
        assert.throws(() => validateParams({ x: null }, []), /missing or not a number/)
      })

      it('should throw if a parameter is NaN', () => {
        assert.throws(() => validateParams({ x: NaN }, []), /missing or not a number/)
      })

      it('should include all missing parameter names in the error message', () => {
        assert.throws(() => validateParams({ x: undefined, y: null, z: 1 }, []), /x.*y|y.*x/)
      })
    })

    describe('constraint operators', () => {
      it('should throw when < is violated', () => {
        assert.throws(() => validateParams({ x: 2 }, ['x < 2']), /constraints/)
      })

      it('should not throw when < is satisfied', () => {
        assert.doesNotThrow(() => validateParams({ x: 1 }, ['x < 2']))
      })

      it('should throw when <= is violated', () => {
        assert.throws(() => validateParams({ x: 3 }, ['x <= 2']), /constraints/)
      })

      it('should not throw when <= is satisfied at boundary', () => {
        assert.doesNotThrow(() => validateParams({ x: 2 }, ['x <= 2']))
      })

      it('should throw when > is violated', () => {
        assert.throws(() => validateParams({ x: 0 }, ['x > 0']), /constraints/)
      })

      it('should not throw when > is satisfied', () => {
        assert.doesNotThrow(() => validateParams({ x: 1 }, ['x > 0']))
      })

      it('should throw when >= is violated', () => {
        assert.throws(() => validateParams({ x: -1 }, ['x >= 0']), /constraints/)
      })

      it('should not throw when >= is satisfied at boundary', () => {
        assert.doesNotThrow(() => validateParams({ x: 0 }, ['x >= 0']))
      })

      it('should throw when != is violated', () => {
        assert.throws(() => validateParams({ x: 0 }, ['x != 0']), /constraints/)
      })

      it('should not throw when != is satisfied', () => {
        assert.doesNotThrow(() => validateParams({ x: 1 }, ['x != 0']))
      })
    })

    describe('constraint tokens', () => {
      it('should resolve literal numbers on the right-hand side', () => {
        assert.doesNotThrow(() => validateParams({ mu: 2 }, ['mu > 0']))
        assert.throws(() => validateParams({ mu: -1 }, ['mu > 0']))
      })

      it('should resolve param names on both sides', () => {
        assert.doesNotThrow(() => validateParams({ a: 1, b: 2 }, ['a < b']))
        assert.throws(() => validateParams({ a: 3, b: 2 }, ['a < b']))
      })

      it('should validate multiple constraints independently', () => {
        assert.doesNotThrow(() => validateParams({ mu: 0, sigma: 1 }, ['sigma > 0']))
        assert.throws(() => validateParams({ mu: 0, sigma: -1 }, ['sigma > 0']))
      })
    })

    describe('valid input', () => {
      it('should not throw when all params are present and all constraints satisfied', () => {
        assert.doesNotThrow(() => validateParams({ mu: 0, sigma: 1 }, ['sigma > 0']))
      })

      it('should not throw with empty constraints array', () => {
        assert.doesNotThrow(() => validateParams({ x: 42 }, []))
      })
    })
  })
})
