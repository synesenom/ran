import { assert } from 'chai'
import { describe, it } from 'mocha'
import { int, float, seed } from '../src/core'
import { Poisson, Normal } from '../src/dist'
import * as test from '../src/test'

const SAMPLE_SIZE = 50

// Wilson score interval for a binomial proportion: more reliable than the naive Wald
// (mean +/- z*sd) approximation when the expected count (trials * alpha) is small, since it
// stays inside [0, 1] and is not centered on the raw sample proportion. z = 3 gives a ~99.7%
// two-sided CI -- wide enough to avoid Monte Carlo flakiness across repeated CI runs, while
// still catching a test whose critical value is off by an order of magnitude (e.g. a 1 - alpha
// swap, or a wrong degrees-of-freedom).
function wilsonInterval (successes, trials, z = 3) {
  const phat = successes / trials
  const z2 = z * z
  const denom = 1 + z2 / trials
  const center = (phat + z2 / (2 * trials)) / denom
  const halfWidth = z * Math.sqrt((phat * (1 - phat) + z2 / (4 * trials)) / trials) / denom
  return [center - halfWidth, center + halfWidth]
}

// Asserts that a nominal significance level alpha is consistent with an empirical rejection
// rate (successes/trials) observed under H0, via the Wilson interval above.
function assertTypeIError (rejections, trials, alpha) {
  const [lower, upper] = wilsonInterval(rejections, trials)
  assert(alpha >= lower && alpha <= upper,
    `rejection rate ${rejections}/${trials} = ${(rejections / trials).toFixed(3)}; Wilson 99.7% CI [${lower.toFixed(3)}, ${upper.toFixed(3)}] excludes nominal alpha = ${alpha}`)
}

// Repeats a hypothesis test under a caller-supplied H0 case generator and verifies the
// empirical rejection rate is consistent with the nominal alpha. Shared across the Type-I
// error blocks below to avoid restating the same trial-loop/rejection-count boilerplate.
function checkTypeIError (trials, alpha, generateNullCase, runTest) {
  let rejections = 0
  for (let i = 0; i < trials; i++) {
    if (!runTest(generateNullCase(i)).passed) {
      rejections++
    }
  }
  assertTypeIError(rejections, trials, alpha)
}

// A pair of independently-seeded Normal(0, 1) samples of equal size: the shared H0 case
// generator for the two-sample tests (mannWhitney, welch) whose null is "same distribution".
function nullNormalPair (trialIndex) {
  return [
    (new Normal(0, 1)).seed(2 * trialIndex).sample(SAMPLE_SIZE),
    (new Normal(0, 1)).seed(2 * trialIndex + 1).sample(SAMPLE_SIZE)
  ]
}

