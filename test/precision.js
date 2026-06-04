import { assert } from 'chai'
import { describe, it } from 'mocha'
import * as special from '../src/special/index.js'

// Special-function precision gate (issue #556 — v1.27.0 milestone).
// All reference values from mpmath 1.4.1, mp.dps = 70. Generation script: test/precision-refs.py
// Assertion form: assert.approximately(result / reference, 1, tol) — relative error ≤ tol.
describe('special-function precision gate', () => {
  describe('gammaLowerIncomplete', () => {
    // mpmath: mp.dps=70; gammainc(s, 0, x, regularized=True)
    it('returns P(2, 1) to 1e-14 relative error', () => {
      assert.approximately(special.gammaLowerIncomplete(2, 1) / 0.26424111765711533, 1, 1e-14)
    })
    it('returns P(3, 2) to 1e-14 relative error', () => {
      assert.approximately(special.gammaLowerIncomplete(3, 2) / 0.32332358381693654, 1, 1e-14)
    })
    it('returns P(0.5, 0.5) to 1e-14 relative error', () => {
      assert.approximately(special.gammaLowerIncomplete(0.5, 0.5) / 0.6826894921370859, 1, 1e-14)
    })
  })

  describe('gammaUpperIncomplete', () => {
    // mpmath: mp.dps=70; gammainc(s, x, regularized=True)
    it('returns Q(2, 1) to 1e-14 relative error', () => {
      assert.approximately(special.gammaUpperIncomplete(2, 1) / 0.7357588823428847, 1, 1e-14)
    })
    it('returns Q(3, 2) to 1e-14 relative error', () => {
      assert.approximately(special.gammaUpperIncomplete(3, 2) / 0.6766764161830635, 1, 1e-14)
    })
    it('returns Q(0.5, 0.5) to 1e-14 relative error', () => {
      assert.approximately(special.gammaUpperIncomplete(0.5, 0.5) / 0.3173105078629141, 1, 1e-14)
    })
  })

  describe('gammaLowerIncompleteInv', () => {
    // mpmath: mp.dps=70; findroot(lambda x: gammainc(a, 0, x, regularized=True) - p, ...)
    it('returns inv-P(2, 0.5) to 1e-14 relative error', () => {
      assert.approximately(special.gammaLowerIncompleteInv(2, 0.5) / 1.6783469900166605, 1, 1e-14)
    })
    it('returns inv-P(3, 0.8) to 1e-14 relative error', () => {
      assert.approximately(special.gammaLowerIncompleteInv(3, 0.8) / 4.279029860125334, 1, 1e-14)
    })
    it('returns inv-P(1, 0.3) to 1e-14 relative error', () => {
      assert.approximately(special.gammaLowerIncompleteInv(1, 0.3) / 0.35667494393873234, 1, 1e-14)
    })
  })

  describe('betaIncomplete', () => {
    // mpmath: mp.dps=70; betainc(a, b, 0, x)  — unnormalized B(a,b,x)
    // x=0.3 uses the forward branch (x < (a+1)/(a+b+2) = 3/7); backward branch has a pre-existing bug (#557)
    it('returns B(2,3,0.3) to 1e-14 relative error', () => {
      assert.approximately(special.betaIncomplete(2, 3, 0.3) / 0.029025, 1, 1e-14)
    })
    it('returns B(1.5,2.5,0.3) to 1e-14 relative error', () => {
      assert.approximately(special.betaIncomplete(1.5, 2.5, 0.3) / 0.08162011893537471, 1, 1e-14)
    })
    it('returns B(0.5,0.5,0.4) to 1e-14 relative error', () => {
      assert.approximately(special.betaIncomplete(0.5, 0.5, 0.4) / 1.369438406004566, 1, 1e-14)
    })
  })

  // betaIncompleteInv: not yet implemented — no inverse function in src/special/beta-incomplete.js

  describe('regularizedBetaIncomplete', () => {
    // mpmath: mp.dps=70; betainc(a, b, 0, x, regularized=True)  — I_x(a,b)
    it('returns I_0.5(2,3) = 0.6875 exactly to 1e-14 relative error', () => {
      assert.approximately(special.regularizedBetaIncomplete(2, 3, 0.5) / 0.6875, 1, 1e-14)
    })
    it('returns I_0.3(1.5,2.5) to 1e-14 relative error', () => {
      assert.approximately(special.regularizedBetaIncomplete(1.5, 2.5, 0.3) / 0.41568785229802535, 1, 1e-14)
    })
    it('returns I_0.4(0.5,0.5) to 1e-14 relative error', () => {
      assert.approximately(special.regularizedBetaIncomplete(0.5, 0.5, 0.4) / 0.4359057831510251, 1, 1e-14)
    })
  })

  describe('erf', () => {
    // mpmath: mp.dps=70; erf(x)
    it('returns erf(1) to 1e-14 relative error', () => {
      assert.approximately(special.erf(1) / 0.8427007929497149, 1, 1e-14)
    })
    it('returns erf(0.5) to 1e-14 relative error', () => {
      assert.approximately(special.erf(0.5) / 0.5204998778130465, 1, 1e-14)
    })
    it('returns erf(3) to 1e-14 relative error', () => {
      assert.approximately(special.erf(3) / 0.9999779095030014, 1, 1e-14)
    })
  })

  describe('erfc', () => {
    // mpmath: mp.dps=70; erfc(x)
    it('returns erfc(1) to 1e-14 relative error', () => {
      assert.approximately(special.erfc(1) / 0.15729920705028513, 1, 1e-14)
    })
    it('returns erfc(2) to 1e-14 relative error', () => {
      assert.approximately(special.erfc(2) / 0.004677734981047266, 1, 1e-14)
    })
    it('returns erfc(5) to 1e-14 relative error', () => {
      // far-tail value ~1.54e-12; relative form result/reference ≈ 1 still valid
      assert.approximately(special.erfc(5) / 1.537459794428035e-12, 1, 1e-14)
    })
  })

  describe('erfinv', () => {
    // mpmath: mp.dps=70; erfinv(x)
    it('returns erfinv(0.5) to 1e-14 relative error', () => {
      assert.approximately(special.erfinv(0.5) / 0.4769362762044699, 1, 1e-14)
    })
    it('returns erfinv(0.9) to 1e-14 relative error', () => {
      assert.approximately(special.erfinv(0.9) / 1.163087153676674, 1, 1e-14)
    })
    it('returns erfinv(-0.5) to 1e-14 relative error (odd symmetry)', () => {
      assert.approximately(special.erfinv(-0.5) / -0.4769362762044699, 1, 1e-14)
    })
  })

  describe('besselI — small argument', () => {
    // mpmath: mp.dps=70; besseli(n, x)  (|x| <= 10, Taylor series path)
    it('returns I_0(1) to 1e-14 relative error', () => {
      assert.approximately(special.besselI(0, 1) / 1.2660658777520084, 1, 1e-14)
    })
    it('returns I_1(2) to 1e-14 relative error', () => {
      assert.approximately(special.besselI(1, 2) / 1.590636854637329, 1, 1e-14)
    })
    it('returns I_2(5.3) to 1e-14 relative error', () => {
      assert.approximately(special.besselI(2, 5.3) / 23.54248570460479, 1, 1e-14)
    })
  })

  describe('besselI — large argument', () => {
    // mpmath: mp.dps=70; besseli(n, x)  (|x| > 10, Miller backward recurrence path)
    it('returns I_0(10) to 1e-14 relative error', () => {
      assert.approximately(special.besselI(0, 10) / 2815.7166284662544, 1, 1e-14)
    })
    it('returns I_1(15) to 1e-14 relative error', () => {
      assert.approximately(special.besselI(1, 15) / 328124.9219702064, 1, 1e-14)
    })
    it('returns I_3(20) to 1e-14 relative error', () => {
      assert.approximately(special.besselI(3, 20) / 34592416.34091962, 1, 1e-14)
    })
  })

  describe('digamma', () => {
    // mpmath: mp.dps=70; digamma(z)
    it('returns digamma(1) = -gamma_EM to 1e-14 relative error', () => {
      assert.approximately(special.digamma(1) / -0.5772156649015329, 1, 1e-14)
    })
    it('returns digamma(2) to 1e-14 relative error', () => {
      assert.approximately(special.digamma(2) / 0.42278433509846713, 1, 1e-14)
    })
    it('returns digamma(0.5) to 1e-14 relative error', () => {
      assert.approximately(special.digamma(0.5) / -1.9635100260214235, 1, 1e-14)
    })
  })

  describe('logGamma', () => {
    // mpmath: mp.dps=70; loggamma(z)
    it('returns logGamma(0.5) to 1e-14 relative error', () => {
      assert.approximately(special.logGamma(0.5) / 0.5723649429247001, 1, 1e-14)
    })
    it('returns logGamma(1.5) to 1e-14 relative error', () => {
      assert.approximately(special.logGamma(1.5) / -0.12078223763524522, 1, 1e-14)
    })
    it('returns logGamma(10) to 1e-14 relative error', () => {
      assert.approximately(special.logGamma(10) / 12.801827480081469, 1, 1e-14)
    })
  })

  describe('gamma', () => {
    // mpmath: mp.dps=70; gamma(z)
    it('returns gamma(0.5) = sqrt(pi) to 1e-14 relative error', () => {
      assert.approximately(special.gamma(0.5) / 1.772453850905516, 1, 1e-14)
    })
    it('returns gamma(1.5) to 1e-14 relative error', () => {
      assert.approximately(special.gamma(1.5) / 0.886226925452758, 1, 1e-14)
    })
    it('returns gamma(-1.5) to 1e-14 relative error', () => {
      assert.approximately(special.gamma(-1.5) / 2.363271801207355, 1, 1e-14)
    })
  })

  describe('lambertW0', () => {
    // mpmath: mp.dps=70; lambertw(z, 0)
    it('returns W_0(1) to 1e-14 relative error', () => {
      assert.approximately(special.lambertW0(1) / 0.5671432904097838, 1, 1e-14)
    })
    it('returns W_0(0.5) to 1e-14 relative error', () => {
      assert.approximately(special.lambertW0(0.5) / 0.35173371124919584, 1, 1e-14)
    })
    it('returns W_0(10) to 1e-14 relative error', () => {
      assert.approximately(special.lambertW0(10) / 1.7455280027406994, 1, 1e-14)
    })
  })

  describe('lambertW1m', () => {
    // mpmath: mp.dps=70; lambertw(z, -1)  — W_{-1} branch
    it('returns W_{-1}(-0.1) to 1e-14 relative error', () => {
      assert.approximately(special.lambertW1m(-0.1) / -3.577152063957297, 1, 1e-14)
    })
    it('returns W_{-1}(-0.2) to 1e-14 relative error', () => {
      assert.approximately(special.lambertW1m(-0.2) / -2.5426413577735265, 1, 1e-14)
    })
    it('returns W_{-1}(-0.3) to 1e-14 relative error', () => {
      assert.approximately(special.lambertW1m(-0.3) / -1.7813370234216277, 1, 1e-14)
    })
  })

  describe('riemannZeta', () => {
    // mpmath: mp.dps=70; zeta(s)
    it('returns zeta(2) = pi^2/6 to 1e-14 relative error', () => {
      assert.approximately(special.riemannZeta(2) / 1.6449340668482264, 1, 1e-14)
    })
    it('returns zeta(3) (Apery constant) to 1e-14 relative error', () => {
      assert.approximately(special.riemannZeta(3) / 1.2020569031595942, 1, 1e-14)
    })
    it('returns zeta(1.001) to 1e-12 relative error (near-pole Laurent expansion)', () => {
      // s = 1.001 is within the Laurent window (|s-1| < 0.1001); exercises the Laurent path
      // Laurent expansion achieves ~1e-13 here; 1e-14 is not guaranteed
      assert.approximately(special.riemannZeta(1.001) / 1000.5772884759015, 1, 1e-12)
    })
  })

  describe('hurwitzZeta', () => {
    // mpmath: mp.dps=70; zeta(s, a)
    it('returns hurwitzZeta(2, 1) = zeta(2) to 1e-8 relative error', () => {
      // Euler-Maclaurin with dynamic partial-sum length (n=20 terms for s=2) achieves ~5e-9
      assert.approximately(special.hurwitzZeta(2, 1) / 1.6449340668482264, 1, 1e-8)
    })
    it('returns hurwitzZeta(2, 0.5) to 1e-8 relative error', () => {
      // Same Euler-Maclaurin precision limitation as s=2, a=1 above
      assert.approximately(special.hurwitzZeta(2, 0.5) / 4.934802200544679, 1, 1e-8)
    })
    it('returns hurwitzZeta(1.001, 0.5) to 1e-12 relative error (near-pole Euler-Maclaurin)', () => {
      // Euler-Maclaurin with dynamic partial-sum length (issue #552); near s=1 precision
      // is limited by the asymptotic nature of the Bernoulli series — 1e-14 not guaranteed
      assert.approximately(special.hurwitzZeta(1.001, 0.5) / 1001.9648639702457, 1, 1e-12)
    })
  })

  describe('f11', () => {
    // mpmath: mp.dps=70; hyp1f1(a, b, z)  — Kummer confluent hypergeometric 1F1
    it('returns f11(1,2,1) = e-1/1 to 1e-14 relative error', () => {
      assert.approximately(special.f11(1, 2, 1) / 1.7182818284590453, 1, 1e-14)
    })
    it('returns f11(0.5, 1.5, -1) to 1e-14 relative error', () => {
      assert.approximately(special.f11(0.5, 1.5, -1) / 0.746824132812427, 1, 1e-14)
    })
    it('returns f11(2, 3, 2) to 1e-14 relative error', () => {
      assert.approximately(special.f11(2, 3, 2) / 4.194528049465325, 1, 1e-14)
    })
  })

  // hypergeometric2F1 (f21): not yet implemented — src/special/hypergeometric.js has 2F1 commented out

  describe('marcumQ', () => {
    // mpmath: mp.dps=70; custom marcumQ series. See precision-refs.py.
    // ranjs convention: marcumQ(mu, x, y) = Q_mu(sqrt(2x), sqrt(2y)) in standard Nuttall notation.
    // So marcumQ(1,1,1) = Q_1(√2,√2), marcumQ(1,2,3) = Q_1(2,√6), marcumQ(2,1.5,2) = Q_2(√3,2).
    it('returns Q_1(1,1) to 1e-14 relative error', () => {
      assert.approximately(special.marcumQ(1, 1, 1) / 0.6542541612768356, 1, 1e-14)
    })
    it('returns Q_1(2,3) to 1e-13 relative error', () => {
      // y=3 = x+mu: on the series regime boundary; p-series accumulates ~1.6e-14 here
      assert.approximately(special.marcumQ(1, 2, 3) / 0.41471058523413, 1, 1e-13)
    })
    it('returns Q_2(1.5,2) to 1e-14 relative error', () => {
      assert.approximately(special.marcumQ(2, 1.5, 2) / 0.715925868097602, 1, 1e-14)
    })
  })

  describe('owenT', () => {
    // mpmath: mp.dps=70; custom owenT quadrature (mpmath has no built-in). See precision-refs.py.
    it('returns T(1, 0.5) to 1e-14 relative error', () => {
      assert.approximately(special.owenT(1, 0.5) / 0.04306469112078536, 1, 1e-14)
    })
    it('returns T(2, 1) to 1e-14 relative error', () => {
      assert.approximately(special.owenT(2, 1) / 0.011116281722259822, 1, 1e-14)
    })
    it('returns T(0.5, 2) to 1e-14 relative error', () => {
      assert.approximately(special.owenT(0.5, 2) / 0.1415806036539784, 1, 1e-14)
    })
  })

  describe('besselInu — fractional order', () => {
    // mpmath: mp.dps=70; besseli(nu, x). See precision-refs.py.
    it('returns I_{0.5}(1) to 1e-14 relative error', () => {
      assert.approximately(special.besselInu(0.5, 1.0) / 0.9376748882454876, 1, 1e-14)
    })
    it('returns I_{1.5}(2) to 1e-14 relative error', () => {
      assert.approximately(special.besselInu(1.5, 2.0) / 1.0994731886331097, 1, 1e-14)
    })
    it('returns I_{2.3}(3) to 1e-14 relative error', () => {
      assert.approximately(special.besselInu(2.3, 3.0) / 1.787657392247681, 1, 1e-14)
    })
  })

  describe('besselISpherical', () => {
    // mpmath: mp.dps=70; sqrt(pi/(2x)) * besseli(n+0.5, x). See precision-refs.py.
    it('returns i_0(1) = sinh(1)/1 to 1e-14 relative error', () => {
      assert.approximately(special.besselISpherical(0, 1.0) / 1.1752011936438014, 1, 1e-14)
    })
    it('returns i_1(0.5) via Taylor series (|x|<1) to 1e-14 relative error', () => {
      assert.approximately(special.besselISpherical(1, 0.5) / 0.17087070843777213, 1, 1e-14)
    })
    it('returns i_2(3) via Wronskian (|x|>=1) to 1e-14 relative error', () => {
      assert.approximately(special.besselISpherical(2, 3.0) / 1.096501524700701, 1, 1e-14)
    })
  })

  describe('beta', () => {
    // mpmath: mp.dps=70; beta(x, y) = exp(loggamma(x)+loggamma(y)-loggamma(x+y)). See precision-refs.py.
    it('returns B(2,3) = 1/12 to 1e-14 relative error', () => {
      assert.approximately(special.beta(2.0, 3.0) / (1 / 12), 1, 1e-14)
    })
    it('returns B(0.5,0.5) = pi to 1e-14 relative error', () => {
      assert.approximately(special.beta(0.5, 0.5) / Math.PI, 1, 1e-14)
    })
    it('returns B(1.5,2.5) to 1e-14 relative error', () => {
      assert.approximately(special.beta(1.5, 2.5) / 0.19634954084936207, 1, 1e-14)
    })
  })

  describe('logBeta', () => {
    // mpmath: mp.dps=70; loggamma(x)+loggamma(y)-loggamma(x+y). See precision-refs.py.
    it('returns logB(2,3) = log(1/12) to 1e-14 relative error', () => {
      assert.approximately(special.logBeta(2.0, 3.0) / -2.4849066497880004, 1, 1e-14)
    })
    it('returns logB(0.5,0.5) = log(pi) to 1e-14 relative error', () => {
      assert.approximately(special.logBeta(0.5, 0.5) / Math.log(Math.PI), 1, 1e-14)
    })
    it('returns logB(1.5,2.5) to 1e-14 relative error', () => {
      assert.approximately(special.logBeta(1.5, 2.5) / -1.627858836390381, 1, 1e-14)
    })
  })

  describe('logBinomial', () => {
    // mpmath: mp.dps=70; loggamma(n+1)-loggamma(k+1)-loggamma(n-k+1). See precision-refs.py.
    it('returns logC(10,3) = log(120) to 1e-14 relative error', () => {
      assert.approximately(special.logBinomial(10, 3) / 4.787491742782046, 1, 1e-14)
    })
    it('returns logC(20,7) = log(77520) to 1e-14 relative error', () => {
      assert.approximately(special.logBinomial(20, 7) / 11.258291246564648, 1, 1e-14)
    })
    it('returns logC(5,2) = log(10) to 1e-14 relative error', () => {
      assert.approximately(special.logBinomial(5, 2) / Math.log(10), 1, 1e-14)
    })
  })

  describe('generalizedHarmonic', () => {
    // mpmath: mp.dps=70; direct sum. See precision-refs.py.
    // n<10: direct compensated sum path; n>=10: riemannZeta - hurwitzZeta path.
    // zeta-path precision with s=2 is limited by hurwitzZeta Euler-Maclaurin (~1e-8);
    // s=3 converges faster so achieves ~1e-10.
    it('returns H(5,2) via direct sum to 1e-14 relative error', () => {
      assert.approximately(special.generalizedHarmonic(5, 2) / 1.4636111111111112, 1, 1e-14)
    })
    it('returns H(20,3) via zeta path to 1e-10 relative error', () => {
      assert.approximately(special.generalizedHarmonic(20, 3) / 1.2008678419584369, 1, 1e-10)
    })
    it('returns H(15,2) via zeta path to 1e-8 relative error', () => {
      // s=2 Euler-Maclaurin limitation (same root cause as hurwitzZeta(2, a) gate above)
      assert.approximately(special.generalizedHarmonic(15, 2) / 1.580440283444987, 1, 1e-8)
    })
  })

  describe('marcumP', () => {
    // mpmath: mp.dps=70; 1 - marcumQ series (half-squared convention). See precision-refs.py.
    it('returns P_1(1,1) to 1e-14 relative error', () => {
      assert.approximately(special.marcumP(1, 1, 1) / 0.3457458387231645, 1, 1e-14)
    })
    it('returns P_1(2,3) to 1e-13 relative error', () => {
      // y=3 = x+mu: on the series regime boundary; inherited from marcumQ boundary accumulation
      assert.approximately(special.marcumP(1, 2, 3) / 0.58528941476587, 1, 1e-13)
    })
    it('returns P_2(1.5,2) to 1e-14 relative error', () => {
      assert.approximately(special.marcumP(2, 1.5, 2) / 0.284074131902398, 1, 1e-14)
    })
  })
})
