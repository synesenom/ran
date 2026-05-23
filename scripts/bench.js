// Run via `npm run bench` or after `npm run build`
'use strict'

const ran = require('../dist/ranjs.cjs.js')
const jStat = require('jstat')

// @stdlib — benchmarked for the 5 original distributions only
const stdNormal = require('@stdlib/stats-base-dists-normal')
const stdGamma = require('@stdlib/stats-base-dists-gamma')
const stdBeta = require('@stdlib/stats-base-dists-beta')
const stdExp = require('@stdlib/stats-base-dists-exponential')
const stdPoisson = require('@stdlib/stats-base-dists-poisson')
const stdNormalRng = require('@stdlib/random-base-normal')
const stdGammaRng = require('@stdlib/random-base-gamma')
const stdBetaRng = require('@stdlib/random-base-beta')
const stdExpRng = require('@stdlib/random-base-exponential')
const stdPoissonRng = require('@stdlib/random-base-poisson')

// Times fn() n times after a 100-call warmup.
// multiplier lets sample benchmarks report per-sample throughput
// (e.g. call sample(10000) once per iteration → multiply by 10000 to get samples/sec).
function bench (fn, n, multiplier) {
  multiplier = multiplier || 1
  for (var i = 0; i < 100; i++) fn()
  var t0 = performance.now()
  for (var j = 0; j < n; j++) fn()
  return n * multiplier / ((performance.now() - t0) / 1000)
}

function formatOps (n) {
  return Math.round(n).toLocaleString() + ' ops/sec'
}

// Pre-instantiate ranjs distributions — construction cost not part of benchmark.
var rNormal = new ran.dist.Normal(0, 1)
var rGamma = new ran.dist.Gamma(2, 1)
var rBeta = new ran.dist.Beta(2, 5)
var rPoisson = new ran.dist.Poisson(4)
var rExp = new ran.dist.Exponential(1)
var rArcsine = new ran.dist.Arcsine(0, 1)
var rBinomial = new ran.dist.Binomial(10, 0.3)
var rCauchy = new ran.dist.Cauchy(0, 1)
var rF = new ran.dist.F(5, 10)
var rChi2 = new ran.dist.Chi2(4)
var rHypgeom = new ran.dist.Hypergeometric(20, 8, 5)
var rInvGamma = new ran.dist.InverseGamma(2, 1)
var rKumaraswamy = new ran.dist.Kumaraswamy(2, 5)
var rLaplace = new ran.dist.Laplace(0, 1)
var rLogNormal = new ran.dist.LogNormal(0, 1)
var rNegBin = new ran.dist.NegativeBinomial(5, 0.5)
var rNoncentralT = new ran.dist.NoncentralT(5, 1)
var rPareto = new ran.dist.Pareto(1, 2)
var rStudentT = new ran.dist.StudentT(5)
var rTriangular = new ran.dist.Triangular(0, 1, 0.5)
var rUniform = new ran.dist.Uniform(0, 1)
var rWeibull = new ran.dist.Weibull(1, 2)

