import assert from 'assert';
import { describe, it } from 'mocha';
import utils from './test-utils';
import core from '../src/core';
import dist from '../src/dist';

const LAPS = 100;
const MAX_AVG_DIFF = 1e-3;
const EPSILON = 1e-6;


/**
 * Runs a unit test for the .test() method of a generator.
 *
 * @method ut_test
 * @param {string} name Name of the generator.
 * @param {Function} params Generator for the parameters array.
 */
function ut_test(name, params) {
    describe('.test()', () => {
        it('should pass for own distribution', () => {
            utils.trials(() => {
                const self = new dist[name](...params());
                return self.test(self.sample(10 * LAPS)).passed;
            });
        });

        it('should reject foreign distribution', () => {
            utils.trials(() => {
                const self = new dist[name](...params()),
                    sample = self.sample(10 * LAPS),
                    foreign = self.type() === 'continuous'
                        ? new dist.UniformContinuous(Math.min(...sample), Math.max(...sample))
                        : new dist.UniformDiscrete(Math.min(...sample), Math.max(...sample));
                return !foreign.test(sample).passed;
            });
        });
    });
}

/**
 * Runs a unit test for the .pdf() method of a generator.
 *
 * @method ut_pdf
 * @param {string} name Name of the generator.
 * @param {Function} params Generator for the parameters array.
 */
function ut_pdf(name, params) {
    it('.pdf()', () => {
        utils.trials(() => {
            const self = new dist[name](...params()),
                supp = self.support();
            if (self.type() === 'continuous') {
                return utils.cdf2pdf(
                    self, [
                        (supp[0].value !== null ? supp[0].value : -100) - 10,
                        (supp[1].value !== null ? supp[1].value : 100) + 10
                    ], LAPS
                ) < EPSILON;
            } else {
                return utils.diff_disc(
                    x => self.pdf(x),
                    x => self.cdf(x),
                    (supp[0].value !== null ? supp[0].value : -100) - 10,
                    (supp[1].value !== null ? supp[1].value : 100) + 10
                ) < MAX_AVG_DIFF;
            }
        });
    });
}

/**
 * Runs a unit test for the .sample() method of a generator.
 *
 * @method ut_sample
 * @param {string} name Name of the generator.
 * @param {Function} params Generator for the parameters array.
 */
function ut_sample(name, params) {
    it('.sample()', () => {
        utils.trials(() => {
            const self = new dist[name](...params());
            return self.type() === 'continuous'
                ? utils.ks_test(self.sample(LAPS), x => self.cdf(x))
                : utils.chi_test(self.sample(LAPS), x => self.pdf(x), 1);
        });
    });
}


