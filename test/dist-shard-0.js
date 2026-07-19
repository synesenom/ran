import { describe } from 'mocha'
import continuousCases from './dist-cases-continuous'
import discreteCases from './dist-cases-discrete'
import { registerDistributionTests } from './dist-runner'

// Distribution cases are partitioned across SHARD_COUNT files by index modulo SHARD_COUNT
// so mocha --parallel can register and run each shard's tests on a separate worker process.
// The partition is deterministic (same seed order every run) and stable across code changes
// to individual cases, since it only depends on array position.
const SHARD_COUNT = 4
const SHARD_INDEX = 0

const testCases = [...continuousCases, ...discreteCases]
  .filter((tc, i) => i % SHARD_COUNT === SHARD_INDEX)

describe('dist', () => {
  registerDistributionTests(testCases)
})
