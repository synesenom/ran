import { assert } from 'chai'

// Constants
const H = 0.01
const PRECISION = 1e-9
const RANGE_STEPS = 10
// Golden-ratio conjugate: low-discrepancy deterministic offset replacing Math.random() jitter.
const GOLDEN = 0.6180339887
// Fixed reference probabilities for qGalois: well-spread across (0,1), spanning both sides of any p.
const GALOIS_PROBS = [0.1, 0.25, 0.5, 0.75, 0.9]
// Fixed probabilities for quantile roundtrip: includes tails where root-finding is hardest.
const ROUNDTRIP_PROBS = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95]

// Critical values for P = 0.01
// Source: https://www.medcalc.org/manual/chi-square-table.php
const CHI_TABLE_LOW = [0,
  6.635, 9.210, 11.345, 13.277, 15.086, 16.812, 18.475, 20.090, 21.666, 23.209,
  24.725, 26.217, 27.688, 29.141, 30.578, 32.000, 33.409, 34.805, 36.191, 37.566,
  38.932, 40.289, 41.638, 42.980, 44.314, 45.642, 46.963, 48.278, 49.588, 50.892,
  52.191, 53.486, 54.776, 56.061, 57.342, 58.619, 59.893, 61.162, 62.428, 63.691,
  64.950, 66.206, 67.459, 68.710, 69.957, 71.201, 72.443, 73.683, 74.919, 76.154,
  77.386, 78.616, 79.843, 81.069, 82.292, 83.513, 84.733, 85.950, 87.166, 88.379,
  89.591, 90.802, 92.010, 93.217, 94.422, 95.626, 96.828, 98.028, 99.228, 100.425,
  101.621, 102.816, 104.010, 105.202, 106.393, 107.583, 108.771, 109.958, 111.144, 112.329,
  113.512, 114.695, 115.876, 117.057, 118.236, 119.414, 120.591, 121.767, 122.942, 124.116,
  125.289, 126.462, 127.633, 128.803, 129.973, 131.141, 132.309, 133.476, 134.642, 135.807,
  136.971, 138.134, 139.297, 140.459, 141.620, 142.780, 143.940, 145.099, 146.257, 147.414,
  148.571, 149.727, 150.882, 152.037, 153.191, 154.344, 155.496, 156.648, 157.800, 158.950,
  160.100, 161.250, 162.398, 163.546, 164.694, 165.841, 166.987, 168.133, 169.278, 170.423,
  171.567, 172.711, 173.854, 174.996, 176.138, 177.280, 178.421, 179.561, 180.701, 181.840,
  182.979, 184.118, 185.256, 186.393, 187.530, 188.666, 189.802, 190.938, 192.073, 193.208,
  194.342, 195.476, 196.609, 197.742, 198.874, 200.006, 201.138, 202.269, 203.400, 204.530,
  205.660, 206.790, 207.919, 209.047, 210.176, 211.304, 212.431, 213.558, 214.685, 215.812,
  216.938, 218.063, 219.189, 220.314, 221.438, 222.563, 223.687, 224.810, 225.933, 227.056,
  228.179, 229.301, 230.423, 231.544, 232.665, 233.786, 234.907, 236.027, 237.147, 238.266,
  239.386, 240.505, 241.623, 242.742, 243.860, 244.977, 246.095, 247.212, 248.329, 249.445,
  250.561, 251.677, 252.793, 253.908, 255.023, 256.138, 257.253, 258.367, 259.481, 260.595,
  261.708, 262.821, 263.934, 265.047, 266.159, 267.271, 268.383, 269.495, 270.606, 271.717,
  272.828, 273.939, 275.049, 276.159, 277.269, 278.379, 279.488, 280.597, 281.706, 282.814,
  283.923, 285.031, 286.139, 287.247, 288.354, 289.461, 290.568, 291.675, 292.782, 293.888,
  294.994, 296.100, 297.206, 298.311, 299.417, 300.522, 301.626, 302.731, 303.835, 304.940
]
const CHI_TABLE_HIGH = [
  359.906, 414.474, 468.724, 522.717, 576.493, 630.084, 683.516, 736.807, 789.974, 843.029,
  895.984, 948.848, 1001.630, 1054.334, 1106.969
]

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
  return [ans, err]
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
      unitTest(dist, range[0] + i * dx + (i * GOLDEN) % 1)
    }
  }
}

