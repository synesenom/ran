import { assert } from 'chai'
import { describe, it } from 'mocha'
import { ksTest, chiTest } from './test-utils'
import * as core from '../src/core'

// Constants
const TRIALS = 1
const LAPS = 100

function add (dist, value) {
  if (typeof dist[value] === 'undefined') { dist[value] = 1 } else { dist[value]++ }
}

describe('core', () => {
  describe('.seed()', () => {
    it('should return the same sequence of random numbers for the same numerical seed', () => {
      core.seed(12345)
      const values1 = Array.from({ length: LAPS }, () => core.int(Number.MAX_SAFE_INTEGER))
      core.seed(12345)
      const values2 = Array.from({ length: LAPS }, () => core.int(Number.MAX_SAFE_INTEGER))
      assert(values1.reduce((acc, d, i) => acc && d === values2[i], true))
    })

    it('should return the same sequence of random numbers for the same string seed', () => {
      core.seed('test-seed')
      const values1 = Array.from({ length: LAPS }, () => core.int(Number.MAX_SAFE_INTEGER))
      core.seed('test-seed')
      const values2 = Array.from({ length: LAPS }, () => core.int(Number.MAX_SAFE_INTEGER))
      assert(values1.reduce((acc, d, i) => acc && d === values2[i], true))
    })

    it('should return different sequence of random numbers for different numerical seeds', () => {
      core.seed(111)
      const values1 = Array.from({ length: LAPS }, () => core.int(Number.MAX_SAFE_INTEGER))
      core.seed(999)
      const values2 = Array.from({ length: LAPS }, () => core.int(Number.MAX_SAFE_INTEGER))
      assert(values1.some((d, i) => d !== values2[i]))
    })

    it('should return different sequence of random numbers for different string seeds', () => {
      core.seed('seed-a')
      const values1 = Array.from({ length: LAPS }, () => core.int(Number.MAX_SAFE_INTEGER))
      core.seed('seed-b')
      const values2 = Array.from({ length: LAPS }, () => core.int(Number.MAX_SAFE_INTEGER))
      assert(values1.some((d, i) => d !== values2[i]))
    })
  })

  describe('.float()', () => {
    it('should return a float uniformly distributed in [0, 1]', () => {
      core.seed(0)
      const values = Array.from({ length: LAPS }, () => core.float())
      assert(ksTest(values, x => x))
    })

    it('should return a float uniformly distributed in [min, max]', () => {
      core.seed(0)
      const max = core.float() * 20
      const values = Array.from({ length: LAPS }, () => core.float(max))
      assert(ksTest(values, x => x / max))
    })

    it('should return multiple floats uniformly distributed in [min, max]', () => {
      core.seed(0)
      const min = core.float() * 20 - 10
      const max = 10 + core.float() * 10
      const k = Math.floor(core.float() * 10 - 5)
      const values = []
      for (let lap = 0; lap < LAPS; lap++) {
        let r = core.float(min, max, k)
        if (k < 2) { r = [r] }
        r.forEach(ri => {
          values.push(ri)
          // Value is in range
          assert((min < max ? min : max) <= ri && ri <= (min < max ? max : min))
        })
        // Length is correct
        assert.equal(k < 2 ? 1 : k, r.length)
      }

      // Distribution is uniform
      if (min < max) {
        assert(ksTest(values, x => (x - min) / (max - min)))
      } else {
        assert(ksTest(values, x => (x - max) / (min - max)))
      }
    })
  })

  describe('.int()', () => {
    it('should return an integer uniformly distributed in [0, max]', () => {
      core.seed(0)
      const max = core.int(9)
      const values = Array.from({ length: LAPS }, () => core.int(max))
      assert(chiTest(values, () => 1 / Math.abs(max + 1), 1))
    })

    it('should return an integer uniformly distributed in [min, max]', () => {
      core.seed(0)
      const min = Math.floor(core.float() * 20 - 10)
      const max = 20 + Math.floor(core.float() * 10)
      const values = []
      for (let lap = 0; lap < LAPS; lap++) {
        const r = core.int(min, max)
        values.push(r)

        // Value is in range
        assert((min < max ? min : max) <= r && r <= (min < max ? max : min))

        // Value is integer
        assert.equal(r, parseInt(r, 10))
      }

      // Distribution is uniform
      assert(chiTest(values, () => 1 / Math.abs(max - min + 1), 1))
    })

    it('should return multiple integers uniformly distributed in [0, max]', () => {
      core.seed(0)
      const min = Math.floor(core.float() * 20 - 10)
      const max = 20 + Math.floor(core.float() * 10)
      const k = Math.floor(core.float() * 10 - 5)
      const values = []
      for (let lap = 0; lap < LAPS; lap++) {
        let r = core.int(min, max, k)
        if (k < 2) { r = [r] }
        for (let i = 0; i < r.length; i++) {
          values.push(r[i])

          // Value is in range
          assert((min < max ? min : max) <= r[i] && r[i] <= (min < max ? max : min), 'Value is out of range')
        }
        // Length is correct
        assert.equal(k < 2 ? 1 : k, r.length, 'Number of samples is incorrect')
      }

      // Distribution is uniform
      assert(chiTest(values, () => 1 / Math.abs(max - min + 1), max === min ? 1 : 2))
    })
  })

  describe('.choice()', () => {
    it('should return a single null (no arguments)', () => {
      assert.equal(core.choice(), null)
    })

    it('should return a single null (null as argument)', () => {
      assert.equal(core.choice(null), null)
    })

    it('should return a single null (empty array as argument)', () => {
      assert.equal(core.choice([]), null)
    })

    it('should return multiple items distributed uniformly', () => {
      for (let trial = 0; trial < TRIALS; trial++) {
        const values = ['a', 'b', 'c']
        const freqs = {}
        const k = Math.floor(Math.random() * 200 - 100)
        for (let lap = 0; lap < LAPS; lap++) {
          let r = core.choice(values, k)
          if (k < 2) { r = [r] }
          r.forEach(ri => {
            add(freqs, ri)
            // Value is in array
            assert(values.indexOf(ri) > -1)
          })
          // Length is correct
          assert.equal(k < 2 ? 1 : k, r.length)
        }
        for (const i in values) {
          // Distribution is uniform
          assert(freqs[values[i]] > 0)
        }
        for (const i in freqs) {
          assert(values.indexOf(i) > -1)
        }
      }
    })
  })

  describe('.char()', () => {
    it('should return a single null (no arguments)', () => {
      assert.equal(core.char(), null)
    })

    it('should return a single null (null as argument)', () => {
      assert.equal(core.char(), null)
    })

    it('should return a single null (empty string as argument)', () => {
      assert.equal(core.char(''), null)
    })

    it('should return multiple characters distributed uniformly', () => {
      for (let trial = 0; trial < TRIALS; trial++) {
        const string = 'abcdefghijkl51313#^!#?><;!-_=+.,/:{}()'
        const k = Math.floor(Math.random() * 200 - 100)
        for (let lap = 0; lap < LAPS; lap++) {
          let r = core.char(string, k)
          if (k < 2) { r = [r] }
          r.forEach(ri => {
            // Character is in array
            assert(string.indexOf(ri) > -1)
          })
          // Length is correct
          assert.equal(k < 2 ? 1 : k, r.length)
        }
      }
    })
  })

  describe('.shuffle()', () => {
    it('should swap all elements at least once', () => {
      for (let trial = 0; trial < TRIALS; trial++) {
        const values = []
        const pos = []
        for (let i = 0; i < 10; i++) {
          values.push(i)
          pos.push({})
        }

        for (let lap = 0; lap < LAPS; lap++) {
          core.shuffle(values)
          values.forEach((v, i) => add(pos[v], i))
        }

        // Check if all positions have been visited at least once
        pos.forEach(p => {
          for (const i in p) {
            assert(p[i] > 0)
          }
        })
      }
    })
  })

  describe('.coin()', () => {
    it('should return head or tail with 50% chance', () => {
      core.seed(0)
      const head = Math.floor(core.float() * 10)
      const tail = head + Math.floor(1 + core.float() * 10)
      const values = []
      for (let lap = 0; lap < LAPS; lap++) {
        let r = core.coin(head, tail)
        r = [r]
        r.forEach(ri => values.push(ri))
      }

      // Distribution is uniform
      assert(chiTest(values, () => 0.5, 1))
    })

    it('should return multiple heads/tails with specific probability', () => {
      core.seed(0)
      const p = core.float()
      const k = Math.floor(core.float() * 10)
      const head = Math.floor(core.float() * 20)
      const tail = head + Math.floor(1 + core.float() * 20)
      const values = []
      for (let lap = 0; lap < LAPS; lap++) {
        let r = core.coin(head, tail, p, k)
        if (k < 2) { r = [r] }
        r.forEach(ri => values.push(ri))
      }

      // Distribution is uniform
      assert(chiTest(values, x => x === head ? p : 1 - p, 1))
    })
  })
})
