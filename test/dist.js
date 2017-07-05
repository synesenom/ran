var assert = require('assert');
var utils = require('../test/test-utils').test_uils;
var math = require('mathjs');
var jstat = require('jstat');
var dist = require('../src/ran').dist;
var special = require('../src/ran')._special;

var LAPS = 1000;

describe('dice', function() {
    describe('dist', function() {
        /// Continuous distributions ///
        describe('uniform', function () {
            it('should return an array of uniformly distributed values', function () {
                utils.trials(function() {
                    const xmin = Math.random()*100 - 50;
                    const xmax = xmin + Math.random()*50;
                    return utils.ks_test(dist.uniform(xmin, xmax, LAPS), function (x) {
                        return (x-xmin) / (xmax-xmin);
                    });
                });
            });
        });

        describe('exponential', function () {
            it('should return an array of exponentially distributed values', function () {
                utils.trials(function() {
                    const lambda = Math.random()*10 + 1;
                    return utils.ks_test(dist.exponential(lambda, LAPS), function (x) {
                        return 1 - Math.exp(-lambda * x);
                    });
                });
            });
        });

        describe('pareto', function () {
            it('should return an array of Pareto distributed values', function () {
                utils.trials(function() {
                    const xmin = Math.random()*10 + 1;
                    const alpha = Math.random()*5 + 1;
                    return utils.ks_test(dist.pareto(xmin, alpha, LAPS), function (x) {
                        return 1 - Math.pow(xmin / x, alpha);
                    });
                });
            });
        });

        describe('boundedPareto', function () {
            it('should return an array of bounded Pareto distributed values', function () {
                utils.trials(function() {
                    const xmin = Math.random()*10 + 1;
                    const xmax = xmin + Math.random()*20 + 2;
                    const alpha = Math.random()*5 + 1;
                    return utils.ks_test(dist.boundedPareto(xmin, xmax, alpha, LAPS), function (x) {
                        return (1 - Math.pow(xmin / x, alpha)) / (1 - Math.pow(xmin / xmax, alpha));
                    });
                });
            });
        });

        describe('normal', function () {
            it('should return an array of normally distributed values', function () {
                utils.trials(function() {
                    const mu = Math.random()*10 + 1;
                    const sigma = Math.random()*10 + 1;
                    return utils.ks_test(dist.normal(mu, sigma, LAPS), function (x) {
                        return 0.5 * (1 + math.erf((x-mu)/(sigma*Math.sqrt(2))));
                    });
                });
            });
        });

        describe('lognormal', function () {
            it('should return an array of log-normally distributed values', function () {
                utils.trials(function() {
                    const mu = Math.random()*10 + 1;
                    const sigma = Math.random()*10 + 1;
                    return utils.ks_test(dist.lognormal(mu, sigma, LAPS), function (x) {
                        return 0.5 * (1 + math.erf((Math.log(x)-mu)/(sigma*Math.sqrt(2))));
                    });
                });
            });
        });

        describe('weibull', function () {
            it('should return an array of Weibull distributed values', function () {
                utils.trials(function() {
                    const lambda = Math.random()*10 + 0.1;
                    const k = Math.random()*10 + 0.1;
                    return utils.ks_test(dist.weibull(lambda, k, LAPS), function (x) {
                        return 1 - Math.exp(-Math.pow(x/lambda, k));
                    });
                });
            });
        });

        describe('gamma', function () {
            it('should return an array of gamma distributed values', function () {
                utils.trials(function() {
                    const alpha = Math.random()*3;
                    const beta = Math.random()*3;
                    return utils.ks_test(dist.gamma(alpha, beta, LAPS), function (x) {
                        return special.gammaLowerIncomplete(alpha, beta*x) / special.gamma(alpha);
                    });
                });
            });
        });

        describe('inverseGamma', function () {
            it('should return an array of inverse-gamma distributed values', function () {
                utils.trials(function() {
                    const k = Math.random()*3;
                    const theta = Math.random()*3;
                    return utils.ks_test(dist.inverseGamma(k, theta, LAPS), function (x) {
                        return 1 - special.gammaLowerIncomplete(k, 1/(theta*x)) / special.gamma(k);
                    });
                });
            });
        });

        describe('generalizedGamma', function () {
            it('should return an array of generalized gamma distributed values', function () {
                utils.trials(function() {
                    const a = Math.random()*3;
                    const d = Math.random()*3;
                    const p = Math.random()*3;
                    return utils.ks_test(dist.generalizedGamma(a, d, p, LAPS), function (x) {
                        return special.gammaLowerIncomplete(d/p, Math.pow(x/a, p)) / special.gamma(d/p);
                    });
                });
            });
        });

        describe('erlang', function () {
            it('should return an array of Erlang distributed values', function () {
                utils.trials(function() {
                    const k = Math.round(Math.random()*10);
                    const beta = Math.random()*3;
                    return utils.ks_test(dist.erlang(k, beta, LAPS), function (x) {
                        return special.gammaLowerIncomplete(k, beta*x) / special.gamma(k);
                    });
                });
            });
        });

        describe('chi2', function () {
            it('should return an array of chi square distributed values', function () {
                utils.trials(function() {
                    const v = Math.round(Math.random()*10);
                    return utils.ks_test(dist.chi2(v, LAPS), function (x) {
                        return special.gammaLowerIncomplete(v/2, 2*x) / special.gamma(v/2);
                    });
                });
            });
        });

        describe('maxwellBoltzmann', function () {
            it('should return an array of Maxwell-Boltzmann distributed values', function () {
                utils.trials(function() {
                    const a = Math.random()*3;
                    return utils.ks_test(dist.maxwellBoltzmann(a, LAPS), function (x) {
                        return special.gammaLowerIncomplete(1.5, 2*a*a*x) / special.gamma(1.5);
                    });
                });
            });
        });

        /// Descrete distributions ///
        describe('poisson', function () {
            it('should return an array of Poisson distributed values', function () {
                utils.trials(function() {
                    const lambda = Math.random()*10 + 1;
                    return utils.chi_test(dist.poisson(lambda, LAPS), function (x) {
                        return Math.pow(lambda, x) * Math.exp(-lambda) / math.factorial(x);
                    }, 1);
                });
            });
        });

        describe('custom', function () {
            it('should return an array of customly distributed values', function () {
                utils.trials(function() {
                    const k = Math.random()*10 + 1;
                    var weights = [];
                    var sum = 0;
                    for (var i=0; i<k; i++) {
                        var w = Math.random() * 10;
                        weights.push(w);
                        sum += w;
                    }
                    var ran = new dist.Alias(weights);
                    for (i=0; i<k; i++) {
                        weights[i] /= sum;
                    }
                    return utils.chi_test(ran.sample(LAPS), function (x) {
                        return weights[x];
                    }, 1);
                });
            });
        });
    });
});
