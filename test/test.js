import { assert } from 'chai'
import { describe, it } from 'mocha'
import { int, float } from '../src/core'
import Pareto from '../src/dist/pareto'
import Uniform from '../src/dist/uniform'
import Poisson from '../src/dist/poisson'
import Normal from '../src/dist/normal'
import mannWhitney from '../src/test/mann-whitney'
import utils from './test-utils'

const SAMPLE_SIZE = 100

let pareto = new Pareto(1, 2);
let uniform = new Uniform();
console.log(mannWhitney(pareto.sample(1000), pareto.sample(100), 0.1));

describe('test', () => {
  describe('mannWhitney', () => {
    it('should pass for samples of the same discrete distribution', () => {
      utils.trials(() => {
        let lambda = int(1, 30)
        let sample1 = (new Poisson(lambda)).sample(SAMPLE_SIZE)
        let sample2 = (new Poisson(lambda)).sample(SAMPLE_SIZE)
        return mannWhitney(sample1, sample2).passed
      }, 7)
    })

    it('should reject for samples of different discrete distributions', () => {
      utils.trials(() => {
        let lambda = int(1, 30)
        let sample1 = (new Poisson(lambda)).sample(SAMPLE_SIZE)
        let sample2 = (new Poisson(lambda + 10)).sample(SAMPLE_SIZE)
        return !mannWhitney(sample1, sample2).passed
      }, 7)
    })

    it('should pass for samples of the same continuous distribution', () => {
      utils.trials(() => {
        let mu = float(0, 5)
        let sigma = float(1, 10)
        let sample1 = (new Normal(mu, sigma)).sample(SAMPLE_SIZE)
        let sample2 = (new Normal(mu, sigma)).sample(SAMPLE_SIZE)
        return mannWhitney(sample1, sample2).passed
      }, 7)
    })

    it('should reject for samples of different continuous distributions', () => {
      utils.trials(() => {
        let mu = float(0, 5)
        let sigma = float(1, 10)
        let sample1 = (new Normal(mu, sigma)).sample(SAMPLE_SIZE)
        let sample2 = (new Normal(mu + 10, sigma)).sample(SAMPLE_SIZE)
        return !mannWhitney(sample1, sample2).passed
      }, 7)
    })
  })
})