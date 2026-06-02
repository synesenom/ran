import { assert } from 'chai'
import { describe, it } from 'mocha'
import { repeat } from './test-utils'
import { lambertW0 } from '../src/special/lambert-w'
import * as algorithms from '../src/algorithms'
import { int } from '../src/core'

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

  describe('.chandrupatla()', () => {
    it('should throw if brackets have the same sign', () => {
      const c = 5
      assert.throws(() => algorithms.chandrupatla(
        t => t * Math.exp(t) - c,
        lambertW0(c) + 1,
        lambertW0(c) + 2
      ))
    })
    it('should find the solution of exp(-x) = c x', () => {
      repeat(() => {
        const c = Math.random() * 10
        const sol = algorithms.chandrupatla(
          t => t * Math.exp(t) - c,
          lambertW0(c) - 1,
          lambertW0(c) + 1
        )
        assert(Math.abs((sol - lambertW0(c)) / sol) < PRECISION)
      }, LAPS)
    })
    it('should find roots near zero correctly', () => {
      const sol = algorithms.chandrupatla(t => t, -1, 1)
      assert(Math.abs(sol) < 1e-10)
    })
    it('should return the endpoint when it is an exact root', () => {
      assert.equal(algorithms.chandrupatla(t => t, 0, 1), 0)
      assert.equal(algorithms.chandrupatla(t => t - 1, 0, 1), 1)
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

    it('should converge to root at zero using hybrid stopping criterion', () => {
      // |dx/x| = NaN when x = 0; hybrid criterion avoids the division
      const sol = algorithms.newton(t => t, () => 1, 1)
      assert(Math.abs(sol) < PRECISION)
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

  describe('.introselect()', () => {
    it('should select the k-th element across the full index range', () => {
      repeat(() => {
        const values = Array.from({ length: 100 }, Math.random)
        const k = int(0, 99)
        const sorted = [...values].sort((a, b) => a - b)
        assert(algorithms.introselect([...values], k) === sorted[k])
      }, LAPS)
    })

    it('should select minimum (k=0) and maximum (k=n-1)', () => {
      const values = [3, 1, 4, 1, 5, 9, 2, 6]
      const sorted = [...values].sort((a, b) => a - b)
      assert.equal(algorithms.introselect([...values], 0), sorted[0])
      assert.equal(algorithms.introselect([...values], values.length - 1), sorted[values.length - 1])
    })

    it('should select correctly in large arrays (exercises Floyd-Rivest sampling branch)', () => {
      const n = 1000
      const values = Array.from({ length: n }, Math.random)
      const sorted = [...values].sort((a, b) => a - b)
      const k = int(0, n - 1)
      assert.equal(algorithms.introselect([...values], k), sorted[k])
    })

    it('should handle arrays with duplicate values', () => {
      const values = [1, 1, 1, 2, 1]
      assert.equal(algorithms.introselect([...values], 2), 1)
      assert.equal(algorithms.introselect([...values], 3), 1)
      assert.equal(algorithms.introselect([...values], 4), 2)
    })

    it('should throw for out-of-range k', () => {
      const values = [1, 2, 3]
      assert.throws(() => algorithms.introselect(values, -1))
      assert.throws(() => algorithms.introselect(values, 3))
    })
  })

  describe('.powell()', () => {
    it('should minimise a 1D quadratic', () => {
      const result = algorithms.powell(x => (x[0] - 3) ** 2, [0])
      assert(Math.abs(result[0] - 3) < 1e-6)
    })

    it('should minimise a 2D quadratic', () => {
      const result = algorithms.powell(x => (x[0] - 2) ** 2 + (x[1] - 5) ** 2, [0, 0])
      assert(Math.abs(result[0] - 2) < 1e-6)
      assert(Math.abs(result[1] - 5) < 1e-6)
    })

    it('should minimise the Rosenbrock function', () => {
      const rosenbrock = x => 100 * (x[1] - x[0] ** 2) ** 2 + (1 - x[0]) ** 2
      const result = algorithms.powell(rosenbrock, [-1.2, 1])
      assert(Math.abs(result[0] - 1) < 1e-3)
      assert(Math.abs(result[1] - 1) < 1e-3)
    })

    it('should minimise an off-axis quadratic (exercises conjugate-direction update)', () => {
      // Minimum 0 at x0=1, x1=2; the cross term forces non-coordinate (conjugate) directions.
      const f = x => (x[0] + x[1] - 3) ** 2 + (x[0] - x[1] + 1) ** 2
      const result = algorithms.powell(f, [5, -4])
      assert(f(result) < 1e-8)
      assert(Math.abs(result[0] - 1) < 1e-4)
      assert(Math.abs(result[1] - 2) < 1e-4)
    })

    it('should not stall when the objective is an Infinity barrier outside a feasible region', () => {
      // Mirrors the MLE objective: invalid (negative) inputs return Infinity. A derivative-free
      // line search must still locate the constrained minimum at the boundary-adjacent optimum.
      const f = x => (x[0] <= 0 || x[1] <= 0) ? Infinity : (x[0] - 0.5) ** 2 + (x[1] - 3) ** 2
      const result = algorithms.powell(f, [1, 1])
      assert(Math.abs(result[0] - 0.5) < 1e-4)
      assert(Math.abs(result[1] - 3) < 1e-4)
    })

    it('should respect maxIter option and return without throwing', () => {
      const result = algorithms.powell(x => (x[0] - 3) ** 2, [0], { maxIter: 1 })
      assert(Array.isArray(result))
      assert(result.length === 1)
    })
  })

  describe('.tanhSinh()', () => {
    it('should integrate x^2 over [0, 1]', () => {
      const result = algorithms.tanhSinh(x => x * x, 0, 1)
      assert(Math.abs(result - 1 / 3) < PRECISION)
    })

    it('should integrate sqrt(x) over [0, 1] (infinite derivative at endpoint)', () => {
      // sqrt(x) has f'(0) = Infinity; tanh-sinh handles this where trapezoidal struggles.
      const result = algorithms.tanhSinh(x => Math.sqrt(x), 0, 1)
      assert(Math.abs(result - 2 / 3) < PRECISION)
    })

    it('should return 0 for a degenerate interval (a = b)', () => {
      // Exercises the newTerms.length > 0 guard: all weights are 0 when halfLen = 0.
      const result = algorithms.tanhSinh(x => x * x, 3, 3)
      assert(result === 0)
    })

    it('should negate the integral for a reversed interval (b < a)', () => {
      const forward = algorithms.tanhSinh(x => x * x, 0, 1)
      const reversed = algorithms.tanhSinh(x => x * x, 1, 0)
      assert(Math.abs(forward + reversed) < PRECISION)
    })
  })

  describe('.recursiveSum()', () => {
    it('should sum a geometric series correctly', () => {
      // Σ_{k=0}^∞ (0.5)^k = 1/(1-0.5) = 2
      const result = algorithms.recursiveSum(
        { term: 1 },
        t => ({ term: t.term * 0.5 }),
        t => t.term
      )
      assert(Math.abs(result - 2) < PRECISION)
    })

    it('should converge when the running sum is near zero due to alternating signs', () => {
      // Alternating geometric series: Σ_{k=0}^∞ (-0.5)^k = 1/(1+0.5) = 2/3.
      // Running partial sums oscillate through small values near the true limit 2/3.
      // A pure relative criterion |delta/sum| < EPS can fire prematurely when sum
      // passes near zero; the hybrid criterion |delta| < EPS*max(|sum|,1) is stable.
      const result = algorithms.recursiveSum(
        { term: 1 },
        t => ({ term: -t.term * 0.5 }),
        t => t.term
      )
      assert(Math.abs(result - 2 / 3) < PRECISION)
    })

    it('should converge for a series whose sum is far below 1', () => {
      // Geometric series with a small initial term: Σ_{k=0}^∞ s*(0.5)^k = 2s.
      // With |sum| < 1 the hybrid criterion uses EPS*1 as the absolute floor,
      // so the loop exits once individual terms fall below machine epsilon,
      // rather than requiring them to fall below EPS*sum (a far tighter demand).
      const s = 1e-6
      const result = algorithms.recursiveSum(
        { term: s },
        t => ({ term: t.term * 0.5 }),
        t => t.term
      )
      assert(Math.abs(result - 2 * s) / (2 * s) < 1e-6)
    })
  })
})