function runP (dist, unitTest) {
  // Run test
  for (let i = 1; i < RANGE_STEPS - 2; i++) {
    unitTest(dist, (i + (i * GOLDEN) % 1) / RANGE_STEPS)
  }
}

export function ksTest (values, model) {
  let D = 0
  values.sort((a, b) => a - b)
  for (let i = 0; i < values.length; i++) {
    const F = model(values[i])
    D = Math.max(D, Math.abs((i + 1) / values.length - F), Math.abs(F - i / values.length))
    // console.log(values[i], (i + 1) / values.length, model(values[i]))
  }
  // console.log(D, 1.628 / Math.sqrt(values.length))
  return D <= 1.628 / Math.sqrt(values.length)
}

// Marsaglia & Marsaglia (2004), "Evaluating the Anderson-Darling Distribution",
// JSS 9(2). Two-piece asymptotic CDF approximation with stated error ≤ 6e-6
// over A². The Horner-form polynomial coefficients are reproduced verbatim.
const AD_POLY1 = [2.00012, 0.247105, -0.0649821, 0.0347962, -0.0116720, 0.00168691]
const AD_POLY2 = [1.0776, -2.30695, 0.43424, -0.082433, 0.008056, -0.0003146]

function adHorner (coeffs, z) {
  let acc = coeffs[coeffs.length - 1]
  for (let i = coeffs.length - 2; i >= 0; i--) {
    acc = acc * z + coeffs[i]
  }
  return acc
}

export function _adinf (z) {
  if (z <= 0) return 0
  if (z < 2) return Math.exp(-1.2337141 / z) / Math.sqrt(z) * adHorner(AD_POLY1, z)
  return Math.exp(-Math.exp(adHorner(AD_POLY2, z)))
}

// Marsaglia finite-n correction; piecewise in x = adinf(A²). Improves the
// asymptotic CDF approximation by ~10⁻³ for moderate n; harmless as n → ∞.
// See solutions/testing/2026-05-19-1132-marsaglia-errfix-transcription-branch-coverage.md
// for the transcription pitfall around the g2 branch.
function _errfix (n, x) {
  const c = 0.01265 + 0.1757 / n
  if (x < c) {
    const t = x / c
    const g1 = Math.sqrt(t) * (1 - t) * (49 * t - 102)
    return (0.0037 / (n * n * n) + 0.00078 / (n * n) + 0.00006 / n) * g1
  }
  if (x < 0.8) {
    const t = (x - c) / (0.8 - c)
    const g2 = adHorner([-0.00022633, 6.54034, -14.6538, 14.458, -8.259, 1.91864], t)
    return (0.04213 / n + 0.01365 / (n * n * n)) * g2
  }
  const g3 = adHorner([-130.2137, 745.2337, -1705.091, 1950.646, -1116.360, 255.7844], x)
  return g3 / n
}

export function _adStatistic (values, model) {
  const n = values.length
  const u = values.map(model)
  u.sort((a, b) => a - b)
  // Clip to avoid log(0) when a CDF saturates exactly at the support boundary
  // (e.g. Uniform at b, Arcsine at endpoints). 1e-300 keeps log(u_i) finite;
  // 1-1e-15 keeps log(1-u_j) ≥ log(1e-15) ≈ -34.5.
  const LO = 1e-300
  const HI = 1 - 1e-15
  let sum = 0
  for (let i = 0; i < n; i++) {
    const ui = Math.min(HI, Math.max(LO, u[i]))
    const uj = Math.min(HI, Math.max(LO, u[n - 1 - i]))
    sum += (2 * (i + 1) - 1) * (Math.log(ui) + Math.log(1 - uj))
  }
  return -n - sum / n
}

