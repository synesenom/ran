import { describe } from 'mocha'
import continuousCases from './dist-cases-continuous'
import discreteCases from './dist-cases-discrete'
import { registerDistributionTests, shardCases } from './dist-runner'

// See test/dist-shard-0.js for the sharding rationale.
const SHARD_INDEX = 3

const testCases = shardCases([...continuousCases, ...discreteCases], SHARD_INDEX)

describe('dist', () => {
  registerDistributionTests(testCases)
})
