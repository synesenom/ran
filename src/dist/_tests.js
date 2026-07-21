import { gammaUpperIncomplete } from '../special'

/**
 * Table containing critical values for the chi square test at 99% of confidence for low degrees of freedom.
 *
 * @var {number[]} _CHI_TABLE_LO
 * @memberof ran.dist
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
 * Table containing critical values for the chi square test at 99% of confidence for high degrees of freedom.
 *
 * @var {number[]} _CHI_TABLE_HI
 * @memberof ran.dist
 * @private
 */
const _CHI_TABLE_HI = [
  359.906, 414.474, 468.724, 522.717, 576.493, 630.084, 683.516, 736.807, 789.974, 843.029,
  895.984, 948.848, 1001.630, 1054.334, 1106.969
]

/**
 * Bins an observed sample against a probability mass function, merging consecutive
 * (Map-insertion-order) distinct values until the expected count in the running bin
 * exceeds 20 (for the central limit theorem to hold), and accumulates the chi-square
 * statistic over the closed bins. A trailing partial bin that never exceeds 20 is
 * dropped, matching the original chi2() binning behavior this helper was extracted from.
 *
 * @method _chiSquareBins
 * @memberof ran.dist
 * @param values {number[]} Array of values to bin.
 * @param pmf {Function} Probability mass function to bin against.
 * @returns {{chi2: number, k: number}} The chi-square statistic and the number of closed bins.
 * @private
 */
function _chiSquareBins (values, pmf) {
  // Calculate observed distribution
  const p = new Map()
  values.forEach(function (v) {
    p.set(v, p.has(v) ? p.get(v) + 1 : 1)
  })

  // Calculate chi-square
  let chi2 = 0
  let bin = 0
  let pBin = 0
  let k = 0
  p.forEach((px, x) => {
    // Add frequency to current bin
    bin += pmf(parseInt(x)) * values.length
    pBin += px

    // If bin count is above 20 (for central limit theorem), consider this a class and clear bin
    if (bin > 20) {
      chi2 += Math.pow(pBin - bin, 2) / bin
      bin = 0
      pBin = 0
      k++
    }
  })

  return { chi2, k }
}

/**
 * Performs a chi square test for an array of values and a probability mass function.
 *
 * @method chi2
 * @memberof ran.dist
 * @param values {number[]} Array of values to perform test for.
 * @param pmf {Function} Probability mass function to perform test against.
 * @param c {number} Number of parameters for the distribution.
 * @returns {{statistics: number, passed: boolean, pValue: number}} Test results, containing the raw chi square
 * statistics, a boolean to tell whether the distribution passed the test, and the chi-square goodness-of-fit
 * p-value (the regularized upper incomplete gamma survival probability).
 * @private
 */
export function chi2 (values, pmf, c) {
  const { chi2: stat, k } = _chiSquareBins(values, pmf)

  // Get critical value
  const df = Math.max(1, k - c - 1)

  const crit = df <= 250 ? _CHI_TABLE_LO[df] : _CHI_TABLE_HI[Math.floor(df / 50)]

  // Return comparison results
  return {
    statistics: stat,
    passed: stat <= crit,
    pValue: gammaUpperIncomplete(df / 2, stat / 2)
  }
}

// Marsaglia & Marsaglia (2004), "Evaluating the Anderson-Darling Distribution",
// JSS 9(2). Two-piece asymptotic CDF approximation with stated error ≤ 6e-6
// over A². The Horner-form polynomial coefficients are reproduced verbatim.
const _AD_POLY1 = [2.00012, 0.247105, -0.0649821, 0.0347962, -0.0116720, 0.00168691]
const _AD_POLY2 = [1.0776, -2.30695, 0.43424, -0.082433, 0.008056, -0.0003146]

function _adHorner (coeffs, z) {
  let acc = coeffs[coeffs.length - 1]
  for (let i = coeffs.length - 2; i >= 0; i--) {
    acc = acc * z + coeffs[i]
  }
  return acc
}

export function _adinf (z) {
  if (z <= 0) return 0
  if (z < 2) return Math.exp(-1.2337141 / z) / Math.sqrt(z) * _adHorner(_AD_POLY1, z)
  return Math.exp(-Math.exp(_adHorner(_AD_POLY2, z)))
}

// Marsaglia finite-n correction; piecewise in x = adinf(A²). Improves the
// asymptotic CDF approximation by ~10⁻³ for moderate n; harmless as n → ∞.
// See solutions/testing/2026-05-19-1132-marsaglia-errfix-transcription-branch-coverage.md
// for the transcription pitfall around the g2 branch.
export function _errfix (n, x) {
  const c = 0.01265 + 0.1757 / n
  if (x < c) {
    const t = x / c
    const g1 = Math.sqrt(t) * (1 - t) * (49 * t - 102)
    return (0.0037 / (n * n * n) + 0.00078 / (n * n) + 0.00006 / n) * g1
  }
  if (x < 0.8) {
    const t = (x - c) / (0.8 - c)
    const g2 = _adHorner([-0.00022633, 6.54034, -14.6538, 14.458, -8.259, 1.91864], t)
    return (0.04213 / n + 0.01365 / (n * n * n)) * g2
  }
  const g3 = _adHorner([-130.2137, 745.2337, -1705.091, 1950.646, -1116.360, 255.7844], x)
  return g3 / n
}

export function _adStatistic (values, cdf) {
  const n = values.length
  const u = values.map(cdf)
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

// Marsaglia & Marsaglia (2004) asymptotic approximation with finite-n correction.
function _adPValueFromStatistic (a2, n) {
  const adinf = _adinf(a2)
  return 1 - (adinf + _errfix(n, adinf))
}

/**
 * Performs an Anderson-Darling test for an array of values and a cumulative distribution function.
 *
 * @method andersonDarling
 * @memberof ran.dist
 * @param values {number[]} Array of values to perform test for.
 * @param cdf {Function} Cumulative distribution function to perform test against.
 * @returns {{statistics: number, passed: boolean, pValue: number}} Test results, containing the raw A²
 * statistics, a boolean to tell whether the distribution passed the test at α = 0.01, and the goodness-of-fit
 * p-value (Marsaglia & Marsaglia 2004 asymptotic approximation with finite-n correction).
 * @private
 */
export function andersonDarling (values, cdf) {
  if (values.length === 0) throw Error('andersonDarling: values must not be empty')
  const a2 = _adStatistic(values, cdf)
  const pValue = _adPValueFromStatistic(a2, values.length)
  return {
    statistics: a2,
    passed: pValue >= 0.01,
    pValue
  }
}
