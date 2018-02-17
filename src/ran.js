/**
 * Module for generating various random numbers.
 * @module ran
 */
// TODO add binomial (http://www.aip.de/groups/soe/local/numres/bookcpdf/c7-3.pdf)
// TODO add rademacher https://en.wikipedia.org/wiki/Rademacher_distribution
// TODO add beta binomial https://en.wikipedia.org/wiki/Beta-binomial_distribution
// TODO add degenerate https://en.wikipedia.org/wiki/Degenerate_distribution
// TODO add discrete uniform
// TODO add hypergeometric https://en.wikipedia.org/wiki/Hypergeometric_distribution
// TODO add poisson binomial https://en.wikipedia.org/wiki/Poisson_binomial_distribution
// TODO simplify equations
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
                    var x = 0.99999999999980993;
                    var l = _p.length;
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
            function _gli_series(s, x) {
                if (x < 0) {
                    return 0;
                } else {
                    var si = s,
                        y = 1 / s;
                    var f = 1 / s;
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
            function _gui_continued_fraction(s, x) {
                var b = x + 1 - s,
                    c = 1 / _DELTA;
                var d = 1 / b;
                var f = d,
                    fi, y;
                for (var i = 1; i <= _MAX_ITER; i++) {
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
                    return _gli_series(s, x);
                else
                    return gamma(s) - _gui_continued_fraction(s, x);
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

            function _erf(x) {
                var t = 1 / (1 + 0.5 * Math.abs(x));
                var tp = 1;
                var sum = 0;
                _p.forEach(function (p, i) {
                    sum += p * tp;
                    tp *= t;
                });
                var tau = t * Math.exp(sum - x * x);

                return x < 0 ? tau - 1 : 1 - tau;
            }

            return _erf;
        })();

        // Exposed methods
        return {
            gamma: gamma,
            gammaLowerIncomplete: gammaLowerIncomplete,
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
         * @return {Array} The shuffled array.
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
                methods.cdf = cdf !== undefined
                    ? cdf
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
         * @class Alias
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
                return (xi < 0 || xi >= weights.length) ? 0 : pmf[xi];
            }, function (x) {
                var xi = parseInt(x);
                return xi < 0 ? 0 : (xi >= weights.length ? 1 : cdf[xi]);
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
            var gen;
            // Small lambda, Knuth's method
            if (lambda < 30) {
                gen = function() {
                    var l = Math.exp(-lambda),
                        k = 0,
                        p = 1;
                    do {
                        k++;
                        p *= Math.random();
                    } while (p > l);
                    return k - 1;
                }
            } else {
                // Large lambda, normal approximation
                var c = 0.767 - 3.36/lambda;
                var beta = Math.PI / Math.sqrt(3 * lambda);
                var alpha = beta * lambda;
                var k = Math.log(c) - lambda - Math.log(beta);
                gen = function() {
                    while (true) {
                        var r = Math.random();
                        var x = (alpha - Math.log((1 - r)/r)) / beta;
                        var n = Math.floor(x + 0.5);
                        if (n < 0)
                            continue;
                        var v = Math.random();
                        var y = alpha - beta * x;
                        var lhs = y + Math.log(v/Math.pow(1.0 + Math.exp(y), 2));
                        var rhs = k + n * Math.log(lambda) - Math.log(special.gamma(n + 1));
                        if (lhs <= rhs)
                            return n;
                    }
                }
            }

            return new _Distribution("discrete", gen, function (x) {
                return x < 0 ? 0 : Math.pow(lambda, x) * Math.exp(-lambda) / special.gamma(x + 1);
            }, function (x) {
                return x < 0 ? 0 : 1 - special.gammaLowerIncomplete(x + 1, lambda) / special.gamma(x + 1);
            })();
        };

        /**
         * Generator for [uniform distribution]{@link https://en.wikipedia.org/wiki/Uniform_distribution_(continuous)}.
         *
         * @class Uniform
         * @memberOf ran.dist
         * @param {number} xmin Lower boundary.
         * @param {number} xmax Upper boundary.
         * @constructor
         */
        var Uniform = function (xmin, xmax) {
            // Pre-compute constants
            var c1 = xmax - xmin;

            return new _Distribution("continuous", function () {
                return Math.random() * c1 + xmin;
            }, function (x) {
                return (x < xmin || x > xmax) ? 0 : 1 / c1;
            }, function (x) {
                return x < xmin ? 0 : (x > xmax ? 1 : (x - xmin) / c1);
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
            BoundedPareto: BoundedPareto,
            Chi2: Chi2,
            Custom: Custom,
            Erlang: Erlang,
            Exponential: Exponential,
            Gamma: Gamma,
            GeneralizedGamma: GeneralizedGamma,
            InverseGamma: InverseGamma,
            Lognormal: Lognormal,
            Normal: Normal,
            Pareto: Pareto,
            Poisson: Poisson,
            Uniform: Uniform,
            Weibull: Weibull
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
    // TODO add process
    exports.special = special;
    exports.core = core;
    exports.dist = dist;
})));
