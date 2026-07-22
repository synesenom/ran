import { assert } from 'chai'
import { describe, it } from 'mocha'
import * as dist from '../src/dist'
import Distribution from '../src/dist/_distribution'

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
