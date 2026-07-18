import { assert } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import Gibbs from '../../src/mc/gibbs'
import { Normal } from '../../src/dist'
import pearson from '../../src/dependence/pearson'
import { ksTest } from '../test-utils'

describe('mc.Gibbs', () => {
  // Full conditionals for a bivariate standard Normal with correlation rho:
  // x_i | x_j ~ Normal(rho * x_j, sqrt(1 - rho^2))
  const rho = 0.5
  const sigma = Math.sqrt(1 - rho * rho)
  const conditionals = [
    x => new Normal(rho * x[1], sigma).sample(),
    x => new Normal(rho * x[0], sigma).sample()
  ]

  describe('constructor', () => {
    it('should instantiate without error when config.dim matches conditionals.length', () => {
      assert.doesNotThrow(() => new Gibbs(conditionals, { dim: 2 }))
    })

    it('should default dim to conditionals.length when config.dim is omitted', () => {
      const gibbs = new Gibbs(conditionals)
      assert.strictEqual(gibbs.dim, 2)
    })

    it('should throw when conditionals is empty', () => {
      assert.throws(() => new Gibbs([]), /conditionals must be a non-empty array/)
    })

    it('should throw when conditionals is not an array', () => {
      assert.throws(() => new Gibbs(null), /conditionals must be a non-empty array/)
    })

    it('should throw when config.dim does not match conditionals.length', () => {
      assert.throws(() => new Gibbs(conditionals, { dim: 3 }), /config.dim must match conditionals.length/)
    })
  })

  describe('._iter()', () => {
    it('should replace one coordinate at a time using the current full state', () => {
      // Deterministic conditionals (no sampling) isolate the sweep order from randomness:
      // dim 0 sees the state as constructed, dim 1 must see dim 0 already replaced.
      const seen = []
      const det = [
        x => { seen.push(x.slice()); return 10 },
        x => { seen.push(x.slice()); return 20 }
      ]
      const gibbs = new Gibbs(det, { dim: 2 }, { x: [1, 2] })
      const result = gibbs.iterate()
      assert.deepEqual(seen[0], [1, 2])
      assert.deepEqual(seen[1], [10, 2])
      assert.deepEqual(result.x, [10, 20])
      assert.strictEqual(result.accepted, true)
    })
  })

  describe('.ar()', () => {
    it('should always be 1.0 regardless of the number of iterations', () => {
      const gibbs = new Gibbs(conditionals, { dim: 2 }, { x: [0, 0] })
      for (let i = 0; i < 5; i++) {
        gibbs.iterate()
        assert.strictEqual(gibbs.ar(), 1.0)
      }
      for (let i = 0; i < 200; i++) gibbs.iterate()
      assert.strictEqual(gibbs.ar(), 1.0)
    })
  })

  describe('.sample() distributional test', () => {
    // gibbs.seed() only reseeds Gibbs's own this.r, which _iter() never reads — Gibbs's actual
    // randomness comes entirely from the caller-supplied conditionals. The module-scope
    // `conditionals` above construct a fresh `new Normal(...)` on every call, and Distribution's
    // constructor seeds its own PRNG from Math.random() when no seed is given, so those draws are
    // never reproducible regardless of what gibbs.seed(x) is called with. Fixed here by reusing a
    // single, explicitly-seeded standard-Normal generator across every conditional call instead
    // of constructing a new (unseeded) one per call. See
    // solutions/testing/2026-07-15-2015-gibbs-conditionals-fresh-normal-seed-noop.md
    ;[0, 7, 42].forEach(seed => {
      it(`should recover both margins of a correlated bivariate Normal target (KS test, seed ${seed})`, () => {
        const z = new Normal(0, 1).seed(seed)
        const seededConditionals = [
          x => rho * x[1] + sigma * z.sample(),
          x => rho * x[0] + sigma * z.sample()
        ]
        const gibbs = new Gibbs(seededConditionals, { dim: 2 }, { x: [0, 0] })
        gibbs.warmUp(null, 5)
        const samples = gibbs.sample(null, 2000)
        const ref = new Normal(0, 1)
        assert(ksTest(samples.map(s => s[0]), x => ref.cdf(x)))
        assert(ksTest(samples.map(s => s[1]), x => ref.cdf(x)))
        // Both margins are standard Normal regardless of rho, so the KS tests above
        // cannot detect a sign flip or a swapped source dimension in the conditionals;
        // the joint correlation is the only statistic that distinguishes them.
        // SE(r) ~= (1 - rho^2) / sqrt(n - 1) ~= 0.0168 for rho=0.5, n=2000, so 0.1 is ~6 SE.
        const r = pearson(samples.map(s => s[0]), samples.map(s => s[1]))
        assert.approximately(r, rho, 0.1)
      })
    })
  })

  describe('.state() round-trip', () => {
    it('should restore position and samplingRate, resuming the chain correctly', () => {
      const gibbs1 = new Gibbs(conditionals, { dim: 2 }, { x: [0, 0] })
      for (let i = 0; i < 50; i++) gibbs1.iterate()
      const state = gibbs1.state()
      assert.deepEqual(state.internal, {})

      const gibbs2 = new Gibbs(conditionals, { dim: 2 }, state)
      assert.deepEqual(gibbs2.x, state.x)
      assert.strictEqual(gibbs2.samplingRate, state.samplingRate)
      assert.doesNotThrow(() => gibbs2.iterate())
    })
  })

  describe('.seed()', () => {
    // Deliberately not a statistically meaningful conditional (distributional
    // correctness is already covered by the KS test above) — this exists only
    // to exercise rng.next() so the assertion tests the actual seeded data
    // path, not merely that .seed() was called. See
    // solutions/testing/2026-07-15-2015-gibbs-conditionals-fresh-normal-seed-noop.md
    const rngConditionals = [
      (x, rng) => rho * x[1] + sigma * rng.next(),
      (x, rng) => rho * x[0] + sigma * rng.next()
    ];

    [0, 42, 12345].forEach(seed => {
      it(`should produce bitwise-identical samples when seed ${seed} is applied twice`, () => {
        const gibbs1 = new Gibbs(rngConditionals, { dim: 2 }, { x: [0, 0] }).seed(seed)
        gibbs1.warmUp(null, 3)
        const samples1 = gibbs1.sample(null, 50)

        const gibbs2 = new Gibbs(rngConditionals, { dim: 2 }, { x: [0, 0] }).seed(seed)
        gibbs2.warmUp(null, 3)
        const samples2 = gibbs2.sample(null, 50)

        assert.deepEqual(samples1, samples2)
      })
    })

    it('should produce different samples for different seeds', () => {
      const gibbs0 = new Gibbs(rngConditionals, { dim: 2 }, { x: [0, 0] }).seed(0)
      gibbs0.warmUp(null, 3)
      const samples0 = gibbs0.sample(null, 50)

      const gibbs1 = new Gibbs(rngConditionals, { dim: 2 }, { x: [0, 0] }).seed(1)
      gibbs1.warmUp(null, 3)
      const samples1 = gibbs1.sample(null, 50)

      assert.notDeepEqual(samples0, samples1)
    })

    it('should still produce finite, well-formed samples for conditionals that ignore the second (rng) argument', () => {
      const gibbs = new Gibbs(conditionals, { dim: 2 }, { x: [0, 0] }).seed(42)
      const samples = gibbs.sample(null, 10)
      assert.strictEqual(samples.length, 10)
      assert(samples.every(s => s.length === 2 && s.every(Number.isFinite)))
    })
  })

  // Gibbs's identifying key is `conditionals`, not `logDensity`, so it cannot reuse
  // assertConstructorFormsMatch (hardcoded to the logDensity key); assertions are inlined instead.
  describe('options-object constructor form', () => {
    let originalWarn
    let warnCalls

    beforeEach(() => {
      originalWarn = console.warn
      warnCalls = []
      console.warn = (...args) => warnCalls.push(args)
    })

    afterEach(() => {
      console.warn = originalWarn
    })

    it('should behave identically to the positional form, including config defaults never explicitly passed', () => {
      // Deterministic conditionals (not the module-scope `conditionals`, whose fresh
      // `new Normal(...)` per call is a documented seed()-noop pitfall — see
      // solutions/testing/2026-07-15-2015-gibbs-conditionals-fresh-normal-seed-noop.md) so the
      // seeded iterate() comparison below is actually meaningful.
      const det = [x => x[1] + 1, x => x[0] + 1]
      const positional = new Gibbs(det, { dim: 2 }, { x: [0, 0] })
      const options = new Gibbs({ conditionals: det, config: { dim: 2 }, initialState: { x: [0, 0] } })
      assert.strictEqual(options.dim, positional.dim)
      assert.strictEqual(options.maxLag, positional.maxLag)
      assert.strictEqual(options._arWindow, positional._arWindow)
      assert.deepStrictEqual(options.x, positional.x)
      assert.deepStrictEqual(options.state().internal, positional.state().internal)
      options.seed(11)
      positional.seed(11)
      assert.deepStrictEqual(options.iterate(), positional.iterate())
    })

    it('should default config and initialState when omitted entirely from the options object', () => {
      const gibbs = new Gibbs({ conditionals })
      assert.strictEqual(gibbs.dim, 2)
      assert.strictEqual(gibbs.maxLag, 100)
      assert.strictEqual(gibbs.x.length, 2)
      assert(gibbs.x.every(Number.isFinite))
    })

    it('should not misdetect a positional conditionals array carrying a stray "conditionals" own-property as the options-object form', () => {
      // Arrays can hold arbitrary own-properties in JS; a positional conditionals array that
      // happens to have a `.conditionals` property must still resolve as the positional form,
      // not be mistaken for { conditionals, config, initialState }.
      const det = [x => x[1] + 1, x => x[0] + 1]
      det.conditionals = [x => 999]
      const gibbs = new Gibbs(det, { dim: 2 }, { x: [0, 0] })
      assert.strictEqual(gibbs.dim, 2)
      assert.deepEqual(gibbs.iterate().x, [1, 2])
    })

    it('should resolve config when initialState is omitted from the options object', () => {
      const gibbs = new Gibbs({ conditionals, config: { dim: 2 } })
      assert.strictEqual(gibbs.dim, 2)
    })

    it('should resolve initialState when config is omitted from the options object', () => {
      const gibbs = new Gibbs({ conditionals, initialState: { x: [1, 1] } })
      assert.deepStrictEqual(gibbs.x, [1, 1])
    })

    it('should validate config.dim against conditionals.length the same way as the positional form', () => {
      assert.throws(() => new Gibbs({ conditionals, config: { dim: 3 } }), /config.dim must match conditionals.length/)
    })

    it('should throw when conditionals is empty in the options-object form', () => {
      assert.throws(() => new Gibbs({ conditionals: [] }), /conditionals must be a non-empty array/)
    })

    it('should not emit a deprecation warning for the options-object form', () => {
      assert.doesNotThrow(() => new Gibbs({ conditionals }))
      assert.strictEqual(warnCalls.length, 0)
    })

    it('should emit exactly one deprecation warning per instantiation for the positional form', () => {
      assert.doesNotThrow(() => new Gibbs(conditionals, { dim: 2 }))
      assert.strictEqual(warnCalls.length, 1)
      assert.match(warnCalls[0][0], /\[ranjs] positional MCMC constructor arguments are deprecated/)
      assert.match(warnCalls[0][0], /new Gibbs\(\{ conditionals, config, initialState \}\)/)

      assert.doesNotThrow(() => new Gibbs(conditionals, { dim: 2 }))
      assert.strictEqual(warnCalls.length, 2)
    })
  })
})
