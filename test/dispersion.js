import { assert } from 'chai'
import { describe, it } from 'mocha'
import { repeat, equal } from './test-utils'
import { int } from '../src/core'
import * as dispersion from '../src/dispersion'

const SAMPLE_SIZE = 100

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

  describe('.entropy()', () => {
    it('should return undefined if sample is empty', () => {
      assert(typeof dispersion.entropy([]) === 'undefined')
    })

    it('should return the Shannon entropy of the sample using natural logarithm', () => {
      repeat(() => {
        const values = Array.from({length: SAMPLE_SIZE}, () => int(20))
        const p = {}
        for (let x of values) {
          p[x] = (p[x] || 0) + 1
        }
        let entropy = 0
        for (let pi of Object.values(p)) {
          let x = pi / values.length
          entropy -= x * Math.log(x)
        }
        assert(equal(dispersion.entropy(values), entropy))
      })
    })

    it('should return the Shannon entropy of the sample using arbitrary logarithm', () => {
      repeat(() => {
        const base = 2 + 10 * Math.random()
        const values = Array.from({length: SAMPLE_SIZE}, () => int(20))
        const p = {}
        for (let x of values) {
          p[x] = (p[x] || 0) + 1
        }
        let entropy = 0
        for (let pi of Object.values(p)) {
          let x = pi / values.length
          entropy -= x * Math.log(x) / Math.log(base)
        }
        assert(equal(dispersion.entropy(values, base), entropy))
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
      console.log(dispersion.gini([1, 1, 1, 7]))
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
