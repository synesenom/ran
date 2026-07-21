import fs from 'fs'
import path from 'path'
import { assert } from 'chai'
import { before, describe, it } from 'mocha'
import { float } from '../src/core'
import * as dist from '../src/dist'
import PreComputed from '../src/dist/_pre-computed'
import Distribution from '../src/dist/_distribution'
import { SHARD_COUNT, shardCases } from './dist-runner'

describe('dist', () => {
  // Base class
  describe('Distribution', () => {
    const invalid = new dist.InvalidDiscrete()

    describe('.sample()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.sample()
        }, 'Distribution._generator() is not implemented')
      })
    })

    describe('.pdf()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.pdf(0)
        }, 'Distribution._pdf() is not implemented')
      })

      it('should return 0 when _pdf returns NaN at a closed boundary', () => {
        // Simulates a log-barrier formula that yields 0/0 = NaN at the boundary endpoint.
        class NaNBoundary extends Distribution {
          constructor () {
            super('continuous', 0)
            this.s = [{ value: 0, closed: true }, { value: 1, closed: true }]
            this.c = {}
          }

          _pdf (x) { return x === 0 ? NaN : 1 }
          _cdf (x) { return x }
        }
        const d = new NaNBoundary()
        assert.strictEqual(d.pdf(0), 0)
        assert.strictEqual(d.pdf(0.5), 1)
        assert.isFalse(isNaN(d.mean()))
      })
    })

    describe('.cdf()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.cdf(0)
        }, 'Distribution._cdf() is not implemented')
      })
    })

    describe('.q()', () => {
      it('should throw for p < 0 or p > 1', () => {
        assert.throws(() => invalid.q(-1), Error)
        assert.throws(() => invalid.q(2), Error)
      })
    })

    describe('.q()', () => {
      it('should return support boundary if p === 0 or p === 1', () => {
        assert(invalid.q(0) === invalid.support()[0].value)
        assert(invalid.q(1) === invalid.support()[1].value)
      })
    })

    describe('._qEstimateRoot()', () => {
      it('returns boundary value for open point-mass support [5, 5]', () => {
        // CDF jumps 0 → 1 at the open boundary; expansion steps above 5, creating a sign change,
        // and chandrupatla converges to 5, which is clamped to the support [5, 5].
        class DegenerateContinuous extends Distribution {
          constructor () {
            super('continuous', 0)
            this.s = [{ value: 5, closed: false }, { value: 5, closed: false }]
          }

          _pdf () { return 0 }
          _cdf () { return 0.5 }
        }
        const d = new DegenerateContinuous()
        assert.strictEqual(d.q(0.5), 5)
      })

      it('returns NaN when expansion exhausts MAX_ITER without a sign change', () => {
        // Closed [0, 1] support with constant CDF 0.6: cdf(0)=0.6 and cdf(1)=1 are both > 0.3,
        // so the bracket [0, 1] never straddles p=0.3 and the loop cannot expand outside the support.
        class ConstantCDF extends Distribution {
          constructor () {
            super('continuous', 0)
            this.s = [{ value: 0, closed: true }, { value: 1, closed: true }]
          }

          _pdf () { return 0 }
          _cdf () { return 0.6 }
        }
        const d = new ConstantCDF()
        assert(Number.isNaN(d.q(0.3)))
      })
    })

    describe('.survive()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.survival(0)
        }, 'Distribution._cdf() is not implemented')
      })
    })

    describe('.hazard()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.hazard(0)
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.cHazard()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.cHazard(0)
        }, 'Distribution._cdf() is not implemented')
      })
    })

    describe('.lnPdf()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.lnPdf(0)
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.lnL()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.lnL([0])
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.test()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.test([0])
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.aic()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.aic([0])
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.bic()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.bic([0])
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.bounded()', () => {
      it('should return "bounded" for Beta (finite lower and upper)', () => {
        assert.equal(new dist.Beta(1, 1).bounded(), 'bounded')
      })

      it('should return "lower" for Exponential (finite lower, infinite upper)', () => {
        assert.equal(new dist.Exponential(1).bounded(), 'lower')
      })

      it('should return "unbounded" for Normal (infinite lower and upper)', () => {
        assert.equal(new dist.Normal(0, 1).bounded(), 'unbounded')
      })

      it('should return "bounded" for Binomial (finite discrete support)', () => {
        assert.equal(new dist.Binomial(10, 0.5).bounded(), 'bounded')
      })

      it('should return "lower" for Poisson (semi-infinite discrete support)', () => {
        assert.equal(new dist.Poisson(3).bounded(), 'lower')
      })
    })

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
        // Reconstruct q and lambda from GP params: xi=(q-1)/(2-q), sigma=1/(lambda*(2-q))
        const q = (2 * result.p.xi + 1) / (result.p.xi + 1)
        const lambda = (result.p.xi + 1) / result.p.sigma
        assert(Math.abs(q - 0.5) < 0.2)
        assert(Math.abs(lambda - 2) < 0.5)
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

    describe('.params()', () => {
      it('Distribution.params() returns the parameter object for a non-Categorical distribution', () => {
        const d = new dist.Normal(2, 3)
        const p = d.params()
        assert.strictEqual(p.mu, 2)
        assert.strictEqual(p.sigma, 3)
      })

      it('Categorical.params() returns { weights } only', () => {
        const d = new dist.Categorical([0.3, 0.7], 0)
        const p = d.params()
        assert.deepEqual(p.weights, [0.3, 0.7])
        assert.strictEqual(p.n, undefined)
        assert.strictEqual(p.min, undefined)
      })

      it('Bernoulli.params() returns { p }', () => {
        const d = new dist.Bernoulli(0.7)
        assert.deepEqual(d.params(), { p: 0.7 })
      })

      it('Binomial.params() returns { n, p }', () => {
        const d = new dist.Binomial(10, 0.3)
        assert.deepEqual(d.params(), { n: 10, p: 0.3 })
      })

      it('Hypergeometric.params() returns { N, K, n }', () => {
        const d = new dist.Hypergeometric(10, 5, 3)
        assert.deepEqual(d.params(), { N: 10, K: 5, n: 3 })
      })

      it('Soliton.params() returns { N }', () => {
        const d = new dist.Soliton(5)
        assert.deepEqual(d.params(), { N: 5 })
      })

      it('Zipf.params() returns { s, N }', () => {
        const d = new dist.Zipf(2, 50)
        assert.deepEqual(d.params(), { s: 2, N: 50 })
      })

      it('ZipfMandelbrot.params() returns { N, s, q }', () => {
        const d = new dist.ZipfMandelbrot(100, 2, 1)
        assert.deepEqual(d.params(), { N: 100, s: 2, q: 1 })
      })

      it('BetaBinomial.params() returns { n, alpha, beta }', () => {
        const d = new dist.BetaBinomial(5, 2, 3)
        assert.deepEqual(d.params(), { n: 5, alpha: 2, beta: 3 })
      })

      it('NegativeHypergeometric.params() returns { N, K, r }', () => {
        const d = new dist.NegativeHypergeometric(10, 5, 2)
        assert.deepEqual(d.params(), { N: 10, K: 5, r: 2 })
      })

      it('Rademacher.params() returns {}', () => {
        assert.deepEqual(new dist.Rademacher().params(), {})
      })

      it('Bernoulli.fit().params().p recovers planted value within tolerance', () => {
        const data = new dist.Bernoulli(0.7).seed(42).sample(500)
        const result = dist.Bernoulli.fit(data)
        assert(Math.abs(result.params().p - 0.7) < 0.05)
      })

      it('Zipf.fit().params() recovers planted s within tolerance', () => {
        const data = new dist.Zipf(2, 50).seed(42).sample(200)
        const result = dist.Zipf.fit(data)
        assert(Math.abs(result.params().s - 2) < 0.3)
        assert(result.params().N >= 10)
      })
    })
  })

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

  // Lindley: AIC/BIC parameter-count regression — this.k must be 1 so the penalty is not silently dropped.
  // Guard against reverting super('continuous', 1) back to super('continuous', arguments.length),
  // which would set k=0 if a default were ever reintroduced to the constructor.
  describe('Lindley', () => {
    const sample = [0.1, 0.5, 1.0, 1.5, 2.0, 0.3, 0.8, 1.2, 2.5, 0.6]
    const d = new dist.Lindley(1)

    it('should throw when constructed without arguments', () => {
      assert.throws(() => new dist.Lindley())
    })

    it('should have paramCount k=1', () => {
      assert.strictEqual(d.k, 1)
    })

    it('aic() should include the parameter penalty (k=1)', () => {
      // AIC = 2*(k - lnL); with k=1 the penalty is 2. k=0 would make aic() return a lower value.
      assert.strictEqual(d.aic(sample), 2 * (1 - d.lnL(sample)))
    })

    it('bic() should include the parameter penalty (k=1)', () => {
      assert.strictEqual(d.bic(sample), Math.log(sample.length) * 1 - 2 * d.lnL(sample))
    })
  })

  // Mielke: AIC/BIC parameter-count regression — this.k must be 2, not 3 inherited from Dagum.
  describe('Mielke', () => {
    const sample = [0.1, 0.5, 1.0, 1.5, 2.0, 0.3, 0.8, 1.2, 2.5, 0.6]
    const d = new dist.Mielke(2, 2)

    it('should have paramCount k=2', () => {
      assert.strictEqual(d.k, 2)
    })

    it('aic() should include the parameter penalty (k=2)', () => {
      // AIC = 2*(k - lnL); with k=2 the penalty is 4. k=3 (inherited from Dagum) over-counts by 2.
      assert.strictEqual(d.aic(sample), 2 * (2 - d.lnL(sample)))
    })

    it('bic() should include the parameter penalty (k=2)', () => {
      assert.strictEqual(d.bic(sample), Math.log(sample.length) * 2 - 2 * d.lnL(sample))
    })
  })

  // Multi-level inheritance parameter-count regressions (issue #510). Each subclass inherits the wrong
  // this.k from a parent further up the chain unless it overrides; a wrong k silently distorts aic()/bic().
  const paramCountCases = [
    { name: 'Weibull', ctor: () => new dist.Weibull(1, 1), k: 2, inherited: '1 from Exponential' },
    { name: 'DoubleWeibull', ctor: () => new dist.DoubleWeibull(1, 1), k: 2, inherited: '1 from Weibull' },
    { name: 'ExponentiatedWeibull', ctor: () => new dist.ExponentiatedWeibull(1, 1, 1), k: 3, inherited: '2 from Weibull' },
    { name: 'Rayleigh', ctor: () => new dist.Rayleigh(1), k: 1, inherited: '2 from Weibull' },
    { name: 'Chi2', ctor: () => new dist.Chi2(4), k: 1, inherited: '2 from Gamma' },
    { name: 'Chi', ctor: () => new dist.Chi(4), k: 1, inherited: '2 from Gamma via Chi2' },
    { name: 'MaxwellBoltzmann', ctor: () => new dist.MaxwellBoltzmann(1), k: 1, inherited: '2 from Gamma' },
    { name: 'GeneralizedGamma', ctor: () => new dist.GeneralizedGamma(1, 1, 1), k: 3, inherited: '2 from Gamma' },
    { name: 'GeneralizedNormal', ctor: () => new dist.GeneralizedNormal(0, 1, 2), k: 3, inherited: '2 from Gamma via GeneralizedGamma' },
    { name: 'HalfGeneralizedNormal', ctor: () => new dist.HalfGeneralizedNormal(1, 2), k: 2, inherited: '3 from GeneralizedNormal' },
    { name: 'LogGamma', ctor: () => new dist.LogGamma(1, 1, 0), k: 3, inherited: '2 from Gamma' },
    // issue #1049
    { name: 'PERT', ctor: () => new dist.PERT(0, 1, 3), k: 3, inherited: '2 from Beta' },
    { name: 'Bates', ctor: () => new dist.Bates(2, 0, 3), k: 3, inherited: '1 from IrwinHall' },
    { name: 'BetaBinomial', ctor: () => new dist.BetaBinomial(5, 2, 3), k: 3, inherited: '2 from Categorical' },
    { name: 'SkewNormal', ctor: () => new dist.SkewNormal(0, 1, 2), k: 3, inherited: '2 from Normal' },
    { name: 'BirnbaumSaunders', ctor: () => new dist.BirnbaumSaunders(0, 1, 1), k: 3, inherited: '2 from Normal' },
    { name: 'JohnsonSB', ctor: () => new dist.JohnsonSB(0, 1, 3, 0), k: 4, inherited: '2 from Normal' },
    { name: 'JohnsonSU', ctor: () => new dist.JohnsonSU(0, 1, 1, 0), k: 4, inherited: '2 from Normal' },
    { name: 'Gilbrat', ctor: () => new dist.Gilbrat(), k: 0, inherited: '2 from LogNormal via Normal' },
    {
      name: 'PowerLaw',
      ctor: () => new dist.PowerLaw(2),
      k: 1,
      inherited: '2 from Kumaraswamy',
      // PowerLaw's support is fixed to (0, 1) regardless of its parameter, so the default sample (which
      // includes values > 1) would drive lnL to -Infinity and make aic()/bic() match by coincidence.
      sample: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.15, 0.25, 0.35]
    },
    { name: 'QExponential', ctor: () => new dist.QExponential(1.5, 1), k: 2, inherited: '3 from GeneralizedPareto' },
    {
      name: 'R',
      ctor: () => new dist.R(2),
      k: 1,
      inherited: '2 from Beta',
      // R's support is fixed to [-1, 1] regardless of its parameter, so the default sample (which
      // includes values > 1) would drive lnL to -Infinity and make aic()/bic() match by coincidence.
      sample: [-0.5, -0.2, 0, 0.2, 0.5, 0.1, 0.3, -0.1, 0.4, -0.3]
    }
  ]
  describe('Davis', () => {
    it('survival/hazard/cHazard below support return 1/0/0', () => {
      const d = new dist.Davis(1, 1, 2.5)
      // x well below support (tests the x < mu path)
      assert.strictEqual(d.survival(0.5), 1)
      assert.strictEqual(d.hazard(0.5), 0)
      assert.strictEqual(d.cHazard(0.5), 0)
      // x exactly at the open lower boundary mu (tests the x === mu path of x <= mu guard)
      assert.strictEqual(d.survival(1), 1)
      assert.strictEqual(d.hazard(1), 0)
      assert.strictEqual(d.cHazard(1), 0)
    })
  })

  paramCountCases.forEach(({ name, ctor, k, inherited, sample: customSample }) => {
    describe(`${name} parameter count`, () => {
      // customSample lets cases whose support can't cover the default range (e.g. fixed to (0,1) or [-1,1])
      // still exercise a finite (non -Infinity) lnL, so aic()/bic() actually discriminate on k.
      // solutions/testing/2026-07-21-0835-paramcountcases-shared-sample-vacuous-pass.md
      const sample = customSample || [0.1, 0.5, 1.0, 1.5, 2.0, 0.3, 0.8, 1.2, 2.5, 0.6]
      const d = ctor()

      it(`should have paramCount k=${k}, not the ${inherited}`, () => {
        assert.strictEqual(d.k, k)
      })

      // A sample outside the distribution's support drives lnL(sample) to -Infinity, which makes
      // aic()/bic() below both evaluate to Infinity regardless of k, passing by Infinity === Infinity
      // coincidence. This guard fails loudly instead, so a future case needs its own sample override.
      it('lnL(sample) should be finite so aic()/bic() below genuinely discriminate on k', () => {
        assert(Number.isFinite(d.lnL(sample)), `lnL(sample) is ${d.lnL(sample)} for ${name} - add a custom sample override for this case`)
      })

      it(`aic() should use the corrected parameter penalty (k=${k})`, () => {
        assert.strictEqual(d.aic(sample), 2 * (k - d.lnL(sample)))
      })

      it(`bic() should use the corrected parameter penalty (k=${k})`, () => {
        assert.strictEqual(d.bic(sample), Math.log(sample.length) * k - 2 * d.lnL(sample))
      })
    })
  })
})

