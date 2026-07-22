import { assert } from 'chai'
import { describe, it } from 'mocha'
import * as dist from '../src/dist'

describe('dist', () => {
  describe('Distribution', () => {
    describe('.fit()', () => {
      it('InverseGaussian._fitInit should return the exact MLE mu=mean, lambda=n/Σ(1/xᵢ−1/x̄)', () => {
        const data = [1, 2, 3, 4]
        const init = dist.InverseGaussian._fitInit(data)
        const mean = 2.5
        const lambda = data.length / data.reduce((s, x) => s + (1 / x - 1 / mean), 0)
        assert(Math.abs(init[0] - mean) < 1e-10)
        assert(Math.abs(init[1] - lambda) < 1e-10)
      })

      it('ReciprocalInverseGaussian._fitInit should apply IG MOM to reciprocal data', () => {
        // X ~ RIG(mu, lambda) iff 1/X ~ IG(mu, lambda); init maps 1/x and applies IG MOM
        const data = new dist.ReciprocalInverseGaussian(2, 4).seed(42).sample(200)
        const init = dist.ReciprocalInverseGaussian._fitInit(data)
        assert(Math.abs(init[0] - 2) < 0.5)
        assert(Math.abs(init[1] - 4) < 2.0)
      })

      it('Nakagami._fitInit should return m=E[X²]²/Var[X²] and omega=E[X²]', () => {
        // Exact MOM on X²~Gamma(m, omega/m)
        const data = new dist.Nakagami(2, 3).seed(42).sample(1000)
        const init = dist.Nakagami._fitInit(data)
        assert(init[0] >= 0.5 && Math.abs(init[0] - 2) < 0.5)
        assert(Math.abs(init[1] - 3) < 0.5)
      })

      it('Hoyt._fitInit should delegate to Nakagami and return valid params', () => {
        // Hoyt is a deprecated alias for Nakagami; _fitInit delegates to Nakagami._fitInit
        const data = new dist.Nakagami(2, 3).seed(42).sample(200)
        const init = dist.Hoyt._fitInit(data)
        assert(init[0] >= 0.5)
        assert(init[1] > 0)
      })

      it('Lindley._fitInit should return the closed-form MOM estimate', () => {
        // Exact: theta = (-(mean-1) + sqrt((mean-1)²+8·mean)) / (2·mean)
        // For theta=1: mean=1.5, so theta_hat should be 1
        const data = new dist.Lindley(1).seed(42).sample(1000)
        const init = dist.Lindley._fitInit(data)
        assert(init.length === 1)
        assert(Math.abs(init[0] - 1) < 0.15)
      })

      it('Alpha._fitInit should return positive alpha and beta from heuristic MOM', () => {
        const data = new dist.Alpha(3, 1).seed(42).sample(200)
        const init = dist.Alpha._fitInit(data)
        assert(init[0] > 0 && init[1] > 0)
        assert(Math.abs(init[0] - 3) < 1.5)
      })

      it('QExponential._fitInit should return q and lambda matching MOM for r>1/3', () => {
        // For QExp(q=0.5, lambda=2): r = Var/E² = (2-q)/(4-3q) = 1.5/2.5 = 0.6 > 1/3
        // MOM inverse gives q = (2-4·0.6)/(1-3·0.6) = 0.5, lambda = 1/(mean·(3-2·0.5)) = 2
        const data = new dist.QExponential(0.5, 2).seed(42).sample(1000)
        const init = dist.QExponential._fitInit(data)
        assert(Math.abs(init[0] - 0.5) < 0.2)
        assert(Math.abs(init[1] - 2) < 0.5)
      })

      it('QExponential.fit should recover q and lambda close to planted values', () => {
        const data = new dist.QExponential(0.5, 2).seed(42).sample(500)
        const result = dist.QExponential.fit(data)
        assert(result instanceof dist.QExponential)
        assert(Math.abs(result.params().q - 0.5) < 0.2)
        assert(Math.abs(result.params().lambda - 2) < 0.5)
      })

      it('InverseGaussian._fitInit should handle constant data via variance fallback', () => {
        // zero variance → || mean*mean guard; result must still be valid params
        const init = dist.InverseGaussian._fitInit([2, 2, 2])
        assert(init[0] > 0 && init[1] > 0)
      })

      it('Nakagami._fitInit should handle constant data via variance fallback', () => {
        // zero var(X²) → || mean2*mean2 guard; m is clamped to 0.5
        const init = dist.Nakagami._fitInit([1, 1, 1])
        assert(init[0] >= 0.5 && init[1] > 0)
      })

      it('Alpha._fitInit should handle constant data via variance fallback', () => {
        // zero variance → || mean²·0.25 guard gives std = 0.5·mean, alpha = 2
        const init = dist.Alpha._fitInit([3, 3, 3])
        assert(init[0] > 0 && init[1] > 0)
      })

      it('ReciprocalInverseGaussian._fitInit should handle constant data via variance fallback', () => {
        const init = dist.ReciprocalInverseGaussian._fitInit([2, 2, 2])
        assert(init[0] > 0 && init[1] > 0)
      })

      it('Rice._fitInit should handle constant data via variance fallback', () => {
        // zero variance → || mean*mean guard; nu and sigma must still be valid (floored) params
        const init = dist.Rice._fitInit([2, 2, 2])
        assert(init[0] > 0 && init[1] > 0)
      })

      it('QExponential._fitInit should handle constant data via variance fallback', () => {
        // zero variance → fallback mean²=4, r=4/4=1 > 1/3 → q=(2-4)/(1-3)=1, lambda=1/(2*(3-2))=0.5
        const init = dist.QExponential._fitInit([2, 2, 2])
        assert(Math.abs(init[0] - 1) < 1e-10)
        assert(Math.abs(init[1] - 0.5) < 1e-10)
      })

      it('QExponential._fitInit should use q=0 fallback when r<=1/3', () => {
        // data with large mean, small variance gives r = Var/E² << 1/3 → else branch
        const init = dist.QExponential._fitInit([9, 10, 11])
        assert(init[0] === 0)
        assert(init[1] > 0)
      })

      // Loose behavior-first recovery check: a usable fit places ~half its mass below the sample median
      const fitCoversMedian = (result, data) => {
        const median = data.slice().sort((a, b) => a - b)[Math.floor(data.length / 2)]
        return Math.abs(result.cdf(median) - 0.5) < 0.2
      }

      it('Gompertz._fitInit returns a constructible [eta, b] vector and fit() covers the median', () => {
        const data = new dist.Gompertz(2, 2).seed(42).sample(300)
        const init = dist.Gompertz._fitInit(data)
        assert(init.length === 2 && init.every(p => p > 0))
        assert.doesNotThrow(() => new dist.Gompertz(...init))
        const result = dist.Gompertz.fit(data)
        assert(result instanceof dist.Gompertz)
        assert(fitCoversMedian(result, data))
      })

      it('Makeham._fitInit returns positive [alpha, beta, lambda] and fit() covers the median', () => {
        const data = new dist.Makeham(2, 2, 2).seed(42).sample(300)
        const init = dist.Makeham._fitInit(data)
        assert(init.length === 3 && init.every(p => p > 0))
        const result = dist.Makeham.fit(data)
        assert(result instanceof dist.Makeham)
        assert(fitCoversMedian(result, data))
      })

      it('Muth._fitInit returns alpha in (0,1] and fit() covers the median', () => {
        const data = new dist.Muth(0.5).seed(42).sample(300)
        const init = dist.Muth._fitInit(data)
        assert(init.length === 1 && init[0] > 0 && init[0] <= 1)
        const result = dist.Muth.fit(data)
        assert(result instanceof dist.Muth)
        assert(fitCoversMedian(result, data))
      })

      it('BenktanderII._fitInit seeds a>0, b in (0,1] and fit() covers the median', () => {
        const data = new dist.BenktanderII(2, 0.9995).seed(42).sample(300)
        const init = dist.BenktanderII._fitInit(data)
        assert(init[0] > 0 && init[1] > 0 && init[1] <= 1)
        const result = dist.BenktanderII.fit(data)
        assert(result instanceof dist.BenktanderII)
        assert(fitCoversMedian(result, data))
      })

      it('BirnbaumSaunders._fitInit returns shifted fatigue-life estimates and fit() covers the median', () => {
        const data = new dist.BirnbaumSaunders(0, 2, 2).seed(42).sample(300)
        const init = dist.BirnbaumSaunders._fitInit(data)
        assert(init.length === 3 && init[1] > 0 && init[2] > 0)
        assert(Number.isFinite(init[0]) && init[0] < Math.min(...data)) // mu seeded just below the minimum observation
        const result = dist.BirnbaumSaunders.fit(data)
        assert(result instanceof dist.BirnbaumSaunders)
        assert(fitCoversMedian(result, data))
      })

      it('Davis._fitInit returns 0<mu<min with n=2.5 and fit() yields a usable instance', () => {
        const data = new dist.Davis(1, 1, 2).seed(42).sample(200)
        const sorted = data.slice().sort((a, b) => a - b)
        const init = dist.Davis._fitInit(data)
        assert(init[0] > 0 && init[0] < sorted[0])
        assert(init[1] > 0 && init[2] > 1)
        // Davis fit() converges poorly here (likelihood is nearly flat in the shape n), so exact recovery is impractical; assert a usable, non-degenerate fit instead
        const result = dist.Davis.fit(data)
        assert(result instanceof dist.Davis)
        const lo = sorted[Math.floor(data.length * 0.25)]
        const hi = sorted[Math.floor(data.length * 0.75)]
        assert(Number.isFinite(result.pdf(hi)) && result.pdf(hi) > 0)
        assert(result.cdf(hi) > result.cdf(lo)) // monotone increasing → non-degenerate fit
      })

      it('GeneralizedExponential._fitInit returns positive [a, b, c] and fit() covers the median', () => {
        const data = new dist.GeneralizedExponential(2, 2, 2).seed(42).sample(300)
        const init = dist.GeneralizedExponential._fitInit(data)
        assert(init.length === 3 && init.every(p => p > 0))
        const result = dist.GeneralizedExponential.fit(data)
        assert(result instanceof dist.GeneralizedExponential)
        assert(fitCoversMedian(result, data))
      })

      it('Rice._fitInit returns positive [nu, sigma] and fit() covers the median', () => {
        const data = new dist.Rice(0.5, 2).seed(42).sample(300)
        const init = dist.Rice._fitInit(data)
        assert(init.length === 2 && init[0] > 0 && init[1] > 0)
        const result = dist.Rice.fit(data)
        assert(result instanceof dist.Rice)
        assert(fitCoversMedian(result, data))
      })

      it('TruncatedNormal._fitInit should set a=min, b=max, mu=mean, sigma=std', () => {
        // Fixed dataset with known moments: mean=3, std=sqrt(2), min=1, max=5
        const init = dist.TruncatedNormal._fitInit([1, 2, 3, 4, 5])
        assert.strictEqual(init[2], 1)
        assert.strictEqual(init[3], 5)
        assert(Math.abs(init[0] - 3) < 1e-10)
        assert(init[1] > 0)
      })

      it('TruncatedNormal.fit should recover mu, sigma, a, b close to planted values', () => {
        const data = new dist.TruncatedNormal(2, 1, 0, 4).seed(42).sample(300)
        const result = dist.TruncatedNormal.fit(data)
        assert(result instanceof dist.TruncatedNormal)
        assert(Math.abs(result.p.mu - 2) < 0.4)
        assert(Math.abs(result.p.sigma - 1) < 0.4)
        assert(result.p.a < 0.5)
        assert(result.p.b > 3.5)
      })

      it('TruncatedExponential._fitInit should set a=min, b=max, lambda from MOM', () => {
        // Fixed dataset: min=1, max=5, mean=3 → lambda ≈ 1/(3-1)=0.5
        const init = dist.TruncatedExponential._fitInit([1, 2, 3, 4, 5])
        assert.strictEqual(init[1], 1) // a = min(data)
        assert.strictEqual(init[2], 5) // b = max(data)
        assert(init[0] > 0) // lambda > 0
      })

      it('TruncatedExponential._fitInit should fall back to lambda=1 and b=a+1 for constant data', () => {
        // constant data: min = max = 3 → b = a, mu = a; both fallback branches fire
        const init = dist.TruncatedExponential._fitInit([3, 3, 3])
        assert(init[0] === 1) // lambda falls back to 1
        assert(init[1] === 3) // a = min(data)
        assert(init[2] === 4) // b = a + 1 (fallback)
      })

      it('TruncatedExponential.fit should return a valid instance close to planted values', () => {
        const data = new dist.TruncatedExponential(1, 0, 5).seed(42).sample(300)
        const result = dist.TruncatedExponential.fit(data)
        assert(result instanceof dist.TruncatedExponential)
        assert(result.p.lambda > 0)
        assert(result.p.a >= 0)
        assert(result.p.b > result.p.a)
        assert(Number.isFinite(result.pdf(1)) && result.pdf(1) > 0)
      })

      it('Reciprocal._fitInit should set a=max(min,ε) and b=max', () => {
        // Fixed dataset with known bounds: min=2, max=8, no ε clamping needed
        const init = dist.Reciprocal._fitInit([2, 5, 8])
        assert.strictEqual(init[0], 2)
        assert.strictEqual(init[1], 8)
      })

      it('Reciprocal._fitInit should apply a*10 fallback when all data are equal', () => {
        const init = dist.Reciprocal._fitInit([5, 5, 5])
        assert.strictEqual(init[0], 5)
        assert.strictEqual(init[1], 50)
      })

      it('Bradford._fitInit should return c close to planted value from sample mean', () => {
        // Bradford(2) mean ≈ 0.35; c = 6*(1-2*0.35) ≈ 1.8 — start within 1.5 of truth
        const data = new dist.Bradford(2).seed(42).sample(200)
        const init = dist.Bradford._fitInit(data)
        assert(init[0] > 0)
        assert(Math.abs(init[0] - 2) < 1.5)
      })

      it('Bradford._fitInit should return c=1 when mean >= 0.5', () => {
        const init = dist.Bradford._fitInit([0.5, 0.6, 0.7])
        assert.strictEqual(init[0], 1)
      })

      it('Wigner._fitInit should return R = 2*std for symmetric data without outliers', () => {
        // [-2,-1,0,1,2]: mean=0, variance=2, std=sqrt(2), so R = 2*sqrt(2) ≈ 2.83 > maxAbs=2
        const init = dist.Wigner._fitInit([-2, -1, 0, 1, 2])
        assert(Math.abs(init[0] - 2 * Math.sqrt(2)) < 1e-10)
      })

      it('VonMises._fitInit should return kappa from circular resultant-length approximation', () => {
        const data = new dist.VonMises(2).seed(42).sample(200)
        const init = dist.VonMises._fitInit(data)
        assert(init[0] > 0)
        assert(Math.abs(init[0] - 2) < 0.8)
      })
    })
  })
})
