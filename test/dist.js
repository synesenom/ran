var assert = require('assert');
var utils = require('../test/test-utils').test_uils;
var dist = require('../src/ran').dist;

var LAPS = 1000;
var MAX_AVG_DIFF = 1e-3;

describe('ran', function() {
    describe('dist', function() {
        describe('custom', function () {
            it('should return an array of custom distributed values', function () {
                utils.trials(function() {
                    const k = parseInt(Math.random()*0 + 3);
                    var weights = [];
                    var sum = 0;
                    for (var i=0; i<k; i++) {
                        var w = Math.random() * 10;
                        weights.push(w);
                        sum += w;
                    }
                    var custom = dist.Custom(weights);
                    return utils.chi_test(custom.sample(LAPS), custom.pmf, k-1);
                });
            });
            it('sum of pmf should give cdf', function () {
                utils.trials(function () {
                    const k = parseInt(Math.random()*20 + 3);
                    var weights = [];
                    for (var i=0; i<k; i++) {
                        var w = Math.random() * 10;
                        weights.push(w);
                    }
                    var custom = dist.Custom(weights);
                    return utils.diff_disc(custom.pmf, custom.cdf, 0, weights.length) < MAX_AVG_DIFF;
                });
            });
        });

        describe('bernoulli', function () {
            it('should return an array of Bernoulli distributed values', function () {
                utils.trials(function() {
                    var bernoulli = dist.Bernoulli(Math.random());
                    return utils.chi_test(bernoulli.sample(LAPS), bernoulli.pmf, 1);
                });
            });
            it('sum of pmf should give cdf', function () {
                utils.trials(function () {
                    var bernoulli = dist.Bernoulli(Math.random());
                    return utils.diff_disc(bernoulli.pmf, bernoulli.cdf, 0, 1) < MAX_AVG_DIFF;
                });
            });
        });

        describe('boundedPareto', function () {
            it('should return an array of bounded Pareto distributed values', function () {
                utils.trials(function() {
                    const xmin = Math.random() * 10 + 0.1;
                    const xmax = xmin + Math.random() * 20 + 2;
                    const alpha = Math.random() * 5 + 1;
                    var boundedPareto = dist.BoundedPareto(xmin, xmax, alpha);
                    return utils.ks_test(boundedPareto.sample(LAPS), boundedPareto.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                this.timeout(0);
                utils.trials(function () {
                    const xmin = Math.random() * 10 + 1;
                    const xmax = xmin + Math.random() * 20 + 2;
                    const alpha = Math.random() * 5 + 1;
                    var boundedPareto = dist.BoundedPareto(xmin, xmax, alpha);
                    return utils.diff_cont(boundedPareto.pdf, boundedPareto.cdf, xmin - 10, xmax + 10, 0.01) < MAX_AVG_DIFF;
                });
            });
        });

        describe('chi2', function () {
            it('should return an array of chi square distributed values', function () {
                utils.trials(function() {
                    const k = Math.round(Math.random()*10) + 1;
                    var chi2 = dist.Chi2(k);
                    return utils.ks_test(chi2.sample(LAPS), chi2.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                this.timeout(0);
                utils.trials(function () {
                    const k = Math.round(Math.random() * 10) + 1;
                    var chi2 = dist.Chi2(k);
                    return utils.diff_cont(chi2.pdf, chi2.cdf, 0, 10, 0.01) < MAX_AVG_DIFF;
                });
            });
        });

        describe('erlang', function () {
            it('should return an array of Erlang distributed values', function () {
                utils.trials(function() {
                    const k = Math.round(Math.random()*10) + 1;
                    const lambda = Math.random()*3 + 0.1;
                    var erlang = dist.Erlang(k, lambda);
                    return utils.ks_test(erlang.sample(LAPS), erlang.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                this.timeout(0);
                utils.trials(function () {
                    const k = Math.round(Math.random() * 10) + 1;
                    const lambda = Math.random() * 3 + 0.1;
                    var erlang = dist.Erlang(k, lambda);
                    return utils.diff_cont(erlang.pdf, erlang.cdf, 0, 10, 0.01) < MAX_AVG_DIFF;
                });
            });
        });

        describe('exponential', function () {
            it('should return an array of exponentially distributed values', function () {
                utils.trials(function() {
                    const lambda = Math.random()*10 + 0.1;
                    var exponential = dist.Exponential(lambda);
                    return utils.ks_test(exponential.sample(LAPS), exponential.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                this.timeout(0);
                utils.trials(function () {
                    const lambda = Math.random() * 10 + 0.1;
                    var exponential = dist.Exponential(lambda);
                    return utils.diff_cont(exponential.pdf, exponential.cdf, 0, 10, 0.01) < MAX_AVG_DIFF;
                });
            });
        });

        describe('gamma', function () {
            it('should return an array of gamma distributed values', function () {
                utils.trials(function() {
                    const alpha = Math.random()*3 + 0.1;
                    const beta = Math.random()*3 + 0.1;
                    var gamma = dist.Gamma(alpha, beta);
                    return utils.ks_test(gamma.sample(LAPS), gamma.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                this.timeout(0);
                utils.trials(function () {
                    const alpha = Math.random() * 3 + 1;
                    const beta = Math.random() * 3 + 0.5;
                    var gamma = dist.Gamma(alpha, beta);
                    return utils.diff_cont(gamma.pdf, gamma.cdf, 0, 10, 0.1) < MAX_AVG_DIFF;
                });
            });
        });

        describe('generalizedGamma', function () {
            it('should return an array of generalized gamma distributed values', function () {
                utils.trials(function() {
                    const a = Math.random()*3 + 0.1;
                    const d = Math.random()*3 + 0.1;
                    const p = Math.random()*3 + 0.1;
                    var generalizedGamma = dist.GeneralizedGamma(a, d, p);
                    return utils.ks_test(generalizedGamma.sample(LAPS), generalizedGamma.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                this.timeout(0);
                utils.trials(function () {
                    const a = Math.random() * 3 + 0.5;
                    const d = Math.random() * 3 + 0.5;
                    const p = Math.random() * 3 + 1;
                    var generalizedGamma = dist.GeneralizedGamma(a, d, p);
                    return utils.diff_cont(generalizedGamma.pdf, generalizedGamma.cdf, 0, 10, 0.1) < MAX_AVG_DIFF;
                });
            });
        });

        describe('inverseGamma', function () {
            it('should return an array of inverse-gamma distributed values', function () {
                utils.trials(function() {
                    const alpha = Math.random()*3 + 0.1;
                    const beta = Math.random()*3 + 0.1;
                    var inverseGamma = dist.InverseGamma(alpha, beta);
                    return utils.ks_test(inverseGamma.sample(LAPS), inverseGamma.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                this.timeout(0);
                utils.trials(function () {
                    const alpha = Math.random() * 3 + 0.1;
                    const beta = Math.random() * 3 + 0.5;
                    var inverseGamma = dist.InverseGamma(alpha, beta);
                    return utils.diff_cont(inverseGamma.pdf, inverseGamma.cdf, 0, 10, 0.1) < MAX_AVG_DIFF;
                });
            });
        });

        describe('lognormal', function () {
            it('should return an array of log-normally distributed values', function () {
                utils.trials(function() {
                    const mu = Math.random()*20 - 10;
                    const sigma = Math.random()*10 + 1;
                    var lognormal = dist.Lognormal(mu, sigma);
                    return utils.ks_test(lognormal.sample(LAPS), lognormal.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                this.timeout(0);
                utils.trials(function () {
                    const mu = Math.random()*20 - 10;
                    const sigma = Math.random() * 3 + 0.1;
                    var lognormal = dist.Lognormal(mu, sigma);
                    return utils.diff_cont(lognormal.pdf, lognormal.cdf, 0, 10, 0.01) < MAX_AVG_DIFF;
                });
            });
        });

        describe('normal', function () {
            it('should return an array of normally distributed values', function () {
                utils.trials(function() {
                    const mu = Math.random() * 10 - 5;
                    const sigma = Math.random() * 10 + 0.1;
                    var normal = dist.Normal(mu, sigma);
                    return utils.ks_test(normal.sample(LAPS), normal.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                this.timeout(0);
                utils.trials(function () {
                    const mu = Math.random() * 10 - 5;
                    const sigma = Math.random() * 10 + 0.1;
                    var normal = dist.Normal(mu, sigma);
                    return utils.diff_cont(normal.pdf, normal.cdf, -100, 100, 0.1) < MAX_AVG_DIFF;
                });
            });
        });

        describe('pareto', function () {
            it('should return an array of Pareto distributed values', function () {
                utils.trials(function() {
                    const xmin = Math.random()*10 + 0.1;
                    const alpha = Math.random()*5 + 0.1;
                    var pareto = dist.Pareto(xmin, alpha);
                    return utils.ks_test(pareto.sample(LAPS), pareto.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                this.timeout(0);
                utils.trials(function () {
                    const xmin = Math.random() * 10 + 0.1;
                    const alpha = Math.random() * 5 + 0.1;
                    var pareto = dist.Pareto(xmin, alpha);
                    return utils.diff_cont(pareto.pdf, pareto.cdf, 0, 10, 0.1) < MAX_AVG_DIFF;
                });
            });
        });

        describe('poisson', function () {
            it('should return an array of Poisson distributed values', function () {
                utils.trials(function() {
                    const lambda = Math.random()*10 + 1;
                    var poisson = dist.Poisson(lambda);
                    return utils.chi_test(poisson.sample(LAPS), poisson.pmf, 1);
                });
            });
            it('sum of pmf should give cdf', function () {
                utils.trials(function () {
                    const lambda = Math.random() * 10 + 1;
                    var poisson = dist.Poisson(lambda);
                    return utils.diff_disc(poisson.pmf, poisson.cdf, 0, 100) < MAX_AVG_DIFF;
                });
            });
        });

        describe('uniform', function () {
            it('should return an array of uniformly distributed values', function () {
                utils.trials(function() {
                    const xmin = Math.random()*100 - 50;
                    const xmax = xmin + Math.random()*50;
                    var uniform = dist.Uniform(xmin, xmax);
                    return utils.ks_test(uniform.sample(LAPS), uniform.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                this.timeout(0);
                utils.trials(function () {
                    const xmin = Math.random() * 100 - 50;
                    const xmax = xmin + Math.random() * 50;
                    var uniform = dist.Uniform(xmin, xmax);
                    return utils.diff_cont(uniform.pdf, uniform.cdf, -100, 100, 0.1) < MAX_AVG_DIFF;
                });
            });
        });

        describe('weibull', function () {
            it('should return an array of Weibull distributed values', function () {
                utils.trials(function() {
                    const lambda = Math.random()*10 + 0.1;
                    const k = Math.random()*10 + 0.1;
                    var weibull = dist.Weibull(lambda, k);
                    return utils.ks_test(weibull.sample(LAPS), weibull.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                this.timeout(0);
                utils.trials(function () {
                    const lambda = Math.random() * 10 + 0.1;
                    const k = Math.random() * 10 + 0.5;
                    var weibull = dist.Weibull(lambda, k);
                    return utils.diff_cont(weibull.pdf, weibull.cdf, 0, 20, 0.01) < MAX_AVG_DIFF;
                });
            });
        });
    });
});
