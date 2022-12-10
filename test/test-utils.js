import { assert } from 'chai'
import { CHI_TABLE_LOW, CHI_TABLE_HIGH } from './tables/chi2-5'

// Constants
const H = 0.01
const PRECISION = 1e-10
const RANGE_STEPS = 20

export function equal (x, y, precision = 10) {
  return Math.abs((x - y) / y) < Math.pow(10, -precision)
}

function almostEqual (a, b, tol = PRECISION) {
  return Math.abs(a - b) < tol
}

function differentiate (f, x, h = 0.01) {
  const CON = 1.4
  const CON2 = CON * CON
  const BIG = 1e30
  const NTAB = 10
  const SAFE = 2.0

  let i, j
  let errt, fac, hh, ans, err
  const a = Array.from({ length: NTAB + 1 }, () => Array.from({ length: NTAB + 1 }))
  hh = h
  a[1][1] = (f(x + hh) - f(x - hh)) / (2 * hh)
  err = BIG

  for (i = 2; i <= NTAB; i++) {
    hh /= CON
    a[1][i] = (f(x + hh) - f(x - hh)) / (2 * hh)
    fac = CON2
    for (j = 2; j <= i; j++) {
      a[j][i] = (a[j - 1][i] * fac - a[j - 1][i - 1]) / (fac - 1)
      fac = CON2 * fac
      errt = Math.max(Math.abs(a[j][i] - a[j - 1][i]), Math.abs(a[j][i] - a[j - 1][i - 1]))
      if (errt <= err) {
        err = errt
        ans = a[j][i]
      }
    }
    if (Math.abs(a[i][i] - a[i - 1][i - 1]) >= SAFE * err) break
  }
  return ans
}

function getTestRange (dist) {
  return [
    Number.isFinite(dist.support()[0].value) ? dist.support()[0].value - 1 : -50,
    Number.isFinite(dist.support()[1].value) ? dist.support()[1].value + 1 : 50
  ]
}

function getParamList (dist) {
  return Object.entries(dist.p)
    .map(([name, value]) => {
      if (Array.isArray(value)) {
        return `${name}=[${value.join(', ')}]`
      }
      return `${name}=${value.toPrecision(3)}`
    })
    .join(', ')
}

function runX (dist, unitTest) {
  // Init test variables
  const range = getTestRange(dist)

  // Run test
  if (dist.type() === 'discrete') {
    for (let i = range[0]; i < range[1]; i++) {
      unitTest(dist, Math.floor(i))
    }
  } else {
    const dx = (range[1] - range[0]) / RANGE_STEPS
    for (let i = 0; i < RANGE_STEPS; i++) {
      unitTest(dist, range[0] + dx * (i + Math.random()))
    }
  }
}

function runP (dist, unitTest) {
  // Run test
  for (let i = 1; i < RANGE_STEPS - 2; i++) {
    unitTest(dist, (i + Math.random()) / RANGE_STEPS)
  }
}

export function ksTest (values, model) {
  let D = 0
  values.sort((a, b) => a - b)
  for (let i = 0; i < values.length; i++) {
    D = Math.max(D, Math.abs((i + 1) / values.length - model(values[i])))
  }
  return D <= 1.628 / Math.sqrt(values.length)
}

export function chiTest (values, model, c) {
  // Calculate distribution first
  const p = new Map()
  for (let i = 0; i < values.length; i++) {
    if (!p.has(values[i])) {
      p.set(values[i], 1)
    } else {
      p.set(values[i], p.get(values[i]) + 1)
    }
  }

  // Create sorted frequencies
  const counts = Array.from(p)
    .map(d => ({ k: d[0], x: d[1], p: d[1] / values.length }))
    .sort((a, b) => a.k - b.k)

  // Calculate chi-square
  let chi2 = 0
  let E = 0
  let O = 0
  let k = 1
  let rest = values.length
  const binSize = values.length / 100
  counts.forEach(d => {
    // Add frequency to current bin
    E += model(parseInt(d.k)) * values.length
    O += d.x

    // If bin count is above N / 20, consider this a class and clear bin.
    if (E > binSize) {
      chi2 += Math.pow(O - E, 2) / E
      rest -= E
      E = 0
      O = 0
      k++
    }
  })

  // Add rest of the distribution.
  if (rest > 0) {
    chi2 += Math.pow(O - rest, 2) / rest
  }

  // Find critical value
  const df = Math.max(1, k - c - 1)
  const crit = df <= 250 ? CHI_TABLE_LOW[df] : CHI_TABLE_HIGH[Math.ceil(df / 50)]

  // Check if distribution is degenerate
  if (p.size === 1) {
    const k0 = p.keys().next().value
    return model(k0) === 1 && chi2 === 0
  } else {
    return chi2 > 0 && chi2 <= crit
  }
}

