/**
 * Module for generating various random numbers.
 * @module ran
 */
// TODO add rademacher https://en.wikipedia.org/wiki/Rademacher_distribution
// TODO add beta binomial https://en.wikipedia.org/wiki/Beta-binomial_distribution
// TODO add hypergeometric https://en.wikipedia.org/wiki/Hypergeometric_distribution
// TODO add poisson binomial https://en.wikipedia.org/wiki/Poisson_binomial_distribution
(function (global, factory) {
    if (typeof exports === "object" && typeof module !== "undefined") {
        factory(exports);
    } else if (typeof define === 'function' && define['amd']) {
        define(['exports'], factory);
    } else {
        factory((global.ran = global['ran'] || {}));
    }
} (this, (function (exports) {
    "use strict";

    function _sum(arr, pow) {
        if (pow && pow !== 1) {
            return arr.reduce(function (sum, d) {
                return sum + Math.pow(d, pow);
            }, 0);
        } else {
            return arr.reduce(function (sum, d) {
                return sum + d;
            }, 0);
        }
    }

    /**
     * The main random number generator.
     * If min > max, a random number in (max, min) is generated.
     *
     * @method _r
     * @methodOf ran
     * @param {number} min Lower boundary.
     * @param {number} max Upper boundary.
     * @returns {number} Random number.
     * @private
     */
    function _r(min, max) {
        return min < max ? Math.random() * (max - min) + min : Math.random() * (min - max) + max;
    }

    /**
     * Runs a generator once or several times to return a single value or an array of values.
     *
     * @method _some
     * @methodOf ran
     * @param {function} generator Random generator to use.
     * @param {number=} k Number of values to generate.
     * @returns {(number|string|Array)} Single value or array of generated values.
     * @private
     */
    function _some(generator, k) {
        if (k === null || k === undefined || k < 2)
            return generator();
        else {
            var values = new Array(k);
            for (var i = 0; i < k; i++)
                values[i] = generator();
            return values;
        }
    }

    /**
     * Module containing some special functions.
     *
     * @namespace special
     * @memberOf ran
     * @private
     */
    var special = (function () {
        /**
         * Maximum number of iterations in function approximations.
         *
         * @var {number} _MAX_ITER
         * @memberOf ran.special
         * @private
         */
        var _MAX_ITER = 100;

        /**
         * Error tolerance in function approximations.
         *
         * @var {number} _EPSILON
         * @memberOf ran.special
         * @private
         */
        var _EPSILON = 1e-10;

        /**
         * Gamma function, using the Lanczos approximation.
         *
         * @method gamma
         * @methodOf ran.special
         * @param {number} z Value to evaluate Gamma function at.
         * @returns {number} Gamma function value.
         * @private
         */
        var gamma = (function () {
            // Coefficients
            var _p = [
                676.5203681218851,
                -1259.1392167224028,
                771.32342877765313,
                -176.61502916214059,
                12.507343278686905,
                -0.13857109526572012,
                9.9843695780195716e-6,
                1.5056327351493116e-7
            ];

            // Lanczos approximation
            function _gamma(z) {
                var y = 0;
                if (z < 0.5) {
                    y = Math.PI / (Math.sin(Math.PI * z) * _gamma(1 - z));
                } else {
                    z--;
                    var x = 0.99999999999980993,
                        l = _p.length;
                    _p.forEach(function (p, i) {
                        x += p / (z + i + 1);
                        var t = z + l - 0.5;
                        y = Math.sqrt(2 * Math.PI) * Math.pow(t, (z + 0.5)) * Math.exp(-t) * x;
                    });
                }
                return y;
            }

            return _gamma;
        })();

        /**
         * Logarithm of the gamma function.
         *
         * @method gammaLn
         * @methodOf ran.special
         * @param {number} z Value to evaluate log(gamma) at.
         * @returns {number} The log(gamma) value.
         * @private
         */
        // TODO add incomplete beta
        // TODO where log(gamma) is needed, use this instead of gamma
        var gammaLn = (function() {
            var _p = [
                76.18009172947146,
                -86.50532032941677,
                24.01409824083091,
                -1.231739572450155,
                .1208650973866179e-2,
                -.5395239384953e-5
            ];

            return function(z) {
                var x = z,
                    y = z,
                    tmp = x + 5.5;
                tmp = (x + 0.5) * Math.log(tmp) - tmp;
                var ser = 1.000000000190015;
                for (var j = 0; j < 6; j++) {
                    y++;
                    ser += _p[j] / y;
                }
                return tmp + Math.log(2.5066282746310005 * ser / x);
            };
        })();

        /**
         * Lower incomplete gamma function, using the series expansion and continued fraction approximations.
         *
         * @method gammaLowerIncomplete
         * @methodOf ran.special
         * @param {number} s Parameter of the integrand in the integral definition.
         * @param {number} x Lower boundary of the integral.
         * @returns {number} Value of the lower incomplete gamma function.
         * @private
         */
        var gammaLowerIncomplete = (function () {
            var _DELTA = 1e-30;

            // Lower incomplete gamma generator using the series expansion
            function _gliSeries(s, x) {
                if (x < 0) {
                    return 0;
                } else {
                    var si = s,
                        y = 1 / s,
                        f = 1 / s;
                    for (var i = 0; i < _MAX_ITER; i++) {
                        si++;
                        y *= x / si;
                        f += y;
                        if (y < f * _EPSILON)
                            break;
                    }
                    return Math.exp(-x) * Math.pow(x, s) * f;
                }
            }

            // Upper incomplete gamma generator using the continued fraction expansion
            function _guiContinuedFraction(s, x) {
                var b = x + 1 - s,
                    c = 1 / _DELTA,
                    d = 1 / b,
                    f = d,
                    fi, y;
                for (var i = 1; i < _MAX_ITER; i++) {
                    fi = i * (s - i);
                    b += 2;
                    d = fi * d + b;
                    if (Math.abs(d) < _DELTA)
                        d = _DELTA;
                    d = 1 / d;
                    c = b + fi / c;
                    if (Math.abs(c) < _DELTA)
                        c = _DELTA;
                    y = c * d;
                    f *= y;
                    if (Math.abs(y - 1) < _EPSILON)
                        break;
                }
                return Math.exp(-x) * Math.pow(x, s) * f;
            }

            return function (s, x) {
                if (x < s + 1)
                    return _gliSeries(s, x);
                else
                    return gamma(s) - _guiContinuedFraction(s, x);
            };
        })();

        /**
         * Incomplete beta function, using the continued fraction approximations.
         *
         * @method betaIncomplete
         * @methodOf ran.special
         * @param {number} a First parameter of the function.
         * @param {number} b Second parameter of the function.
         * @param {number} x Lower boundary of the integral.
         * @returns {number} Value of the incomplete beta function.
         * @private
         */
        var betaIncomplete = (function() {
            var _FPMIN = 1e-30;

            // Incomplete beta generator using the continued fraction expansion
            function _biContinuedFraction(a, b, x) {
                var qab = a + b,
                    qap = a + 1,
                    qam = a - 1,
                    c = 1,
                    d = 1 - qab * x / qap;
                if (Math.abs(d) < _FPMIN)
                    d = _FPMIN;
                d = 1 / d;
                var h = d;

                for (var i = 1; i < _MAX_ITER; i++) {
                    var m2 = 2 * i,
                        aa = i * (b - i) * x / ((qam + m2) * (a + m2));
                    d = 1 + aa * d;
                    if (Math.abs(d) < _FPMIN)
                        d = _FPMIN;
                    c = 1 + aa / c;
                    if (Math.abs(c) < _FPMIN)
                        c = _FPMIN;
                    d = 1 / d;
                    h *= d * c;
                    aa = -(a + i) * (qab + i) * x / ((a + m2) * (qap + m2));
                    d = 1 + aa * d;
                    if (Math.abs(d) < _FPMIN)
                        d = _FPMIN;
                    c = 1 + aa / c;
                    if (Math.abs(c) < _FPMIN)
                        c = _FPMIN;
                    d = 1 / d;
                    var del = d * c;
                    h *= del;
                    if (Math.abs(del - 1) < _EPSILON)
                        break;
                }
                return h;
            }

            return function(a, b, x) {
                var bt = (x <= 0 || x >= 1)
                    ? 0
                    : Math.exp(gammaLn(a + b) - gammaLn(a) - gammaLn(b) + a * Math.log(x) + b * Math.log(1 - x));
                return x < (a + 1) / (a + b + 2)
                    ? bt * _biContinuedFraction(a, b, x) / a
                    : 1 - bt * _biContinuedFraction(b, a, 1 - x) / b;
            };
        })();

        /**
         * Error function.
         *
         * @method erf
         * @methodOf ran.special
         * @param {number} x Value to evaluate the error function at.
         * @returns {number} Error function value.
         * @private
         */
        var erf = (function () {
            // Coefficients
            var _p = [
                -1.26551223,
                1.00002368,
                0.37409196,
                0.09678418,
                -0.18628806,
                0.27886807,
                -1.13520398,
                1.48851587,
                -0.82215223,
                0.17087277
            ];

            return function(x) {
                var t = 1 / (1 + 0.5 * Math.abs(x));
                var tp = 1;
                var sum = 0;
                _p.forEach(function (p) {
                    sum += p * tp;
                    tp *= t;
                });
                var tau = t * Math.exp(sum - x * x);

                return x < 0 ? tau - 1 : 1 - tau;
            };
        })();

        // Exposed methods
        return {
            gamma: gamma,
            gammaLn: gammaLn,
            gammaLowerIncomplete: gammaLowerIncomplete,
            betaIncomplete: betaIncomplete,
            erf: erf
        };
    })();

    /**
     * Core random generators and manipulators.
     *
     * @namespace core
     * @memberOf ran
     */
    var core = (function () {
        /**
         * Generates some uniformly distributed random floats in (min, max).
         * If min > max, a random float in (max, min) is generated.
         * If no parameters are passed, generates a single random float between 0 and 1.
         * If only min is specified, generates a single random float between 0 and min.
         *
         * @method float
         * @methodOf ran.core
         * @param {number=} min Lower boundary, or upper if max is not given.
         * @param {number=} max Upper boundary.
         * @param {number=} n Number of floats to generate.
         * @returns {(number|Array)} Single float or array of random floats.
         */
        function float(min, max, n) {
            if (arguments.length === 0)
                return _r(0, 1);
            if (arguments.length === 1)
                return _r(0, min);
            return _some(function () {
                return _r(min, max);
            }, n);
        }

        /**
         * Generates some uniformly distributed random integers in (min, max).
         * If min > max, a random integer in (max, min) is generated.
         * If only min is specified, generates a single random integer between 0 and min.
         *
         * @method int
         * @methodOf ran.core
         * @param {number} min Lower boundary, or upper if max is not specified.
         * @param {number=} max Upper boundary.
         * @param {number=} n Number of integers to generate.
         * @returns {(number|Array)} Single integer or array of random integers.
         */
        function int(min, max, n) {
            if (arguments.length === 1)
                return Math.floor(_r(0, min + 1));
            return _some(function () {
                return Math.floor(_r(min, max + 1));
            }, n);
        }

        /**
         * Samples some elements with replacement from an array with uniform distribution.
         *
         * @method choice
         * @methodOf ran.core
         * @param {Array} values Array to sample from.
         * @param {number=} n Number of elements to sample.
         * @returns {(object|Array)} Single element or array of sampled elements.
         * If array is invalid, null pointer is returned.
         */
        function choice(values, n) {
            if (values === null || values === undefined || values.length === 0)
                return null;
            return _some(function () {
                return values[Math.floor(_r(0, values.length))];
            }, n);
        }

        /**
         * Samples some characters with replacement from a string with uniform distribution.
         *
         * @method char
         * @methodOf char.core
         * @param {string} string String to sample characters from.
         * @param {number=} n Number of characters to sample.
         * @returns {(string|Array)} Random character if k is not given or less than 2, an array of random characters otherwise.
         */
        function char(string, n) {
            if (string === null || string === undefined || string.length === 0)
                return "";
            return _some(function () {
                return string.charAt(Math.floor(_r(0, string.length)));
            }, n);
        }

        /**
         * Shuffles an array in-place using the Fisher--Yates algorithm.
         *
         * @method shuffle
         * @methodOf ran.core
         * @param {Array} values Array to shuffle.
         * @returns {Array} The shuffled array.
         */
        function shuffle(values) {
            var i, tmp, l = values.length;
            while (l) {
                i = Math.floor(Math.random() * l--);
                tmp = values[l];
                values[l] = values[i];
                values[i] = tmp;
            }
            return values;
        }

        /**
         * Flips a biased coin several times and returns the associated head/tail value or array of values.
         *
         * @method coin
         * @methodOf ran.core
         * @param {object} head Head value.
         * @param {object} tail Tail value.
         * @param {number=} p Bias (probability of head). If not specified, 0.5 is used.
         * @param {number=} n Number of coins to flip.
         * @returns {(object|Array)} Object of head/tail value or an array of head/tail values.
         */
        function coin(head, tail, p, n) {
            var prob = p ? p : 0.5;
            return _some(function () {
                return Math.random() < prob ? head : tail;
            }, n);
        }

        // Public methods
        return {
            float: float,
            int: int,
            choice: choice,
            char: char,
            shuffle: shuffle,
            coin: coin
        };
    })();

    /**
     * A collection of random number generators for well-known distributions.
     *
     * @namespace dist
     * @memberOf ran
     */
    var dist = (function () {
        /**
         * Table containing critical values for the chi square test at 95% of confidence for low degrees of freedom.
         *
         * @var {Array} _CHI_TABLE_LO
         * @memberOf ran.dist
         * @private
         */
        var _CHI_TABLE_LO = [0, 7.879, 10.597, 12.838, 14.860, 16.750, 18.548, 20.278, 21.955, 23.589, 25.188, 26.757, 28.300,
            29.819, 31.319, 32.801, 34.267, 35.718, 37.156, 38.582, 39.997, 41.401, 42.796, 44.181, 45.559, 46.928, 48.290,
            49.645, 50.993, 52.336, 53.672, 55.003, 56.328, 57.648, 58.964, 60.275, 61.581, 62.883, 64.181, 65.476, 66.766,
            68.053, 69.336, 70.616, 71.893, 73.166, 74.437, 75.704, 76.969, 78.231, 79.490, 80.747, 82.001, 83.253, 84.502,
            85.749, 86.994, 88.236, 89.477, 90.715, 91.952, 93.186, 94.419, 95.649, 96.878, 98.105, 99.330, 100.554, 101.776,
            102.996, 104.215, 105.432, 106.648, 107.862, 109.074, 110.286, 111.495, 112.704, 113.911, 115.117, 116.321,
            117.524, 118.726, 119.927, 121.126, 122.325, 123.522, 124.718, 125.913, 127.106, 128.299, 129.491, 130.681,
            131.871, 133.059, 134.247, 135.433, 136.619, 137.803, 138.987, 140.169, 141.351, 142.532, 143.712, 144.891,
            146.070, 147.247, 148.424, 149.599, 150.774, 151.948, 153.122, 154.294, 155.466, 156.637, 157.808, 158.977,
            160.146, 161.314, 162.481, 163.648, 164.814, 165.980, 167.144, 168.308, 169.471, 170.634, 171.796, 172.957,
            174.118, 175.278, 176.438, 177.597, 178.755, 179.913, 181.070, 182.226, 183.382, 184.538, 185.693, 186.847,
            188.001, 189.154, 190.306, 191.458, 192.610, 193.761, 194.912, 196.062, 197.211, 198.360, 199.509, 200.657,
            201.804, 202.951, 204.098, 205.244, 206.390, 207.535, 208.680, 209.824, 210.968, 212.111, 213.254, 214.396,
            215.539, 216.680, 217.821, 218.962, 220.102, 221.242, 222.382, 223.521, 224.660, 225.798, 226.936, 228.074,
            229.211, 230.347, 231.484, 232.620, 233.755, 234.891, 236.026, 237.160, 238.294, 239.428, 240.561, 241.694,
            242.827, 243.959, 245.091, 246.223, 247.354, 248.485, 249.616, 250.746, 251.876, 253.006, 254.135, 255.264,
            256.393, 257.521, 258.649, 259.777, 260.904, 262.031, 263.158, 264.285, 265.411, 266.537, 267.662, 268.788,
            269.912, 271.037, 272.162, 273.286, 274.409, 275.533, 276.656, 277.779, 278.902, 280.024, 281.146, 282.268,
            283.390, 284.511, 285.632, 286.753, 287.874, 288.994, 290.114, 291.234, 292.353, 293.472, 294.591, 295.710,
            296.828, 297.947, 299.065, 300.182, 301.300, 302.417, 303.534, 304.651, 305.767, 306.883, 307.999, 309.115,
            310.231, 311.346];
        /**
         * Table containing critical values for the chi square test at 95% of confidence for high degrees of freedom.
         *
         * @var {Array} _CHI_TABLE_HI
         * @memberOf ran.dist
         * @private
         */
        var _CHI_TABLE_HI = [366.844, 421.900, 476.606, 531.026, 585.207, 639.183, 692.982, 746.625, 800.131, 853.514, 906.786,
            959.957, 1013.036, 1066.031, 1118.948];

        /**
         * Generates a normally distributed value.
         *
         * @method _normal
         * @methodOf ran.dist
         * @param mu {number} Distribution mean.
         * @param sigma {number} Distribution standard deviation.
         * @returns {number} Random variate.
         * @private
         */
        function _normal(mu, sigma) {
            var u = Math.random(),
                v = Math.random();
            return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) + mu;
        }

        /**
         * Generates a gamma distributed value.
         *
         * @method _gamma
         * @methodOf ran.dist
         * @param alpha {number} Shape parameter.
         * @param beta {number} Rate parameter.
         * @returns {number} Random variate.
         * @private
         */
        function _gamma(alpha, beta) {
            if (alpha > 1) {
                var d = alpha - 1 / 3;
                var c = 1 / Math.sqrt(9 * d),
                    Z, V, U;
                while (true) {
                    Z = _normal(0, 1);
                    if (Z > -1 / c) {
                        V = Math.pow(1 + c * Z, 3);
                        U = Math.random();
                        if (Math.log(U) < 0.5 * Z * Z + d * (1 - V + Math.log(V)))
                            return d * V / beta;
                    }
                }
            } else {
                return _gamma(alpha + 1, beta) * Math.pow(Math.random(), 1 / alpha);
            }
        }

        /**
         * Estimates the CDF by summing up the PMF.
         *
         * @method _cdfEstimatorDiscrete
         * @methodOf ran.dist
         * @param pmf {Function} Probability mass function to builds CDF on.
         * @returns {Function} The estimated CDF.
         * @private
         */
        function _cdfEstimatorDiscrete(pmf) {
            var _cdf = [pmf(0, args)];
            for (var i = 1; i < 1000; i++) {
                _cdf.push(_cdf[i - 1] + pmf(i, args));
            }
            return function (x) {
                return _cdf[x];
            };
        }

        /**
         * Performs a chi square test for an array of values and a probability mass function.
         *
         * @method _chiTest
         * @methodOf ran.dist
         * @param values {Array} Array of values to perform test for.
         * @param pmf {Function} Probability mass function to perform test against.
         * @param c {number} Number of parameters for the distribution.
         * @returns {{statistics: number, passed: boolean}} Test results, containing the raw chi square statistics and a
         * boolean to tell whether the distribution passed the test.
         * @private
         */
        function _chiTest(values, pmf, c) {
            // Calculate observed distribution
            var p = {};
            values.forEach(function(v) {
                p[v] = p[v] ? p[v]+1 : 1;
            });

            // Calculate chi-square sum
            var chi2 = 0;
            var n = values.length;
            for (var x in p) {
                var m = pmf(parseInt(x)) * n;
                chi2 += Math.pow(p[x] - m, 2) / m;
            }

            // Get critical value
            var df = Math.max(1, Object.keys(p).length - c - 1);
            var crit = df <= 250 ? _CHI_TABLE_LO[df] : _CHI_TABLE_HI[Math.floor(df / 50)];

            // Return comparison results
            return {
                statistics: chi2,
                passed: chi2 <= crit
            };
        }

        /**
         * Estimates the CDF by integrating the PDF.
         *
         * @method _cdfEstimatorContinuous
         * @methodOf ran.dist
         * @param pdf {Function} Probability density function to builds CDF on.
         * @returns {Function} The estimated CDF.
         * @private
         */
        function _cdfEstimatorContinuous(pdf) {
            var _dx = 1e-3;
            var _cdf = [pdf(0, args)];
            for (var i = 0; i < 100 / _dx; i++) {
                // TODO use simpson
                _cdf.push(_cdf[i - 1] + pdf(i * _dx, args) * _dx);
            }

            return function (x) {
                var dx = 1e-4;
                var res = _cdf[parseInt(Math.floor(x / _dx))];
                for (var j = parseInt(Math.floor(x / _dx)) + dx; j < x; j += dx) {
                    // TODO use simpson
                    res += pdf(j, args) * dx;
                }
                return res;
            }
        }

        /**
         * Performs a Kolmogorov-Smirnov test for an array of values and a cumulative distribution function.
         *
         * @method _ksTest
         * @methodOf ran.dist
         * @param values {Array} Array of values to perform test for.
         * @param cdf {Function} Cumulative distribution function to perform test against.
         * @returns {{statistics: number, passed: boolean}} Test results, containing the raw K-S statistics and a
         * boolean to tell whether the distribution passed the test.
         * @private
         */
        function _ksTest(values, cdf) {
            // Sort values for estimated CDF
            values.sort(function (a, b) {
                return a - b;
            });

            // Calculate D value
            var D = 0;
            for (var i = 0; i < values.length; i++) {
                D = Math.max(D, Math.abs((i + 1) / values.length - cdf(values[i])));
            }

            // Return comparison results
            return {
                statistics: D,
                passed: D <= 1.628 / Math.sqrt(values.length)
            };
        }

        /**
         * Generator for discrete/continuous distributions.
         *
         * @method _Distribution
         * @methodOf ran.dist
         * @param type {string} Distribution type, either 'discrete' or 'continuous'.
         * @param generator {Function} Method to generate random value. Must accept one argument containing the
         * distribution parameters.
         * @param pdf {Function} The probability mass (or density) function. Must accept one parameter.
         * @param cdf {Function=} The cumulative distribution function. Must accept one parameter.
         * If not specified, it is approximated from the pdf.
         * @returns {object} A distribution with the supported methods.
         * @private
         */
        function _Distribution(type, generator, pdf, cdf) {
            return function () {
                // Some parameters
                var c = arguments.length;

                // Universal methods
                var methods = {
                    sample: function (n) {
                        return _some(function () {
                            return generator();
                        }, n);
                    }
                };

                // Probability mass/density and related functions
                if (type === "discrete") {
                    methods.pmf = pdf;
                } else {
                    methods.pdf = pdf;
                }
                methods.test = function(x) {
                    return type === "discrete" ? _chiTest(x, pdf, c) : _ksTest(x, cdf);
                };

                // Cumulative density and related functions
                methods.cdf = cdf !== undefined ? cdf
                    : type === "discrete" ? _cdfEstimatorDiscrete : _cdfEstimatorContinuous;
                methods.survival = function(x) {
                    return 1 - methods.cdf(x);
                };

                // Hazard functions
                methods.hazard = function(x) {
                    return pdf(x) / methods.survival(x);
                };
                methods.cumulativeHazard = function(x) {
                    return -Math.log(methods.survival(x));
                };

                // Return available methods
                return methods;
            };
        }

        /**
         * The general distribution generator, all generators are created using this class.
         * The methods listed for this class are available for all distribution generators.
         *
         * @class Distribution
         * @memberOf ran.dist
         */
        /**
         * Generates some random variate.
         *
         * @method sample
         * @methodOf ran.dist.Distribution
         * @param {number} n Number of variates to generate.
         */
        /**
         * The probability mass function.
         *
         * @method pmf
         * @methodOf ran.dist.Distribution
         * @param {number} x Value to evaluate distribution at.
         */
        /**
         * Probability density function.
         *
         * @method pdf
         * @methodOf ran.dist.Distribution
         * @param {number} x Value to evaluate distribution at.
         */
        /**
         * The cumulative distribution function.
         *
         * @method cdf
         * @methodOf ran.dist.Distribution
         * @param {number} x Value to evaluate CDF at.
         */
        /**
         * The survival function.
         *
         * @method survival
         * @methodOf ran.dist.Distribution
         * @param {number} x Value to evaluate survival function at.
         */
        /**
         * The hazard function.
         *
         * @method hazard
         * @methodOf ran.dist.Distribution
         * @param {number} x Value to evaluate the hazard at.
         */
        /**
         * The cumulative hazard function.
         *
         * @method cumulativeHazard
         * @methodOf ran.dist.Distribution
         * @param {number} x Value to evaluate cumulative hazard at.
         */
        /**
         * Tests if an array of values are from the specified distribution.
         * For discrete distributions it uses the chi square test, whereas for continuous distributions
         * the Kolmogorov-Smirnov test is used.
         *
         * @method test
         * @methodOf ran.dist.Distribution
         * @param {Array} values Array of values to test.
         */

        /**
         * Generator for [Bernoulli distribution]{@link https://en.wikipedia.org/wiki/Bernoulli_distribution}.
         *
         * @class Bernoulli
         * @memberOf ran.dist
         * @param {number} p Parameter of the distribution.
         * @constructor
         */
        var Bernoulli = function (p) {
            return _Distribution("discrete", function () {
                return Math.random() < p ? 1 : 0;
            }, function (x) {
                return parseInt(x) === 1 ? p : 1 - p;
            }, function (x) {
                return x < 0 ? 0 : (parseInt(x) >= 1 ? 1 : 1 - p);
            })();
        };

        /**
         * Generator for [beta distribution]{@link https://en.wikipedia.org/wiki/Beta_distribution}.
         *
         * @class Beta
         * @memberOf ran.dist
         * @param {number} alpha First shape parameter.
         * @param {number} beta Second shape parameter.
         * @constructor
         */
        var Beta = function(alpha, beta) {
            // Pre-compute constants
            var c1 = Math.exp(special.gammaLn(alpha) + special.gammaLn(beta) - special.gammaLn(alpha + beta));

            return _Distribution("continuous", function () {
                var x = _gamma(alpha, 1);
                var y = _gamma(beta, 1);
                return x / (x + y);
            }, function (x) {
                return Math.pow(x, alpha-1) * Math.pow(1-x, beta-1) / c1;
            }, function (x) {
                return x <= 0 ? 0 : x >=1 ? 1 : special.betaIncomplete(alpha, beta, x);
            })();
        };

        /**
         * Generator for [binomial distribution]{@link https://en.wikipedia.org/wiki/Binomial_distribution}.
         *
         * @class Binomial
         * @memberOf ran.dist
         * @param {number} n Number of trials.
         * @param {number} p Success probability.
         * @constructor
         */
        var Binomial = function(n, p) {
            // Pre-compute constants
            var pp = p <= 0.5 ? p : 1 - p,
                mean = n * pp;

            return _Distribution("discrete", (function () {
                if (n < 25) {
                    return function() {
                        var b = 0;
                        for (var i = 1; i <= n; i++)
                            if (Math.random() < pp) b++;
                        return pp === p ? b : n - b;
                    };
                } else if (mean < 1.) {
                    var lambda = Math.exp(-mean);
                    return function() {
                        var t = 1.0;
                        for (var i = 0; i <= n; i++) {
                            t *= Math.random();
                            if (t < lambda) break;
                        }
                        var b = i <= n ? i : n;
                        return pp === p ? b : n - b;
                    };
                } else {
                    var en = n,
                        g = special.gammaLn(en + 1),
                        pc = 1 - pp,
                        pLog = Math.log(pp),
                        pcLog = Math.log(pc),
                        sq = Math.sqrt(2.0 * mean * pc);
                    return function() {
                        do {
                            do {
                                var y = Math.tan(Math.PI * Math.random()),
                                    em = sq * y + mean;
                            } while (em < 0.0 || em >= (en + 1.0));
                            em = Math.floor(em);
                            var t = 1.2 * sq * (1.0 + y * y) * Math.exp(g - special.gammaLn(em + 1.0)
                                - special.gammaLn(en - em + 1.0) + em * pLog + (en - em) * pcLog);
                        } while (Math.random() > t);
                        return pp === p ? em : n - em;
                    };
                }
            })(), function (x) {
                var xi = parseInt(x);
                return xi < 0 ? 0 : xi > n ? 0 : Math.exp(special.gammaLn(n + 1) - special.gammaLn(xi + 1) - special.gammaLn(n - xi + 1)
                    + xi * Math.log(p) + (n - xi) * Math.log(1 - p));
            }, function (x) {
                var xi = parseInt(x);
                return xi <= 0 ? 0 : xi > n ? 1 : special.betaIncomplete(n - xi, 1 + xi, 1 - p);
            })();
        };

        /**
         * Generator for [bounded Pareto distribution]{@link https://en.wikipedia.org/wiki/Pareto_distribution#Bounded_Pareto_distribution}.
         *
         * @class BoundedPareto
         * @memberOf ran.dist
         * @param {number} xmin Lower boundary.
         * @param {number} xmax Upper boundary.
         * @param {number} alpha Shape parameter.
         * @constructor
         */
        var BoundedPareto = function (xmin, xmax, alpha) {
            // Pre-compute constants
            var l = Math.pow(xmin, alpha);
            var h = Math.pow(xmax, alpha);
            var c1 = (1 - Math.pow(xmin / xmax, alpha));

            return new _Distribution("continuous", function () {
                return Math.pow((h + Math.random() * (l - h)) / (l * h), -1 / alpha);
            }, function (x) {
                return (x < xmin || x > xmax) ? 0
                    : alpha * Math.pow(xmin / x, alpha) / (x * c1);
            }, function (x) {
                return x < xmin ? 0 : (x > xmax ? 1 : (1 - l * Math.pow(x, -alpha)) / (1 - l / h));
            })();
        };

        /**
         * Generator for [chi square distribution]{@link https://en.wikipedia.org/wiki/Chi-squared_distribution}.
         *
         * @class Chi2
         * @memberOf ran.dist
         * @param {number} k Degrees of freedom. If not an integer, is rounded to the nearest one.
         * @constructor
         */
        var Chi2 = function (k) {
            return Gamma(Math.round(k) / 2, 0.5);
        };

        /**
         * Generator for custom distribution, using the
         * [alias table method]{@link http://www.keithschwarz.com/darts-dice-coins} method.
         *
         * @class Custom
         * @memberOf ran.dist
         * @param {Array} weights Weights for the distribution (doesn't need to be normalized).
         * @constructor
         */
        var Custom = function (weights) {
            // Pre-compute tables
            var n = weights.length;
            var prob = [0];
            var alias = [0];
            if (weights.length > 1) {
                // Get sum (for normalization)
                var sum = 0;
                for (var i = 0; i < n; i++)
                    sum += weights[i];

                // Fill up small and large work lists
                var p = [];
                var small = [];
                var large = [];
                for (i = 0; i < n; i++) {
                    p.push(n * weights[i] / sum);
                    if (p[i] < 1.0)
                        small.push(i);
                    else
                        large.push(i);
                }

                // Init tables
                prob = [];
                alias = [];
                for (i = 0; i < n; i++) {
                    prob.push(1.0);
                    alias.push(i);
                }

                // Fill up alias table
                var s = 0,
                    l = 0;
                while (small.length > 0 && large.length > 0) {
                    s = small.shift();
                    l = large.shift();

                    prob[s] = p[s];
                    alias[s] = l;

                    p[l] += p[s] - 1.0;
                    if (p[l] < 1.0)
                        small.push(l);
                    else
                        large.push(l);
                }
                while (large.length > 0) {
                    l = large.shift();
                    prob[l] = 1.0;
                    alias[l] = l;
                }
                while (small.length > 0) {
                    s = small.shift();
                    prob[s] = 1.0;
                    alias[s] = s;
                }
            }

            // Build pmf and cdf
            var pmf = [weights[0] / sum];
            var cdf = [weights[0] / sum];
            for (i = 1; i < weights.length; i++) {
                pmf.push(weights[i] / sum);
                cdf.push(cdf[i - 1] + weights[i] / sum);
            }

            // Create generator
            return new _Distribution("discrete", function () {
                if (n <= 1) {
                    return 0;
                }
                var i = Math.floor(Math.random() * n);
                if (Math.random() < prob[i])
                    return i;
                else
                    return alias[i];
            }, function (x) {
                var xi = parseInt(x);
                return xi < 0 || xi >= weights.length ? 0 : pmf[xi];
            }, function (x) {
                var xi = parseInt(x);
                return xi < 0 ? 0 : xi >= weights.length ? 1 : cdf[xi];
            })();
        };

        /**
         * Generator for the [degenerate distribution]{@link https://en.wikipedia.org/wiki/Degenerate_distribution}.
         *
         * @class Degenerate
         * @memberOf ran.dist
         * @param {number} x0 Location of the distribution.
         * @constructor
         */
        var Degenerate = function(x0) {
            return new _Distribution("continuous", function() {
                return x0;
            }, function (x) {
                return x === x0 ? 1 : 0;
            }, function (x) {
                return x < x0 ? 0 : x > x0 ? 1 : 0.5;
            })();
        };

        /**
         * Generator for [Erlang distribution]{@link https://en.wikipedia.org/wiki/Erlang_distribution}.
         *
         * @class Erlang
         * @memberOf ran.dist
         * @param {number} k Shape parameter. It is rounded to the nearest integer.
         * @param {number} lambda Rate parameter.
         * @constructor
         */
        var Erlang = function (k, lambda) {
            return Gamma(Math.round(k), lambda);
        };

        /**
         * Generator for [exponentially distribution]{@link https://en.wikipedia.org/wiki/Exponential_distribution}.
         *
         * @class Exponential
         * @memberOf ran.dist
         * @param {number} lambda Rate parameter.
         * @constructor
         */
        var Exponential = function (lambda) {
            return new _Distribution("continuous", function () {
                return -Math.log(Math.random()) / lambda;
            }, function (x) {
                return lambda * Math.exp(-lambda * x);
            }, function (x) {
                return 1 - Math.exp(-lambda * x);
            })();
        };

        /**
         * Generator for [gamma distribution]{@link https://en.wikipedia.org/wiki/Gamma_distribution} following
         * the shape/rate parametrization.
         *
         * @class Gamma
         * @memberOf ran.dist
         * @param {number} alpha Shape parameter.
         * @param {number} beta Rate parameter.
         * @constructor
         */
        var Gamma = function (alpha, beta) {
            // Pre-compute constants
            var c1 = Math.pow(beta, alpha);
            var c2 = special.gamma(alpha);

            return new _Distribution("continuous", function () {
                return _gamma(alpha, beta);
            }, function (x) {
                return x <= .0 ? 0 : c1 * Math.exp((alpha - 1) * Math.log(x) - beta * x) / c2;
            }, function (x) {
                return special.gammaLowerIncomplete(alpha, beta * x) / c2;
            })();
        };

        /**
         * Generator for [generalized gamma distribution]{@link https://en.wikipedia.org/wiki/Generalized_gamma_distribution}.
         *
         * @class GeneralizedGamma
         * @memberOf ran.dist
         * @param {number} a Scale parameter.
         * @param {number} d Shape parameter.
         * @param {number} p Shape parameter.
         * @constructor
         */
        var GeneralizedGamma = function (a, d, p) {
            // Pre-compute constants
            var c1 = special.gamma(d / p);
            var c2 = (p / Math.pow(a, d));
            var c3 = 1 / Math.pow(a, p);

            return new _Distribution("continuous", function () {
                return Math.pow(_gamma(d / p, c3), 1 / p);
            }, function (x) {
                return x <= .0 ? 0 : c2 * Math.exp((d - 1) * Math.log(x) - Math.pow(x / a, p)) / c1;
            }, function (x) {
                return special.gammaLowerIncomplete(d / p, Math.pow(x / a, p)) / c1;
            })();
        };

        /**
         * Generator for [inverse gamma distribution]{@link https://en.wikipedia.org/wiki/Inverse-gamma_distribution}.
         *
         * @class InverseGamma
         * @memberOf ran.dist
         * @param {number} alpha Shape parameter.
         * @param {number} beta Scale parameter.
         * @constructor
         */
        var InverseGamma = function (alpha, beta) {
            // Pre-compute constants
            var c1 = special.gamma(alpha);
            var c2 = Math.pow(beta, alpha) / c1;

            return new _Distribution("continuous", function () {
                return 1 / _gamma(alpha, beta);
            }, function (x) {
                return x <= .0 ? 0 : c2 * Math.pow(x, -1 - alpha) * Math.exp(-beta / x);
            }, function (x) {
                return 1 - special.gammaLowerIncomplete(alpha, beta / x) / c1;
            })();
        };

        /**
         * Generator for [lognormal distribution]{@link https://en.wikipedia.org/wiki/Log-normal_distribution}.
         *
         * @class Lognormal
         * @memberOf ran.dist
         * @param {number} mu Location parameter.
         * @param {number} sigma Scale parameter.
         * @constructor
         */
        var Lognormal = function (mu, sigma) {
            // Pre-compute constants
            var c1 = sigma * Math.SQRT2;
            var c2 = sigma * Math.sqrt(2 * Math.PI);

            return new _Distribution("continuous", function () {
                return Math.exp(mu + sigma * _normal(0, 1));
            }, function (x) {
                return x <= .0 ? 0 : Math.exp(-0.5 * Math.pow((Math.log(x) - mu) / sigma, 2)) / (x * c2);
            }, function (x) {
                return x <= .0 ? 0 : 0.5 * (1 + special.erf((Math.log(x) - mu) / c1));
            })();
        };

        /**
         * Generator for [normal distribution]{@link https://en.wikipedia.org/wiki/Normal_distribution}.
         *
         * @class Normal
         * @memberOf ran.dist
         * @param {number} mu Location parameter (mean).
         * @param {number} sigma Squared scale parameter (variance).
         * @constructor
         */
        var Normal = function (mu, sigma) {
            // Pre-compute constants
            var c1 = sigma * Math.SQRT2;
            var c2 = sigma * Math.sqrt(2 * Math.PI);

            return new _Distribution("continuous", function () {
                return _normal(mu, sigma);
            }, function (x) {
                return Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2)) / c2;
            }, function (x) {
                return 0.5 * (1 + special.erf((x - mu) / c1));
            })();
        };

        /**
         * Generator for [Pareto distribution]{@link https://en.wikipedia.org/wiki/Pareto_distribution}.
         *
         * @class Pareto
         * @memberOf ran.dist
         * @param {number} xmin Scale parameter.
         * @param {number} alpha Shape parameter.
         * @constructor
         */
        var Pareto = function (xmin, alpha) {
            return new _Distribution("continuous", function () {
                return xmin / Math.pow(Math.random(), 1 / alpha);
            }, function (x) {
                return x < xmin ? 0 : alpha * Math.pow(xmin / x, alpha) / x;
            }, function (x) {
                return x < xmin ? 0 : 1 - Math.pow(xmin / x, alpha);
            })();
        };

        /**
         * Generator for [Poisson distribution]{@link https://en.wikipedia.org/wiki/Poisson_distribution}.
         *
         * @class poisson
         * @memberOf ran.dist
         * @param {number} lambda Mean of the distribution.
         * @constructor
         */
        var Poisson = function (lambda) {
            return new _Distribution("discrete", (function() {
                if (lambda < 30) {
                    // Small lambda, Knuth's method
                    return function() {
                        var l = Math.exp(-lambda),
                            k = 0,
                            p = 1;
                        do {
                            k++;
                            p *= Math.random();
                        } while (p > l);
                        return k - 1;
                    };
                } else {
                    // Large lambda, normal approximation
                    var c = 0.767 - 3.36/lambda;
                    var beta = Math.PI / Math.sqrt(3 * lambda);
                    var alpha = beta * lambda;
                    var k = Math.log(c) - lambda - Math.log(beta);
                    return function() {
                        while (true) {
                            var r = Math.random();
                            var x = (alpha - Math.log((1 - r)/r)) / beta;
                            var n = Math.floor(x + 0.5);
                            if (n < 0)
                                continue;
                            var v = Math.random();
                            var y = alpha - beta * x;
                            var lhs = y + Math.log(v/Math.pow(1.0 + Math.exp(y), 2));
                            var rhs = k + n * Math.log(lambda) - special.gammaLn(n+1);
                            if (lhs <= rhs)
                                return n;
                        }
                    };
                }
            })(), function (x) {
                var xi = parseInt(x);
                return xi < 0 ? 0 : Math.pow(lambda, xi) * Math.exp(-lambda) / special.gamma(xi + 1);
            }, function (x) {
                var xi = parseInt(x);
                return xi < 0 ? 0 : 1 - special.gammaLowerIncomplete(xi + 1, lambda) / special.gamma(xi + 1);
            })();
        };

        /**
         * Generator for continuous
         * [uniform distribution]{@link https://en.wikipedia.org/wiki/Uniform_distribution_(continuous)}.
         *
         * @class UniformContinuous
         * @memberOf ran.dist
         * @param {number} xmin Lower boundary.
         * @param {number} xmax Upper boundary.
         * @constructor
         */
        var UniformContinuous = function (xmin, xmax) {
            // Pre-compute constants
            var c1 = xmax - xmin;

            return new _Distribution("continuous", function () {
                return Math.random() * c1 + xmin;
            }, function (x) {
                return x < xmin || x > xmax ? 0 : 1 / c1;
            }, function (x) {
                return x < xmin ? 0 : x > xmax ? 1 : (x - xmin) / c1;
            })();
        };

        /**
         * Generator for discrete
         * [uniform distribution]{@link https://en.wikipedia.org/wiki/Uniform_distribution_(continuous)}.
         *
         * @class UniformDiscrete
         * @memberOf ran.dist
         * @param {number} xmin Lower boundary.
         * @param {number} xmax Upper boundary.
         * @constructor
         */
        var UniformDiscrete = function (xmin, xmax) {
            // Pre-compute contsants
            var c1 = xmax - xmin + 1;

            return new _Distribution("discrete", function() {
                return parseInt(Math.random() * c1) + xmin;
            }, function(x) {
                var xi = parseInt(x);
                return xi < xmin || xi > xmax ? 0 : 1 / c1;
            }, function(x) {
                var xi = parseInt(x);
                return xi < xmin ? 0 : xi > xmax ? 1 : (1 + xi - xmin) / c1;
            })();
        };

        /**
         * Generator for [Weibull distribution]{@link https://en.wikipedia.org/wiki/Weibull_distribution}.
         *
         * @class Weibull
         * @memberOf ran.dist
         * @param {number} lambda Scale parameter.
         * @param {number} k Shape parameter.
         * @constructor
         */
        var Weibull = function (lambda, k) {
            return new _Distribution("continuous", function () {
                return lambda * Math.pow(-Math.log(Math.random()), 1 / k);
            }, function (x) {
                return x < 0 ? 0 : (k / lambda) * Math.exp((k - 1) * Math.log(x / lambda) - Math.pow(x / lambda, k));
            }, function (x) {
                return x < 0 ? 0 : 1 - Math.exp(-Math.pow(x / lambda, k));
            })();
        };

        // Public methods
        return {
            Bernoulli: Bernoulli,
            Beta: Beta,
            Binomial: Binomial,
            BoundedPareto: BoundedPareto,
            Chi2: Chi2,
            Custom: Custom,
            Degenerate: Degenerate,
            Erlang: Erlang,
            Exponential: Exponential,
            Gamma: Gamma,
            GeneralizedGamma: GeneralizedGamma,
            InverseGamma: InverseGamma,
            Lognormal: Lognormal,
            Normal: Normal,
            Pareto: Pareto,
            Poisson: Poisson,
            UniformContinuous: UniformContinuous,
            UniformDiscrete: UniformDiscrete,
            Weibull: Weibull
        };
    })();

    /**
     * A collection of various Monte Carlo methods.
     *
     * @namespace mc
     * @memberOf ran
     */
    var mc = (function() {
        /**
         * Calculates the Gelman-Rubin diagnostics for a set of samples.
         *
         * @method gr
         * @memberOf ran.mc
         * @param {Array} samples Array of samples, where each sample is an array of states.
         * @param {number=} maxLength Maximum length of the diagnostic function. Default value is 1000.
         * @returns {Array} Array of G-R diagnostic versus iteration number for each state variable.
         */
        var gr = (function() {
            /**
             * Calculates the G-R diagnostic for a single set of samples and a specified state dimension.
             *
             * @method _gri
             * @memberOf ran.mc.gr
             * @param {Array} samples Array of samples.
             * @param {number} dim Index of the state dimension to consider.
             * @returns {number} The G-R diagnostic.
             * @private
             */
            function _gri(samples, dim) {
                // Calculate sample statistics
                var m = [],
                    s = [];
                samples.forEach(function (d) {
                    var di = d.map(function (x) {
                        return x[dim];
                    });
                    var mi = _sum(di) / di.length;
                    var si = (_sum(di, 2) - di.length * mi * mi) / (di.length - 1);
                    m.push(mi);
                    s.push(si);
                });

                // Calculate within and between variances
                var w = _sum(s) / samples.length;
                var mm = _sum(m) / samples.length;
                var b = (_sum(m, 2) - samples.length * mm * mm) * samples[0].length / (samples.length - 1);
                var v = ((samples[0].length - 1) * w + b) / samples[0].length;
                return Math.sqrt(v / w);
            }

            return function(samples, maxLength) {
                return samples[0][0].map(function(s, j) {
                    return new Array(maxLength || 1000).fill(0).map(function(d, i) {
                        return _gri(samples.map(function(dd) {
                            return dd.slice(0, i+2);
                        }), j);
                    });
                });
            };
        })();

        /**
         * Class implementing a multidimensional proposal distribution.
         * Proposal functions are used to sample new state from the current one.
         *
         * @class _Proposal
         * @memberOf ran.mc
         * @param {number} dimension Number of dimensions of the state.
         * @param {Array} s0 Initial values of the proposal scales. If not specified a vector of 1s is generated.
         * @constructor
         * @private
         */
        var _Proposal = (function (dimension, s0) {
            // TODO Extend it to arbitrary proposals
            // TODO save current transition probability to calculate ratio faster
            /**
             * Scale parameters of the proposals.
             *
             * @var {Array} _scales
             * @memberOf ran.mc._Proposal
             * @private
             */
            var _scales = s0 || new Array(dimension).fill(1);

            /**
             * The array of proposal distributions.
             *
             * @var {Array} _g
             * @memberOf ran.mc._Proposal
             * @private
             */
            var _g = new Array(dimension).fill(0).map(function () {
                return new dist.Normal(0, 1);
            });

            /**
             * Updates one of the proposal distributions.
             * Either increases or decreases the scale (deviation) parameters. Only one proposal is updated at once.
             * Depending on the widen parameter, scale values are increased or decreased by 20%.
             *
             * @method update
             * @memberOf ran.mc._Proposal
             * @param {boolean} widen Whether the proposals should be widened or tightened.
             * @returns {Array} Array of scale values after the update.
             */
            function update(widen) {
                // Pick random dimension
                var i = parseInt(Math.random() * dimension);

                // Update proposal function according to acceptance rate
                _scales[i] = widen ? _scales[i] * (1 + Math.random()*0.2) : _scales[i] * (1 - Math.random()*0.2);
                _g[i] = new dist.Normal(0, _scales[i]);

                return _scales;
            }

            /**
             * Samples a new state vector based on a current position.
             *
             * @method jump
             * @memberOf ran.mc._Proposal
             * @param {Array} x Current state vector.
             * @returns {Array} Next proposed state vector.
             */
            function jump(x) {
                return x.map(function (d, i) {
                    return d + _g[i].sample();
                });
            }

            /**
             * Returns the proposal probability ratio between two states. This is equal to the ratio of the transition
             * probabilities:
             *
             * r = g(x1 | x2) / g(x2 | x1),
             *
             * where x1 and x2 are the old and new states.
             *
             * @method ratio
             * @memberOf ran.mc._Proposal
             * @param {Array} x1 Old state.
             * @param {Array} x2 New state.
             * @returns {number} Probability ratio.
             */
            function ratio(x1, x2) {
                return 1;
            }

            // Public methods
            return {
                update: update,
                sample: jump,
                ratio: ratio
            };
        });

        /**
         * Calculates the auto correlation function for historical state data.
         *
         * @method _ac
         * @memberOf ran.mc
         * @param {Array} Array containing historical state data.
         * @returns {Array} Array of auto correlation functions for each state variable.
         * @private
         */
        var _ac = (function() {
            /**
             * Calculates auto correlation for a single variable.
             *
             * @method _aci
             * @memberOf ran.mc._ac
             * @param {Array} h Array of single variables representing the history of one state variable.
             * @returns {Array} The auto correlation function.
             * @private
             */
            function _aci(h) {
                // Get average
                var m = _sum(h) / h.length,
                    m2 = _sum(h, 2);
                var rho = new Array(100).fill(0);
                for (var i = 0; i < h.length; i++) {
                    for (var r = 0; r < rho.length; r++) {
                        if (i - r > 0) {
                            rho[r] += (h[i] - m) * (h[i - r] - m);
                        }
                    }
                }

                return rho.map(function (d) {
                    return d / (m2 - h.length * m * m);
                });
            }

            return function(history) {
                return history.map(function(d) {
                    return _aci(d);
                });
            };
        })();

        /**
         *
         * Source: R. M. Neal: Slice sampling. The Annals of Statistics, 31 (3): pp 705-767, 2003.
         * @type {Function}
         */
        var Slice = (function(logDensity, config) {
            var _min = config && typeof config.min !== 'undefined' ? config.min[0] : null;
            var _max = config && typeof config.max !== 'undefined' ? config.max[0] : null;
            var _x = Math.random();
            var _e = new dist.Exponential(1);

            function _accept(x, z, l, r) {
                var L = l,
                    R = r,
                    D = false;

                while (R - L > 1.1) {
                    var M = (L + R) / 2;
                    if ((_x < M && x >= M) || (_x >= M && x < M)) {
                        D = true;
                    }

                    if (x < M) {
                        R = M;
                    } else {
                        L = M;
                    }

                    if (D && z >= logDensity(L) && z >= logDensity(R)) {
                        return false;
                    }
                }

                return true;
            }

            function _iterate() {
                // Pick slice height
                var z = logDensity(_x) - _e.sample(),
                    L = _x - Math.random(),
                    R = L + 1;

                // Find slice interval
                while ((!_min || L >= _min) && (!_max || R <= _max) && (z < logDensity(L) || z < logDensity(R))) {
                    if (Math.random() < 0.5) {
                        L -= R - L;
                    } else {
                        R += R - L;
                    }
                }

                // Truncate by boundaries
                if (typeof _min === 'number') {
                    L = Math.max(L, _min);
                }
                if (typeof _max === 'number') {
                    R = Math.min(R, _max);
                }

                // Shrink interval
                var x = _r(L, R);
                while (z > logDensity(x) || !_accept(x, z, L, R)) {
                    if (x < _x) {
                        L = x;
                    } else {
                        R = x;
                    }
                    x = _r(L, R);
                }

                // Update and return sample
                _x = x;
                return x;
            }

            // Placeholder
            function burnIn() {
                return null;
            }

            function sample(size) {
                return new Array(size || 1e6).fill(0).map(function() {
                    return [_iterate()];
                });
            }

            // Public methods
            return {
                burnIn: burnIn,
                sample: sample
            };
        });

        /**
         * Class implementing the [Metropolis]{@link https://en.wikipedia.org/wiki/Metropolis%E2%80%93Hastings_algorithm}
         * algorithm.
         *
         * @class Metropolis
         * @memberOf ran.mc
         * @param {Function} logDensity The logarithm of the density function to estimate.
         * @param {Object?} config Object containing the configurations of the sampler. Can be used to continue
         *                               sampling from a pre-trained sampler. Possible properties:
         *                               {dim}: Number of state variables (dimension). Default is 1.
         *                               {x}: Array containing the initial state. Default is a vector of random numbers
         *                                    between 0 and 1.
         *                               {min}: Array containing the lower boundary of the state. Default is unset.
         *                               {max}: Array containing the upper boundary of the state. Default is unset.
         *                               {scales}: Array containing the initial value of the proposal scales. Default is
         *                                         a vector of 1s.
         *                               {samplingRate}: Every n-th state is sampled where n is the sampling rate. Default
         *                                               is 1.
         * @constructor
         * TODO update this
         */
        var Metropolis = (function (logDensity, config, initialState) {
            var _dim = config && typeof config.dim === 'number' ? config.dim : 1;
            var _min = config && typeof config.min !== 'undefined' ? config.min : null;
            var _max = config && typeof config.max !== 'undefined' ? config.max : null;

            // TODO implement asymmetric proposal
            /**
             * Current state of the sampler.
             * This contains all necessary information to continue an interrupted sampling.
             *
             * @var {Object} _state
             * @memberOf ran.mc.Metropolis
             * @property x Array of last state variables.
             * @property proposals Array of the scale parameters of the proposal functions.
             * @property samplingRate Only every n-th states are recorded during sampling, where n is the sampling rate.
             * @private
             */
            var _state = {
                x: (initialState && initialState.x) || new Array((initialState && initialState.dim) || 1).fill(0).map(Math.random),
                proposals: initialState && initialState.proposals || null,
                samplingRate: initialState && initialState.samplingRate || 1
            };

            /**
             * The proposal functions for the sampler.
             *
             * @var {Object} _proposal
             * @memberOf ran.mc.Metropolis
             * @private
             */
            var _proposal = new _Proposal(_dim, _state.proposals);

            /**
             * The last recorded log density.
             *
             * @var {number} _lastLnP
             * @memberOf ran.mc.Metropolis
             * @private
             */
            var _lastLnP = logDensity(_state.x);

            /**
             * Class representing the statistics of the state variables.
             *
             * @class _stats
             * @memberOf ran.mc.Metropolis
             * @private
             */
            var _stats = (function() {
                var _n = 0,
                    _m1 = new Array(_dim).fill(0),
                    _m2 = new Array(_dim).fill(0);

                // Exposed methods
                return {
                    /**
                     * Returns the variable statistics for each dimension.
                     *
                     * @method get
                     * @memberOf ran.mc.Metropolis._stats
                     * @returns {{mean: Array, std: Array, cv: Array}}
                     */
                    get: function() {
                        var s = _m2.map(function(d, i) {
                            return Math.sqrt(d - _m1[i] * _m1[i]);
                        });
                        var cv = s.map(function(d, i) {
                            return d / _m1[i];
                        });
                        return {
                            mean: _m1,
                            std: s,
                            cv: cv
                        };
                    },

                    /**
                     * Updates the state statistics.
                     *
                     * @method update
                     * @memberOf ran.mc.Metropolis._stats
                     * @param {Array} x Current state to update statistics with.
                     */
                    update: function(x) {
                        _m1 = _m1.map(function(d, i) {
                            return (_n * d + x[i]) / (_n + 1);
                        });
                        _m2 = _m2.map(function(d, i) {
                            return (_n * d + x[i] * x[i]) / (_n + 1);
                        });
                        _n++;
                    }
                };
            })();

            /**
             * Class representing the acceptance rate.
             *
             * @class _acceptance
             * @memberOf ran.mc.Metropolis
             * @private
             */
            var _acceptance = (function() {
                var _arr = [];

                return {
                    /**
                     * Returns the acceptance rate based on the last 1000 iterations.
                     *
                     * @method get
                     * @memberOf ran.mc.Metropolis._acceptance
                     * @returns {number} Estimated acceptance rate.
                     */
                    get: function() {
                        return _sum(_arr) / _arr.length;
                    },

                    /**
                     * Updates acceptance history.
                     *
                     * @method update
                     * @memberOf ran.mc.Metropolis._acceptance
                     * @param {number} a Last acceptance, 1 if state was accepted, 0 otherwise.
                     */
                    update: function(a) {
                        _arr.push(a);
                        if (_arr.length > 1e4) {
                            _arr.shift();
                        }
                    }
                };
            })();

            /**
             * Class representing the latest historical data of the states.
             *
             * @class _history
             * @memberOf ran.mc.Metropolis
             * @private
             */
            var _history = (function() {
                var _arr = new Array(_dim).fill([]);

                return {
                    /**
                     * Returns the historical state data.
                     *
                     * @method get
                     * @memberOf ran.mc.Metropolis._history
                     * @returns {Array} Array of last 1000 states.
                     */
                    get: function() {
                        return _arr;
                    },

                    /**
                     * Updates historical data. Only the last 1000 states are stored.
                     *
                     * @method update
                     * @memberOf ran.mc.Metropolis._history
                     * @param {number} x Last state to update history with.
                     */
                    update: function(x) {
                        // Add new state
                        _arr.forEach(function(d, j) {
                            d.push(x[j]);
                        });

                        // Remove old state
                        if (_arr[0].length >= 1e4) {
                            _arr.forEach(function(d) {
                                d.shift();
                            });
                        }
                    }
                };
            })();

            /**
             * Runs a single iteration of the state update.
             *
             * @method _iterate
             * @memberOf ran.mc.Metropolis
             * @returns {number} Number indicating the acceptance status. 1 if accepted, 0 otherwise.
             * @private
             */
            function _iterate() {
                // Pick new state
                var x1 = _proposal.sample(_state.x);

                // Check boundaries
                if (_min) {
                    for (var i = 0; i < x1.length; i++) {
                        if (x1[i] < _min[i]) {
                            return 0;
                        }
                    }
                }
                if (_max) {
                    for (i = 0; i < x1.length; i++) {
                        if (x1[i] > _max[i]) {
                            return 0;
                        }
                    }
                }

                // Check if new state should be accepted
                var _newLnP = logDensity(x1);
                if (Math.random() < _proposal.ratio(_state.x, x1) * Math.exp(_newLnP - _lastLnP)) {
                    // Update state and last probability
                    _state.x = x1;
                    _lastLnP = _newLnP;
                    _history.update(_state.x);
                    _stats.update(_state.x);
                    return 1;
                } else {
                    _history.update(_state.x);
                    _stats.update(_state.x);
                    return 0;
                }
            }

            /**
             * Adjusts internal parameters such as proposals and sampling rate.
             *
             * @method _adjust
             * @memberOf ran.mc.Metropolis
             * @private
             */
            function _adjust() {
                // Adjust proposal distributions
                _state.proposals = _proposal.update(_acceptance.get() > 0.234);

                // Adjust sampling rate
                // Get highest zero point
                var z = _ac(_history.get()).reduce(function(first, d) {
                    for (var i=0; i<d.length-1; i++) {
                        if (d[i] >= 0 && d[i+1] < 0) {
                            return Math.max(first, i);
                        }
                    }
                }, 0);
                // Change sampling rate if zero point is different
                if (z > _state.samplingRate) {
                    _state.samplingRate++;
                } else if (z < _state.samplingRate) {
                    _state.samplingRate--;
                }
            }

            /**
             * Returns the current state of the estimator. The returned object can be used to initialize another estimator
             * by passing it as the config parameter.
             *
             * @method state
             * @memberOf ran.mc.Metropolis
             * @returns {Object} Object containing the current internal state of the estimator.
             */
            function state() {
                return {
                    x: _state.x.slice(),
                    proposals: _state.proposals.slice(),
                    samplingRate: _state.samplingRate
                };
            }

            /**
             * Returns the state variable statistics.
             *
             * @method stats
             * @memberOf ran.mc.Metropolis
             * @returns {{mean: Array, std: Array, cv: Array}} Object containing the arrays of statistics for each state
             * variable. Statistics calculated are: mean, standard deviation and coefficient of variation.
             */
            function stats() {
                return _stats.get();
            }

            /**
             * Returns the current acceptance ratio based on the last 1000 iterations.
             * 
             * @method ar
             * @memberOf ran.mc.Metropolis
             * @returns {number} Current acceptance ratio.
             */
            function ar() {
                return _acceptance.get();
            }

            /**
             * Returns the current auto correlation function for each state variable based on the last 1000 iterations.
             *
             * @method ac
             * @memberOf ran.mc.Metropolis
             * @returns {Array} Array of auto correlation function for each state variable.
             */
            function ac() {
                return _ac(_history.get());
            }

            /**
             * Runs the burn-in phase in batches. During burn-in, some internal parameters such as proposal scales and
             * sampling rate are adjusted.
             *
             * @method burnIn
             * @memberOf ran.mc.Metropolis
             * @param {Function=} callback Function to call at each batch of iterations. It is called each time the proposals
             * are updated (at each batch of state updates). Must accept two arguments: the relative number of batches until
             * the maximum iterations and the current acceptance rate and the current auto-correlation of the density over
             * consecutive steps.
             * @param {number=} maxBatches Maximum number of batches to run. One batch consists of 100 state jump. Default
             * value is 100.
             */
            function burnIn(callback, maxBatches) {
                // Run until acceptance rate is around 50% or max iterations are reached
                var bMax = maxBatches || 100;
                for (var batch = 0; batch <= bMax; batch++) {
                    // Do some iterations
                    for (var j = 0; j < 1e4; j++) {
                        _acceptance.update(_iterate());
                    }

                    // Adjust parameters
                    _adjust();

                    // Call optional callback
                    callback && callback(batch / bMax, _acceptance.get());
                }
            }

            /**
             * Collects a batch of samples from the distribution to estimate.
             * During sampling, no measurement or adjustment is carried out (that is, proposals and sampling rate remain
             * unchanged), only pure sampling is performed.
             *
             * @method sample
             * @memberOf ran.mc.Metropolis
             * @param {number=} size Number of samples to collect.
             * @param {Function=} progress Callback to call at each percentage of the total samples. Must accept one
             * parameter that is the fraction of samples collected so far.
             * @returns {Array} Array of the samples states.
             */
            function sample(size, progress) {
                var iMax = _state.samplingRate * (size || 1e6);
                var batchSize = iMax / 100;
                var samples = [];
                for (var i=0; i<iMax; i++) {
                    _iterate();

                    // Adjust occasionally, also send progress status
                    if (i % batchSize === 0) {
                        progress && progress(i / batchSize);
                    }

                    // Collect sample
                    if (i % _state.samplingRate === 0) {
                        samples.push(_state.x);
                    }
                }

                return samples;
            }

            // Pubic methods
            return {
                burnIn: burnIn,
                sample: sample,
                state: state,
                stats: stats,
                ar: ar,
                ac: ac
            };
        });

        // TODO rejection sampling with log-concave dist
        // TODO slice sampling
        // TODO Gibbs sampling
        // TODO NUTS
        // TODO adaptive Metropolis
        // TODO

        // TODO Hamiltonian
        // TODO Adjust Euclidean metric from covariance in burn-in
        // TODO step size sampled randomly

        // Public methods and classes
        return {
            gr: gr,
            Slice: Slice,
            Metropolis: Metropolis
        };
    })();

    // TODO next()
    // TODO trend()
    // TODO noise()
    // TODO mean(power)
    // TODO correlation()
    // TODO Processes to add: https://en.wikipedia.org/wiki/Stochastic_process
    var process = (function () {
        function Brown() {

        }

        function Wiener(mu, sigma) {

        }

        function OrsteinUhlenbeck() {

        }

        function Gaussian() {

        }

        function GaltonWatson() {

        }
    })();

    // Exports
    exports.special = special;
    exports.core = core;
    exports.dist = dist;
    exports.mc = mc;
})));
