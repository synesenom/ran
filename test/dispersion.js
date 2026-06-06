import { assert } from 'chai'
import { describe, it } from 'mocha'
import { equal } from './test-utils'
import * as dispersion from '../src/dispersion'

describe('dispersion', () => {
  describe('.cv()', () => {
    it('should return NaN if sample size is less than 2', () => {
      assert(Number.isNaN(dispersion.cv([])))
      assert(Number.isNaN(dispersion.cv([1])))
    })

    it('should return NaN if mean is 0', () => {
      assert(Number.isNaN(dispersion.cv([-1, 0, 1])))
    })

    it('should return the coefficient of variation', () => {
      // [1, 2, 3]: mean=2, sample_var=1, stdev=1, cv=0.5
      assert(equal(dispersion.cv([1, 2, 3]), 0.5))
      // [2, 4, 6]: mean=4, sample_var=4, stdev=2, cv=0.5
      assert(equal(dispersion.cv([2, 4, 6]), 0.5))
      // [1, 3, 5]: mean=3, sample_var=4, stdev=2, cv=2/3
      assert(equal(dispersion.cv([1, 3, 5]), 2 / 3))
      // all-identical: stdev=0, cv=0
      assert(equal(dispersion.cv([5, 5, 5]), 0))
    })
  })

  describe('.dVar()', () => {
    it('should return NaN for empty array', () => {
      assert(Number.isNaN(dispersion.dVar([])))
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
    it('should return NaN for empty array', () => {
      assert(Number.isNaN(dispersion.entropy([])))
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

      for (const base of [2, 10]) {
        testCases.forEach(tc => {
          assert(equal(dispersion.entropy(tc.probabilities, base), tc.entropy / Math.log(base), 8))
        })
      }
    })
  })

  describe('.gini()', () => {
    it('should return NaN if sample size is less than 2', () => {
      assert(Number.isNaN(dispersion.gini([])))
      assert(Number.isNaN(dispersion.gini([1])))
    })

    it('should return NaN if mean is zero', () => {
      assert(Number.isNaN(dispersion.gini([-1, 0, 1])))
    })

    it('should return the relative mean absolute difference', () => {
      // [1, 2, 3]: rmd=4/9, gini=rmd/2=2/9
      assert(equal(dispersion.gini([1, 2, 3]), 2 / 9))
      // [1, 2, 3, 4]: rmd=0.5, gini=0.25
      assert(equal(dispersion.gini([1, 2, 3, 4]), 0.25))
      // all-identical: gini=0
      assert(equal(dispersion.gini([3, 3, 3]), 0))
    })
  })

  describe('.iqr()', () => {
    it('should return NaN for an empty sample', () => {
      assert(Number.isNaN(dispersion.iqr([])))
    })

    it('should return 0 for a sample of a single element', () => {
      assert(dispersion.iqr([1]) === 0)
    })

    it('should return the interquartile range for a finite sample', () => {
      // [1, 2, 3, 4, 5]: Q1=2 (h=1, exact), Q3=4 (h=3, exact), IQR=2
      assert(equal(dispersion.iqr([1, 2, 3, 4, 5]), 2))
      // [0, 1, 2, 3]: Q1=0.75 (h=0.75, interp), Q3=2.25 (h=2.25, interp), IQR=1.5
      assert(equal(dispersion.iqr([0, 1, 2, 3]), 1.5))
      // all-identical: IQR=0
      assert(equal(dispersion.iqr([3, 3, 3, 3]), 0))
    })
  })

  describe('.md()', () => {
    it('should return NaN if sample size is less than 2', () => {
      assert(Number.isNaN(dispersion.md([])))
      assert(Number.isNaN(dispersion.md([1])))
    })

    it('should return the mean absolute difference', () => {
      // [0, 2]: n=2, 2*|0-2|/4=1
      assert(equal(dispersion.md([0, 2]), 1))
      // [1, 2, 3]: n=3, 2*(1+2+1)/9=8/9
      assert(equal(dispersion.md([1, 2, 3]), 8 / 9))
      // all-identical: md=0
      assert(equal(dispersion.md([4, 4, 4]), 0))
    })
  })

  describe('.midhinge()', () => {
    it('should return NaN for an empty sample', () => {
      assert(Number.isNaN(dispersion.midhinge([])))
    })

    it('should return the midhinge for a finite sample', () => {
      // [1, 2, 3, 4, 5]: Q1=2, Q3=4, midhinge=(2+4)/2=3
      assert(equal(dispersion.midhinge([1, 2, 3, 4, 5]), 3))
      // [0, 1, 2, 3]: Q1=0.75, Q3=2.25, midhinge=1.5
      assert(equal(dispersion.midhinge([0, 1, 2, 3]), 1.5))
    })
  })

  describe('.range()', () => {
    it('should return NaN for an empty sample', () => {
      assert(Number.isNaN(dispersion.range([])))
    })

    it('should return the range for a finite sample', () => {
      // [3, 1, 4, 1, 5, 9, 2, 6]: min=1, max=9, range=8
      assert(equal(dispersion.range([3, 1, 4, 1, 5, 9, 2, 6]), 8))
      // [7, 2, 5]: min=2, max=7, range=5
      assert(equal(dispersion.range([7, 2, 5]), 5))
      // all-identical: range=0
      assert(equal(dispersion.range([4, 4, 4]), 0))
    })
  })

  describe('.rmd()', () => {
    it('should return NaN if sample size is less than 2', () => {
      assert(Number.isNaN(dispersion.rmd([])))
      assert(Number.isNaN(dispersion.rmd([1])))
    })

    it('should return NaN if mean is zero', () => {
      assert(Number.isNaN(dispersion.rmd([-1, 0, 1])))
    })

    it('should return the relative mean absolute difference', () => {
      // [1, 2, 3]: md=8/9, mean=2, rmd=4/9
      assert(equal(dispersion.rmd([1, 2, 3]), 4 / 9))
      // [1, 2, 3, 4]: rmd=0.5
      assert(equal(dispersion.rmd([1, 2, 3, 4]), 0.5))
    })
  })

  describe('.qcd()', () => {
    it('should return NaN for an empty sample', () => {
      assert(Number.isNaN(dispersion.qcd([])))
    })

    it('should return 0 for a sample of a single element', () => {
      assert(dispersion.qcd([1]) === 0)
    })

    it('should return the quartile coefficient of dispersion for a finite sample', () => {
      // [1, 2, 3, 4, 5]: Q1=2, Q3=4, qcd=(4-2)/(4+2)=1/3
      assert(equal(dispersion.qcd([1, 2, 3, 4, 5]), 1 / 3))
      // [0, 1, 2, 3]: Q1=0.75, Q3=2.25, qcd=1.5/3=0.5
      assert(equal(dispersion.qcd([0, 1, 2, 3]), 0.5))
    })
  })

  describe('.stdev()', () => {
    it('should return NaN if sample size is less than 2', () => {
      assert(Number.isNaN(dispersion.stdev([])))
      assert(Number.isNaN(dispersion.stdev([1])))
    })

    it('should return the unbiased standard deviation', () => {
      // [1, 2, 3]: sample_var=1, stdev=1
      assert(equal(dispersion.stdev([1, 2, 3]), 1))
      // [2, 4, 6]: mean=4, sample_var=4, stdev=2
      assert(equal(dispersion.stdev([2, 4, 6]), 2))
      // all-identical: stdev=0
      assert(equal(dispersion.stdev([7, 7, 7]), 0))
    })
  })

  describe('.variance()', () => {
    it('should return NaN if sample size is less than 2', () => {
      assert(Number.isNaN(dispersion.variance([])))
      assert(Number.isNaN(dispersion.variance([1])))
    })

    it('should return the unbiased variance', () => {
      // [1, 2, 3]: mean=2, sample_var=((1+0+1)/2)=1
      assert(equal(dispersion.variance([1, 2, 3]), 1))
      // [2, 4, 6]: mean=4, sample_var=((4+0+4)/2)=4
      assert(equal(dispersion.variance([2, 4, 6]), 4))
      // all-identical: var=0
      assert(equal(dispersion.variance([5, 5, 5]), 0))
    })
  })

  describe('.vmr()', () => {
    it('should return NaN if sample size is less than 2', () => {
      assert(Number.isNaN(dispersion.vmr([])))
      assert(Number.isNaN(dispersion.vmr([1])))
    })

    it('should return NaN if mean is 0', () => {
      assert(Number.isNaN(dispersion.vmr([-1, 0, 1])))
    })

    it('should return the coefficient of variation', () => {
      // [1, 2, 3]: mean=2, var=1, vmr=0.5
      assert(equal(dispersion.vmr([1, 2, 3]), 0.5))
      // [2, 4, 6]: mean=4, var=4, vmr=1
      assert(equal(dispersion.vmr([2, 4, 6]), 1))
      // [1, 3, 5]: mean=3, var=4, vmr=4/3
      assert(equal(dispersion.vmr([1, 3, 5]), 4 / 3))
    })
  })
})
