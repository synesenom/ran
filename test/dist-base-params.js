import { assert } from 'chai'
import { describe, it } from 'mocha'
import * as dist from '../src/dist'

describe('dist', () => {
  describe('Distribution', () => {
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

      it('PowerLaw.params() returns { a }', () => {
        const d = new dist.PowerLaw(2)
        assert.deepEqual(d.params(), { a: 2 })
      })

      it('Gilbrat.params() returns {}', () => {
        assert.deepEqual(new dist.Gilbrat().params(), {})
      })

      it('R.params() returns { c }', () => {
        const d = new dist.R(4)
        assert.deepEqual(d.params(), { c: 4 })
      })

      it('PERT.params() returns { a, b, c }', () => {
        const d = new dist.PERT(5, 15, 25)
        assert.deepEqual(d.params(), { a: 5, b: 15, c: 25 })
      })

      it('JohnsonSU.params() returns { gamma, delta, lambda, xi }', () => {
        // Distinct values so a key transposition (e.g. gamma/xi or delta/lambda swapped) would fail
        const d = new dist.JohnsonSU(1, 2, 3, 4)
        assert.deepEqual(d.params(), { gamma: 1, delta: 2, lambda: 3, xi: 4 })
      })

      it('JohnsonSB.params() returns { gamma, delta, lambda, xi }', () => {
        // Distinct values so a key transposition (e.g. gamma/xi or delta/lambda swapped) would fail
        const d = new dist.JohnsonSB(1, 2, 3, 4)
        assert.deepEqual(d.params(), { gamma: 1, delta: 2, lambda: 3, xi: 4 })
      })

      it('SkewNormal.params() returns { xi, omega, alpha }', () => {
        // Distinct values so an omega/alpha transposition would fail
        const d = new dist.SkewNormal(1, 2, 3)
        assert.deepEqual(d.params(), { xi: 1, omega: 2, alpha: 3 })
      })

      it('BirnbaumSaunders.params() returns { mu, beta, gamma }', () => {
        // Distinct values so a beta/gamma transposition would fail
        const d = new dist.BirnbaumSaunders(1, 2, 3)
        assert.deepEqual(d.params(), { mu: 1, beta: 2, gamma: 3 })
      })

      it('BirnbaumSaunders.params().mu holds the constructor value, not the leaked Normal(0,1) placeholder', () => {
        const d = new dist.BirnbaumSaunders(5, 2, 2)
        assert.strictEqual(d.params().mu, 5)
      })

      it('QExponential.params() returns { q, lambda }', () => {
        // Distinct values so a q/lambda transposition would fail
        const d = new dist.QExponential(0.5, 2)
        assert.deepEqual(d.params(), { q: 0.5, lambda: 2 })
      })

      it('F.params() returns { d1, d2 }', () => {
        const d = new dist.F(4, 6)
        assert.deepEqual(d.params(), { d1: 4, d2: 6 })
      })

      it('BaldingNichols.params() returns { F, p }', () => {
        // Distinct values so an F/p transposition would fail
        const d = new dist.BaldingNichols(0.2, 0.3)
        assert.deepEqual(d.params(), { F: 0.2, p: 0.3 })
      })

      it('Weibull.params() returns { lambda, k }', () => {
        const d = new dist.Weibull(2, 3)
        assert.deepEqual(d.params(), { lambda: 2, k: 3 })
      })

      it('Weibull.params().lambda holds the constructor value, not the leaked Exponential(1) placeholder', () => {
        const d = new dist.Weibull(2, 3)
        assert.strictEqual(d.params().lambda, 2)
      })

      it('ExponentiatedWeibull.params() returns { lambda, k, alpha }', () => {
        const d = new dist.ExponentiatedWeibull(2, 3, 1.5)
        assert.deepEqual(d.params(), { lambda: 2, k: 3, alpha: 1.5 })
      })

      it('GeneralizedGamma.params() returns { a, d, p }', () => {
        const d = new dist.GeneralizedGamma(2, 3, 1.5)
        assert.deepEqual(d.params(), { a: 2, d: 3, p: 1.5 })
      })

      it('GeneralizedNormal.params() returns { mu, alpha, beta }', () => {
        const d = new dist.GeneralizedNormal(1, 2, 3)
        assert.deepEqual(d.params(), { mu: 1, alpha: 2, beta: 3 })
      })

      it('GeneralizedNormal.params().alpha/.beta hold the constructor values, not routed through the alpha2/beta2 workaround', () => {
        const d = new dist.GeneralizedNormal(1, 2, 3)
        assert.strictEqual(d.params().alpha, 2)
        assert.strictEqual(d.params().beta, 3)
      })

      it('NoncentralF.params() returns { d1, d2, lambda }', () => {
        const d = new dist.NoncentralF(4, 6, 2)
        assert.deepEqual(d.params(), { d1: 4, d2: 6, lambda: 2 })
      })

      it('DoublyNoncentralF.params() returns { d1, d2, lambda1, lambda2 }', () => {
        // Distinct values so a lambda1/lambda2 transposition would fail
        const d = new dist.DoublyNoncentralF(4, 6, 1, 2)
        assert.deepEqual(d.params(), { d1: 4, d2: 6, lambda1: 1, lambda2: 2 })
      })

      it('DoublyNoncentralChi2.params() returns { k1, k2, lambda1, lambda2 }', () => {
        // Distinct values so a k1/k2 or lambda1/lambda2 transposition would fail
        const d = new dist.DoublyNoncentralChi2(2, 3, 1, 2)
        assert.deepEqual(d.params(), { k1: 2, k2: 3, lambda1: 1, lambda2: 2 })
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
})
