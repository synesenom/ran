import { assert } from 'chai'

export default (function () {
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

  /**
     * Performs a Kolmogorov-Smirnov test with significance level of 99%.
     *
     * @param values Sample of continuous random values.
     * @param model Theoretical cumulative distribution function.
     */
  function ksTest (values, model) {
    let D = 0
    values.sort(function (a, b) {
      return a - b
    })
    for (let i = 0; i < values.length; i++) {
      D = Math.max(D, Math.abs((i + 1) / values.length - model(values[i])))
    }
    // console.log(D)
    return D <= 1.628 / Math.sqrt(values.length)
  }

  /**
     * Performs a chi-square test with significance level of 0.001. That is, there is a 0.1% chance
     * that the sample follows the distribution and we still reject it.
     *
     * @param {number[]} values Sample of discrete random values.
     * @param {Function} model Theoretical cumulative mass function.
     * @param {number} c Number of model parameters.
     */
  function chiTest (values, model, c) {
    // Calculate distribution first
    let p = {}
    for (let i = 0; i < values.length; i++) {
      if (!p[values[i]]) { p[values[i]] = 0 }
      p[values[i]]++
    }

    // Calculate chi-square
    let chi2 = 0
    for (let x in p) {
      if (p.hasOwnProperty(x)) {
        let m = model(parseInt(x)) * values.length
        chi2 += Math.pow(p[x] - m, 2) / m
      }
    }

    // Find critical value
    let df = Math.max(1, Object.keys(p).length - c - 1)
    let crit = df <= 250 ? CHI_TABLE_LOW[df] : CHI_TABLE_HIGH[Math.ceil(df / 50)]
    // console.log(df, crit, chi2);
    return chi2 <= crit
  }

  /**
     * Performs 10 tests and checks if at least 6 was successful.
     *
     * @param test Test to run.
     * @param complete Whether all trials should succeed.
     */
  function trials (test, complete) {
    let success = 0
    for (let t = 0; t < 10; t++) {
      success += test() ? 1 : 0
    }
    assert(success >= (complete ? 10 : 6))
  }

  function repeat (test, times) {
    for (let i = 0; i < times; i++) {
      test()
    }
  }

  function diffDisc (pmf, cdf, a, b) {
    let dy = 0
    let int = 0
    for (let x = a; x < b; x++) {
      int += pmf(x)
      dy += Math.abs(cdf(x) - int)
      // console.log(x, int, cdf(x));
    }
    // console.log(dy);
    return dy
  }

  function differentiate (func, x0, dx) {
    let d = 0.5 * dx
    return (func(x0 + d) - func(x0 - d)) / dx
  }

  function sum (arr) {
    return arr.reduce((acc, d) => d + acc, 0)
  }

  function cdf2pdf (dist, range, laps) {
    return sum(Array.from({ length: laps }, () => {
      let x0 = range[0] + Math.random() * (range[1] - range[0])
      return Math.abs(dist.pdf(x0) - differentiate(x => dist.cdf(x), x0, 1e-5))
    })) / laps
  }

  return {
    ksTtest: ksTest,
    chiTest: chiTest,
    trials,
    repeat,
    diffDisc: diffDisc,
    cdf2pdf
  }
})()
