import { describe } from 'mocha'
import continuousCases from './dist-cases-continuous'
import discreteCases from './dist-cases-discrete'
import { registerDistributionTests } from './dist-runner'

// See test/dist-shard-0.js for the sharding rationale.
const SHARD_COUNT = 4
const SHARD_INDEX = 3

const testCases = [...continuousCases, ...discreteCases]
  .filter((tc, i) => i % SHARD_COUNT === SHARD_INDEX)

describe('dist', () => {
  registerDistributionTests(testCases)
})
