/**
 * Module for generating various random numbers.
 * @module ran
 */
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
     * Some special functions.
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
         * @memberOf ran.special
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
         * @memberOf ran.special
         * @param {number} a Parameter of the integrand in the integral definition.
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

        return {
            gamma: gamma,
            gammaLowerIncomplete: gammaLowerIncomplete
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
     * A collection of generators for well-known distributions.
     *
     * @namespace dist
     * @memberOf ran
     */
        // TODO distributions to add: https://en.wikipedia.org/wiki/List_of_probability_distributions
    var dist = (function () {
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

            /**
             * Generates some [Bernoulli distributed]{@link https://en.wikipedia.org/wiki/Bernoulli_distribution}
             * random values.
             *
             * @method bernoulli
             * @methodOf ran.dist
             * @param {number} p Parameter of the distribution.
             * @param {number=} n Number of values to return, of more than one.
             * @returns {(number|Array)} Single value or array of random values.
             */
            function bernoulli(p, n) {
                return _some(function () {
                    return Math.random() < p ? 1 : 0;
                }, n);
            }

            // TODO binomial (http://www.aip.de/groups/soe/local/numres/bookcpdf/c7-3.pdf)
        // TODO

            /**
             * Generates some [bounded Pareto]{@link https://en.wikipedia.org/wiki/Pareto_distribution#Bounded_Pareto_distribution}
             * distributed random values.
             *
             * @method boundedPareto
             * @methodOf ran.dist
             * @param {number} xmin Lower boundary.
             * @param {number} xmax Upper boundary.
             * @param {number} alpha Shape parameter.
             * @param {number=} n Number of values to return, of more than one.
             * @returns {(number|Array)} Single value or array of random values.
             */
            function boundedPareto(xmin, xmax, alpha, n) {
                var l = Math.pow(xmin, alpha);
                var h = Math.pow(xmax, alpha);
                return _some(function () {
                    return Math.pow((h + Math.random() * (l - h)) / (l * h), -1 / alpha);
                }, n);
            }

            /**
             * Generates some [chi square distributed]{@link https://en.wikipedia.org/wiki/Chi-squared_distribution}
             * random variables.
             *
             * @method chi2
             * @methodOf ran.dist
             * @param {number} v Degrees of freedom. It is rounded to the nearest integer.
             * @param {number=} n Number of values to return, of more than one.
             * @returns {(number|Array)} Single value or array of random values.
             */
            function chi2(v, n) {
                return gamma(Math.round(v) / 2, 2, n);
            }

            /**
             * Generates some [Erlang distributed]{@link https://en.wikipedia.org/wiki/Erlang_distribution} random
             * variables.
             *
             * @method erlang
             * @methodOf ran.dist
             * @param {number} k Shape parameter. It is rounded to the nearest integer.
             * @param {number} lambda Rate parameter.
             * @param {number=} n Number of values to return, of more than one.
             * @returns {(number|Array)} Single value or array of random values.
             */
            function erlang(k, lambda, n) {
                return gamma(Math.round(k), lambda, n);
            }

            /**
             * Generates some [exponentially distributed]{@link https://en.wikipedia.org/wiki/Exponential_distribution}
             * random values.
             *
             * @method exponential
             * @methodOf ran.dist
             * @param {number} lambda Rate parameter.
             * @param {number=} n Number of values to return, of more than one.
             * @returns {number|Array} Single value or array of random values.
             */
            function exponential(lambda, n) {
                return _some(function () {
                    return -Math.log(Math.random()) / lambda;
                }, n);
            }

            /**
             * Generates some [gamma distributed]{@link https://en.wikipedia.org/wiki/Gamma_distribution} random values
             * according to the rate parametrization.
             *
             * @method gamma
             * @methodOf ran.dist
             * @param {number} alpha Shape parameter.
             * @param {number} beta Rate parameter.
             * @param {number=} n Number of values to return, of more than one.
             * @returns {(number|Array)} Single value or array of random values.
             */
            var gamma = (function () {
                function _gamma(alpha, beta) {
                    if (alpha > 1) {
                        var d = alpha - 1 / 3;
                        var c = 1 / Math.sqrt(9 * d),
                            Z, V, U;
                        while (true) {
                            Z = normal(0, 1);
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

                return function (alpha, beta, n) {
                    return _some(function () {
                        return _gamma(alpha, beta);
                    }, n);
                };
            })();

            /**
             * Generates some [generalized gamma distributed]{@link https://en.wikipedia.org/wiki/Generalized_gamma_distribution}
             * random variables.
             *
             * @method generalizedGamma
             * @methodOf ran.dist
             * @param {number} a Scale parameter.
             * @param {number} d Shape parameter.
             * @param {number} p Shape parameter.
             * @param {number=} n Number of values to return, of more than one.
             * @returns {(number|Array)} Single value or array of random values.
             */
            function generalizedGamma(a, d, p, n) {
                var k = d / p,
                    theta = 1 / Math.pow(a, p),
                    q = 1 / p;
                return _some(function () {
                    return Math.pow(gamma(k, theta), q);
                }, n);
            }

            /**
             * Generates some [inverse-gamma distributed]{@link https://en.wikipedia.org/wiki/Inverse-gamma_distribution}
             * random variables.
             *
             * @method inverseGamma
             * @methodOf ran.dist
             * @param {number} k Shape parameter.
             * @param {number} theta Scale parameter.
             * @param {number=} n Number of values to return, of more than one.
             * @returns {(number|Array)} Single value or array of random values.
             */
            function inverseGamma(k, theta, n) {
                return _some(function () {
                    return 1 / gamma(k, 1 / theta);
                }, n);
            }

            /**
             * Generates some [log-normally distributed]{@link https://en.wikipedia.org/wiki/Log-normal_distribution}
             * random values.
             *
             * @method lognormal
             * @methodOf ran.dist
             * @param {number} mu Location parameter.
             * @param {number} sigma Scale parameter.
             * @param {number=} n Number of values to return, of more than one.
             * @returns {(number|Array)} Single value or array of random values.
             */
            function lognormal(mu, sigma, n) {
                return _some(function () {
                    var u = Math.random(),
                        v = Math.random();
                    return Math.exp(sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) + mu);
                }, n);
            }

            /**
             * Generates some [Maxwell-Boltzmann distributed]{@link https://en.wikipedia.org/wiki/Maxwell%E2%80%93Boltzmann_distribution}
             * random variables.
             *
             * @method maxwellBoltzmann
             * @methodOf ran.dist
             * @param {number} a The parameter of the distribution (a = sqrt(kT/m)).
             * @param {number=} n Number of values to return, of more than one.
             * @returns {(number|Array)} Single value or array of random values.
             */
            function maxwellBoltzmann(a, n) {
                return gamma(1.5, 2 * a * a, n);
            }

            /**
             * Generates some [normally distributed]{@link https://en.wikipedia.org/wiki/Normal_distribution} random
             * values.
             *
             * @method normal
             * @methodOf ran.dist
             * @param {number} mu Location parameter (mean).
             * @param {number} sigma Squared scale parameter (variance).
             * @param {number=} n Number of values to return, of more than one.
             * @returns {(number|Array)} Single value or array of random values.
             */
            function normal(mu, sigma, n) {
                return _some(function () {
                    var u = Math.random(),
                        v = Math.random();
                    return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) + mu;
                }, n);
            }

            /**
             * Generates some [Pareto distributed]{@link https://en.wikipedia.org/wiki/Pareto_distribution} random
             * values.
             *
             * @method pareto
             * @methodOf ran.dist
             * @param {number} xmin Scale parameter.
             * @param {number} alpha Shape parameter.
             * @param {number=} n Number of values to return, of more than one.
             * @returns {(number|Array)} Single value or array of random values.
             */
            function pareto(xmin, alpha, n) {
                return _some(function () {
                    return xmin / Math.pow(Math.random(), 1 / alpha);
                }, n);
            }

            /**
             * Generates some [Poisson distributed]{@link https://en.wikipedia.org/wiki/Poisson_distribution} random
             * values.
             *
             * @method poisson
             * @methodOf ran.dist
             * @param {number} lambda Mean of the distribution.
             * @param {number=} n Number of values to return, of more than one.
             * @returns {(number|Array)} Single value or array of random values.
             */
            function poisson(lambda, n) {
                return _some(function () {
                    var l = Math.exp(-lambda),
                        k = 0,
                        p = 1;
                    do {
                        k++;
                        p *= Math.random();
                    } while (p > l);
                    return k - 1;
                }, n);
            }

            /**
             * Generates some [uniformly distributed]{@link https://en.wikipedia.org/wiki/Uniform_distribution_(continuous)}
             * random values.
             *
             * @method uniform
             * @methodOf ran.dist
             * @param {number} min Lower boundary.
             * @param {number} max Upper boundary.
             * @param {number=} n Number of values to return, of more than one.
             * @returns {(number|Array)} Single value or array of random values.
             */
            function uniform(min, max, n) {
                return _some(function () {
                    return Math.random() * (max - min) + min;
                }, n);
            }

            /**
             * Generates some [Weibull distributed]{@link https://en.wikipedia.org/wiki/Weibull_distribution} random
             * values.
             *
             * @method weibull
             * @methodOf ran.dist
             * @param {number} lambda Scale parameter.
             * @param {number} k Shape parameter.
             * @param {number=} n Number of values to return, of more than one.
             * @returns {(number|Array)} Single value or array of random values.
             */
            function weibull(lambda, k, n) {
                return _some(function () {
                    return lambda * Math.pow(-Math.log(Math.random()), 1 / k);
                }, n);
            }

            // Public methods
            return {
                Alias: Alias,
                bernoulli: bernoulli,
                boundedPareto: boundedPareto,
                chi2: chi2,
                erlang: erlang,
                exponential: exponential,
                gamma: gamma,
                generalizedGamma: generalizedGamma,
                inverseGamma: inverseGamma,
                lognormal: lognormal,
                maxwellBoltzmann: maxwellBoltzmann,
                normal: normal,
                pareto: pareto,
                poisson: poisson,
                uniform: uniform,
                weibull: weibull
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
    exports._special = special;
    exports.core = core;
    exports.dist = dist;
})));
