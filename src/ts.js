import la from './la';

/**
 * Namespace containing various exposed methods related to time series
 *
 * @namespace ts
 * @memberOf ran
 */
export default (function() {
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
         * @returns {la.Matrix} The covariance matrix.
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
            if (this.history.reduce((acc, d) => acc + d.length, 0) > 0) {
                return this.history.map(d => this._aci(d));
            } else {
                return Array.from({length: this.dim}, () => Array.from({length: this.range}, () => undefined));
            }
        }
    }

    // Exposed classes
    return {
        Cov: Cov,
        AC: AC
    };
})();