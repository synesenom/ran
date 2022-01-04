import { assert } from 'chai'
import seedrandom from 'seedrandom'


// Constants
const PRECISION = 1e-10

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

function safeCompare (a, b) {
  return b - a > -PRECISION
}

function differentiate (f, x, h) {
  return (f(x + h) - f(x - h)) / (2 * h)
}

function getTestRange (dist) {
  return [
    Number.isFinite(dist.support()[0].value) ? dist.support()[0].value - 1 : -50,
    Number.isFinite(dist.support()[1].value) ? dist.support()[1].value + 1 : 50
  ].concat([0, 1e-10])
}

function runX (dist, laps, unitTest) {
  // Init test variables
  let range = getTestRange(dist)
  let passed = true

  // Run test
  if (dist.type() === 'discrete') {
    for (let i = range[0]; i < range[1]; i++) {
      passed = passed && unitTest(dist, Math.floor(i))
    }
  } else {
    let dx = (range[1] - range[0]) / laps
    for (let i = 0; i < laps; i++) {
      passed = passed && unitTest(dist, range[0] + i * dx + Math.random())
    }
  }

  // Return aggregated test result
  return passed
}

function runP (dist, laps, unitTest) {
  // Init test variables
  let passed = true

  // Run test
  for (let i = 1; i < laps - 2; i++) {
    passed = passed && unitTest(dist, (i + Math.random()) / laps)
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

export function equal (x, y, precision = 10) {
  return Math.abs((x - y) / y) < Math.pow(10, -precision)
}

export const Tests = {
  pdfType (dist, laps) {
    return runX(dist, laps, (d, x) => {
      let pdf = d.pdf(x)
      return Number.isFinite(pdf)
    })
  },

  pdfRange (dist, laps) {
    return runX(dist, laps, (d, x) => dist.pdf(x) >= 0)
  },

  cdfType (dist, laps) {
    return runX(dist, laps, (d, x) => {
      let cdf = d.cdf(x)
      return Number.isFinite(cdf)
    })
  },

  cdfRange (dist, laps) {
    return runX(dist, laps, (d, x) => {
      let cdf = d.cdf(x)
      return cdf >= 0 && cdf <= 1
    })
  },

  cdfMonotonicity (dist, laps) {
    let discrete = dist.type() === 'discrete'
    return runX(dist, laps, (d, x) => {
      let p1 = discrete ? x : x - 1e-3
      let p2 = discrete ? x + 1 : x + 1e-3
      return safeCompare(p1, p2)
    })
  },

  pdf2cdf (dist, laps) {
    // Init test variables
    let range = getTestRange(dist)
    let s = 0

    // Run test
    if (dist.type() === 'discrete') {
      for (let i = range[0]; i < range[1]; i++) {
        let x = Math.floor(i)
        let p = dist.pdf(x)
        // console.log(x, p, dist.cdf(x) - dist.cdf(x - 1))
        s += Math.abs(p - (dist.cdf(x) - dist.cdf(x - 1)))
      }
    } else {
      let dx = (range[1] - range[0]) / laps
      for (let i = 0; i < laps; i++) {
        let x = range[0] + i * dx + Math.random()
        let p = dist.pdf(x)
        let df = differentiate(t => dist.cdf(t), x, 1e-6)
        if (df > Number.EPSILON && p > Number.EPSILON) {
          if (Math.abs(p - df) > PRECISION) {
            // console.log(x, p, df, Math.abs(p - df))
          }
          s += Math.abs(p - df)
        }
      }
    }

    // Test passes if average relative difference is lower than 1%
    return s / laps < 1e-6
  },

  qType (dist, laps) {
    return runP(dist, laps, (d, p) => {
      let x = d.q(p)
      return Number.isFinite(x)
    })
  },

  qRange (dist, laps) {
    let supp = dist.support()
    return runP(dist, laps, (d, p) => {
      let x = d.q(p)
      return x >= supp[0].value && x <= supp[1].value
    })
  },

  qMonotonicity (dist, laps) {
    return runP(dist, laps, (d, p) => {
      let x1 = d.q(p)
      let x2 = d.q(p + 1e-3)
      return safeCompare(x1, x2)
    })
  },

  qGalois (dist, laps) {
    return runP(dist, laps, (d, p) => {
      // Compute quantile
      let q = d.q(p)
      let trials = 0
      let passed = true

      // Sample several values to test for Galois inequalities
      do {
        let x = d.sample()
        let cdf = d.cdf(x)
        if (Math.abs(p - cdf) >= PRECISION) {
          passed = passed && ((safeCompare(p, cdf) && safeCompare(q, x)) || (safeCompare(cdf, p) && safeCompare(x, q)))
          trials++
        }
      } while (trials < 10)
      return passed
    })
  }
}