import { MAX_ITER, EPS, DELTA } from '../core/constants'
import newton from '../algorithms/newton'
import trap from '../algorithms/trap'
import logGamma from './log-gamma'
import { erfc } from './error'
import { gammaLowerIncomplete, gammaUpperIncomplete } from './gamma-incomplete'

// The §4.2 large-mu expansion needs ~50 f_{jk} coefficients to reach 1e-10 at
// mu = 135; the paper prints only 10 (Eq. 90). The block below is machine-
// generated -- re-derive it with scripts/marcum-fjk-generate.py, never by hand.
// See solutions/special-functions/2026-05-21-1604-marcum-large-mu-asymptotic.md
// --- BEGIN GENERATED COEFFICIENTS: scripts/marcum-fjk-generate.py ---
/* eslint-disable no-loss-of-precision -- generated float64 constants;
   every literal is a shortest round-tripping decimal, but the rule
   toPrecision() heuristic false-positives on some 16-digit values. */

// F_JK[j][k]: coefficient list of the polynomial D_{jk} in u^2, where
// the expansion term is f_{jk}(u) = u^(j+2k) D_{jk}(u^2). Eq. 90.
const F_JK = [
  [
    [1.0],
    [0.125, 0, -0.20833333333333334],
    [0.0703125, 0, -0.4010416666666667, 0, 0.3342013888888889],
    [0.0732421875, 0, -0.8912109375, 0, 1.8464626736111112, 0, -1.0258125964506173],
    [0.112152099609375, 0, -2.3640869140625, 0, 8.78912353515625, 0, -11.207002616222994, 0, 4.669584423426247]
  ],
  [
    [0.5, 0.16666666666666666],
    [-0.0625, 0.14583333333333334, 0.5208333333333334, -0.6597222222222222],
    [-0.10546875, 0.15234375, 1.4036458333333333, -1.6710069444444444, -1.8381076388888888, 2.060908564814815],
    [-0.18310546875, 0.23193359375, 4.01044921875, -4.60458984375, -12.002007378472221, 13.232982494212964, 8.719407069830247, -9.403282134130658],
    [-0.3925323486328125, 0.4673004150390625, 13.00247802734375, -14.578535970052084, -65.91842651367188, 71.77784220377605, 106.46652485411845, -113.93785993160044, -53.700220869401846, 56.81327715168601]
  ],
  [
    [-0.125, 0, 0.20833333333333334],
    [0.046875, -0.25, -0.6979166666666666, 2.5, -1.6059027777777777],
    [0.1318359375, -0.421875, -2.8623046875, 8.020833333333334, 1.0777994791666667, -14.036458333333334, 8.090458622685185],
    [0.3204345703125, -0.87890625, -10.46416015625, 26.736328125, 29.225667317708332, -103.40190972222223, 17.13107036072531, 92.32313368055556, -50.99143448189943],
    [0.8831977844238281, -2.2430419921875, -40.88886337280273, 99.291650390625, 222.9227086385091, -632.81689453125, -205.55324667471427, 1232.7702877845293, -339.1285687513312, -728.4551700544946, 393.2179216560186]
  ],
  [
    [0.0625, -0.05416666666666667, -0.3125, 0.28935185185185186],
    [-0.0390625, 0.3421875, 0.7291666666666666, -5.671296296296297, 8.1640625, -3.5238233024691357],
    [-0.15380859375, 0.79892578125, 4.59033203125, -22.751985677083333, 14.934624565972221, 42.52666256751543, -65.69146050347223, 25.746658387988685],
    [-0.48065185546875, 2.11090087890625, 21.0254150390625, -89.87633409288195, -15.28445095486111, 411.04911024305557, -389.3215256679205, -293.92095419801313, 567.7231588481385, -213.0247079633827],
    [-1.6191959381103516, 6.517438888549805, 97.29213905334473, -384.7201304711236, -422.4613227844238, 2925.81622249462, -1437.2810672241965, -5929.61635756316, 6678.964970631854, 1992.7516382310725, -5560.599501221268, 2034.9551693024277]
  ],
  [
    [-0.0390625, 0.08333333333333333, 0.3663194444444444, -0.8333333333333334, 0.42390046296296297],
    [0.0341796875, -0.4270833333333333, -0.5979817708333334, 10.208333333333334, -24.38530815972222, 22.48263888888889, -7.314875096450617],
    [0.17303466796875, -1.27734375, -6.361572265625, 50.011935763888886, -73.55933973524306, -70.02633101851852, 271.3406605661651, -242.71375868055554, 72.41271847069508],
    [0.6608963012695312, -4.08935546875, -36.04327646891276, 229.6779296875, -150.64704827202692, -1115.023654513889, 2175.9328758333936, -176.7817041216564, -2817.564374455372, 2651.5545930587705, -757.6768784769387],
    [2.6311933994293213, -14.813423156738281, -194.76567316055298, 1116.295762125651, 214.74175742997065, -9500.200790405273, 12733.852428636434, 15619.117721871584, -43856.44219541648, 16041.189890575017, 30538.376827393702, -31457.433732481488, 8757.450232923149]
  ],
  [
    [0.02734375, -0.10145089285714286, -0.3828125, 1.6061921296296295, -1.7903645833333333, 0.6414448302469136],
    [-0.03076171875, 0.5066545758928571, 0.29326171875, -16.04466300843254, 56.15677445023148, -82.37282383294753, 56.160933883101855, -14.66940546231996],
    [-0.190338134765625, 1.8524126325334822, 7.9220947265625, -94.17471516927084, 221.09830050998264, 13.578712293836805, -765.0372254171489, 1204.5108913845486, -777.2272500874084, 187.66711848589946],
    [-0.8591651916503906, 6.969002314976284, 55.378133392333986, -495.0305846610902, 733.5599177042643, 2262.8678469622578, -7898.558874040768, 5695.140700031799, 7718.792330973433, -16089.784052072184, 10424.89664595804, -2413.3719004256172],
    [-3.946790099143982, 28.973631262779236, 345.9624051570892, -2698.264002605166, 1749.166319439676, 24230.291604531834, -57186.68270652559, -12268.269917924905, 179642.68522044024, -184075.59647969634, -55836.464134952716, 219854.46366368397, -146898.326284019, 33116.007471226345]
  ],
  [
    [-0.0205078125, 0.11354166666666667, 0.36983072916666665, -2.576388888888889, 4.6821108217592595, -3.560763888888889, 0.9919986175411523],
    [0.0281982421875, -0.58203125, 0.19236328125, 23.032335069444443, -110.33599717881944, 227.7450810185185, -243.01300676761832, 131.66775173611111, -28.734679254811812],
    [0.20619964599609375, -2.520263671875, -8.997949523925781, 159.65856119791667, -527.0220052761501, 337.2190755208333, 1618.7873626708983, -4211.0382245852625, 4434.1363497656885, -2259.276816285687, 458.84770992088926],
    [1.0739564895629883, -10.898971557617188, -78.3541690826416, 948.6580297851563, -2219.4645106141834, -3394.087506103516, 22215.58137123579, -30531.682191548916, -6945.09541692773, 63170.2367433357, -72433.4733597442, 36368.490166893054, -7090.98414263977],
    [5.591285973787308, -51.149418354034424, -562.3207324802876, 5740.379038238525, -8505.888519568523, -51098.161945523156, 189688.56368664134, -98986.67611350543, -524313.3332072016, 1006412.2572891519, -338656.53584266576, -879242.3031416284, 1184856.1356540793, -599009.5959319434, 113723.03789882673]
  ],
  [
    [0.01611328125, -0.1219695560515873, -0.33297526041666664, 3.7101836350859787, -9.712462625385802, 11.698143727494855, -6.8153513213734565, 1.5583573120284637],
    [-0.02618408203125, 0.653960697234623, -0.8638636997767857, -30.956497628348213, 194.5489077828759, -527.7434874304178, 780.7970272111304, -656.2967227888696, 295.2217849291892, -55.33492825703911],
    [-0.22092819213867188, 3.277611323765346, 9.300320979527065, -250.77115683984505, 1087.8174260457356, -1404.302891126091, -2563.9444452795965, 11622.495969086322, -17934.3441636147, 14479.313178892271, -6122.63974060247, 1074.0188194633058],
    [-1.3040900230407715, 16.02356831232707, 103.7233241308303, -1667.315650667463, 5406.656197744804, 2872.9832533515446, -52104.15788249263, 110439.4425121051, -46659.13728281303, -173333.53977304077, 339551.8623595128, -281181.85781749483, 116143.52270798283, -19586.90142650334],
    [-7.588173821568489, 83.79132223625977, 852.651491996646, -11106.11406304718, 25906.550896742894, 90628.03856082648, -518627.0052655401, 625235.1381343907, 1093177.6471805288, -3890056.269906493, 3443257.530483528, 1688397.8063561004, -6072278.753811017, 5368522.305391169, -2206353.997770455, 362368.2691728461]
  ],
  [
    [-0.013092041015625, 0.12801339285714286, 0.2764525204613095, -4.973877728174603, 17.501935105096727, -29.549479166666668, 26.907133829250256, -12.754267939814815, 2.477179842557763],
    [0.024547576904296875, -0.7229771205357143, 1.72462398710705, 39.54634114583333, -316.99617299397784, 1081.582459077381, -2074.4037171674995, 2398.8177766525205, -1664.7533222350237, 640.3728519643776, -105.19241070496638],
    [0.23473620414733887, -4.121603393554688, -8.529084409986224, 371.57630452473956, -2030.4431650042156, 3928.249814860026, 2472.6031768756443, -26784.70619288315, 57707.467479758205, -65779.37528455863, 43428.75542900036, -15731.92148300192, 2430.2098720207428],
    [1.5486069023609161, -22.48286247253418, -129.63729095714433, 2741.638566981724, -11510.430102675971, 3157.633145077418, 105738.58606273177, -320687.7822228627, 312110.0413375543, 306706.99777237116, -1199602.262675182, 1489876.75818079, -983301.0381246094, 346445.2252546859, -51524.795648340965],
    [9.959478140808642, -129.64064240455627, -1221.6473410353065, 19961.318612462794, -64135.37720635896, -132491.34865988838, 1231383.3446542423, -2354589.943537212, -1264272.3547066583, 11829877.236705665, -17640228.8499216, 3679036.5985685345, 21328290.4639577, -31765842.068457924, 21552604.86205348, -7505720.501322565, 1087467.9477654193]
  ],
  [
    [0.0109100341796875, -0.1324287403541554, -0.20350690569196428, 6.334938473979001, -28.6621148111118, 63.36748336442143, -79.92548561881108, 58.757341382271306, -23.521455678429625, 3.97431664548499],
    [-0.023183822631835938, 0.7894818277070017, -2.7769457196432445, -48.48351172505462, 486.2694474679452, -2023.8687997794445, 4819.5203340475455, -7173.845552154039, 6815.549754769387, -4029.148885996514, 1353.9765257894258, -197.95866455017787],
    [-0.24777710437774658, 5.0497246547178785, 6.375349464870634, -525.7776319562821, 3515.3901490500366, -9098.946585413438, 1501.449934117588, 52968.40256942741, -156962.17039552, 237710.55444046526, -217889.7609136776, 122183.02599420559, -38765.36676500369, 5352.021907283489],
    [-1.8067080527544022, 30.41315558507587, 153.62532423010893, -4275.681855774877, 22280.234407631844, -22294.3603921321, -188892.0765865273, 800265.5772968673, -1211192.8548070344, -77428.4081847135, 3343683.837970314, -6075462.155411939, 5742939.802563024, -3178262.5289756646, 978732.9806555888, -130276.59845140693],
    [-12.72599984658882, 191.72191139924425, 1668.3300609576206, -33822.37603736715, 139670.53397437636, 142413.44221576978, -2615894.948837068, 7028008.741102099, -1692308.6869349768, -29470781.81274997, 66963160.30704782, -48089009.18054011, -47220345.65200829, 138176622.72569343, -141477318.49446413, 78991076.06628808, -23950277.790642798, 3106959.7999206283]
  ]
]

