// Run via `npm run bench` or after `npm run build`
'use strict'

const ran = require('../dist/ranjs.cjs.js')
const jStat = require('jstat')
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
var rStudentT = new ran.dist.StudentT(5)

// Each distribution entry: name, and fns for each library.
// fns: { sample, pdf, cdf, quantile } — null means unavailable in that library.
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
      quantile: null // jStat does not implement a quantile function for Poisson
    },
    stdlib: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) stdPoissonRng(4) }, 20, 10000) },
      pdf: function () { return bench(function () { stdPoisson.pmf(4, 4) }, 10000) },
      cdf: function () { return bench(function () { stdPoisson.cdf(4, 4) }, 10000) },
      quantile: function () { return bench(function () { stdPoisson.quantile(0.7, 4) }, 10000) }
    }
  },
  {
    name: 'Student-t (nu=5)',
    ranjs: {
      sample: function () { return bench(function () { rStudentT.sample(10000) }, 20, 10000) },
      pdf: function () { return bench(function () { rStudentT.pdf(1.5) }, 10000) },
      cdf: function () { return bench(function () { rStudentT.cdf(1.5) }, 10000) },
      quantile: function () { return bench(function () { rStudentT.q(0.975) }, 10000) }
    },
    jstat: {
      sample: function () { return bench(function () { for (var i = 0; i < 10000; i++) jStat.studentt.sample(5) }, 20, 10000) },
      pdf: function () { return bench(function () { jStat.studentt.pdf(1.5, 5) }, 10000) },
      cdf: function () { return bench(function () { jStat.studentt.cdf(1.5, 5) }, 10000) },
      quantile: function () { return bench(function () { jStat.studentt.inv(0.975, 5) }, 10000) }
    },
    stdlib: null
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
  }
]

var ops = ['sample', 'pdf', 'cdf', 'quantile']

console.log('Running benchmarks (10 000 iterations per operation)...\n')

var rows = []
distributions.forEach(function (d) {
  ops.forEach(function (op) {
    var ranjsResult = d.ranjs && d.ranjs[op] ? formatOps(d.ranjs[op]()) : 'N/A'
    var jstatResult = d.jstat && d.jstat[op] ? formatOps(d.jstat[op]()) : 'N/A*'
    var stdlibResult = d.stdlib && d.stdlib[op] ? formatOps(d.stdlib[op]()) : 'N/A'
    rows.push([d.name, op, ranjsResult, jstatResult, stdlibResult])
  })
})

console.log('| Distribution | Operation | ranjs | jStat | @stdlib |')
console.log('|---|---|---|---|---|')
rows.forEach(function (r) {
  console.log('| ' + r.join(' | ') + ' |')
})

console.log('\n*N/A: jStat does not implement a quantile function for the Poisson distribution.')
