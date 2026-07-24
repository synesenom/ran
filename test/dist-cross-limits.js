import { assert } from 'chai'
import { describe, it } from 'mocha'
import * as dist from '../src/dist'

// Cross-distribution limiting-case regression tests.
//
// Each case instantiates two independently-implemented distribution classes and
// checks that one converges to the other in a known mathematical limit (or, for the
// gamma/chi2 special cases, an exact identity). Per-distribution mpmath refVals can't
// catch a parameterization bug (e.g. rate vs. scale) that is consistent within a
// single distribution's own formula; comparing two independently-written
// implementations against each other at a shared limit can.
describe('dist', () => {
  describe('cross-distribution limits', () => {
    it('StudentT(nu) converges to Normal(0, 1) as nu -> Infinity', () => {
      const t = new dist.StudentT(1e6)
      const normal = new dist.Normal(0, 1)

      ;[-2, -1, -0.5, 0, 0.5, 1, 2].forEach(x => {
        assert.closeTo(t.pdf(x), normal.pdf(x), 1e-5)
        assert.closeTo(t.cdf(x), normal.cdf(x), 1e-5)
      })
      ;[0.05, 0.25, 0.5, 0.75, 0.95].forEach(p => {
        assert.closeTo(t.q(p), normal.q(p), 1e-5)
      })
    })

    it('StudentT(nu) approaches Normal(0, 1) with a Cornish-Fisher-bounded gap at moderate nu', () => {
      // nu=1e6 above is too extreme to catch a nu-scaling bug (e.g. nu confused with nu/2):
      // both the correct and a scaled-nu formula would land within 1e-5 of the normal limit.
      // At nu=300 the leading Cornish-Fisher correction term, (z^3+z)/(4*nu) (A&S 26.7.8),
      // is on the order of 1e-3 for the p values below, so a factor-of-2 error in nu is
      // large enough to exceed this tolerance while the correct implementation stays within it.
      const nu = 300
      const t = new dist.StudentT(nu)
      const normal = new dist.Normal(0, 1)

      ;[0.05, 0.25, 0.5, 0.75, 0.95].forEach(p => {
        assert.closeTo(t.q(p), normal.q(p), 7e-3)
      })
    })

    it('Binomial(n, p) converges to Poisson(n * p) as n -> Infinity, p -> 0', () => {
      const lambda = 10
      const n = 1e5
      const p = lambda / n
      const binomial = new dist.Binomial(n, p)
      const poisson = new dist.Poisson(lambda)

      ;[0, 3, 7, 10, 15, 20].forEach(k => {
        assert.closeTo(binomial.pdf(k), poisson.pdf(k), 1e-3)
        assert.closeTo(binomial.cdf(k), poisson.cdf(k), 1e-3)
      })
      ;[0.1, 0.5, 0.9].forEach(pp => {
        assert.strictEqual(binomial.q(pp), poisson.q(pp))
      })
    })

    it('Gamma(1, beta) equals Exponential(beta) exactly (shape-1 special case)', () => {
      // ranjs' Gamma uses shape/rate parametrization, so alpha=1 with rate beta
      // reduces to Exponential(beta) exactly -- not merely in a limit.
      const beta = 2.5
      const gamma = new dist.Gamma(1, beta)
      const exponential = new dist.Exponential(beta)

      ;[0, 0.1, 0.5, 1, 2, 5].forEach(x => {
        assert.closeTo(gamma.pdf(x), exponential.pdf(x), 1e-10)
        assert.closeTo(gamma.cdf(x), exponential.cdf(x), 1e-10)
      })
      ;[0.1, 0.5, 0.9].forEach(p => {
        assert.closeTo(gamma.q(p), exponential.q(p), 1e-8)
      })
    })

    it('Chi2(2) equals Exponential(0.5) exactly (2 degrees of freedom special case)', () => {
      // Chi2(k) is Gamma(k/2, 0.5); at k=2 that is Gamma(1, 0.5), i.e. Exponential(0.5).
      const chi2 = new dist.Chi2(2)
      const exponential = new dist.Exponential(0.5)

      ;[0, 0.5, 1, 2, 4, 8].forEach(x => {
        assert.closeTo(chi2.pdf(x), exponential.pdf(x), 1e-10)
        assert.closeTo(chi2.cdf(x), exponential.cdf(x), 1e-10)
      })
      ;[0.1, 0.5, 0.9].forEach(p => {
        assert.closeTo(chi2.q(p), exponential.q(p), 1e-8)
      })
    })

    it('NegativeBinomial(r, p) converges to Poisson(lambda) as r -> Infinity', () => {
      const lambda = 10
      const r = 1e6
      const p = lambda / (r + lambda)
      const negativeBinomial = new dist.NegativeBinomial(r, p)
      const poisson = new dist.Poisson(lambda)

      ;[0, 3, 7, 10, 15, 20].forEach(k => {
        assert.closeTo(negativeBinomial.pdf(k), poisson.pdf(k), 1e-3)
        assert.closeTo(negativeBinomial.cdf(k), poisson.cdf(k), 1e-3)
      })
      ;[0.1, 0.5, 0.9].forEach(pp => {
        assert.strictEqual(negativeBinomial.q(pp), poisson.q(pp))
      })
    })
  })
})
