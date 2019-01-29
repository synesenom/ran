/**
 * Table containing critical values for the chi square test at 99% of confidence for low degrees of freedom.
 *
 * @var {number[]} _CHI_TABLE_LO
 * @memberOf ran.dist
 * @private
 */
const _CHI_TABLE_LO = [0,
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

/**
 * Table containing critical values for the chi square test at 95% of confidence for high degrees of freedom.
 *
 * @var {number[]} _CHI_TABLE_HI
 * @memberOf ran.dist
 * @private
 */
const _CHI_TABLE_HI = [
  359.906, 414.474, 468.724, 522.717, 576.493, 630.084, 683.516, 736.807, 789.974, 843.029,
  895.984, 948.848, 1001.630, 1054.334, 1106.969
]

/**
 * Performs a chi square test for an array of values and a probability mass function.
 *
 * @method chi2
 * @memberOf ran.dist
 * @param values {number[]} Array of values to perform test for.
 * @param pmf {Function} Probability mass function to perform test against.
 * @param c {number} Number of parameters for the distribution.
 * @returns {{statistics: number, passed: boolean}} Test results, containing the raw chi square statistics and a
 * boolean to tell whether the distribution passed the test.
 * @private
 */
export function chi2 (values, pmf, c) {
  // Calculate observed distribution
  let p = new Map()
  values.forEach(function (v) {
    p.set(v, p.has(v) ? p.get(v) + 1 : 1)
  })

  // Calculate chi-square sum
  let chi2 = 0

  let n = values.length

  p.forEach((px, x) => {
    let m = pmf(parseInt(x)) * n
    chi2 += Math.pow(px - m, 2) / m
  })

  // Get critical value
  let df = Math.max(1, p.size - c - 1)

  let crit = df <= 250 ? _CHI_TABLE_LO[df] : _CHI_TABLE_HI[Math.floor(df / 50)]

  // Return comparison results
  return {
    statistics: chi2,
    passed: chi2 <= crit
  }
}

/**
 * Performs a Kolmogorov-Smirnov test for an array of values and a cumulative distribution function.
 *
 * @method kolmogorovSmirnov
 * @memberOf ran.dist
 * @param values {number[]} Array of values to perform test for.
 * @param cdf {Function} Cumulative distribution function to perform test against.
 * @returns {{statistics: number, passed: boolean}} Test results, containing the raw K-S statistics and a
 * boolean to tell whether the distribution passed the test.
 * @private
 */
export function kolmogorovSmirnov (values, cdf) {
  // Sort values for estimated CDF
  values.sort((a, b) => a - b)

  // Calculate D value
  let D = 0
  for (let i = 0; i < values.length; i++) {
    D = Math.max(D, Math.abs((i + 1) / values.length - cdf(values[i])))
  }

  // Return comparison results
  return {
    statistics: D,
    passed: D <= 1.628 / Math.sqrt(values.length)
  }
}
