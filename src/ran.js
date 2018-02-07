/**
 * Module for generating various random numbers.
 * @module ran
 */
// TODO test PDFs by using in test function and integrating
// TODO test CDFs by using in test functions
// TODO binomial (http://www.aip.de/groups/soe/local/numres/bookcpdf/c7-3.pdf)
// TODO speed bounded pareto up! Only pre-calculate heavy stuff
// TODO speed up things by pre-computing constants
// TODO subclass discrete and continuous distributions from parent distribution
// TODO simplify equations
// TODO speed up initial pre-computations
// TODO speed up Poisson by using different algorithms for low/high lambda
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
        var erf = (function() {
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
                var t = 1 / (1 + 0.5*Math.abs(x));
                var tp = 1;
                var sum = 0;
                _p.forEach(function(p, i) {
                    sum += p * tp;
                    tp *= t;
                });
                var tau = t * Math.exp(sum - x*x);

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
    // TODO distributions to add: https://en.wikipedia.org/wiki/List_of_probability_distributions
    // TODO use trapezoid rule for integration
    // TODO add unit test for PDF vs CDF
    var dist = (function () {
            /**
             * Generates a normally distributed value.
             *
             * @method _normal
             * @memberOf ran.dist
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
             * @memberOf ran.dist
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
             * Generator for discrete distributions.
             *
             * @class _DiscreteDistribution
             * @memberOf ran.dist
             * @param generator {Function} Method to generate random value. Must accept one argument containing the
             * distribution parameters.
             * @param pmf {Function} The probability mass function. Must accept two arguments: an integer and the
             * array of distribution parameters.
             * @param cdf {Function=} The cumulative distribution function. Must accept two arguments: an integer and the
             * array of distribution parameters. If not specified, it is approximated from the pmf.
             * @returns {object} A distribution with the supported methods.
             * @private
             */
            function _DiscreteDistribution(generator, pmf, cdf) {
                var _PRECOMPUTE_MAX = 1000;

                return function () {
                    var args = arguments;

                    // Pre-compute some cdf thresholds
                    var _cdfPrecomputed = [pmf(0, args)];
                    for (var i = 1; i < _PRECOMPUTE_MAX; i++) {
                        _cdfPrecomputed.push(_cdfPrecomputed[i - 1] + pmf(i, args));
                    }

                    // Public methods
                    return {
                        pmf: function (x) {
                            return pmf(x, args);
                        },
                        sample: function (n) {
                            return _some(function () {
                                return generator(args);
                            }, n);
                        },
                        cdf: cdf ? function (x) {
                            return cdf(x, args);
                        } : function (x) {
                            return _cdfPrecomputed[parseInt(x)];
                        }
                    };
                };
            }

            /**
             * Generator for continuous distributions.
             *
             * @class _DiscreteDistribution
             * @memberOf ran.dist
             * @param generator {Function} Method to generate random value. Must accept one argument containing the
             * distribution parameters.
             * @param pdf {Function} The probability density function. Must accept two arguments: an integer and the
             * array of distribution parameters.
             * @param cdf {Function=} The cumulative distribution function. Must accept two arguments: an integer and the
             * array of distribution parameters. If not specified, it is approximated from the pdf.
             * @returns {object} A distribution with the supported methods.
             * @private
             */
            function _ContinuousDistribution(generator, pdf, cdf) {
                var _MAX_PRECALC = 100;

                return function () {
                    var args = arguments;

                    // Pre-compute some cdf thresholds
                    var _dx = 1e-3;
                    var _cdfBinned = [pdf(0, args)];
                    for (var i = 1; i < _MAX_PRECALC / _dx; i++) {
                        _cdfBinned.push(_cdfBinned[i - 1] + pdf(i * _dx, args) * _dx);
                    }

                    function _refineCdf(x) {
                        var dx = 1e-4;
                        var res = _cdfBinned[parseInt(Math.floor(x / _dx))];
                        for (var j = parseInt(Math.floor(x / _dx)) + dx; j < x; j += dx) {
                            res += pdf(j, args) * dx;
                        }
                        return res;
                    }

                    // Public methods
                    return {
                        pdf: function (x) {
                            return pdf(x, args);
                        },
                        sample: function (n) {
                            return _some(function () {
                                return generator(args);
                            }, n);
                        },
                        cdf: cdf ? function (x) {
                            return cdf(x, args);
                        } : _refineCdf
                    };
                };
            }

            /**
             * Class implementing the [alias table method]{@link http://www.keithschwarz.com/darts-dice-coins} for
             * custom distribution.
             *
             * @class Alias
             * @memberOf ran.dist
             * @param {Array} probs Array of weights to init the alias table with.
             * @constructor
             */
            function Alias(probs) {
                var _n = 0;
                var _prob = [0];
                var _alias = [0];

                /**
                 * Resets alias table weights.
                 *
                 * @method reset
                 * @methodOf ran.dist.Alias
                 * @param {Array} w Array of weights to reset the alias table to.
                 */
                this.reset = function (w) {
                    // Single element
                    if (w.length < 1) {
                        _prob = [0];
                        _alias = [0];
                        return;
                    }
                    // Get sum (for normalization)
                    _n = w.length;
                    var sum = 0;
                    for (var i = 0; i < _n; i++)
                        sum += w[i];

                    // Fill up small and large work lists
                    var p = [];
                    var small = [];
                    var large = [];
                    for (i = 0; i < _n; i++) {
                        p.push(_n * w[i] / sum);
                        if (p[i] < 1.0)
                            small.push(i);
                        else
                            large.push(i);
                    }

                    // Init tables
                    _prob = [];
                    _alias = [];
                    for (i = 0; i < _n; i++) {
                        _prob.push(1.0);
                        _alias.push(i);
                    }

                    // Fill up alias table
                    var s = 0,
                        l = 0;
                    while (small.length > 0 && large.length > 0) {
                        s = small.shift();
                        l = large.shift();

                        _prob[s] = p[s];
                        _alias[s] = l;

                        p[l] += p[s] - 1.0;
                        if (p[l] < 1.0)
                            small.push(l);
                        else
                            large.push(l);
                    }
                    while (large.length > 0) {
                        l = large.shift();
                        _prob[l] = 1.0;
                        _alias[l] = l;
                    }
                    while (small.length > 0) {
                        s = small.shift();
                        _prob[s] = 1.0;
                        _alias[s] = s;
                    }
                };
                this.reset(probs);

                /**
                 * Samples some values from the alias table.
                 *
                 * @method sample
                 * @methodOf ran.dist.Alias
                 * @param {number=} n Number of values to return.
                 * @returns {(number|Array)} Single value or array of random values.
                 */
                this.sample = function (n) {
                    return _some(function () {
                        if (_n <= 1) {
                            return 0;
                        }

                        var i = Math.floor(Math.random() * _n);
                        if (Math.random() < _prob[i])
                            return i;
                        else
                            return _alias[i];
                    }, n);
                };
            }

            var Custom = _DiscreteDistribution(function(args){

            }, function(x, args) {

            }, function(x, args) {

            });

            /**
             * Generator for [Bernoulli distribution]{@link https://en.wikipedia.org/wiki/Bernoulli_distribution}.
             *
             * @class Bernoulli
             * @memberOf ran.dist
             * @param {number} p Parameter of the distribution.
             * @constructor
             */
            var Bernoulli = _DiscreteDistribution(function (args) {
                return Math.random() < args[0] ? 1 : 0;
            }, function (x, args) {
                return parseInt(x) === 1 ? args[0] : 1 - args[0];
            }, function (x, args) {
                return x < 0 ? 0 : (parseInt(x) >= 1 ? 1 : 1 - args[0]);
            });

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
            var BoundedPareto = _ContinuousDistribution(function (args) {
                var l = Math.pow(args[0], args[2]);
                var h = Math.pow(args[1], args[2]);
                return Math.pow((h + Math.random() * (l - h)) / (l * h), -1 / args[2]);
            }, function (x, args) {
                return (x < args[0] || x > args[1]) ? 0
                    : args[2] * Math.pow(args[0] / x, args[2]) / (x * (1 - Math.pow(args[0] / args[1], args[2])));
            }, function (x, args) {
                var l = Math.pow(args[0], args[2]);
                var h = Math.pow(args[1], args[2]);
                return x < args[0] ? 0 : (x > args[1] ? 1 : (1 - l * Math.pow(x, -args[2])) / (1 - l / h));
            });

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
            var Exponential = _ContinuousDistribution(function (args) {
                return -Math.log(Math.random()) / args[0];
            }, function (x, args) {
                return args[0] * Math.exp(-args[0] * x);
            }, function (x, args) {
                return 1 - Math.exp(-args[0] * x);
            });

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
            var Gamma = _ContinuousDistribution(function (args) {
                return _gamma(args[0], args[1]);
            }, function (x, args) {
                return x <= .0 ? 0 : Math.pow(args[1], args[0]) * Math.exp((args[0] - 1) * Math.log(x) - args[1] * x) / special.gamma(args[0]);
            }, function (x, args) {
                return special.gammaLowerIncomplete(args[0], args[1] * x) / special.gamma(args[0]);
            });

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
            var GeneralizedGamma = _ContinuousDistribution(function (args) {
                return Math.pow(_gamma(args[1] / args[2], 1 / Math.pow(args[0], args[2])), 1 / args[2]);
            }, function (x, args) {
                return x <= .0 ? 0 : (args[2] / Math.pow(args[0], args[1])) * Math.exp((args[1] - 1) * Math.log(x) - Math.pow(x / args[0], args[2])) / special.gamma(args[1] / args[2]);
            }, function (x, args) {
                return special.gammaLowerIncomplete(args[1] / args[2], Math.pow(x / args[0], args[2])) / special.gamma(args[1] / args[2]);
            });

            /**
             * Generator for [inverse gamma distribution]{@link https://en.wikipedia.org/wiki/Inverse-gamma_distribution}.
             *
             * @class InverseGamma
             * @memberOf ran.dist
             * @param {number} alpha Shape parameter.
             * @param {number} beta Scale parameter.
             * @constructor
             */
            var InverseGamma = _ContinuousDistribution(function (args) {
                return 1 / _gamma(args[0], args[1]);
            }, function (x, args) {
                return x <= .0 ? 0 : Math.pow(args[1], args[0]) * Math.pow(x, -1 - args[0]) * Math.exp(-args[1] / x) / special.gamma(args[0]);
            }, function (x, args) {
                return 1 - special.gammaLowerIncomplete(args[0], args[1] / x) / special.gamma(args[0]);
            });

            /**
             * Generator for [lognormal distribution]{@link https://en.wikipedia.org/wiki/Log-normal_distribution}.
             *
             * @class Lognormal
             * @memberOf ran.dist
             * @param {number} mu Location parameter.
             * @param {number} sigma Scale parameter.
             * @constructor
             */
            var Lognormal = _ContinuousDistribution(function (args) {
                    return Math.exp(args[0] + args[1]*_normal(0, 1));
                }, function (x, args) {
                    return x <= .0 ? 0 : Math.exp(-0.5 * Math.pow((Math.log(x) - args[0]) / args[1], 2)) / (x * args[1] * Math.sqrt(2 * Math.PI));
                }, function(x, args) {
                    return x <= .0 ? 0 : 0.5 * (1 + special.erf((Math.log(x) - args[0]) / (args[1] * Math.SQRT2)));
                });

            /**
             * Generator for [normal distribution]{@link https://en.wikipedia.org/wiki/Normal_distribution}.
             *
             * @class Normal
             * @memberOf ran.dist
             * @param {number} mu Location parameter (mean).
             * @param {number} sigma Squared scale parameter (variance).
             * @constructor
             */
            var Normal = _ContinuousDistribution(function (args) {
                return _normal(args[0], args[1]);
            }, function (x, args) {
                return Math.exp(-0.5 * Math.pow((x - args[0]) / args[1], 2)) / (Math.sqrt(2 * Math.PI) * args[1]);
            }, function(x, args) {
                return 0.5 * (1 + special.erf((x - args[0]) / (args[1]*Math.SQRT2)));
            });

            /**
             * Generator for [Pareto distribution]{@link https://en.wikipedia.org/wiki/Pareto_distribution}.
             *
             * @class Pareto
             * @memberOf ran.dist
             * @param {number} xmin Scale parameter.
             * @param {number} alpha Shape parameter.
             * @constructor
             */
            var Pareto = _ContinuousDistribution(function (args) {
                    return args[0] / Math.pow(Math.random(), 1 / args[1]);
                }, function (x, args) {
                    return x < args[0] ? 0 : args[1] * Math.pow(args[0]/x, args[1]) / x;
                }, function (x, args) {
                    return x < args[0] ? 0 : 1 - Math.pow(args[0]/x, args[1]);
                });

            /**
             * Generator for [Poisson distribution]{@link https://en.wikipedia.org/wiki/Poisson_distribution}.
             *
             * @class poisson
             * @memberOf ran.dist
             * @param {number} lambda Mean of the distribution.
             * @constructor
             */
            var Poisson = _DiscreteDistribution(function (args) {
                var l = Math.exp(-args[0]),
                    k = 0,
                    p = 1;
                do {
                    k++;
                    p *= Math.random();
                } while (p > l);
                return k - 1;
            }, function (x, args) {
                return x < 0 ? 0 : Math.pow(args[0], x) * Math.exp(-args[0]) / special.gamma(x + 1);
            }, function (x, args) {
                return x < 0 ? 0 : 1 - special.gammaLowerIncomplete(x+1, args[0]) / special.gamma(x+1);
            });

            /**
             * Generator for [uniformly distributed]{@link https://en.wikipedia.org/wiki/Uniform_distribution_(continuous)}.
             *
             * @class Uniform
             * @memberOf ran.dist
             * @param {number} min Lower boundary.
             * @param {number} max Upper boundary.
             * @constructor
             */
            var Uniform = _ContinuousDistribution(function (args) {
                return Math.random() * (args[1] - args[0]) + args[0];
            }, function (x, args) {
                return (x < args[0] || x > args[1]) ? 0 : 1 / (args[1] - args[0]);
            }, function (x, args) {
                return x < args[0] ? 0 : (x > args[1] ? 1 : (x - args[0]) / (args[1] - args[0]));
            });

            /**
             * Generator for [Weibull distributed]{@link https://en.wikipedia.org/wiki/Weibull_distribution}.
             *
             * @class Weibull
             * @memberOf ran.dist
             * @param {number} lambda Scale parameter.
             * @param {number} k Shape parameter.
             * @constructor
             */
            var Weibull = new _ContinuousDistribution(function (args) {
                return args[0] * Math.pow(-Math.log(Math.random()), 1 / args[1]);
            }, function (x, args) {
                return x < 0 ? 0 : (args[1] / args[0]) * Math.exp((args[1]-1)*Math.log(x/args[0]) - Math.pow(x/args[0], args[1]));
            }, function (x, args) {
                return x < 0 ? 0 : 1 - Math.exp(-Math.pow(x / args[0], args[1]));
            });

            // Public methods
            return {
                Alias: Alias,
                Bernoulli: Bernoulli,
                BoundedPareto: BoundedPareto,
                Chi2: Chi2,
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