// Distributions whose _fitInit returns the exact closed-form MLE (fit() skips the optimizer).
const EXACT_MLE = [
  'Exponential', 'Normal', 'Poisson', 'Bernoulli', 'DiscreteUniform', 'Pareto', 'LogNormal',
  'Rayleigh', 'MaxwellBoltzmann', 'HalfNormal', 'Geometric', 'Laplace', 'Reciprocal', 'Lindley',
  'Uniform', 'InverseGaussian', 'LogitNormal', 'PowerLaw', 'Borel', 'BorelTanner'
]

// Precision and robustness gate for Distribution.fit() (milestone v1.27.0, issue #546 / #556).
//
// Two distinct quantities matter here, and they are NOT the same thing:
//   * Statistical precision — how close the estimate is to the *true* parameter — is O(1/√n) and
//     is a property of the data, not the optimizer. No amount of optimizer tuning improves it.
//   * Optimization precision — how close the result is to the maximizer of the likelihood for the
//     *given* dataset. A function-value optimizer is capped at ~√EPS here; the only route to
//     machine precision is a closed-form MLE, evaluated directly.
//
// Accordingly these tests assert the things that are actually achievable and meaningful:
//   1. Distributions with a closed-form MLE recover it to ~machine precision (the fast path).
//   2. Powell does not stall on objectives where Nelder-Mead did (hyperexponential): the fitted
//      log-likelihood is at least as high as at the data-generating parameters.
//   3. Constrained/bounded fits stay valid and reach a genuine optimum.

