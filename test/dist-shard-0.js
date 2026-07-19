import { describe } from 'mocha'
import continuousCases from './dist-cases-continuous'
import discreteCases from './dist-cases-discrete'
import { registerDistributionTests, shardCases } from './dist-runner'

// Distribution cases are partitioned across SHARD_COUNT files (see test/dist-runner.js) by
// index modulo SHARD_COUNT so mocha --parallel can register and run each shard's tests on a
// separate worker process. The partition is deterministic (same order every run) and stable
// across code changes to individual cases, since it only depends on array position.
const SHARD_INDEX = 0

const testCases = shardCases([...continuousCases, ...discreteCases], SHARD_INDEX)

describe('dist', () => {
  registerDistributionTests(testCases)
})
