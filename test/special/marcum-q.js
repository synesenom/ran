import { assert } from 'chai'
import { describe, it } from 'mocha'
import { equal } from '../test-utils.js'
import * as special from '../../src/special/index.js'

describe('special.marcumQ', () => {
  describe('.marcumQ()', () => {
    const check = (x, y, mu) => {
      const q1 = special.marcumQ(mu + 1, x, y)
      const q2 = special.marcumQ(mu, x, y)
      const q3 = special.marcumQ(mu + 2, x, y)
      const q4 = special.marcumQ(mu - 1, x, y)
      const r = x > mu
        ? ((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4)
        : ((y + mu) * q2) / (x * q3 + (mu - x) * q1 + y * q4)
      assert(equal(r, 1))
    }

    describe('special cases', () => {
      describe('x = 0', () => {
        it('should satisfy the recurrence relation', () => {
          for (const x of [1, 10, 30]) {
            for (const mu of [2, 4, 7]) {
              assert(equal(special.marcumQ(mu, x, 0), 1))
            }
          }
        })
      })

      describe('y = 1', () => {
        it('should satisfy the recurrence relation', () => {
          for (const y of [40, 60, 80, 100]) {
            for (const mu of [2, 4, 7]) {
              assert(equal(special.marcumQ(mu, 0, y), special.gammaUpperIncomplete(mu, y)))
            }
          }
        })
      })
    })

    describe('series expansion', () => {
      describe('Q', () => {
        it('should satisfy the recurrence relation', () => {
          for (const [x, y, mu] of [[1, 40, 2], [10, 60, 4], [29, 99, 7]]) {
            check(x, y, mu)
          }
        })
      })

      describe('P', () => {
        it('should satisfy the recurrence relation', () => {
          for (const [x, y, mu] of [[1, 10, 30], [10, 15, 32], [29, 20, 35]]) {
            check(x, y, mu)
          }
        })
      })

      it('should match scipy ncx2 reference values', () => {
        [
          { mu: 4, x: 10, y: 20, p: 0.8840146502552253, q: 0.11598534974477473 },
          { mu: 2, x: 5, y: 3, p: 0.10329898661024607, q: 0.8967010133897539 }
        ].forEach(d => {
          assert(equal(special.marcumQ(d.mu, d.x, d.y), d.q), `marcumQ(${d.mu}, ${d.x}, ${d.y})`)
          assert(equal(special.marcumP(d.mu, d.x, d.y), d.p), `marcumP(${d.mu}, ${d.x}, ${d.y})`)
        })
      })
    })

    describe('asymptotic expansion for large xi', () => {
      describe('Q', () => {
        it('should satisfy the recurrence relation', () => {
          for (const [x, y, mu] of [[35, 60, 3], [70, 100, 4.5], [134, 160, 6]]) {
            const q1 = special.marcumQ(mu + 1, x, y)
            const q2 = special.marcumQ(mu, x, y)
            const q3 = special.marcumQ(mu + 2, x, y)
            const q4 = special.marcumQ(mu - 1, x, y)

            assert(equal(((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4), 1))
          }
        })
      })

      describe('P', () => {
        it('should satisfy the recurrence relation', () => {
          for (const [x, y, mu] of [[45, 30, 3], [90, 70, 4.5], [134, 110, 6]]) {
            const q1 = special.marcumQ(mu + 1, x, y)
            const q2 = special.marcumQ(mu, x, y)
            const q3 = special.marcumQ(mu + 2, x, y)
            const q4 = special.marcumQ(mu - 1, x, y)

            assert(equal(((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4), 1))
          }
        })
      })

      it('should match scipy ncx2 reference values', () => {
        [
          { mu: 5, x: 40, y: 60, q: 0.05987990370344369, p: 0.9401200962965562 },
          { mu: 3, x: 120, y: 150, q: 0.04687422045974286, p: 0.9531257795402576 },
          { mu: 10, x: 70, y: 45, q: 0.9994063950877903, p: 0.0005936049122101624 },
          { mu: 3, x: 46, y: 5, q: 0.9999999999966671, p: 3.3330073779888013e-12 }
        ].forEach(d => {
          assert(equal(special.marcumQ(d.mu, d.x, d.y), d.q), `marcumQ(${d.mu}, ${d.x}, ${d.y})`)
          assert(equal(special.marcumP(d.mu, d.x, d.y), d.p), `marcumP(${d.mu}, ${d.x}, ${d.y})`)
        })
      })
    })

    describe('quadrature', () => {
      it('should satisfy the recurrence relation', () => {
        for (const [x, y, mu] of [[40, 0.5, 3], [60, 1, 5], [79, 2, 8]]) {
          const q1 = special.marcumQ(mu + 1, x, y)
          const q2 = special.marcumQ(mu, x, y)
          const q3 = special.marcumQ(mu + 2, x, y)
          const q4 = special.marcumQ(mu - 1, x, y)

          assert(equal(((x - mu) * q1 + (y + mu) * q2) / (x * q3 + y * q4), 1))
        }
      })

      it('should match scipy ncx2 reference values', () => {
        [
          { mu: 140, x: 100, y: 235, p: 0.4015210444334114, q: 0.5984789555665886 },
          { mu: 140, x: 100, y: 200, p: 0.011694400751604403, q: 0.9883055992483956 },
          { mu: 60, x: 200, y: 400, p: 0.9999999966690462, q: 3.3309538428122277e-9 },
          { mu: 5, x: 50, y: 4, p: 7.677483509552288e-16, q: 0.9999999999999992 },
          { mu: 8, x: 60, y: 3, p: 3.3894189213527325e-23, q: 1.0 }
        ].forEach(d => {
          assert(equal(special.marcumQ(d.mu, d.x, d.y), d.q), `marcumQ(${d.mu}, ${d.x}, ${d.y})`)
          assert(equal(special.marcumP(d.mu, d.x, d.y), d.p), `marcumP(${d.mu}, ${d.x}, ${d.y})`)
        })
      })

      // #1179: ys = y/mu far below 1 catastrophically cancelled in _zetaxy(), producing
      // NaN (or, if naively rationalized, a silently-wrong finite plateau) instead of the
      // correct deep-lower-tail value. Reference values from mpmath at mp.dps=50 via the
      // series P_mu(x,y) = e^-x * sum_n (x^n/n!) * P_(mu+n)(y) (Eq. 7 of the paper), which
      // is cancellation-free for any y and independent of the ranjs implementation.
      it('should match reference values for y << mu (deep lower tail, #1179)', () => {
        [
          // Below _pqTrap's underflow threshold (halfMuZeta2 > -log(DELTA)): the
          // fixed zeta must stay finite so the shortcut branch fires cleanly instead
          // of falling through to a NaN-tainted quadrature. Exact reproduction from #1179.
          { mu: 1, x: 32, y: 2.4623e-32, p: 0, q: 1 },
          { mu: 2.5, x: 40, y: 1e-20, p: 0, q: 1 },
          // Above the underflow threshold: the quadrature itself executes with the
          // fixed zeta, so these lock in correctness of _pqTrap's full path, not just
          // the shortcut. mpmath dps=50: series Eq. 7.
          { mu: 1, x: 32, y: 1e-16, p: 1.2664165549094195e-30, q: 1 },
          { mu: 1, x: 32, y: 1e-10, p: 1.2664165568723631e-24, q: 1 },
          { mu: 1, x: 32, y: 1e-4, p: 1.2683804484834176e-18, q: 1 },
          // u = 4 * (x/mu) * (y/mu) = 0.4992, just below the u < 0.5 branch
          // boundary in _zetaxy(): locks in that the rationalized d2 formula
          // agrees with the unchanged u >= 0.5 branch near the switchover.
          { mu: 1, x: 32, y: 0.0039, p: 5.243259585512871e-17, q: 1 }
        ].forEach(d => {
          assert(equal(special.marcumQ(d.mu, d.x, d.y), d.q), `marcumQ(${d.mu}, ${d.x}, ${d.y})`)
          assert(equal(special.marcumP(d.mu, d.x, d.y), d.p), `marcumP(${d.mu}, ${d.x}, ${d.y})`)
        })
      })
    })

    describe('recurrence relation', () => {
      it('should satisfy the recurrence relation', () => {
        // Both x < mu and x > mu inside the transition band, exercising both
        // forms of the recurrence test.
        for (const [x, y, mu] of [[40, 120, 80], [55, 155, 100], [70, 190, 120]]) {
          check(x, y, mu)
        }
        for (const [x, y, mu] of [[80, 120, 40], [110, 165, 55], [140, 210, 70]]) {
          check(x, y, mu)
        }
      })

      it('should match scipy ncx2 reference values', () => {
        [
          { mu: 100, x: 50, y: 150, p: 0.5117578749745552, q: 0.48824212502544484 },
          { mu: 90, x: 60, y: 140, p: 0.2499150811158282, q: 0.7500849188841718 }
        ].forEach(d => {
          assert(equal(special.marcumQ(d.mu, d.x, d.y), d.q), `marcumQ(${d.mu}, ${d.x}, ${d.y})`)
          assert(equal(special.marcumP(d.mu, d.x, d.y), d.p), `marcumP(${d.mu}, ${d.x}, ${d.y})`)
        })
      })
    })

    describe('large mu asymptotic', () => {
      it('should satisfy the recurrence relation', () => {
        // mu >= 135 is the dispatch threshold; at the boundary the mu-1 order
        // may fall on the recurrence branch, but the three-term identity holds
        // across any mix of correct branches. Both x < mu and x > mu run.
        for (const [x, y, mu] of [[30, 165, 135], [55, 235, 180], [80, 330, 250]]) {
          check(x, y, mu)
        }
        for (const [x, y, mu] of [[155, 290, 135], [200, 365, 165], [260, 460, 200]]) {
          check(x, y, mu)
        }
      })

      it('should match scipy ncx2 reference values', () => {
        [
          { mu: 135, x: 40, y: 170, p: 0.3755801225650498, q: 0.6244198774349506 },
          { mu: 135, x: 44, y: 188, p: 0.7323059732316725, q: 0.26769402676832693 },
          { mu: 150, x: 60, y: 205, p: 0.38907639626893925, q: 0.6109236037310609 },
          { mu: 200, x: 55, y: 248, p: 0.35242643120412376, q: 0.6475735687958762 },
          { mu: 160, x: 70, y: 250, p: 0.8745123498463065, q: 0.1254876501536935 },
          { mu: 180, x: 50, y: 230, p: 0.5093676830927159, q: 0.49063231690728504 }
        ].forEach(d => {
          assert(equal(special.marcumQ(d.mu, d.x, d.y), d.q), `marcumQ(${d.mu}, ${d.x}, ${d.y})`)
          assert(equal(special.marcumP(d.mu, d.x, d.y), d.p), `marcumP(${d.mu}, ${d.x}, ${d.y})`)
        })
      })
    })
  })

  describe('.marcumP()', () => {
    describe('special cases', () => {
      it('should return 0 for y = 0', () => {
        for (const [mu, x] of [[2, 0], [4, 15], [7, 30]]) {
          assert(special.marcumP(mu, x, 0) === 0)
        }
      })

      it('should equal the lower incomplete gamma for x = 0', () => {
        for (const y of [40, 70, 100]) {
          for (const mu of [2, 4, 7]) {
            assert(equal(special.marcumP(mu, 0, y), special.gammaLowerIncomplete(mu, y)))
          }
        }
      })
    })

    it('should satisfy the recurrence relation', () => {
      const check = (x, y, mu) => {
        const p1 = special.marcumP(mu + 1, x, y)
        const p2 = special.marcumP(mu, x, y)
        const p3 = special.marcumP(mu + 2, x, y)
        const p4 = special.marcumP(mu - 1, x, y)
        const r = x > mu
          ? ((x - mu) * p1 + (y + mu) * p2) / (x * p3 + y * p4)
          : ((y + mu) * p2) / (x * p3 + (mu - x) * p1 + y * p4)
        assert(equal(r, 1))
      }
      // Series, asymptotic, quadrature, recurrence and large-mu regimes. The
      // quadrature and recurrence points stay close enough to the transition
      // that P is above the underflow limit, so the relation is meaningfully
      // exercised.
      for (const [x, y, mu] of [[1, 10, 30], [15, 15, 32], [29, 20, 35]]) {
        check(x, y, mu)
      }
      for (const [x, y, mu] of [[45, 30, 3], [90, 70, 4.5], [134, 110, 6]]) {
        check(x, y, mu)
      }
      for (const [x, y, mu] of [[40, 95, 80], [55, 126, 100], [70, 158, 120]]) {
        check(x, y, mu)
      }
      for (const [x, y, mu] of [[40, 120, 80], [55, 155, 100], [70, 190, 120]]) {
        check(x, y, mu)
      }
      for (const [x, y, mu] of [[30, 165, 135], [55, 235, 180], [80, 330, 245]]) {
        check(x, y, mu)
      }
    })
  })

  describe('marcumQ and marcumP', () => {
    it('should satisfy marcumQ + marcumP = 1 across all branches', () => {
      const identity = (x, y, mu) => {
        assert(equal(special.marcumQ(mu, x, y) + special.marcumP(mu, x, y), 1))
      }
      // Series, asymptotic, quadrature, recurrence and large-mu regimes.
      for (const [x, y, mu] of [[1, 40, 2], [15, 70, 4], [29, 99, 7]]) {
        identity(x, y, mu)
      }
      for (const [x, y, mu] of [[35, 60, 3], [70, 100, 4.5], [134, 160, 6]]) {
        identity(x, y, mu)
      }
      for (const [x, y, mu] of [[40, 0.5, 3], [60, 1, 5], [79, 2, 8]]) {
        identity(x, y, mu)
      }
      for (const [x, y, mu] of [[40, 120, 80], [55, 155, 100], [70, 190, 120]]) {
        identity(x, y, mu)
      }
      for (const [x, y, mu] of [[30, 170, 140], [55, 235, 180], [80, 320, 240]]) {
        identity(x, y, mu)
      }
    })
  })
})
