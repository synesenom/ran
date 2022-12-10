import { assert } from 'chai'
import { describe, it } from 'mocha'
import { int, float } from '../src/core'
import { Poisson, Normal } from '../src/dist'
import * as test from '../src/test'

const SAMPLE_SIZE = 1000

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
      const k = int(2, 5)
      const lambda = int(1, 30)
      assert(test.bartlett(Array.from({ length: k }, () => (new Poisson(lambda)).sample(SAMPLE_SIZE))).passed)
    })

    it('should reject for discrete samples of different variance', () => {
      const k = int(3, 5)
      assert(!test.bartlett(Array.from({ length: k }, () => (new Poisson(1 + Math.random() * 30)).sample(SAMPLE_SIZE))).passed)
    })

    it('should pass for continuous samples of the same variance', () => {
      const k = int(2, 5)
      const mu = float(0, 5)
      const sigma = float(1, 10)
      assert(test.bartlett(Array.from({ length: k }, () => (new Normal(mu, sigma)).sample(SAMPLE_SIZE))).passed)
    })

    it('should reject for continuous samples of different variance', () => {
      const k = int(3, 5)
      assert(!test.bartlett(Array.from({ length: k }, () => (new Normal(float(0, 5), float(1, 10))).sample(SAMPLE_SIZE))).passed)
    })
  })

  describe('brownForsythe', () => {
    it('should throw exception for less than two data sets', () => {
      assert.throws(() => {
        test.brownForsythe([[1, 2, 3]])
      }, 'dataSet must contain multiple data sets')
    })

    it('should pass for discrete samples of the same variance', () => {
      const k = int(2, 5)
      const lambda = int(1, 30)
      assert(test.brownForsythe(Array.from({ length: k }, () => (new Poisson(lambda)).sample(SAMPLE_SIZE))).passed)
    })

    it('should reject for discrete samples of different variance', () => {
      const k = int(3, 5)
      assert(!test.brownForsythe(Array.from({ length: k }, () => (new Poisson(1 + Math.random() * 30)).sample(SAMPLE_SIZE))).passed)
    })

    it('should pass for continuous samples of the same variance', () => {
      const k = int(2, 5)
      const mu = float(0, 5)
      const sigma = float(1, 10)
      assert(test.brownForsythe(Array.from({ length: k }, () => (new Normal(mu, sigma)).sample(SAMPLE_SIZE))).passed)
    })

    it('should reject for continuous samples of different variance', () => {
      const k = int(3, 5)
      assert(!test.brownForsythe(Array.from({ length: k }, () => (new Normal(float(0, 5), float(1, 10))).sample(SAMPLE_SIZE))).passed)
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
      const sample1 = float(0, 10, SAMPLE_SIZE / 10)
      const sample2 = float(0, 10, SAMPLE_SIZE / 10)
      assert(test.hsic([sample1, sample2]))
    })

    it('should reject for dependent data sets', () => {
      const normal = new Normal()
      const sample1 = Array.from({ length: SAMPLE_SIZE / 10 }, (d, i) => i)
      const sample2 = sample1.map(d => d + normal.sample())
      assert(!test.hsic([sample1, sample2]).passed)
    })
  })

  describe('levene', () => {
    it('should throw exception for less than two data sets', () => {
      assert.throws(() => {
        test.levene([[1, 2, 3]])
      }, 'dataSet must contain multiple data sets')
    })

    it('should pass for discrete samples of the same variance', () => {
      const k = int(2, 5)
      const lambda = int(1, 30)
      assert(test.levene(Array.from({ length: k }, () => (new Poisson(lambda)).sample(SAMPLE_SIZE))).passed)
    })

    it('should reject for discrete samples of different variance', () => {
      const k = int(3, 5)
      assert(!test.levene(Array.from({ length: k }, () => (new Poisson(1 + Math.random() * 30)).sample(SAMPLE_SIZE))).passed)
    })

    it('should pass for continuous samples of the same variance', () => {
      const k = int(2, 5)
      const mu = float(0, 5)
      const sigma = float(1, 10)
      assert(test.levene(Array.from({ length: k }, () => (new Normal(mu, sigma)).sample(SAMPLE_SIZE))).passed)
    })

    it('should reject for continuous samples of different variance', () => {
      const k = int(3, 5)
      assert(!test.levene(Array.from({ length: k }, () => (new Normal(float(0, 5), float(1, 10))).sample(SAMPLE_SIZE))).passed)
    })
  })

  describe('mannWhitney', () => {
    it('should throw exception for less or more than two data sets', () => {
      assert.throws(() => {
        test.mannWhitney([[1, 2, 3]])
      }, 'dataSets must contain two data sets')
    })

    it('should pass for samples of the same discrete distribution', () => {
      const lambda = int(1, 10)
      const sample1 = (new Poisson(lambda)).sample(SAMPLE_SIZE)
      const sample2 = (new Poisson(lambda)).sample(SAMPLE_SIZE)
      assert(test.mannWhitney([sample1, sample2]).passed)
    })

    it('should reject for samples of different discrete distributions', () => {
      const lambda = int(1, 10)
      const sample1 = (new Poisson(lambda)).sample(SAMPLE_SIZE)
      const sample2 = (new Poisson(lambda + 10)).sample(SAMPLE_SIZE)
      assert(!test.mannWhitney([sample1, sample2]).passed)
    })

    it('should pass for samples of the same continuous distribution', () => {
      const mu = float(0, 5)
      const sigma = float(1, 10)
      const sample1 = (new Normal(mu, sigma)).sample(SAMPLE_SIZE)
      const sample2 = (new Normal(mu, sigma)).sample(SAMPLE_SIZE)
      assert(test.mannWhitney([sample1, sample2]).passed)
    })

    it('should reject for samples of different continuous distributions', () => {
      const mu = float(0, 5)
      const sigma = float(1, 10)
      const sample1 = (new Normal(mu, sigma)).sample(SAMPLE_SIZE)
      const sample2 = (new Normal(mu + 10, sigma)).sample(SAMPLE_SIZE)
      assert(!test.mannWhitney([sample1, sample2]).passed)
    })
  })
})
