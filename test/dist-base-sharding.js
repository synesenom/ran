import fs from 'fs'
import path from 'path'
import { assert } from 'chai'
import { describe, it } from 'mocha'
import { SHARD_COUNT, shardCases } from './dist-runner'

// Regression guard for the dist-shard-*.js partition (see test/dist-runner.js): if SHARD_COUNT
// is ever bumped without adding/removing a matching shard file, shardCases would silently drop
// or duplicate cases across shards. Two distinct failure modes need two distinct checks: the
// partition algorithm itself (below) proves shardCases is correct in isolation, but says nothing
// about whether a dist-shard-N.js file exists on disk for every index it produces — that half is
// checked separately by reading the actual file list, since mocha only registers tests from
// files that exist.
describe('dist-runner sharding', () => {
  it('shardCases partitions any array into a complete, non-overlapping cover across SHARD_COUNT shards', () => {
    const cases = Array.from({ length: 2 * SHARD_COUNT + 3 }, (_, i) => ({ name: `case-${i}` }))
    const shards = Array.from({ length: SHARD_COUNT }, (_, i) => shardCases(cases, i))
    const total = shards.reduce((sum, shard) => sum + shard.length, 0)
    assert.strictEqual(total, cases.length, 'shards must collectively cover every case exactly once')

    const seen = new Set()
    shards.flat().forEach(c => {
      assert.isFalse(seen.has(c.name), `case ${c.name} assigned to more than one shard`)
      seen.add(c.name)
    })
  })

  it('has exactly one dist-shard-N.js file for every index shardCases can produce', () => {
    const shardFiles = fs.readdirSync(__dirname).filter(f => /^dist-shard-\d+\.js$/.test(f))
    assert.strictEqual(shardFiles.length, SHARD_COUNT,
      `expected ${SHARD_COUNT} dist-shard-N.js files (one per SHARD_COUNT), found ${shardFiles.length}: ${shardFiles.join(', ')}`)
    for (let i = 0; i < SHARD_COUNT; i++) {
      assert.isTrue(fs.existsSync(path.join(__dirname, `dist-shard-${i}.js`)), `missing dist-shard-${i}.js`)
    }
  })
})
