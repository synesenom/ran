import { assert } from 'chai'
import { describe, it } from 'mocha'
import { repeat, equal } from './test-utils'
import { int } from '../src/core'
import * as dispersion from '../src/dispersion'
import * as dependence from '../src/dependence'

const SAMPLE_SIZE = 100

// TODO Go through methods and check input conditions.
describe('dispersion', () => {
  describe('.cv()', () => {
    it('should return undefined if sample size is less than 2', () => {
      assert(typeof dispersion.cv([]) === 'undefined')
      assert(typeof dispersion.cv([1]) === 'undefined')
    })

    it('should return undefined if mean is 0', () => {
      assert(typeof dispersion.cv([-1, 0, 1]) === 'undefined')
    })

    it('should return the coefficient of variation', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        let mean = values.reduce((m, d) => d + m, 0) / values.length
        let stdev = Math.sqrt(values.reduce((v, d) => (d - mean) * (d - mean) + v, 0) / (values.length - 1))
        assert(equal(dispersion.cv(values), stdev / mean))
      })
    })
  })

  describe('.dVar()', () => {
    it('should return undefined for empty array', () => {
      assert(typeof dispersion.dVar([]) === 'undefined')
    })

    it('should return the distance variance of an array', () => {
      const x = [
        17, 20, 0, 17, 46, 20, 31, 27, 1, 29, 16, 20, 5, 32, 28, 41, 35, 32, 6, 18, 8, 38, 27, 25, 32, 43, 5, 28, 6, 40,
        16, 42, 38, 48, 44, 7, 33, 23, 33, 11, 26, 32, 27, 10, 18, 0, 21, 44, 23, 47, 29, 12, 17, 7, 39, 15, 0, 16, 0,
        17, 6, 17, 25, 8, 1, 18, 18, 0, 35, 46, 13, 21, 20, 11, 39, 41, 23, 37, 29, 27, 18, 17, 15, 42, 33, 3, 11, 8,
        45, 2, 31, 26, 21, 37, 25, 5, 11, 47, 16, 25
      ]
      const dVar = 9.422636422997547
      assert(equal(dispersion.dVar(x), dVar))
    })
  })

  describe('.entropy()', () => {
    it('should return undefined if sample is empty', () => {
      assert(typeof dispersion.entropy([]) === 'undefined')
    })

    it('should return the Shannon entropy of the probabilities using natural logarithm', () => {
      const testCases = [{
        probabilities: [
          7.69459862671e-23, 1.02797735717e-18, 5.05227108354e-15, 9.13472040836e-12, 6.07588284982e-09,
          1.48671951473e-06, 0.000133830225765, 0.00443184841194, 0.0539909665132, 0.241970724519, 0.398942280401,
          0.241970724519, 0.0539909665132, 0.00443184841194, 0.000133830225765, 1.48671951473e-06, 6.07588284982e-09,
          9.13472040836e-12, 5.05227108354e-15, 1.02797735717e-18, 7.69459862671e-23, 2.11881925351e-27,
          2.14638373566e-32, 7.99882775701e-38, 1.09660655939e-43, 5.53070954984e-50, 1.02616307279e-56,
          7.00418213432e-64, 1.7587495426e-71, 1.62463603677e-79
        ],
        entropy: 1.41893843294
      }, {
        probabilities: [
          0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333,
          0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333,
          0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333,
          0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333,
          0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333
        ],
        entropy: 3.40119738166
      }]

      testCases.forEach(tc => {
        assert(equal(dispersion.entropy(tc.probabilities), tc.entropy, 8))
      })
    })

    it('should return the Shannon entropy of the sample using arbitrary logarithm', () => {
      const testCases = [{
        probabilities: [
          7.69459862671e-23, 1.02797735717e-18, 5.05227108354e-15, 9.13472040836e-12, 6.07588284982e-09,
          1.48671951473e-06, 0.000133830225765, 0.00443184841194, 0.0539909665132, 0.241970724519, 0.398942280401,
          0.241970724519, 0.0539909665132, 0.00443184841194, 0.000133830225765, 1.48671951473e-06, 6.07588284982e-09,
          9.13472040836e-12, 5.05227108354e-15, 1.02797735717e-18, 7.69459862671e-23, 2.11881925351e-27,
          2.14638373566e-32, 7.99882775701e-38, 1.09660655939e-43, 5.53070954984e-50, 1.02616307279e-56,
          7.00418213432e-64, 1.7587495426e-71, 1.62463603677e-79
        ],
        entropy: 1.41893843294
      }, {
        probabilities: [
          0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333,
          0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333,
          0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333,
          0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333,
          0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333, 0.0333333333333
        ],
        entropy: 3.40119738166
      }]
      const base = Math.random()

      testCases.forEach(tc => {
        assert(equal(dispersion.entropy(tc.probabilities, base), tc.entropy / Math.log(base), 8))
      })
    })
  })

  describe('.gini()', () => {
    it('should return undefined if sample size is less than 2', () => {
      assert(typeof dispersion.gini([]) === 'undefined')
      assert(typeof dispersion.gini([1]) === 'undefined')
    })

    it('should return undefined if mean is zero', () => {
      assert(typeof dispersion.gini([-1, 0, 1]) === 'undefined')
    })

    it('should return the relative mean absolute difference', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        let mean = 0
        let g = 0
        for (let i = 0; i < values.length; i++) {
          mean += values[i]
          for (let j = 0; j < values.length; j++) {
            g += Math.abs(values[i] - values[j])
          }
        }
        mean /= values.length
        g /= 2 * mean * values.length * values.length
        assert(equal(dispersion.gini(values), g))
      })
    })
  })

  describe('.iqr()', () => {
    it('should return undefined for an empty sample', () => {
      assert(typeof dispersion.iqr([]) === 'undefined')
    })

    it('should return 0 for a sample of a single element', () => {
      assert(dispersion.iqr([1]) === 0)
    })

    it('should return the interquartile range for a finite sample', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        const iqr = dispersion.iqr(values)

        // Lower quartile.
        let h = (values.length - 1) * 0.25
        let q0 = values.sort((a, b) => a - b)[Math.floor(h)]
        let q1 = values.sort((a, b) => a - b)[Math.floor(h) + 1]
        const lo = q0 + (typeof q1 === 'undefined' ? 0 : (h - Math.floor(h)) * (q1 - q0))

        // Upper quartile.
        h = (values.length - 1) * 0.75
        q0 = values.sort((a, b) => a - b)[Math.floor(h)]
        q1 = values.sort((a, b) => a - b)[Math.floor(h) + 1]
        const hi = q0 + (typeof q1 === 'undefined' ? 0 : (h - Math.floor(h)) * (q1 - q0))

        assert(equal(hi - lo, iqr))
      })
    })
  })

  describe('.md()', () => {
    it('should return undefined if sample size is less than 2', () => {
      assert(typeof dispersion.md([]) === 'undefined')
      assert(typeof dispersion.md([1]) === 'undefined')
    })

    it('should return the mean absolute difference', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        let md = 0
        for (let i = 0; i < values.length; i++) {
          for (let j = 0; j < values.length; j++) {
            md += Math.abs(values[i] - values[j])
          }
        }
        md /= values.length * values.length
        assert(equal(dispersion.md(values), md))
      })
    })
  })

  describe('.midhinge()', () => {
    it('should return undefined for an empty sample', () => {
      assert(typeof dispersion.midhinge([]) === 'undefined')
    })

    it('should return the midhinge for a finite sample', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        const mh = dispersion.midhinge(values)

        // Lower quartile.
        let h = (values.length - 1) * 0.25
        let q0 = values.sort((a, b) => a - b)[Math.floor(h)]
        let q1 = values.sort((a, b) => a - b)[Math.floor(h) + 1]
        const lo = q0 + (typeof q1 === 'undefined' ? 0 : (h - Math.floor(h)) * (q1 - q0))

        // Upper quartile.
        h = (values.length - 1) * 0.75
        q0 = values.sort((a, b) => a - b)[Math.floor(h)]
        q1 = values.sort((a, b) => a - b)[Math.floor(h) + 1]
        const hi = q0 + (typeof q1 === 'undefined' ? 0 : (h - Math.floor(h)) * (q1 - q0))

        assert(equal(0.5 * (hi + lo), mh))
      })
    })
  })

  describe('.range()', () => {
    it('should return undefined for an empty sample', () => {
      assert(typeof dispersion.range([]) === 'undefined')
    })

    it('should return the range for a finite sample', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        const range = dispersion.range(values)
        const min = values.sort((a, b) => a - b)[0]
        const max = values.sort((a, b) => b - a)[0]
        assert(equal(max - min, range))
      })
    })
  })

  describe('.rmd()', () => {
    it('should return undefined if sample size is less than 2', () => {
      assert(typeof dispersion.rmd([]) === 'undefined')
      assert(typeof dispersion.rmd([1]) === 'undefined')
    })

    it('should return undefined if mean is zero', () => {
      assert(typeof dispersion.rmd([-1, 0, 1]) === 'undefined')
    })

    it('should return the relative mean absolute difference', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        let mean = 0
        let rd = 0
        for (let i = 0; i < values.length; i++) {
          mean += values[i]
          for (let j = 0; j < values.length; j++) {
            rd += Math.abs(values[i] - values[j])
          }
        }
        mean /= values.length
        rd /= mean * values.length * values.length
        assert(equal(dispersion.rmd(values), rd))
      })
    })
  })

  describe('.qcd()', () => {
    it('should return undefined for an empty sample', () => {
      assert(typeof dispersion.qcd([]) === 'undefined')
    })

    it('should return 0 for a sample of a single element', () => {
      assert(dispersion.qcd([1]) === 0)
    })

    it('should return the quartile coefficient of dispersion for a finite sample', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        const qcd = dispersion.qcd(values)

        // Lower quartile.
        let h = (values.length - 1) * 0.25
        let q0 = values.sort((a, b) => a - b)[Math.floor(h)]
        let q1 = values.sort((a, b) => a - b)[Math.floor(h) + 1]
        const lo = q0 + (typeof q1 === 'undefined' ? 0 : (h - Math.floor(h)) * (q1 - q0))

        // Upper quartile.
        h = (values.length - 1) * 0.75
        q0 = values.sort((a, b) => a - b)[Math.floor(h)]
        q1 = values.sort((a, b) => a - b)[Math.floor(h) + 1]
        const hi = q0 + (typeof q1 === 'undefined' ? 0 : (h - Math.floor(h)) * (q1 - q0))

        assert(equal((hi - lo) / (lo + hi), qcd))
      })
    })
  })

  describe('.stdev()', () => {
    it('should return undefined if sample size is less than 2', () => {
      assert(typeof dispersion.stdev([]) === 'undefined')
      assert(typeof dispersion.stdev([1]) === 'undefined')
    })

    it('should return the unbiased standard deviation', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        let mean = values.reduce((m, d) => d + m, 0) / values.length
        let stdev = Math.sqrt(values.reduce((v, d) => (d - mean) * (d - mean) + v, 0) / (values.length - 1))
        assert(equal(dispersion.stdev(values), stdev))
      })
    })
  })

  describe('.variance()', () => {
    it('should return undefined if sample size is less than 2', () => {
      assert(typeof dispersion.variance([]) === 'undefined')
      assert(typeof dispersion.variance([1]) === 'undefined')
    })

    it('should return the unbiased variance', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        let mean = values.reduce((m, d) => d + m, 0) / values.length
        let variance = values.reduce((v, d) => (d - mean) * (d - mean) + v, 0) / (values.length - 1)
        assert(equal(dispersion.variance(values), variance))
      })
    })
  })

  describe('.vmr()', () => {
    it('should return undefined if sample size is less than 2', () => {
      assert(typeof dispersion.vmr([]) === 'undefined')
      assert(typeof dispersion.vmr([1]) === 'undefined')
    })

    it('should return undefined if mean is 0', () => {
      assert(typeof dispersion.vmr([-1, 0, 1]) === 'undefined')
    })

    it('should return the coefficient of variation', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, Math.random)
        let mean = values.reduce((m, d) => d + m, 0) / values.length
        let variance = values.reduce((v, d) => (d - mean) * (d - mean) + v, 0) / (values.length - 1)
        assert(equal(dispersion.vmr(values), variance / mean))
      })
    })
  })
})
