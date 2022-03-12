import { assert } from 'chai'


// Constants
const H = 0.01
const PRECISION = 1e-10
const RANGE_STEPS = 100

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

function almostEqual(a, b, tol = PRECISION) {
  return Math.abs(a - b) < tol
}

function safeCompare (a, b) {
  return b - a >= 0//-PRECISION
}

function _a(f, x, h, n, m) {
  if (n === 1) {
    const h2 = h / Math.pow(2, m - 1)
    return (f(x + h2) - f(x - h2)) / h2 / 2
  } else {
    const c = Math.pow(4, n - 1)
    return (c * _a(f, x, h, n - 1, m + 1) - _a(f, x, h, n - 1, m)) / (c - 1)
  }
}

function differentiate (f, x, h = 0.01) {
  return _a(f, x, h, 5, 1)
  /*
  let res = _a(f, x, h, 1, 1)
  let err
  for (let n = 2; n <= 10; n++) {
    for (let m = 1; m <= 10; m++) {
      let res2 = _a(f, x, h, n, m)
      err = Math.abs(res2 - res) / res
      console.log(res2)
      if (err < Number.EPSILON) {
        return res2
      }
      res = res2
    }
  }
  return res

  //return (4 * _a(f, x, 0.001, 1, 2) - _a(f, x, 0.001, 1, 1)) / 3
  /*
  const CON = 1.4
  const CON2 = CON * CON
  const BIG = 1e30
  const NTAB = 10
  const SAFE = 2.0

  let i, j
  let errt, fac, hh, a, ans, err
  a = Array.from({length: NTAB + 1}, () => Array.from({length: NTAB + 1}))
  hh = h
  a[1][1] = (f(x + hh) - f(x - hh)) / (2 * hh)
  err = BIG

  for (i = 2; i <= NTAB; i++) {
    hh /= CON
    a[1][i] = (f(x + hh) - f(x - hh)) / (2 * hh)
    fac = CON2
    for (j = 2; j <= i; j++) {
      a[j][i] = (a[j-1][i]*fac - a[j-1][i-1]) / (fac-1)
      fac = CON2 * fac
      errt = Math.max(Math.abs(a[j][i]-a[j-1][i]), Math.abs(a[j][i]-a[j-1][i-1]))
      if  (errt <= err) {
        err = errt
        ans = a[j][i]
        console.log(err)
      }
    }
    if (Math.abs(a[i][i] - a[i-1][i-1]) >= SAFE * err) break
  }
  console.log(x, i, j, err)
  return ans
   */
}

function getTestRange (dist) {
  return [
    Number.isFinite(dist.support()[0].value) ? dist.support()[0].value - 1 : -50,
    Number.isFinite(dist.support()[1].value) ? dist.support()[1].value + 1 : 50
  ]
}

function getParamList(dist) {
  return Object.entries(dist.p)
    .map(([name, value]) => `${name}=${value.toPrecision(3)}`)
    .join(', ')
}

function runX (dist, unitTest) {
  // Init test variables
  let range = getTestRange(dist)
  let passed = true

  // Run test
  if (dist.type() === 'discrete') {
    for (let i = range[0]; i < range[1]; i++) {
      passed = passed && unitTest(dist, Math.floor(i))
    }
  } else {
    let dx = (range[1] - range[0]) / RANGE_STEPS
    for (let i = 0; i < RANGE_STEPS; i++) {
      passed = passed && unitTest(dist, range[0] + i * dx + Math.random())
    }
  }

  // Return aggregated test result
  return passed
}

function runP (dist, unitTest) {
  // Init test variables
  let passed = true

  // Run test
  for (let i = 1; i < RANGE_STEPS - 2; i++) {
    passed = passed && unitTest(dist, (i + Math.random()) / RANGE_STEPS)
  }

  // Return aggregated test result
  return passed
}

export function ksTest (values, model) {
  let D = 0
  values.sort((a, b) => a - b)
  for (let i = 0; i < values.length; i++) {
    D = Math.max(D, Math.abs((i + 1) / values.length - model(values[i])))
    // console.log(values[i], (i + 1) / values.length, model(values[i]))
  }
  // console.log(D, 1.628 / Math.sqrt(values.length))
  return D <= 1.628 / Math.sqrt(values.length)
}

