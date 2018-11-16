const utils = require('../test/test-utils').test_utils;
const dist = require('../src/index').dist;
const core = require('../src/index').core;

const LAPS = 100;
const MAX_AVG_DIFF = 1e-3;
const GENERATORS = {
    Bernoulli: {
        g: function() {
            return new dist.Bernoulli(core.float());
        }
    },
    Beta: {
        g: function() {
            return new dist.Beta(core.float(0.1, 5), core.float(0.1, 5));
        }
    },
    BoundedPareto: {
        g: function() {
            const xmin = core.float(0.1, 5);
            return new dist.BoundedPareto(xmin, xmin + core.float(1, 5), core.float(0.1, 3));
        }
    },
    Erlang: {
        g: function() {
            return new dist.Erlang(core.int(1, 10), core.float(0.1, 5));
        }
    },
    Exponential: {
        g: function() {
            return new dist.Exponential(core.float(0.1, 5));
        }
    },
    Gamma: {
        g: function() {
            return new dist.Gamma(core.float(0.1, 10), core.float(0.1, 3));
        }
    },
    GeneralizedGamma: {
        g: function() {
            return new dist.GeneralizedGamma(core.float(0.1, 10), core.float(0.1, 5), core.float(0.1, 10));
        }
    },
    InverseGamma: {
        g: function() {
            return new dist.InverseGamma(core.float(0.1, 5), core.float(0.1, 3));
        }
    },
    Lognormal: {
        g: function() {
            return new dist.Lognormal(core.float(-2, 2), core.float(0.1, 5));
        }
    },
    Normal: {
        g: function() {
            return new dist.Normal(core.float(-5, 5), core.float(0.1, 10));
        }
    },
    Pareto: {
        g: function() {
            return new dist.Pareto(core.float(0.1, 5), core.float(0.1, 10));
        }
    },
    Poisson: {
        g: function() {
            return new dist.Poisson(core.float(0.1, 100));
        }
    },
    UniformContinuous: {
        g: function() {
            const xmin = core.float(10);
            return new dist.UniformContinuous(xmin, xmin + core.float(0.1, 100));
        }
    },
    UniformDiscrete: {
        g: function() {
            const xmin = core.int(10);
            return new dist.UniformDiscrete(xmin, xmin + core.int(10, 100));
        }
    },
    Weibull: {
        g: function() {
            return new dist.Weibull(core.float(0.1, 10), core.float(0.1, 10));
        }
    }
};


