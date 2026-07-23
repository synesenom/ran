import { assert } from 'chai'
import { before, describe, it } from 'mocha'
import { float } from '../src/core'
import * as dist from '../src/dist'
import PreComputed from '../src/dist/_pre-computed'

describe('dist', () => {
  describe('PreComputed', () => {
    class PreComputedTestClass extends PreComputed {}
    const preComputed = new PreComputedTestClass()

    it('should throw error if _pk is not overridden', () => {
      assert.throws(() => {
        preComputed._pk()
      }, 'PreComputed._pk() is not implemented')
    })

    it('should clamp _cdf to 1 on cache-hit path when PMFs sum to 1+epsilon', () => {
      // Subclass whose PMFs sum to slightly above 1 (simulating floating-point rounding)
      class OverflowPMF extends PreComputed {
        _pk () { return 0.5 + 1e-15 }
      }
      const d = new OverflowPMF()
      // Warm up cache by accessing index 1 (fills cdfTable[0] and cdfTable[1])
      d._cdf(1)
      // cdfTable[0] = 0.5+eps, cdfTable[1] ≈ 1 + 2eps > 1; re-reading from cache must still return ≤ 1
      assert.isAtMost(d._cdf(0), 1)
      assert.isAtMost(d._cdf(1), 1)
    })

    it('_generator returns NaN when all alias tables are exhausted (zero-probability PMF)', () => {
      // _pk returns 0 for every k, so every alias table always routes to the overflow slot (TABLE_SIZE).
      // After MAX_NUMBER_OF_TABLES tables the do-while exits without sampling, and must return NaN not undefined.
      class ZeroMassDist extends PreComputed {
        _pk () { return 0 }
      }
      const d = new ZeroMassDist()
      assert(Number.isNaN(d._generator()))
    })
  })

  // Degenerate is not covered by dist-cases.js (special-cased below) — verify constructor throws on missing params per issue #50.
  describe('Degenerate', () => {
    describe('constructor', () => {
      it('should throw error if no parameters are provided', () => {
        assert.throws(() => new dist.Degenerate())
      })
    })

    describe('moments', () => {
      it('mean should equal x0', () => {
        assert.strictEqual(new dist.Degenerate(3).mean(), 3)
        assert.strictEqual(new dist.Degenerate(-1.5).mean(), -1.5)
      })

      it('variance should be 0', () => {
        assert.strictEqual(new dist.Degenerate(3).variance(), 0)
      })

      it('skewness should be NaN (0/0 at point mass)', () => {
        assert(Number.isNaN(new dist.Degenerate(3).skewness()))
      })

      it('kurtosis should be NaN (0/0 at point mass)', () => {
        assert(Number.isNaN(new dist.Degenerate(3).kurtosis()))
      })
    })

    describe('.q()', () => {
      it('quantile should return x0 for all probabilities', () => {
        assert.strictEqual(new dist.Degenerate(5).q(0), 5)
        assert.strictEqual(new dist.Degenerate(5).q(0.5), 5)
        assert.strictEqual(new dist.Degenerate(5).q(1), 5)
        assert.strictEqual(new dist.Degenerate(-2).q(0.1), -2)
        assert.strictEqual(new dist.Degenerate(0).q(0.99), 0)
      })
    })
  })

  // Kolmogorov: open lower boundary — x=0 is outside the support (x>0) and must return 0.
  describe('Kolmogorov', () => {
    const k = new dist.Kolmogorov()

    describe('.pdf()', () => {
      it('should return 0 at the open lower boundary x = 0', () => {
        assert.equal(k.pdf(0), 0)
      })
    })

    describe('.cdf()', () => {
      it('should return 0 at the open lower boundary x = 0', () => {
        assert.equal(k.cdf(0), 0)
      })
    })

    describe('.survival()', () => {
      it('should return 1 at the open lower boundary x = 0', () => {
        assert.equal(k.survival(0), 1)
      })
    })
  })

  // Base class helper: _qEstimateWalk.
  describe('Distribution._qEstimateWalk', () => {
    // Poisson(5) reference values:
    //   ppf(0.1) = 2   cdf(2)=0.12465  cdf(1)=0.04043
    //   ppf(0.5) = 5   cdf(5)=0.61596  cdf(4)=0.44049
    //   ppf(0.9) = 8   cdf(8)=0.93191  cdf(7)=0.86663
    let d
    before(() => { d = new dist.Poisson(5) })

    it('should walk up from a start below the quantile', () => {
      assert.strictEqual(d._qEstimateWalk(0.9, 0), 8)
    })

    it('should walk down from a start above the quantile', () => {
      assert.strictEqual(d._qEstimateWalk(0.1, 20), 2)
    })

    it('should return immediately when start already satisfies the invariant', () => {
      assert.strictEqual(d._qEstimateWalk(0.5, 5), 5)
    })

    it('should walk up from a negative start', () => {
      assert.strictEqual(d._qEstimateWalk(0.5, -10), 5)
    })

    it('should return lower support boundary when p=0', () => {
      assert.strictEqual(d._qEstimateWalk(0, 5), 0)
    })

    it('should return upper support boundary when p=1', () => {
      assert.strictEqual(d._qEstimateWalk(1, 5), Infinity)
    })
  })

  // Degenerate distribution.
  describe('Degenerate', () => {
    describe('.sample()', () => {
      describe('random parameters', () => {
        it('should generate values with Degenerate distribution', () => {
          const x0 = float()
          const degenerate = new dist.Degenerate(x0)
          degenerate.sample(10).forEach(d => {
            assert(d === x0)
          })
        })
      })
    })

    describe('.pdf(), .cdf()', () => {
      describe('random parameters', () => {
        it('differentiating cdf should give pdf', () => {
          const x0 = float()
          const degenerate = new dist.Degenerate(x0)
          assert.equal(degenerate.pdf(x0), 1)
          assert.equal(degenerate.pdf(x0 + 1), 0) // fixed offset guarantees argument != x0
          assert.equal(degenerate.cdf(x0 - 1), 0) // fixed offset guarantees argument < x0
          assert.equal(degenerate.cdf(x0), 1)
          assert.equal(degenerate.cdf(x0 + Math.random()), 1)
        })
      })
    })
  })

  // Regression #1075: DoublyNoncentralBeta/F pdf/cdf returned NaN once both non-centrality
  // parameters were large (Beta(alpha+r0, beta+s0) underflows to exact 0 in double precision
  // when r0=round(lambda1/2), s0=round(lambda2/2) are both large). Checked directly here
  // (bypassing dist-runner.js's full per-case suite) because quantile root-finding at this
  // scale costs ~1s/call (MAX_ITER=100-bounded series, #1063) — too expensive to run through
  // qMonotonicity/qGalois/quantileRoundtrip for every lambda value in the acceptance criteria.
  // cdf monotonicity is checked here too (free — same x values, ascending order already):
  // structurally sound regardless of series-truncation accuracy, since each Poisson-weighted term
  // is individually monotonic in x and truncation only drops mass, it doesn't invert ordering.
  // A cdf(0.5+x)+cdf(0.5-x)=1 symmetry check (valid here since alpha=beta and lambda1=lambda2) is
  // added separately below, once per lambda value at a scale-appropriate tolerance: #1086 fixed
  // the truncation that previously broke this by orders of magnitude (e.g. lambda=8000:
  // cdf(0.5+x)+cdf(0.5-x) as low as 0.886, not ~1), but accuracy still degrades gradually at the
  // most extreme end of this range (lambda=50000 is accurate only to ~3e-3, not machine
  // precision) — a residual, documented limitation of the bounded series-summation cap, not a
  // regression of #1086's fix.
  //
  // Shared by the four cases below: constructs `new dist[name](...params)` for each entry in
  // `lambdaCases` and walks `xValues` in ascending order, asserting pdf/cdf stay finite and
  // in-range (and, when `checkMonotonic` is set, that cdf never decreases).
  function assertFinitePdfCdf (name, lambdaCases, xValues, checkMonotonic) {
    for (const params of lambdaCases) {
      const d = new dist[name](...params)
      let prevCdf = -Infinity
      for (const x of xValues) {
        const pdf = d.pdf(x)
        const cdf = d.cdf(x)
        assert(Number.isFinite(pdf) && pdf >= 0, `pdf(${x}; params=${params}) = ${pdf}`)
        assert(Number.isFinite(cdf) && cdf >= 0 && cdf <= 1, `cdf(${x}; params=${params}) = ${cdf}`)
        if (checkMonotonic) {
          assert(cdf >= prevCdf, `cdf(${x}; params=${params}) = ${cdf} < previous ${prevCdf}`)
          prevCdf = cdf
        }
      }
    }
  }

  describe('DoublyNoncentralBeta/F large lambda (regression #1075)', () => {
    it('DoublyNoncentralBeta pdf/cdf should be finite and cdf monotonic for lambda1 = lambda2 up to 50000', () => {
      const lambdaCases = [1200, 8000, 20000, 50000].map(lambda => [2, 2, lambda, lambda])
      assertFinitePdfCdf('DoublyNoncentralBeta', lambdaCases, [0.001, 0.1, 0.3, 0.5, 0.7, 0.9, 0.999], true)
    })

    // cdf(0.5+x)+cdf(0.5-x)=1 by symmetry (alpha=beta, lambda1=lambda2); tolerance loosens with
    // lambda since the bounded series-summation cap (#1086) covers proportionally less of the
    // shifted-peak tail as lambda grows — see the comment above assertFinitePdfCdf.
    it('DoublyNoncentralBeta cdf should be symmetric around 0.5 for lambda1 = lambda2 up to 20000', () => {
      const cases = [
        { lambda: 1200, tol: 1e-9 },
        { lambda: 8000, tol: 1e-8 },
        { lambda: 20000, tol: 1e-4 }
      ]
      for (const { lambda, tol } of cases) {
        const d = new dist.DoublyNoncentralBeta(2, 2, lambda, lambda)
        for (const dx of [0.001, 0.1, 0.3]) {
          const sum = d.cdf(0.5 + dx) + d.cdf(0.5 - dx)
          assert.approximately(sum, 1, tol, `lambda=${lambda}, dx=${dx}: cdf(0.5+dx)+cdf(0.5-dx)=${sum}`)
        }
      }
    })

    // Asymmetric pair: r0 (~lambda1/2) and s0 (~lambda2/2) operate at very different scales,
    // exercising the outer r-loop and inner s-recurrence independently rather than in lockstep.
    it('DoublyNoncentralBeta pdf/cdf should be finite for asymmetric large lambda1/lambda2', () => {
      const lambdaCases = [[2, 2, 50000, 10], [2, 2, 10, 50000]]
      assertFinitePdfCdf('DoublyNoncentralBeta', lambdaCases, [0.001, 0.1, 0.5, 0.9, 0.999], false)
    })

    it('DoublyNoncentralF pdf/cdf should be finite and cdf monotonic for lambda1 = lambda2 up to 50000', () => {
      const lambdaCases = [1200, 2000, 8000, 20000, 50000].map(lambda => [5, 5, lambda, lambda])
      assertFinitePdfCdf('DoublyNoncentralF', lambdaCases, [0.001, 0.5, 1, 2, 4, 100], true)
    })

    it('DoublyNoncentralF pdf/cdf should be finite for asymmetric large lambda1/lambda2', () => {
      const lambdaCases = [[5, 5, 50000, 10], [5, 5, 10, 50000]]
      assertFinitePdfCdf('DoublyNoncentralF', lambdaCases, [0.001, 0.5, 1, 2, 4, 100], false)
    })
  })

  // Regression #1084: DoublyNoncentralF's constructor documents d1/d2 as rounded to the nearest
  // integer, and .params() reports the rounded values, but pdf()/cdf()/sample() must be computed
  // from those SAME rounded values, not from the raw un-rounded constructor arguments. Checked by
  // comparing a non-integer-constructed instance directly against the equivalent
  // already-integer-constructed instance (self-consistency), rather than against new external
  // reference values — the rounded case is already covered by test/dist-cases-continuous.js.
  describe('DoublyNoncentralF non-integer d1/d2 internal consistency (regression #1084)', () => {
    it('params() should report d1/d2 rounded to the nearest integer', () => {
      const d = new dist.DoublyNoncentralF(3.7, 8.2, 1, 2)
      assert.deepEqual(d.params(), { d1: 4, d2: 8, lambda1: 1, lambda2: 2 })
    })

    it('pdf/cdf of a non-integer-constructed instance should match the rounded-equivalent instance', () => {
      const raw = new dist.DoublyNoncentralF(3.7, 8.2, 1, 2)
      const rounded = new dist.DoublyNoncentralF(4, 8, 1, 2)
      ;[0.5, 1, 2, 5].forEach(x => {
        assert.strictEqual(raw.pdf(x), rounded.pdf(x), `pdf(${x})`)
        assert.strictEqual(raw.cdf(x), rounded.cdf(x), `cdf(${x})`)
      })
    })

    it('sample() of a non-integer-constructed instance should match the rounded-equivalent instance for the same seed', () => {
      const raw = new dist.DoublyNoncentralF(3.7, 8.2, 1, 2).seed(123456789)
      const rounded = new dist.DoublyNoncentralF(4, 8, 1, 2).seed(123456789)
      const values1 = raw.sample(50)
      const values2 = rounded.sample(50)
      assert(values1.every((v, i) => v === values2[i]))
    })

    it('save() + load() should reproduce identical pdf/cdf/sample output for non-integer d1/d2', () => {
      const original = new dist.DoublyNoncentralF(3.7, 8.2, 1, 2).seed(123456789)
      const xValues = [0.5, 1, 2, 5]
      const pdfBefore = xValues.map(x => original.pdf(x))
      const cdfBefore = xValues.map(x => original.cdf(x))
      const state = original.save()
      const sampleBefore = original.sample(20)

      const restored = dist.DoublyNoncentralF.load(state)
      const pdfAfter = xValues.map(x => restored.pdf(x))
      const cdfAfter = xValues.map(x => restored.cdf(x))
      const sampleAfter = restored.sample(20)

      assert.deepEqual(pdfAfter, pdfBefore)
      assert.deepEqual(cdfAfter, cdfBefore)
      assert.deepEqual(sampleAfter, sampleBefore)
    })
  })
})