// U_K[k]: Bessel uniform-asymptotic coefficient u_k(t) (DLMF 10.41,
// arXiv:1311.0681 Eq. 47), as a polynomial in t.
const U_K = [
  [1.0],
  [0, 0.125, 0, -0.20833333333333334],
  [0, 0, 0.0703125, 0, -0.4010416666666667, 0, 0.3342013888888889],
  [0, 0, 0, 0.0732421875, 0, -0.8912109375, 0, 1.8464626736111112, 0, -1.0258125964506173],
  [0, 0, 0, 0, 0.112152099609375, 0, -2.3640869140625, 0, 8.78912353515625, 0, -11.207002616222994, 0, 4.669584423426247],
  [0, 0, 0, 0, 0, 0.22710800170898438, 0, -7.368794359479632, 0, 42.53499874538846, 0, -91.81824154324002, 0, 84.63621767460073, 0, -28.212072558200244]
]
/* eslint-enable no-loss-of-precision */
// --- END GENERATED COEFFICIENTS ---

/**
 * Series expansion of the Marcum-Q function. Section 3 in https://arxiv.org/pdf/1311.0681.pdf.
 * Computes the primary (smaller) of P and Q directly so deep lower tails are
 * free of catastrophic cancellation (see #245), and derives the complement.
 *
 * @method _series
 * @memberof ran.special
 * @param {number} mu The order of the function.
 * @param {number} x First variable.
 * @param {number} y Second variable.
 * @return {Object} Object holding the Marcum P and Q values as `p` and `q`.
 * @private
 */