describe('dist', () => {
    describe('Distribution', () => {
        describe('.support()', () => {
            it('should throw not implemented error', () => {
                const invalid = new dist._InvalidDistribution();
                assert.throws(() => {
                    invalid.support();
                }, {
                    message: 'Distribution.support() is not implemented'
                });
            });
        });

        describe('.sample()', () => {
            it('should throw not implemented error', () => {
                const invalid = new dist._InvalidDistribution();
                assert.throws(() => {
                    invalid.sample();
                }, {
                    message: 'Distribution._generator() is not implemented'
                });
            });
        });

        describe('.pdf()', () => {
            it('should throw not implenented error', () => {
                const invalid = new dist._InvalidDistribution();
                assert.throws(() => {
                    invalid.pdf(0);
                }, {
                    message: 'Distribution._pdf() is not implemented'
                });
            });
        });

        describe('.cdf()', () => {
            it('should throw not implenented error', () => {
                const invalid = new dist._InvalidDistribution();
                assert.throws(() => {
                    invalid.cdf(0);
                }, {
                    message: 'Distribution._cdf() is not implemented'
                });
            });
        });

        describe('.survive()', () => {
            it('should throw not implemented error', () => {
                const invalid = new dist._InvalidDistribution();
                assert.throws(() => {
                    invalid.survival(0);
                }, {
                    message: 'Distribution._cdf() is not implemented'
                });
            });
        });

        describe('.hazard()', () => {
            it('should throw not implenented error', () => {
                const invalid = new dist._InvalidDistribution();
                assert.throws(() => {
                    invalid.hazard(0);
                }, {
                    message: 'Distribution._pdf() is not implemented'
                });
            });
        });

        describe('.cHazard()', () => {
            it('should throw not implenented error', () => {
                const invalid = new dist._InvalidDistribution();
                assert.throws(() => {
                    invalid.cHazard(0);
                }, {
                    message: 'Distribution._cdf() is not implemented'
                });
            });
        });

        describe('.lnPdf()', () => {
            it('should throw not implenented error', () => {
                const invalid = new dist._InvalidDistribution();
                assert.throws(() => {
                    invalid.lnPdf(0);
                }, {
                    message: 'Distribution._pdf() is not implemented'
                });
            });
        });

        describe('.L()', () => {
            it('should throw not implenented error', () => {
                const invalid = new dist._InvalidDistribution();
                assert.throws(() => {
                    invalid.L([0]);
                }, {
                    message: 'Distribution._pdf() is not implemented'
                });
            });
        });

        describe('.test()', () => {
            it('should throw not implenented error', () => {
                const invalid = new dist._InvalidDistribution();
                assert.throws(() => {
                    invalid.test([0]);
                }, {
                    message: 'Distribution._pdf() is not implemented'
                });
            });
        });
    });

    describe('Arcsine', () => {
        const p = () => {
            const xmin = core.float(10);
            return [xmin, xmin + core.float(0.1, 100)];
        };
        ut_sample('Arcsine', p);
        ut_pdf('Arcsine', p);
        ut_test('Arcsine', p);
    });

    describe('Bernoulli', () => {
        const p = () => [core.float()];
        ut_sample('Bernoulli', p);
        ut_pdf('Bernoulli', p);
        ut_test('Bernoulli', p);
    });

    describe('Beta', () => {
        const p = () => [core.float(0.1, 3), core.float(0.1, 3)];
        ut_sample('Beta', p);
        ut_pdf('Beta', p);
        ut_test('Beta', p);
    });

    describe('BetaPrime', () => {
        const p = () => [core.float(0.1, 3), core.float(0.1, 3)];
        ut_sample('BetaPrime', p);
        ut_pdf('BetaPrime', p);
        ut_test('BetaPrime', p);
    });

    describe('Binomial', () => {
        describe('.sample()', () => {
            let p = () => [core.int(2, 24), core.float()];
            it('low n', () => {
                utils.trials(() => {
                    const binomial = new dist.Binomial(...p());
                    return utils.chi_test(binomial.sample(LAPS), x => binomial.pdf(x), 2);
                });
            });

            p = () => [core.int(30, 100), core.float() / 105];
            it('low mean', () => {
                utils.trials(() => {
                    const binomial = new dist.Binomial(...p());
                    return utils.chi_test(binomial.sample(LAPS), x => binomial.pdf(x), 2);
                });
            });

            p = () => [core.int(100, 120), core.float()];
            it('high n', () => {
                utils.trials(() => {
                    const binomial = new dist.Binomial(...p());
                    return utils.chi_test(binomial.sample(LAPS), x => binomial.pdf(x), 2);
                });
            });
        });

        describe('.pdf()', () => {
            let p = () => [core.int(2, 24), core.float()];
            it('low n', () => {
                utils.trials(() => {
                    const binomial = new dist.Binomial(...p());
                    return utils.diff_disc(x => binomial.pdf(x), x => binomial.cdf(x), -10, 25) < MAX_AVG_DIFF;
                });
            });

            p = () => [core.int(30, 100), core.float() / 105];
            it('low mean', () => {
                utils.trials(() => {
                    const binomial = new dist.Binomial(...p());
                    return utils.diff_disc(x => binomial.pdf(x), x => binomial.cdf(x), -10, 25) < MAX_AVG_DIFF;
                });
            });

            p = () => [core.int(100, 120), core.float()];
            it('high n', () => {
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
        ut_sample('BoundedPareto', p);
        ut_pdf('BoundedPareto', p);
        ut_test('BoundedPareto', p);
    });

    describe('Cauchy', () => {
        const p = () => [core.float(), core.float(0.5, 2)];
        ut_sample('Cauchy', p);
        ut_pdf('Cauchy', p);
        ut_test('Cauchy', p);
    });

    describe('Chi2', () => {
        const p = () => [core.int(1, 10)];
        ut_sample('Chi2', p);
        ut_pdf('Chi2', p);
        ut_test('Chi2', p);
    });

    describe('Custom', () => {
        describe('.sample()', () => {
            let p = () => [Array.from({length: core.int(0, 1)}, Math.random)];
            it('small n', () => {
                utils.trials(() => {
                    const custom = new dist.Custom(...p());
                    return utils.chi_test(custom.sample(10 * LAPS), x => custom.pdf(x), 0);
                });
            });

            p = () => [Array.from({length: core.int(10, 100)}, Math.random)];
            it('moderate n', () => {
                utils.trials(() => {
                    const w = p();
                    const custom = new dist.Custom(...w);
                    return utils.chi_test(custom.sample(10 * LAPS), x => custom.pdf(x), w.length-1);
                });
            });

            p = () => [Array.from({length: core.int(251, 500)}, Math.random)];
            it('large n', () => {
                utils.trials(() => {
                    const w = p();
                    const custom = new dist.Custom(...w);
                    return utils.chi_test(custom.sample(10 * LAPS), x => custom.pdf(x), w.length-1);
                });
            });
        });

        describe('.pdf()', () => {
            let p = () => [Array.from({length: core.int(0, 1)}, Math.random)];
            it('small n', () => {
                utils.trials(() => {
                    const w = p();
                    const custom = new dist.Custom(...w);
                    return utils.diff_disc(x => custom.pdf(x), x => custom.cdf(x), 0, w.length) < MAX_AVG_DIFF;
                });
            });

            p = () => [Array.from({length: core.int(10, 100)}, Math.random)];
            it('moderate n', () => {
                utils.trials(() => {
                    const w = p();
                    const custom = new dist.Custom(...w);
                    return utils.diff_disc(x => custom.pdf(x), x => custom.cdf(x), 0, w.length) < MAX_AVG_DIFF;
                });
            });

            p = () => [Array.from({length: core.int(251, 500)}, Math.random)];
            it('.pdf()', () => {
                utils.trials(() => {
                    const w = p();
                    const custom = new dist.Custom(...w);
                    return utils.diff_disc(x => custom.pdf(x), x => custom.cdf(x), 0, w.length) < MAX_AVG_DIFF;
                });
            });
        });

        describe('.test()', () => {
            let p = () => [Array.from({length: core.int(0, 1)}, Math.random)];
            it('small n', () => {
                utils.trials(() => {
                    const w = p();
                    const custom = new dist.Custom(...w);
                    return custom.test(custom.sample(10 * LAPS)).passed;
                });
            });

            p = () => [Array.from({length: core.int(10, 100)}, Math.random)];
            it('moderate n', () => {
                utils.trials(() => {
                    const w = p();
                    const custom = new dist.Custom(...w);
                    return custom.test(custom.sample(10 * LAPS)).passed;
                });
            });

            p = () => [Array.from({length: core.int(251, 500)}, Math.random)];
            it('large n', () => {
                utils.trials(() => {
                    const w = p();
                    const custom = new dist.Custom(...w);
                    return custom.test(custom.sample(10 * LAPS)).passed;
                });
            });
        });
    });

    describe('Degenerate', () => {
        const p = () => [core.float(-10, 10)];
        it('.sample()', () => {
            utils.trials(() => {
                const x0 = p();
                const degenerate = new dist.Degenerate(...x0);
                const samples = degenerate.sample(LAPS);
                return samples.reduce((s, d) => s && d === x0[0], true);
            });
        });

        it('.pdf()', () => {
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
        ut_sample('Erlang', p);
        ut_pdf('Erlang', p);
        ut_test('Erlang', p);
    });

    describe('Exponential', () => {
        const p = () => [core.float(0.1, 5)];
        ut_sample('Exponential', p);
        ut_pdf('Exponential', p);
        ut_test('Exponential', p);
    });

    describe('F', () => {
        const p = () => [core.float(0.1, 5), core.float(0.1, 5)];
        ut_sample('F', p);
        ut_pdf('F', p);
        ut_test('F', p);
    });

    describe('Frechet', () => {
        const p = () => [core.float(0.1, 5), core.float(0.1, 5), core.float(-5, 5)];
        ut_sample('Frechet', p);
        ut_pdf('Frechet', p);
        ut_test('Frechet', p);
    });

    describe('Gamma', () => {
        const p = () => [core.float(0.1, 10), core.float(0.1, 3)];
        ut_sample('Gamma', p);
        ut_pdf('Gamma', p);
        ut_test('Gamma', p);
    });

    describe('GeneralizedGamma', () =>{
        const p = () => [core.float(0.1, 10), core.float(0.1, 5), core.float(0.1, 10)];
        ut_sample('GeneralizedGamma', p);
        ut_pdf('GeneralizedGamma', p);
        ut_test('GeneralizedGamma', p);
    });

    describe('Gompertz', () => {
        const p = () => [core.float(0.1, 5), core.float(0.1, 5), core.float(-5, 5)];
        ut_sample('Gompertz', p);
        ut_pdf('Gompertz', p);
        ut_test('Gompertz', p);
    });

    describe('Gumbel', () => {
        const p = () => [core.float(-3, 3), core.float(0.1, 5)];
        ut_sample('Gumbel', p);
        ut_pdf('Gumbel', p);
        ut_test('Gumbel', p);
    });

    describe('InverseGamma', () => {
        const p = () => [core.float(0.1, 5), core.float(0.1, 3)];
        ut_sample('InverseGamma', p);
        ut_pdf('InverseGamma', p);
        ut_test('InverseGamma', p);
    });

    describe('InverseGaussian', () => {
        const p = () => [core.float(0.1, 5), core.float(0.1, 5)];
        ut_sample('InverseGaussian', p);
        ut_pdf('InverseGaussian', p);
        ut_test('InverseGaussian', p);
    });

    describe('Laplace', () => {
        const p = () => [core.float(-2, 2), core.float(0.1, 5)];
        ut_sample('Laplace', p);
        ut_pdf('Laplace', p);
        ut_test('Laplace', p);
    });

    describe('LogCauchy', () => {
        const p = () => [core.float(-5, 5), core.float(0.1, 5)];
        ut_sample('LogCauchy', p);
        ut_pdf('LogCauchy', p);
        ut_test('LogCauchy', p);
    });

    describe('Logistic', () => {
        const p = () => [core.float(-5, 5), core.float(0.1, 5)];
        ut_sample('Logistic', p);
        ut_pdf('Logistic', p);
        ut_test('Logistic', p);
    });

    describe('LogLogistic', () => {
        describe('positive shape parameter', () => {
            const p = () => [core.float(-5, 5), core.float(0.1, 5), core.float(0.1, 5)];
            ut_sample('LogLogistic', p);
            ut_pdf('LogLogistic', p);
            ut_test('LogLogistic', p);
        });

        describe('negative shape parameter', () => {
            const p = () => [core.float(-5, 5), core.float(0.1, 5), core.float(-5, -0.1)];
            ut_sample('LogLogistic', p);
            ut_pdf('LogLogistic', p);
            ut_test('LogLogistic', p);
        });
    });

    describe('Lognormal', () => {
        const p = () => [core.float(-2, 2), core.float(0.1, 5)];
        it('.sample()', () => {
            utils.trials(() => {
                const lognormal = new dist.Lognormal(...p());
                return utils.ks_test(lognormal.sample(LAPS), x => lognormal.cdf(x));
            });
        });
        ut_pdf('Lognormal', p);
        ut_test('Lognormal', p);
    });

    describe('Lomax', () => {
        const p = () => [core.float(0.1, 5), core.float(0.1, 5)];
        ut_sample('Lomax', p);
        ut_pdf('Lomax', p);
        ut_test('Lomax', p);
    });

    describe('Minimax', () => {
        const p = () => [core.float(0.1, 5), core.float(0.1, 5)];
        ut_sample('Minimax', p);

        it('.pdf()', () => {
            utils.trials(() => {
                return utils.cdf2pdf(
                    new dist.Minimax(...p()),
                    [-1, 2], LAPS
                ) < EPSILON;
            });
        });

        ut_test('Minimax', p);
    });

    describe('Normal', () => {
        const p = () => [core.float(-5, 5), core.float(0.1, 10)];
        ut_sample('Normal', p);
        ut_pdf('Minimax', p);
        ut_test('Normal', p);
    });

    describe('Pareto', () => {
        const p = () => [core.float(0.1, 5), core.float(0.1, 10)];
        ut_sample('Pareto', p);
        ut_pdf('Pareto', p);
        ut_test('Pareto', p);
    });

    describe('Poisson', () => {
        describe('small lambda', () => {
            const p = () => [core.float(0.1, 20)];
            ut_sample('Poisson', p);

            it('.pdf()', () => {
                utils.trials(() => {
                    const poisson = new dist.Poisson(...p());
                    return utils.diff_disc(x => poisson.pdf(x), x => poisson.cdf(x), -5, 100) < MAX_AVG_DIFF;
                });
            });

            ut_test('Poisson', p);
        });

        describe('large lambda', () => {
            const p = () => [core.float(51, 100)];
            ut_sample('Poisson', p);

            it('.pdf()', () => {
                utils.trials(() => {
                    const poisson = new dist.Poisson(...p());
                    return utils.diff_disc(x => poisson.pdf(x), x => poisson.cdf(x), -5, 100) < MAX_AVG_DIFF;
                });
            });

            ut_test('Poisson', p);
        });
    });

    describe('Rayleigh', () => {
        const p = () => [core.float(0.1, 5)];
        ut_sample('Rayleigh', p);
        ut_pdf('Rayleigh', p);
        ut_test('Rayleigh', p);
    });

    describe('UniformContinuous', () => {
        const p = () => {
            const xmin = core.float(10);
            return [xmin, xmin + core.float(0.1, 100)];
        };
        ut_sample('UniformContinuous', p);
        ut_pdf('UniformContinuous', p);

        describe('.test()', () => {
            it('should pass for own distribution', () => {
                utils.trials(() => {
                    const self = new dist.UniformContinuous(...p());
                    return self.test(self.sample(10 * LAPS)).passed;
                });
            });

            it('should reject foreign distribution', () => {
                utils.trials(() => {
                    const sample = new dist.UniformContinuous(...p()).sample(10 * LAPS),
                        foreign = new dist.Arcsine(Math.min(...sample), Math.max(...sample));
                    return !foreign.test(sample).passed;
                });
            });
        });
    });

    describe('UniformDiscrete', () => {
        const p = () => [core.int(10), core.int(11, 20)];
        ut_sample('UniformDiscrete', p);
        ut_pdf('UniformDiscrete', p);

        describe('.test()', () => {
            it('should pass for own distribution', () => {
                utils.trials(() => {
                    const self = new dist.UniformDiscrete(...p());
                    return self.test(self.sample(10 * LAPS)).passed;
                });
            });

            it('should reject foreign distribution', () => {
                utils.trials(() => {
                    const sample = new dist.UniformDiscrete(...p()).sample(10 * LAPS),
                        foreign = new dist.Poisson(sample.reduce((acc, d) => d + acc, 0) / sample.length);
                    return !foreign.test(sample).passed;
                });
            });
        });
    });

    describe('Weibull', () => {
        const p = () => [core.float(0.1, 10), core.float(0.1, 10)];
        ut_sample('Weibull', p);
        ut_pdf('Weibull', p);
        ut_test('Weibull', p);
    });
});