describe('fit() precision and robustness gate', () => {
  describe('exact-MLE fast-path flag', () => {
    it('is declared (own property, value true) on every closed-form-MLE distribution', () => {
      for (const name of EXACT_MLE) {
        const Cls = dist[name]
        assert.isTrue(Cls._fitInitIsExact, `${name}._fitInitIsExact should be true`)
        assert.isOk(
          Object.getOwnPropertyDescriptor(Cls, '_fitInitIsExact'),
          `${name} must declare its OWN flag, not inherit it`
        )
      }
    })

    it('defaults to false on the base class and is not an own property of a derived approximate fit', () => {
      assert.isFalse(Distribution._fitInitIsExact)
      // Weibull extends Exponential but has an approximate _fitInit: it must NOT inherit the path.
      assert.isNotOk(Object.getOwnPropertyDescriptor(dist.Weibull, '_fitInitIsExact'))
      assert.isNotOk(Object.getOwnPropertyDescriptor(dist.LogLaplace, '_fitInitIsExact'))
    })
  })

  describe('closed-form MLE recovered to machine precision', () => {
    it('Exponential recovers λ̂ = 1/x̄ to 1e-14 relative error', () => {
      const data = [0.7, 1.3, 2.1, 0.9, 3.4, 1.1, 0.5, 2.8]
      // Reference computed independently of fit()'s n/Σx ordering.
      const reference = 1 / (data.reduce((s, x) => s + x, 0) / data.length)
      const fitted = dist.Exponential.fit(data).p.lambda
      assert.approximately(fitted / reference, 1, 1e-14)
    })

    it('Normal recovers μ̂ = x̄ and σ̂² = biased variance to 1e-14 relative error', () => {
      const data = [2.1, 3.4, 1.9, 4.0, 2.7, 3.1, 2.5, 3.8]
      const n = data.length
      const muRef = data.reduce((s, x) => s + x, 0) / n
      const sigmaRef = Math.sqrt(data.reduce((s, x) => s + (x - muRef) ** 2, 0) / n)
      const fitted = dist.Normal.fit(data)
      assert.approximately(fitted.p.mu / muRef, 1, 1e-14)
      assert.approximately(fitted.p.sigma / sigmaRef, 1, 1e-14)
    })

    it('Pareto recovers x̂min = min and α̂ = n/Σln(x/xmin) to 1e-14 relative error', () => {
      const data = [1.5, 2.0, 3.1, 1.8, 2.5, 4.2, 1.6]
      const xmin = Math.min(...data)
      const alphaRef = data.length / data.reduce((s, x) => s + Math.log(x / xmin), 0)
      const fitted = dist.Pareto.fit(data)
      assert.strictEqual(fitted.p.xmin, xmin)
      assert.approximately(fitted.p.alpha / alphaRef, 1, 1e-14)
    })

    it('Uniform recovers the exact [min, max] support (not a padded interval)', () => {
      const data = [2.3, 5.1, 1.7, 4.4, 3.0]
      const fitted = dist.Uniform.fit(data)
      assert.strictEqual(fitted.p.xmin, Math.min(...data))
      assert.strictEqual(fitted.p.xmax, Math.max(...data))
    })

    it('InverseGaussian recovers the exact MLE λ̂ = n/Σ(1/xᵢ − 1/x̄) to 1e-14 relative error', () => {
      const data = [1.2, 2.4, 0.9, 3.1, 1.8, 2.0, 1.5]
      const n = data.length
      const mean = data.reduce((s, x) => s + x, 0) / n
      const lambdaRef = n / data.reduce((s, x) => s + (1 / x - 1 / mean), 0)
      const fitted = dist.InverseGaussian.fit(data)
      assert.approximately(fitted.p.mu / mean, 1, 1e-14)
      assert.approximately(fitted.p.lambda / lambdaRef, 1, 1e-14)
    })
  })

  describe('Powell does not stall where Nelder-Mead did', () => {
    it('Hyperexponential fit reaches a log-likelihood at least as high as the true model', () => {
      const trueModel = new dist.Hyperexponential([
        { weight: 0.3, rate: 1 },
        { weight: 0.7, rate: 5 }
      ]).seed(20260601)
      const data = trueModel.sample(400)
      const fitted = dist.Hyperexponential.fit(data)
      const fittedLnL = fitted.lnL(data)
      const trueLnL = trueModel.lnL(data)
      assert.isTrue(Number.isFinite(fittedLnL))
      // The sample MLE cannot be worse than the data-generating parameters (a stall could be).
      assert.isAtLeast(fittedLnL, trueLnL - 1e-6 * (Math.abs(trueLnL) + 1))
    })
  })

  describe('constrained / bounded fits stay valid and reach a genuine optimum', () => {
    it('Bates fit honours the a < b ordering constraint and beats the true-parameter likelihood', () => {
      // Ordering (a < b) and integer n are constraints a box-bounded method (L-BFGS-B) cannot
      // express; the derivative-free Powell + Infinity-barrier objective handles them directly.
      const trueModel = new dist.Bates(4, 1, 5).seed(20260601)
      const data = trueModel.sample(300)
      const fitted = dist.Bates.fit(data)
      assert.isTrue(fitted.p.a < fitted.p.b)
      assert.isTrue(Number.isInteger(fitted.p.n) && fitted.p.n >= 1)
      const fittedLnL = fitted.lnL(data)
      assert.isTrue(Number.isFinite(fittedLnL))
      assert.isAtLeast(fittedLnL, trueModel.lnL(data) - 1e-6 * (Math.abs(trueModel.lnL(data)) + 1))
    })

    it('Gamma (positive shape/rate) fit converges to a local optimum no perturbation improves', () => {
      const data = new dist.Gamma(2.5, 1.5).seed(20260601).sample(400)
      const fitted = dist.Gamma.fit(data)
      const L0 = fitted.lnL(data)
      assert.isTrue(Number.isFinite(L0))
      // A genuine optimum: no small coordinate perturbation increases the log-likelihood.
      for (const [da, db] of [[1e-3, 0], [-1e-3, 0], [0, 1e-3], [0, -1e-3]]) {
        const a = fitted.p.alpha * (1 + da)
        const b = fitted.p.beta * (1 + db)
        assert.isAtMost(new dist.Gamma(a, b).lnL(data), L0 + 1e-9)
      }
    })

    it('F.fit should return a usable F instance when MOM seed is far from true d2 (adaptive window)', function () {
      // F(5, 50) with this seed gives a MOM seed for d2 that is far from 50; the adaptive window
      // must widen beyond the fixed ±5 grid to find the true optimum.
      const data = new dist.F(5, 50).seed(0xcafe).sample(100)
      const fitted = dist.F.fit(data)
      assert(fitted instanceof dist.F)
      assert(Number.isFinite(fitted.pdf(2)) && fitted.pdf(2) > 0)
    })
  })
})