function _series (mu, x, y) {
  if (y > x + mu) {
    // q-regime: Q is the small primary, summed directly. Eqs. (7), (18).
    // ck = x^k / k!
    let ck = 1

    // qck = y^{mu + k - 1} e^{-y} / gamma(mu + k - 1)
    let qck = Math.exp((mu - 1) * Math.log(y) - y - logGamma(mu))

    // qk = Q_{mu + k}(y)
    let qk = gammaUpperIncomplete(mu, y)
    let dz = ck * qk
    let z = dz

    for (let k = 1; k < MAX_ITER; k++) {
      qck *= y / (mu + k - 1)
      qk += qck
      ck *= x / k
      dz = ck * qk
      z += dz
      if (dz / z < EPS) { break }
    }

    const q = Math.exp(-x) * z
    return { p: 1 - q, q }
  }

  // p-regime: P is the small primary, returned directly without forming 1 - Q.
  const p = _pSeriesComplement(mu, x, y)
  return { p, q: 1 - p }
}

// Returns `1 − Q_M` computed via the p-series of the Marcum-Q. Extracted
// so that marcumP can return this raw value directly without the
// subtraction-from-1 that catastrophically cancels in deep lower tails
// of distributions that are `1 − marcumQ(...)` (see #245).
function _pSeriesComplement (mu, x, y) {
  // Find truncation number using Eqs. (26) - (27)
  const c0 = mu + logGamma(mu) - Math.log(2 * Math.PI * EPS)
  const c1 = Math.log(x * y)
  const c2 = x * y
  let n = newton(
    t => (t + mu) * Math.log(t + mu) + t * Math.log(t) - 2 * t - t * c1 - c0,
    t => Math.log(t * (t + mu) / c2),
    0.5 * (Math.sqrt(mu * mu + 4 * x * y) - mu) + 1
  )
  n = Math.ceil(n)

  // Initialize terms with last index, Eq. (7)
  let ck = Math.exp(n * Math.log(x) - logGamma(n + 1))
  let pck = Math.exp((mu + n) * Math.log(y) - y - logGamma(mu + n + 1))
  let pk = gammaLowerIncomplete(mu + n, y)
  let dz = ck * pk
  let z = dz

  for (let k = n - 1; k >= 0; k--) {
    // Eq. (19)
    pck *= (mu + k + 1) / y
    pk += pck
    ck *= (k + 1) / x
    dz = ck * pk
    z += dz
  }

  return Math.exp(-x) * z
}

