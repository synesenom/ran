require = require('esm')(module);
const utils = require('../test/test-utils').test_utils;
const dist = require('../src/index').dist;
const core = require('../src/index').core;
const assert = require('assert');

const LAPS = 100;
const LAPS_2 = 1000;
const MAX_AVG_DIFF = 1e-3;
const EPSILON = 1e-6;


describe('dist', () => {
    describe('Distribution', () => {
        it('should test a discrete distribution', () => {
            const p1 = () => [core.float(0.1, 10)],
                p2 = () => [core.int(0, 10), core.int(20, 40)];
            utils.trials(() => {
                const poisson = new dist.Poisson(...p1());
                const uniform = new dist.UniformDiscrete(...p2());
                return poisson.test(poisson.sample(10 * LAPS)).passed
                    && !poisson.test(uniform.sample(10 * LAPS)).passed;
            });
        });

        it('should test a continuous distribution', () => {
            const p1 = () => [core.float(0.1, 5), core.float(0.1, 10)],
                p2 = () => [core.float(0, 10), core.float(10.1, 100)];
            utils.trials(() => {
                const pareto = new dist.Pareto(...p1());
                const uniform = new dist.UniformContinuous(...p2());
                return pareto.test(pareto.sample(10 * LAPS)).passed
                    && !pareto.test(uniform.sample(10 * LAPS)).passed;
            });
        });

        it('should throw a "Distribution._generator is not implemented" error', () => {
            const invalid = new dist._InvalidDistribution();
            assert.throws(() => {
                invalid.sample();
            }, {
                message: 'Distribution._generator is not implemented'
            });
        });

        it('should throw a "Distribution._pdf is not implemented" error', () => {
            const invalid = new dist._InvalidDistribution();
            assert.throws(() => {
                invalid.pdf(0);
            }, {
                message: 'Distribution._pdf is not implemented'
            });
        });

        it('should throw a "Distribution._cdf is not implemented" error', () => {
            const invalid = new dist._InvalidDistribution();
            assert.throws(() => {
                invalid.cdf(0);
            }, {
                message: 'Distribution._cdf is not implemented'
            });
        });

        it('should throw a "Distribution._cdf is not implemented" error', () => {
            const invalid = new dist._InvalidDistribution();
            assert.throws(() => {
                invalid.survival(0);
            }, {
                message: 'Distribution._cdf is not implemented'
            });
        });

        it('should throw a "Distribution._pdf is not implemented" error', () => {
            const invalid = new dist._InvalidDistribution();
            assert.throws(() => {
                invalid.hazard(0);
            }, {
                message: 'Distribution._pdf is not implemented'
            });
        });

        it('should throw a "Distribution._cdf is not implemented" error', () => {
            const invalid = new dist._InvalidDistribution();
            assert.throws(() => {
                invalid.cHazard(0);
            }, {
                message: 'Distribution._cdf is not implemented'
            });
        });

        it('should throw a "Distribution._pdf is not implemented" error', () => {
            const invalid = new dist._InvalidDistribution();
            assert.throws(() => {
                invalid.lnPdf(0);
            }, {
                message: 'Distribution._pdf is not implemented'
            });
        });

        it('should throw a "Distribution._pdf is not implemented" error', () => {
            const invalid = new dist._InvalidDistribution();
            assert.throws(() => {
                invalid.L([0]);
            }, {
                message: 'Distribution._pdf is not implemented'
            });
        });

        it('should throw a "Distribution._pdf is not implemented" error', () => {
            const invalid = new dist._InvalidDistribution();
            assert.throws(() => {
                invalid.test([0]);
            }, {
                message: 'Distribution._pdf is not implemented'
            });
        });
    });

    describe('Arcsine', () => {
        const p = () => {
            const xmin = core.float(10);
            return [xmin, xmin + core.float(0.1, 100)];
        };

        it('should return an array of arcsine distributed values', () => {
            utils.trials(() => {
                const arcsine = new dist.Arcsine(...p());
                return utils.ks_test(arcsine.sample(LAPS), x => arcsine.cdf(x));
            });
        });

        it('integral of pdf should give cdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.Arcsine(...p()),
                    [0.01, 10],
                    LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('Bernoulli', () => {
        const p = () => [core.float()];
        it('should return an array of Bernoulli distributed values', () => {
            utils.trials(() => {
                const bernoulli = new dist.Bernoulli(...p());
                return utils.chi_test(bernoulli.sample(LAPS), x => bernoulli.pdf(x), 1);
            });
        });

        it('sum of pmf should give cdf', () => {
            utils.trials(() => {
                const bernoulli = new dist.Bernoulli(...p());
                return utils.diff_disc(x => bernoulli.pdf(x), x => bernoulli.cdf(x), -2, 3) < MAX_AVG_DIFF;
            });
        });
    });

    describe('Beta', () => {
        const p = () => [core.float(0.1, 3), core.float(0.1, 3)];
        it('should return an array of beta distributed values', () => {
            utils.trials(() => {
                const beta = new dist.Beta(...p());
                return utils.ks_test(beta.sample(LAPS), x => beta.cdf(x));
            });
        });

        it('integral of pdf should give cdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.Beta(...p()),
                    [-1, 2],
                    LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('BetaPrime', () => {
        const p = () => [core.float(0.1, 3), core.float(0.1, 3)];
        it('should return an array of beta prime distributed values', () => {
            utils.trials(() => {
                const betaPrime = new dist.BetaPrime(...p());
                return utils.ks_test(betaPrime.sample(LAPS), x => betaPrime.cdf(x));
            });
        });

        it('integral of pdf should give cdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.BetaPrime(...p()),
                    [-5, 10],
                    LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('Binomial', () => {
        describe('low n', () => {
            const p = () => [core.int(2, 24), core.float()];
            it('should return an array of binomial distributed values', () => {
                utils.trials(() => {
                    const binomial = new dist.Binomial(...p());
                    return utils.chi_test(binomial.sample(LAPS), x => binomial.pdf(x), 2);
                });
            });

            it('integral of pdf should give cdf', () => {
                utils.trials(() => {
                    const binomial = new dist.Binomial(...p());
                    return utils.diff_disc(x => binomial.pdf(x), x => binomial.cdf(x), -10, 25) < MAX_AVG_DIFF;
                });
            });
        });

        describe('low mean', () => {
            const p = () => [core.int(30, 100), core.float()/105];
            it('should return an array of binomial distributed values', () => {
                utils.trials(() => {
                    const binomial = new dist.Binomial(...p());
                    return utils.chi_test(binomial.sample(LAPS), x => binomial.pdf(x), 2);
                });
            });

            it('integral of pdf should give cdf', () => {
                utils.trials(() => {
                    const binomial = new dist.Binomial(...p());
                    return utils.diff_disc(x => binomial.pdf(x), x => binomial.cdf(x), -10, 25) < MAX_AVG_DIFF;
                });
            });
        });

        describe('high n', () => {
            const p = () => [core.int(100, 120), core.float()];
            it('should return an array of binomial distributed values', () => {
                utils.trials(() => {
                    const binomial = new dist.Binomial(...p());
                    return utils.chi_test(binomial.sample(LAPS), x => binomial.pdf(x), 2);
                });
            });

            it('integral of pdf should give cdf', () => {
                utils.trials(() => {
                    const binomial = new dist.Binomial(...p());
                    return utils.diff_disc(x => binomial.pdf(x), x => binomial.cdf(x), -10, 25) < MAX_AVG_DIFF;
                });
            });
        });
    });

    describe('BoundedPareto', () => {
        const p = () => {
            const xmin = core.float(0.1, 5);
            return [xmin, xmin + core.float(1, 5), core.float(0.1, 3)];
        };
        it('should return an array of bounded Pareto distributed values', () => {
            utils.trials(() => {
                const boundedPareto = new dist.BoundedPareto(...p());
                return utils.ks_test(boundedPareto.sample(LAPS), x => boundedPareto.cdf(x));
            });
        });

        it('integral of pdf should give cdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.BoundedPareto(...p()),
                    [-5, 5],
                    LAPS_2
                ) < EPSILON;
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
                return utils.cdf2pdf(
                    new dist.Cauchy(...p()),
                    [-5, 5],
                    LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('Chi2', () => {
        const p = () => [core.int(1, 10)];
        it('should return an array of chi square distributed values', () => {
            utils.trials(() => {
                const chi2 = new dist.Chi2(...p());
                return utils.ks_test(chi2.sample(LAPS), x => chi2.cdf(x));
            });
        });

        it('integral of pdf should give cdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.Chi2(...p()),
                    [0.01, 10],
                    LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('Custom', () => {
        describe('small n', () => {
            const p = () => [Array.from({length: core.int(0, 1)}, Math.random)];
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

        describe('large n', () => {
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
                return utils.cdf2pdf(
                    new dist.Erlang(...p()),
                    [0.01, 10],
                    LAPS_2
                ) < EPSILON;
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

        it('integral of pdf should give cdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.Exponential(...p()),
                    [0.01, 10],
                    LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('F', () => {
        const p = () => [core.float(0.1, 5), core.float(0.1, 5)];
        it('should return an array of F distributed values', () => {
            utils.trials(() => {
                const f = new dist.F(...p());
                return utils.ks_test(f.sample(LAPS), x => f.cdf(x));
            });
        });

        it('integral of pdf should give cdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.F(...p()),
                    [0.01, 10],
                    LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('Frechet', () => {
        const p = () => [core.float(0.1, 5), core.float(0.1, 5), core.float(-5, 5)];
        it('should return an array of Frechet distributed values', () => {
            utils.trials(() => {
                const frechet = new dist.Frechet(...p());
                return utils.ks_test(frechet.sample(LAPS), x => frechet.cdf(x));
            });
        });

        it('integral of pdf should give cdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.Frechet(...p()),
                    [p()[2]+0.5, 10],
                    LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('Gamma', () => {
        const p = () => [core.float(0.1, 10), core.float(0.1, 3)];
        it('should return an array of gamma distributed values', () => {
            utils.trials(() => {
                const gamma = new dist.Gamma(...p());
                return utils.ks_test(gamma.sample(LAPS), x => gamma.cdf(x));
            });
        });

        it('integral of pdf should give cdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.Gamma(...p()),
                    [-2, 10],
                    LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('GeneralizedGamma', () =>{
        const p = () => [core.float(0.1, 10), core.float(0.1, 5), core.float(0.1, 10)];
        it('should return an array of generalized gamma distributed values', () => {
            utils.trials(() => {
                const generalizedGamma = new dist.GeneralizedGamma(...p());
                return utils.ks_test(generalizedGamma.sample(LAPS), x => generalizedGamma.cdf(x));
            });
        });

        it('integral of pdf should give cdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.GeneralizedGamma(...p()),
                    [0.1, 10],
                    LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('Gompertz', () => {
        const p = () => [core.float(0.1, 5), core.float(0.1, 5), core.float(-5, 5)];
        it('should return an array of Gompertz distributed values', () => {
            utils.trials(() => {
                const gompertz = new dist.Gompertz(...p());
                return utils.ks_test(gompertz.sample(LAPS), x => gompertz.cdf(x));
            });
        });

        it('integral of pdf should give cdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.Gompertz(...p()),
                    [p()[2]+0.5, 10],
                    LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('Gumbel', () => {
        const p = () => [core.float(-3, 3), core.float(0.1, 5)];
        it('should return an array of Gumbel distributed values', () => {
            utils.trials(() => {
                const gumbel = new dist.Gumbel(...p());
                return utils.ks_test(gumbel.sample(LAPS), x => gumbel.cdf(x));
            });
        });

        it('integral of pdf should give cdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.Gumbel(...p()),
                        [0.01, 10],
                        LAPS_2
                    ) < EPSILON;
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
                    [-2, 10], LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('InverseGaussian', () => {
        const p = () => [core.float(0.1, 5), core.float(0.1, 5)];
        it('should return an array of inverse Gaussian distributed values', () => {
            utils.trials(() => {
                const inverseGaussian = new dist.InverseGaussian(...p());
                return utils.ks_test(inverseGaussian.sample(LAPS), x => inverseGaussian.cdf(x));
            });
        });

        it('differentiating cdf should give pdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.InverseGaussian(...p()),
                    [0, 10], LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('Laplace', () => {
        const p = () => [core.float(-2, 2), core.float(0.1, 5)];
        it('should return an array of Laplace distributed values', () => {
            utils.trials(() => {
                const laplace = new dist.Laplace(...p());
                return utils.ks_test(laplace.sample(LAPS), x => laplace.cdf(x));
            });
        });

        it('differentiating cdf should give pdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.Laplace(...p()),
                    [0, 10], LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('LogCauchy', () => {
        const p = () => [core.float(-5, 5), core.float(0.1, 5)];
        it('should return an array of log-Cauchy distributed values', () => {
            utils.trials(() => {
                const logcauchy = new dist.LogCauchy(...p());
                return utils.ks_test(logcauchy.sample(LAPS), x => logcauchy.cdf(x));
            });
        });

        it('differentiating cdf should give pdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.LogCauchy(...p()),
                    [-10, 10], LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('Logistic', () => {
        const p = () => [core.float(-5, 5), core.float(0.1, 5)];
        it('should return an array of logistic distributed values', () => {
            utils.trials(() => {
                const logistic = new dist.Logistic(...p());
                return utils.ks_test(logistic.sample(LAPS), x => logistic.cdf(x));
            });
        });

        it('differentiating cdf should give pdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.Logistic(...p()),
                    [-10, 10], LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('LogLogistic', () => {
        describe('positive shape parameter', () => {
            const p = () => [core.float(-5, 5), core.float(0.1, 5), core.float(0.1, 5)];
            it('should return an array of log-logistic distributed values', () => {
                utils.trials(() => {
                    const loglogistic = new dist.LogLogistic(...p());
                    return utils.ks_test(loglogistic.sample(LAPS), x => loglogistic.cdf(x));
                });
            });

            it('differentiating cdf should give pdf', () => {
                utils.trials(() => {
                    return utils.cdf2pdf(
                        new dist.LogLogistic(...p()),
                        [-10, 10], LAPS_2
                    ) < EPSILON;
                });
            });
        });

        describe('negative shape parameter', () => {
            const p = () => [core.float(-5, 5), core.float(0.1, 5), core.float(-5, -0.1)];
            it('should return an array of log-logistic distributed values', () => {
                utils.trials(() => {
                    const loglogistic = new dist.LogLogistic(...p());
                    return utils.ks_test(loglogistic.sample(LAPS), x => loglogistic.cdf(x));
                });
            });

            it('differentiating cdf should give pdf', () => {
                utils.trials(() => {
                    return utils.cdf2pdf(
                        new dist.LogLogistic(...p()),
                        [-10, 10], LAPS_2
                    ) < EPSILON;
                });
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
                    [-2, 10], LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('Lomax', () => {
        const p = () => [core.float(0.1, 5), core.float(0.1, 5)];
        it('should return an array of Lomax distributed values', () => {
            utils.trials(() => {
                const lomax = new dist.Lomax(...p());
                return utils.ks_test(lomax.sample(LAPS), x => lomax.cdf(x));
            });
        });

        it('differentiating cdf should give pdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.Lomax(...p()),
                    [-2, 10], LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('Minimax', () => {
        const p = () => [core.float(0.1, 5), core.float(0.1, 5)];
        it('should return an array of Minimax distributed values', () => {
            utils.trials(() => {
                const minimax = new dist.Minimax(...p());
                return utils.ks_test(minimax.sample(LAPS), x => minimax.cdf(x));
            });
        });

        it('differentiating cdf should give pdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.Minimax(...p()),
                    [-1, 2], LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('Normal', () => {
        const p = () => [core.float(-5, 5), core.float(0.1, 10)];
        it('should return an array of normally distributed values', () => {
            utils.trials(() => {
                const normal = new dist.Normal(...p());
                return utils.ks_test(normal.sample(LAPS), x => normal.cdf(x));
            });
        });

        it('differentiating cdf should give pdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.Normal(...p()),
                    [0, 10], LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('Pareto', () => {
        const p = () => [core.float(0.1, 5), core.float(0.1, 10)];
        it('should return an array of Pareto distributed values', () => {
            utils.trials(() => {
                const pareto = new dist.Pareto(...p());
                return utils.ks_test(pareto.sample(LAPS), x => pareto.cdf(x));
            });
        });

        it('integral of pdf should give cdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.Pareto(...p()),
                    [0.01, 10],
                    LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('Poisson', () => {
        describe('small lambda', () => {
            const p = () => [core.float(0.1, 29)];
            it('should return an array of Poisson distributed values', () => {
                utils.trials(() => {
                    const poisson = new dist.Poisson(...p());
                    return utils.chi_test(poisson.sample(LAPS), x => poisson.pdf(x), 1);
                });
            });

            it('sum of pmf should give cdf', () => {
                utils.trials(() => {
                    const poisson = new dist.Poisson(...p());
                    return utils.diff_disc(x => poisson.pdf(x), x => poisson.cdf(x), -5, 100) < MAX_AVG_DIFF;
                });
            });
        });

        describe('large lambda', () => {
            const p = () => [core.float(31, 50)];
            it('should return an array of Poisson distributed values', () => {
                utils.trials(() => {
                    const poisson = new dist.Poisson(...p());
                    return utils.chi_test(poisson.sample(LAPS), x => poisson.pdf(x), 1);
                });
            });

            it('sum of pmf should give cdf', () => {
                utils.trials(() => {
                    const poisson = new dist.Poisson(...p());
                    return utils.diff_disc(x => poisson.pdf(x), x => poisson.cdf(x), -5, 100) < MAX_AVG_DIFF;
                });
            });
        });
    });

    describe('Rayleigh', () => {
        const p = () => [core.float(0.1, 5)];
        it('should return an array of Pareto distributed values', () => {
            utils.trials(() => {
                const rayleigh = new dist.Rayleigh(...p());
                return utils.ks_test(rayleigh.sample(LAPS), x => rayleigh.cdf(x));
            });
        });

        it('integral of pdf should give cdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.Rayleigh(...p()),
                    [0.01, 10],
                    LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('UniformContinuous', () => {
        const p = () => {
            const xmin = core.float(10);
            return [xmin, xmin + core.float(0.1, 100)];
        };
        it('should return an array of uniformly distributed values', () => {
            utils.trials(() => {
                const uniform = new dist.UniformContinuous(...p());
                return utils.ks_test(uniform.sample(LAPS), x => uniform.cdf(x));
            });
        });

        it('integral of pdf should give cdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.UniformContinuous(...p()),
                    [-50, 150],
                    LAPS_2
                ) < EPSILON;
            });
        });
    });

    describe('UniformDiscrete', () => {
        const p = () => [core.int(10), core.int(11, 20)];
        it('should return an array of Poisson distributed values', () => {
            utils.trials(() => {
                const uniform = new dist.UniformDiscrete(...p());
                return utils.chi_test(uniform.sample(LAPS), x => uniform.pdf(x), 1);
            });
        });

        it('sum of pmf should give cdf', () => {
            utils.trials(() => {
                const uniform = new dist.UniformDiscrete(...p());
                return utils.diff_disc(x => uniform.pdf(x), x => uniform.cdf(x), 0, 100) < MAX_AVG_DIFF;
            });
        });
    });

    describe('Weibull', () => {
        const p = () => [core.float(0.1, 10), core.float(0.1, 10)];
        it('should return an array of Weibull distributed values', () => {
            utils.trials(() => {
                const weibull = new  dist.Weibull(...p());
                return utils.ks_test(weibull.sample(LAPS), x => weibull.cdf(x));
            });
        });

        it('integral of pdf should give cdf', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.Weibull(...p()),
                    [-5, 10],
                    LAPS_2
                ) < EPSILON;
            });
        });
    });
});
