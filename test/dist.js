const utils = require('../test/test-utils').test_utils;
const dist = require('../src/index').dist;
const core = require('../src/index').core;

const LAPS = 100;
const LAPS_2 = 10000;
const MAX_AVG_DIFF = 1e-3;
const EPSILON = 1e-6;
const GENERATORS = {
    UniformContinuous: {
        g: function() {
            ;
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
        const p = () => [core.float()];
        it('should return an array of Bernoulli distributed values', function () {
            utils.trials(function () {
                const bernoulli = new dist.Bernoulli(...p());
                return utils.chi_test(bernoulli.sample(LAPS), x => bernoulli.pdf(x), 1);
            });
        });
        it('sum of pmf should give cdf', function () {
            utils.trials(function () {
                const bernoulli = new dist.Bernoulli(...p());
                return utils.diff_disc(x => bernoulli.pdf(x), x => bernoulli.cdf(x), 0, 1) < MAX_AVG_DIFF;
            });
        });
    });

    describe('Beta', function () {
        const p = () => [core.float(0.1, 2), core.float(0.1, 2)];
        it('should return an array of beta distributed values', function () {
            utils.trials(function () {
                const beta = new dist.Beta(...p());
                return utils.ks_test(beta.sample(LAPS), x => beta.cdf(x));
            });
        });
        it('integral of pdf should give cdf', function () {
            utils.trials(function () {
                const beta = new dist.Beta(...p());
                return utils.cdf2pdf(beta,  [0.01, 0.99], LAPS_2) < EPSILON;
            });
        });
    });

    describe('Binomial', function () {
        describe('low n', () => {
            const p = () => [core.int(2, 24), core.float()];
            it('should return an array of binomial distributed values', function () {
                utils.trials(function () {
                    const binomial = new dist.Binomial(...p());
                    return utils.chi_test(binomial.sample(LAPS), x => binomial.pdf(x), 2);
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    const binomial = new dist.Binomial(...p());
                    return utils.diff_disc(x => binomial.pdf(x), x => binomial.cdf(x), 0, 25) < MAX_AVG_DIFF;
                });
            });
        });

        describe('low mean', () => {
            const p = () => [core.int(30, 100), core.float()/105];
            it('should return an array of binomial distributed values', function () {
                utils.trials(function () {
                    const binomial = new dist.Binomial(...p());
                    return utils.chi_test(binomial.sample(LAPS), x => binomial.pdf(x), 2);
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    const binomial = new dist.Binomial(...p());
                    return utils.diff_disc(x => binomial.pdf(x), x => binomial.cdf(x), 0, 25) < MAX_AVG_DIFF;
                });
            });
        });

        describe('high n', () => {
            const p = () => [core.int(100, 150), core.float()];
            it('should return an array of binomial distributed values', function () {
                utils.trials(function () {
                    const binomial = new dist.Binomial(...p());
                    return utils.chi_test(binomial.sample(LAPS), x => binomial.pdf(x), 2);
                });
            });
            it('integral of pdf should give cdf', function () {
                utils.trials(function () {
                    const binomial = new dist.Binomial(...p());
                    return utils.diff_disc(x => binomial.pdf(x), x => binomial.cdf(x), 0, 25) < MAX_AVG_DIFF;
                });
            });
        });
    });

    describe('BoundedPareto', function () {
        const p = () => {
            const xmin = core.float(0.1, 5);
            return [xmin, xmin + core.float(1, 5), core.float(0.1, 3)];
        };
        it('should return an array of bounded Pareto distributed values', function () {
            utils.trials(function () {
                const boundedPareto = new dist.BoundedPareto(...p());
                return utils.ks_test(boundedPareto.sample(LAPS), x => boundedPareto.cdf(x));
            });
        });
        it('integral of pdf should give cdf', function () {
            utils.trials(function () {
                const boundedPareto = new dist.BoundedPareto(...p());
                return utils.cdf2pdf(boundedPareto,  [-5, 5], LAPS_2) < EPSILON;
            });
        });
    });

    describe('Cauchy', () => {
        const p = () => [core.float(), core.float(0.5, 2)];
        it('should return an array of Cauchy distributed values', () => {
            utils.trials(() => {
                const cauchy = new dist.Cauchy(...p());
                return utils.ks_test(cauchy.sample(LAPS), x => cauchy.cdf(x));
            });
        });

        it('differentiating cdf should give pdf', () => {
            utils.trials(() => {
                const cauchy = new dist.Cauchy(...p());
                return utils.cdf2pdf(cauchy,  [-5, 5], LAPS_2) < EPSILON;
            });
        });
    });

    describe('Chi2', function () {
        const p = () => [core.int(1, 10)];
        it('should return an array of chi square distributed values', function () {
            utils.trials(function () {
                const chi2 = new dist.Chi2(...p());
                return utils.ks_test(chi2.sample(LAPS), x => chi2.cdf(x));
            });
        });
        it('integral of pdf should give cdf', function () {
            utils.trials(function () {
                const chi2 = new dist.Chi2(...p());
                return utils.cdf2pdf(chi2, [0.01, 10], LAPS_2) < EPSILON;
            });
        });
    });

    describe('Custom', () => {
        const p = () => [Array.from({length: core.int(10, 100)}, Math.random)];
        it('should return an array of custom distributed values', () => {
            utils.trials(() => {
                const custom = new dist.Custom(...p());
                return utils.chi_test(custom.sample(LAPS), x => custom.pdf(x), 0);
            });
        });
        it('sum of pmf should give cdf', () => {
            utils.trials(() => {
                const w = p();
                const custom = new dist.Custom(...w);
                return utils.diff_disc(x => custom.pdf(x), x => custom.cdf(x), 0, w.length) < MAX_AVG_DIFF;
            });
        });
    });

    describe('Degenerate', () => {
        const p = () => [core.float(-10, 10)];
        it('should return an array of degenerate distributed values', () => {
            utils.trials(() => {
                const x0 = p();
                const degenerate = new dist.Degenerate(...x0);
                const samples = degenerate.sample(LAPS);
                return samples.reduce((s, d) => s && d === x0[0], true);
            });
        });
        it('sum of pmf should give cdf', () => {
            utils.trials(() => {
                const x0 = p();
                const degenerate = new dist.Degenerate(...x0);
                return utils.diff_mesh(x => degenerate.pdf(x), x => degenerate.cdf(x),
                    Array.from({length: 201}, (d, i) => x0[0] + (i-100) / 10)
                ) < MAX_AVG_DIFF;
            });
        });
    });

    describe('Erlang', () => {
        const p = () => [core.int(1, 10), core.float(0.1, 5)];
        it('should return an array of Erlang distributed values', () => {
            utils.trials(() => {
                const erlang = new dist.Erlang(...p());
                return utils.ks_test(erlang.sample(LAPS), x => erlang.cdf(x));
            });
        });
        it('integral of pdf should give cdf', () => {
            utils.trials(() => {
                const erlang = new dist.Erlang(...p());
                return utils.cdf2pdf(erlang, [0.01, 10], LAPS_2) < EPSILON;
            });
        });
    });

    describe('Exponential', () => {
        const p = () => [core.float(0.1, 5)];
        it('should return an array of exponentially distributed values', () => {
            utils.trials(() => {
                const exponential = new dist.Exponential(...p());
                return utils.ks_test(exponential.sample(LAPS), x => exponential.cdf(x));
            });
        });
        it('integral of pdf should give cdf', function () {
            utils.trials(function () {
                const exponential = new dist.Exponential(...p());
                return utils.cdf2pdf(exponential, [0.01, 10], LAPS_2) < EPSILON;
            });
        });
    });

    describe('Gamma', function () {
        const p = () => [core.float(0.1, 10), core.float(0.1, 3)];
        it('should return an array of gamma distributed values', function () {
            utils.trials(function () {
                const gamma = new dist.Gamma(...p());
                return utils.ks_test(gamma.sample(LAPS), x => gamma.cdf(x));
            });
        });
        it('integral of pdf should give cdf', function () {
            utils.trials(function () {
                const gamma = new dist.Gamma(...p());
                return utils.cdf2pdf(gamma, [0.01, 10], LAPS_2) < EPSILON;
            });
        });
    });

    describe('GeneralizedGamma', function () {
        const p = () => [core.float(0.1, 10), core.float(0.1, 5), core.float(0.1, 10)];
        it('should return an array of generalized gamma distributed values', function () {
            utils.trials(function () {
                const generalizedGamma = new dist.GeneralizedGamma(...p());
                return utils.ks_test(generalizedGamma.sample(LAPS), x => generalizedGamma.cdf(x));
            });
        });
        it('integral of pdf should give cdf', function () {
            utils.trials(function () {
                const generalizedGamma = new dist.GeneralizedGamma(...p());
                return utils.cdf2pdf(generalizedGamma, [0.01, 10], LAPS_2) < EPSILON;
            });
        });
    });

    describe('InverseGamma', () => {
        const p = () => [core.float(0.1, 5), core.float(0.1, 3)];
        it('should return an array of inverse-gamma distributed values', () => {
            utils.trials(() => {
                const inverseGamma = new dist.InverseGamma(...p());
                return utils.ks_test(inverseGamma.sample(LAPS), x => inverseGamma.cdf(x));
            });
        });
        it('differentiating cdf should give pdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.InverseGamma(...p()),
                    [0, 10], LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('Lognormal', () => {
        const p = () => [core.float(-2, 2), core.float(0.1, 5)];
        it('should return an array of log-normally distributed values', () => {
            utils.trials(() => {
                const lognormal = new dist.Lognormal(...p());
                return utils.ks_test(lognormal.sample(LAPS), x => lognormal.cdf(x));
            });
        });
        it('differentiating cdf should give pdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.Lognormal(...p()),
                    [0, 10], LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('Normal', function () {
        const p = () => [core.float(-5, 5), core.float(0.1, 10)];
        it('should return an array of normally distributed values', function () {
            utils.trials(function () {
                const normal = new dist.Normal(...p());
                return utils.ks_test(normal.sample(LAPS), x => normal.cdf(x));
            });
        });
        it('differentiating cdf should give pdf', function () {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.Normal(...p()),
                    [0, 10], LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('Pareto', function () {
        const p = () => [core.float(0.1, 5), core.float(0.1, 10)];
        it('should return an array of Pareto distributed values', function () {
            utils.trials(function () {
                const pareto = new dist.Pareto(...p());
                return utils.ks_test(pareto.sample(LAPS), x => pareto.cdf(x));
            });
        });
        it('integral of pdf should give cdf', function () {
            utils.trials(function () {
                const pareto = new dist.Pareto(...p());
                return utils.cdf2pdf(pareto, [0.01, 10], LAPS_2) < EPSILON;
            });
        });
    });

    describe('Poisson', function () {
        const p = () => [core.float(0.1, 10)];
        it('should return an array of Poisson distributed values', function () {
            utils.trials(function () {
                const poisson = new dist.Poisson(...p());
                return utils.chi_test(poisson.sample(LAPS), x => poisson.pdf(x), 1);
            });
        });
        it('sum of pmf should give cdf', function () {
            utils.trials(function () {
                const poisson = new dist.Poisson(...p());
                return utils.diff_disc(x => poisson.pdf(x), x => poisson.cdf(x), 0, 100) < MAX_AVG_DIFF;
            });
        });
    });

    describe('UniformContinuous', function () {
        const p = () => {
            const xmin = core.float(10);
            return [xmin, xmin + core.float(0.1, 100)];
        };
        it('should return an array of uniformly distributed values', function () {
            utils.trials(function () {
                const uniform = new dist.UniformContinuous(...p());
                return utils.ks_test(uniform.sample(LAPS), x => uniform.cdf(x));
            });
        });
        it('integral of pdf should give cdf', function () {
            utils.trials(function () {
                const uniform = new dist.UniformContinuous(...p());
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