/**
 * Computes Phi_n = sigma^{n-1/2} Gamma(1/2 - n, sigma xi) via the Legendre
 * continued fraction for the incomplete gamma function. Used when sigma xi is
 * large, where the forward recurrence (Eq. 36) is unstable because Phi_n is
 * its recessive solution.
 *
 * @method _phi
 * @memberof ran.special
 * @param {number} n Index of the Phi function.
 * @param {number} sigma Scale variable.
 * @param {number} xi Scale variable.
 * @return {number} The value of Phi_n.
 * @private
 */
function _phi (n, sigma, xi) {
  const a = 0.5 - n
  const z = sigma * xi
  let b = z + 1 - a
  let c = 1 / DELTA
  let d = 1 / b
  let cf = d
  for (let i = 1; i < MAX_ITER; i++) {
    const ai = -i * (i - a)
    b += 2
    d = ai * d + b
    if (Math.abs(d) < DELTA) { d = DELTA }
    c = b + ai / c
    if (Math.abs(c) < DELTA) { c = DELTA }
    d = 1 / d
    const delta = c * d
    cf *= delta
    if (Math.abs(delta - 1) < EPS) { break }
  }
  return Math.exp(-z) * Math.pow(xi, 0.5 - n) * cf
}

/**
 * Raw asymptotic-series sum for the Marcum function in the large-xi regime.
 * Section 4.1 in https://arxiv.org/pdf/1311.0681.pdf. Sums the Q-series
 * (Eqs. 37-38) when `complementary` is false and the P-series (Eqs. 39-40)
 * when it is true.
 *
 * @method _aelx
 * @memberof ran.special
 * @param {number} mu The order of the function.
 * @param {number} x First variable.
 * @param {number} y Second variable.
 * @param {boolean} complementary Whether to sum the P-series instead of the Q-series.
 * @return {number} The asymptotic-series value.
 * @private
 */
