import { assert } from 'chai'
import { describe, it } from 'mocha'
import { repeat } from './test-utils'
import { lambertW0 } from '../src/special/lambert-w'
import * as algorithms from '../src/algorithms'
import { int, shuffle } from '../src/core'

const LAPS = 100
const PRECISION = 1e-10

describe('algorithms', () => {
  describe('.bracket()', () => {
    it('should return NaN if initial bracket is invalid', () => {
      repeat(() => {
        const c = Math.random() * 10
        const bracket = algorithms.bracket(
          t => t * Math.exp(t) - c,
          lambertW0(c) + 1,
          lambertW0(c) + 1
        )
        assert(Number.isNaN(bracket))
      }, LAPS)
    })

    it('should find an appropriate bracket for exp(-x) = c x', () => {
      repeat(() => {
        const c = Math.random() * 10
        const bracket = algorithms.bracket(
          t => t * Math.exp(t) - c,
          lambertW0(c) + 1,
          lambertW0(c) + 2
        )
        assert(bracket[0] * Math.exp(bracket[0]) < c && bracket[1] * Math.exp(bracket[1]) > c)
      }, LAPS)
    })

    it('should return the specified boundaries if root was not found', () => {
      const bracket = algorithms.bracket(
        t => 1,
        0,
        2
      )
      assert.strictEqual(bracket[0], 0)
      assert.strictEqual(bracket[1], 2)

      const reverseBracket = algorithms.bracket(
        t => 1,
        -2,
        0
      )
      assert.strictEqual(reverseBracket[0], -2)
      assert.strictEqual(reverseBracket[1], 0)
    })
  })

  describe('.brent()', () => {
    it('should return NaN if brackets are wrong', () => {
      const c = 5
      const sol = algorithms.brent(
        t => t * Math.exp(t) - c,
        lambertW0(c) + 1,
        lambertW0(c) + 2
      )
      assert(Number.isNaN(sol))
    })
    it('should find the solution of exp(-x) = c x', () => {
      repeat(() => {
        const c = Math.random() * 10
        const sol = algorithms.brent(
          t => t * Math.exp(t) - c,
          lambertW0(c) - 1,
          lambertW0(c) + 1
        )
        assert(Math.abs((sol - lambertW0(c)) / sol) < PRECISION)
      }, LAPS)
    })
  })

  describe('.newton()', () => {
    it('should find the solution of exp(-x) = c x', () => {
      repeat(() => {
        const c = Math.random() * 10
        const sol = algorithms.newton(
          t => t * Math.exp(t) - c,
          t => Math.exp(t) * (1 + t),
          Math.random() * 10
        )
        assert(Math.abs((sol - lambertW0(c)) / sol) < PRECISION)
      }, LAPS)
    })

    it('should find the solution of exp(x) - 1 = x', () => {
      repeat(() => {
        const sol = algorithms.newton(
          t => Math.exp(t) - t - 1,
          t => Math.exp(t) - 1,
          0
        )
        assert(Math.abs(sol) < PRECISION)
      })
    })
  })

  describe('.neumaier()', () => {
    it('should sum integers', () => {
      repeat(() => {
        const n = Math.floor(2 + Math.random() * 100)
        assert.equal(
          algorithms.neumaier(Array.from({ length: n + 1 }, (d, i) => i)),
          n * (n + 1) / 2
        )
      }, LAPS)
    })

    it('should sum powers of 5', () => {
      repeat(() => {
        const n = Math.floor(2 + Math.random() * 100)

        const a = n * (n + 1) / 2
        assert.equal(
          algorithms.neumaier(Array.from({ length: n + 1 }, (d, i) => i * i * i * i * i)),
          (4 * a * a * a - a * a) / 3
        )
      }, LAPS)
    })

    it('should not mutate the input array', () => {
      const arr = [3, 1, 2]
      assert.equal(algorithms.neumaier(arr), 6)
      assert.deepEqual(arr, [3, 1, 2])
    })

    it('should return -Infinity when input contains -Infinity', () => {
      assert.equal(algorithms.neumaier([-Infinity, 1, 2, 3]), -Infinity)
    })

    it('should return Infinity when input contains Infinity', () => {
      assert.equal(algorithms.neumaier([Infinity, 1, 2, 3]), Infinity)
    })

    it('should return NaN for indeterminate -Infinity + Infinity', () => {
      assert(Number.isNaN(algorithms.neumaier([-Infinity, Infinity])))
    })
  })

  describe('romberg()', () => {
    it('should integrate the function x^3 exp(-x)', () => {
      const integral = t => Math.exp(-t) * (-t * (t * (t + 3) + 6) - 6) + 6
      for (let b = 0.1; b < 10; b++) {
        const i = algorithms.romberg(
          t => Math.pow(t, 3) * Math.exp(-t),
          0,
          b
        )
        assert(Math.abs((i - integral(b)) / i) < PRECISION)
      }
    })

    it('should compute ∫sin(x)dx = 2 over [0,π] to machine precision', () => {
      // Regression guard for the j=POLYNOMIAL_ORDER-1 off-by-one: sin(x) on [0,π]
      // requires only a few Romberg steps. Any result worse than 1e-12 would indicate
      // the polynomial interpolation window is receiving bad data.
      const result = algorithms.romberg(t => Math.sin(t), 0, Math.PI)
      assert(Math.abs(result - 2) < 1e-12)
    })

    it('should return the best available extrapolate when budget is exhausted', () => {
      // A step-function integrand (true integral 1.7) defeats Richardson
      // extrapolation: O(1/n) trapezoid convergence cannot satisfy the O(h^2)
      // polynomial convergence criterion within MAX_STEPS. The old code returned
      // the silent sentinel 0; the fix returns the best accumulated extrapolate.
      const result = algorithms.romberg(t => t < 0.3 ? 1 : 2, 0, 1)
      assert(result !== 0)
      assert(Number.isFinite(result))
      assert(Math.abs(result - 1.7) < 1e-4)
    })
  })

  describe('.quickselect()', () => {
    it('should select the k-th element', () => {
      repeat(() => {
        const values = Array.from({ length: 100 }, Math.random)
        const k = int(50, 99)
        const item = values.sort((a, b) => a - b)[k]
        assert(algorithms.quickselect(shuffle(values), k) === item)
      }, LAPS)
    })

    it('should throw for out-of-range k', () => {
      const values = [1, 2, 3]
      assert.throws(() => algorithms.quickselect(values, -1))
      assert.throws(() => algorithms.quickselect(values, 3))
    })
  })

  describe('.nelderMead()', () => {
    it('should minimise a 1D quadratic', () => {
      const result = algorithms.nelderMead(x => (x[0] - 3) ** 2, [0])
      assert(Math.abs(result[0] - 3) < 1e-6)
    })

    it('should minimise a 2D quadratic', () => {
      const result = algorithms.nelderMead(x => (x[0] - 2) ** 2 + (x[1] - 5) ** 2, [0, 0])
      assert(Math.abs(result[0] - 2) < 1e-6)
      assert(Math.abs(result[1] - 5) < 1e-6)
    })

    it('should minimise the Rosenbrock function', () => {
      const rosenbrock = x => 100 * (x[1] - x[0] ** 2) ** 2 + (1 - x[0]) ** 2
      const result = algorithms.nelderMead(rosenbrock, [0, 0])
      assert(Math.abs(result[0] - 1) < 1e-3)
      assert(Math.abs(result[1] - 1) < 1e-3)
    })

    it('should respect maxIter option and return without throwing', () => {
      const result = algorithms.nelderMead(x => (x[0] - 3) ** 2, [0], { maxIter: 1 })
      assert(Array.isArray(result))
      assert(result.length === 1)
    })
  })

  describe('.gaussLegendre()', () => {
    it('should integrate x^2 over [0,1] exactly for n=5', () => {
      // Degree-2 polynomial, n=5 is exact for polynomials up to degree 9
      const result = algorithms.gaussLegendre(x => x * x, 0, 1, 5)
      assert(Math.abs(result - 1 / 3) < Number.EPSILON * 10)
    })

    it('should integrate x^2 over [0,1] exactly for n=10', () => {
      const result = algorithms.gaussLegendre(x => x * x, 0, 1, 10)
      assert(Math.abs(result - 1 / 3) < Number.EPSILON * 10)
    })

    it('should integrate x^2 over [0,1] exactly for n=20', () => {
      const result = algorithms.gaussLegendre(x => x * x, 0, 1, 20)
      assert(Math.abs(result - 1 / 3) < Number.EPSILON * 10)
    })

    it('should integrate exp(x) over [0,1] for all supported orders', () => {
      const exact = Math.E - 1
      for (const n of [5, 10, 20]) {
        const result = algorithms.gaussLegendre(x => Math.exp(x), 0, 1, n)
        assert(Math.abs(result - exact) < 1e-10)
      }
    })

    it('should handle a non-zero non-unit interval [a,b]', () => {
      // ∫_2^5 x dx = (25 - 4) / 2 = 10.5
      const result = algorithms.gaussLegendre(x => x, 2, 5, 5)
      assert(Math.abs(result - 10.5) < Number.EPSILON * 100)
    })
  })
})