export function repeat (test, times = 10) {
  for (let i = 0; i < times; i++) {
    test()
  }
}

export const Tests = {
  pdfRange (dist) {
    // Run through x values and assert PDF(x) >= 0.
    runX(dist, (d, x) => {
      const pdf = d.pdf(x)
      assert(Number.isFinite(pdf) && !Number.isNaN(pdf) && pdf >= 0, `pdf(${x}; ${getParamList(d)}) = ${pdf}`)
    })
  },

  cdfRange (dist) {
    // Run through x values and assert 0 <= CDF(x) <= 1.
    runX(dist, (d, x) => {
      const cdf = d.cdf(x)
      assert(Number.isFinite(cdf) && !Number.isNaN(cdf) && cdf >= 0 && cdf <= 1, `cdf(${x}; ${getParamList(d)}) = ${cdf}`)
    })
  },

  cdfMonotonicity (dist) {
    const discrete = dist.type() === 'discrete'

    // Run through x values and assert CDF(x - dx) <= CDF(x + dx).
    runX(dist, (d, x) => {
      const p1 = discrete ? x : x - 1e-3
      const p2 = discrete ? x + 1 : x + 1e-3
      assert(p2 > p1, `cdf(${p1}; ${getParamList(d)}) > cdf(${p2}; ${getParamList(d)})`)
    })
  },

  cdf2pdf (dist) {
    // Init test variables
    const range = getTestRange(dist)

    // Run test
    if (dist.type() === 'discrete') {
      // Discrete distribution: PMF(k) = CDF(k) - CDF(k - 1).
      for (let i = range[0]; i < range[1]; i++) {
        const x = Math.floor(i)
        const p = dist.pdf(x)
        const cdf1 = dist.cdf(x)
        const cdf0 = dist.cdf(x - 1)
        // This doesn't need to have full precision.
        assert(almostEqual(p, cdf1 - cdf0, 8), `pdf(${x}) = ${p} != ${cdf1 - cdf0} = ${cdf1} - ${cdf0}`)
      }
    } else {
      // Continuous distribution: PDF(x) = d CDF(x) / dx
      const supp = dist.support()
      const dx = (range[1] - range[0]) / RANGE_STEPS
      for (let i = 0; i < RANGE_STEPS; i++) {
        // Perform test only within the support boundaries.
        const x = range[0] + dx * (i + Math.random())
        if (x < supp[0].value + 2 * H || x > supp[1].value - 2 * H) {
          continue
        }

        // If PDF(x) is below precision, don't perform the test.
        const p = dist.pdf(x)
        if (p < Number.EPSILON) {
          continue
        }

        // Compare CDF and PDF.
        const df = differentiate(t => dist.cdf(t), x, H)
        if (p > Number.EPSILON) {
          // This is an inaccurate comparison, so we only require a precision of 1e-6.
          console.log(p, df)
          assert(almostEqual(p, df, 6), `pdf(${x.toPrecision(3)}; ${getParamList(dist)}) = ${p} != ${df} = d/dx cdf(${x.toPrecision(3)}). delta = ${(p - df).toPrecision(3)}`)
        }
      }
    }
  },

  qRange (dist) {
    // Extract distribution support.
    const supp = dist.support()

    // Run through p values and assert supp[0] <= q(p) <= supp[1].
    runP(dist, (d, p) => {
      const x = d.q(p)
      assert(Number.isFinite(x) && x >= supp[0].value && x <= supp[1].value,
        `q(${p}; ${getParamList(d)}) = ${x}, support = [${supp[0].value}, ${supp[1].value}]`)
    })
  },

  qMonotonicity (dist) {
    runP(dist, (d, p) => {
      const x1 = d.q(p)
      const x2 = d.q(p + 1e-3)
      assert(x2 >= x1, `q(${x1}; ${getParamList(d)}) > q(${x2}; ${getParamList(d)})`)
    })
  },

  qGalois (dist) {
    runP(dist, (d, p) => {
      // Compute quantile.
      const q = d.q(p)

      // Sample several values to test for Galois inequalities.
      for (let i = 0; i < 10; i++) {
        const x = d.sample()
        const cdf = d.cdf(x)
        assert((x - q) * (cdf - p) >= 0, `cdf(${x}) = ${cdf} and q(${p}) = ${q}`)
      }
    })
  }
}
