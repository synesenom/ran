import { assert } from 'chai'
import { describe, it } from 'mocha'
import * as dist from '../src/dist'
import Distribution from '../src/dist/_distribution'

describe('dist', () => {
  describe('Distribution', () => {
    describe('.fit()', () => {
      it('Distribution._powellOptions base class should return {} (no override)', () => {
        assert.deepEqual(Distribution._powellOptions(), {})
      })

      it('Frechet._fitInit should handle constant data', () => {
        // || 1 guard: all equal → zero variance in reciprocals → fallback to 1
        const init = dist.Frechet._fitInit([5, 5, 5])
        assert(init[0] > 0 && init[1] > 0)
      })

      it('Frechet._fitInit should use mean fallback when alpha <= 1', () => {
        // one near-zero and three large values → cv of reciprocals > 1 → Justus gives alpha ≤ 1
        const init = dist.Frechet._fitInit([0.0001, 1000, 1000, 1000])
        assert(init[0] > 0 && init[0] <= 1)
        assert(init[1] > 0)
      })

      it('GeneralizedExtremeValue._fitInit should return negative c for right-skewed data', () => {
        // c < 0 (Fréchet type) has heavier right tail with skewness > Gumbel limit ≈1.14
        const data = new dist.GeneralizedExtremeValue(-0.5).seed(42).sample(200)
        const init = dist.GeneralizedExtremeValue._fitInit(data)
        assert(init[0] < 0)
      })

      it('ShiftedLogLogistic._fitInit should handle odd-n data', () => {
        // odd-n path: median = sorted[(n-1)/2]
        const init = dist.ShiftedLogLogistic._fitInit([1, 2, 3, 4, 5])
        assert(Number.isFinite(init[0]))
        assert(init[1] > 0)
      })

      it('JohnsonSU._fitInit should fall back to moments when quantile ratio is degenerate', () => {
        // constant data → all four quantiles equal → p = 0 → ratio = NaN → moments fallback
        const init = dist.JohnsonSU._fitInit([2, 2, 2, 2, 2])
        assert(Array.isArray(init) && init.length === 4)
        assert(init[1] > 0) // delta > 0
        assert(init[2] > 0) // lambda > 0
      })

      it('R._fitPenalty should return 0', () => {
        assert.strictEqual(dist.R._fitPenalty(), 0)
      })

      it('BaldingNichols._fitPenalty should return 0', () => {
        assert.strictEqual(dist.BaldingNichols._fitPenalty(), 0)
      })

      it('BaldingNichols constructor should expose F and p on this.p', () => {
        const d = new dist.BaldingNichols(0.1, 0.3)
        assert(d.p.F === 0.1)
        assert(d.p.p === 0.3)
      })

      it('F._fitPenalty should return 0', () => {
        assert.strictEqual(dist.F._fitPenalty(), 0)
      })

      it('F.fit should return a valid F instance', () => {
        const data = new dist.F(10, 20).seed(42).sample(200)
        const result = dist.F.fit(data)
        assert(result instanceof dist.F)
        assert(result.p.d1 > 0 && result.p.d2 > 0)
        assert(Number.isFinite(result.pdf(1)) && result.pdf(1) > 0)
      })

      it('F.fit profile search finds higher lnL than moment seed when round(seed) is suboptimal', () => {
        // seed=8: _fitInit gives d1Seed=4,d2Seed=14; profile grid finds (5,11) with higher lnL
        const data = new dist.F(5, 10).seed(8).sample(200)
        const result = dist.F.fit(data)
        assert(result instanceof dist.F)
        // Profile MLE has strictly higher lnL than the moment-seed answer
        assert(new dist.F(result.p.d1, result.p.d2).lnL(data) > new dist.F(4, 14).lnL(data))
      })

      it('FisherZ._fitPenalty should return 0', () => {
        assert.strictEqual(dist.FisherZ._fitPenalty(), 0)
      })

      it('FisherZ.fit should return a FisherZ instance (not F)', () => {
        const data = new dist.FisherZ(10, 20).seed(42).sample(200)
        const result = dist.FisherZ.fit(data)
        assert(result instanceof dist.FisherZ)
        assert(result.p.d1 > 0 && result.p.d2 > 0)
        assert(Number.isFinite(result.pdf(0)) && result.pdf(0) > 0)
      })

      it('StudentT._fitInit should derive nu from sample variance', () => {
        // variance = nu/(nu−2) ⇒ nu = 2·Var/(Var−1); Var≈5/3 for nu=5 ⇒ nu≈5
        const data = new dist.StudentT(5).seed(42).sample(500)
        const init = dist.StudentT._fitInit(data)
        assert(init.length === 1)
        assert(Math.abs(init[0] - 5) < 1.5)
      })

      it('StudentZ._fitInit should derive n from sample variance', () => {
        // Var[Z] = 1/(n−3) ⇒ n = 1/Var + 3; Var≈1/3 for n=6 ⇒ n≈6
        const data = new dist.StudentZ(6).seed(42).sample(500)
        const init = dist.StudentZ._fitInit(data)
        assert(init.length === 1)
        assert(init[0] > 1)
        assert(Math.abs(init[0] - 6) < 1.5)
      })

      it('Degenerate._fitInit should return the sample mean as location', () => {
        const init = dist.Degenerate._fitInit([2, 2, 2])
        assert(init.length === 1)
        assert(Math.abs(init[0] - 2) < 1e-9)
      })

      it('Degenerate.fit should recover the point-mass location', () => {
        const result = dist.Degenerate.fit([5, 5, 5])
        assert(result instanceof dist.Degenerate)
        // constant data ⇒ exact point-mass location, no MLE drift
        assert(Math.abs(result.p.x0 - 5) < 1e-9)
      })

      it('Soliton._fitInit should lower-bound N by the largest observation', () => {
        const init = dist.Soliton._fitInit([1, 2, 1, 5, 3])
        assert(init.length === 1)
        assert(init[0] === 5)
      })

      it('IrwinHall._fitInit should derive n from E[X]=n/2', () => {
        // mean = 2 for this sample ⇒ n = round(2·mean) = 4
        const init = dist.IrwinHall._fitInit([1.5, 2, 2.5, 1, 3])
        assert(init.length === 1)
        assert(init[0] === 4)
      })

      it('R._fitInit should clamp c for zero-variance data', () => {
        // constant data ⇒ variance 0 hits the `|| 1` guard, then the Math.max(..., 1e-3) clamp
        const init = dist.R._fitInit([0, 0, 0])
        assert(Math.abs(init[0] - 1e-3) < 1e-12)
      })

      it('F._fitInit should fall back to defaults for mean<=1 data', () => {
        // mean <= 1 ⇒ d2 defaults to 10; the resulting negative variance denominator ⇒ d1 defaults to 5
        const init = dist.F._fitInit([0.1, 0.2, 0.3])
        assert(init[0] === 5 && init[1] === 10)
      })

      it('F._fitInit should guard zero-variance data', () => {
        // constant data ⇒ variance 0 hits the `|| 1` guard
        const init = dist.F._fitInit([2, 2, 2])
        assert(init[0] === 5 && Math.abs(init[1] - 4.1) < 1e-12)
      })

      it('StudentT._fitInit should fall back to nu=10 for low-variance data', () => {
        // variance <= 1 has no real df solution from ν = 2·Var/(Var−1); use a heavy-tailed default
        const init = dist.StudentT._fitInit([0.1, -0.1, 0.05, -0.05])
        assert(init[0] === 10)
      })

      it('StudentZ._fitInit should fall back to n=10 for zero-variance data', () => {
        // constant data ⇒ variance 0 hits the degenerate fallback
        const init = dist.StudentZ._fitInit([1, 1, 1])
        assert(init[0] === 10)
      })

      it('BoundedPareto.fit should recover L and alpha and return a valid upper bound', () => {
        const data = new dist.BoundedPareto(2, 20, 3).seed(42).sample(200)
        const result = dist.BoundedPareto.fit(data)
        assert(result instanceof dist.BoundedPareto)
        assert(Math.abs(result.p.L - 2) < 0.5)
        // MLE for H converges to max(data) since likelihood decreases for any H > max(data)
        assert(result.p.H >= Math.max(...data))
        assert(Math.abs(result.p.alpha - 3) < 0.8)
      })

      it('Champernowne.fit should recover alpha and x0 and return a valid lambda', () => {
        const data = new dist.Champernowne(1, 0, 2).seed(42).sample(200)
        const result = dist.Champernowne.fit(data)
        assert(result instanceof dist.Champernowne)
        assert(Math.abs(result.p.alpha - 1) < 0.4)
        // lambda is poorly identified near 0 from n=200; check valid range instead
        assert(result.p.lambda >= 0 && result.p.lambda < 1)
        assert(Math.abs(result.p.x0 - 2) < 0.5)
      })

      it('BoundedPareto._fitInit should return valid params for constant data', () => {
        const init = dist.BoundedPareto._fitInit([5, 5, 5])
        assert(init[0] > 0 && init[1] > init[0] && init[2] > 0)
      })

      it('Lomax._fitInit should fall back to alpha=3 when CV <= 1', () => {
        // near-constant data → CV ≈ 0 → triggers fallback
        const init = dist.Lomax._fitInit([2, 2.001, 1.999, 2])
        assert(init[0] > 0)
        assert(init[1] === 3)
      })

      it('GeneralizedPareto._fitInit should return xi=0 for constant data', () => {
        const init = dist.GeneralizedPareto._fitInit([3, 3, 3])
        assert(Number.isFinite(init[0]))
        assert(init[1] > 0)
        assert(init[2] === 0)
      })

      it('Benini._fitInit should return positive alpha, beta, and sigma for any positive data', () => {
        const init = dist.Benini._fitInit([2, 3, 4, 5])
        assert(init[0] > 0)
        assert(init[1] > 0)
        assert(init[2] > 0)
      })

      it('NoncentralT.fit should recover nu and mu close to planted values', () => {
        const data = new dist.NoncentralT(5, 1).seed(42).sample(300)
        const result = dist.NoncentralT.fit(data)
        assert(result instanceof dist.NoncentralT)
        assert(Math.abs(result.p.nu - 5) <= 1)
        assert(Math.abs(result.p.mu - 1) < 0.3)
      })

      it('DoublyNoncentralChi2.fit should recover total df and noncentrality close to planted values', () => {
        const data = new dist.DoublyNoncentralChi2(2, 3, 1, 2).seed(42).sample(500)
        const result = dist.DoublyNoncentralChi2.fit(data)
        assert(result instanceof dist.DoublyNoncentralChi2)
        assert(Math.abs((result.p.k1 + result.p.k2) - 5) <= 2)
        assert(Math.abs((result.p.lambda1 + result.p.lambda2) - 3) <= 2)
      })

      it('DoublyNoncentralChi2.fit should enforce k1>=1 and k2>=1 when collapsed fit returns k=1', () => {
        // chi-squared(1) data: NoncentralChi2.fit returns k=1, triggering kTot<2 clamp
        const data = new dist.NoncentralChi2(1, 0).seed(42).sample(500)
        const result = dist.DoublyNoncentralChi2.fit(data)
        assert(result instanceof dist.DoublyNoncentralChi2)
        assert(result.p.k1 >= 1)
        assert(result.p.k2 >= 1)
      })

      it('DoublyNoncentralT moments should be identical across independent instances', () => {
        const d1 = new dist.DoublyNoncentralT(5, 1, 2)
        const d2 = new dist.DoublyNoncentralT(5, 1, 2)
        assert.strictEqual(d1.mean(), d2.mean())
        assert.strictEqual(d1.variance(), d2.variance())
        assert.strictEqual(d1.skewness(), d2.skewness())
        assert.strictEqual(d1.kurtosis(), d2.kurtosis())
      })
    })
  })
})
