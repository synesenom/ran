/**
 * Module containing some special functions.
 *
 * @namespace special
 * @memberOf ran
 * @private
 */
export default (function () {
    /**
     * Maximum number of iterations in function approximations.
     *
     * @var {number} _MAX_ITER
     * @memberOf ran.special
     * @private
     */
    const _MAX_ITERATIONS = 100;

    /**
     * Error tolerance in function approximations.
     *
     * @var {number} _EPSILON
     * @memberOf ran.special
     * @private
     */
    const _EPSILON = 1e-10;

    let gamma = (function () {
        // Coefficients
        const _p = [
            676.5203681218851,
            -1259.1392167224028,
            771.32342877765313,
            -176.61502916214059,
            12.507343278686905,
            -0.13857109526572012,
            9.9843695780195716e-6,
            1.5056327351493116e-7
        ];

        /**
         * Gamma function, using the Lanczos approximation.
         *
         * @method gamma
         * @memberOf ran.special
         * @param {number} z Value to evaluate Gamma function at.
         * @returns {number} Gamma function value.
         * @private
         */
        function _gamma(z) {
            let y = 0;
            if (z < 0.5) {
                y = Math.PI / (Math.sin(Math.PI * z) * _gamma(1 - z));
            } else {
                z--;
                let x = 0.99999999999980993,
                    l = _p.length;
                _p.forEach((p, i) => {
                    x += p / (z + i + 1);
                    let t = z + l - 0.5;
                    y = Math.sqrt(2 * Math.PI) * Math.pow(t, (z + 0.5)) * Math.exp(-t) * x;
                });
            }
            return y;
        }

        return _gamma;
    })();

    let gammaLn = (function() {
        // Coefficients
        const _p = [
            76.18009172947146,
            -86.50532032941677,
            24.01409824083091,
            -1.231739572450155,
            .1208650973866179e-2,
            -.5395239384953e-5
        ];

        /**
         * Logarithm of the gamma function.
         *
         * @method gammaLn
         * @memberOf ran.special
         * @param {number} z Value to evaluate log(gamma) at.
         * @returns {number} The log(gamma) value.
         * @private
         */
        return function(z) {
            let x = z,
                y = z,
                tmp = x + 5.5;
            tmp = (x + 0.5) * Math.log(tmp) - tmp;
            let ser = 1.000000000190015;
            for (let j = 0; j < 6; j++) {
                y++;
                ser += _p[j] / y;
            }
            return tmp + Math.log(2.5066282746310005 * ser / x);
        };
    })();

    let gammaLowerIncomplete = (function () {
        const _DELTA = 1e-30;

        // Lower incomplete gamma generator using the series expansion
        function _gliSeries(s, x) {
            if (x < 0) {
                return 0;
            } else {
                let si = s,
                    y = 1 / s,
                    f = 1 / s;
                for (let i = 0; i < _MAX_ITERATIONS; i++) {
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
            let b = x + 1 - s,
                c = 1 / _DELTA,
                d = 1 / b,
                f = d,
                fi, y;
            for (let i = 1; i < _MAX_ITERATIONS; i++) {
                fi = i * (s - i);
                b += 2;
                d = fi * d + b;
                //if (Math.abs(d) < _DELTA)
                //    d = _DELTA;
                d = Math.max(Math.abs(d), _DELTA);
                d = 1 / d;
                c = b + fi / c;
                //if (Math.abs(c) < _DELTA)
                //    c = _DELTA;
                c = Math.max(Math.abs(c), _DELTA);
                y = c * d;
                f *= y;
                if (Math.abs(y - 1) < _EPSILON)
                    break;
            }
            return Math.exp(-x) * Math.pow(x, s) * f;
        }

        /**
         * Lower incomplete gamma function, using the series expansion and continued fraction approximations.
         *
         * @method gammaLowerIncomplete
         * @memberOf ran.special
         * @param {number} s Parameter of the integrand in the integral definition.
         * @param {number} x Lower boundary of the integral.
         * @returns {number} Value of the lower incomplete gamma function.
         * @private
         */
        return function (s, x) {
            return x < s + 1 ? _gliSeries(s, x) : gamma(s) - _guiContinuedFraction(s, x);
        };
    })();

    let betaIncomplete = (function() {
        const _FPMIN = 1e-30;

        // Incomplete beta generator using the continued fraction expansion
        function _biContinuedFraction(a, b, x) {
            let qab = a + b,
                qap = a + 1,
                qam = a - 1,
                c = 1,
                d = 1 - qab * x / qap;
            //if (Math.abs(d) < _FPMIN)
            //    d = _FPMIN;
            d = Math.max(Math.abs(d), _FPMIN);
            d = 1 / d;
            let h = d;

            for (let i = 1; i < _MAX_ITERATIONS; i++) {
                let m2 = 2 * i,
                    aa = i * (b - i) * x / ((qam + m2) * (a + m2));
                d = 1 + aa * d;
                //if (Math.abs(d) < _FPMIN)
                //    d = _FPMIN;
                d = Math.max(Math.abs(d), _FPMIN);
                c = 1 + aa / c;
                //if (Math.abs(c) < _FPMIN)
                //    c = _FPMIN;
                c = Math.max(Math.abs(c), _FPMIN);
                d = 1 / d;
                h *= d * c;
                aa = -(a + i) * (qab + i) * x / ((a + m2) * (qap + m2));
                d = 1 + aa * d;
                //if (Math.abs(d) < _FPMIN)
                //    d = _FPMIN;
                d = Math.max(Math.abs(d), _FPMIN);
                c = 1 + aa / c;
                //if (Math.abs(c) < _FPMIN)
                //    c = _FPMIN;
                c = Math.max(Math.abs(c), _FPMIN);
                d = 1 / d;
                let del = d * c;
                h *= del;
                if (Math.abs(del - 1) < _EPSILON)
                    break;
            }
            return h;
        }

        /**
         * Incomplete beta function, using the continued fraction approximations.
         *
         * @method betaIncomplete
         * @memberOf ran.special
         * @param {number} a First parameter of the function.
         * @param {number} b Second parameter of the function.
         * @param {number} x Lower boundary of the integral.
         * @returns {number} Value of the incomplete beta function.
         * @private
         */
        return function(a, b, x) {
            let bt = (x <= 0 || x >= 1)
                ? 0
                : Math.exp(gammaLn(a + b) - gammaLn(a) - gammaLn(b) + a * Math.log(x) + b * Math.log(1 - x));
            return x < (a + 1) / (a + b + 2)
                ? bt * _biContinuedFraction(a, b, x) / a
                : 1 - bt * _biContinuedFraction(b, a, 1 - x) / b;
        };
    })();

    let erf = (function () {
        // Coefficients
        const _p = [
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

        /**
         * Error function.
         *
         * @method erf
         * @memberOf ran.special
         * @param {number} x Value to evaluate the error function at.
         * @returns {number} Error function value.
         * @private
         */
        return function(x) {
            let t = 1 / (1 + 0.5 * Math.abs(x)),
                tp = 1,
                sum = 0;
            _p.forEach(p => {
                sum += p * tp;
                tp *= t;
            });
            let tau = t * Math.exp(sum - x * x);

            return x < 0 ? tau - 1 : 1 - tau;
        };
    })();

    function beta(x, y) {
        return Math.exp(gammaLn(x) + gammaLn(y) - gammaLn(x + y));
    }

    // Exposed methods
    return {
        beta,
        betaIncomplete,
        erf,
        gamma,
        gammaLn,
        gammaLowerIncomplete
    };
})();