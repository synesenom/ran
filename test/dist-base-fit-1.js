import { assert } from 'chai'
import { describe, it } from 'mocha'
import * as dist from '../src/dist'
import Distribution from '../src/dist/_distribution'

describe('dist', () => {
  describe('Distribution', () => {
    describe('.fit()', () => {
      it('Distribution._fitPenalty base class should return 0 for any params', () => {
        assert.strictEqual(Distribution._fitPenalty({ p: { alpha: 1, beta: 1 } }), 0)
        assert.strictEqual(Distribution._fitPenalty({ p: {} }), 0)
      })

      it('Distribution._fitInit fallback random-retry path covers try-success and catch', () => {
        // All exported distributions now have _fitInit overrides, so call the base-class
        // method directly via a fake 2-param class with an ordering constraint (a < b).
        // ~50% of random draws in (0,5) violate a>=b, exercising both the catch and return paths.
        class FakeDist {
          static get length () { return 2 }
          constructor (a, b) {
            if (a >= b) throw new Error('invalid')
          }
        }
        const params = Distribution._fitInit.call(FakeDist, [1, 2, 3])
        assert(params.length === 2 && params[0] < params[1])
      })

      it('ZipfMandelbrot._fitInit should return valid params for typical data', () => {
        const data = new dist.ZipfMandelbrot(10, 2, 0).seed(42).sample(120)
        const init = dist.ZipfMandelbrot._fitInit(data)
        assert(init.length === 3)
        assert(Number.isFinite(init[0]) && init[0] >= 1) // N >= 1
        assert(Number.isFinite(init[1]) && init[1] > 1) // s > 1
        assert(Number.isFinite(init[2]) && init[2] >= 0) // q >= 0
      })

      it('ZipfMandelbrot._fitInit should fall back to q=0 when no rank-2 data exists', () => {
        const init = dist.ZipfMandelbrot._fitInit([1, 1, 1, 1])
        assert(init[2] === 0) // q falls back to 0 when only rank-1 observed
        assert(init[1] > 1) // s still valid
      })

      it('DoublyNoncentralF.fit should complete quickly on data shaped like the reported regression (#1063)', function () {
        this.timeout(20000)
        // Exact reproduction from the issue report: Rice(5, 1)-sampled data (which does not
        // genuinely belong to this family) previously drove DoublyNoncentralF.fit() to ~30s
        // because the log-likelihood surface carries a long, near-flat ridge between d2 and
        // lambda1/lambda2 that a full-precision Powell search chases almost indefinitely, at
        // ever-increasing per-point cost as the ridge is followed to larger parameter values.
        // DoublyNoncentralBeta.fit's bounded Powell search budget caps this. Asserting on the
        // actual _pdf call count (not wall-clock time) is the deterministic, load-independent
        // regression guard: an isolated run measured ~113500 calls and ~1.5s, but wall-clock
        // time alone varies more than 5x under mocha's --parallel workers contending for CPU
        // (matching the exact flakiness this codebase's own solutions doc already documented
        // for full-pool guess() timing assertions — see
        // solutions/testing/2026-07-21-1055-guess-default-pool-latent-fit-cliff.md).
        const data = new dist.Rice(5, 1).seed(5).sample(500)

        let pdfCalls = 0
        const origPdf = dist.DoublyNoncentralBeta.prototype._pdf
        dist.DoublyNoncentralBeta.prototype._pdf = function (x) {
          pdfCalls++
          return origPdf.call(this, x)
        }
        let result
        try {
          result = dist.DoublyNoncentralF.fit(data)
        } finally {
          dist.DoublyNoncentralBeta.prototype._pdf = origPdf
        }

        // Lower bound guards against a future regression where fit() short-circuits without
        // actually running Powell (which would trivially satisfy an upper-bound-only assertion).
        assert(pdfCalls > data.length, `fit() made only ${pdfCalls} _pdf calls, expected the optimizer to run`)
        assert(pdfCalls < 200000, `fit() made ${pdfCalls} _pdf calls, expected well under 200000`)
        assert(result instanceof dist.DoublyNoncentralF)
        assert(Number.isFinite(result.p.d1) && Number.isFinite(result.p.d2))
        // Confirms the bounded search still improves on the initial guess rather than merely
        // terminating early with an unoptimized fit.
        const init = new dist.DoublyNoncentralF(...dist.DoublyNoncentralF._fitInit(data))
        assert(result.lnL(data) >= init.lnL(data), 'fit() result should not be worse than the initial guess')
      })

      it('Pareto.fit should recover xmin close to min(data)', () => {
        const data = [1.5, 2.0, 3.1, 1.8, 2.5]
        const result = dist.Pareto.fit(data)
        assert(Math.abs(result.p.xmin - 1.5) < 1e-3)
      })

      it('Pareto.fit should recover alpha close to closed-form MLE', () => {
        const data = [1.5, 2.0, 3.1, 1.8, 2.5]
        const xmin = Math.min(...data)
        const alphaExpected = data.length / data.reduce((s, x) => s + Math.log(x / xmin), 0)
        const result = dist.Pareto.fit(data)
        assert(Math.abs(result.p.alpha - alphaExpected) < 0.05)
      })

      it('InvalidDiscrete.fit should return an InvalidDiscrete instance', () => {
        // data is irrelevant for k=0; instance is the only possible MLE
        const result = dist.InvalidDiscrete.fit([-1, 1, -1, 1, 1])
        assert(result instanceof dist.InvalidDiscrete)
      })

      it('Rademacher.fit should return a usable Rademacher instance', () => {
        const result = dist.Rademacher.fit([-1, 1, -1, 1])
        assert(result instanceof dist.Rademacher)
        assert(result.pdf(-1) === 0.5 && result.pdf(1) === 0.5)
      })

      it('LogNormal._fitInit should return sigma=1 for constant data', () => {
        const init = dist.LogNormal._fitInit([2, 2, 2])
        assert(Number.isFinite(init[0]))
        assert(init[1] === 1)
      })

      it('LogCauchy._fitInit should return valid params for odd-n data', () => {
        const init = dist.LogCauchy._fitInit(new dist.LogCauchy(0, 1).seed(1).sample(101))
        assert(Number.isFinite(init[0]))
        assert(init[1] > 0)
      })

      it('LogLogistic._fitInit should return positive params for constant data', () => {
        const init = dist.LogLogistic._fitInit([2, 2, 2])
        assert(init[0] > 0)
        assert(init[1] > 0)
      })

      it('LogLaplace._fitInit should return valid params for odd-n data', () => {
        const init = dist.LogLaplace._fitInit(new dist.LogLaplace(0, 1).seed(1).sample(101))
        assert(Number.isFinite(init[0]))
        assert(init[1] > 0)
      })

      it('LogisticExponential._fitInit should return valid params for odd-n data', () => {
        const init = dist.LogisticExponential._fitInit(new dist.LogisticExponential(1, 2).seed(1).sample(101))
        assert(init[0] > 0)
        assert(init[1] > 0)
      })

      it('LogisticExponential._fitInit should fall back to kappa=1 for degenerate data', () => {
        const init = dist.LogisticExponential._fitInit([5, 5, 5, 5])
        assert(init[0] > 0)
        assert(init[1] === 1)
      })

      it('LogitNormal._fitInit should return sigma=1 for constant data', () => {
        const init = dist.LogitNormal._fitInit([0.5, 0.5, 0.5])
        assert(Number.isFinite(init[0]))
        assert(init[1] === 1)
      })

      it('Categorical.fit should recover category probabilities close to planted values', () => {
        const data = new dist.Categorical([0.2, 0.3, 0.5], 0).seed(42).sample(500)
        const result = dist.Categorical.fit(data)
        assert(result instanceof dist.Categorical)
        assert(Math.abs(result.pdf(0) - 0.2) < 0.1)
        assert(Math.abs(result.pdf(1) - 0.3) < 0.1)
        assert(Math.abs(result.pdf(2) - 0.5) < 0.1)
      })

      it('Hyperexponential.fit should recover a mixture whose mean matches the data', () => {
        const data = new dist.Hyperexponential([
          { weight: 0.5, rate: 1 },
          { weight: 0.5, rate: 5 }
        ]).seed(42).sample(500)
        const result = dist.Hyperexponential.fit(data)
        assert(result instanceof dist.Hyperexponential)
        // Component label-switching makes (weight, rate) pairs non-identifiable; use the mixture
        // mean E[X] = Σ w_i / λ_i — a sufficient statistic invariant under that permutation.
        const sampleMean = data.reduce((s, x) => s + x, 0) / data.length
        const fittedMean = result.p.weights.reduce((s, w, i) => s + w / result.p.rates[i], 0)
        assert(Math.abs(fittedMean - sampleMean) < 0.2)
      })

      it('DiscreteLaplace.fit should return a usable instance', () => {
        const data = new dist.DiscreteLaplace(0.5, 0).seed(42).sample(500)
        const result = dist.DiscreteLaplace.fit(data)
        assert(result instanceof dist.DiscreteLaplace)
        assert(Number.isFinite(result.pdf(0)) && result.pdf(0) > 0)
      })

      it('DiscreteLaplace.fit should throw for empty data', () => {
        assert.throws(() => dist.DiscreteLaplace.fit([]), Error)
      })

      it('BorelTanner.fit should return a usable BorelTanner instance', () => {
        const data = new dist.BorelTanner(0.5, 3).seed(42).sample(200)
        const result = dist.BorelTanner.fit(data)
        assert(result instanceof dist.BorelTanner)
        assert(result.p.mu >= 0 && result.p.mu < 1 && result.p.n > 0)
        assert(Number.isFinite(result.pdf(result.p.n)) && result.pdf(result.p.n) > 0)
      })

      it('Borel._fitInit degenerate: constant data (mean = 1) clamps mu to 0', () => {
        // mean > 1 branch false: data all equal 1 → mean = 1 → mu = 0
        const result = dist.Borel.fit([1, 1, 1, 1, 1])
        assert(result instanceof dist.Borel)
        assert(result.p.mu === 0)
      })

      it('BorelTanner._fitInit degenerate: mean ≤ n clamps mu to 0', () => {
        // mean > n branch false: all values equal n (= minimum) → mean = n → mu = 0
        const result = dist.BorelTanner.fit([3, 3, 3, 3, 3])
        assert(result instanceof dist.BorelTanner)
        assert(result.p.mu === 0 && result.p.n === 3)
      })

      it('PolyaAeppli._fitInit fallback: variance ≤ mean seeds theta=0.5', () => {
        // if (variance <= mean) branch: data with var=0.16 < mean=3.2 triggers fallback seed
        const [lambda, theta] = dist.PolyaAeppli._fitInit([3, 3, 3, 3, 4])
        assert(theta === 0.5 && lambda > 0)
      })

      it('Erlang.fit profile search recovers k=3 when moment seed gives k=4', () => {
        // seed=20: mean²/var ≈ 4 so _fitInit seeds k=4; profile over [1..9] finds k=3 has higher lnL
        const data = new dist.Erlang(3, 1).seed(20).sample(200)
        const result = dist.Erlang.fit(data)
        assert(result instanceof dist.Erlang)
        assert.strictEqual(result.p.k, 3)
      })

      it('Beta.fit should not converge to near-singular alpha or beta', () => {
        // Beta(0.5, 0.5) is U-shaped and most susceptible to near-singularity: the optimizer
        // can find near-zero shapes that fit data concentrated near the boundaries.
        // Without the _fitPenalty log-barrier the optimizer can return alpha < 0.05.
        const data = new dist.Beta(0.5, 0.5).seed(42).sample(200)
        const result = dist.Beta.fit(data)
        assert(result instanceof dist.Beta)
        assert(result.p.alpha > 0.3 && result.p.alpha < 1.5, `alpha ${result.p.alpha} out of expected range`)
        assert(result.p.beta > 0.3 && result.p.beta < 1.5, `beta ${result.p.beta} out of expected range`)
      })

      it('BetaPrime.fit should not converge to near-singular alpha or beta', () => {
        const data = new dist.BetaPrime(1.5, 2.0).seed(42).sample(200)
        const result = dist.BetaPrime.fit(data)
        assert(result instanceof dist.BetaPrime)
        assert(result.p.alpha > 0.5 && result.p.alpha < 8, `alpha ${result.p.alpha} out of expected range`)
        assert(result.p.beta > 0.5 && result.p.beta < 8, `beta ${result.p.beta} out of expected range`)
      })

      it('PERT._fitPenalty should return 0', () => {
        assert.strictEqual(dist.PERT._fitPenalty(), 0)
      })

      it('BetaRectangular.fit should return a valid instance close to planted values', () => {
        const data = new dist.BetaRectangular(2, 3, 0.7, 0, 4).seed(42).sample(300)
        const result = dist.BetaRectangular.fit(data)
        assert(result instanceof dist.BetaRectangular)
        // alpha/beta > 0.5 ensures the optimizer did not converge to the near-singularity at 0.
        // Without the _fitPenalty log-barrier the optimizer can return alpha/beta < 0.01.
        assert(result.p.alpha > 0.5 && result.p.alpha < 10, `alpha ${result.p.alpha} out of range`)
        assert(result.p.beta > 0.5 && result.p.beta < 10, `beta ${result.p.beta} out of range`)
        assert(result.p.theta > 0.1 && result.p.theta <= 1)
        assert(Math.abs(result.p.a - 0) < 0.3)
        assert(Math.abs(result.p.b - 4) < 0.3)
      })

      it('BetaRectangular.k should reflect its 5 free parameters, not the 2 inherited from Beta', () => {
        // solutions/distribution/2026-06-07-2138-continuous-subclass-natural-params.md
        assert.strictEqual(new dist.BetaRectangular(2, 3, 0.7, 0, 4).k, 5)
      })

      it('BetaRectangular.bic should apply the 5-parameter penalty, not the 2-parameter one inherited from Beta', () => {
        // Ties the .k fix to its actual observable consequence: bic() = log(n)*k - 2*lnL(data),
        // so a still-wrong k=2 would make this assertion fail even if .k itself weren't checked.
        const inst = new dist.BetaRectangular(2, 3, 0.7, 0, 4)
        const data = inst.seed(11).sample(300)
        const expectedBic = Math.log(data.length) * 5 - 2 * inst.lnL(data)
        assert(Math.abs(inst.bic(data) - expectedBic) < 1e-9)
      })

      it('BetaRectangular.fit should not converge to near-singular alpha or beta', () => {
        // Data from a near-uniform BetaRectangular is most likely to trigger the singularity:
        // the optimizer can set alpha/beta ≈ 0 and theta ≈ 1 to concentrate mass at boundaries,
        // exploiting the large-but-finite likelihood just above alpha = 0.
        const data = new dist.BetaRectangular(0.8, 0.8, 0.6, 0, 10).seed(7).sample(300)
        const result = dist.BetaRectangular.fit(data)
        assert(result instanceof dist.BetaRectangular)
        assert(result.p.alpha > 0.3, `alpha ${result.p.alpha} is near-singular`)
        assert(result.p.beta > 0.3, `beta ${result.p.beta} is near-singular`)
      })

      it('Weibull._fitInit should handle constant data', () => {
        // || 1 guard: zero variance in constant data falls back to 1
        const init = dist.Weibull._fitInit([3, 3, 3])
        assert(init[0] > 0 && init[1] > 0)
      })

      it('InvertedWeibull._fitInit should handle constant data', () => {
        // || 1 guard: zero variance in constant reciprocals falls back to 1
        const init = dist.InvertedWeibull._fitInit([2, 2, 2])
        assert(init[0] > 0)
      })
    })
  })
})