export function adTest (values, model, alpha = 0.01) {
  const a2 = _adStatistic(values, model)
  const cdf = _adinf(a2)
  const p = 1 - (cdf + _errfix(values.length, cdf))
  return p >= alpha
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
  const dist = Array.from(p)
    .map(d => ({ x: d[0], p: d[1] }))
    .sort((a, b) => a.x - b.x)

  // Calculate chi-square
  let chi2 = 0
  let bin = 0
  let pBin = 0
  let k = 0
  dist.forEach(d => {
    // Add frequency to current bin
    bin += model(parseInt(d.x)) * values.length
    pBin += d.p

    // If bin count is above 10, consider this a class and clear bin
    if (bin > 10) {
      chi2 += Math.pow(pBin - bin, 2) / bin
      // console.log(pBin, bin, Math.pow(pBin - bin, 2) / bin)
      bin = 0
      pBin = 0
      k++
    }
  })

  // Find critical value
  const df = Math.max(1, k - c - 1)
  const crit = df <= 250 ? CHI_TABLE_LOW[df] : CHI_TABLE_HIGH[Math.ceil(df / 50)]
  // console.log(chi2, crit)
  if (chi2 > crit) {
    // console.log(chi2, crit)
  }

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

// Tolerance for refVal comparison. For sub-precision expected values, fall
// back to relative tolerance so catastrophic-cancellation bugs that return 0
// or 1e-16 instead of, say, 2.5e-19 cannot pass vacuously under the absolute
// PRECISION check.
function refValTol (expected) {
  // 1e-10 relative tolerance leaves 3+ orders of magnitude of headroom above
  // typical continued-fraction precision (~1e-13) while still catching mild
  // regressions in the sub-precision regime that a 1e-3 band would miss.
  return Math.abs(expected) >= PRECISION
    ? PRECISION
    : Math.max(Math.abs(expected) * 1e-10, Number.MIN_VALUE)
}

// 1e-6 matches the tolerance specified in issue #213: root-finding accumulates
// more error than direct PDF/CDF evaluation, so a looser bound than PRECISION is justified.
// Mixed absolute/relative band (issue #338): a pure absolute 1e-6 is vacuous for
// extreme-tail quantiles whose magnitude dwarfs one ULP, so divide by max(1, |x|).
export function checkQuantileVals (dist, quantileVals) {
  for (const { p, x } of quantileVals) {
    const actual = dist.q(p)
    assert(Math.abs(actual - x) / Math.max(1, Math.abs(x)) < 1e-6, `q(${p}) = ${actual}, expected ${x}`)
  }
}

export function checkRefVals (dist, refVals) {
  for (const { x, pdf, pmf, cdf } of refVals) {
    if (pdf !== undefined) {
      const actual = dist.pdf(x)
      if (!Number.isFinite(pdf)) {
        assert(actual === pdf, `pdf(${x}) = ${actual}, expected ${pdf}`)
      } else {
        assert(Math.abs(actual - pdf) < refValTol(pdf), `pdf(${x}) = ${actual}, expected ${pdf}`)
      }
    }
    if (pmf !== undefined) {
      const actual = dist.pdf(x)
      assert(Math.abs(actual - pmf) < refValTol(pmf), `pmf(${x}) = ${actual}, expected ${pmf}`)
    }
    const actualCdf = dist.cdf(x)
    assert(Math.abs(actualCdf - cdf) < refValTol(cdf), `cdf(${x}) = ${actualCdf}, expected ${cdf}`)
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
      const x1 = discrete ? x : x - 1e-3
      const x2 = discrete ? x + 1 : x + 1e-3
      const c1 = d.cdf(x1)
      const c2 = d.cdf(x2)
      assert(c2 >= c1, `cdf(${x2}; ${getParamList(d)}) = ${c2} < cdf(${x1}; ${getParamList(d)}) = ${c1}`)
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
        const df = cdf1 - cdf0
        assert(almostEqual(p, df), `pdf(${x}) = ${p} != ${df} = ${cdf1} - ${cdf0}. delta = ${(p - df).toPrecision(3)}`)
      }
    } else {
      // Continuous distribution: PDF(x) = d CDF(x) / dx
      const supp = dist.support()
      const dx = (range[1] - range[0]) / RANGE_STEPS
      for (let i = 0; i < RANGE_STEPS; i++) {
        // Perform test only within the support boundaries.
        const x = range[0] + i * dx + (i * GOLDEN) % 1
        if (x < supp[0].value + 2 * H || x > supp[1].value - 2 * H) {
          continue
        }

        // If PDF(x) is below precision, don't perform the test.
        const p = dist.pdf(x)
        if (p < Number.EPSILON) {
          continue
        }

        // Compare CDF and PDF.
        // Two coarse estimates should agree for smooth functions; a large
        // disagreement means the stencil is crossing a kink in the PDF
        // (e.g. DoubleGamma at x=0, Triangular/Trapezoidal at x=c), making
        // the derivative unreliable regardless of step size.
        const q1 = (dist.cdf(x + H) - dist.cdf(x - H)) / (2 * H)
        const q2 = (dist.cdf(x + H / 2) - dist.cdf(x - H / 2)) / H
        if (Math.abs(q1 - q2) > 1e-3) {
          continue
        }
        const [df, dfErr] = differentiate(t => dist.cdf(t), x, H)
        // Skip when CDF is saturated at 0 or 1 — derivative rounds to exactly 0
        if (Math.abs(df) < PRECISION) {
          continue
        }
        // Skip when Ridders' Richardson table did not converge — the stencil is crossing
        // a kink in the PDF (e.g. Laplace at mu, DoubleGamma at 0) that prevents reliable
        // finite-difference differentiation even when the coarse kink guard above passes
        // See solutions/testing/2026-05-16-ridders-error-estimate-kink-detection.md
        if (dfErr > Math.max(PRECISION, Math.abs(df) * 1e-7)) {
          continue
        }
        assert(almostEqual(p, df, Math.max(PRECISION, p * 1e-6)), `pdf(${x.toPrecision(3)}; ${getParamList(dist)}) = ${p} != ${df} = d/dx cdf(${x.toPrecision(3)}). delta = ${(p - df).toPrecision(3)}`)
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

  // See solutions/testing/2026-05-16-0653-galois-inequality-ulp-guard.md
  qGalois (dist) {
    runP(dist, (d, p) => {
      const q = d.q(p)

      for (const px of GALOIS_PROBS) {
        const x = d.q(px)
        const cdf = d.cdf(x)
        const dx = x - q
        const dp = cdf - p
        // Skip when x and q are numerically indistinguishable — the product sign
        // is then determined by floating-point rounding noise, not by a real violation.
        if (Math.abs(dx) < 4 * Number.EPSILON * (Math.abs(x) + Math.abs(q) + 1)) {
          continue
        }
        assert(dx * dp >= 0, `cdf(${x}) = ${cdf} and q(${p}) = ${q}`)
      }
    })
  },

  quantileRoundtrip (dist) {
    const discrete = dist.type() === 'discrete'
    for (const p of ROUNDTRIP_PROBS) {
      const x = dist.q(p)
      assert(typeof x === 'number' && Number.isFinite(x),
        `q(${p}; ${getParamList(dist)}) = ${x} is not finite`)
      if (discrete) {
        assert(dist.cdf(x) >= p,
          `cdf(q(${p}); ${getParamList(dist)}) = ${dist.cdf(x)} < ${p}`)
        // Skip lower-infimum check at the support boundary — cdf(min-1) = 0 < p trivially.
        if (x > dist.support()[0].value) {
          assert(dist.cdf(x - 1) < p,
            `cdf(q(${p}) - 1; ${getParamList(dist)}) = ${dist.cdf(x - 1)} >= ${p}`)
        }
      } else {
        const c = dist.cdf(x)
        assert(Math.abs(c - p) < 1e-6,
          `|cdf(q(${p}); ${getParamList(dist)}) - ${p}| = ${Math.abs(c - p)} >= 1e-6`)
      }
    }
  },

  symmetry (dist, center) {
    const supp = dist.support()
    const lo = Number.isFinite(supp[0].value) ? supp[0].value : -Infinity
    const hi = Number.isFinite(supp[1].value) ? supp[1].value : Infinity
    const hw = Math.min(Math.min(hi - center, center - lo) * 0.9, 10)
    for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const x = f * hw
      const pdfPlus = dist.pdf(center + x)
      const pdfMinus = dist.pdf(center - x)
      assert(almostEqual(pdfPlus, pdfMinus), `pdf(${center}+${x}) = ${pdfPlus} != pdf(${center}-${x}) = ${pdfMinus}`)
      const cdfPlus = dist.cdf(center + x)
      const cdfMinus = dist.cdf(center - x)
      assert(almostEqual(cdfPlus + cdfMinus, 1), `cdf(${center}+${x}) + cdf(${center}-${x}) = ${cdfPlus + cdfMinus} != 1`)
    }
  }
}
