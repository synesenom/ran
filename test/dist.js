const utils = require('../test/test-utils').test_utils;
const dist = require('../src/ran').dist;

const LAPS = 1000;
const MAX_AVG_DIFF = 1e-3;
const GENERATORS = {
    Bernoulli: {
        g: function() {
            return new dist.Bernoulli(utils.param.prob());
        }
    },
    Beta: {
        g: function() {
            return new dist.Beta(utils.param.scale(), utils.param.scale());
        }
    },
    Binomial: {
        g: function() {
            return new dist.Binomial(parseInt(utils.param.scale() * 100), utils.param.prob());
        }
    },
    BoundedPareto: {
        g: function() {
            const xmin = utils.param.scale();
            return new dist.BoundedPareto(xmin, xmin+utils.param.scale(), utils.param.shape());
        }
    },
    Chi2: {
        g: function() {
            return new dist.Chi2(utils.param.degree());
        }
    },
    Erlang: {
        g: function() {
            return new dist.Erlang(utils.param.degree(), utils.param.rate());
        }
    },
    Exponential: {
        g: function() {
            return new dist.Exponential(utils.param.rate());
        }
    },
    Gamma: {
        g: function() {
            return new dist.Gamma(utils.param.shape(), utils.param.rate());
        }
    },
    GeneralizedGamma: {
        g: function() {
            return new dist.GeneralizedGamma(utils.param.rate(), utils.param.shape(), utils.param.scale());
        }
    },
    InverseGamma: {
        g: function() {
            return new dist.InverseGamma(utils.param.shape(), utils.param.scale());
        }
    },
    Lognormal: {
        g: function() {
            return new dist.Lognormal(utils.param.scale(), utils.param.shape());
        }
    },
    Normal: {
        g: function() {
            return new dist.Normal(utils.param.scale(), utils.param.shape());
        }
    },
    Pareto: {
        g: function() {
            return new dist.Pareto(utils.param.scale(), utils.param.shape());
        }
    },
    Poisson: {
        g: function() {
            return new dist.Poisson(utils.param.rate() * 10);
        }
    },
    UniformContinuous: {
        g: function() {
            const xmin = utils.param.scale();
            return new dist.UniformContinuous(xmin, xmin + utils.param.rate());
        }
    },
    UniformDiscrete: {
        g: function() {
            const xmin = parseInt(utils.param.scale()*40);
            return new dist.UniformDiscrete(xmin, xmin + parseInt(50*utils.param.scale()));
        }
    },
    Weibull: {
        g: function() {
            return new dist.Weibull(utils.param.scale(), utils.param.shape());
        }
    }
};

