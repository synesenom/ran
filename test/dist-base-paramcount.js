import { assert } from 'chai'
import { describe, it } from 'mocha'
import * as dist from '../src/dist'

describe('dist', () => {
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
    {
      name: 'BetaBinomial',
      ctor: () => new dist.BetaBinomial(5, 2, 3),
      k: 3,
      inherited: '2 from Categorical',
      // BetaBinomial is discrete with support {0, ..., n}, so the default (continuous-oriented) sample
      // would only work via Distribution.pdf()'s implicit _toInt() rounding; use explicit integers instead.
      sample: [0, 1, 2, 3, 4, 5, 1, 2, 3, 4]
    },
    // issue #1094
    {
      name: 'Hypergeometric',
      ctor: () => new dist.Hypergeometric(20, 7, 5),
      k: 3,
      inherited: '2 from Categorical',
      // Support is {max(0, n+K-N), ..., min(n, K)} = {0, ..., 5} here; use explicit integers.
      sample: [0, 1, 2, 3, 4, 5, 2, 3, 1, 4]
    },
    {
      name: 'NegativeHypergeometric',
      ctor: () => new dist.NegativeHypergeometric(20, 5, 3),
      k: 3,
      inherited: '2 from Categorical',
      // Support is {0, ..., K} = {0, ..., 5} here; use explicit integers.
      sample: [0, 1, 2, 3, 4, 5, 1, 2, 3, 4]
    },
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
    },
    // issue #1083: audited and found k=2 (not 4) is correct — DoublyNoncentralChi2's pdf/cdf
    // depend on k1, k2, lambda1, lambda2 only through the sums k1+k2 and lambda1+lambda2, so only
    // 2 of the 4 constructor arguments are statistically identifiable. This guards against a future
    // regression to this.k = 4, which would over-penalize aic()/bic() for a non-identifiability
    // the model doesn't actually have.
    { name: 'DoublyNoncentralChi2', ctor: () => new dist.DoublyNoncentralChi2(2, 3, 1, 2), k: 2, inherited: '4 (the nominal constructor arity, not the identifiable dimension)' }
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
