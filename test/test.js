import { assert } from'chai'
import { describe, it } from 'mocha'
import { int, float } from '../src/core'
import { Poisson, Normal } from '../src/dist'
import * as test from '../src/test'
import { trials } from './test-utils'

const SAMPLE_SIZE = 50

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
      trials(() => {
        let k = int(2, 5)
        let lambda = int(1, 30)
        return test.bartlett(Array.from({ length: k }, () => (new Poisson(lambda)).sample(SAMPLE_SIZE))).passed
      })
    })

    it('should reject for discrete samples of different variance', () => {
      trials(() => {
        let k = int(3, 5)
        return !test.bartlett(Array.from({ length: k }, () => (new Poisson(1 + Math.random() * 30)).sample(SAMPLE_SIZE))).passed
      })
    })

    it('should pass for continuous samples of the same variance', () => {
      trials(() => {
        let k = int(2, 5)
        let mu = float(0, 5)
        let sigma = float(1, 10)
        return test.bartlett(Array.from({ length: k }, () => (new Normal(mu, sigma)).sample(SAMPLE_SIZE))).passed
      })
    })

    it('should reject for continuous samples of different variance', () => {
      trials(() => {
        let k = int(3, 5)
        return !test.bartlett(Array.from({ length: k }, () => (new Normal(float(0, 5), float(1, 10))).sample(SAMPLE_SIZE))).passed
      })
    })
  })

  describe('brownForsythe', () => {
    it('should throw exception for less than two data sets', () => {
      assert.throws(() => {
        test.brownForsythe([[1, 2, 3]])
      }, 'dataSet must contain multiple data sets')
    })

    it('should pass for discrete samples of the same variance', () => {
      trials(() => {
        let k = int(2, 5)
        let lambda = int(1, 30)
        return test.brownForsythe(Array.from({ length: k }, () => (new Poisson(lambda)).sample(SAMPLE_SIZE))).passed
      })
    })

    it('should reject for discrete samples of different variance', () => {
      trials(() => {
        let k = int(3, 5)
        return !test.brownForsythe(Array.from({ length: k }, () => (new Poisson(1 + Math.random() * 30)).sample(SAMPLE_SIZE))).passed
      })
    })

    it('should pass for continuous samples of the same variance', () => {
      trials(() => {
        let k = int(2, 5)
        let mu = float(0, 5)
        let sigma = float(1, 10)
        return test.brownForsythe(Array.from({ length: k }, () => (new Normal(mu, sigma)).sample(SAMPLE_SIZE))).passed
      })
    })

    it('should reject for continuous samples of different variance', () => {
      trials(() => {
        let k = int(3, 5)
        return !test.brownForsythe(Array.from({ length: k }, () => (new Normal(float(0, 5), float(1, 10))).sample(SAMPLE_SIZE))).passed
      })
    })
  })

  describe('hsic', () => {
    it('should throw exception for less or more than two data sets', () => {
      assert.throws(() => {
        test.hsic([[1, 2, 3]])
      }, 'dataSets must contain two data sets')
    })

    it ('should throw exception for unequal sample sizes', () => {
      assert.throws(() => {
        test.hsic([[1, 2, 3], [1, 2]])
      }, 'Data sets must have the same length')
    })

    it ('should throw exception for sample sizes less than 6', () => {
      assert.throws(() => {
        test.hsic([[1, 2, 3, 4, 5], [1, 2, 3, 4, 5]])
      }, 'Data sets in dataSet must have at least 6 elements')
    })

    it('should pass for independent samples', () => {
      trials(() => {
        const sample1 = float(0, 10, SAMPLE_SIZE)
        const sample2 = float(0, 10, SAMPLE_SIZE)
        return test.hsic([sample1, sample2])
      })
    })

    it('should reject for dependent data sets', () => {
      trials(() => {
        const normal = new Normal()
        const sample1 = Array.from({length: SAMPLE_SIZE}, (d, i) => i)
        const sample2 = sample1.map(d => d + normal.sample())
        return !test.hsic([sample1, sample2]).passed
      })
    })
  })

  describe('levene', () => {
    it('should throw exception for less than two data sets', () => {
      assert.throws(() => {
        test.levene([[1, 2, 3]])
      }, 'dataSet must contain multiple data sets')
    })

    it('should pass for discrete samples of the same variance', () => {
      trials(() => {
        let k = int(2, 5)
        let lambda = int(1, 30)
        return test.levene(Array.from({ length: k }, () => (new Poisson(lambda)).sample(SAMPLE_SIZE))).passed
      })
    })

    it('should reject for discrete samples of different variance', () => {
      trials(() => {
        let k = int(3, 5)
        return !test.levene(Array.from({ length: k }, () => (new Poisson(1 + Math.random() * 30)).sample(SAMPLE_SIZE))).passed
      })
    })

    it('should pass for continuous samples of the same variance', () => {
      trials(() => {
        let k = int(2, 5)
        let mu = float(0, 5)
        let sigma = float(1, 10)
        return test.levene(Array.from({ length: k }, () => (new Normal(mu, sigma)).sample(SAMPLE_SIZE))).passed
      })
    })

    it('should reject for continuous samples of different variance', () => {
      trials(() => {
        let k = int(3, 5)
        return !test.levene(Array.from({ length: k }, () => (new Normal(float(0, 5), float(1, 10))).sample(SAMPLE_SIZE))).passed
      })
    })
  })

  describe('mannWhitney', () => {
    it('should throw exception for less or more than two data sets', () => {
      assert.throws(() => {
        test.mannWhitney([[1, 2, 3]])
      }, 'dataSets must contain two data sets')
    })

    it('should pass for samples of the same discrete distribution', () => {
      trials(() => {
        let lambda = int(1, 10)
        let sample1 = (new Poisson(lambda)).sample(SAMPLE_SIZE)
        let sample2 = (new Poisson(lambda)).sample(SAMPLE_SIZE)
        return test.mannWhitney([sample1, sample2]).passed
      })
    })

    it('should reject for samples of different discrete distributions', () => {
      trials(() => {
        let lambda = int(1, 10)
        let sample1 = (new Poisson(lambda)).sample(SAMPLE_SIZE)
        let sample2 = (new Poisson(lambda + 10)).sample(SAMPLE_SIZE)
        return !test.mannWhitney([sample1, sample2]).passed
      })
    })

    it('should pass for samples of the same continuous distribution', () => {
      trials(() => {
        let mu = float(0, 5)
        let sigma = float(1, 10)
        let sample1 = (new Normal(mu, sigma)).sample(SAMPLE_SIZE)
        let sample2 = (new Normal(mu, sigma)).sample(SAMPLE_SIZE)
        return test.mannWhitney([sample1, sample2]).passed
      })
    })

    it('should reject for samples of different continuous distributions', () => {
      trials(() => {
        let mu = float(0, 5)
        let sigma = float(1, 10)
        let sample1 = (new Normal(mu, sigma)).sample(SAMPLE_SIZE)
        let sample2 = (new Normal(mu + 10, sigma)).sample(SAMPLE_SIZE)
        return !test.mannWhitney([sample1, sample2]).passed
      })
    })
  })
})
