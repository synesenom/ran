import { assert } from 'chai'
import { describe, it } from 'mocha'
import ParallelTempering from '../../src/mc/parallel-tempering'
import { Normal } from '../../src/dist'
import { ksTest } from '../test-utils'

describe('mc.ParallelTempering', () => {
  const logDensity = x => -0.5 * x[0] * x[0]

  describe('constructor', () => {
    it('should throw when logDensity is not a function', () => {
      assert.throws(() => new ParallelTempering({ logDensity: null, temperatures: [1, 0.5] }), /logDensity must be a function/)
      assert.throws(() => new ParallelTempering({ temperatures: [1, 0.5] }), /logDensity must be a function/)
      assert.throws(() => new ParallelTempering(), /logDensity must be a function/)
    })

    it('should throw when neither temperatures nor nReplicas/tempMax are provided', () => {
      assert.throws(() => new ParallelTempering({ logDensity }), /temperatures.*nReplicas.*tempMax|Either/)
    })

    it('should throw when temperatures is not an array', () => {
      assert.throws(() => new ParallelTempering({ logDensity, temperatures: 'nope' }), /temperatures must be an array/)
    })

    it('should throw when temperatures has fewer than two entries', () => {
      assert.throws(() => new ParallelTempering({ logDensity, temperatures: [1] }), /temperatures must be an array of at least two/)
    })

    it('should throw when temperatures does not start at 1', () => {
      assert.throws(() => new ParallelTempering({ logDensity, temperatures: [0.9, 0.5] }), /temperatures\[0\] must equal 1/)
    })

    it('should throw when temperatures is not strictly descending', () => {
      assert.throws(() => new ParallelTempering({ logDensity, temperatures: [1, 1, 0.5] }), /temperatures must be strictly descending/)
      assert.throws(() => new ParallelTempering({ logDensity, temperatures: [1, 0.5, 0.6] }), /temperatures must be strictly descending/)
    })

    it('should throw when temperatures contains a non-positive or non-finite value', () => {
      assert.throws(() => new ParallelTempering({ logDensity, temperatures: [1, 0] }), /temperatures must contain only positive finite/)
      assert.throws(() => new ParallelTempering({ logDensity, temperatures: [1, NaN] }), /temperatures must contain only positive finite/)
      assert.throws(() => new ParallelTempering({ logDensity, temperatures: [1, -Infinity] }), /temperatures must contain only positive finite/)
    })

    it('should not throw for a valid temperatures array', () => {
      assert.doesNotThrow(() => new ParallelTempering({ logDensity, temperatures: [1, 0.5, 0.25] }))
    })

    it('should throw when nReplicas is not an integer of at least two', () => {
      assert.throws(() => new ParallelTempering({ logDensity, nReplicas: 1, tempMax: 10 }), /nReplicas must be an integer/)
      assert.throws(() => new ParallelTempering({ logDensity, nReplicas: 2.5, tempMax: 10 }), /nReplicas must be an integer/)
    })

    it('should throw when nReplicas exceeds the maximum allowed', () => {
      assert.throws(() => new ParallelTempering({ logDensity, nReplicas: 10001, tempMax: 10 }), /nReplicas must be at most/)
    })

    it('should throw when tempMax is not a finite number greater than 1', () => {
      assert.throws(() => new ParallelTempering({ logDensity, nReplicas: 3, tempMax: 1 }), /tempMax must be a finite number greater than 1/)
      assert.throws(() => new ParallelTempering({ logDensity, nReplicas: 3, tempMax: Infinity }), /tempMax must be a finite number greater than 1/)
      assert.throws(() => new ParallelTempering({ logDensity, nReplicas: 3, tempMax: NaN }), /tempMax must be a finite number greater than 1/)
    })

    it('should not throw for valid nReplicas and tempMax', () => {
      assert.doesNotThrow(() => new ParallelTempering({ logDensity, nReplicas: 4, tempMax: 100 }))
    })

    it('should auto-generate a strictly descending geometric ladder from nReplicas and tempMax', () => {
      const pt = new ParallelTempering({ logDensity, nReplicas: 4, tempMax: 100 })
      // beta_i = tempMax^(-i/(nReplicas-1)) for i = 0..3 -> [1, 100^(-1/3), 100^(-2/3), 0.01].
      // Interior values checked against 10^(-2/3) and 10^(-4/3) (100^(-1/3) === 10^(-2/3) algebraically),
      // a different exponent/base decomposition than the source's Math.pow(tempMax, -i/(n-1)) call,
      // so this can't pass merely by re-deriving the same formula the implementation uses.
      assert.strictEqual(pt.temperatures.length, 4)
      assert.strictEqual(pt.temperatures[0], 1)
      // exact rational: 10^(-2/3) -> 0.2154434690031884
      assert.closeTo(pt.temperatures[1], 0.2154434690031884, 1e-12)
      // exact rational: 10^(-4/3) -> 0.046415888336127795
      assert.closeTo(pt.temperatures[2], 0.046415888336127795, 1e-12)
      assert.closeTo(pt.temperatures[3], 0.01, 1e-12)
      for (let i = 0; i < 3; i++) {
        assert.isBelow(pt.temperatures[i + 1], pt.temperatures[i])
      }
    })

    it('should expose the caller-supplied temperatures array unchanged', () => {
      const pt = new ParallelTempering({ logDensity, temperatures: [1, 0.6, 0.3] })
      assert.deepEqual(pt.temperatures, [1, 0.6, 0.3])
    })
  })

  describe('positional constructor (deprecated)', () => {
    // The "warns exactly once" assertion below depends on the source module's `warnedPositionalDeprecation`
    // flag still being unset when this test runs. That holds only because this is the SOLE positional-form
    // construction in this file/process — a second positional `new ParallelTempering(fn, ...)` added earlier
    // in this file would pre-trip the flag and make `warnings.length` come back 0, failing here for a reason
    // unrelated to the deprecation logic. Keep positional construction confined to this block.
    it('should still construct and sample, warning exactly once regardless of how many positional instances are built', () => {
      const warnings = []
      const originalWarn = console.warn
      // Capture instead of silencing so a regression that stops warning (or over-warns) is caught,
      // and so the deprecation notice never leaks into the test runner's output.
      console.warn = msg => warnings.push(msg)
      try {
        const pt = new ParallelTempering(logDensity, { nReplicas: 3, tempMax: 10 }).seed(1)
        pt.warmUp(null, 3)
        const samples = pt.sample(null, 50)
        assert.strictEqual(samples.length, 50)
        assert(samples.every(s => s.length === 1 && Number.isFinite(s[0])))
        // A second positional instance must NOT emit another warning (module-level once-only flag).
        assert(new ParallelTempering(logDensity, { temperatures: [1, 0.5] }) instanceof ParallelTempering)
        // Positional form with the options argument omitted still routes through the deprecated path.
        assert.throws(() => new ParallelTempering(logDensity), /either temperatures or nReplicas and tempMax/)
      } finally {
        console.warn = originalWarn
      }
      assert.strictEqual(warnings.length, 1)
      assert.match(warnings[0], /ParallelTempering\(logDensity, options\) positional constructor is deprecated and will be removed in v1\.32\.0/)
    })
  })

  describe('.state', () => {
    it('should not be resumable — state() is not implemented', () => {
      const pt = new ParallelTempering({ logDensity, temperatures: [1, 0.5] })
      assert.notStrictEqual(typeof pt.state, 'function')
    })
  })

  describe('swap mechanics', () => {
    it('should exchange positions and recompute each replica\'s cached scaled log-density on an accepted swap', () => {
      const pt = new ParallelTempering({ logDensity, temperatures: [1, 0.5] })
      // Positions chosen so (beta_0 - beta_1) * (lnp(x1) - lnp(x0)) = 0.5 * (0 - (-12.5)) = 6.25 >= 0
      // (the hotter replica currently holds the higher-density position), making the acceptance
      // probability exp(6.25) > 1 -- the swap is accepted for ANY draw in [0,1), so the test is
      // deterministic without needing to control the coordinator's RNG. See the _proposeSwap
      // implementation comment for why the formula uses (lnpJ - lnpI), not (lnpI - lnpJ).
      pt._replicas[0].x = [5]
      pt._replicas[1].x = [0]
      pt._proposeSwap(0)
      assert.deepEqual(pt._replicas[0].x, [0])
      assert.deepEqual(pt._replicas[1].x, [5])
      assert.strictEqual(pt._replicas[0].lastLnp, pt._replicas[0].lnp(pt._replicas[0].x))
      assert.strictEqual(pt._replicas[1].lastLnp, pt._replicas[1].lnp(pt._replicas[1].x))
      assert.strictEqual(pt._swapAttempts[0], 1)
      assert.strictEqual(pt._swapAccepts[0], 1)
    })

    it('should count an attempted-but-rejected swap without exchanging positions', () => {
      const pt = new ParallelTempering({ logDensity, temperatures: [1, 0.5] })
      // Reversed positions: (beta_0 - beta_1) * (lnp(x1) - lnp(x0)) = 0.5 * (-12.5 - 0) = -6.25,
      // acceptance probability exp(-6.25) ~= 0.00193. Stubbing r.next() to return a value
      // comfortably above that threshold makes rejection deterministic instead of depending on
      // a fixed seed happening to draw above it -- a future change to Xoshiro128p, the swap loop,
      // or the seed-derivation in seed() could otherwise flip the draw and silently stop this test
      // from exercising its own assertions.
      pt._replicas[0].x = [0]
      pt._replicas[1].x = [5]
      const before0 = pt._replicas[0].x.slice()
      const before1 = pt._replicas[1].x.slice()
      pt.r.next = () => 0.99
      pt._proposeSwap(0)
      assert.strictEqual(pt._swapAttempts[0], 1)
      assert.strictEqual(pt._swapAccepts[0], 0)
      assert.deepEqual(pt._replicas[0].x, before0)
      assert.deepEqual(pt._replicas[1].x, before1)
    })
  })

  describe('.warmUp() and .sample()', () => {
    it('should return size samples of the correct dimensionality from the cold replica', () => {
      const pt = new ParallelTempering({ logDensity, nReplicas: 3, tempMax: 10 }).seed(1)
      pt.warmUp(null, 3)
      const samples = pt.sample(null, 50)
      assert.strictEqual(samples.length, 50)
      assert(samples.every(s => s.length === 1 && Number.isFinite(s[0])))
    })

    it('should report warmUp() progress once per replica, ending at 100', () => {
      const pt = new ParallelTempering({ logDensity, nReplicas: 3, tempMax: 10 })
      const pcts = []
      pt.warmUp(p => pcts.push(p), 2)
      assert.strictEqual(pcts.length, 3)
      assert.strictEqual(pcts[pcts.length - 1], 100)
    })

    it('should report each integer percent of sample() progress once, in increasing order', () => {
      const pt = new ParallelTempering({ logDensity, nReplicas: 3, tempMax: 10 }).seed(1)
      pt.warmUp(null, 3)
      const pcts = []
      pt.sample(p => pcts.push(p), 50)
      assert(pcts.every(p => Number.isInteger(p) && p >= 0 && p < 100))
      assert.deepEqual(pcts, pcts.slice().sort((a, b) => a - b))
      assert.strictEqual(new Set(pcts).size, pcts.length)
    })
  })

  describe('.swapRate()', () => {
    it('should return one entry per adjacent pair, each in [0, 1], with at least one non-zero for a well-spaced ladder', () => {
      const pt = new ParallelTempering({ logDensity, nReplicas: 4, tempMax: 20 }).seed(2)
      pt.warmUp(null, 5)
      pt.sample(null, 500)
      const rates = pt.swapRate()
      assert.strictEqual(rates.length, 3)
      assert(rates.every(r => r >= 0 && r <= 1))
      assert(rates.some(r => r > 0), `expected at least one non-zero swap rate, got ${rates}`)
    })
  })

  describe('.seed()', () => {
    it('should produce bitwise-identical samples when the same seed is applied twice', () => {
      const pt1 = new ParallelTempering({ logDensity, nReplicas: 3, tempMax: 10 }).seed(42)
      pt1.warmUp(null, 3)
      const samples1 = pt1.sample(null, 50)

      const pt2 = new ParallelTempering({ logDensity, nReplicas: 3, tempMax: 10 }).seed(42)
      pt2.warmUp(null, 3)
      const samples2 = pt2.sample(null, 50)

      assert.deepEqual(samples1, samples2)
    })

    it('should produce different samples for different seeds', () => {
      const pt1 = new ParallelTempering({ logDensity, nReplicas: 3, tempMax: 10 }).seed(1)
      pt1.warmUp(null, 3)
      const samples1 = pt1.sample(null, 50)

      const pt2 = new ParallelTempering({ logDensity, nReplicas: 3, tempMax: 10 }).seed(2)
      pt2.warmUp(null, 3)
      const samples2 = pt2.sample(null, 50)

      assert.notDeepEqual(samples1, samples2)
    })
  })

  describe('bimodal target coverage', () => {
    // Sum of two well-separated 1D Gaussians (mu = +-10, sigma = 1): a single RWM chain at beta=1
    // cannot cross the ~50-log-density barrier between modes, but the hottest replica's flattened
    // target (beta ~ 1/tempMax) can, and swaps carry that mixing down to the cold (beta=1) chain.
    const mu = 10
    const g1 = new Normal(-mu, 1)
    const g2 = new Normal(mu, 1)
    const bimodalLogDensity = x => Math.log(
      0.5 * Math.exp(-0.5 * (x[0] + mu) * (x[0] + mu)) + 0.5 * Math.exp(-0.5 * (x[0] - mu) * (x[0] - mu))
    )
    const mixtureCdf = x => 0.5 * g1.cdf(x) + 0.5 * g2.cdf(x)

    ;[0, 42, 12345].forEach(seed => {
      it(`should visit both modes and match the true bimodal distribution (KS test, seed ${seed})`, () => {
        // nReplicas: 4 keeps the hot-to-cold swap relay short (each successful mode-crossing at the
        // hottest replica needs only 3 successful adjacent swaps to reach the cold chain); a longer
        // ladder (e.g. 6-8 replicas) was empirically slower to decorrelate the cold chain's mode
        // occupancy at a matched sample size, pushing the KS statistic above its critical value for
        // some seeds. warmUp: 15 / size: 4000 (vs. the 10/2000 used by unimodal samplers elsewhere in
        // the test suite) gives the swap relay enough rounds to equilibrate before and during sampling.
        const pt = new ParallelTempering({ logDensity: bimodalLogDensity, nReplicas: 4, tempMax: 100 }).seed(seed)
        pt.warmUp(null, 15)
        const samples = pt.sample(null, 4000)
        const values = samples.map(s => s[0])
        assert(values.some(v => v < 0), 'expected some samples in the negative mode')
        assert(values.some(v => v > 0), 'expected some samples in the positive mode')
        assert(ksTest(values, mixtureCdf))
      })
    })
  })
})
