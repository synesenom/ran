import { assert } from 'chai'
import { describe, it } from 'mocha'
import AdaptiveMetropolis from '../../src/mc/adaptive-metropolis'
import RWM from '../../src/mc/rwm'
import { Normal } from '../../src/dist'
import { ksTest, ess } from '../test-utils'
import { SEEDS } from './_helpers'

describe('mc.AdaptiveMetropolis', () => {
  describe('constructor', () => {
    it('should instantiate without error for a 1D Normal target', () => {
      assert.doesNotThrow(() => new AdaptiveMetropolis({ logDensity: x => -0.5 * x[0] * x[0], config: { dim: 1 } }))
    })

    it('should instantiate without error for a 5D target', () => {
      assert.doesNotThrow(() => new AdaptiveMetropolis({ logDensity: x => -0.5 * x.reduce((s, v) => s + v * v, 0), config: { dim: 5 } }))
    })

    it('should default config and initialState when omitted entirely from the options object', () => {
      const am = new AdaptiveMetropolis({ logDensity: x => -0.5 * x[0] * x[0] })
      assert.strictEqual(am.dim, 1)
      assert.strictEqual(am.maxLag, 100)
    })

    it('should resolve config when initialState is omitted from the options object', () => {
      const am = new AdaptiveMetropolis({ logDensity: x => -0.5 * (x[0] * x[0] + x[1] * x[1]), config: { dim: 2 } })
      assert.strictEqual(am.dim, 2)
    })

    it('should resolve initialState when config is omitted from the options object', () => {
      const am = new AdaptiveMetropolis({ logDensity: () => 0, initialState: { x: [7] } })
      assert.deepStrictEqual(am.x, [7])
    })

    it('should validate config', () => {
      assert.throws(() => new AdaptiveMetropolis({ logDensity: () => 0, config: { dim: 0 } }), /dim must be a positive integer/)
    })

    it('should throw a clear error when called with no arguments', () => {
      assert.throws(() => new AdaptiveMetropolis(), /AdaptiveMetropolis: constructor requires an options object/)
    })

    it('should throw a clear error when called with null', () => {
      assert.throws(() => new AdaptiveMetropolis(null), /AdaptiveMetropolis: constructor requires an options object/)
    })

    it('should throw a clear error when called with an array', () => {
      assert.throws(() => new AdaptiveMetropolis([1, 2]), /AdaptiveMetropolis: constructor requires an options object/)
    })

    it('should throw a clear error when called with a non-object primitive', () => {
      assert.throws(() => new AdaptiveMetropolis(42), /AdaptiveMetropolis: constructor requires an options object/)
      assert.throws(() => new AdaptiveMetropolis('logDensity'), /AdaptiveMetropolis: constructor requires an options object/)
    })
  })

  describe('._iter() rejection', () => {
    it('should return accepted: false and leave position unchanged when all proposals are rejected', () => {
      // lnp = () => -Infinity: Math.exp(-Inf - (-Inf)) = NaN; float() < NaN = false always
      const am = new AdaptiveMetropolis({ logDensity: () => -Infinity, config: { dim: 1 }, initialState: { x: [42] } })
      const result = am.iterate()
      assert.strictEqual(result.accepted, false)
      assert.strictEqual(am.x[0], 42)
    })
  })

  describe('EPS regularization under near-singular covariance', () => {
    it('should not throw and should regularize the proposal transform to exactly EPS * I when warmUp() sees an all-rejecting target', () => {
      // lnp = () => -Infinity: every proposal is rejected (see "._iter() rejection" above), so x
      // never moves and the online covariance accumulator stays exactly rank-deficient (all-zero)
      // throughout warm-up -- the near-singular case EPS * I exists to guard against.
      const dim = 3
      const am = new AdaptiveMetropolis({ logDensity: () => -Infinity, config: { dim }, initialState: { x: new Array(dim).fill(0) } })
      assert.doesNotThrow(() => am.warmUp(null, 1))
      const { proposal } = am.state().internal
      // exact rational: Sigma_proposal = _sd * Cov(x) + EPS * I collapses to EPS * I since Cov(x)
      // is exactly zero (every proposal rejected), so ldl() yields L = I, D = EPS * I, and
      // A = L * sqrt(D) = diag(sqrt(EPS), sqrt(EPS), sqrt(EPS)) with zero off-diagonal entries.
      proposal.forEach((row, i) => row.forEach((v, j) => {
        assert.closeTo(v, i === j ? Math.sqrt(1e-6) : 0, 1e-9)
      }))
    })
  })

  describe('joint proposals', () => {
    it('should perturb every component during warm-up, not one at a time', () => {
      const am = new AdaptiveMetropolis({ logDensity: () => 0, config: { dim: 3 }, initialState: { x: [0, 0, 0] } }).seed(42)
      const prev = am.x.slice()
      const { x } = am.iterate(null, true)
      assert.strictEqual(x.filter((v, j) => v !== prev[j]).length, 3)
    })

    SEEDS.forEach(seed => {
      it(`should recover both margins of an independent 2D standard Normal target (KS test, seed ${seed})`, () => {
        const am = new AdaptiveMetropolis({ logDensity: x => -0.5 * (x[0] * x[0] + x[1] * x[1]), config: { dim: 2 } }).seed(seed)
        am.warmUp(null, 10)
        const samples = am.sample(null, 2000)
        const ref = new Normal(0, 1)
        assert(ksTest(samples.map(s => s[0]), x => ref.cdf(x)))
        assert(ksTest(samples.map(s => s[1]), x => ref.cdf(x)))
      })
    })
  })

  describe('.state() round-trip', () => {
    it('should restore position, samplingRate, and proposal covariance', () => {
      const lnp = x => -0.5 * x[0] * x[0]
      const am1 = new AdaptiveMetropolis({ logDensity: lnp, config: { dim: 1 } })
      for (let i = 0; i < 100; i++) am1.iterate()
      const state = am1.state()
      const am2 = new AdaptiveMetropolis({ logDensity: lnp, config: { dim: 1 }, initialState: state })
      assert.deepEqual(am2.x, state.x)
      assert.strictEqual(am2.samplingRate, state.samplingRate)
      assert.deepEqual(am2.state().internal.proposal, state.internal.proposal)
    })
  })

  describe('frozen covariance during sampling', () => {
    it('should not change the proposal covariance once sample() starts', () => {
      const am = new AdaptiveMetropolis({ logDensity: x => -0.5 * (x[0] * x[0] + x[1] * x[1]), config: { dim: 2 } }).seed(3)
      am.warmUp(null, 5)
      const before = am.state().internal.proposal
      am.sample(null, 500)
      const after = am.state().internal.proposal
      assert.deepEqual(before, after)
    })
  })

  describe('.ar() during sampling', () => {
    it('should lie in a reasonable range for a well-tuned 1D Normal target', () => {
      const am = new AdaptiveMetropolis({ logDensity: x => -0.5 * x[0] * x[0], config: { dim: 1 } })
      am.warmUp(null, 5)
      am.sample(null, 1000)
      const ar = am.ar()
      assert(ar >= 0.15 && ar <= 0.85, `acceptance rate ${ar} outside [0.15, 0.85]`)
    })
  })

  describe('.sample() distributional test', () => {
    SEEDS.forEach(seed => {
      it(`should produce samples matching Normal(0,1) target (KS test, seed ${seed})`, () => {
        const am = new AdaptiveMetropolis({ logDensity: x => -0.5 * x[0] * x[0], config: { dim: 1 } }).seed(seed)
        am.warmUp(null, 10)
        const samples = am.sample(null, 2000)
        const values = samples.map(s => s[0])
        const ref = new Normal(0, 1)
        assert(ksTest(values, x => ref.cdf(x)))
      })
    })
  })

  describe('.seed()', () => {
    const logDensity = x => -0.5 * x[0] ** 2;

    [0, 42, 12345].forEach(seed => {
      it(`should produce bitwise-identical samples when seed ${seed} is applied twice`, () => {
        const am1 = new AdaptiveMetropolis({ logDensity, config: { dim: 1 } }).seed(seed)
        am1.warmUp(null, 3)
        const samples1 = am1.sample(null, 50)

        const am2 = new AdaptiveMetropolis({ logDensity, config: { dim: 1 } }).seed(seed)
        am2.warmUp(null, 3)
        const samples2 = am2.sample(null, 50)

        assert.deepEqual(samples1, samples2)
      })
    })

    it('should produce different samples for different seeds', () => {
      const am0 = new AdaptiveMetropolis({ logDensity, config: { dim: 1 } }).seed(0)
      am0.warmUp(null, 3)
      const samples0 = am0.sample(null, 50)

      const am1 = new AdaptiveMetropolis({ logDensity, config: { dim: 1 } }).seed(1)
      am1.warmUp(null, 3)
      const samples1 = am1.sample(null, 50)

      assert.notDeepEqual(samples0, samples1)
    })
  })

  describe('5D correlated Normal ESS comparison', () => {
    it('should achieve higher effective sample size than RWM for equal iteration counts', () => {
      // AR(1)-correlation target: Sigma_ij = 0.7^|i-j|, dim = 5. The exact inverse of an
      // AR(1) correlation matrix is tridiagonal (standard result), avoiding a runtime matrix
      // inversion inside the test's hot log-density path.
      const rho = 0.7
      const denom = 1 - rho * rho
      const diagEdge = 1 / denom
      const diagMid = (1 + rho * rho) / denom
      const offDiag = -rho / denom
      const lnp = x => {
        let q = 0
        for (let i = 0; i < 5; i++) {
          const dii = (i === 0 || i === 4) ? diagEdge : diagMid
          q += dii * x[i] * x[i]
        }
        for (let i = 0; i < 4; i++) {
          q += 2 * offDiag * x[i] * x[i + 1]
        }
        return -0.5 * q
      }

      const warmUpBatches = 20
      const sampleSize = 2000

      // A single seed's ESS estimate is a noisy point estimate (ess() truncates its
      // autocorrelation sum at maxLag if it never crosses zero, so one unlucky chain could
      // flip the comparison). Averaging the AM/RWM ESS ratio over several independent seeds
      // and requiring a safety margin makes the assertion robust to that per-seed noise.
      const seeds = [1, 2, 3, 4, 5]
      const ratios = seeds.map(seed => {
        const am = new AdaptiveMetropolis({ logDensity: lnp, config: { dim: 5 } }).seed(seed)
        am.warmUp(null, warmUpBatches)
        am.sample(null, sampleSize)
        const amEss = ess(am)

        const rwm = new RWM({ logDensity: lnp, config: { dim: 5 } }).seed(seed)
        rwm.warmUp(null, warmUpBatches)
        rwm.sample(null, sampleSize)
        const rwmEss = ess(rwm)

        return amEss / rwmEss
      })
      const meanRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length

      assert(meanRatio > 1.1, `AdaptiveMetropolis/RWM mean ESS ratio (${meanRatio}) over seeds ${seeds} should exceed 1.1`)
    })
  })
})