function _aelx (mu, x, y, complementary) {
  const xi = 2 * Math.sqrt(x * y)
  const sigma = Math.pow(Math.sqrt(y) - Math.sqrt(x), 2) / xi
  const sx = sigma * xi
  const rho = Math.sqrt(y / x)

  // Forward recurrence of Phi_n (Eq. 36) amplifies its recessive component by
  // ~e^{sigma xi}, so it is only safe for small sigma xi; otherwise each Phi_n
  // is evaluated independently by continued fraction.
  // See solutions/special-functions/2026-05-21-0724-marcum-q-four-branches.md
  const useCF = sx >= 5

  // A_n(mu), A_n(mu - 1): ratio A_n / A_{n-1} = (mu^2 - (n - 1/2)^2) / (2n). Eq. (32).
  let am = 1
  let am1 = 1

  // phic = e^{-sigma xi} xi^{1/2 - n}; phi = Phi_n. Eqs. (34)-(36). At sigma = 0
  // (x = y) Phi_0 diverges, but every term that uses it carries a 0 factor, so
  // any finite placeholder is safe.
  let phic = Math.exp(-sx) * Math.sqrt(xi)
  let phi = useCF
    ? _phi(0, sigma, xi)
    : (sigma === 0 ? 0 : Math.sqrt(Math.PI / sigma) * erfc(Math.sqrt(sx)))

  // psic = (-1)^n rho^mu / (2 sqrt(2 pi)).
  let psic = 0.5 * Math.pow(rho, mu) / Math.sqrt(2 * Math.PI)

  // Leading term: Psi_0 (Eq. 38) or Psi-tilde_0 (Eq. 40).
  let z = complementary
    ? 0.5 * Math.pow(rho, mu - 0.5) * erfc(Math.sqrt(x) - Math.sqrt(y))
    : psic * (am1 - am / rho) * phi

  let prevAbs = Infinity
  for (let n = 1; n < MAX_ITER; n++) {
    am *= (mu * mu - (n - 0.5) * (n - 0.5)) / (2 * n)
    am1 *= ((mu - 1) * (mu - 1) - (n - 0.5) * (n - 0.5)) / (2 * n)

    if (useCF) {
      phi = _phi(n, sigma, xi)
    } else {
      phic /= xi
      phi = (phic - sigma * phi) / (n - 0.5)
    }

    psic *= -1

    // Psi-tilde_n = -Psi_n for n >= 1 (Eq. 39).
    const term = (complementary ? -1 : 1) * psic * (am1 - am / rho) * phi
    z += term

    // Truncate only after two consecutive negligible terms: the factor
    // (A_n(mu-1) - A_n(mu)/rho) crosses zero once, making a single mid-series
    // term spuriously small.
    const tol = Math.abs(z) * EPS
    const absTerm = Math.abs(term)
    if (absTerm < tol && prevAbs < tol) { break }
    prevAbs = absTerm
  }

  return z
}

/**
 * Asymptotic expansion of the Marcum function for large xi. Section 4.1 in
 * https://arxiv.org/pdf/1311.0681.pdf. The Q-series is used for y > x and the
 * P-series for y <= x (the sigma = 0 transition), each computing its tail
 * directly so the complement never amplifies a small value.
 *
 * @method _asymptoticLargeXi
 * @memberof ran.special
 * @param {number} mu The order of the function.
 * @param {number} x First variable.
 * @param {number} y Second variable.
 * @return {Object} Object holding the Marcum P and Q values as `p` and `q`.
 * @private
 */
function _asymptoticLargeXi (mu, x, y) {
  if (y > x) {
    const q = _aelx(mu, x, y, false)
    return { p: 1 - q, q }
  }
  const p = _aelx(mu, x, y, true)
  return { p, q: 1 - p }
}

/**
 * Computes log(1 + u) - u without the cancellation that the direct
 * subtraction suffers for small u.
 *
 * @method _log1pmx
 * @memberof ran.special
 * @param {number} u Argument.
 * @return {number} log(1 + u) - u.
 * @private
 */
function _log1pmx (u) {
  if (u === 0) {
    return 0
  }
  if (Math.abs(u) > 0.5) {
    return Math.log1p(u) - u
  }
  let p = u
  let sum = 0
  for (let k = 2; k < MAX_ITER; k++) {
    p *= u
    const d = (k % 2 === 0 ? -1 : 1) * p / k
    sum += d
    if (Math.abs(d) < Math.abs(sum) * EPS) { break }
  }
  return sum
}

/**
 * Computes the saddle-point variable zeta of the quadrature representation,
 * Eqs. (56), (84) in https://arxiv.org/pdf/1311.0681.pdf, in scaled variables.
 * The half-square is assembled so every term is O((xs - ys + 1)^2), avoiding
 * the cancellation of the raw formula near the transition line ys = xs + 1.
 *
 * @method _zetaxy
 * @memberof ran.special
 * @param {number} xs Scaled first variable x / mu.
 * @param {number} ys Scaled second variable y / mu.
 * @return {number} The value of zeta.
 * @private
 */