describe('test', () => {
  describe('bartlett', () => {
    it('should throw exception for less than two data sets', () => {
      assert.throws(() => {
        test.bartlett([[1, 2, 3]])
      }, 'dataSet must contain multiple data sets')
    })

    it('should throw exception for data sets smaller than 2 elements', () => {
      assert.throws(() => {
        test.bartlett([[1, 2, 3], [1]])
      }, 'Data sets in dataSet must have multiple elements')
    })

    it('should pass for discrete samples of the same variance', () => {
      seed(0)
      const k = int(2, 5)
      const lambda = int(1, 30)
      assert(test.bartlett(Array.from({ length: k }, (_, i) => (new Poisson(lambda)).seed(i).sample(SAMPLE_SIZE))).passed)
    })

    it('should reject for discrete samples of different variance', () => {
      seed(0)
      const k = int(3, 5)
      assert(!test.bartlett(Array.from({ length: k }, (_, i) => (new Poisson(1 + float() * 30)).seed(i).sample(SAMPLE_SIZE))).passed)
    })

    it('should pass for continuous samples of the same variance', () => {
      seed(0)
      const k = int(2, 5)
      const mu = float(0, 5)
      const sigma = float(1, 10)
      assert(test.bartlett(Array.from({ length: k }, (_, i) => (new Normal(mu, sigma)).seed(i).sample(SAMPLE_SIZE))).passed)
    })

    it('should reject for continuous samples of different variance', () => {
      seed(0)
      const k = int(3, 5)
      assert(!test.bartlett(Array.from({ length: k }, (_, i) => (new Normal(float(0, 5), float(1, 10))).seed(i).sample(SAMPLE_SIZE))).passed)
    })

    // Type-I error (test size) verification: under H0 (identical-variance samples), the
    // rejection rate at alpha should itself be close to alpha. scipy has no direct bartlett
    // equivalent with a matching finite-sample correction to cross-check against, so this
    // verifies internal calibration via repeated simulation instead of a single external value.
    it('should reject roughly alpha fraction of null-true samples across repeated trials (Type-I error)', () => {
      const alpha = 0.05
      const k = 3
      const groupSize = 50
      checkTypeIError(200, alpha,
        i => Array.from({ length: k }, (_, g) => (new Normal(0, 1)).seed(i * k + g).sample(groupSize)),
        groups => test.bartlett(groups, alpha))
    })
  })

  describe('brownForsythe', () => {
    it('should throw exception for less than two data sets', () => {
      assert.throws(() => {
        test.brownForsythe([[1, 2, 3]])
      }, 'dataSet must contain multiple data sets')
    })

    it('should pass for discrete samples of the same variance', () => {
      seed(0)
      const k = int(2, 5)
      const lambda = int(1, 30)
      assert(test.brownForsythe(Array.from({ length: k }, (_, i) => (new Poisson(lambda)).seed(i).sample(SAMPLE_SIZE))).passed)
    })

    it('should reject for discrete samples of different variance', () => {
      seed(0)
      const k = int(3, 5)
      assert(!test.brownForsythe(Array.from({ length: k }, (_, i) => (new Poisson(1 + float() * 30)).seed(i).sample(SAMPLE_SIZE))).passed)
    })

    it('should pass for continuous samples of the same variance', () => {
      seed(0)
      const k = int(2, 5)
      const mu = float(0, 5)
      const sigma = float(1, 10)
      assert(test.brownForsythe(Array.from({ length: k }, (_, i) => (new Normal(mu, sigma)).seed(i).sample(SAMPLE_SIZE))).passed)
    })

    it('should reject for continuous samples of different variance', () => {
      seed(0)
      const k = int(3, 5)
      assert(!test.brownForsythe(Array.from({ length: k }, (_, i) => (new Normal(float(0, 5), float(1, 10))).seed(i).sample(SAMPLE_SIZE))).passed)
    })

    // Type-I error (test size) verification: under H0 (identical-variance samples), the
    // rejection rate at alpha should itself be close to alpha.
    it('should reject roughly alpha fraction of null-true samples across repeated trials (Type-I error)', () => {
      const alpha = 0.05
      const k = 3
      const groupSize = 50
      checkTypeIError(200, alpha,
        i => Array.from({ length: k }, (_, g) => (new Normal(0, 1)).seed(i * k + g).sample(groupSize)),
        groups => test.brownForsythe(groups, alpha))
    })
  })

  describe('cramerVonMises', () => {
    it('should throw exception for empty values', () => {
      assert.throws(() => {
        test.cramerVonMises([], x => (new Normal(0, 1)).cdf(x))
      }, 'cramerVonMises: values must not be empty')
    })

    it('should return stat, pValue and passed properties', () => {
      const n01 = new Normal(0, 1)
      const result = test.cramerVonMises([1, 2, 3, 4, 5], x => n01.cdf(x))
      assert.isNumber(result.stat)
      assert.isNumber(result.pValue)
      assert.isBoolean(result.passed)
    })

    it('should pass for samples drawn from the tested distribution', () => {
      seed(0)
      const mu = float(0, 5)
      const sigma = float(1, 10)
      // seed(0) above only reseeds the module-level generator behind float()/int() (src/core/index.js);
      // Normal owns its own Xoshiro128p instance (src/dist/_distribution.js) that self-seeds from
      // Math.random() unless .seed() is called on it directly, so .sample() must be seeded here too or
      // the drawn sample - and thus the CvM statistic - is different on every run.
      assert(test.cramerVonMises((new Normal(mu, sigma)).seed(0).sample(SAMPLE_SIZE), x => (new Normal(mu, sigma)).cdf(x)).passed)
    })

    it('should reject for samples drawn from a different distribution', () => {
      seed(0)
      const mu = float(0, 5)
      const sigma = float(1, 10)
      assert(!test.cramerVonMises((new Normal(mu + 10, sigma)).seed(0).sample(SAMPLE_SIZE), x => (new Normal(mu, sigma)).cdf(x)).passed)
    })

    // Reference stat/pValue below are cross-checked against scipy 1.17.1:
    // scipy.stats.cramervonmises(values, 'norm', args=(0, 1)).statistic for stat, and
    // 1 - scipy.stats._hypotests._cdf_cvm_inf(stat) for pValue — the pure n->infinity
    // asymptotic CDF (Csorgo & Faraway 1996, eq. 1.2), matching this implementation's
    // scope. scipy's public cramervonmises() additionally applies a finite-sample
    // correction (eq. 1.8), which is out of scope here per issue #1134 ("advanced
    // asymptotic theory beyond standard approximations" is explicitly excluded).
    // solutions/testing/2026-07-25-1032-cvm-scipy-public-wrapper-scope-mismatch.md
    it('should match external reference values for a well-fitting sample (small stat)', () => {
      const n01 = new Normal(0, 1)
      // Exact quantiles of N(0,1) at u_i = (2i-1)/(2n), n=10, so all deviations
      // are exactly 0 and stat reduces to the exact rational 1/(12n) = 1/120.
      const values = [
        -1.6448536269514729, -1.0364333894937898, -0.6744897501960817, -0.38532046640756773,
        -0.12566134685507402, 0.12566134685507416, 0.38532046640756773, 0.6744897501960817,
        1.0364333894937898, 1.6448536269514722
      ]
      const result = test.cramerVonMises(values, x => n01.cdf(x))
      assert.closeTo(result.stat, 1 / 120, 1e-15) // exact rational: 1/(12n) = 1/120
      assert.closeTo(result.pValue, 0.9999995175587484, 1e-8)
      assert(result.passed)
    })

    it('should match external reference values for a moderately mismatched sample (mid stat)', () => {
      const n01 = new Normal(0, 1)
      const values = [
        1.1047170797544315, -0.2399841062404955, 1.5504511958064573, 1.740564716391214,
        -1.1510351886538364, -0.502179506862318, 0.9278404031672854, 0.48375740765641784,
        0.7831988424957113, -0.05304392757358001, 1.6793979748628285, 1.5777919354289485,
        0.8660306975612161, 1.927241206968033, 1.2675093422520456
      ]
      const result = test.cramerVonMises(values, x => n01.cdf(x))
      assert.closeTo(result.stat, 1.0058374170069035, 1e-12)
      assert.closeTo(result.pValue, 0.0023841598592814206, 1e-6)
      assert(!result.passed)
    })

    it('should match external reference values for a badly mismatched sample (large stat, x > 4)', () => {
      const n01 = new Normal(0, 1)
      const values = [
        3.4407075371167615, 4.668750784082499, 3.341117399171001, 5.178450301307272,
        4.250074089013747, 4.115137636454739, 3.6190704555960584, 5.52254133867403,
        4.145470517931198, 3.8716721778368925, 3.9478664495117703, 4.832309185553348
      ]
      const result = test.cramerVonMises(values, x => n01.cdf(x))
      assert.closeTo(result.stat, 3.998287338892591, 1e-12)
      assert.closeTo(result.pValue, 7.108186261817195e-10, 1e-12)
      assert(!result.passed)
    })
  })

  describe('hsic', () => {
    it('should throw exception for less or more than two data sets', () => {
      assert.throws(() => {
        test.hsic([[1, 2, 3]])
      }, 'dataSets must contain two data sets')
    })

    it('should throw exception for unequal sample sizes', () => {
      assert.throws(() => {
        test.hsic([[1, 2, 3], [1, 2]])
      }, 'Data sets must have the same length')
    })

    it('should throw exception for sample sizes less than 6', () => {
      assert.throws(() => {
        test.hsic([[1, 2, 3, 4, 5], [1, 2, 3, 4, 5]])
      }, 'Data sets in dataSet must have at least 6 elements')
    })

    it('should pass for independent samples', () => {
      seed(0)
      const sample1 = float(0, 10, SAMPLE_SIZE)
      const sample2 = float(0, 10, SAMPLE_SIZE)
      assert(test.hsic([sample1, sample2]).passed)
    })

    it('should reject for dependent data sets', () => {
      seed(0)
      const normal = new Normal(0, 1).seed(0)
      const sample1 = Array.from({ length: SAMPLE_SIZE }, (d, i) => i)
      const sample2 = sample1.map(d => d + normal.sample())
      assert(!test.hsic([sample1, sample2]).passed)
    })

    // Type-I error (test size) verification: under H0 (statistically independent samples), the
    // rejection rate at alpha should itself be close to alpha.
    it('should reject roughly alpha fraction of null-true samples across repeated trials (Type-I error)', () => {
      seed(12345)
      const alpha = 0.05
      checkTypeIError(200, alpha,
        () => [float(0, 10, SAMPLE_SIZE), float(0, 10, SAMPLE_SIZE)],
        samples => test.hsic(samples, alpha))
    })
  })

  describe('kolmogorovSmirnov', () => {
    it('should throw exception if x is empty', () => {
      assert.throws(() => {
        test.kolmogorovSmirnov([], [1, 2, 3])
      }, 'x must not be empty')
    })

    it('should throw exception if y is empty', () => {
      assert.throws(() => {
        test.kolmogorovSmirnov([1, 2, 3], [])
      }, 'y must not be empty')
    })

    it('should return zero statistic, p-value of one, and pass for identical samples', () => {
      seed(0)
      const sample = (new Normal(0, 1)).seed(0).sample(SAMPLE_SIZE)
      const result = test.kolmogorovSmirnov(sample, sample)
      assert.equal(result.stat, 0)
      assert.equal(result.pValue, 1)
      assert(result.passed)
    })

    it('should handle single-element samples', () => {
      const result = test.kolmogorovSmirnov([1], [2])
      assert.equal(result.stat, 1)
    })

    // Reference stat/pValue below are cross-checked against scipy 1.17.1:
    // D = scipy.stats.ks_2samp(x, y, method='asymp').statistic, and
    // pValue = scipy.stats.kstwobign.sf(sqrt(n1*n2/(n1+n2)) * D) — the pure n->infinity
    // asymptotic Kolmogorov distribution, matching this implementation's use of
    // ran.dist.Kolmogorov per issue #1138's acceptance criteria ("asymptotic p-value
    // via Kolmogorov.cdf()/survival()"). scipy's own ks_2samp(method='asymp') default
    // instead reports the exact finite-n one-sample KS distribution (kstwo at
    // n=round(n1*n2/(n1+n2)), via the Marsaglia-Wong-Wei algorithm), a strictly more
    // precise finite-sample correction that is out of scope here — it would require a
    // new special-function/algorithm prerequisite (CLAUDE.md's "Prerequisite
    // extraction" decomposition pattern) rather than fitting inside this issue.
    it('should match external reference values for equal-sized samples with a mid statistic', () => {
      const result = test.kolmogorovSmirnov([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])
      assert.closeTo(result.stat, 0.6, 1e-15) // exact rational: 3/5
      assert.closeTo(result.pValue, 0.3291047890978151, 1e-12)
      assert(result.passed)
    })

    it('should match external reference values for unequal-sized samples', () => {
      const result = test.kolmogorovSmirnov([0.5, 1.5, 2.5, 10.0], [0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9, 1.0])
      assert.closeTo(result.stat, 0.75, 1e-15) // exact rational: 3/4
      assert.closeTo(result.pValue, 0.08871513799100886, 1e-12)
      assert(result.passed)
    })

    it('should match external reference values for samples with tied values', () => {
      const result = test.kolmogorovSmirnov([1, 2, 2, 3], [2, 2, 4, 5])
      assert.closeTo(result.stat, 0.5, 1e-15) // exact rational: 1/2
      assert.closeTo(result.pValue, 0.6993741991310154, 1e-12)
      assert(result.passed)
    })

    it('should pass for samples of the same discrete distribution', () => {
      seed(0)
      const lambda = int(1, 10)
      const sample1 = (new Poisson(lambda)).seed(1).sample(SAMPLE_SIZE)
      const sample2 = (new Poisson(lambda)).seed(2).sample(SAMPLE_SIZE)
      assert(test.kolmogorovSmirnov(sample1, sample2).passed)
    })

    it('should reject for samples of different discrete distributions', () => {
      seed(0)
      const lambda = int(1, 10)
      const sample1 = (new Poisson(lambda)).seed(1).sample(SAMPLE_SIZE)
      const sample2 = (new Poisson(lambda + 10)).seed(2).sample(SAMPLE_SIZE)
      assert(!test.kolmogorovSmirnov(sample1, sample2).passed)
    })

    it('should pass or reject for samples of the same or a different continuous distribution', () => {
      seed(0)
      const mu = float(0, 5)
      const sigma = float(1, 10)
      const reference = (new Normal(mu, sigma)).seed(1).sample(SAMPLE_SIZE)
      const same = (new Normal(mu, sigma)).seed(2).sample(SAMPLE_SIZE)
      const different = (new Normal(mu + 10, sigma)).seed(2).sample(SAMPLE_SIZE)

      assert(test.kolmogorovSmirnov(reference, same).passed)

      const result = test.kolmogorovSmirnov(reference, different)
      assert(!result.passed)
      assert(result.pValue < 0.05)
    })
  })

  describe('levene', () => {
    it('should throw exception for less than two data sets', () => {
      assert.throws(() => {
        test.levene([[1, 2, 3]])
      }, 'dataSet must contain multiple data sets')
    })

    it('should pass for discrete samples of the same variance', () => {
      seed(0)
      const k = int(2, 5)
      const lambda = int(1, 30)
      assert(test.levene(Array.from({ length: k }, (_, i) => (new Poisson(lambda)).seed(i).sample(SAMPLE_SIZE))).passed)
    })

    it('should reject for discrete samples of different variance', () => {
      seed(0)
      const k = int(3, 5)
      assert(!test.levene(Array.from({ length: k }, (_, i) => (new Poisson(1 + float() * 30)).seed(i).sample(SAMPLE_SIZE))).passed)
    })

    it('should pass for continuous samples of the same variance', () => {
      seed(0)
      const k = int(2, 5)
      const mu = float(0, 5)
      const sigma = float(1, 10)
      assert(test.levene(Array.from({ length: k }, (_, i) => (new Normal(mu, sigma)).seed(i).sample(SAMPLE_SIZE))).passed)
    })

    it('should reject for continuous samples of different variance', () => {
      seed(0)
      const k = int(3, 5)
      assert(!test.levene(Array.from({ length: k }, (_, i) => (new Normal(float(0, 5), float(1, 10))).seed(i).sample(SAMPLE_SIZE))).passed)
    })

    // Type-I error (test size) verification: under H0 (identical-variance samples), the
    // rejection rate at alpha should itself be close to alpha.
    it('should reject roughly alpha fraction of null-true samples across repeated trials (Type-I error)', () => {
      const alpha = 0.05
      const k = 3
      const groupSize = 50
      checkTypeIError(200, alpha,
        i => Array.from({ length: k }, (_, g) => (new Normal(0, 1)).seed(i * k + g).sample(groupSize)),
        groups => test.levene(groups, alpha))
    })
  })

  describe('mannWhitney', () => {
    it('should throw exception for less or more than two data sets', () => {
      assert.throws(() => {
        test.mannWhitney([[1, 2, 3]])
      }, 'dataSets must contain two data sets')
    })

    it('should pass for samples of the same discrete distribution', () => {
      seed(0)
      const lambda = int(1, 10)
      const sample1 = (new Poisson(lambda)).seed(1).sample(SAMPLE_SIZE)
      const sample2 = (new Poisson(lambda)).seed(2).sample(SAMPLE_SIZE)
      assert(test.mannWhitney([sample1, sample2]).passed)
    })

    it('should reject for samples of different discrete distributions', () => {
      seed(0)
      const lambda = int(1, 10)
      const sample1 = (new Poisson(lambda)).seed(1).sample(SAMPLE_SIZE)
      const sample2 = (new Poisson(lambda + 10)).seed(2).sample(SAMPLE_SIZE)
      assert(!test.mannWhitney([sample1, sample2]).passed)
    })

    it('should pass for samples of the same continuous distribution', () => {
      seed(0)
      const mu = float(0, 5)
      const sigma = float(1, 10)
      const sample1 = (new Normal(mu, sigma)).seed(1).sample(SAMPLE_SIZE)
      const sample2 = (new Normal(mu, sigma)).seed(2).sample(SAMPLE_SIZE)
      assert(test.mannWhitney([sample1, sample2]).passed)
    })

    it('should reject for samples of different continuous distributions', () => {
      seed(0)
      const mu = float(0, 5)
      const sigma = float(1, 10)
      const sample1 = (new Normal(mu, sigma)).seed(1).sample(SAMPLE_SIZE)
      const sample2 = (new Normal(mu + 10, sigma)).seed(2).sample(SAMPLE_SIZE)
      assert(!test.mannWhitney([sample1, sample2]).passed)
    })

    // Type-I error (test size) verification: under H0 (identical-distribution samples), the
    // rejection rate at alpha should itself be close to alpha.
    it('should reject roughly alpha fraction of null-true samples across repeated trials (Type-I error)', () => {
      const alpha = 0.05
      checkTypeIError(200, alpha, nullNormalPair, samples => test.mannWhitney(samples, alpha))
    })
  })

  describe('welch', () => {
    it('should throw exception if x has fewer than 2 elements', () => {
      assert.throws(() => {
        test.welch([1], [1, 2, 3])
      }, 'x must have at least 2 elements')
    })

    it('should throw exception if y has fewer than 2 elements', () => {
      assert.throws(() => {
        test.welch([1, 2, 3], [1])
      }, 'y must have at least 2 elements')
    })

    it('should pass for samples of the same mean', () => {
      seed(0)
      const mu = float(0, 5)
      const sigma = float(1, 10)
      const sample1 = (new Normal(mu, sigma)).seed(1).sample(SAMPLE_SIZE)
      const sample2 = (new Normal(mu, sigma)).seed(2).sample(SAMPLE_SIZE)
      assert(test.welch(sample1, sample2).passed)
    })

    it('should reject for samples of different means', () => {
      seed(0)
      const mu = float(0, 5)
      const sigma = float(1, 3)
      const sample1 = (new Normal(mu, sigma)).seed(1).sample(SAMPLE_SIZE)
      const sample2 = (new Normal(mu + 10, sigma)).seed(2).sample(SAMPLE_SIZE)
      assert(!test.welch(sample1, sample2).passed)
    })

    it('should return stat and passed properties', () => {
      const result = test.welch([1, 2, 3, 4, 5], [6, 7, 8, 9, 10])
      assert.isNumber(result.stat)
      assert.isBoolean(result.passed)
    })

    it('should not throw for zero-variance samples with different means', () => {
      const result = test.welch([1, 1, 1], [2, 2, 2])
      assert(!result.passed)
      assert(!isFinite(result.stat))
    })

    // Type-I error (test size) verification: under H0 (identical-mean samples), the
    // rejection rate at alpha should itself be close to alpha.
    it('should reject roughly alpha fraction of null-true samples across repeated trials (Type-I error)', () => {
      const alpha = 0.05
      checkTypeIError(200, alpha, nullNormalPair, ([x, y]) => test.welch(x, y, alpha))
    })
  })
})
