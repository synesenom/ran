var assert = require('assert');
var utils = require('../test/test-utils').test_utils;
var dist = require('../src/ran').dist;

var LAPS = 1000;
var MAX_AVG_DIFF = 1e-3;
var GENERATORS = {
    Bernoulli: {
        g: function() {
            return dist.Bernoulli(utils.param.prob());
        }
    },
    BoundedPareto: {
        g: function() {
            var xmin = utils.param.scale();
            return dist.BoundedPareto(xmin, xmin+utils.param.scale(), utils.param.shape());
        }
    },
    Chi2: {
        g: function() {
            return dist.Chi2(utils.param.degree());
        }
    },
    Erlang: {
        g: function() {
            return dist.Erlang(utils.param.degree(), utils.param.rate());
        }
    },
    Exponential: {
        g: function() {
            return dist.Exponential(utils.param.rate());
        }
    },
    Gamma: {
        g: function() {
            return dist.Gamma(utils.param.shape(), utils.param.rate());
        }
    },
    GeneralizedGamma: {
        g: function() {
            return dist.GeneralizedGamma(utils.param.rate(), utils.param.shape(), utils.param.scale());
        }
    },
    InverseGamma: {
        g: function() {
            return dist.InverseGamma(utils.param.shape(), utils.param.scale());
        }
    },
    Lognormal: {
        g: function() {
            return dist.Lognormal(utils.param.scale(), utils.param.shape());
        }
    },
    Normal: {
        g: function() {
            return dist.Normal(utils.param.scale(), utils.param.shape());
        }
    },
    Pareto: {
        g: function() {
            return dist.Pareto(utils.param.scale(), utils.param.shape());
        }
    },
    Poisson: {
        g: function() {
            return dist.Poisson(utils.param.rate());
        }
    },
    Uniform: {
        g: function() {
            var xmin = utils.param.scale();
            return dist.Uniform(xmin, xmin + utils.param.rate());
        }
    },
    Weibull: {
        g: function() {
            return dist.Weibull(utils.param.scale(), utils.param.shape());
        }
    }
};

