import { assert } from 'chai'
import { describe, it } from 'mocha'
import { float, seed } from '../src/core'
import { Normal, Uniform, Exponential } from '../src/dist'
import * as test from '../src/test'

const SAMPLE_SIZE = 1000

// Reused verbatim from test/ad.js, where these are independently re-derived and
// verified against the Marsaglia & Marsaglia (2004) formula this wrapper reuses —
// re-deriving them again here would just restate the same math, not add coverage.
const REF_SAMPLE = [0.1, 0.3, 0.5, 0.7, 0.9]
const REF_A2 = 0.130083462905258
const REF_PVALUE = 1.0002653616792376

describe('test', () => {
  describe('andersonDarling', () => {
    it('should throw exception for empty values', () => {
      assert.throws(() => {
        test.andersonDarling([], x => x)
      }, /andersonDarling: values must not be empty/)
    })

    // See test/ad.js for the independent derivation/verification of these values
    // against the Marsaglia & Marsaglia (2004) asymptotic formula.
    it('should match the hand-checked reference stat and pValue', () => {
      const result = test.andersonDarling(REF_SAMPLE.slice(), x => x)
      assert.closeTo(result.stat, REF_A2, 1e-12)
      assert.closeTo(result.pValue, REF_PVALUE, 1e-9)
    })

    it('should use the caller-supplied alpha rather than the private default of 0.01', () => {
      seed(12345)
      // Sample drawn from Uniform(0,1) tested against a badly mismatched Normal(0,1)
      // CDF: pValue is near 0, so alpha=0 always passes (pValue >= 0) while a
      // near-1 alpha always fails (pValue < alpha) — demonstrating the public
      // wrapper's alpha decouples from _tests.js's hardcoded 0.01, without relying
      // on a specific externally-sourced pValue.
      const n01 = new Normal(0, 1)
      const sample = Array.from({ length: SAMPLE_SIZE }, () => float())
      const lenient = test.andersonDarling(sample, x => n01.cdf(x), 0)
      const strict = test.andersonDarling(sample, x => n01.cdf(x), 0.999999)
      assert.strictEqual(lenient.stat, strict.stat)
      assert(lenient.passed)
      assert(!strict.passed)
    })

    it('should pass at alpha=0.05 for a sample drawn from the tested distribution', () => {
      seed(12345)
      const mu = float(0, 5)
      const sigma = float(1, 10)
      const dist = new Normal(mu, sigma)
      dist.seed(12345)
      assert(test.andersonDarling(dist.sample(SAMPLE_SIZE), x => dist.cdf(x), 0.05).passed)
    })

    it('should reject at alpha=0.05 for a sample drawn from a different distribution', () => {
      seed(12345)
      const mu = float(0, 5)
      const sigma = float(1, 10)
      const shifted = new Normal(mu + 10, sigma)
      shifted.seed(12345)
      const target = new Normal(mu, sigma)
      assert(!test.andersonDarling(shifted.sample(SAMPLE_SIZE), x => target.cdf(x), 0.05).passed)
    })

    it('should pass at alpha=0.05 for a Uniform sample matching its own CDF', () => {
      const dist = new Uniform(0, 1)
      dist.seed(12345)
      assert(test.andersonDarling(dist.sample(SAMPLE_SIZE), x => dist.cdf(x), 0.05).passed)
    })

    it('should pass at alpha=0.05 for an Exponential sample matching its own CDF', () => {
      const dist = new Exponential(1.5)
      dist.seed(12345)
      assert(test.andersonDarling(dist.sample(SAMPLE_SIZE), x => dist.cdf(x), 0.05).passed)
    })

    it('should not throw for a single-value sample', () => {
      const n01 = new Normal(0, 1)
      // Exact closed form from the A² definition at n=1, u_1 = F(0) = 0.5:
      // A² = -1 - (1)*(ln(0.5) + ln(1 - 0.5)) = -1 + 2*ln(2)
      const result = test.andersonDarling([0], x => n01.cdf(x))
      assert.closeTo(result.stat, 2 * Math.log(2) - 1, 1e-12)
      // Marsaglia & Marsaglia (2004) asymptotic formula (adinf + finite-n errfix
      // correction), independently re-implemented (not sourced from src/dist/_tests.js)
      // and evaluated at a2 = 2*ln(2) - 1 ≈ 0.3862943611198906, n=1:
      //   adinf(a2) = 0.13777910963793707 (branch z < 2: exp(-1.2337141/z)/sqrt(z) * poly1(z))
      //   errfix(1, adinf) = -0.068971611217126 (branch x < c, c = 0.01265 + 0.1757/1 = 0.19035)
      //   pValue = 1 - (adinf + errfix) = 0.9311925015791889
      assert.closeTo(result.pValue, 0.9311925015791889, 1e-9)
    })

    it('should not throw for a sample with tied values', () => {
      const n01 = new Normal(0, 1)
      // Standard normal CDF at x=1, Phi(1) = 0.8413447460685429 (matches
      // scipy.stats.norm.cdf(1) to this precision) -- hardcoded as an external
      // constant, not obtained via n01.cdf(1), so the reference below is not
      // derived from ranjs's own implementation.
      const u = 0.8413447460685429
      // With all 5 sample values tied, every order statistic maps to the same
      // CDF value u = Phi(1), so every term of the A^2 sum collapses to the same
      // ln(u) + ln(1 - u), and sum_{i=1}^{n} (2i-1) = n^2 (sum of the first n odd
      // numbers). Hence A^2 = -n - (1/n)*n^2*(ln(u)+ln(1-u)) = -n*(1+ln(u)+ln(1-u)).
      // For n=5: A^2 = -5*(1 + ln(0.8413447460685429) + ln(1-0.8413447460685429))
      //             ~= 5.068877120163567
      const result = test.andersonDarling([1, 1, 1, 1, 1], x => n01.cdf(x))
      assert.closeTo(result.stat, -5 * (1 + Math.log(u) + Math.log(1 - u)), 1e-9)
      // Marsaglia & Marsaglia (2004) asymptotic formula (adinf + finite-n errfix
      // correction), independently re-implemented (not sourced from src/dist/_tests.js)
      // by transcribing the published coefficients fresh in a standalone Node
      // script, and evaluated at a2 = 5.068877120163567, n=5:
      //   adinf(a2) = 0.9973430639169235 (branch z >= 2: exp(-exp(poly2(z))))
      //   errfix(5, adinf) = -0.0003615943570252966 (branch x >= 0.8)
      //   pValue = 1 - (adinf + errfix) = 0.0030185304401018076
      assert.closeTo(result.pValue, 0.0030185304401018076, 1e-9)
    })

    it('should propagate NaN rather than throw when a sample value is NaN', () => {
      const n01 = new Normal(0, 1)
      const result = test.andersonDarling([1, 2, NaN, 4, 5], x => n01.cdf(x))
      assert(Number.isNaN(result.stat))
      assert(Number.isNaN(result.pValue))
      assert.isFalse(result.passed)
    })

    it('should reject a sample whose shape disagrees with the model at alpha=0.05', () => {
      seed(12345)
      // Triangular (centre-heavy) sample tested against the Uniform(0,1) CDF —
      // both supports are (0,1) so no boundary clipping is triggered, rejection
      // must come from distributional shape rather than boundary saturation.
      const sample = Array.from({ length: SAMPLE_SIZE }, () => (float() + float()) / 2)
      assert(!test.andersonDarling(sample, x => x, 0.05).passed)
    })

    it('should reject roughly 5% of null-true samples at alpha=0.05 (Monte Carlo calibration)', () => {
      seed(12345)
      const trials = 200
      let rejections = 0
      for (let i = 0; i < trials; i++) {
        const sample = Array.from({ length: 100 }, () => float())
        if (!test.andersonDarling(sample, x => x, 0.05).passed) {
          rejections++
        }
      }
      // Rejection rate under the null is Binomial(200, 0.05); mean 10, sd ~3.08.
      // A generous +/-3 sd band (1..19) keeps this from being flaky while still
      // catching a badly miscalibrated p-value (e.g. off by an order of magnitude).
      assert(rejections >= 1 && rejections <= 19, `rejections = ${rejections}, expected roughly 10`)
    })
  })
})