describe('ran', function() {
    describe('dist', function() {
        describe('bernoulli', function () {
            it('should return an array of Bernoulli distributed values', function () {
                utils.trials(function() {
                    const bernoulli = GENERATORS.Bernoulli.g();
                    return utils.chi_test(bernoulli.sample(LAPS), x => bernoulli.pdf(x), 1);
                });
            });
            it('sum of pmf should give cdf', function () {
                utils.trials(function () {
                    const bernoulli = GENERATORS.Bernoulli.g();
                    return utils.diff_disc(x => bernoulli.pdf(x), x => bernoulli.cdf(x), 0, 1) < MAX_AVG_DIFF;
                });
            });
        });

        describe('beta', function () {
            it('should return an array of beta distributed values', function () {
                utils.trials(function() {
                    const beta = GENERATORS.Beta.g();
                    return utils.ks_test(beta.sample(LAPS), x => beta.cdf(x));
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    const beta = GENERATORS.Beta.g();
                    return utils.diff_cont(x => beta.pdf(x), x => beta.cdf(x), 0, 1, 0.01) < MAX_AVG_DIFF;
                });
            });
        });

        describe('binomial', function () {
            it('should return an array of binomial distributed values', function () {
                utils.trials(function() {
                    const binomial = GENERATORS.Binomial.g();
                    return utils.chi_test(binomial.sample(LAPS), x=> binomial.pdf(x), 2);
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    const binomial = GENERATORS.Binomial.g();
                    return utils.diff_disc(x => binomial.pdf(x), x => binomial.cdf(x), 0, 100) < MAX_AVG_DIFF;
                });
            });
        });

        describe('boundedPareto', function () {
            it('should return an array of bounded Pareto distributed values', function () {
                utils.trials(function() {
                    const boundedPareto = GENERATORS.BoundedPareto.g();
                    return utils.ks_test(boundedPareto.sample(LAPS), x => boundedPareto.cdf(x));
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    const boundedPareto = GENERATORS.BoundedPareto.g();
                    return utils.diff_cont(x => boundedPareto.pdf(x), x => boundedPareto.cdf(x), 0, 10, 0.01) < MAX_AVG_DIFF;
                });
            });
        });

        describe('chi2', function () {
            it('should return an array of chi square distributed values', function () {
                utils.trials(function() {
                    const chi2 = GENERATORS.Chi2.g();
                    return utils.ks_test(chi2.sample(LAPS), x => chi2.cdf(x));
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    const chi2 = GENERATORS.Chi2.g();
                    return utils.diff_cont(x => chi2.pdf(x), x => chi2.cdf(x), 0, 10, 0.01) < MAX_AVG_DIFF;
                });
            });
        });

        describe('custom', function () {
            it('should return an array of custom distributed values', function () {
                utils.trials(function() {
                    const k = parseInt(Math.random() * 5 + 3);
                    let weights = [];
                    for (let i=0; i<k; i++) {
                        let w = Math.random() * 10;
                        weights.push(w);
                    }
                    const custom = new dist.Custom(weights);
                    return utils.chi_test(custom.sample(LAPS), x => custom.pdf(x), k-1);
                });
            });
            it('sum of pmf should give cdf', function () {
                utils.trials(function () {
                    const k = parseInt(Math.random() * 5 + 3);
                    let weights = [];
                    for (let i=0; i<k; i++) {
                        let w = Math.random() * 10;
                        weights.push(w);
                    }
                    const custom = new dist.Custom(weights);
                    return utils.diff_disc(x => custom.pdf(x), x => custom.cdf(x), 0, weights.length) < MAX_AVG_DIFF;
                });
            });
        });

        describe('erlang', function () {
            it('should return an array of Erlang distributed values', function () {
                utils.trials(function() {
                    const erlang = GENERATORS.Erlang.g();
                    return utils.ks_test(erlang.sample(LAPS), x => erlang.cdf(x));
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    const erlang = GENERATORS.Erlang.g();
                    return utils.diff_cont(x => erlang.pdf(x), x => erlang.cdf(x), 0, 10, 0.01) < MAX_AVG_DIFF;
                });
            });
        });

        describe('exponential', function () {
            it('should return an array of exponentially distributed values', function () {
                utils.trials(function() {
                    const exponential = GENERATORS.Exponential.g();
                    return utils.ks_test(exponential.sample(LAPS), x => exponential.cdf(x));
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    const exponential = GENERATORS.Exponential.g();
                    return utils.diff_cont(x => exponential.pdf(x), x => exponential.cdf(x), 0, 10, 0.01) < MAX_AVG_DIFF;
                });
            });
        });

        describe('gamma', function () {
            it('should return an array of gamma distributed values', function () {
                utils.trials(function() {
                    const gamma = GENERATORS.Gamma.g();
                    return utils.ks_test(gamma.sample(LAPS), x => gamma.cdf(x));
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    const gamma = GENERATORS.Gamma.g();
                    return utils.diff_cont(x => gamma.pdf(x), x => gamma.cdf(x), 0, 10, 0.1) < MAX_AVG_DIFF;
                });
            });
        });

        describe('generalizedGamma', function () {
            it('should return an array of generalized gamma distributed values', function () {
                utils.trials(function() {
                    const generalizedGamma = GENERATORS.GeneralizedGamma.g();
                    return utils.ks_test(generalizedGamma.sample(LAPS), x => generalizedGamma.cdf(x));
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    const generalizedGamma = GENERATORS.GeneralizedGamma.g();
                    return utils.diff_cont(x => generalizedGamma.pdf(x), x => generalizedGamma.cdf(x), 0, 10, 0.1) < MAX_AVG_DIFF;
                });
            });
        });

        describe('inverseGamma', function () {
            it('should return an array of inverse-gamma distributed values', function () {
                utils.trials(function() {
                    const inverseGamma = GENERATORS.InverseGamma.g();
                    return utils.ks_test(inverseGamma.sample(LAPS), x => inverseGamma.cdf(x));
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    const inverseGamma = GENERATORS.InverseGamma.g();
                    return utils.diff_cont(x => inverseGamma.pdf(x), x => inverseGamma.cdf(x), 0, 10, 0.1) < MAX_AVG_DIFF;
                });
            });
        });

        describe('lognormal', function () {
            it('should return an array of log-normally distributed values', function () {
                utils.trials(function() {
                    const lognormal = GENERATORS.Lognormal.g();
                    return utils.ks_test(lognormal.sample(LAPS), x => lognormal.cdf(x));
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    const lognormal = GENERATORS.Lognormal.g();
                    return utils.diff_cont(x => lognormal.pdf(x), x => lognormal.cdf(x), 0, 5, 0.01) < MAX_AVG_DIFF;
                });
            });
        });

        describe('normal', function () {
            it('should return an array of normally distributed values', function () {
                utils.trials(function() {
                    const normal = GENERATORS.Normal.g();
                    return utils.ks_test(normal.sample(LAPS), x => normal.cdf(x));
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    const normal = GENERATORS.Normal.g();
                    return utils.diff_cont(x => normal.pdf(x), x => normal.cdf(x), -100, 100, 0.1) < MAX_AVG_DIFF;
                });
            });
        });

        describe('pareto', function () {
            it('should return an array of Pareto distributed values', function () {
                utils.trials(function() {
                    const pareto = GENERATORS.Pareto.g();
                    return utils.ks_test(pareto.sample(LAPS), x => pareto.cdf(x));
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    const pareto = GENERATORS.Pareto.g();
                    return utils.diff_cont(x => pareto.pdf(x), x => pareto.cdf(x), 0, 10, 0.1) < MAX_AVG_DIFF;
                });
            });
        });

        describe('poisson', function () {
            it('should return an array of Poisson distributed values', function () {
                utils.trials(function() {
                    const poisson = GENERATORS.Poisson.g();
                    return utils.chi_test(poisson.sample(LAPS), x => poisson.pdf(x), 1);
                });
            });
            it('sum of pmf should give cdf', function () {
                utils.trials(function () {
                    const poisson = GENERATORS.Poisson.g();
                    return utils.diff_disc(x => poisson.pdf(x), x => poisson.cdf(x), 0, 100) < MAX_AVG_DIFF;
                });
            });
        });

        describe('uniform continuous', function () {
            it('should return an array of uniformly distributed values', function () {
                utils.trials(function() {
                    const uniform = GENERATORS.UniformContinuous.g();
                    return utils.ks_test(uniform.sample(LAPS), x => uniform.cdf(x));
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    const uniform = GENERATORS.UniformContinuous.g();
                    return utils.diff_cont(x => uniform.pdf(x), x => uniform.cdf(x), -100, 100, 0.1) < MAX_AVG_DIFF;
                });
            });
        });

        describe('uniform discrete', function () {
            it('should return an array of Poisson distributed values', function () {
                utils.trials(function() {
                    const uniform = GENERATORS.UniformDiscrete.g();
                    return utils.chi_test(uniform.sample(LAPS), x => uniform.pdf(x), 1);
                });
            });
            it('sum of pmf should give cdf', function () {
                utils.trials(function () {
                    const uniform = GENERATORS.UniformDiscrete.g();
                    return utils.diff_disc(x => uniform.pdf(x), x => uniform.cdf(x), 0, 100) < MAX_AVG_DIFF;
                });
            });
        });

        describe('weibull', function () {
            it('should return an array of Weibull distributed values', function () {
                utils.trials(function() {
                    const weibull = GENERATORS.Weibull.g();
                    return utils.ks_test(weibull.sample(LAPS), x => weibull.cdf(x));
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    const weibull = GENERATORS.Weibull.g();
                    return utils.diff_cont(x => weibull.pdf(x), x => weibull.cdf(x), 0, 10, 0.01) < MAX_AVG_DIFF;
                });
            });
        });
    });
});
