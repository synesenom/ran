import { assert } from 'chai'
import { describe, it } from 'mocha'
import * as dist from '../src/dist'
import Distribution from '../src/dist/_distribution'
import { guess } from '../src/dist/guess'

// A minimal fake continuous distribution whose fit() always throws, used to verify
// that guess() skips (rather than propagates) a candidate whose .fit() call fails
// after successfully surviving hard/soft filtering.
class _AlwaysThrowsOnFit extends Distribution {
  constructor (mu) {
    super('continuous', 1)
    this.p = { mu }
    this.s = [{ value: -Infinity, closed: false }, { value: Infinity, closed: false }]
  }

  _generator () {
    return this.p.mu
  }

  _pdf () {
    return 1
  }

  _cdf () {
    return 0.5
  }

  static _fitInit (data) {
    return [data.reduce((s, x) => s + x, 0) / data.length]
  }

  static fit () {
    throw new Error('synthetic fit failure')
  }
}

describe('guess', () => {
  it('should rank the source distribution first for a large well-separated sample', () => {
    const data = new dist.Normal(5, 2).seed(42).sample(1000)
    const result = guess(data, { candidates: [dist.Normal, dist.Uniform, dist.Cauchy] })
    assert.strictEqual(result[0].name, 'Normal')
  })

  it('should return bicWeight values summing to 1 within floating-point tolerance', () => {
    const data = new dist.Normal(5, 2).seed(42).sample(1000)
    const result = guess(data, { candidates: [dist.Normal, dist.Uniform, dist.Cauchy] })
    const sum = result.reduce((s, r) => s + r.bicWeight, 0)
    assert(Math.abs(sum - 1) < 1e-9, `sum = ${sum}`)
  })

  it('should return entries shaped as {name, params, bicWeight, pValue}', () => {
    const data = new dist.Normal(5, 2).seed(42).sample(1000)
    const result = guess(data, { candidates: [dist.Normal, dist.Uniform] })
    result.forEach(r => {
      assert.isString(r.name)
      assert.isObject(r.params)
      assert.isNumber(r.bicWeight)
      assert.isNumber(r.pValue)
    })
  })

  it('should restrict results to the candidates option', () => {
    const data = new dist.Normal(5, 2).seed(42).sample(1000)
    const result = guess(data, { candidates: [dist.Normal, dist.Exponential] })
    result.forEach(r => assert.include(['Normal', 'Exponential'], r.name))
  })

  it('should sort results by descending bicWeight', () => {
    const data = new dist.Normal(5, 2).seed(42).sample(1000)
    const result = guess(data, { candidates: [dist.Normal, dist.Uniform, dist.Cauchy] })
    for (let i = 1; i < result.length; i++) {
      assert(result[i - 1].bicWeight >= result[i].bicWeight)
    }
  })

  it('should throw when data.length < 20 * max_k among surviving candidates', () => {
    const data = new dist.Normal(5, 2).seed(42).sample(10)
    assert.throws(() => guess(data, { candidates: [dist.Normal] }), Error)
  })

  it('should exclude discrete candidates for continuous (non-integer) data', () => {
    const data = new dist.Normal(0, 1).seed(4).sample(500)
    const result = guess(data, { candidates: [dist.Normal, dist.Poisson] })
    result.forEach(r => assert.notEqual(r.name, 'Poisson'))
  })

  it('should exclude candidates whose support does not cover the data range', () => {
    // All values are deeply negative (mean -5, sigma 1): Exponential's support [0, ∞)
    // cannot cover this range, so the hard support filter must exclude it regardless
    // of any other consideration.
    const data = new dist.Normal(-5, 1).seed(3).sample(500)
    const result = guess(data, { candidates: [dist.Exponential, dist.Normal] })
    result.forEach(r => assert.notEqual(r.name, 'Exponential'))
  })

  it('should exclude a candidate whose fixed support cannot cover the data range even when its probe constructs successfully', () => {
    // VonMises has a fixed support [-π, π] regardless of its concentration parameter,
    // so a probe always constructs successfully — the exclusion here must come from
    // comparing the data's range against support(), not from a constructor failure.
    const data = new dist.Normal(0, 3).seed(9).sample(500)
    const result = guess(data, { candidates: [dist.VonMises, dist.Normal] })
    result.forEach(r => assert.notEqual(r.name, 'VonMises'))
  })

  it('should exclude a positive-skew-only candidate when sample skewness is strongly negative', () => {
    // Beta(5, 1) is left-skewed (population skewness ≈ -1.18) but its support [0, 1] is
    // still fully inside Exponential's support [0, ∞) — so this exclusion must come from
    // the soft skewness filter, not the hard support filter. Beta itself is untagged in
    // _guess-meta.js (its skew sign is parameter-dependent), so it always survives
    // soft-filtering and gives the result array something left to assert against.
    const data = new dist.Beta(5, 1).seed(7).sample(1000)
    const result = guess(data, { candidates: [dist.Exponential, dist.Beta] })
    assert(result.length > 0)
    result.forEach(r => assert.notEqual(r.name, 'Exponential'))
  })

  it('should include a warning when every surviving candidate fails goodness-of-fit at α=0.05', () => {
    // A well-separated bimodal sample cannot be fit well by a single Normal.
    const data = new dist.Normal(-10, 1).seed(1).sample(500)
      .concat(new dist.Normal(10, 1).seed(2).sample(500))
    const result = guess(data, { candidates: [dist.Normal] })
    assert.strictEqual(result.warning, 'no candidate passes goodness-of-fit at α=0.05')
  })

  it('should skip a candidate whose fit() throws rather than propagating the error', () => {
    const data = new dist.Normal(5, 2).seed(42).sample(500)
    const result = guess(data, { candidates: [dist.Normal, _AlwaysThrowsOnFit] })
    result.forEach(r => assert.notEqual(r.name, '_AlwaysThrowsOnFit'))
    assert(result.length > 0)
  })

  it('should throw when no candidate survives filtering', () => {
    const data = new dist.Normal(0, 1).seed(4).sample(500)
    assert.throws(() => guess(data, { candidates: [dist.Poisson] }), Error)
  })

  it('should throw (not fall back to the default pool) when candidates is explicitly an empty array', () => {
    // An empty array is truthy, so `candidates || _defaultCandidates()` uses the empty
    // pool as-is rather than falling back — this must still fail with the "no candidate
    // survives pre-filtering" error, not silently run the default pool instead.
    const data = new dist.Normal(0, 1).seed(4).sample(500)
    assert.throws(() => guess(data, { candidates: [] }), /no candidate distribution survives pre-filtering/)
  })

  it('should use the default candidate pool (all distributions) when candidates is omitted', function () {
    this.timeout(60000)
    const data = new dist.Normal(5, 2).seed(42).sample(500)
    const result = guess(data)
    const excluded = ['guess']
    result.forEach(r => assert.notInclude(excluded, r.name))
    assert(result.length > 0)
  })

  // The five distributions formerly listed in guess.js's removed DEFAULT_EXCLUDED set,
  // each with a data-generating instance and a contrasting alternative whose support or
  // shape makes it a clearly worse fit — isolates "is this candidate genuinely reachable
  // and competitive in the unfiltered default pool" from incidental pool composition.
  //
  // `unfilteredPool: false` for Rice, NoncentralChi2, and NoncentralChi is a deliberate
  // omission, not an oversight: their non-negative-continuous sample data also survives
  // DoublyNoncentralF's (and several other unrelated distributions') hard filters, and
  // DoublyNoncentralF's nested double-Poisson-mixing _pdf series takes 13-30s+ per fit()
  // call on data shaped like this — an unrelated, pre-existing latency issue (#1063) whose
  // cost varies enough between runs (observed 24s in isolation, >60s inside the full suite
  // for the same seeded data) that asserting on the unfiltered guess(data) call here would
  // be flaky. VonMises's bounded [-π, π] support hard-filters away that whole non-negative
  // candidate group before fit() is ever reached, and Skellam is discrete (a disjoint,
  // much cheaper candidate set) — both measured reliably fast.
  // See solutions/testing/2026-07-21-1055-guess-default-pool-latent-fit-cliff.md
  const FORMERLY_EXCLUDED = [
    { name: 'VonMises', instance: new dist.VonMises(2), alternative: dist.Normal, unfilteredPool: true },
    { name: 'Rice', instance: new dist.Rice(5, 1), alternative: dist.Normal, unfilteredPool: false },
    { name: 'NoncentralChi2', instance: new dist.NoncentralChi2(3, 10), alternative: dist.Exponential, unfilteredPool: false },
    { name: 'NoncentralChi', instance: new dist.NoncentralChi(3, 3), alternative: dist.Exponential, unfilteredPool: false },
    { name: 'Skellam', instance: new dist.Skellam(3, 8), alternative: dist.Poisson, unfilteredPool: true }
  ]

  FORMERLY_EXCLUDED.forEach(({ name, instance, alternative, unfilteredPool }) => {
    it(`should include ${name} in the default pool for data it fits well`, function () {
      this.timeout(60000)
      const data = instance.seed(5).sample(500)
      if (unfilteredPool) {
        const withoutOverride = guess(data)
        assert(withoutOverride.some(r => r.name === name))
      }
      // Confirms the distribution really is a viable, fittable candidate for this data,
      // not just incidentally present in the default-pool result.
      const withOverride = guess(data, { candidates: [instance.constructor, alternative] })
      assert.strictEqual(withOverride[0].name, name)
    })
  })

  it('should exclude a symmetric-only candidate when sample skewness is strongly non-zero', () => {
    // Exponential(1) has population skewness 2 — far outside a symmetric family's
    // tolerance — while Exponential itself (positive-skew-only) is not excluded by the
    // asymmetric rule, since its own sample skewness is positive, not negative.
    const data = new dist.Exponential(1).seed(13).sample(1000)
    const result = guess(data, { candidates: [dist.Normal, dist.Exponential] })
    assert(result.length > 0)
    result.forEach(r => assert.notEqual(r.name, 'Normal'))
  })

  it('should exclude an Exponential-family candidate when the coefficient of variation is far from 1', () => {
    // Mean 100, sigma 0.5: CV = 0.005, far below the [0.1, 10] band Exponential-like
    // (CV ≈ 1) families are expected to fall within. All samples stay comfortably
    // positive, so Exponential's hard support filter is not what excludes it here.
    const data = new dist.Normal(100, 0.5).seed(21).sample(500)
    const result = guess(data, { candidates: [dist.Normal, dist.Exponential] })
    assert(result.length > 0)
    result.forEach(r => assert.notEqual(r.name, 'Exponential'))
  })

  it('should exclude a Poisson-like candidate when the dispersion index is overdispersed, and successfully fit the discrete survivor', () => {
    // NegativeBinomial(5, 0.8) in this library's parameterization (mean = r*p/(1-p),
    // variance = r*p/(1-p)^2, so vmr = 1/(1-p) regardless of r): vmr = 1/0.2 = 5 > 3,
    // excluding Poisson via the dispersion-index soft filter. NegativeBinomial itself is
    // not excluded, since its own dispersion index is not below the NB-like threshold of
    // 0.5 — it should survive filtering and fit, exercising the discrete chi2() pValue path.
    const data = new dist.NegativeBinomial(5, 0.8).seed(11).sample(1000)
    const result = guess(data, { candidates: [dist.Poisson, dist.NegativeBinomial] })
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].name, 'NegativeBinomial')
  })

  it('should throw when every surviving candidate fails to fit', () => {
    const data = new dist.Normal(5, 2).seed(42).sample(500)
    assert.throws(() => guess(data, { candidates: [_AlwaysThrowsOnFit] }), /no candidate distribution could be fitted/)
  })
})