describe('dist', function() {
    describe('Distribution', () => {
        it('should test a discrete distribution', () => {
            utils.trials(function () {
                const poisson = GENERATORS.Poisson.g();
                const uniform = GENERATORS.UniformDiscrete.g();
                return poisson.test(poisson.sample(LAPS)).passed
                    && !poisson.test(uniform.sample(LAPS)).passed;
            });
        });

        it('should test a continuous distribution', () => {
            utils.trials(function () {
                const pareto = GENERATORS.Pareto.g();
                const uniform = GENERATORS.UniformContinuous.g();
                return pareto.test(pareto.sample(LAPS)).passed
                    && !pareto.test(uniform.sample(LAPS)).passed;
            });
        });
    });

    describe('Bernoulli', function () {
        it('should return an array of Bernoulli distributed values', function () {
            utils.trials(function () {
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

    describe('Beta', function () {
        it('should return an array of beta distributed values', function () {
            utils.trials(function () {
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

    describe('Binomial', function () {
        describe('.sample', () => {
            it('should return an array of binomial distributed values (low n)', function () {
                utils.trials(function () {
                    const binomial = new dist.Binomial(core.int(2, 24), core.float());
                    return utils.chi_test(binomial.sample(LAPS), x => binomial.pdf(x), 2);
                });
            });
            it('should return an array of binomial distributed values (low mean)', function () {
                utils.trials(function () {
                    const binomial = new dist.Binomial(core.int(30, 100), core.float()/105);
                    return utils.chi_test(binomial.sample(LAPS), x => binomial.pdf(x), 2);
                });
            });
            it('should return an array of binomial distributed values (high n)', function () {
                utils.trials(function () {
                    const binomial = new dist.Binomial(core.int(100, 200), core.float());
                    return utils.chi_test(binomial.sample(LAPS), x => binomial.pdf(x), 2);
                });
            });
        });

        describe('.cdf', () => {
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    const binomial = new dist.Binomial(core.int(100, 200), core.float());
                    return utils.diff_disc(x => binomial.pdf(x), x => binomial.cdf(x), 0, 200) < MAX_AVG_DIFF;
                });
            });
        });
    });

    describe('BoundedPareto', function () {
        it('should return an array of bounded Pareto distributed values', function () {
            utils.trials(function () {
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

    describe('Chi2', function () {
        it('should return an array of chi square distributed values', function () {
            utils.trials(function () {
                const chi2 = new dist.Chi2(core.int(1, 10));
                return utils.ks_test(chi2.sample(LAPS), x => chi2.cdf(x));
            });
        });
        it('integral of pdf should give cdf', function () {
            utils.trials(function () {
                const chi2 = new dist.Chi2(core.int(1, 10));
                return utils.diff_cont(x => chi2.pdf(x), x => chi2.cdf(x), 0, 10, 0.01) < MAX_AVG_DIFF;
            });
        });
    });

    describe('Custom', () => {
        it('should return an array of custom distributed values', () => {
            utils.trials(() => {
                const custom = new dist.Custom(Array.from({length: core.int(10, 100)}, Math.random));
                return utils.chi_test(custom.sample(LAPS), x => custom.pdf(x), 0);
            });
        });
        it('sum of pmf should give cdf', () => {
            utils.trials(() => {
                const weights = Array.from({length: core.int(10, 100)}, Math.random);
                const custom = new dist.Custom(weights);
                return utils.diff_disc(x => custom.pdf(x), x => custom.cdf(x), 0, weights.length) < MAX_AVG_DIFF;
            });
        });
    });

    describe('Degenerate', () => {
        it('should return an array of degenerate distributed values', () => {
            utils.trials(() => {
                const x0 = core.float(-10, 10);
                const degenerate = new dist.Degenerate(x0);
                const samples = degenerate.sample(LAPS);
                return samples.reduce((s, d) => s && d === x0, true);
            });
        });
        it('sum of pmf should give cdf', () => {
            utils.trials(() => {
                const x0 = core.float(-10, 10);
                const degenerate = new dist.Degenerate(x0);
                return utils.diff_mesh(x => degenerate.pdf(x), x => degenerate.cdf(x),
                    Array.from({length: 201}, (d, i) => x0 + (i-100) / 10)
                ) < MAX_AVG_DIFF;
            });
        });
    });

    describe('Erlang', () => {
        it('should return an array of Erlang distributed values', () => {
            utils.trials(() => {
                const erlang = GENERATORS.Erlang.g();
                return utils.ks_test(erlang.sample(LAPS), x => erlang.cdf(x));
            });
        });
        it('integral of pdf should give cdf', () => {
            utils.trials(() => {
                const erlang = GENERATORS.Erlang.g();
                return utils.diff_cont(x => erlang.pdf(x), x => erlang.cdf(x), 0, 10, 0.01) < MAX_AVG_DIFF;
            });
        });
    });

    describe('Exponential', () => {
        it('should return an array of exponentially distributed values', () => {
            utils.trials(() => {
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

    describe('Gamma', function () {
        it('should return an array of gamma distributed values', function () {
            utils.trials(function () {
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

    describe('GeneralizedGamma', function () {
        it('should return an array of generalized gamma distributed values', function () {
            utils.trials(function () {
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

    describe('InverseGamma', function () {
        it('should return an array of inverse-gamma distributed values', function () {
            utils.trials(function () {
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

    describe('Lognormal', function () {
        it('should return an array of log-normally distributed values', function () {
            utils.trials(function () {
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

    describe('Normal', function () {
        it('should return an array of normally distributed values', function () {
            utils.trials(function () {
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

    describe('Pareto', function () {
        it('should return an array of Pareto distributed values', function () {
            utils.trials(function () {
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

    describe('Poisson', function () {
        it('should return an array of Poisson distributed values', function () {
            utils.trials(function () {
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

    describe('UniformContinuous', function () {
        it('should return an array of uniformly distributed values', function () {
            utils.trials(function () {
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

    describe('UniformDiscrete', function () {
        it('should return an array of Poisson distributed values', function () {
            utils.trials(function () {
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

    describe('Weibull', function () {
        it('should return an array of Weibull distributed values', function () {
            utils.trials(function () {
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