describe('ran', function() {
    describe('dist', function() {
        describe('custom', function () {
            it('should return an array of custom distributed values', function () {
                utils.trials(function() {
                    const k = parseInt(Math.random() * 5 + 3);
                    var weights = [];
                    for (var i=0; i<k; i++) {
                        var w = Math.random() * 10;
                        weights.push(w);
                    }
                    var custom = dist.Custom(weights);
                    return utils.chi_test(custom.sample(LAPS), custom.pmf, k-1);
                });
            });
            it('sum of pmf should give cdf', function () {
                utils.trials(function () {
                    const k = parseInt(Math.random() * 5 + 3);
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
                    var bernoulli = GENERATORS.Bernoulli.g();
                    return utils.chi_test(bernoulli.sample(LAPS), bernoulli.pmf, 1);
                });
            });
            it('sum of pmf should give cdf', function () {
                utils.trials(function () {
                    var bernoulli = GENERATORS.Bernoulli.g();
                    return utils.diff_disc(bernoulli.pmf, bernoulli.cdf, 0, 1) < MAX_AVG_DIFF;
                });
            });
        });

        describe('boundedPareto', function () {
            it('should return an array of bounded Pareto distributed values', function () {
                utils.trials(function() {
                    var boundedPareto = GENERATORS.BoundedPareto.g();
                    return utils.ks_test(boundedPareto.sample(LAPS), boundedPareto.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    var boundedPareto = GENERATORS.BoundedPareto.g();
                    return utils.diff_cont(boundedPareto.pdf, boundedPareto.cdf, 0, 10, 0.01) < MAX_AVG_DIFF;
                });
            });
        });

        describe('chi2', function () {
            it('should return an array of chi square distributed values', function () {
                utils.trials(function() {
                    var chi2 = GENERATORS.Chi2.g();
                    return utils.ks_test(chi2.sample(LAPS), chi2.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    var chi2 = GENERATORS.Chi2.g();
                    return utils.diff_cont(chi2.pdf, chi2.cdf, 0, 10, 0.01) < MAX_AVG_DIFF;
                });
            });
        });

        describe('erlang', function () {
            it('should return an array of Erlang distributed values', function () {
                utils.trials(function() {
                    var erlang = GENERATORS.Erlang.g();
                    return utils.ks_test(erlang.sample(LAPS), erlang.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    var erlang = GENERATORS.Erlang.g();
                    return utils.diff_cont(erlang.pdf, erlang.cdf, 0, 10, 0.01) < MAX_AVG_DIFF;
                });
            });
        });

        describe('exponential', function () {
            it('should return an array of exponentially distributed values', function () {
                utils.trials(function() {
                    var exponential = GENERATORS.Exponential.g();
                    return utils.ks_test(exponential.sample(LAPS), exponential.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    var exponential = GENERATORS.Exponential.g();
                    return utils.diff_cont(exponential.pdf, exponential.cdf, 0, 10, 0.01) < MAX_AVG_DIFF;
                });
            });
        });

        describe('gamma', function () {
            it('should return an array of gamma distributed values', function () {
                utils.trials(function() {
                    var gamma = GENERATORS.Gamma.g();
                    return utils.ks_test(gamma.sample(LAPS), gamma.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    var gamma = GENERATORS.Gamma.g();
                    return utils.diff_cont(gamma.pdf, gamma.cdf, 0, 10, 0.1) < MAX_AVG_DIFF;
                });
            });
        });

        describe('generalizedGamma', function () {
            it('should return an array of generalized gamma distributed values', function () {
                utils.trials(function() {
                    var generalizedGamma = GENERATORS.GeneralizedGamma.g();
                    return utils.ks_test(generalizedGamma.sample(LAPS), generalizedGamma.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    var generalizedGamma = GENERATORS.GeneralizedGamma.g();
                    return utils.diff_cont(generalizedGamma.pdf, generalizedGamma.cdf, 0, 10, 0.1) < MAX_AVG_DIFF;
                });
            });
        });

        describe('inverseGamma', function () {
            it('should return an array of inverse-gamma distributed values', function () {
                utils.trials(function() {
                    var inverseGamma = GENERATORS.InverseGamma.g();
                    return utils.ks_test(inverseGamma.sample(LAPS), inverseGamma.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    var inverseGamma = GENERATORS.InverseGamma.g();
                    return utils.diff_cont(inverseGamma.pdf, inverseGamma.cdf, 0, 10, 0.1) < MAX_AVG_DIFF;
                });
            });
        });

        describe('lognormal', function () {
            it('should return an array of log-normally distributed values', function () {
                utils.trials(function() {
                    var lognormal = GENERATORS.Lognormal.g();
                    return utils.ks_test(lognormal.sample(LAPS), lognormal.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    var lognormal = GENERATORS.Lognormal.g();
                    return utils.diff_cont(lognormal.pdf, lognormal.cdf, 0, 10, 0.01) < MAX_AVG_DIFF;
                });
            });
        });

        describe('normal', function () {
            it('should return an array of normally distributed values', function () {
                utils.trials(function() {
                    var normal = GENERATORS.Normal.g();
                    return utils.ks_test(normal.sample(LAPS), normal.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    var normal = GENERATORS.Normal.g();
                    return utils.diff_cont(normal.pdf, normal.cdf, -100, 100, 0.1) < MAX_AVG_DIFF;
                });
            });
        });

        describe('pareto', function () {
            it('should return an array of Pareto distributed values', function () {
                utils.trials(function() {
                    var pareto = GENERATORS.Pareto.g();
                    return utils.ks_test(pareto.sample(LAPS), pareto.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    var pareto = GENERATORS.Pareto.g();
                    return utils.diff_cont(pareto.pdf, pareto.cdf, 0, 10, 0.1) < MAX_AVG_DIFF;
                });
            });
        });

        describe('poisson', function () {
            it('should return an array of Poisson distributed values', function () {
                utils.trials(function() {
                    var poisson = GENERATORS.Poisson.g();
                    return utils.chi_test(poisson.sample(LAPS), poisson.pmf, 1);
                });
            });
            it('sum of pmf should give cdf', function () {
                utils.trials(function () {
                    var poisson = GENERATORS.Poisson.g();
                    return utils.diff_disc(poisson.pmf, poisson.cdf, 0, 100) < MAX_AVG_DIFF;
                });
            });
        });

        describe('uniform', function () {
            it('should return an array of uniformly distributed values', function () {
                utils.trials(function() {
                    var uniform = GENERATORS.Uniform.g();
                    return utils.ks_test(uniform.sample(LAPS), uniform.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    var uniform = GENERATORS.Uniform.g();
                    return utils.diff_cont(uniform.pdf, uniform.cdf, -100, 100, 0.1) < MAX_AVG_DIFF;
                });
            });
        });

        describe('weibull', function () {
            it('should return an array of Weibull distributed values', function () {
                utils.trials(function() {
                    var weibull = GENERATORS.Weibull.g();
                    return utils.ks_test(weibull.sample(LAPS), weibull.cdf);
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    var weibull = GENERATORS.Weibull.g();
                    return utils.diff_cont(weibull.pdf, weibull.cdf, 0, 10, 0.01) < MAX_AVG_DIFF;
                });
            });
        });
    });
});
