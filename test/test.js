import { assert } from'chai'
import { describe, it } from 'mocha'
import { int, float } from '../src/core'
import Poisson from '../src/dist/poisson'
import Normal from '../src/dist/normal'
import * as test from '../src/test'
import { trials } from './test-utils'

const SAMPLE_SIZE = 100

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
      }, 7)
    })

    it('should reject for discrete samples of different variance', () => {
      trials(() => {
        let k = int(3, 5)
        return !test.bartlett(Array.from({ length: k }, () => (new Poisson(1 + Math.random() * 30)).sample(SAMPLE_SIZE))).passed
      }, 7)
    })

    it('should pass for continuous samples of the same variance', () => {
      trials(() => {
        let k = int(2, 5)
        let mu = float(0, 5)
        let sigma = float(1, 10)
        return test.bartlett(Array.from({ length: k }, () => (new Normal(mu, sigma)).sample(SAMPLE_SIZE))).passed
      }, 7)
    })

    it('should reject for continuous samples of different variance', () => {
      trials(() => {
        let k = int(3, 5)
        return !test.bartlett(Array.from({ length: k }, () => (new Normal(float(0, 5), float(1, 10))).sample(SAMPLE_SIZE))).passed
      }, 7)
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
      }, 7)
    })

    it('should reject for samples of different discrete distributions', () => {
      trials(() => {
        let lambda = int(1, 10)
        let sample1 = (new Poisson(lambda)).sample(SAMPLE_SIZE)
        let sample2 = (new Poisson(lambda + 10)).sample(SAMPLE_SIZE)
        return !test.mannWhitney([sample1, sample2]).passed
      }, 7)
    })

    it('should pass for samples of the same continuous distribution', () => {
      trials(() => {
        let mu = float(0, 5)
        let sigma = float(1, 10)
        let sample1 = (new Normal(mu, sigma)).sample(SAMPLE_SIZE)
        let sample2 = (new Normal(mu, sigma)).sample(SAMPLE_SIZE)
        return test.mannWhitney([sample1, sample2]).passed
      }, 7)
    })

    it('should reject for samples of different continuous distributions', () => {
      trials(() => {
        let mu = float(0, 5)
        let sigma = float(1, 10)
        let sample1 = (new Normal(mu, sigma)).sample(SAMPLE_SIZE)
        let sample2 = (new Normal(mu + 10, sigma)).sample(SAMPLE_SIZE)
        return !test.mannWhitney([sample1, sample2]).passed
      }, 7)
    })
  })
})