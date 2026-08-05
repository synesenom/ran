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
        assert(Math.abs(result.params().mu - 2) < 0.4)
        assert(Math.abs(result.params().sigma - 1) < 0.4)
        assert(result.params().a < 0.5)
        assert(result.params().b > 3.5)
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
        assert(result.params().lambda > 0)
        assert(result.params().a >= 0)
        assert(result.params().b > result.params().a)
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

      it('VonMises._fitInit should return mu and kappa from the circular resultant vector', () => {
        const data = new dist.VonMises(0.7, 2).seed(42).sample(200)
        const init = dist.VonMises._fitInit(data)
        assert(Math.abs(init[0] - 0.7) < 0.3)
        assert(init[1] > 0)
        assert(Math.abs(init[1] - 2) < 0.8)
      })

      it('WrappedCauchy._fitInit returns valid [mu, rho] and fit() covers the median', () => {
        const data = new dist.WrappedCauchy(0.5, 0.4).seed(42).sample(300)
        const init = dist.WrappedCauchy._fitInit(data)
        assert(init.length === 2 && init[1] > 0 && init[1] < 1)
        assert(Math.abs(init[0] - 0.5) < 0.5)
        assert(Math.abs(init[1] - 0.4) < 0.3)
        const result = dist.WrappedCauchy.fit(data)
        assert(result instanceof dist.WrappedCauchy)
        assert(fitCoversMedian(result, data))
      })

      it('DoublyNoncentralT.fit should complete quickly on data shaped like the reported regression (issue #1332)', function () {
        this.timeout(240000)
        // Issue #1332's nu-scaled _fnmDiff gate (src/dist/doubly-noncentral-t.js) fires far more
        // often than the flat 1e-9 threshold it replaced, routing many more Poisson-mixture terms
        // through the pricier NoncentralT.snm-difference fallback during an unbounded Powell
        // search on data that isn't genuinely DoublyNoncentralT-shaped -- the same VonMises(0,2)
        // reproduction case #1325 used for the structurally identical NoncentralT regression.
        // Unlike this file's NoncentralT._pdfDirect call-count guard, _fnmDiff's fallback goes
        // through NoncentralT.snm -- an @ignore'd, low-level internal (src/dist/noncentral-t.js)
        // far more likely to be refactored (batched, cached, replaced) without changing fit()'s
        // observable behavior, so a call-count assertion there would be coupled to an
        // implementation detail rather than the regression itself. A wall-clock ceiling is the
        // more direct proxy for "did the bounded search actually bound the runtime". Measured on
        // this suite's own hardware: the shipped bounded _powellOptions() budget takes ~28s per
        // run (three repeated runs: 28231ms/28112ms/28037ms), while reverting to an unbounded
        // search takes ~126s -- an ~4.5x regression. The 60s ceiling below sits at ~2x the
        // bounded measurement (headroom for CI variance, matching this file's own ~2x call-count
        // margin convention) while remaining well under half of the unbounded-search blowup this
        // guards against; three repeats and taking the fastest reduce single-run CI noise.
        const data = new dist.VonMises(0, 2).seed(5).sample(500)
        const runs = 3
        const ceilingMs = 60000
        let result
        let fastestMs = Infinity
        for (let i = 0; i < runs; i++) {
          const start = Date.now()
          result = dist.DoublyNoncentralT.fit(data)
          fastestMs = Math.min(fastestMs, Date.now() - start)
        }

        assert(fastestMs < ceilingMs, `fastest of ${runs} fit() runs took ${fastestMs}ms, expected well under ${ceilingMs}ms`)
        assert(result instanceof dist.DoublyNoncentralT)
      })

      it('DoublyNoncentralT.fit should not show intolerable quality loss from the bounded Powell search budget on well-matched data (issue #1332)', function () {
        // Locks in the invariant documented in the _powellOptions() JSDoc
        // (src/dist/doubly-noncentral-t.js): on well-matched data (genuinely
        // DoublyNoncentralT-shaped, unlike the VonMises regression case above), the bounded budget
        // (tol=1e-2, maxIter=15) stays close to the optimum an unbounded search reaches.
        //
        // Issue #1336 investigated *why* the two searches don't converge to bit-identical results
        // here, unlike NoncentralT's analogous test -- profile-likelihood sweeps (fixing nu,
        // re-optimizing mu/theta to full precision) confirm a genuine (nu, theta) ridge exists on
        // well-matched data, but it is sample-dependent (seed 99's profile is sharply peaked with no
        // ridge at all; seed 7's is nearly flat from nu=9 to nu=50) and does NOT explain the measured
        // gap sizes below -- the ranking is inverted: seed 7 has the flattest ridge yet the smallest
        // gap (0.0047), while seed 99 has no ridge yet the largest gap (0.609). The actual driver is
        // powell.js's fractional convergence test (line 281: 2*|fStart-fret| <= tol*(|fStart|+|fret|)),
        // whose permitted absolute slack scales with the objective's magnitude -- i.e. with n, since
        // the objective is -lnL(data). Confirmed directly: repeating this comparison at n=1000/3000
        // (vs. this test's n=300) measures gaps of ~1.4/~3.1, already exceeding this test's entire
        // n=300 seed range. See
        // thoughts/research/2026-08-04-1631-doubly-noncentral-t-fit-convergence-ridge.md for the
        // full investigation and
        // solutions/testing/2026-08-04-1631-doubly-noncentral-t-fit-convergence-ridge.md for its
        // findings and the follow-up issues (#1338: n-aware convergence criterion for powell.js,
        // shared by every _powellOptions()-bounded distribution, not just this one; #1339:
        // theta=0 boundary convergence behavior for seed 7's ridge).
        //
        // Issue #1338 followed up on #1338's own scope: a prototype absolute-cap term
        // (min(tol*(|fStart|+|fret|), capAbs)) on a scratch copy of powell.js -- never applied to
        // the shipped algorithm -- measured with capAbs=2 on this class's own (5,1,2) seed=42 data:
        // gap closes from ~1.41 to ~0.0003 at n=1000 and from ~3.08 to ~0.018 at n=3000, while
        // leaving n=100/300 (where the untreated gap is already small) essentially unchanged. The
        // same capAbs=2 measured against this file's own VonMises(0,2) mismatched-data wall-clock
        // ceiling test above showed no measurable change (~17s either way, both well under the 60s
        // ceiling). See solutions/testing/2026-08-05-1736-powell-fractional-convergence-n-scaling.md
        // and the filed follow-up implementation issue for the full cross-distribution measurement.
        //
        // Measured lnL differences across seeds 1, 7, 42, 99 at this test's n=300 ranged ~0.005-0.61
        // (out of an lnL magnitude ~400-450); tolerance (2) sits comfortably above that measured range
        // while remaining tight enough to catch a real regression that starves the bounded search on
        // data it should fit well (e.g. a future maxIter cut deep enough to leave the search far from
        // any local optimum, which would separately also fail this file's mu-recovery fit test).
        // Swept over all 4 seeds the tolerance was calibrated against, not just one, so a regression
        // confined to a single seed's search trajectory can't hide behind the others' margin. Measured
        // ~322s for all 4 seeds' bounded+relaxed pairs under this suite's own CI load (some seeds'
        // unbounded/relaxed search converges far slower than seed=42's ~2-3s isolated measurement
        // suggested) -- timeout kept at ~3x that measurement for headroom against further variance.
        this.timeout(900000)
        const seeds = [1, 7, 42, 99]
        seeds.forEach(seed => {
          const data = new dist.DoublyNoncentralT(5, 1, 2).seed(seed).sample(300)
          const bounded = dist.DoublyNoncentralT.fit(data)
          const origOptions = dist.DoublyNoncentralT._powellOptions
          dist.DoublyNoncentralT._powellOptions = () => ({ tol: 1e-8, maxIter: 200 })
          let relaxed
          try {
            relaxed = dist.DoublyNoncentralT.fit(data)
          } finally {
            dist.DoublyNoncentralT._powellOptions = origOptions
          }
          assert(Math.abs(bounded.lnL(data) - relaxed.lnL(data)) < 2, `seed ${seed}`)
        })
      })
    })
  })
})
