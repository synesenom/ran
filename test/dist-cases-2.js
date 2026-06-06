import { describe } from 'mocha'
import { allCases, runCase } from './_dist-harness'

// Shard 2 of 4: every 4th case, interleaved so cost spreads evenly.
describe('dist', () => {
  allCases.filter((_, i) => i % 4 === 2).forEach(runCase)
})
