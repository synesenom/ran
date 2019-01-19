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
     * Sums the element of an array.
     *
     * @method _sum
     * @memberOf ran
     * @param {Array} arr Array of numbers to sum over.
     * @param {number=} pow Power to raise each element before summing up.
     * @return {number} The sum.
     * @private
     */
    function _sum(arr, pow = 1) {
        if (pow !== 1) {
            return arr.reduce((sum, d) => {
                return sum + Math.pow(d, pow);
            }, 0);
        } else {
            return arr.reduce((sum, d) => {
                return sum + d;
            }, 0);
        }
    }

    /**
     * The main random number generator.
     * If min > max, a random number in (max, min) is generated.
     *
     * @method _r
     * @memberOf ran
     * @param {number} min Lower boundary. Default is 0.
     * @param {number} max Upper boundary. Default is 1.
     * @returns {number} Random number.
     * @private
     */
    function _r(min = 0, max = 1) {
        return min < max ? Math.random() * (max - min) + min : Math.random() * (min - max) + max;
    }

    /**
     * Runs a generator once or several times to return a single value or an array of values.
     *
     * @method _some
     * @memberOf ran
     * @param {function} generator Random generator to use.
     * @param {number=} k Number of values to generate.
     * @returns {(number|string|Array)} Single value or array of generated values.
     * @private
     */
    function _some(generator, k = 1) {
        if (k < 2)
            return generator();
        else {
            return Array.from({length: k}, () => generator());
        }
    }

    /**
     * Namespaces containing various linear algebra classes and methods.
     *
     * @namespace la
     * @memberOf ran
     */
    let la = (function() {
        /**
         * Class representing a real vector.
         *
         * @class Vector
         * @memberOf ran.la
         * @param {(number|Array|ran.la.Vector)=} arg The constructor argument. If it is a number, it sets the
         * dimension of the vector. If it is an array, the vector is initialized with the array elements. If it is
         * another vector, it is copied to this vector. If not specified, a 3D vector is created directing in the X
         * axis.
         * @constructor
         * @example
         *
         * let vec1 = new ran.la.Vector()
         * let vec2 = new ran.la.Vector(3)
         * let vec3 = new ran.la.Vector([1, 0, 0])
         * let vec4 = new ran.la.Vector(vec1)
         * // => ( 1, 0, 0 )
         *
         */
        class Vector {
            constructor(arg) {
                if (typeof arg === 'number') {
                    this._v = new Array(arg).fill(0);
                    this._v[0] = 1;
                } else if (Array.isArray(arg)) {
                    this._v = arg;
                } else if (typeof arg === 'object' && Array.isArray(arg._v)) {
                    this._v = arg._v;
                } else {
                    this._v = [1, 0, 0];
                }
            }

            /**
             * Returns the vector as an array.
             *
             * @method v
             * @memberOf ran.la.Vector
             * @returns {Array} The vector as an array.
             * @example
             *
             * let vec = new ran.la.Vector(3)
             * vec.v()
             * // => [ 1, 0, 0 ]
             *
             */
            v() {
                return this._v;
            }

            /**
             * Returns or sets an element of the vector.
             *
             * @method i
             * @memberOf ran.la.Vector
             * @param {number} i Index of the element.
             * @param {number=} e The new value of the i-th element. If not specified, the value at i is returned.
             * @example
             *
             * let v = new ran.la.Vector()
             *
             * v.i(0)
             * // => 1
             *
             * v.i(1)
             * // => 0
             *
             * v.i(1, 2)
             * // => ( 1, 2, 0 )
             *
             */
            i(i, e) {
                if (e !== undefined) {
                    this._v[i] = e;
                } else {
                    return this._v[i];
                }
            }

            /**
             * Performs an operation on the vector element-wise.
             *
             * @method f
             * @memberOf ran.la.Vector
             * @param {Function} func Function to apply on each element.
             * @returns {ran.la.Vector} The transformed matrix.
             * @example
             *
             * let v = new ran.la.Vector([1, 2, 3])
             * v.f(d => d * d)
             * // => ( 1, 4, 9 )
             *
             */
            f(func) {
                return new Vector(this._v.map(d => func(d)));
            }

            /**
             * Multiplies this vector with a scalar.
             *
             * @method scale
             * @memberOf ran.la.Vector
             * @param {number} s Scalar to multiply vector with.
             * @returns {ran.la.Vector} The scaled vector.
             * @example
             *
             * let vec = new ran.la.Vector([1, 2, 3])
             * vec.scale(2)
             * // => ( 2, 4, 6 )
             *
             */
            scale(s) {
                return new Vector(this._v.map(d => d * s));
            }

            /**
             * Adds another vector to this vector.
             *
             * @method add
             * @memberOf ran.la.Vector
             * @param {ran.la.Vector} vec The vector to add.
             * @returns {ran.la.Vector} The sum vector.
             * @example
             *
             * let v = new ran.la.Vector([1, 2, 3])
             * let w = new ran.la.Vector([4, 5, 6])
             * v.add(w)
             * // => ( 5, 7, 9 )
             *
             */
            add(vec) {
                let v = vec.v();
                return new Vector(this._v.map((d, i) => d + v[i]));
            }

            /**
             * Calculates the dot product with another vector.
             *
             * @method dot
             * @memberOf ran.la.Vector
             * @param {ran.la.Vector} vec Vector to multiply with.
             * @returns {number} The dot product.
             * @example
             *
             * let v = new ran.la.Vector([1, 2, 3])
             * let w = new ran.la.Vector([4, 5, 6])
             * v.dot(w)
             * // => 32
             *
             */
            dot(vec) {
                let v = vec.v();
                return this._v.reduce((sum, d, i) => sum + d * v[i], 0);
            }
        }

        /**
         * Class representing an immutable real square matrix.
         *
         * @class Matrix
         * @memberOf ran.la
         * @param {(number|Array|ran.la.Matrix)=} arg The constructor argument. If it is a number, it sets the
         * linear dimension of the matrix. If it is an array of arrays, the matrix is initialized with the array
         * elements. If it is another matrix, it is copied to this matrix. If not specified, a 3x3 identity matrix is
         * created.
         * @constructor
         * @example
         *
         * let M1 = new ran.la.Matrix()
         * let M2 = new ran.la.Matrix(3)
         * let M3 = new ran.la.Matrix([[1, 0, 0], [0, 1, 0], [0, 0, 1]])
         * let M4 = new ran.la.Matrix(M1)
         * //    ┌         ┐
         * //    │ 1  0  0 │
         * // => │ 0  1  0 │
         * //    │ 0  0  1 │
         * //    └         ┘
         *
         */
        class Matrix {
            constructor(arg) {
                if (typeof arg === 'number') {
                    this._m = Array.from({length: arg}, () => new Array(arg).fill(0));
                    for (let i = 0; i < arg; i++) {
                        this._m[i][i] = 1;
                    }
                } else if (Array.isArray(arg)) {
                    this._m = arg;
                } else if (typeof arg === 'object' && Array.isArray(arg._m)) {
                    this._m = arg._m;
                } else {
                    this._m = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
                }
            }

            /**
             * Returns the matrix as an array of arrays.
             *
             * @method m
             * @memberOf ran.la.Matrix
             * @returns {Array[]} The matrix in an array of array representation.
             * @example
             *
             * let M = new ran.la.Matrix()
             * M.m()
             * // => [ [ 1, 0, 0 ],
             * //      [ 0, 1, 0 ],
             * //      [ 0, 0, 1 ] ]
             *
             */
            m() {
                return this._m.map(d => d.slice());
            }

            /**
             * Returns or sets an element of the matrix.
             *
             * @method ij
             * @memberOf ran.la.Matrix
             * @param {number} i Row index of the element.
             * @param {number} j Column index of the element.
             * @param {number=} e The new value of the element at the i-th row and j-th column. If not specified,
             * the value at (i, j) is returned.
             * @example
             *
             * let M = new ran.la.Matrix()
             *
             * M.ij(1, 1)
             * // => 1
             *
             * M.ij(1, 2)
             * // => 0
             *
             * M.ij(1, 2, 5)
             * //    ┌         ┐
             * //    │ 1  0  0 │
             * // => │ 0  1  0 │
             * //    │ 0  5  1 │
             * //    └         ┘
             *
             */
            ij(i, j, e) {
                if (e !== undefined) {
                    this._m[i][j] = e;
                } else {
                    return this._m[i][j];
                }
            }

            /**
             * Performs an operation on the matrix element-wise.
             *
             * @method f
             * @memberOf ran.la.Matrix
             * @param {Function} func Function to apply on each element.
             * @returns {ran.la.Matrix} The transformed matrix.
             * @example
             *
             * let M = new ran.la.Matrix([[1, 2], [3, 4]])
             * M.f(d => d * d)
             * //    ┌      ┐
             * // => │ 1  4 │
             * //    │ 9 16 │
             * //    └      ┘
             *
             */
            f(func) {
                return new Matrix(this._m.map(row => row.map(d => func(d))));
            }

            /**
             * Multiplies the matrix with a scalar.
             *
             * @method scale
             * @memberOf ran.la.Matrix
             * @param {number} s The scalar to multiply matrix with.
             * @returns {ran.la.Matrix} The scaled matrix.
             * @example
             *
             * let M = new ran.la.Matrix([[1, 2], [3, 4]])
             * M.scale(2)
             * //    ┌      ┐
             * // => │ 2  4 │
             * //    │ 6  8 │
             * //    └      ┘
             *
             */
            scale(s) {
                return this.f(x => x*s);
            }

            /**
             * Adds another matrix to the current matrix.
             *
             * @method add
             * @memberOf ran.la.Matrix
             * @param {ran.la.Matrix} mat The matrix to add.
             * @returns {ran.la.Matrix} The sum of the two matrices.
             * @example
             *
             * let M = new ran.la.Matrix([[1, 2], [3, 4]])
             * let N = new ran.la.Matrix([[5, 6], [7, 8]])
             * M.add(N)
             * //    ┌        ┐
             * // => │  6   8 │
             * //    │ 10  12 │
             * //    └        ┘
             *
             */
            add(mat) {
                let m = mat.m();
                return new Matrix(this._m.map((row, i) => row.map((d, j) => d + m[i][j])));
            }

            /**
             * Multiplies the matrix with another matrix (from the right).
             *
             * @method mult
             * @memberOf ran.la.Matrix
             * @param {ran.la.Matrix} mat Matrix to multiply current matrix with.
             * @returns {ran.la.Matrix} The product matrix.
             * @example
             *
             * let M = new ran.la.Matrix([[1, 2], [3, 4]])
             * let N = new ran.la.Matrix([[5, 6], [7, 8]])
             * M.mult(N)
             * //    ┌        ┐
             * // => │ 19  22 │
             * //    │ 43  50 │
             * //    └        ┘
             *
             */
            mult(mat) {
                let m = mat.m();
                let n = this._m.length;
                let r = new Matrix(n);
                for (let i=0; i<n; i++) {
                    for (let j=0; j<n; j++) {
                        let rij = 0;
                        for (let k=0; k<n; k++) {
                            rij += this._m[i][k] * m[k][j];
                        }
                        r.ij(i, j, rij);
                    }
                }
                return r;
            }

            /**
             * Returns the transpose of the matrix.
             *
             * @method t
             * @memberOf ran.la.Matrix
             * @returns {ran.la.Matrix} The transposed matrix.
             * @example
             *
             * let M = new ran.la.Matrix([[1, 2], [3, 4]])
             * M.t()
             * //    ┌      ┐
             * // => │ 1  3 │
             * //    │ 2  4 │
             * //    └      ┘
             *
             */
            t() {
                return new Matrix(this._m[0].map((col, i) => this._m.map(row => row[i])));
            }

            /**
             * Multiplies a vector with the matrix (acts this matrix on a vector).
             *
             * @method act
             * @memberOf ran.la.Matrix
             * @param {ran.la.Vector} vec Vector to act matrix on.
             * @returns {ran.la.Vector} The mapped vector.
             * @example
             *
             * let M = new ran.la.Matrix([[1, 2], [3, 4]])
             * let v = new ran.la.Vector([5, 6])
             * M.act(v)
             * // => ( 17, 39 )
             *
             */
            act(vec) {
                return new Vector(this._m.map(d => vec.dot(new Vector(d))));
            }

            /**
             * Performs the [LDL decomposition]{@link https://en.wikipedia.org/wiki/Cholesky_decomposition} of the
             * matrix.
             *
             * @method ldl
             * @memberOf ran.la.Matrix
             * @returns {Object} Object containing two properties: {D} and {L} representing the corresponding matrices
             * in the LDL decomposition.
             * @example
             *
             * let M = new Matrix([[4, 12, -16], [12, 37, -43], [-16, -43, 98]])
             * M.ldl()
             * //        ┌          ┐       ┌         ┐
             * //        │  1  0  0 │       │ 4  0  0 │
             * // => L = │  3  1  0 │,  D = │ 0  1  0 │
             * //        │ -4  5  1 │       │ 0  0  9 │
             * //        └          ┘       └         ┘
             *
             */
            ldl() {
                // Init D, L
                let n = this._m.length,
                    D = new Matrix(n),
                    L = new Matrix(n);

                // Perform decomposition
                for (let j=0; j<n; j++) {
                    // Update D
                    let dj = this.ij(j, j);
                    for (let k=0; k<j; k++) {
                        dj -= D.ij(k, k) * L.ij(j, k)*L.ij(j, k);
                    }
                    D.ij(j, j, dj);

                    // Update L
                    for (let i=n-1; i>j; i--) {
                        let lij = this.ij(i, j);
                        for (let k=0; k<j; k++) {
                            lij -= D.ij(k, k) * L.ij(i, k)*L.ij(j, k);
                        }
                        L.ij(i, j, lij / dj);
                    }
                }

                return {
                    D,
                    L
                };
            }
        }

        // Exposed classes
        return {
            Vector,
            Matrix
        };
    })();

    /**
     * Module containing some special functions.
     *
     * @namespace special
     * @memberOf ran
     * @private
     */
    let special = (function () {
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
        let betaIncomplete = (function() {
            const _FPMIN = 1e-30;

            // Incomplete beta generator using the continued fraction expansion
            function _biContinuedFraction(a, b, x) {
                let qab = a + b,
                    qap = a + 1,
                    qam = a - 1,
                    c = 1,
                    d = 1 - qab * x / qap;
                if (Math.abs(d) < _FPMIN)
                    d = _FPMIN;
                d = 1 / d;
                let h = d;

                for (let i = 1; i < _MAX_ITERATIONS; i++) {
                    let m2 = 2 * i,
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
                    let del = d * c;
                    h *= del;
                    if (Math.abs(del - 1) < _EPSILON)
                        break;
                }
                return h;
            }

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
            return Math.exp(gammaLn(x) + gammaLn(y) - gammaLn(x + y))
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

    /**
     * Core random generators and manipulators.
     *
     * @namespace core
     * @memberOf ran
     */
    let core = (function () {
        /**
         * Generates some uniformly distributed random floats in (min, max).
         * If min > max, a random float in (max, min) is generated.
         * If no parameters are passed, generates a single random float between 0 and 1.
         * If only min is specified, generates a single random float between 0 and min.
         *
         * @method float
         * @memberOf ran.core
         * @param {number=} min Lower boundary, or upper if max is not given.
         * @param {number=} max Upper boundary.
         * @param {number=} n Number of floats to generate.
         * @returns {(number|Array)} Single float or array of random floats.
         * @example
         *
         * ran.core.float()
         * // => 0.278014086611011
         *
         * ran.core.float(2)
         * // => 1.7201255276155272
         *
         * ran.core.float(2, 3)
         * // => 2.3693449236256185
         *
         * ran.core.float(2, 3, 5)
         * // => [ 2.4310443387740093,
         * //      2.934333354639414,
         * //      2.7689523358767127,
         * //      2.291137165632517,
         * //      2.5040591952427906 ]
         *
         */
        function float(min, max, n) {
            if (arguments.length === 0)
                return Math.random();
            if (arguments.length === 1)
                return Math.random() * min;
            return _some(() => _r(min, max), n);
        }

        /**
         * Generates some uniformly distributed random integers in (min, max).
         * If min > max, a random integer in (max, min) is generated.
         * If only min is specified, generates a single random integer between 0 and min.
         *
         * @method int
         * @memberOf ran.core
         * @param {number} min Lower boundary, or upper if max is not specified.
         * @param {number=} max Upper boundary.
         * @param {number=} n Number of integers to generate.
         * @returns {(number|Array)} Single integer or array of random integers.
         * @example
         *
         * ran.core.int(10)
         * // => 2
         *
         * ran.core.int(10, 20)
         * //=> 12
         *
         * ran.core.int(10, 20, 5)
         * // => [ 12, 13, 10, 14, 14 ]
         *
         */
        function int(min, max, n) {
            if (arguments.length === 1)
                return Math.floor(Math.random() * (min + 1));
            return _some(() => Math.floor(_r(min, max + 1)), n);
        }

        /**
         * Samples some elements with replacement from an array with uniform distribution.
         *
         * @method choice
         * @memberOf ran.core
         * @param {Array} values Array to sample from.
         * @param {number=} n Number of elements to sample.
         * @returns {(object|Array)} Single element or array of sampled elements.
         * If array is invalid, null pointer is returned.
         * @example
         *
         * ran.core.choice([1, 2, 3, 4, 5])
         * // => 2
         *
         * ran.core.choice([1, 2, 3, 4, 5], 5)
         * // => [ 1, 5, 4, 4, 1 ]
         */
        function choice(values, n) {
            if (values === null || values === undefined || values.length === 0)
                return null;
            return _some(() => values[Math.floor(Math.random() * values.length)], n);
        }

        /**
         * Samples some characters with replacement from a string with uniform distribution.
         *
         * @method char
         * @memberOf ran.core
         * @param {string} string String to sample characters from.
         * @param {number=} n Number of characters to sample.
         * @returns {(string|Array)} Random character if n is not given or less than 2, an array of random characters
         * otherwise. If string is empty, null is returned.
         * @example
         *
         * ran.core.char('abcde')
         * // => 'd'
         *
         * ran.core.char('abcde', 5)
         * // => [ 'd', 'c', 'a', 'a', 'd' ]
         *
         */
        function char(string, n) {
            if (string === null || string === undefined || string.length === 0)
                return null;
            return _some(() => string.charAt(Math.floor(Math.random() * string.length)), n);
        }

        /**
         * Shuffles an array in-place using the Fisher--Yates algorithm.
         *
         * @method shuffle
         * @memberOf ran.core
         * @param {Array} values Array to shuffle.
         * @returns {Array} The shuffled array.
         * @example
         *
         * ran.core.shuffle([1, 2, 3])
         * // => [ 2, 3, 1 ]
         *
         */
        function shuffle(values) {
            let i, tmp, l = values.length;
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
         * @memberOf ran.core
         * @param {object} head Head value.
         * @param {object} tail Tail value.
         * @param {number=} p Bias (probability of head). Default is 0.5.
         * @param {number=} n Number of coins to flip. Default is 1.
         * @returns {(object|Array)} Single head/tail value or an array of head/tail values.
         * @example
         *
         * ran.core.coin('a', {b: 2})
         * // => { b: 2 }
         *
         * ran.core.coin('a', {b: 2}, 0.9)
         * // => 'a'
         *
         * ran.core.coin('a', {b: 2}, 0.9, 9)
         * // => [ { b: 2 }, 'a', 'a', 'a', 'a', 'a', 'a', { b: 2 }, 'a' ]
         */
        function coin(head, tail, p = 0.5, n = 1) {
            return _some(() => Math.random() < p ? head : tail, n);
        }

        // Public methods
        return {
            float,
            int,
            choice,
            char,
            shuffle,
            coin
        };
    })();

    /**
     * A collection of random number generators for well-known distributions.
     *
     * @namespace dist
     * @memberOf ran
     */
    let dist = (function () {
        /**
         * Table containing critical values for the chi square test at 99% of confidence for low degrees of freedom.
         *
         * @var {Array} _CHI_TABLE_LO
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
        ];

        /**
         * Table containing critical values for the chi square test at 95% of confidence for high degrees of freedom.
         *
         * @var {Array} _CHI_TABLE_HI
         * @memberOf ran.dist
         * @private
         */
        const _CHI_TABLE_HI = [
            359.906, 414.474, 468.724, 522.717, 576.493, 630.084, 683.516, 736.807, 789.974, 843.029,
            895.984, 948.848, 1001.630, 1054.334, 1106.969
        ];

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
            let u = Math.random(),
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
                let d = alpha - 1 / 3,
                    c = 1 / Math.sqrt(9 * d),
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
         * Performs a chi square test for an array of values and a probability mass function.
         *
         * @method _chiTest
         * @memberOf ran.dist
         * @param values {Array} Array of values to perform test for.
         * @param pmf {Function} Probability mass function to perform test against.
         * @param c {number} Number of parameters for the distribution.
         * @returns {{statistics: number, passed: boolean}} Test results, containing the raw chi square statistics and a
         * boolean to tell whether the distribution passed the test.
         * @private
         */
        function _chiTest(values, pmf, c) {
            // Calculate observed distribution
            let p = {};
            values.forEach(function (v) {
                p[v] = p[v] ? p[v] + 1 : 1;
            });

            // Calculate chi-square sum
            let chi2 = 0,
                n = values.length;
            for (let x in p) {
                if (p.hasOwnProperty(x)) {
                    let m = pmf(parseInt(x)) * n;
                    chi2 += Math.pow(p[x] - m, 2) / m;
                }
            }

            // Get critical value
            let df = Math.max(1, Object.keys(p).length - c - 1),
                crit = df <= 250 ? _CHI_TABLE_LO[df] : _CHI_TABLE_HI[Math.floor(df / 50)];

            // Return comparison results
            return {
                statistics: chi2,
                passed: chi2 <= crit
            };
        }

        /**
         * Performs a Kolmogorov-Smirnov test for an array of values and a cumulative distribution function.
         *
         * @method _ksTest
         * @memberOf ran.dist
         * @param values {Array} Array of values to perform test for.
         * @param cdf {Function} Cumulative distribution function to perform test against.
         * @returns {{statistics: number, passed: boolean}} Test results, containing the raw K-S statistics and a
         * boolean to tell whether the distribution passed the test.
         * @private
         */
        function _ksTest(values, cdf) {
            // Sort values for estimated CDF
            values.sort((a, b) => a - b);

            // Calculate D value
            let D = 0;
            for (let i = 0; i < values.length; i++) {
                D = Math.max(D, Math.abs((i + 1) / values.length - cdf(values[i])));
            }

            // Return comparison results
            return {
                statistics: D,
                passed: D <= 1.628 / Math.sqrt(values.length)
            };
        }

        /**
         * The distribution generator base class, all distribution generators extend this class. The methods listed here
         * are available for all distribution generators. The examples provided for this class are using a Pareto
         * distribution.
         *
         * @class Distribution
         * @memberOf ran.dist
         * @constructor
         */
        class Distribution {
            constructor(type, k) {
                this.type = type;
                this.k = k;
                this.p = [];
                this.c = [];
            }

            _generator() {
                throw Error('Distribution._generator is not implemented');
            }

            /**
             * The probability distribution or probability mass function.
             *
             * @method _pdf
             * @memberOf ran.dist.Distribution
             * @param {number } x Value to evaluate the distribution/mass function at.
             * @returns {number} The probability density or probability at the specified value.
             * @private
             */
            _pdf(x) {
                throw Error('Distribution._pdf is not implemented');
            }

            /**
             * The probability distribution function.
             *
             * @method _cdf
             * @memberOf ran.dist.Distribution
             * @param {number } x Value to evaluate the probability distribution at.
             * @returns {number} The value of the probability function at the specified value.
             * @private
             */
            _cdf(x) {
                throw Error('Distribution._cdf is not implemented');
            }

            /**
             * Generates some random variate.
             *
             * @method sample
             * @memberOf ran.dist.Distribution
             * @param {number=} n Number of variates to generate. If not specified, a single value is returned.
             * @returns {(number|Array)} Single sample or an array of samples.
             * @example
             *
             * let pareto = new ran.dist.Pareto(1, 2)
             * pareto.sample(5)
             * // => [ 5.619011325146519,
             * //      1.3142187491180493,
             * //      1.0513159445581859,
             * //      1.8124951360943067,
             * //      1.1694087449301402 ]
             *
             */
            sample(n) {
                return _some(() => this._generator(), n);
            }

            /**
             * [Probability density function]{@link https://en.wikipedia.org/wiki/Probability_density_function}. In case of discrete distributions, it is the [probability mass function]{@link https://en.wikipedia.org/wiki/Probability_mass_function}.
             *
             * @method pdf
             * @memberOf ran.dist.Distribution
             * @param {number} x Value to evaluate distribution at.
             * @returns {number} The probability density or probability mass.
             * @example
             *
             * let pareto = new ran.dist.Pareto(1, 2)
             * pareto.pdf(3)
             * // => 0.07407407407407407
             *
             */
            pdf(x) {
                return this._pdf(x);
            }

            /**
             * The [cumulative distribution function]{@link https://en.wikipedia.org/wiki/Cumulative_distribution_function}:
             *
             * $$F(x) = \int_{-\infty}^x f(t) \,\mathrm{d}t,$$
             *
             * if the distribution is continuous and
             *
             * $$F(x) = \sum_{x_i < x} f(x_i),$$
             *
             * if it is discrete. The functions \(f(t)\) and \(f(x_i)\) denote the probability density and mass functions.
             *
             * @method cdf
             * @memberOf ran.dist.Distribution
             * @param {number} x Value to evaluate CDF at.
             * @returns {number} The cumulative distribution value.
             * @example
             *
             * let pareto = new ran.dist.Pareto(1, 2)
             * pareto.cdf(3)
             * // => 0.8888888888888888
             *
             */
            cdf(x) {
                return this._cdf(x);
            }

            /**
             * The [survival function]{@link https://en.wikipedia.org/wiki/Survival_function}:
             *
             * $$S(x) = 1 - F(x),$$
             *
             * where \(F(x)\) denotes the cumulative distribution function.
             *
             * @method survival
             * @memberOf ran.dist.Distribution
             * @param {number} x Value to evaluate survival function at.
             * @returns {number} The survival value.
             * @example
             *
             * let pareto = new ran.dist.Pareto(1, 2)
             * pareto.survival(3)
             * // => 0.11111111111111116
             *
             */
            survival(x) {
                return 1 - this._cdf(x);
            }

            /**
             * The [hazard function]{@link https://en.wikipedia.org/wiki/Failure_rate}:
             *
             * $$\lambda(x) = \frac{f(x)}{S(x)},$$
             *
             * where \(f(x)\) and \(S(x)\) are the probability density (or mass) function and the survival function, respectively.
             *
             * @method hazard
             * @memberOf ran.dist.Distribution
             * @param {number} x Value to evaluate the hazard at.
             * @returns {number} The hazard value.
             * @example
             *
             * let pareto = new ran.dist.Pareto(1, 2)
             * pareto.hazard(3)
             * // => 0.6666666666666663
             *
             */
            hazard(x) {
                return this._pdf(x) / this.survival(x);
            }

            /**
             * The [cumulative hazard function]{@link https://en.wikipedia.org/wiki/Survival_analysis#Hazard_function_and_cumulative_hazard_function}:
             *
             * $$\Lambda(x) = \int_0^x \lambda(t) \,\mathrm{d}t,$$
             *
             * where \(\lambda(x)\) is the hazard function.
             *
             * @method cHazard
             * @memberOf ran.dist.Distribution
             * @param {number} x Value to evaluate cumulative hazard at.
             * @returns {number} The cumulative hazard.
             * @example
             *
             * let pareto = new ran.dist.Pareto(1, 2)
             * pareto.cHazard(3)
             * // => 2.197224577336219
             *
             */
            cHazard(x) {
                return -Math.log(this.survival(x));
            }

            /**
             * The [logarithmic probability density function]{@link https://en.wikipedia.org/wiki/Log_probability}.
             * For discrete distributions, this is the logarithm of the probability mass function.
             *
             * @method logPdf
             * @memberOf ran.dist.Distribution
             * @param {number} x Value to evaluate the log pdf at.
             * @returns {number} The logarithmic probability density (or mass).
             * @example
             *
             * let pareto = new ran.dist.Pareto(1, 2)
             * pareto.lnPdf(3)
             * // => -2.6026896854443837
             *
             */
            lnPdf(x) {
                return Math.log(this._pdf(x));
            }

            /**
             * The [log-likelihood]{@link https://en.wikipedia.org/wiki/Likelihood_function#Log-likelihood} of the
             * current distribution based on some data. More precisely:
             *
             * $$\ln L(\theta | X) = \sum_{x \in X} \ln f(x; \theta),$$
             *
             * where \(X\) is the set of observations (sample) and \(\theta\) is the parameter vector of the
             * distribution. The function \(f(x)\) denotes the probability density/mass function.
             *
             * @method L
             * @memberOf ran.dist.Distribution
             * @param {Array} data Array of numbers to calculate log-likelihood for.
             * @return {number} The value of log-likelihood.
             * @example
             *
             * let pareto = new ran.dist.Pareto(1, 2)
             * let uniform = new ran.dist.UniformContinuous(1, 10);
             *
             * let sample1 = pareto.sample(100)
             * pareto.L(sample1)
             * // => -104.55926409382
             *
             * sample2 = uniform.sample(100)
             * pareto.L(sample2)
             * // => -393.1174868780569
             *
             */
            L(data) {
                return data.reduce((sum, d) => sum + this.lnPdf(d), 0);
            }

            /**
             * Tests if an array of values is sampled from the specified distribution. For discrete distributions this
             * method uses \(\chi^2\) test, whereas for continuous distributions it uses the Kolmogorov-Smirnov test.
             *
             * @method test
             * @memberOf ran.dist.Distribution
             * @param {Array} values Array of values to test.
             * @returns {Object} Object with two properties representing the result of the test:
             * <ul>
             *     <li>{statistics}: The \(\chi^2\) or D statistics depending on whether the distribution is discrete or
             *     continuous.</li>
             *     <li>{passed}: Whether the sample passed the null hypothesis that it is sampled from the current
             *     distribution.</li>
             * </ul>
             * @example
             *
             * let pareto = new ran.dist.Pareto(1, 2)
             * let uniform = new ran.dist.UniformContinuous(1, 10);
             *
             * let sample1 = pareto.sample(100)
             * pareto.test(sample1)
             * // => { statistics: 0.08632443341496943, passed: true }
             *
             * sample2 = uniform.sample(100)
             * pareto.test(sample2)
             * // => { statistics: 0.632890888159255, passed: false }
             *
             */
            test(values) {
                return this.type === "discrete"
                    ? _chiTest(values, x => this._pdf(x), this.k)
                    : _ksTest(values, x => this._cdf(x));
            }
        }

        // TODO Benford https://en.wikipedia.org/wiki/Benford%27s_law#Generalization_to_digits_beyond_the_first | F. Benford. The law of anomalous numbers. Proceedings of the American Philosophical Society, 78(4) pp 551-572 (1938)
        // TODO Beta-binomial (https://en.wikipedia.org/wiki/Beta-binomial_distribution)
        // TODO Beta-pascal
        // TODO Discrete Weibull
        // TODO Gamma-Poisson
        // TODO Geometric
        // TODO Hypergeometric (https://en.wikipedia.org/wiki/Hypergeometric_distribution)
        // TODO Poisson-binomial (https://en.wikipedia.org/wiki/Poisson_binomial_distribution)
        // TODO Logarithm
        // TODO Negative hypergeometric
        // TODO Pascal (negative binomial)
        // TODO Polya
        // TODO Power series
        // TODO Rectangular
        // TODO Zeta
        // TODO Zipf https://en.wikipedia.org/wiki/Zipf%27s_law |
        // TODO Chi
        // TODO Doubly non-central F
        // TODO Doubly non-central t
        // TODO Error (exponential power)
        // TODO Exponential power
        // TODO Gamma-normal
        // TODO Generalized Pareto
        // TODO Hyperbolic-secant
        // TODO Hyperexponential
        // TODO Hypoexponential
        // TODO IDB
        // TODO Inveretd beta
        // TODO Kolmogorov-Smirnov
        // TODO Log gamma
        // TODO Log logistic
        // TODO Logistic
        // TODO Logistic-exponential
        // TODO Lomax
        // TODO Minimax
        // TODO Muth
        // TODO Noncentral beta
        // TODO Noncentral chi-square
        // TODO Noncentral F
        // TODO Noncentral t
        // TODO Rademacher (https://en.wikipedia.org/wiki/Rademacher_distribution)
        // TODO Rayleigh
        // TODO Standard Cauchy
        // TODO Standard power
        // TODO Standard triangular
        // TODO t
        // TODO triangular
        // TODO two-sided power
        // TODO von Mises
        // TODO Wald

        /**
         * Generator for the [generalized arcsine distribution]{@link https://en.wikipedia.org/wiki/Arcsine_distribution#Arbitrary_bounded_support}:
         *
         * $$f(x; a, b) = \frac{1}{\pi \sqrt{(x -a) (b - x)}},$$
         *
         * where \(a, b \in \mathbb{R}\) and \(a < b\). Support: \(x \in [a, b]\).
         *
         * @class Arcsine
         * @memberOf ran.dist
         * @param {number} a Lower boundary.
         * @param {number} b Upper boundary.
         * @constructor
         */
        class Arcsine extends Distribution {
            constructor(a, b) {
                super('continuous', arguments.length);
                this.p = {a, b};
                this.c = [1 / Math.PI, b - a];
            }

            _generator() {
                let s = Math.sin(0.5 * Math.PI * Math.random());
                return (s * s) * this.c[1] + this.p.a;
            }

            _pdf(x) {
                return x >= this.p.a && x < this.p.b ? this.c[0] / Math.sqrt((x - this.p.a) * (this.p.b - x)) : 0;
            }

            _cdf(x) {
                return x >= this.p.a && x < this.p.b ? 2 * this.c[0] * Math.asin(Math.sqrt((x - this.p.a) / (this.p.b - this.p.a))) : 0;
            }
        }

        /**
         * Generator for the [Bernoulli distribution]{@link https://en.wikipedia.org/wiki/Bernoulli_distribution}:
         *
         * $$f(k; p) = \begin{cases}p &\quad\text{if $k = 1$}\\1 - p &\quad\text{if $k = 0$}\\\end{cases}$$
         *
         * where \(p \in [0, 1]\). Support: \(k \in \{0, 1\}\).
         *
         * @class Bernoulli
         * @memberOf ran.dist
         * @param {number} p Probability of the outcome 1.
         * @constructor
         */
        class Bernoulli extends Distribution {
            constructor(p) {
                super("discrete", arguments.length);
                this.p = {p};
            }

            _generator() {
                return Math.random() < this.p.p ? 1 : 0;
            }

            _pdf(x) {
                return parseInt(x) === 1 ? this.p.p : 1 - this.p.p;
            }

            _cdf(x) {
                return x < 0 ? 0 : (parseInt(x) >= 1 ? 1 : 1 - this.p.p);
            }
        }

        /**
         * Generator for the [beta distribution]{@link https://en.wikipedia.org/wiki/Beta_distribution}:
         *
         * $$f(x; \alpha, \beta) = \frac{x^{\alpha - 1}(1 - x)^{\beta - 1}}{\mathrm{B}(\alpha, \beta)},$$
         *
         * with \(\alpha, \beta \in \mathbb{R}^+\) and \(\mathrm{B}(\alpha, \beta)\) is the beta function.
         * Support: \(x \in [0, 1]\).
         *
         *
         * @class Beta
         * @memberOf ran.dist
         * @param {number} alpha First shape parameter.
         * @param {number} beta Second shape parameter.
         * @constructor
         */
        class Beta extends Distribution {
            constructor(alpha, beta) {
                super("continuous", arguments.length);
                this.p = {alpha, beta};
                this.c = [special.beta(alpha, beta)];
            }

            _generator() {
                let x = _gamma(this.p.alpha, 1),
                    y = _gamma(this.p.beta, 1);
                return x / (x + y);
            }

            _pdf(x) {
                return Math.pow(x, this.p.alpha - 1) * Math.pow(1 - x, this.p.beta - 1) / this.c[0];
            }

            _cdf(x) {
                return x <= 0 ? 0 : x >= 1 ? 1 : special.betaIncomplete(this.p.alpha, this.p.beta, x);
            }
        }

        /**
         * Generator for the [beta prime distribution]{@link https://en.wikipedia.org/wiki/Beta_prime_distribution}:
         *
         * $$f(x; \alpha, \beta) = \frac{x^{\alpha - 1}(1 - x)^{-\alpha - \beta}}{\mathrm{B}(\alpha, \beta)},$$
         *
         * with \(\alpha, \beta \in \mathbb{R}^+\) and \(\mathrm{B}(\alpha, \beta)\) is the beta function.
         * Support: \(x \in \mathbb{R}^+\).
         *
         *
         * @class BetaPrime
         * @memberOf ran.dist
         * @param {number} alpha First shape parameter.
         * @param {number} beta Second shape parameter.
         * @constructor
         */
        class BetaPrime extends Distribution {
            constructor(alpha, beta) {
                super('continuous', arguments.length);
                this.p = {alpha, beta};
            }

            _generator() {
                return _gamma(this.p.alpha, 1) / _gamma(this.p.beta, 1);
            }

            _pdf(x) {
                return x > 0 ? Math.pow(x, this.p.alpha - 1) * Math.pow(1 + x, -this.p.alpha - this.p.beta) / special.beta(this.p.alpha, this.p.beta) : 0;
            }

            _cdf(x) {
                return x > 0 ? special.betaIncomplete(this.p.alpha, this.p.beta, x / (1 + x)) : 0;
            }
        }

        /**
         * Generator for the [binomial distribution]{@link https://en.wikipedia.org/wiki/Binomial_distribution}:
         *
         * $$f(k; n, p) = \begin{pmatrix}n \\ k \\ \end{pmatrix} p^k (1 - p)^{n - k},$$
         *
         * with \(n \in \mathbb{N}_0\) and \(p \in [0, 1]\). Support: \(k \in \{0, ..., n\}\).
         *
         * @class Binomial
         * @memberOf ran.dist
         * @param {number} n Number of trials.
         * @param {number} p Probability of success.
         * @constructor
         */
        class Binomial extends Distribution {
            constructor(n, p) {
                super("continuous", arguments.length);
                let pp = p <= 0.5 ? p : 1 - p;
                this.p = {n, p};
                this.c = [pp, n * pp];
            }

            _generator() {
                if (this.p.n < 25) {
                    let b = 0;
                    for (let i = 1; i <= this.p.n; i++)
                        if (Math.random() < this.c[0]) b++;
                    return this.c[0] === this.p.p ? b : this.p.n - b;
                } else if (this.c[1] < 1.) {
                    let lambda = Math.exp(-this.c[1]),
                        t = 1.0,
                        i;
                    for (i = 0; i <= this.p.n; i++) {
                        t *= Math.random();
                        if (t < lambda) break;
                    }
                    let b = Math.min(i, this.p.n);
                    return this.c[0] === this.p.p ? b : this.p.n - b;
                } else {
                    let en = this.p.n,
                        g = special.gammaLn(en + 1),
                        pc = 1 - this.c[0],
                        pLog = Math.log(this.c[0]),
                        pcLog = Math.log(pc),
                        sq = Math.sqrt(2.0 * this.c[1] * pc);
                    let y, em, t;
                    do {
                        do {
                            y = Math.tan(Math.PI * Math.random());
                            em = sq * y + this.c[1];
                        } while (em < 0.0 || em >= (en + 1.0));
                        em = Math.floor(em);
                        t = 1.2 * sq * (1.0 + y * y) * Math.exp(g - special.gammaLn(em + 1.0)
                            - special.gammaLn(en - em + 1.0) + em * pLog + (en - em) * pcLog);
                    } while (Math.random() > t);
                    return this.c[0] === this.p.p ? em : this.p.n - em;
                }
            }

            _pdf(x) {
                let xi = parseInt(x);
                return xi < 0 ? 0 : xi > this.p.n ? 0 : Math.exp(special.gammaLn(this.p.n + 1) - special.gammaLn(xi + 1) - special.gammaLn(this.p.n - xi + 1)
                    + xi * Math.log(this.p.p) + (this.p.n - xi) * Math.log(1 - this.p.p));
            }

            _cdf(x) {
                let xi = parseInt(x);
                return xi < 0 ? 0 : xi >= this.p.n ? 1 : special.betaIncomplete(this.p.n - xi, 1 + xi, 1 - this.p.p);
            }
        }

        /**
         * Generator for the [bounded Pareto distribution]{@link https://en.wikipedia.org/wiki/Pareto_distribution#Bounded_Pareto_distribution}:
         *
         * $$f(x; L, H, \alpha) = \frac{\alpha L^\alpha x^{-\alpha - 1}}{1 - \big(\frac{L}{H}\big)^\alpha},$$
         *
         * with \(L, H \in \mathbb{R}^+\), \(H > L\) and \(\alpha \in \mathbb{R}^+\). Support: \(x \in [L, H]\).
         *
         * @class BoundedPareto
         * @memberOf ran.dist
         * @param {number} L Lower boundary.
         * @param {number} H Upper boundary.
         * @param {number} alpha Shape parameter.
         * @constructor
         */
        class BoundedPareto extends Distribution {
            constructor(L, H, alpha) {
                super("continuous", arguments.length);
                this.p = {L, H, alpha};
                this.c = [Math.pow(L, alpha), Math.pow(H, alpha), (1 - Math.pow(L / H, alpha))];
            }

            _generator() {
                return Math.pow((this.c[1] + Math.random() * (this.c[0] - this.c[1])) / (this.c[0] * this.c[1]), -1 / this.p.alpha);
            }

            _pdf(x) {
                return (x < this.p.L || x > this.p.H) ? 0
                    : this.p.alpha * Math.pow(this.p.L / x, this.p.alpha) / (x * this.c[2]);
            }

            _cdf(x) {
                return x < this.p.L ? 0 : (x > this.p.H ? 1 : (1 - this.c[0] * Math.pow(x, -this.p.alpha)) / (1 - this.c[0] / this.c[1]));
            }
        }

        /**
         * Generator for [Cauchy distribution]{@link https://en.wikipedia.org/wiki/Cauchy_distribution}:
         *
         * $$f(x; x_0, \gamma) = \frac{1}{\pi\gamma\bigg[1 + \Big(\frac{x - x_0}{\gamma}\Big)^2\bigg]}$$
         *
         * where \(x_0 \in \mathbb{R}\) and \(\gamma \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}\).
         *
         * @class Cauchy
         * @memberOf ran.dist
         * @param {number} x0 Location parameter.
         * @param {number} gamma Scale parameter.
         * @constructor
         */
        class Cauchy extends Distribution {
            constructor(x0, gamma) {
                super('continuous', arguments.length);
                this.p = {x0, gamma};
                this.c = [Math.PI * this.p.gamma];
            }

            _generator() {
                return this.p.x0 + this.p.gamma * (Math.tan(Math.PI * (Math.random() - 0.5)));
            }

            _pdf(x) {
                let y = (x - this.p.x0) / this.p.gamma;
                return 1 / (this.c[0] * (1 + y * y));
            }

            _cdf(x) {
                return 0.5 + Math.atan2(x - this.p.x0, this.p.gamma) / Math.PI;
            }
        }

        /**
         * Generator for a custom distribution, using the
         * [alias table method]{@link http://www.keithschwarz.com/darts-dice-coins}:
         *
         * $$f(k; \{w\}) = \frac{w_k}{\sum_j w_j},$$
         *
         * where \(w_k \in \mathbb{R}^+\). Support: \(k \in \mathbb{N}_0\).
         *
         * @class Custom
         * @memberOf ran.dist
         * @param {Array} weights Weights for the distribution (doesn't need to be normalized).
         * @constructor
         */
        class Custom extends Distribution {
            constructor(weights) {
                super("discrete", arguments.length);
                this.p = {n: weights.length, weights};

                // Pre-compute tables
                let n = weights.length,
                    prob = [0],
                    alias = [0],
                    sum = 0;
                if (weights.length > 1) {
                    // Get sum (for normalization)
                    for (let i = 0; i < n; i++)
                        sum += weights[i];

                    // Fill up small and large work lists
                    let p = [],
                        small = [],
                        large = [];
                    for (let i = 0; i < n; i++) {
                        p.push(n * weights[i] / sum);
                        if (p[i] < 1.0)
                            small.push(i);
                        else
                            large.push(i);
                    }

                    // Init tables
                    prob = [];
                    alias = [];
                    for (let i = 0; i < n; i++) {
                        prob.push(1.0);
                        alias.push(i);
                    }

                    // Fill up alias table
                    let s = 0,
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
                let pmf = [weights[0] / sum],
                    cdf = [weights[0] / sum];
                for (let i = 1; i < weights.length; i++) {
                    pmf.push(weights[i] / sum);
                    cdf.push(cdf[i - 1] + weights[i] / sum);
                }

                // Assign to constants
                this.c = [prob, alias, pmf, cdf];
            }

            _generator() {
                if (this.p.n <= 1) {
                    return 0;
                }
                let i = Math.floor(Math.random() * this.p.n);
                if (Math.random() < this.c[0][i])
                    return i;
                else
                    return this.c[1][i];
            }

            _pdf(x) {
                let xi = parseInt(x);
                return (xi < 0 || xi >= this.p.weights.length) ? 0 : this.c[2][xi];
            }

            _cdf(x) {
                let xi = parseInt(x);
                return xi < 0 ? 0 : xi >= this.p.weights.length ? 1 : this.c[3][xi];
            }
        }

        /**
         * Generator for the [degenerate distribution]{@link https://en.wikipedia.org/wiki/Degenerate_distribution}:
         *
         * $$f(x; x_0) = \begin{cases}1 &\quad\text{if $x = x_0$}\\0 &\quad\text{otherwise}\\\end{cases},$$
         *
         * where \(x_0 \in \mathbb{R}\). Support: \(x \in \mathbb{R}\).
         *
         * @class Degenerate
         * @memberOf ran.dist
         * @param {number} x0 Location of the distribution.
         * @constructor
         */
        class Degenerate extends Distribution {
            constructor(x0) {
                super("continuous", arguments.length);
                this.p = {x0};
            }

            _generator() {
                return this.p.x0;
            }

            _pdf(x) {
                return x === this.p.x0 ? 1 : 0;
            }

            _cdf(x) {
                return x < this.p.x0 ? 0 : 1;
            }
        }

        /**
         * Generator for the [exponential distribution]{@link https://en.wikipedia.org/wiki/Exponential_distribution}:
         *
         * $$f(x; \lambda) = \lambda e^{-\lambda x},$$
         *
         * with \(\lambda \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
         *
         * @class Exponential
         * @memberOf ran.dist
         * @param {number} lambda Rate parameter.
         * @constructor
         */
        class Exponential extends Distribution {
            constructor(lambda) {
                super("continuous", arguments.length);
                this.p = {lambda};
            }

            _generator() {
                return -Math.log(Math.random()) / this.p.lambda;
            }

            _pdf(x) {
                return this.p.lambda * Math.exp(-this.p.lambda * x);
            }

            _cdf(x) {
                return 1 - Math.exp(-this.p.lambda * x);
            }
        }

        /**
         * Generator for the [F distribution]{@link https://en.wikipedia.org/wiki/F-distribution}:
         *
         * $$f(x; d_1, d_2) = \frac{\sqrt{\frac{(d_1 x)^{d_1} d_2^{d_2}}{(d_1x + d_2)^{d_1 + d_2}}}}{x \mathrm{B}\big(\frac{d_1}{2}, \frac{d_2}{2}\big)},$$
         *
         * with \(d_1, d_2 \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
         *
         * @class F
         * @memberOf ran.dist
         * @param {number} d1 First degree of freedom.
         * @param {number} d2 Second degree of freedom.
         * @constructor
         */
        class F extends Distribution {
            constructor(d1, d2) {
                super('continuous', arguments.length);
                this.p = {d1, d2};
                this.c = [special.beta(d1 / 2, d2 / 2), Math.pow(d2, d2)];
            }

            _generator() {
                return this.p.d2 * _gamma(this.p.d1 / 2, 1) / (this.p.d1 * _gamma(this.p.d2 / 2, 1));
            }

            _pdf(x) {
                return x > 0 ? Math.sqrt(Math.pow(this.p.d1*x, this.p.d1) * this.c[1] / Math.pow(this.p.d1 * x + this.p.d2, this.p.d1 + this.p.d2)) / (x * this.c[0]) : 0;
            }

            _cdf(x) {
                return x > 0 ? special.betaIncomplete(this.p.d1 / 2, this.p.d2 / 2, this.p.d1 * x / (this.p.d1*x + this.p.d2)) : 0;
            }
        }

        /**
         * Generator for the [Fréchet distribution]{@link https://en.wikipedia.org/wiki/Fréchet_distribution}:
         *
         * $$f(x; \alpha, s, m) = \frac{\alpha z^{-1 -\alpha} e^{-z^{-\alpha}}}{s},$$
         *
         * with \(z = \frac{x - m}{s}\). and \(\alpha, s \in \mathbb{R}^+\), \(m \in \mathbb{R}\). Support: \(x \in \mathbb{R}, x > m\).
         *
         * @class Frechet
         * @memberOf ran.dist
         * @param {number} alpha Shape parameter.
         * @param {number} s Scale parameter.
         * @param {number} m Location parameter.
         * @constructor
         */
        class Frechet extends Distribution {
            constructor(alpha, s, m) {
                super('continuous', arguments.length);
                this.p = {alpha, s, m};
            }

            _generator() {
                return this.p.m + this.p.s * Math.pow(-Math.log(Math.random()), -1 / this.p.alpha);
            }

            _pdf(x) {
                if (x <= this.p.m) {
                    return 0;
                } else {
                    let z = (x - this.p.m) / this.p.s;
                    return this.p.alpha * Math.pow(z, -1 - this.p.alpha) * Math.exp(-Math.pow(z, -this.p.alpha)) / this.p.s;
                }
            }

            _cdf(x) {
                return x <= this.p.m ? 0 : Math.exp(-Math.pow((x - this.p.m) / this.p.s, -this.p.alpha));
            }
        }

        /**
         * Generator for the [gamma distribution]{@link https://en.wikipedia.org/wiki/Gamma_distribution} using the
         * shape/rate parametrization:
         *
         * $$f(x; \alpha, \beta) = \frac{\beta^\alpha}{\Gamma(\alpha)} x^{\alpha - 1} e^{-\beta x},$$
         *
         * where \(\alpha, \beta \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
         *
         * @class Gamma
         * @memberOf ran.dist
         * @param {number} alpha Shape parameter.
         * @param {number} beta Rate parameter.
         * @constructor
         */
        class Gamma extends Distribution {
            constructor(alpha, beta) {
                super("continuous", arguments.length);
                this.p = {alpha, beta};
                this.c = [Math.pow(beta, alpha), special.gamma(alpha)];
            }

            _generator() {
                return _gamma(this.p.alpha, this.p.beta);
            }

            _pdf(x) {
                return x <= .0 ? 0 : this.c[0] * Math.exp((this.p.alpha - 1) * Math.log(x) - this.p.beta * x) / this.c[1];
            }

            _cdf(x) {
                return special.gammaLowerIncomplete(this.p.alpha, this.p.beta * x) / this.c[1];
            }
        }

        /**
         * Generator for the [Gompertz distribution]{@link https://en.wikipedia.org/wiki/Gompertz_distribution}:
         *
         * $$f(x; \eta, b) = b \eta e^{\eta + bx - \eta e^{bx}} ,$$
         *
         * with \(\eta, b \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
         *
         * @class Gompertz
         * @memberOf ran.dist
         * @param {number} eta Shape parameter.
         * @param {number} beta Scale parameter.
         * @constructor
         */
        class Gompertz extends Distribution {
            constructor(eta, b) {
                super('continuous', arguments.length);
                this.p = {eta, b};
            }

            _generator() {
                return Math.log(1 - Math.log(Math.random()) / this.p.eta) / this.p.b;
            }

            _pdf(x) {
                return x < 0 ? 0 : this.p.b * this.p.eta * Math.exp(this.p.eta + this.p.b * x - this.p.eta * Math.exp(this.p.b * x));
            }

            _cdf(x) {
                return x < 0 ? 0 : 1 - Math.exp(-this.p.eta * (Math.exp(this.p.b * x) - 1));
            }
        }

        /**
         * Generator for the [Gumbel distribution]{@link https://en.wikipedia.org/wiki/Gumbel_distribution}:
         *
         * $$f(x; \mu, \beta) = \frac{1}{\beta} e^{-(z + e^-z)},$$
         *
         * with \(z = \frac{x - \mu}{\beta}\) and \(\mu \in \mathbb{R}\), \(\beta \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}\).
         *
         * @class Gumbel
         * @memberOf ran.dist
         * @param {number} mu Location parameter.
         * @param {number} beta Scale parameter.
         * @constructor
         */
        class Gumbel extends Distribution {
            constructor(mu, beta) {
                super('continuous', arguments.length);
                this.p = {mu, beta};
            }

            _generator() {
                return this.p.mu - this.p.beta * Math.log(-Math.log(Math.random()));
            }

            _pdf(x) {
                let z = (x - this.p.mu) / this.p.beta;
                return Math.exp(-(z + Math.exp(-z))) / this.p.beta;
            }

            _cdf(x) {
                return Math.exp(-Math.exp(-(x - this.p.mu) / this.p.beta));
            }
        }

        /**
         * Generator for the [Erlang distribution]{@link https://en.wikipedia.org/wiki/Erlang_distribution}:
         *
         * $$f(x; k, \lambda) = \frac{\lambda^k x^{k - 1} e^{-\lambda x}}{(k - 1)!},$$
         *
         * where \(k \in \mathbb{N}^+\) and \(\lambda \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
         *
         * @class Erlang
         * @memberOf ran.dist
         * @param {number} k Shape parameter. It is rounded to the nearest integer.
         * @param {number} lambda Rate parameter.
         * @constructor
         */
        class Erlang extends Gamma {
            constructor(k, lambda) {
                super(Math.round(k), lambda);
            }
        }

        /**
         * Generator for the [\(\chi^2\) distribution]{@link https://en.wikipedia.org/wiki/Chi-squared_distribution}:
         *
         * $$f(x; k) = \frac{1}{2^{k/2} \Gamma(k/2)} x^{k/2 - 1} e^{-x/2},$$
         *
         * where \(k \in \mathbb{N}^+\). Support: \(x \in \mathbb{R}^+\).
         *
         * @class Chi2
         * @memberOf ran.dist
         * @param {number} k Degrees of freedom. If not an integer, is rounded to the nearest one.
         * @constructor
         */
        class Chi2 extends Gamma {
            constructor(k) {
                super(Math.round(k) / 2, 0.5);
            }
        }

        /**
         * Generator for the [generalized gamma distribution]{@link https://en.wikipedia.org/wiki/Generalized_gamma_distribution}:
         *
         * $$f(x; a, d, p) = \frac{p/a^d}{\Gamma(d/p)} x^{d - 1} e^{-(x/a)^p},$$
         *
         * where \(a, d, p \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
         *
         * @class GeneralizedGamma
         * @memberOf ran.dist
         * @param {number} a Scale parameter.
         * @param {number} d Shape parameter.
         * @param {number} p Shape parameter.
         * @constructor
         */
        class GeneralizedGamma extends Distribution {
            constructor(a, d, p) {
                super("continuous", arguments.length);
                this.p = {a, d, p};
                this.c = [special.gamma(d / p), (p / Math.pow(a, d)), 1 / Math.pow(a, p)];
            }

            _generator() {
                return Math.pow(_gamma(this.p.d / this.p.p, this.c[2]), 1 / this.p.p);
            }

            _pdf(x) {
                return x <= .0 ? 0 : this.c[1] * Math.exp((this.p.d - 1) * Math.log(x) - Math.pow(x / this.p.a, this.p.p)) / this.c[0];
            }

            _cdf(x) {
                return special.gammaLowerIncomplete(this.p.d / this.p.p, Math.pow(x / this.p.a, this.p.p)) / this.c[0];
            }
        }

        /**
         * Generator for the [inverse gamma distribution]{@link https://en.wikipedia.org/wiki/Inverse-gamma_distribution}:
         *
         * $$f(x; \alpha, \beta) = \frac{\beta^\alpha}{\Gamma(\alpha)} x^{-\alpha - 1} e^{-\beta/x},$$
         *
         * where \(\alpha, \beta \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
         *
         * @class InverseGamma
         * @memberOf ran.dist
         * @param {number} alpha Shape parameter.
         * @param {number} beta Scale parameter.
         * @constructor
         */
        class InverseGamma extends Distribution {
            constructor(alpha, beta) {
                super("continuous", arguments.length);
                this.p = {alpha, beta};
                this.c = [Math.pow(beta, alpha) / special.gamma(alpha), special.gamma(alpha)];
            }

            _generator() {
                return 1 / _gamma(this.p.alpha, this.p.beta);
            }

            _pdf(x) {
                return x <= .0 ? 0 : this.c[0] * Math.pow(x, -1 - this.p.alpha) * Math.exp(-this.p.beta / x);
            }

            _cdf(x) {
                return 1 - special.gammaLowerIncomplete(this.p.alpha, this.p.beta / x) / this.c[1];
            }
        }

        /**
         * Generator for the [Laplace distribution]{@link https://en.wikipedia.org/wiki/Laplace_distribution}:
         *
         * $$f(x; \mu, b) = \frac{1}{2b}e^{-\frac{|x - \mu|}{b}},$$
         *
         * where \(\mu \in \mathbb{R}\) and \(b \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}\).
         *
         * @class Laplace
         * @memberOf ran.dist
         * @param {number} mu Location parameter.
         * @param {number} b Scale parameter.
         * @constructor
         */
        class Laplace extends Distribution {
            constructor(mu, b) {
                super('continuous', arguments.length);
                this.p = {mu, b};
            }

            _generator() {
                return this.p.b * Math.log(Math.random() / Math.random()) + this.p.mu;
            }

            _pdf(x) {
                return 0.5 * Math.exp(-Math.abs(x - this.p.mu) / this.p.b) / this.p.b;
            }

            _cdf(x) {
                let z = Math.exp((x - this.p.mu) / this.p.b);
                return x < this.p.mu ? 0.5 * z : 1 - 0.5 / z;
            }
        }

        class Logistic extends Distribution {
            constructor(mu, s) {
                super('continuous', arguments.length);
                this.p = {mu, s};
            }

            _generator() {
                return this.p.s * Math.log(1 / Math.random() - 1) + this.p.mu;
            }

            _pdf(x) {
                let z = Math.exp(-(x - this.p.mu) / this.p.s);
                return z / (this.p.s * Math.pow(1 + z, 2));
            }

            _cdf(x) {
                return 1 / (1 + Math.exp(-(x - this.p.mu) / this.p.s));
            }
        }

        /**
         * Generator for the [lognormal distribution]{@link https://en.wikipedia.org/wiki/Log-normal_distribution}:
         *
         * $$f(x; \mu, \sigma) = \frac{1}{x \sigma \sqrt{2 \pi}}e^{-\frac{(\ln x - \mu)^2}{2\sigma^2}},$$
         *
         * where \(\mu \in \mathbb{R}\) and \(\sigma \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+\).
         *
         * @class Lognormal
         * @memberOf ran.dist
         * @param {number} mu Location parameter.
         * @param {number} sigma Scale parameter.
         * @constructor
         */
        class Lognormal extends Distribution {
            constructor(mu, sigma) {
                super("continuous", arguments.length);
                this.p = {mu, sigma};
                this.c = [sigma * Math.sqrt(2 * Math.PI), sigma * Math.SQRT2];
            }

            _generator() {
                return Math.exp(this.p.mu + this.p.sigma * _normal(0, 1));
            }

            _pdf(x) {
                return x <= .0 ? 0 : Math.exp(-0.5 * Math.pow((Math.log(x) - this.p.mu) / this.p.sigma, 2)) / (x * this.c[0]);
            }

            _cdf(x) {
                return x <= .0 ? 0 : 0.5 * (1 + special.erf((Math.log(x) - this.p.mu) / this.c[1]));
            }
        }

        /**
         * Generator for the [normal distribution]{@link https://en.wikipedia.org/wiki/Normal_distribution}:
         *
         * $$f(x; \mu, \sigma) = \frac{1}{\sqrt{2 \pi \sigma^2}} e^{-\frac{(x - \mu)^2}{2\sigma^2}},$$
         *
         * with \(\mu \in \mathbb{R}\) and \(\sigma \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}\).
         *
         * @class Normal
         * @memberOf ran.dist
         * @param {number} mu Location parameter (mean).
         * @param {number} sigma Squared scale parameter (variance).
         * @constructor
         */
        class Normal extends Distribution {
            constructor(mu, sigma) {
                super("continuous", arguments.length);
                this.p = {mu, sigma};
                this.c = [sigma * Math.sqrt(2 * Math.PI), sigma * Math.SQRT2];
            }

            _generator() {
                return _normal(this.p.mu, this.p.sigma);
            }

            _pdf(x) {
                return Math.exp(-0.5 * Math.pow((x - this.p.mu) / this.p.sigma, 2)) / this.c[0];
            }

            _cdf(x) {
                return 0.5 * (1 + special.erf((x - this.p.mu) / this.c[1]));
            }
        }

        /**
         * Generator for the [Pareto distribution]{@link https://en.wikipedia.org/wiki/Pareto_distribution}:
         *
         * $$f(x; x_\mathrm{min}, \alpha) = \frac{\alpha x_\mathrm{min}^\alpha}{x^{\alpha + 1}},$$
         *
         * with \(x_\mathrm{min}, \alpha \in \mathbb{R}^+\). Support: \(x \in [x_\mathrm{min}, \infty)\).
         *
         * @class Pareto
         * @memberOf ran.dist
         * @param {number} xmin Scale parameter.
         * @param {number} alpha Shape parameter.
         * @constructor
         */
        class Pareto extends Distribution {
            constructor(xmin, alpha) {
                super("continuous", arguments.length);
                this.p = {xmin, alpha};
            }

            _generator() {
                return this.p.xmin / Math.pow(Math.random(), 1 / this.p.alpha);
            }

            _pdf(x) {
                return x < this.p.xmin ? 0 : this.p.alpha * Math.pow(this.p.xmin / x, this.p.alpha) / x;
            }

            _cdf(x) {
                return x < this.p.xmin ? 0 : 1 - Math.pow(this.p.xmin / x, this.p.alpha);
            }
        }

        /**
         * Generator for the [Poisson distribution]{@link https://en.wikipedia.org/wiki/Poisson_distribution}:
         *
         * $$f(k; \lambda) = \frac{\lambda^k e^{-\lambda}}{k!},$$
         *
         * with \(\lambda \in \mathbb{R}^+\). Support: \(k \in \mathbb{N}_0\).
         *
         * @class Poisson
         * @memberOf ran.dist
         * @param {number} lambda Mean of the distribution.
         * @constructor
         */
        class Poisson extends Distribution {
            constructor(lambda) {
                super("discrete", arguments.length);
                this.p = {lambda};
            }

            _generator() {
                if (this.p.lambda < 30) {
                    // Small lambda, Knuth's method
                    let l = Math.exp(-this.p.lambda),
                        k = 0,
                        p = 1;
                    do {
                        k++;
                        p *= Math.random();
                    } while (p > l);
                    return k - 1;
                } else {
                    // Large lambda, normal approximation
                    let c = 0.767 - 3.36 / this.p.lambda,
                        beta = Math.PI / Math.sqrt(3 * this.p.lambda),
                        alpha = beta * this.p.lambda,
                        k = Math.log(c) - this.p.lambda - Math.log(beta);
                    while (true) {
                        let r = Math.random(),
                            x = (alpha - Math.log((1 - r) / r)) / beta,
                            n = Math.floor(x + 0.5);
                        if (n < 0)
                            continue;
                        let v = Math.random(),
                            y = alpha - beta * x,
                            lhs = y + Math.log(v / Math.pow(1.0 + Math.exp(y), 2)),
                            rhs = k + n * Math.log(this.p.lambda) - special.gammaLn(n + 1);
                        if (lhs <= rhs)
                            return n;
                    }
                }
            }

            _pdf(x) {
                let xi = parseInt(x);
                return xi < 0 ? 0 : Math.pow(this.p.lambda, xi) * Math.exp(-this.p.lambda) / special.gamma(xi + 1);
            }

            _cdf(x) {
                let xi = parseInt(x);
                return xi < 0 ? 0 : 1 - special.gammaLowerIncomplete(xi + 1, this.p.lambda) / special.gamma(xi + 1);
            }
        }

        /**
         * Generator for the continuous
         * [uniform distribution]{@link https://en.wikipedia.org/wiki/Uniform_distribution_(continuous)}:
         *
         * $$f(x; x_\mathrm{min}, x_\mathrm{max}) = \frac{1}{x_\mathrm{max} - x_\mathrm{min}},$$
         *
         * with \(x_\mathrm{min}, x_\mathrm{max} \in \mathbb{R}\) and \(x_\mathrm{min} < x_\mathrm{max}\).
         * Support: \(x \in [x_\mathrm{min}, x_\mathrm{max}]\).
         *
         * @class UniformContinuous
         * @memberOf ran.dist
         * @param {number} xmin Lower boundary.
         * @param {number} xmax Upper boundary.
         * @constructor
         */
        class UniformContinuous extends Distribution {
            constructor(xmin, xmax) {
                super("continuous", arguments.length);
                this.p = {xmin, xmax};
                this.c = [xmax - xmin];
            }

            _generator() {
                return Math.random() * this.c[0] + this.p.xmin;
            }

            _pdf(x) {
                return x < this.p.xmin || x > this.p.xmax ? 0 : 1 / this.c[0];
            }

            _cdf(x) {
                return x < this.p.xmin ? 0 : x > this.p.xmax ? 1 : (x - this.p.xmin) / this.c[0];
            }
        }

        /**
         * Generator for the discrete
         * [uniform distribution]{@link https://en.wikipedia.org/wiki/Discrete_uniform_distribution}:
         *
         * $$f(k; x_\mathrm{min}, x_\mathrm{max}) = \frac{1}{x_\mathrm{max} - x_\mathrm{min} + 1},$$
         *
         * with \(x_\mathrm{min}, x_\mathrm{max} \in \mathbb{Z}\) and \(x_\mathrm{min} < x_\mathrm{max}\). Support: \(k \in \{x_\mathrm{min}, ..., x_\mathrm{max}\}\).
         *
         * @class UniformDiscrete
         * @memberOf ran.dist
         * @param {number} xmin Lower boundary.
         * @param {number} xmax Upper boundary.
         * @constructor
         */
        class UniformDiscrete extends Distribution {
            constructor(xmin, xmax) {
                super("discrete", arguments.length);
                this.p = {xmin, xmax};
                this.c = [xmax - xmin + 1];
            }

            _generator() {
                return parseInt(Math.random() * this.c[0]) + this.p.xmin;
            }

            _pdf(x) {
                let xi = parseInt(x);
                return xi < this.p.xmin || xi > this.p.xmax ? 0 : 1 / this.c[0];
            }

            _cdf(x) {
                let xi = parseInt(x);
                return xi < this.p.xmin ? 0 : xi > this.p.xmax ? 1 : (1 + xi - this.p.xmin) / this.c[0];
            }
        }

        /**
         * Generator for the [Weibull distribution]{@link https://en.wikipedia.org/wiki/Weibull_distribution}:
         *
         * $$f(x; \lambda, k) = \frac{k}{\lambda}\bigg(\frac{x}{\lambda}\bigg)^{k - 1} e^{-(x / \lambda)^k},$$
         *
         * with \(\lambda, k \in \mathbb{R}^+\). Support: \(x \in \mathbb{R}^+ \cup \{0\}\).
         *
         * @class Weibull
         * @memberOf ran.dist
         * @param {number} lambda Scale parameter.
         * @param {number} k Shape parameter.
         * @constructor
         */
        class Weibull extends Distribution {
            constructor(lambda, k) {
                super("continuous", arguments.length);
                this.p = {lambda, k};
            }

            _generator() {
                return this.p.lambda * Math.pow(-Math.log(Math.random()), 1 / this.p.k);
            }

            _pdf(x) {
                return x < 0 ? 0 : (this.p.k / this.p.lambda) * Math.exp((this.p.k - 1) * Math.log(x / this.p.lambda) - Math.pow(x / this.p.lambda, this.p.k));
            }

            _cdf(x) {
                return x < 0 ? 0 : 1 - Math.exp(-Math.pow(x / this.p.lambda, this.p.k));
            }
        }

        // Public classes
        return {
            Arcsine,
            Bernoulli,
            Beta,
            BetaPrime,
            Binomial,
            BoundedPareto,
            Cauchy,
            Chi2,
            Custom,
            Degenerate,
            Erlang,
            Exponential,
            F,
            Frechet,
            Gamma,
            GeneralizedGamma,
            Gompertz,
            Gumbel,
            InverseGamma,
            Laplace,
            Logistic,
            Lognormal,
            Normal,
            Pareto,
            Poisson,
            UniformContinuous,
            UniformDiscrete,
            Weibull
        };
    })();

    /**
     * Namespace containing various exposed methods related to time series
     *
     * @namespace ts
     * @memberOf ran
     */
    let ts = (function() {
        class Aggregator {
            constructor(dimension = 1) {
                this.dim = dimension;
                this.n = 0;
                this.history = [];
            }

            reset() {
                this.n = 0;
                this.history = Array.from({length: this.dim}, () => []);
            }
        }

        /**
         * Class representing the aggregate [covariance matrix]{@link https://en.wikipedia.org/wiki/Covariance_matrix} of a time series:
         *
         * $$C_{ij} = \mathbb{E}\big[\big(X_i - \mathbb{E}[X_i]\big)\big(X_j - \mathbb{E}[X_j]\big)\big],$$
         *
         * where \(\mathbb{E}\) denotes the expected value and \(X_i, X_j\) are the i-th and j-th variables in the time series. The elements are accumulated sequentially and the covariance is computed from historical values.
         *
         * @class Cov
         * @memberOf ran.ts
         * @param {number} dimension The linear dimension of the covariance. Default is 1.
         * @constructor
         */
        class Cov {
            constructor(dimension = 1) {
                this.dim = dimension;
                this.n = 0;
                this.x = new Array(this.dim).fill(0);
                this.xy = Array.from({length: this.dim}, () => new Array(this.dim).fill(0));
            }

            /**
             * Resets the covariance to zero.
             *
             * @method reset
             * @memberOf ran.ts.Cov
             */
            reset() {
                this.n = 0;
                this.x = new Array(this.dim).fill(0);
                this.xy = Array.from({length: this.dim}, () => new Array(this.dim).fill(0));
            }

            /**
             * Updates the covariance with a new observation.
             *
             * @method update
             * @memberOf ran.ts.Cov
             * @param {Array} x The array containing the components of the new observation.
             */
            update(x) {
                this.x = this.x.map((d, i) => (this.n * d + x[i]) / (this.n + 1));
                this.xy = this.xy.map((row, i) => row.map((d, j) => (this.n * d + x[i]*x[j]) / (this.n + 1)));
                this.n++;
            }

            /**
             * Computes the current value of the covariance matrix.
             *
             * @method compute
             * @memberOf ran.ts.Cov
             * @returns {ran.la.Matrix} The covariance matrix.
             */
            compute() {
                return new la.Matrix(
                    this.xy.map((row, i) => row.map((d, j) => (d - this.x[i]*this.x[j])))
                );
            }
        }

        /**
         * Class representing an [auto-correlation]{@link https://en.wikipedia.org/wiki/Autocorrelation} function:
         *
         * $$R_i(\tau) = \mathbb{E}[X_i(t) X_i(t + \tau)],$$
         *
         * where \(X_i(t)\) is the time series corresponding to the i-th variable and \(\tau\) denotes the lag. The elements are accumulated sequentially and the auto-correlation is computed from historical values.
         *
         * @class AC
         * @memberOf ran.ts
         * @param {number} dimension The dimension of the auto-correlation. Default is 1.
         * @param {number} range The maximum lag used in the calculation of the correlation. Default is 100.
         * @param {number} maxSize The maximum historical data that is stored to compute the correlation. All
         * observations older than this number are dropped. Default is 10K.
         * @constructor
         */
        class AC {
            constructor(dimension = 1, range = 100, maxSize = 1e4) {
                this.dim = dimension;
                this.range = range;
                this.maxSize = maxSize;
                this.history = Array.from({length: dimension}, () => []);
            }

            /**
             * Calculates the auto-correlation from a single historical data.
             *
             * @method _aci
             * @memberOf ran.ts.AC
             * @param {Array} h Array containing the history of a single variable.
             * @returns {number[]} The auto-correlation vs lag function.
             * @private
             */
            _aci(h) {
                // Get average
                let m = h.reduce((s, d) => s + d) / h.length,
                    m2 = h.reduce((s, d) => s + d*d),
                    rho = new Array(this.range).fill(0);
                for (let i = 0; i < h.length; i++) {
                    for (let r = 0; r < rho.length; r++) {
                        if (i - r > 0) {
                            rho[r] += (h[i] - m) * (h[i - r] - m);
                        }
                    }
                }

                return rho.map(function (d) {
                    return d / (m2 - h.length * m * m);
                });
            }

            /**
             * Resets the auto-correlation history.
             *
             * @method reset
             * @memberOf ran.ts.AC
             */
            reset() {
                this.history = Array.from({length: this.dim}, () => []);
            }

            /**
             * Updates the internal history that is used for the calculation of the correlation function.
             * Also drops old observations.
             *
             * @method update
             * @memberOf ran.ts.AC
             * @param {Array} x Array of new variables to update history with.
             */
            update(x) {
                this.history.forEach((d, i) => d.push(x[i]));
                if (this.history[0].length >= this.maxSize) {
                    this.history.forEach(d => d.shift());
                }
            }

            /**
             * Computes the auto-correlation function based on the current historical data.
             *
             * @method compute
             * @memberOf ran.ts.AC
             * @returns {Array[]} Array containing the auto-correlation function (correlation vs lag) for each component.
             */
            compute() {
                return this.history.map(d => this._aci(d));
            }
        }

        // Exposed classes
        return {
            Cov: Cov,
            AC: AC
        };
    })();

    /**
     * A collection of various Monte Carlo methods.
     *
     * @namespace mc
     * @memberOf ran
     */
    let mc = (function() {
        /**
         * Maximum size of the history stored for calculations.
         *
         * @var {number} _MAX_HISTORY
         * @memberOf ran.mc
         * @private
         */
        const _MAX_HISTORY = 1e4;

        let gr = (function() {
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
                let m = [],
                    s = [];
                samples.forEach(function (d) {
                    let di = d.map(function (x) {
                        return x[dim];
                    });
                    let mi = _sum(di) / di.length,
                        si = (_sum(di, 2) - di.length * mi * mi) / (di.length - 1);
                    m.push(mi);
                    s.push(si);
                });

                // Calculate within and between variances
                let w = _sum(s) / samples.length,
                    mm = _sum(m) / samples.length,
                    b = (_sum(m, 2) - samples.length * mm * mm) * samples[0].length / (samples.length - 1),
                    v = ((samples[0].length - 1) * w + b) / samples[0].length;
                return Math.sqrt(v / w);
            }

            /**
             * Calculates the [Gelman-Rubin]{@link http://www.stat.columbia.edu/~gelman/research/published/brooksgelman2.pdf} diagnostics for a set
             * of samples. The statistics can be used to monitor the convergence of an MCMC model.
             *
             * @method gr
             * @memberOf ran.mc
             * @param {Array} samples Array of samples, where each sample is an array of states.
             * @param {number=} maxLength Maximum length of the diagnostic function. Default value is 1000.
             * @returns {Array} Array of Gelman-Rubin diagnostic versus iteration number for each state variable.
             */
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

        // TODO
        let Slice = (function(logDensity, config) {
            let _min = config && typeof config.min !== 'undefined' ? config.min : null,
                _max = config && typeof config.max !== 'undefined' ? config.max : null,
                _x = Math.random(),
                _e = new dist.Exponential(1);

            function _boundary(x) {
                return (!_min || x >= _min[0]) && (!_max || x >= _max[0]);
            }

            function _accept(x, z, l, r) {
                let L = l,
                    R = r,
                    D = false;

                while (R - L > 1.1) {
                    let M = (L + R) / 2;
                    D = (_x < M && x >= M) || (_x >= M && x < M);

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
                let z = logDensity(_x) - _e.sample(),
                    L = _x - Math.random(),
                    R = L + 1;

                // Find slice interval
                while ((z < logDensity(L) || z < logDensity(R))) {
                    if (Math.random() < 0.5) {
                        L -= R - L;
                    } else {
                        R += R - L;
                    }
                }

                // Shrink interval
                let x = _r(L, R);
                while (!_boundary(x) || z > logDensity(x) || !_accept(x, z, L, R)) {
                    if (x < _x) {
                        L = x;
                    } else {
                        R = x;
                    }
                    x = _r(L, R);
                }

                // Update and return sample
                _x = x;
                return _x;
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
         * Base class implementing a general Markov chain Monte Carlo sampler. All MCMC sampler is extended from this class. MCMC samplers can be used to approximate integrals
         * by efficiently sampling a density that cannot be normalized or sampled directly.
         *
         * @class MCMC
         * @memberOf ran.mc
         * @param {Function} logDensity The logarithm of the density function to estimate.
         * @param {Object=} config Object describing some configurations. Supported properties:
         * <ul>
         *     <li>{dim}: Dimension of the state space to sample. Default is 1.</li>
         *     <li>{maxHistory}: Maximum length of history for aggregated computations. Default is 1000.</li>
         * </ul>
         * @param {Object=} initialState The initial internal state of the sampler. Supported properties: {x} (the
         * starting state), {samplingRate} (sampling rate) and {internal} for the child class' own internal parameters.
         * @constructor
         */
        class MCMC {
            constructor(logDensity, config = {}, initialState = {}) {
                this.dim = config.dim || 1;
                this.maxHistory = config.maxHistory || _MAX_HISTORY;
                this.lnp = logDensity;
                this.x = initialState.x || Array.from({length: self.dim}, Math.random);
                this.samplingRate = initialState.samplingRate || 1;
                this.internal = initialState.internal || {};

                /**
                 * State history of the sampler.
                 *
                 * @namespace history
                 * @memberOf ran.mc.MCMC
                 * @private
                 */
                this.history = (function(self) {
                    let _arr = Array.from({length: self.dim}, () => []);

                    return {
                        /**
                         * Returns the current history.
                         *
                         * @method get
                         * @memberOf ran.mc.MCMC.history
                         * @return {Array} Current history.
                         * @private
                         */
                        get() {
                            return _arr;
                        },

                        /**
                         * Updates state history with new data.
                         *
                         * @method update
                         * @memberOf ran.mc.MCMC.history
                         * @param {Array} x Last state to update history with.
                         */
                        update(x) {
                            // Add new state
                            _arr.forEach((d, j) => d.push(x[j]));

                            // Remove old state
                            if (_arr[0].length >= self.maxHistory) {
                                _arr.forEach(d => d.shift());
                            }
                        }
                    };
                })(this);

                /**
                 * Acceptance ratio.
                 *
                 * @namespace acceptance
                 * @memberOf ran.mc.MCMC
                 * @private
                 */
                this.acceptance = (function(self) {
                    let _arr = [];

                    return {
                        /**
                         * Computes acceptance for the current historical data.
                         *
                         * @method compute
                         * @memberOf ran.mc.MCMC.acceptance
                         * @return {number} Acceptance ratio.
                         */
                        compute() {
                            return _sum(_arr) / _arr.length;
                        },

                        /**
                         * Updates acceptance history with new data.
                         *
                         * @method update
                         * @memberOf ran.mc.MCMC.acceptance
                         * @param {number} a Acceptance: 1 if last state was accepted, 0 otherwise.
                         */
                        update(a) {
                            _arr.push(a);
                            if (_arr.length > self.maxHistory) {
                                _arr.shift();
                            }
                        }
                    };
                })(this);
            }

            /**
             * Returns the internal variables of the class. Must be overridden.
             *
             * @method _internal
             * @memberOf ran.mc.MCMC
             * @returns {object} Object containing the internal variables.
             * @private
             */
            _internal() {
                throw Error("MCMC._internal() is not implemented");
            }

            /**
             * Performs a single iteration. Must be overridden.
             *
             * @method _iter
             * @memberOf ran.mc.MCMC
             * @param {Array} x Current state of the Markov chain.
             * @param {boolean} warmUp Whether iteration takes place during warm-up or not. Default is false.
             * @returns {{x: Array, accepted: boolean}} Object containing the new state ({x}) and whether it is a
             * genuinely new state or not ({accepted}).
             * @private
             */
            _iter(x, warmUp = false) {
                throw Error("MCMC._iter() is not implemented");
            }

            /**
             * Adjusts internal parameters. Must be overridden.
             *
             * @method _adjust
             * @memberOf ran.mc.MCMC
             * @param {Object} i Object containing the result of the last iteration.
             * @private
             */
            _adjust(i) {
                throw Error("MCMC._adjust() is not implemented");
            }

            /**
             * Returns the current state of the sampler. The return value of this method can be passed to a sampler of
             * the same type to continue a previously warmed up sampler.
             *
             * @method state
             * @memberOf ran.mc.MCMC
             * @returns {Object} Object containing all relevant parameters of the sampler.
             */
            state() {
                return {
                    x: this.x,
                    samplingRate: this.samplingRate,
                    internals: this._internal()
                };
            }

            /**
             * Computes basic statistics of the sampled state variables based on historical data. Returns mean,
             * standard deviation and coefficient of variation.
             *
             * @method statistics
             * @memberOf ran.mc.MCMC
             * @returns {Object[]} Array containing objects for each dimension. Objects contain <code>mean</code>, <code>std</code> and <code>cv</code>.
             */
            statistics() {
                return this.history.get().map(h => {
                    let m = h.reduce((sum, d) => sum + d, 0) / h.length,
                        s = h.reduce((sum, d) => sum + (d - m) * (d - m), 0) / h.length;
                    return {
                        mean: m,
                        std: s,
                        cv: s / m
                    };
                });
            }

            /**
             * Computes acceptance rate based on historical data.
             *
             * @method ar
             * @memberOf ran.mc.MCMC
             * @returns {number} The acceptance rate in the last several iterations.
             */
            ar() {
                return this.acceptance.compute();
            }

            /**
             * Computes the auto-correlation function for each dimension based on historical data.
             *
             * @method ac
             * @memberOf ran.mc.MCMC
             * @returns {number[]} Array containing the correlation function (correlation versus lag) for each
             * dimension.
             */
            ac() {
                //return this._ac.compute();
                return this.history.get().map(h => {
                    // Get average
                    let m = h.reduce((s, d) => s + d) / h.length,
                        m2 = h.reduce((s, d) => s + d * d),
                        rho = new Array(100).fill(0);
                    for (let i = 0; i < h.length; i++) {
                        for (let r = 0; r < rho.length; r++) {
                            if (i - r > 0) {
                                rho[r] += (h[i] - m) * (h[i - r] - m);
                            }
                        }
                    }

                    // Return auto-correlation for each dimension
                    return rho.map(function (d) {
                        return d / (m2 - h.length * m * m);
                    });
                });
            }

            /**
             * Performs a single iteration.
             *
             * @method iterate
             * @memberOf ran.mc.MCMC
             * @param {Function=} callback Callback to trigger after the iteration.
             * @param {boolean=} warmUp Whether iteration takes place during warm-up or not. Default is false.
             * @returns {Object} Object containing the new state (<code>x</code>) and whether it is a
             * genuinely new state or not (<code>accepted</code>).
             */
            iterate(callback = null, warmUp = false) {
                // Get new state
                let i = this._iter(this.state.x, warmUp);

                // Update accumulators
                this.history.update(i.x);
                this.acceptance.update(i.accepted);

                // Update state
                this.x = i.x;

                // Callback
                callback && callback(i.x, i.accepted);

                return i;
            }

            /**
             * Carries out the initial warm-up phase of the sampler. During this phase, internal parameters may change
             * and therefore sampling does not take place. Instead, all relevant variables are adjusted.
             *
             * @method warmUp
             * @memberOf ran.mc.MCMC
             * @param {Function} callback Callback function to call when an integer percentage of the warm-up is done.
             * The percentage of the finished batches is passed as a parameter.
             * @param {number=} maxBatches Maximum number of batches for warm-up. Each batch consists of 10K iterations.
             * Default value is 100.
             */
            warmUp(callback, maxBatches = 100) {
                // Run specified batches
                for (let batch = 0; batch <= maxBatches; batch++) {
                    // Do some iterations
                    for (let j = 0; j < 1e4; j++) {
                        this._adjust(this.iterate(null, true));
                        //this._ac.update(this.x);
                    }

                    // Adjust sampling rate
                    // Get highest zero point
                    let z = this.ac().reduce((first, d) => {
                        for (let i=0; i<d.length-1; i++) {
                            if (Math.abs(d[i]) <= 0.05) {
                                return Math.max(first, i);
                            }
                        }
                    }, 0);
                    // Change sampling rate if zero point is different
                    if (z > this.samplingRate) {
                        this.samplingRate++;
                    } else if (z < this.samplingRate && this.samplingRate > 1) {
                        this.samplingRate--;
                    }

                    // Call optional callback
                    callback && callback(100 * batch / maxBatches);
                }
            }

            /**
             * Performs the sampling of the target density. Note that during sampling, no parameter adjustment is
             * taking place.
             *
             * @method sample
             * @memberOf ran.mc.MCMC
             * @param {Function} callback Callback function to call when an integer percentage of the samples is
             * collected. The percentage of the samples already collected is passed as a parameter.
             * @param {number=} size Size of the sampled set. Default is 1000.
             * @returns {Array} Array containing the collected samples.
             */
            sample(callback, size = 1000) {
                // Calculate total iterations
                let iMax = this.samplingRate * size,
                    batchSize = iMax / 100,
                    samples = [];

                // Start sampling
                for (let i=0; i<iMax; i++) {
                    this.iterate();

                    // Adjust occasionally, also send progress status
                    if (i % batchSize === 0) {
                        callback && callback(i / batchSize);
                    }

                    // Collect sample
                    if (i % this.samplingRate === 0) {
                        samples.push(this.x);
                    }
                }

                return samples;
            }
        }

        /**
         * Class implementing the (random walk) [Metropolis]{@link https://en.wikipedia.org/wiki/Metropolis%E2%80%93Hastings_algorithm}
         * algorithm.
         * Proposals are updated according to the [Metropolis-Within-Gibbs procedure]{@link http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.161.2424}:
         *
         * @class RWM
         * @memberOf ran.mc
         * @param {Function} logDensity The logarithm of the density function to estimate.
         * @param {Object=} config RWM configurations.
         * @param {Object=} initialState Initial state of the RWM sampler.
         * @constructor
         */
        class RWM extends MCMC {
            constructor(logDensity, config, initialState) {
                super(logDensity, config, initialState);

                // Last density value
                this.lastLnp = this.lnp(this.x);

                /**
                 * Proposal distributions.
                 *
                 * @namespace proposal
                 * @memberOf ran.mc.RWM
                 * @private
                 */
                this.proposal = (function(self) {
                    let _q = new dist.Normal(0, 1),
                        _acceptance = new Array(self.dim).fill(0),
                        _sigma = self.internal.proposal || new Array(self.dim).fill(1),
                        _ls = _sigma.map(d => Math.log(d)),
                        _n = 0,
                        _batch = 0,
                        _index = 0;

                    return {
                        /**
                         * Samples new state.
                         *
                         * @method jump
                         * @memberOf ran.mc.RWM.proposal
                         * @param {Array} x Current state.
                         * @param {boolean} single Whether only a single dimension should be updated.
                         * @return {Array} New state.
                         */
                        jump(x, single) {
                            return single
                                ? x.map((d, i) => d + (i === _index ? _q.sample() * _sigma[_index] : 0))
                                : x.map((d, i) => d + _q.sample() * _sigma[i]);
                        },

                        /**
                         * Updates proposal distributions.
                         *
                         * @method update
                         * @memberOf ran.mc.RWM.proposal
                         * @param {boolean} accepted Whether last state was accepted.
                         */
                        update(accepted) {
                            // Update acceptance for current dimension
                            accepted && _acceptance[_index]++;
                            _n++;

                            // If batch is finished, update proposal
                            if (_n === 100) {
                                // Update proposal
                                if (_acceptance[_index] / 100 > 0.44) {
                                    _ls[_index] += Math.min(0.01, Math.pow(_batch, -0.5));
                                } else {
                                    _ls[_index] -= Math.min(0.01, Math.pow(_batch, -0.5));
                                }
                                _sigma[_index] = Math.exp(_ls[_index]);

                                // Reset counters and accumulators
                                _n = 0;
                                _acceptance[_index] = 0;
                                _index = (_index + 1) % self.dim;
                                if (_index === 0) {
                                    _batch++;
                                }
                            }
                        },

                        /**
                         * Returns the current scales of the proposals.
                         *
                         * @method scales
                         * @memberOf ran.mc.RWM.proposal
                         * @return {Array} Array of proposal scales.
                         */
                        scales() {
                            return _sigma.slice();
                        }
                    };
                })(this);
            }

            // Internal variables
            _internal() {
                return {
                    proposal: this.proposal.scales()
                };
            }

            // Iterator
            _iter(x, warmUp) {
                let x1 = this.proposal.jump(this.x, warmUp);

                let newLnp = this.lnp(x1),
                    accepted = Math.random() < Math.exp(newLnp - this.lastLnp);
                if (accepted) {
                    this.lastLnp = newLnp;
                } else {
                    x1 = this.x;
                }

                return {
                    x: x1,
                    accepted: accepted
                };
            }

            // Adjustment
            _adjust(i) {
                this.proposal.update(i.accepted);
            }
        }

        /*class HMC extends MCMC {
            constructor(logDensity, dLogDensity, config, initialState) {
                super(logDensity, config, initialState);
            }
        }*/

        // TODO rejection sampling with log-concave dist
        // TODO slice sampling
        // TODO Gibbs sampling
        // TODO NUTS
        // TODO adaptive Metropolis

        // TODO Hamiltonian
        // TODO Adjust Euclidean metric from covariance in burn-in
        // TODO step size sampled randomly

        // Public methods and classes
        return {
            gr: gr,
            //Slice: Slice,
            RWM: RWM
        };
    })();

    // TODO next()
    // TODO trend()
    // TODO noise()
    // TODO mean(power)
    // TODO correlation()
    // TODO Processes to add: https://en.wikipedia.org/wiki/Stochastic_process
    // TODO Brown
    // TODO Wiener
    // TODO Orstein-Uhlenbeck
    // TODO Gaussian
    // TODO Galton-Watson

    // Exports
    exports.la = la;
    exports.ts = ts;
    exports.core = core;
    exports.dist = dist;
    exports.mc = mc;
})));