function _zetaxy (xs, ys) {
  const w = Math.sqrt(1 + 4 * xs * ys)
  const eps = xs - ys + 1
  const d1 = xs + ys + w
  const d2 = w + 2 * ys - 1
  const halfZetaSq = eps * eps / d1 + 2 * eps * eps / (d1 * d2) + _log1pmx(2 * eps / d2)
  return Math.sign(eps) * Math.sqrt(2 * Math.max(halfZetaSq, 0))
}

/**
 * Quadrature method for the Marcum function. Section 5 in
 * https://arxiv.org/pdf/1311.0681.pdf. Evaluates the trapezoidal integral
 * representation (Eq. 95) and returns both tails, computing the
 * directly-evaluated one without subtraction.
 *
 * @method _pqTrap
 * @memberof ran.special
 * @param {number} mu The order of the function.
 * @param {number} x First variable.
 * @param {number} y Second variable.
 * @return {Object} Object holding the Marcum P and Q values as `p` and `q`.
 * @private
 */
function _pqTrap (mu, x, y) {
  const xs = x / mu
  const ys = y / mu
  const xis2 = 4 * xs * ys
  const wxis = Math.sqrt(1 + xis2)

  // Integrand e^{mu psi(theta)} f(theta) of Eq. (95); even in theta.
  const integrand = theta => {
    const s = Math.sin(theta)
    const cs = Math.cos(theta)
    const g = theta === 0 ? 1 : theta / s
    const rho = Math.sqrt(g * g + xis2)
    const r = (g + rho) / (2 * ys)
    // sin(theta) - theta cos(theta); series below 0.1 where it cancels.
    const t2 = theta * theta
    const smt = Math.abs(theta) < 0.1
      ? theta * t2 * (1 / 3 - t2 / 30 + t2 * t2 / 840)
      : s - theta * cs
    const gp = theta === 0 ? 0 : smt / (s * s)
    const rp = gp * (1 + g / rho) / (2 * ys)
    const psi = cs * rho - wxis - Math.log((g + rho) / (1 + wxis))
    const f = (s * rp + (cs - r) * r) / (r * r - 2 * r * cs + 1)
    return f * Math.exp(mu * psi)
  }

  const zeta = _zetaxy(xs, ys)
  const halfMuZeta2 = 0.5 * mu * zeta * zeta

  // The primary tail underflows: e^{-mu zeta^2 / 2} is below the safe range.
  if (-halfMuZeta2 < Math.log(DELTA)) {
    return y > x + mu ? { p: 1, q: 0 } : { p: 0, q: 1 }
  }

  // The integrand is a peak at theta = 0 of width ~1/sqrt(mu wxis) (since
  // psi''(0) = -wxis); integrate only over its support so the node count
  // stays bounded regardless of mu.
  const b = Math.min(Math.PI, 14 / Math.sqrt(mu * wxis))

  // Q = e^{-mu zeta^2/2} / (2 pi) * integral over [-pi, pi]; integrand is even.
  const pq = trap(integrand, 0, b) * Math.exp(-halfMuZeta2) / Math.PI
  return zeta < 0
    ? { q: pq, p: 1 - pq }
    : { q: 1 + pq, p: -pq }
}

/**
 * Computes the ratio I_nu(z) / I_{nu-1}(z) of modified Bessel functions of the
 * first kind via a continued fraction (modified Lentz). Valid for fractional
 * order, free of overflow because dominant factors cancel in the ratio.
 *
 * @method _fc
 * @memberof ran.special
 * @param {number} nu Order of the Bessel function in the numerator.
 * @param {number} z Argument.
 * @return {number} The ratio I_nu(z) / I_{nu-1}(z).
 * @private
 */
function _fc (nu, z) {
  let m = 0
  let b = 2 * nu / z
  let f = DELTA
  let c = f
  let d = 0
  let delta
  do {
    d = b + d
    if (Math.abs(d) < DELTA) { d = DELTA }
    c = b + 1 / c
    if (Math.abs(c) < DELTA) { c = DELTA }
    d = 1 / d
    delta = c * d
    f *= delta
    m++
    b = 2 * (nu + m) / z
  } while (Math.abs(delta - 1) > EPS && m < MAX_ITER)
  return f
}

/**
 * Recurrence-relation method for the Marcum function. The three-term
 * recurrence Eq. (14) in https://arxiv.org/pdf/1311.0681.pdf is solved
 * backward for its minimal solution P, seeded by the quadrature method at
 * orders raised above the transition band.
 *
 * @method _recurrence
 * @memberof ran.special
 * @param {number} mu The order of the function.
 * @param {number} x First variable.
 * @param {number} y Second variable.
 * @return {Object} Object holding the Marcum P and Q values as `p` and `q`.
 * @private
 */