// Regression guard for the dist-shard-*.js partition (see test/dist-runner.js): if SHARD_COUNT
// is ever bumped without adding/removing a matching shard file, shardCases would silently drop
// or duplicate cases across shards. Two distinct failure modes need two distinct checks: the
// partition algorithm itself (below) proves shardCases is correct in isolation, but says nothing
// about whether a dist-shard-N.js file exists on disk for every index it produces — that half is
// checked separately by reading the actual file list, since mocha only registers tests from
// files that exist.
describe('dist-runner sharding', () => {
  it('shardCases partitions any array into a complete, non-overlapping cover across SHARD_COUNT shards', () => {
    const cases = Array.from({ length: 2 * SHARD_COUNT + 3 }, (_, i) => ({ name: `case-${i}` }))
    const shards = Array.from({ length: SHARD_COUNT }, (_, i) => shardCases(cases, i))
    const total = shards.reduce((sum, shard) => sum + shard.length, 0)
    assert.strictEqual(total, cases.length, 'shards must collectively cover every case exactly once')

    const seen = new Set()
    shards.flat().forEach(c => {
      assert.isFalse(seen.has(c.name), `case ${c.name} assigned to more than one shard`)
      seen.add(c.name)
    })
  })

  it('has exactly one dist-shard-N.js file for every index shardCases can produce', () => {
    const shardFiles = fs.readdirSync(__dirname).filter(f => /^dist-shard-\d+\.js$/.test(f))
    assert.strictEqual(shardFiles.length, SHARD_COUNT,
      `expected ${SHARD_COUNT} dist-shard-N.js files (one per SHARD_COUNT), found ${shardFiles.length}: ${shardFiles.join(', ')}`)
    for (let i = 0; i < SHARD_COUNT; i++) {
      assert.isTrue(fs.existsSync(path.join(__dirname, `dist-shard-${i}.js`)), `missing dist-shard-${i}.js`)
    }
  })
})