// Each distribution entry: name, and fns for each library.
// fns: { sample, pdf, cdf, quantile } — null means unavailable in that library.
// stdlib: null for all distributions beyond the original 5 (packages not installed).
var distributions = [
  {
    name: 'Normal',
    ranjs: {
      // ranjs sample(10000) produces 10000 values in one call.
      // Outer loop of 20 × 10000 multiplier = samples/sec.
      sample: function () { return bench(function () { rNormal.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rNormal.pdf(0.5) }, 10000) },
      cdf: function () { return bench(function () { rNormal.cdf(0.5) }, 10000) },
      quantile: function () { return bench(function () { rNormal.q(0.8) }, 10000) }
    },
    jstat: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) jStat.normal.sample(0, 1) }, 20, 10000) },
      pdf: function () { return bench(function () { jStat.normal.pdf(0.5, 0, 1) }, 10000) },
      cdf: function () { return bench(function () { jStat.normal.cdf(0.5, 0, 1) }, 10000) },
      quantile: function () { return bench(function () { jStat.normal.inv(0.8, 0, 1) }, 10000) }
    },
    stdlib: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) stdNormalRng(0, 1) }, 20, 10000) },
      pdf: function () { return bench(function () { stdNormal.pdf(0.5, 0, 1) }, 10000) },
      cdf: function () { return bench(function () { stdNormal.cdf(0.5, 0, 1) }, 10000) },
      quantile: function () { return bench(function () { stdNormal.quantile(0.8, 0, 1) }, 10000) }
    }
  },
  {
    name: 'Gamma',
    // jStat Gamma uses (shape, scale); scale = 1/rate. With beta=1 (rate), scale=1 — no conversion needed.
    ranjs: {
      sample: function () { return bench(function () { rGamma.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rGamma.pdf(2.0) }, 10000) },
      cdf: function () { return bench(function () { rGamma.cdf(2.0) }, 10000) },
      quantile: function () { return bench(function () { rGamma.q(0.8) }, 10000) }
    },
    jstat: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) jStat.gamma.sample(2, 1) }, 20, 10000) },
      pdf: function () { return bench(function () { jStat.gamma.pdf(2.0, 2, 1) }, 10000) },
      cdf: function () { return bench(function () { jStat.gamma.cdf(2.0, 2, 1) }, 10000) },
      quantile: function () { return bench(function () { jStat.gamma.inv(0.8, 2, 1) }, 10000) }
    },
    stdlib: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) stdGammaRng(2, 1) }, 20, 10000) },
      pdf: function () { return bench(function () { stdGamma.pdf(2.0, 2, 1) }, 10000) },
      cdf: function () { return bench(function () { stdGamma.cdf(2.0, 2, 1) }, 10000) },
      quantile: function () { return bench(function () { stdGamma.quantile(0.8, 2, 1) }, 10000) }
    }
  },
  {
    name: 'Beta',
    ranjs: {
      sample: function () { return bench(function () { rBeta.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rBeta.pdf(0.3) }, 10000) },
      cdf: function () { return bench(function () { rBeta.cdf(0.3) }, 10000) },
      quantile: function () { return bench(function () { rBeta.q(0.5) }, 10000) }
    },
    jstat: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) jStat.beta.sample(2, 5) }, 20, 10000) },
      pdf: function () { return bench(function () { jStat.beta.pdf(0.3, 2, 5) }, 10000) },
      cdf: function () { return bench(function () { jStat.beta.cdf(0.3, 2, 5) }, 10000) },
      quantile: function () { return bench(function () { jStat.beta.inv(0.5, 2, 5) }, 10000) }
    },
    stdlib: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) stdBetaRng(2, 5) }, 20, 10000) },
      pdf: function () { return bench(function () { stdBeta.pdf(0.3, 2, 5) }, 10000) },
      cdf: function () { return bench(function () { stdBeta.cdf(0.3, 2, 5) }, 10000) },
      quantile: function () { return bench(function () { stdBeta.quantile(0.5, 2, 5) }, 10000) }
    }
  },
  {
    name: 'Poisson',
    ranjs: {
      sample: function () { return bench(function () { rPoisson.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rPoisson.pdf(4) }, 10000) },
      cdf: function () { return bench(function () { rPoisson.cdf(4) }, 10000) },
      quantile: function () { return bench(function () { rPoisson.q(0.7) }, 10000) }
    },
    jstat: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) jStat.poisson.sample(4) }, 20, 10000) },
      pdf: function () { return bench(function () { jStat.poisson.pdf(4, 4) }, 10000) },
      cdf: function () { return bench(function () { jStat.poisson.cdf(4, 4) }, 10000) },
      quantile: null
    },
    stdlib: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) stdPoissonRng(4) }, 20, 10000) },
      pdf: function () { return bench(function () { stdPoisson.pmf(4, 4) }, 10000) },
      cdf: function () { return bench(function () { stdPoisson.cdf(4, 4) }, 10000) },
      quantile: function () { return bench(function () { stdPoisson.quantile(0.7, 4) }, 10000) }
    }
  },
  {
    name: 'Exponential',
    ranjs: {
      sample: function () { return bench(function () { rExp.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rExp.pdf(1.0) }, 10000) },
      cdf: function () { return bench(function () { rExp.cdf(1.0) }, 10000) },
      quantile: function () { return bench(function () { rExp.q(0.5) }, 10000) }
    },
    jstat: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) jStat.exponential.sample(1) }, 20, 10000) },
      pdf: function () { return bench(function () { jStat.exponential.pdf(1.0, 1) }, 10000) },
      cdf: function () { return bench(function () { jStat.exponential.cdf(1.0, 1) }, 10000) },
      quantile: function () { return bench(function () { jStat.exponential.inv(0.5, 1) }, 10000) }
    },
    stdlib: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) stdExpRng(1) }, 20, 10000) },
      pdf: function () { return bench(function () { stdExp.pdf(1.0, 1) }, 10000) },
      cdf: function () { return bench(function () { stdExp.cdf(1.0, 1) }, 10000) },
      quantile: function () { return bench(function () { stdExp.quantile(0.5, 1) }, 10000) }
    }
  },
  {
    name: 'Arcsine',
    ranjs: {
      sample: function () { return bench(function () { rArcsine.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rArcsine.pdf(0.3) }, 10000) },
      cdf: function () { return bench(function () { rArcsine.cdf(0.3) }, 10000) },
      quantile: function () { return bench(function () { rArcsine.q(0.5) }, 10000) }
    },
    jstat: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) jStat.arcsine.sample(0, 1) }, 20, 10000) },
      pdf: function () { return bench(function () { jStat.arcsine.pdf(0.3, 0, 1) }, 10000) },
      cdf: function () { return bench(function () { jStat.arcsine.cdf(0.3, 0, 1) }, 10000) },
      quantile: function () { return bench(function () { jStat.arcsine.inv(0.5, 0, 1) }, 10000) }
    },
    stdlib: { sample: null, pdf: null, cdf: null, quantile: null }
  },
  {
    name: 'Binomial',
    ranjs: {
      sample: function () { return bench(function () { rBinomial.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rBinomial.pdf(3) }, 10000) },
      cdf: function () { return bench(function () { rBinomial.cdf(3) }, 10000) },
      quantile: function () { return bench(function () { rBinomial.q(0.5) }, 10000) }
    },
    jstat: {
      sample: null,
      pdf: function () { return bench(function () { jStat.binomial.pdf(3, 10, 0.3) }, 10000) },
      cdf: function () { return bench(function () { jStat.binomial.cdf(3, 10, 0.3) }, 10000) },
      quantile: null
    },
    stdlib: { sample: null, pdf: null, cdf: null, quantile: null }
  },
  {
    name: 'Cauchy',
    ranjs: {
      sample: function () { return bench(function () { rCauchy.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rCauchy.pdf(0.5) }, 10000) },
      cdf: function () { return bench(function () { rCauchy.cdf(0.5) }, 10000) },
      quantile: function () { return bench(function () { rCauchy.q(0.6) }, 10000) }
    },
    jstat: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) jStat.cauchy.sample(0, 1) }, 20, 10000) },
      pdf: function () { return bench(function () { jStat.cauchy.pdf(0.5, 0, 1) }, 10000) },
      cdf: function () { return bench(function () { jStat.cauchy.cdf(0.5, 0, 1) }, 10000) },
      quantile: function () { return bench(function () { jStat.cauchy.inv(0.6, 0, 1) }, 10000) }
    },
    stdlib: { sample: null, pdf: null, cdf: null, quantile: null }
  },
  {
    name: 'F',
    ranjs: {
      sample: function () { return bench(function () { rF.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rF.pdf(1.0) }, 10000) },
      cdf: function () { return bench(function () { rF.cdf(1.0) }, 10000) },
      quantile: function () { return bench(function () { rF.q(0.5) }, 10000) }
    },
    jstat: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) jStat.centralF.sample(5, 10) }, 20, 10000) },
      pdf: function () { return bench(function () { jStat.centralF.pdf(1.0, 5, 10) }, 10000) },
      cdf: function () { return bench(function () { jStat.centralF.cdf(1.0, 5, 10) }, 10000) },
      quantile: function () { return bench(function () { jStat.centralF.inv(0.5, 5, 10) }, 10000) }
    },
    stdlib: { sample: null, pdf: null, cdf: null, quantile: null }
  },
  {
    name: 'Chi2',
    ranjs: {
      sample: function () { return bench(function () { rChi2.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rChi2.pdf(2.0) }, 10000) },
      cdf: function () { return bench(function () { rChi2.cdf(2.0) }, 10000) },
      quantile: function () { return bench(function () { rChi2.q(0.5) }, 10000) }
    },
    jstat: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) jStat.chisquare.sample(4) }, 20, 10000) },
      pdf: function () { return bench(function () { jStat.chisquare.pdf(2.0, 4) }, 10000) },
      cdf: function () { return bench(function () { jStat.chisquare.cdf(2.0, 4) }, 10000) },
      quantile: function () { return bench(function () { jStat.chisquare.inv(0.5, 4) }, 10000) }
    },
    stdlib: { sample: null, pdf: null, cdf: null, quantile: null }
  },
  {
    name: 'Hypergeometric',
    ranjs: {
      sample: function () { return bench(function () { rHypgeom.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rHypgeom.pdf(2) }, 10000) },
      cdf: function () { return bench(function () { rHypgeom.cdf(2) }, 10000) },
      quantile: function () { return bench(function () { rHypgeom.q(0.5) }, 10000) }
    },
    jstat: {
      sample: null,
      pdf: function () { return bench(function () { jStat.hypgeom.pdf(2, 20, 8, 5) }, 10000) },
      cdf: function () { return bench(function () { jStat.hypgeom.cdf(2, 20, 8, 5) }, 10000) },
      quantile: null
    },
    stdlib: { sample: null, pdf: null, cdf: null, quantile: null }
  },
  {
    name: 'InverseGamma',
    ranjs: {
      sample: function () { return bench(function () { rInvGamma.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rInvGamma.pdf(1.0) }, 10000) },
      cdf: function () { return bench(function () { rInvGamma.cdf(1.0) }, 10000) },
      quantile: function () { return bench(function () { rInvGamma.q(0.5) }, 10000) }
    },
    jstat: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) jStat.invgamma.sample(2, 1) }, 20, 10000) },
      pdf: function () { return bench(function () { jStat.invgamma.pdf(1.0, 2, 1) }, 10000) },
      cdf: function () { return bench(function () { jStat.invgamma.cdf(1.0, 2, 1) }, 10000) },
      quantile: function () { return bench(function () { jStat.invgamma.inv(0.5, 2, 1) }, 10000) }
    },
    stdlib: { sample: null, pdf: null, cdf: null, quantile: null }
  },
  {
    name: 'Kumaraswamy',
    ranjs: {
      sample: function () { return bench(function () { rKumaraswamy.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rKumaraswamy.pdf(0.3) }, 10000) },
      cdf: function () { return bench(function () { rKumaraswamy.cdf(0.3) }, 10000) },
      quantile: function () { return bench(function () { rKumaraswamy.q(0.5) }, 10000) }
    },
    jstat: {
      sample: null,
      pdf: function () { return bench(function () { jStat.kumaraswamy.pdf(0.3, 2, 5) }, 10000) },
      cdf: function () { return bench(function () { jStat.kumaraswamy.cdf(0.3, 2, 5) }, 10000) },
      quantile: function () { return bench(function () { jStat.kumaraswamy.inv(0.5, 2, 5) }, 10000) }
    },
    stdlib: { sample: null, pdf: null, cdf: null, quantile: null }
  },
  {
    name: 'Laplace',
    ranjs: {
      sample: function () { return bench(function () { rLaplace.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rLaplace.pdf(0.0) }, 10000) },
      cdf: function () { return bench(function () { rLaplace.cdf(0.0) }, 10000) },
      quantile: function () { return bench(function () { rLaplace.q(0.5) }, 10000) }
    },
    jstat: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) jStat.laplace.sample(0, 1) }, 20, 10000) },
      pdf: function () { return bench(function () { jStat.laplace.pdf(0.0, 0, 1) }, 10000) },
      cdf: function () { return bench(function () { jStat.laplace.cdf(0.0, 0, 1) }, 10000) },
      quantile: null
    },
    stdlib: { sample: null, pdf: null, cdf: null, quantile: null }
  },
  {
    name: 'LogNormal',
    ranjs: {
      sample: function () { return bench(function () { rLogNormal.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rLogNormal.pdf(1.0) }, 10000) },
      cdf: function () { return bench(function () { rLogNormal.cdf(1.0) }, 10000) },
      quantile: function () { return bench(function () { rLogNormal.q(0.5) }, 10000) }
    },
    jstat: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) jStat.lognormal.sample(0, 1) }, 20, 10000) },
      pdf: function () { return bench(function () { jStat.lognormal.pdf(1.0, 0, 1) }, 10000) },
      cdf: function () { return bench(function () { jStat.lognormal.cdf(1.0, 0, 1) }, 10000) },
      quantile: function () { return bench(function () { jStat.lognormal.inv(0.5, 0, 1) }, 10000) }
    },
    stdlib: { sample: null, pdf: null, cdf: null, quantile: null }
  },
  {
    name: 'NegativeBinomial',
    ranjs: {
      sample: function () { return bench(function () { rNegBin.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rNegBin.pdf(3) }, 10000) },
      cdf: function () { return bench(function () { rNegBin.cdf(3) }, 10000) },
      quantile: function () { return bench(function () { rNegBin.q(0.5) }, 10000) }
    },
    jstat: {
      sample: null,
      pdf: function () { return bench(function () { jStat.negbin.pdf(3, 5, 0.5) }, 10000) },
      cdf: function () { return bench(function () { jStat.negbin.cdf(3, 5, 0.5) }, 10000) },
      quantile: null
    },
    stdlib: { sample: null, pdf: null, cdf: null, quantile: null }
  },
  {
    name: 'NoncentralT',
    ranjs: {
      sample: function () { return bench(function () { rNoncentralT.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rNoncentralT.pdf(1.0) }, 10000) },
      cdf: function () { return bench(function () { rNoncentralT.cdf(1.0) }, 10000) },
      quantile: function () { return bench(function () { rNoncentralT.q(0.5) }, 10000) }
    },
    jstat: {
      sample: null,
      pdf: function () { return bench(function () { jStat.noncentralt.pdf(1.0, 5, 1) }, 10000) },
      cdf: function () { return bench(function () { jStat.noncentralt.cdf(1.0, 5, 1) }, 10000) },
      quantile: null
    },
    stdlib: { sample: null, pdf: null, cdf: null, quantile: null }
  },
  {
    name: 'Pareto',
    ranjs: {
      sample: function () { return bench(function () { rPareto.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rPareto.pdf(2.0) }, 10000) },
      cdf: function () { return bench(function () { rPareto.cdf(2.0) }, 10000) },
      quantile: function () { return bench(function () { rPareto.q(0.5) }, 10000) }
    },
    jstat: {
      sample: null,
      pdf: function () { return bench(function () { jStat.pareto.pdf(2.0, 1, 2) }, 10000) },
      cdf: function () { return bench(function () { jStat.pareto.cdf(2.0, 1, 2) }, 10000) },
      quantile: function () { return bench(function () { jStat.pareto.inv(0.5, 1, 2) }, 10000) }
    },
    stdlib: { sample: null, pdf: null, cdf: null, quantile: null }
  },
  {
    name: 'StudentT',
    ranjs: {
      sample: function () { return bench(function () { rStudentT.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rStudentT.pdf(0.0) }, 10000) },
      cdf: function () { return bench(function () { rStudentT.cdf(0.0) }, 10000) },
      quantile: function () { return bench(function () { rStudentT.q(0.5) }, 10000) }
    },
    jstat: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) jStat.studentt.sample(5) }, 20, 10000) },
      pdf: function () { return bench(function () { jStat.studentt.pdf(0.0, 5) }, 10000) },
      cdf: function () { return bench(function () { jStat.studentt.cdf(0.0, 5) }, 10000) },
      quantile: function () { return bench(function () { jStat.studentt.inv(0.5, 5) }, 10000) }
    },
    stdlib: { sample: null, pdf: null, cdf: null, quantile: null }
  },
  {
    name: 'Triangular',
    ranjs: {
      sample: function () { return bench(function () { rTriangular.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rTriangular.pdf(0.5) }, 10000) },
      cdf: function () { return bench(function () { rTriangular.cdf(0.5) }, 10000) },
      quantile: function () { return bench(function () { rTriangular.q(0.5) }, 10000) }
    },
    jstat: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) jStat.triangular.sample(0, 1, 0.5) }, 20, 10000) },
      pdf: function () { return bench(function () { jStat.triangular.pdf(0.5, 0, 1, 0.5) }, 10000) },
      cdf: function () { return bench(function () { jStat.triangular.cdf(0.5, 0, 1, 0.5) }, 10000) },
      quantile: function () { return bench(function () { jStat.triangular.inv(0.5, 0, 1, 0.5) }, 10000) }
    },
    stdlib: { sample: null, pdf: null, cdf: null, quantile: null }
  },
  {
    name: 'Uniform',
    ranjs: {
      sample: function () { return bench(function () { rUniform.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rUniform.pdf(0.5) }, 10000) },
      cdf: function () { return bench(function () { rUniform.cdf(0.5) }, 10000) },
      quantile: function () { return bench(function () { rUniform.q(0.5) }, 10000) }
    },
    jstat: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) jStat.uniform.sample(0, 1) }, 20, 10000) },
      pdf: function () { return bench(function () { jStat.uniform.pdf(0.5, 0, 1) }, 10000) },
      cdf: function () { return bench(function () { jStat.uniform.cdf(0.5, 0, 1) }, 10000) },
      quantile: function () { return bench(function () { jStat.uniform.inv(0.5, 0, 1) }, 10000) }
    },
    stdlib: { sample: null, pdf: null, cdf: null, quantile: null }
  },
  {
    name: 'Weibull',
    ranjs: {
      sample: function () { return bench(function () { rWeibull.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rWeibull.pdf(1.0) }, 10000) },
      cdf: function () { return bench(function () { rWeibull.cdf(1.0) }, 10000) },
      quantile: function () { return bench(function () { rWeibull.q(0.5) }, 10000) }
    },
    jstat: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) jStat.weibull.sample(1, 2) }, 20, 10000) },
      pdf: function () { return bench(function () { jStat.weibull.pdf(1.0, 1, 2) }, 10000) },
      cdf: function () { return bench(function () { jStat.weibull.cdf(1.0, 1, 2) }, 10000) },
      quantile: function () { return bench(function () { jStat.weibull.inv(0.5, 1, 2) }, 10000) }
    },
    stdlib: { sample: null, pdf: null, cdf: null, quantile: null }
  }
]

var ops = ['sample', 'pdf', 'cdf', 'quantile']

console.log('Running benchmarks (10 000 iterations per operation)...\n')

var rows = []
distributions.forEach(function (d) {
  ops.forEach(function (op) {
    var ranjsResult = d.ranjs[op] ? formatOps(d.ranjs[op]()) : 'N/A'
    var jstatResult = d.jstat[op] ? formatOps(d.jstat[op]()) : 'N/A*'
    var stdlibResult = d.stdlib[op] ? formatOps(d.stdlib[op]()) : 'N/A'
    rows.push([d.name, op, ranjsResult, jstatResult, stdlibResult])
  })
})

console.log('| Distribution | Operation | ranjs | jStat | @stdlib |')
console.log('|---|---|---|---|---|')
rows.forEach(function (r) {
  console.log('| ' + r.join(' | ') + ' |')
})

console.log('\n*N/A (jStat): operation not implemented for this distribution.')
console.log('N/A (@stdlib): only benchmarked for Normal, Gamma, Beta, Poisson, and Exponential.')
