import { assert } from 'chai'
import { describe, it } from 'mocha'
import utils from './test-utils'
import * as core from '../src/core'

const TRIALS = 1
const LAPS = 100
const CHARS = '.,:;-+_!#%&/()[]{}?*0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

function add (dist, value) {
  if (!dist.hasOwnProperty(value)) { dist[value] = 1 } else { dist[value]++ }
}

describe('core', () => {
  describe('.seed()', () => {
    it('should return the same sequence of random numbers for the same numerical seed', () => {
      utils.trials(() => {
        const s = Math.floor(Math.random() * 10000)
        core.seed(s)
        const values1 = Array.from({length: LAPS}, () => core.int(Number.MAX_SAFE_INTEGER))
        core.seed(s)
        const values2 = Array.from({length: LAPS}, () => core.int(Number.MAX_SAFE_INTEGER))
        return values1.reduce((acc, d, i) => acc && d === values2[i], true)
      })
    })

    it('should return the same sequence of random numbers for the same string seed', () => {
      utils.trials(() => {
        const s = Array.from({ length: 32 }, () => CHARS.charAt(Math.floor(Math.random() * CHARS.length))).join('')
        core.seed(s)
        const values1 = Array.from({length: LAPS}, () => core.int(Number.MAX_SAFE_INTEGER))
        core.seed(s)
        const values2 = Array.from({length: LAPS}, () => core.int(Number.MAX_SAFE_INTEGER))
        return values1.reduce((acc, d, i) => acc && d === values2[i], true)
      })
    })

    it('should return different sequence of random numbers for different numerical seeds', () => {
      utils.trials(() => {
        core.seed(Math.floor(Math.random() * 10000))
        const values1 = Array.from({length: LAPS}, () => core.int(Number.MAX_SAFE_INTEGER))
        core.seed(Math.floor(Math.random() * 10000))
        const values2 = Array.from({length: LAPS}, () => core.int(Number.MAX_SAFE_INTEGER))
        return values1.reduce((acc, d, i) => acc && d !== values2[i], true)
      })
    })

    it('should return different sequence of random numbers for different numerical seeds', () => {
      utils.trials(() => {
        core.seed(Array.from({ length: 32 }, () => CHARS.charAt(Math.floor(Math.random() * CHARS.length))).join(''))
        const values1 = Array.from({length: LAPS}, () => core.int(Number.MAX_SAFE_INTEGER))
        core.seed(Array.from({ length: 32 }, () => CHARS.charAt(Math.floor(Math.random() * CHARS.length))).join(''))
        const values2 = Array.from({length: LAPS}, () => core.int(Number.MAX_SAFE_INTEGER))
        return values1.reduce((acc, d, i) => acc && d !== values2[i], true)
      })
    })
  })

  describe('.float()', () => {
    it('should return a float uniformly distributed in [0, 1]', () => {
      utils.trials(() => {
        const values = Array.from({ length: LAPS }, () => core.float())
        return utils.ksTest(values, x => x)
      }, 8)
    })

    it('should return a float uniformly distributed in [min, max]', () => {
      utils.trials(() => {
        const max = Math.random() * 20
        const values = Array.from({ length: LAPS }, () => core.float(max))
        return utils.ksTest(values, x => x / max)
      }, 8)
    })

    it('should return multiple floats uniformly distributed in [min, max]', () => {
      utils.trials(() => {
        const min = Math.random() * 20 - 10
        const max = 10 + Math.random() * 10
        const k = Math.floor(Math.random() * 10 - 5)
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
          return utils.ksTest(values, x => (x - min) / (max - min))
        } else {
          return utils.ksTest(values, x => (x - max) / (min - max))
        }
      }, 8)
    })
  })

  describe('.int()', () => {
    it('should return an integer uniformly distributed in [0, max]', () => {
      utils.trials(() => {
        const max = Math.floor(Math.random() * 10)
        const values = Array.from({ length: LAPS }, () => core.int(max))
        return utils.chiTest(values, () => 1 / Math.abs(max + 1), 1)
      }, 8)
    })

    it('should return an integer uniformly distributed in [min, max]', () => {
      utils.trials(() => {
        const min = Math.floor(Math.random() * 20 - 10)
        const max = 20 + Math.floor(Math.random() * 10)
        const values = []
        for (let lap = 0; lap < LAPS; lap++) {
          let r = core.int(min, max)
          values.push(r)

          // Value is in range
          assert((min < max ? min : max) <= r && r <= (min < max ? max : min))

          // Value is integer
          assert.equal(r, parseInt(r, 10))
        }

        // Distribution is uniform
        return utils.chiTest(values, () => {
          return 1 / Math.abs(max - min + 1)
        }, 1)
      }, 8)
    })

    it('should return multiple integers uniformly distributed in [0, max]', () => {
      utils.trials(() => {
        const min = Math.floor(Math.random() * 20 - 10)
        const max = 20 + Math.floor(Math.random() * 10)
        const k = Math.floor(Math.random() * 10 - 5)
        const values = []
        for (let lap = 0; lap < LAPS; lap++) {
          let r = core.int(min, max, k)
          if (k < 2) { r = [r] }
          for (let i = 0; i < r.length; i++) {
            values.push(r[i])

            // Value is in range
            assert((min < max ? min : max) <= r[i] && r[i] <= (min < max ? max : min))
          }
          // Length is correct
          assert.equal(k < 2 ? 1 : k, r.length)
        }

        // Distribution is uniform
        return utils.chiTest(values, () => {
          return 1 / Math.abs(max - min + 1)
        }, 1)
      }, 8)
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
        for (let i in values) {
          // Distribution is uniform
          if (values.hasOwnProperty(i)) {
            assert(freqs[values[i]] > 0)
          }
        }
        for (let i in freqs) {
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
      assert.equal(core.char(null), null)
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
          for (let i in p) {
            if (p.hasOwnProperty(i)) {
              assert(p[i] > 0)
            }
          }
        })
      }
    })
  })

  describe('.coin()', () => {
    it('should return head or tail with 50% chance', () => {
      utils.trials(() => {
        const head = parseInt(Math.random() * 20)
        const tail = parseInt(Math.random() * 20)
        const values = []
        for (let lap = 0; lap < LAPS; lap++) {
          let r = core.coin(head, tail)
          r = [r]
          r.forEach(ri => values.push(ri))
        }

        // Distribution is uniform
        return utils.chiTest(values, () => {
          return 0.5
        }, 1)
      }, 8)
    })

    it('should return multiple heads/tails with specific probability', () => {
      utils.trials(() => {
        const p = Math.random()
        const k = Math.floor(Math.random() * 10)
        const head = parseInt(Math.random() * 20)
        const tail = parseInt(Math.random() * 20)
        const values = []
        for (let lap = 0; lap < LAPS; lap++) {
          let r = core.coin(head, tail, p, k)
          if (k < 2) { r = [r] }
          r.forEach(ri => values.push(ri))
        }

        // Distribution is uniform
        return utils.chiTest(values, x => x === head ? p : 1 - p, 1)
      }, 8)
    })
  })
})
