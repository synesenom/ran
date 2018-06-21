var Proposal = (function(dimension) {
    var _sigma = new Array(dimension).fill(1);
    var _g = new Array(dimension).fill(0).map(function(d) {
        return new ran.dist.Normal(0, 1).sample;
    });

    function update(acceptanceRate) {
        // Pick random dimension
        var i = parseInt(Math.random() * dimension);

        // Update proposal function according to acceptance rate
        _sigma[i] = acceptanceRate < 0.5 ? _sigma[i] / 1.1 : _sigma[i] * 1.1;
        _g[i] = new ran.dist.Normal(0, _sigma[i]).sample;
    }

    function sample(x) {
        return x.map(function(d, i) {
            return d + _g[i]();
        });
    }

    function sigma() {
        return _sigma;
    }

    return {
        update: update,
        sample: sample,
        sigma: sigma
    };
});

var Acceptance = (function(maxLength) {
    var _history = [];

    function update(accepted) {
        if (_history.length >= maxLength) {
            _history.shift();
        }
        _history.push(accepted);
    }

    function measure() {
        return _history.length > 0 ? _history.reduce(function(total, d) {
            return total + d;
        }, 0) / _history.length : 0.5;
    }

    return {
        update: update,
        measure: measure
    };
});

var AutoCorrelation = (function(maxLength) {
    var _history = [];

    function update(x) {
        if (_history.length > maxLength) {
            _history.shift();
        }
        _history.push(x);
    }

    function measure() {
        var mean = 0,
            std2 = 0;
        for (var i=0; i<_history.length; i++) {
            mean += _history[i];
            std2 += _history[i] * _history[i];
        }
        std2 = std2 - mean*mean;
        var mean = _history.reduce(function(m, d) {
            return m+d;
        }, 0);

        return
    }
});

/**
 * Class implementing the Metropolis-Hastings algorithm.
 *
 * @class MHMC
 * @param {Function} density The function proportional to the density to estimate.
 * @param {Array} x0 Initial value of the state.
 * @param {Array?} min Optional lower boundary for the state.
 * @param {Array?} max Optional upper boundary for the state.
 * @constructor
 */
var MHMC = (function(density, x0, min, max) {
    var _MAX_ITER_BURN_IN = 100;
    var _density = density;
    var _x = x0;
    var _min = min;
    var _max = max;
    var _prop = new Proposal(x0.length);
    var _acc = new Acceptance(100);
    var _status = {};
    var _lastDensity = _density(_x);

    /**
     * Runs a single iteration of the state update.
     *
     * @method _iterate
     * @memberOf MHMC
     * @returns {number} Number indicating the acceptance status. 1 if accepted, 0 otherwise.
     * @private
     */
    function _iterate() {
        // Pick new state
        var x1 = _prop.sample(_x);

        // Check boundaries
        if (_min) {
            for (var i=0; i<x1.length; i++) {
                if (x1[i] < _min[i]) {
                    return 0;
                }
            }
        }
        if (_max) {
            for (i=0; i<x1.length; i++) {
                if (x1[i] > _max[i]) {
                    return 0;
                }
            }
        }

        // Check if new state should be accepted
        var _newDensity = _density(x1);
        if (Math.random() < _newDensity / _lastDensity) {
            // Update state and last probability
            _x = x1;
            _lastDensity = _newDensity;
            return 1;
        } else {
            return 0;
        }
    }

    /**
     * Adjust proposals.
     *
     * @method _adjust
     * @memberOf MHMC
     * @private
     */
    function _adjust() {
        // Adjust proposal distributions
        _prop.update(_acc.measure());
    }

    /**
     * Prints some status of the process on the console.
     *
     * @method _print
     * @memberOf MHMC
     * @private
     */
    function _print() {
        console.log(_acc.measure(), _prop.sigma());
    }

    /**
     * Runs the burn-in phase.
     *
     * @method _burnIn
     * @memberOf MHMC
     * @param {Function} callback Function to call at each batch of iterations. It is called each time the proposals
     * are updated. Must accept two arguments: the relative number of batches until the maximum iterations and the
     * current acceptance rate.
     * @private
     */
    function _burnIn(callback) {
        // Run until acceptance rate is around 50% or max iterations are reached
        var i = 1;
        for (; i <= _MAX_ITER_BURN_IN; i++) {
            // Do some iterations
            for (var j = 0; j < 1e4; j++) {
                _acc.update(_iterate());
            }

            // Adjust parameters
            _adjust();

            // Call optional callback
            callback && callback(i / _MAX_ITER_BURN_IN, _acc);

            // If acceptance rate is near 50%, stop burn-in
            if (Math.abs(_acc.measure() - 0.5) < 0.1) {
                break;
            }
        }

        // Update status
        _status.burnIn = i < _MAX_ITER_BURN_IN;
    }

    function estimate() {
        var p = new Array(1e3).fill(0).map(function(d, i) {
            return {
                x: i,
                y: 1
            }
        });

        // Burn-in
        _burnIn(function(status, acc) {
            console.log(status);
        });

        for (var i=0; i<1e7; i++) {
            // Iterate
            _acc.update(_iterate());

            // Update distribution
            var xi = parseInt(_x);
            p[xi] = {
                x: p[xi].x,
                y: p[xi].y + 1
            };

            // Print stats
            if (i % 1e4 === 0) {
                _adjust();
                _print();
            }

            // Send new estimate occasionally
            if (i % 1e6 === 1) {
                postMessage({p: p});
            }
        }
    }

    return {
        estimate: estimate
    };
});

self.addEventListener("message", function(event) {
    "use strict";
    importScripts("../lib/ran.min.js");

    new MHMC(new ran.dist.Lognormal(10, 2.5).pdf,
        [Math.random()], [0], [1e3-1]).estimate();
    // Init P
    /*var x = [Math.random()];
    var p = new Array(1e3).fill(0).map(function(d, i) {
        return {
            x: i/10,
            y: 1
        }
    });
    var L = new ran.dist.Lognormal(10, 3).pdf;

    // Run Metropolis-Hastings
    var acceptance = new Acceptance(100);
    var g = new Proposal(1);
    for (var i=0; i<1e7; i++) {
        // Pick new state
        var x1 = g.sample(x);

        // Calculate acceptance rate
        var a = L(x1) / L(x);
        if (parseInt(x1*10) >= 0 && parseInt(x1*10) < p.length && Math.random() < a) {
            x = [x1[0]];
            acceptance.update(1);
        } else {
            acceptance.update(0);
        }

        // Update distribution
        var xi = parseInt(x*10);
        p[xi] = {
            x: p[xi].x,
            y: p[xi].y + 1
        };

        // Print stats
        if (i % 1e4 === 0) {
            var acceptanceRate = acceptance.measure();

            // Adjust proposal distribution
            g.update(acceptanceRate);

            console.log(acceptanceRate, g.sigma());
        }

        // Send new estimate occasionally
        if (i % 1e6 === 1) {
            postMessage({p: p});
        }
    }*/
});