function _recurrence (mu, x, y) {
  // Raise the starting order so the quadrature seeds fall below the
  // transition band, where quadrature is accurate.
  const nu = y - x + 1 + Math.sqrt(2 * (x + y) + 1)
  const n3 = Math.max(1, Math.floor(nu) + 2 - Math.floor(mu))
  const mur = mu + n3
  const xi = 2 * Math.sqrt(x * y)

  let cmu = Math.sqrt(y / x) * _fc(mur, xi)
  let p1 = _pqTrap(mur + 1, x, y).p
  let p0 = _pqTrap(mur, x, y).p
  let z = p0
  for (let n = 0; n < n3; n++) {
    z = ((1 + cmu) * p0 - p1) / cmu
    p1 = p0
    p0 = z
    cmu = y / (mur - n - 1 + x * cmu)
  }

  return { p: z, q: 1 - z }
}

/**
 * Computes the modified-Bessel correction term
 * T = e^{-mu zeta^2/2} e^{-mu eta(xi)} I_mu(mu xi) of the large-mu expansion,
 * Eqs. (73), (75), (80) in https://arxiv.org/pdf/1311.0681.pdf. The scaled
 * Bessel factor e^{-mu eta(xi)} I_mu(mu xi) is evaluated through its uniform
 * asymptotic expansion (Eq. 45), so no overflow-prone I_mu call is needed.
 *
 * @method _besselT
 * @memberof ran.special
 * @param {number} mu The order of the function.
 * @param {number} xs Scaled first variable x / mu.
 * @param {number} ys Scaled second variable y / mu.
 * @param {number} eHalfMuZeta2 The pre-computed factor e^{-mu zeta^2 / 2}.
 * @return {number} The correction term T.
 * @private
 */
function _besselT (mu, xs, ys, eHalfMuZeta2) {
  const xi2 = 4 * xs * ys
  const t = 1 / Math.sqrt(1 + xi2)

  // sum_k u_k(t) / mu^k, Horner in 1/mu with an inner Horner in t.
  let s = 0
  for (let k = U_K.length - 1; k >= 0; k--) {
    const c = U_K[k]
    let uk = 0
    for (let m = c.length - 1; m >= 0; m--) {
      uk = uk * t + c[m]
    }
    s = s / mu + uk
  }

  const scaled = s / (Math.sqrt(2 * Math.PI * mu) * Math.sqrt(Math.sqrt(1 + xi2)))
  return eHalfMuZeta2 * scaled
}

/**
 * Large-mu uniform asymptotic expansion of the Marcum function. Section 4.2 in
 * https://arxiv.org/pdf/1311.0681.pdf. Evaluates the transition band y ~ x + mu
 * directly when mu >= 135, where backward recurrence would take O(mu) steps.
 * The smaller of P and Q is summed from its own expansion (Eq. 75 for Q,
 * Eq. 80 for P), so the deep-tail precision guarantee is preserved.
 *
 * @method _largeMu
 * @memberof ran.special
 * @param {number} mu The order of the function.
 * @param {number} x First variable.
 * @param {number} y Second variable.
 * @return {Object} Object holding the Marcum P and Q values as `p` and `q`.
 * @private
 */