export function chiTest (values, model, c) {
  // Calculate distribution first
  let p = new Map()
  for (let i = 0; i < values.length; i++) {
    if (!p.has(values[i])) {
      p.set(values[i], 1)
    } else {
      p.set(values[i], p.get(values[i]) + 1)
    }
  }

  // Create sorted frequencies
  let dist = Array.from(p)
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
  let df = Math.max(1, k - c - 1)
  let crit = df <= 250 ? CHI_TABLE_LOW[df] : CHI_TABLE_HIGH[Math.ceil(df / 50)]
  // console.log(chi2, crit)
  if (chi2 > crit) {
    // console.log(chi2, crit)
  }

  // Check if distribution is degenerate
  if (p.size === 1) {
    let k0 = p.keys().next().value
    return model(k0) === 1 && chi2 === 0
  } else {
    return chi2 > 0 && chi2 <= crit
  }
}

export function trials (test) {
  let success = 0
  for (let t = 0; t < 5; t++) {
    success += test(t) ? 1 : 0
  }
  assert(success >= 3, `Failed ${5 - success} out of ${5}`)
}

export function repeat (test, times = 10) {
  for (let i = 0; i < times; i++) {
    test()
  }
}



export const Tests = {
  pdfRange (dist) {
    // Run through x values and assert PDF(x) >= 0.
    return runX(dist, (d, x) => {
      const pdf = d.pdf(x)
      assert(Number.isFinite(pdf) && pdf >= 0, `pdf(${x}; ${getParamList(d)}) = ${pdf}`)
    })
  },

  cdfRange (dist) {
    // Run through x values and assert 0 <= CDF(x) <= 1.
    return runX(dist, (d, x) => {
      let cdf = d.cdf(x)
      assert(Number.isFinite(cdf) && cdf >= 0 && cdf <= 1, `cdf(${x}; ${getParamList(d)}) = ${cdf}`)
    })
  },

  cdfMonotonicity (dist) {
    let discrete = dist.type() === 'discrete'

    // Run through x values and assert CDF(x - dx) <= CDF(x + dx).
    return runX(dist, (d, x) => {
      let p1 = discrete ? x : x - 1e-3
      let p2 = discrete ? x + 1 : x + 1e-3
      assert(safeCompare(p1, p2), `cdf(${p1}; ${getParamList(d)}) > cdf(${p2}; ${getParamList(d)})`)
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
        assert(almostEqual(p, cdf1 - cdf0), `pdf(${x}) = ${p} != ${cdf1 - cdf0} = ${cdf1} - ${cdf0}`)
      }
    } else {
      // Continuous distribution: PDF(x) = d CDF(x) / dx
      const supp = dist.support()
      const dx = (range[1] - range[0]) / RANGE_STEPS
      for (let i = 0; i < RANGE_STEPS; i++) {
        // Perform test only within the support boundaries.
        const x = range[0] + i * dx + Math.random()
        if (x < supp[0].value + H || x > supp[1].value - H) {
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
          assert(almostEqual(p, df), `pdf(${x.toPrecision(3)}; ${getParamList(dist)}) = ${p} != ${df} = d/dx cdf(${x.toPrecision(3)}). delta = ${(p - df).toPrecision(3)}`)
        }
      }
    }
  },

  qRange (dist) {
    // Extract distribution support.
    let supp = dist.support()

    // Run through p values and assert supp[0] <= q(p) <= supp[1].
    return runP(dist, (d, p) => {
      let x = d.q(p)
      assert(Number.isFinite(x) && x >= supp[0].value && x <= supp[1].value,
        `q(${p}; ${getParamList(d)}) = ${x}, support = [${supp[0].value}, ${supp[1].value}]`)
    })
  },

  qMonotonicity (dist) {
    return runP(dist, (d, p) => {
      let x1 = d.q(p)
      let x2 = d.q(p + 1e-3)
      return safeCompare(x1, x2)
    })
  },

  qGalois (dist) {
    return runP(dist, (d, p) => {
      // Compute quantile.
      let q = d.q(p)

      // Sample several values to test for Galois inequalities.
      for (let i = 0; i < 10; i++) {
        let x = d.sample()
        let cdf = d.cdf(x)
        assert((x - q) * (cdf - p) > 0, `cdf(${x}) = ${cdf} and q(${p}) = ${q}`)
      }
    })
  }
}
