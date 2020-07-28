import { assert } from 'chai'
import { describe, it } from 'mocha'
import { repeat, equal } from './test-utils'
import * as dependence from '../src/dependence'

describe('dependence', () => {
  describe('.kendall()', () => {
    it('should return undefined if any array is empty', () => {
      assert(typeof dependence.kendall([], [1, 2, 3]) === 'undefined')
      assert(typeof dependence.kendall([1, 2, 3], []) === 'undefined')
      console.log(dependence.kendall([1, 2, 3], [1, 4, 2]))
    })

    it('should return undefined if arrays have different length', () => {
      assert(typeof dependence.kendall([1, 2, 3], [4, 5]) === 'undefined')
    })

    it(`should return Kendall's tau of two arrays`, () => {
      const x = [
        5, 37, 15, 0, 30, 32, 34, 23, 23, 27, 28, 22, 28, 46, 26, 13, 24, 15, 20, 40, 33, 25, 24, 22, 28, 48, 9, 0, 40,
        3, 47, 23, 31, 9, 38, 24, 31, 21, 10, 8, 42, 22, 12, 41, 44, 30, 31, 5, 36, 3, 10, 31, 33, 23, 12, 34, 14, 27,
        23, 31, 32, 47, 12, 35, 20, 25, 23, 2, 38, 5, 25, 49, 22, 20, 9, 2, 7, 44, 8, 49, 9, 1, 2, 24, 46, 9, 43, 45,
        29, 12, 35, 30, 19, 26, 4, 5, 20, 1, 28, 27
      ]
      const y = [
        10.0479143195, 55.2441245469, 26.7499788261, -1.77062808091, 8.77034735836, 49.8552388058, 28.7678115109,
        30.9400675749, 33.3283052223, 29.465433508, 35.0171704788, 14.857899344, 11.4125901998, 40.9965108811,
        30.1809213747, -8.34511644806, 11.249397731, 16.0649696061, 14.1778158564, 36.042413945, 40.60588735,
        35.5713988219, 33.2184220961, 20.6629966099, 39.2126025278, 42.3261066245, 8.42068344278, -2.93991452487,
        34.1420483367, 6.44463504303, 57.2303927244, 18.1962699523, 22.7785325334, 25.6008917088, 34.1034682968,
        16.4223462356, 27.8999644691, 20.6672386355, 22.0853130688, 1.76384338277, 39.1192303813, 14.0598605115,
        24.7590463951, 37.3090905406, 25.9666743323, 29.4326236497, 10.7423365617, 8.90611209699, 50.4482585876,
        -1.84375839308, 7.42395498716, 17.1990134219, 43.6083931647, 30.5234959736, 26.2663057373, 48.3940454021,
        24.2163885459, 24.4692405074, 20.919291353, 34.6453936208, 48.3399623111, 39.9580782193, -9.57962014226,
        58.5245366378, 20.7953531186, 3.60473661764, 28.2891679564, 20.2026553303, 44.3949957053, 10.0648764414,
        47.4620833452, 45.8601124894, 31.2729815525, 20.0269115082, -1.71852577566, 9.79498085352, 11.9100482581,
        42.5781034061, 27.1585956756, 62.9072211687, 22.5744516787, 17.8271455025, -8.56681422877, 29.3345285211,
        33.4465723345, 6.18297199299, 47.7039370497, 34.7670063682, 40.8037933983, 6.93329629319, 36.5346125706,
        38.3130721814, 23.1786533558, 25.4795604867, 2.72837837995, -3.37318035817, 14.917687646, 7.81354760219,
        29.9797987729, 35.6813568491
      ]
      const kendall = 0.5926839181251029
      assert(equal(dependence.kendall(x, y), kendall))
    })
  })

  describe('.pearson()', () => {
    it('should return undefined if any array is empty', () => {
      assert(typeof dependence.pearson([], [1, 2, 3]) === 'undefined')
      assert(typeof dependence.pearson([1, 2, 3], []) === 'undefined')
    })

    it('should return undefined if arrays have different length', () => {
      assert(typeof dependence.pearson([1, 2, 3], [4, 5]) === 'undefined')
    })

    it('should return the Pearson correlation of two arrays', () => {
      const x = [
        46, 38, 22, 4, 21, 5, 7, 39, 12, 39, 45, 17, 28, 41, 47, 2, 21, 40, 45, 7, 7, 2, 40, 11, 17, 19, 6, 21, 18, 17,
        18, 28, 7, 9, 10, 21, 5, 37, 15, 11, 43, 35, 45, 17, 31, 4, 40, 25, 28, 11, 27, 11, 0, 4, 10, 17, 30, 17, 43,
        40, 6, 47, 33, 15, 1, 37, 35, 46, 38, 2, 6, 28, 6, 43, 14, 3, 17, 49, 28, 27, 20, 14, 11, 40, 18, 37, 43, 27,
        16, 30, 19, 18, 17, 25, 27, 39, 42, 3, 33, 18
      ]
      const y = [
        36.832356648, 33.8947899026, 24.570992213, 0.951252776947, 28.8801451633, 8.78328072989, 13.3198716516,
        32.8804461581, 7.70815554381, 30.6022307896, 35.3938303801, 16.1479098742, 28.5563895506, 31.9903651724,
        44.6700576631, 3.68478403098, 25.0276754092, 53.4022693309, 42.75447543, 21.5480247821, -2.23119730452,
        -5.55847643401, 33.1478923838, -1.86043246506, 22.230831576, 3.42680362107, 5.86004969921, 28.6632874651,
        15.7735351245, 26.8286956447, 33.1514890847, 54.3167193629, -9.18376144847, 2.53609144882, 2.65948486775,
        12.2594041526, 18.9427822765, 35.7081152242, 19.6344415946, 0.421257576256, 46.876192245, 39.2387947214,
        39.8680444925, 15.5703059484, 39.5941811535, 8.6408051583, 34.2674695277, 38.3890809723, 44.539776051,
        7.07917306498, 52.3947670826, 6.62618712393, 6.57018381326, -13.5381455587, 15.1249241717, 18.8546616285,
        36.9740755263, 5.62662347058, 40.7687467513, 45.6806251142, 2.2175037654, 45.3441586192, 35.41664804,
        17.2969619949, -7.99782832868, 28.9742319918, 38.0144356616, 51.033408035, 48.4996906902, -17.7499965423,
        8.14296516073, 36.9371365637, 4.34699609066, 39.5892402268, 30.9661162085, 11.4508658037, 23.7957611293,
        74.1432593289, 32.475311307, 26.2425282652, 38.4427803909, 13.657574059, 18.6613075743, 42.8440398169,
        29.2984588662, 46.3476609998, 43.8778609003, 25.8470542126, -0.983868787379, 37.2534590428, 12.1029542462,
        18.9244592914, 17.0463462178, 20.6894785024, 39.8000437118, 20.5165656093, 23.3993594261, 17.3311015928,
        46.2038085366, 25.988586151
      ]
      const pearson = 0.83149890691945472
      assert(equal(dependence.pearson(x, y), pearson))
    })
  })

  describe('.spearman()', () => {
    it('should return undefined if any array is empty', () => {
      assert(typeof dependence.spearman([], [1, 2, 3]) === 'undefined')
      assert(typeof dependence.spearman([1, 2, 3], []) === 'undefined')
    })

    it('should return undefined if arrays have different length', () => {
      assert(typeof dependence.spearman([1, 2, 3], [4, 5]) === 'undefined')
    })

    it(`should return Spearman's rank correlation of two arrays`, () => {
      const x = [30, 7, 20, 27, 3, 2, 32, 46, 45, 35, 14, 0, 34, 22, 37, 22, 5, 23, 19, 39, 15, 17, 10, 23, 10, 27, 9,
        37, 19, 46, 11, 22, 28, 21, 44, 31, 8, 21, 8, 26, 6, 6, 33, 4, 1, 12, 25, 19, 42, 2, 29, 33, 41, 49, 25, 43, 24,
        1, 5, 17, 32, 42, 29, 26, 48, 10, 31, 41, 1, 19, 24, 10, 26, 21, 44, 9, 26, 24, 49, 47, 17, 9, 32, 33, 25, 4,
        13, 3, 10, 16, 12, 36, 25, 1, 33, 8, 45, 3, 2, 27
      ]
      const y = [50.8298922561, 27.3444276903, -2.45940944922, 21.0711113696, 11.6212263747, -3.7377245505,
        28.5215577521, 37.349432572, 40.2781323021, 50.4511005116, 16.048419129, -6.9189946993, 37.460908483,
        17.33712631, 28.434956608, 28.4885161681, -0.983932571728, 17.5260317571, 24.590228258, 56.6554882872,
        11.3179471732, 27.4786552756, 13.8966671566, 6.55722829361, 5.38639107109, 39.5542527427, 9.24580176785,
        37.0513807468, 13.8047938721, 48.3565776512, 12.8062373248, 29.2148079413, 26.3415807938, 23.1644005006,
        48.0389788887, 36.2317019197, 8.6680240843, 20.3250117326, 4.63722715617, 40.2251073609, -1.50107854771,
        19.5602187541, 18.3575141664, 6.89040074315, -4.66593500348, 6.25962858093, 3.23647995619, 23.2447800103,
        62.4828899137, 5.30290188749, 24.9302169921, 35.6076446335, 54.0258243958, 47.3659026602, 25.2468572117,
        36.0094454725, 24.8631177427, -4.91647917853, -10.3393871459, 4.66079891396, 38.2278916345, 65.0924827869,
        24.8462547258, 18.543305994, 62.5879483724, 17.1711949032, 39.2183585197, 40.7935382473, 7.98045045284,
        15.0808139921, 36.4493093409, 14.822687214, 21.5544333351, 30.7643322402, 35.8180258041, 2.02208960481,
        8.67932384242, 19.9374617881, 49.6588158634, 33.8954139479, 24.180657315, 12.0695056871, 24.7946863708,
        36.6286208621, 15.2307157534, -7.10969852291, 4.21754505478, 7.0405869353, 9.74144937792, -4.19702256425,
        10.6523010328, 48.4384925893, 12.0968623412, 10.6206898351, 49.7619994944, 25.6531836083, 37.115764526,
        12.7279797363, -7.49966399967, 21.8226617586
      ]
      const spearman = 0.83504820055660411
      assert(equal(dependence.spearman(x, y), spearman))
    })
  })
})