function _largeMu (mu, x, y) {
  const xs = x / mu
  const ys = y / mu
  const u = 1 / Math.sqrt(2 * xs + 1)
  const u2 = u * u
  const zeta = _zetaxy(xs, ys)

  // Q is the smaller tail above the transition line (zeta < 0), P below it.
  // The primary expansion is the one whose erfc leading term is that small
  // tail: it uses eta = zeta for Q and eta = -zeta for P (so -eta > 0).
  const qPrimary = zeta < 0
  const eta = qPrimary ? zeta : -zeta
  const eHalfMuZeta2 = Math.exp(-0.5 * mu * zeta * zeta)

  // Psi_j(eta), Eqs. (67)-(68).
  const jMax = F_JK.length - 1
  const psi = [
    Math.sqrt(Math.PI / (2 * mu)) * erfc(-eta * Math.sqrt(mu / 2)),
    eHalfMuZeta2 / mu
  ]
  // etaPow carries (-eta)^(j-1) across the loop, avoiding a Math.pow per term.
  let etaPow = -eta
  for (let j = 2; j <= jMax; j++) {
    psi[j] = ((j - 1) * psi[j - 2] + etaPow * eHalfMuZeta2) / mu
    etaPow *= -eta
  }

  // Expansion = sqrt(mu/2pi) sum_j A_j Psi_j with A_j = sum_k f_{jk}/mu^k and
  // f_{jk}(u) = u^(j+2k) D_{jk}(u^2). The P-expansion (Eq. 79) flips the sign
  // of the odd-j terms.
  const r = u2 / mu
  let sum = 0
  let uj = 1
  for (let j = 0; j <= jMax; j++) {
    const col = F_JK[j]
    let aj = 0
    for (let k = col.length - 1; k >= 0; k--) {
      const d = col[k]
      let djk = 0
      for (let m = d.length - 1; m >= 0; m--) {
        djk = djk * u2 + d[m]
      }
      aj = aj * r + djk
    }
    aj *= uj
    uj *= u
    sum += (qPrimary || j % 2 === 0 ? aj : -aj) * psi[j]
  }
  const expansion = Math.sqrt(mu / (2 * Math.PI)) * sum

  // Q_mu = Q_{mu+1} - T (Eq. 75); P_mu = P_{mu+1} + T (Eq. 80).
  const tTerm = _besselT(mu, xs, ys, eHalfMuZeta2)
  const primary = qPrimary ? expansion - tTerm : expansion + tTerm
  return qPrimary
    ? { q: primary, p: 1 - primary }
    : { p: primary, q: 1 - primary }
}

/**
 * Dispatches the Marcum function computation to the numerical method valid for
 * the (mu, x, y) regime and returns both the P and Q values.
 *
 * @method _marcum
 * @memberof ran.special
 * @param {number} mu The order of the function.
 * @param {number} x First variable.
 * @param {number} y Second variable.
 * @return {Object} Object holding the Marcum P and Q values as `p` and `q`.
 * @private
 */
function _marcum (mu, x, y) {
  // Special cases.
  if (y === 0) {
    return { p: 0, q: 1 }
  }
  if (x === 0) {
    return { p: gammaLowerIncomplete(mu, y), q: gammaUpperIncomplete(mu, y) }
  }

  // Series expansion. Section 3.
  if (x < 30) {
    return _series(mu, x, y)
  }

  // Asymptotic expansion for large xi. Section 4.1.
  const xi = 2 * Math.sqrt(x * y)
  if (xi > 30 && mu * mu < 2 * xi) {
    return _asymptoticLargeXi(mu, x, y)
  }

  // Transition band y = x + mu, where the quadrature integrand is near-
  // singular. Below mu = 135 the three-term recurrence (Eq. 14) solves the
  // band; at mu >= 135 the large-mu uniform asymptotic expansion (Section 4.2)
  // evaluates it directly, avoiding the O(mu) recurrence steps.
  const s = Math.sqrt(4 * x + 2 * mu)
  if (y > x + mu - s && y < x + mu + s) {
    return mu >= 135 ? _largeMu(mu, x, y) : _recurrence(mu, x, y)
  }

  // Quadrature. Section 5.
  return _pqTrap(mu, x, y)
}

/**
 * Computes the generalized Marcum-Q function. The dispatcher selects, by the
 * (mu, x, y) regime, the series expansion (Section 3), the large-xi asymptotic
 * expansion (Section 4.1), the recurrence relation (Eq. 14, transition band
 * with mu < 135), the large-mu asymptotic expansion (Section 4.2, transition
 * band with mu >= 135) or the quadrature method (Section 5). Implementation
 * source: https://arxiv.org/pdf/1311.0681.pdf.
 *
 * @method marcumQ
 * @memberof ran.special
 * @param {number} mu The order of the function.
 * @param {number} x First variable.
 * @param {number} y Second variable.
 * @return {number} The generalized Marcum-Q function at the specified values.
 * @private
 */
export default function (mu, x, y) {
  return _marcum(mu, x, y).q
}

/**
 * Computes the complementary generalized Marcum function P_M = 1 − Q_M without
 * forming the subtraction `1 - marcumQ(...)`. Use this in place of
 * `1 - marcumQ(...)` whenever the result is expected to be small (e.g. the
 * lower-tail CDF of noncentral chi-squared family distributions): each
 * computation branch evaluates the smaller of P and Q directly, so the deep
 * lower tail never loses precision to catastrophic cancellation (see #245).
 *
 * @method marcumP
 * @memberof ran.special
 * @param {number} mu The order of the function.
 * @param {number} x First variable.
 * @param {number} y Second variable.
 * @return {number} The complementary Marcum function 1 − Q_M.
 * @private
 */
export function marcumP (mu, x, y) {
  return _marcum(mu, x, y).p
}
