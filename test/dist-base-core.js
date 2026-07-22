import { assert } from 'chai'
import { describe, it } from 'mocha'
import * as dist from '../src/dist'
import Distribution from '../src/dist/_distribution'

describe('dist', () => {
  // Base class
  describe('Distribution', () => {
    const invalid = new dist.InvalidDiscrete()

    describe('.sample()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.sample()
        }, 'Distribution._generator() is not implemented')
      })
    })

    describe('.pdf()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.pdf(0)
        }, 'Distribution._pdf() is not implemented')
      })

      it('should return 0 when _pdf returns NaN at a closed boundary', () => {
        // Simulates a log-barrier formula that yields 0/0 = NaN at the boundary endpoint.
        class NaNBoundary extends Distribution {
          constructor () {
            super('continuous', 0)
            this.s = [{ value: 0, closed: true }, { value: 1, closed: true }]
            this.c = {}
          }

          _pdf (x) { return x === 0 ? NaN : 1 }
          _cdf (x) { return x }
        }
        const d = new NaNBoundary()
        assert.strictEqual(d.pdf(0), 0)
        assert.strictEqual(d.pdf(0.5), 1)
        assert.isFalse(isNaN(d.mean()))
      })
    })

    describe('.cdf()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.cdf(0)
        }, 'Distribution._cdf() is not implemented')
      })
    })

    describe('.q()', () => {
      it('should throw for p < 0 or p > 1', () => {
        assert.throws(() => invalid.q(-1), Error)
        assert.throws(() => invalid.q(2), Error)
      })
    })

    describe('.q()', () => {
      it('should return support boundary if p === 0 or p === 1', () => {
        assert(invalid.q(0) === invalid.support()[0].value)
        assert(invalid.q(1) === invalid.support()[1].value)
      })
    })

    describe('.load()', () => {
      it('should throw when state.constants is missing a key the current class expects', () => {
        const state = new dist.Chi2(3).save()
        delete state.constants.alpha
        assert.throws(() => dist.Chi2.load(state), Error)
      })

      it('should throw when state.constants has an extra key the current class does not expect', () => {
        const state = new dist.Chi2(3).save()
        state.constants.bogus = 1
        assert.throws(() => dist.Chi2.load(state), Error)
      })

      it('should throw when state.params is missing a key the current class expects', () => {
        const state = new dist.QExponential(0.5, 2).save()
        delete state.params.lambda
        assert.throws(() => dist.QExponential.load(state), Error)
      })

      it('should throw when state.params has an extra key the current class does not expect', () => {
        const state = new dist.QExponential(0.5, 2).save()
        state.params.bogus = 1
        assert.throws(() => dist.QExponential.load(state), Error)
      })

      it('should throw when loading a pre-migration QExponential snapshot shaped like the old this.p/this.c split', () => {
        // Pre-#1058 shape: this.p held the inherited GeneralizedPareto params {mu, sigma, xi}
        // directly and this.c was empty, before ADR-0018 moved them into this.c under {q, lambda}.
        const state = new dist.QExponential(0.5, 2).save()
        state.params = { mu: state.constants.mu, sigma: state.constants.sigma, xi: state.constants.xi }
        state.constants = {}
        assert.throws(() => dist.QExponential.load(state), Error)
      })

      it('should not throw and should round-trip correctly for a valid state', () => {
        const sampleSize = 30
        const cut = 10
        const original = new dist.QExponential(0.5, 2)
        const seed = 123456789
        original.seed(seed)
        const expected = original.sample(sampleSize)

        original.seed(seed)
        original.sample(cut)
        const state = original.save()
        const restored = dist.QExponential.load(state)
        assert.deepEqual(restored.params(), original.params())
        const rest = restored.sample(sampleSize - cut)
        assert(rest.every((d, i) => d === expected[cut + i]))
      })

      it('should round-trip correctly for a distribution whose this.p intentionally holds fewer keys than its constructor arity', () => {
        // Categorical.this.p = { weights } only; `min` is required by the constructor but lives in
        // this.c per decisions/0014-categorical-this-c-natural-params-split.md — the probe must still
        // pad its positional args to reconstruct successfully and validate this shape without error.
        const sampleSize = 30
        const cut = 10
        const original = new dist.Categorical([1, 2, 3], 5)
        const seed = 123456789
        original.seed(seed)
        const expected = original.sample(sampleSize)

        original.seed(seed)
        original.sample(cut)
        const state = original.save()
        const restored = dist.Categorical.load(state)
        assert.deepEqual(restored.params(), original.params())
        const rest = restored.sample(sampleSize - cut)
        assert(rest.every((d, i) => d === expected[cut + i]))
      })

      it('should throw when state.constants is missing a key for a distribution whose this.p holds fewer keys than its constructor arity', () => {
        const state = new dist.Categorical([1, 2, 3], 5).save()
        delete state.constants.min
        assert.throws(() => dist.Categorical.load(state), Error)
      })
    })

    describe('._qEstimateRoot()', () => {
      it('returns boundary value for open point-mass support [5, 5]', () => {
        // CDF jumps 0 → 1 at the open boundary; expansion steps above 5, creating a sign change,
        // and chandrupatla converges to 5, which is clamped to the support [5, 5].
        class DegenerateContinuous extends Distribution {
          constructor () {
            super('continuous', 0)
            this.s = [{ value: 5, closed: false }, { value: 5, closed: false }]
          }

          _pdf () { return 0 }
          _cdf () { return 0.5 }
        }
        const d = new DegenerateContinuous()
        assert.strictEqual(d.q(0.5), 5)
      })

      it('returns NaN when expansion exhausts MAX_ITER without a sign change', () => {
        // Closed [0, 1] support with constant CDF 0.6: cdf(0)=0.6 and cdf(1)=1 are both > 0.3,
        // so the bracket [0, 1] never straddles p=0.3 and the loop cannot expand outside the support.
        class ConstantCDF extends Distribution {
          constructor () {
            super('continuous', 0)
            this.s = [{ value: 0, closed: true }, { value: 1, closed: true }]
          }

          _pdf () { return 0 }
          _cdf () { return 0.6 }
        }
        const d = new ConstantCDF()
        assert(Number.isNaN(d.q(0.3)))
      })
    })

    describe('.survive()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.survival(0)
        }, 'Distribution._cdf() is not implemented')
      })
    })

    describe('.hazard()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.hazard(0)
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.cHazard()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.cHazard(0)
        }, 'Distribution._cdf() is not implemented')
      })
    })

    describe('.lnPdf()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.lnPdf(0)
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.lnL()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.lnL([0])
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.test()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.test([0])
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.aic()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.aic([0])
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.bic()', () => {
      it('should throw not implemented error', () => {
        assert.throws(() => {
          invalid.bic([0])
        }, 'Distribution._pdf() is not implemented')
      })
    })

    describe('.bounded()', () => {
      it('should return "bounded" for Beta (finite lower and upper)', () => {
        assert.equal(new dist.Beta(1, 1).bounded(), 'bounded')
      })

      it('should return "lower" for Exponential (finite lower, infinite upper)', () => {
        assert.equal(new dist.Exponential(1).bounded(), 'lower')
      })

      it('should return "unbounded" for Normal (infinite lower and upper)', () => {
        assert.equal(new dist.Normal(0, 1).bounded(), 'unbounded')
      })

      it('should return "bounded" for Binomial (finite discrete support)', () => {
        assert.equal(new dist.Binomial(10, 0.5).bounded(), 'bounded')
      })

      it('should return "lower" for Poisson (semi-infinite discrete support)', () => {
        assert.equal(new dist.Poisson(3).bounded(), 'lower')
      })
    })
  })
})
