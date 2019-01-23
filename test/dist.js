import assert from 'assert';
import { describe, it } from 'mocha';
import utils from './test-utils';
import core from '../src/core';
import dist from '../src/dist';

const LAPS = 1000;
const MAX_AVG_DIFF = 1e-3;
const EPSILON = 1e-6;


/**
 * Runs a unit test for the .pdf() method of a generator.
 *
 * @method ut_pdf
 * @param {string} name Name of the generator.
 * @param {Function} params Generator for the parameters array.
 */
function ut_pdf(name, params) {
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
}

/**
 * Runs a unit test for the .sample() method of a generator.
 *
 * @method ut_sample
 * @param {string} name Name of the generator.
 * @param {Function} params Generator for the parameters array.
 */
function ut_sample(name, params) {
    utils.trials(() => {
        const self = new dist[name](...params());
        return self.type() === 'continuous'
            ? utils.ks_test(self.sample(LAPS), x => self.cdf(x))
            : utils.chi_test(self.sample(LAPS), x => self.pdf(x), 1);
    });

    utils.trials(() => {
        const self = new dist[name]();
        return self.type() === 'continuous'
            ? utils.ks_test(self.sample(LAPS), x => self.cdf(x))
            : utils.chi_test(self.sample(LAPS), x => self.pdf(x), 1);
    });
}

/**
 * Runs a unit test for the .test() method of a generator.
 *
 * @method ut_test
 * @param {string} name Name of the generator.
 * @param {Function} params Generator for the parameters array.
 * @param {string} type Type of test (with self or foreign distribution).
 */
function ut_test(name, params, type = 'self') {
    switch (type) {
        case 'self':
            utils.trials(() => {
                const self = new dist[name](...params());
                return self.test(self.sample(LAPS)).passed;
            });
            break;
        case 'foreign':
            utils.trials(() => {
                const self = new dist[name](...params()),
                    sample = self.sample(LAPS),
                    foreign = self.type() === 'continuous'
                        ? new dist.UniformContinuous(Math.min(...sample), Math.max(...sample))
                        : new dist.UniformDiscrete(Math.min(...sample), Math.max(...sample));
                return !foreign.test(sample).passed;
            });
            break;
    }
}


describe('dist', () => {
     // Base class
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

    // Ordinary distributions
    [{
        name: 'Arcsine',
        p: () => [core.float(10), core.float(10.1, 100)]
    }, {
        name: 'Bernoulli',
        p: () => [core.float()]
    }, {
        name: 'Beta',
        p: () => [core.float(0.1, 3), core.float(0.1, 3)]
    }, {
        name: 'BetaPrime',
        p: () => [core.float(0.1, 3), core.float(0.1, 3)]
    }, {
        name: 'Binomial',
        cases: [{
            desc: 'small n',
            p: () => [core.int(10, 20), core.float()]
        }, {
            desc: 'small mean',
            p: () => [core.int(30, 100), core.float() / 105]
        }, {
            desc: 'large n, mean',
            p: () => [core.int(30, 100), core.float()]
        }]
    }, {
        name: 'BoundedPareto',
        p: () => [core.float(0.1, 5), core.float(5.1, 5), core.float(0.1, 3)]
    }, {
        name: 'Cauchy',
        p: () => [core.float(), core.float(0.5, 2)]
    }, {
        name: 'Chi2',
        p: () => [core.int(1, 10)]
    }, {
        name: 'Custom',
        cases: [{
            desc: 'small n',
            p: () => [Array.from({length: core.int(0, 1)}, Math.random)],
            skip: ['test-foreign']
        }, {
            desc: 'moderate n',
            p: () => [Array.from({length: core.int(10, 100)}, Math.random)]
        }, {
            desc: 'large n',
            p: () => [Array.from({length: core.int(101, 120)}, Math.random)],
            skip: ['test-foreign']
        }]
    }, {
        name: 'Erlang',
        p: () => [core.int(1, 10), core.float(0.1, 5)]
    }, {
        name: 'Exponential',
        p: () => [core.float(0.1, 5)]
    }, {
        name: 'F',
        p: () => [core.float(0.1, 5), core.float(0.1, 5)]
    }, {
        name: 'Frechet',
        p: () => [core.float(0.1, 5), core.float(0.1, 5), core.float(-5, 5)]
    }, {
        name: 'Gamma',
        p: () => [core.float(0.1, 10), core.float(0.1, 3)]
    }, {
        name: 'GeneralizedGamma',
        p: () => [core.float(0.1, 10), core.float(0.1, 5), core.float(0.1, 10)]
    }, {
        name: 'Gompertz',
        p: () => [core.float(0.1, 5), core.float(0.1, 5), core.float(-5, 5)]
    }, {
        name: 'Gumbel',
        p: () => [core.float(-3, 3), core.float(0.1, 5)]
    }, {
        name: 'InverseGamma',
        p: () => [core.float(0.1, 5), core.float(0.1, 3)]
    }, {
        name: 'InverseGaussian',
        p: () => [core.float(0.1, 5), core.float(0.1, 5)]
    }, {
        name: 'Laplace',
        p: () => [core.float(-2, 2), core.float(0.1, 5)]
    }, {
        name: 'LogCauchy',
        p: () => [core.float(-5, 5), core.float(0.1, 5)]
    }, {
        name: 'Logistic',
        p: () => [core.float(-5, 5), core.float(0.1, 5)]
    }, {
        // TODO zero shape parameter
        name: 'LogLogistic',
        cases: [{
            desc: 'positive shape parameter',
            p: () => [core.float(-5, 5), core.float(0.1, 5), core.float(0.1, 5)]
        }, {
            desc: 'negative shape parameter',
            p: () => [core.float(-5, 5), core.float(0.1, 5), core.float(-5, -0.1)]
        }, {
            desc: 'zero shape parameter',
            p: () => [core.float(-5, 5), core.float(0.1, 5), 0]
        }]
    }, {
        name: 'Lognormal',
        p: () => [core.float(-2, 2), core.float(0.1, 5)]
    }, {
        name: 'Lomax',
        p: () => [core.float(0.1, 5), core.float(0.1, 5)]
    }, {
        name: 'Kumaraswamy',
        p: () => [core.float(0.1, 5), core.float(0.1, 5)]
    }, {
        name: 'Normal',
        p: () => [core.float(-5, 5), core.float(0.1, 10)]
    }, {
        name: 'Pareto',
        p: () => [core.float(0.1, 5), core.float(0.1, 10)]
    }, {
        name: 'Poisson',
        cases: [{
            desc: 'low mean',
            p: () => [core.float(5, 20)]
        }, {
            desc: 'high mean',
            p: () => [core.float(31, 50)]
        }]
    }, {
        name: 'Rayleigh',
        p: () => [core.float(0.1, 5)]
    }, {
        name: 'UniformContinuous',
        p: () => [core.float(10), core.float(10.1, 100)],
        skip: ['test-foreign']
    }, {
        name: 'UniformDiscrete',
        p: () => [core.int(10), core.int(11, 100)],
        skip: ['test-foreign']
    }, {
        name: 'Weibull',
        p: () => [core.float(0.1, 10), core.float(0.1, 10)]
    }].forEach(d => {
        describe(d.name, () => {
            if (typeof d.cases === 'undefined') {
                describe('.sample()', () => {
                    it(`should generate values with ${d.name} distribution`, () => {
                        ut_sample(d.name, d.p);
                    });
                });
                describe('.pdf()', () => {
                    it('differentiating cdf should give pdf ', () => {
                        ut_pdf(d.name, d.p);
                    });
                });
                describe('.test()', () => {
                    it('should pass for own distribution', () => {
                        ut_test(d.name, d.p, 'self');
                    });
                    if( !d.skip || d.skip.indexOf('test-foreign') === -1) {
                        it('should reject foreign distribution', () => {
                            ut_test(d.name, d.p, 'foreign');
                        });
                    }
                });
            } else {
                describe('.sample()', () => {
                    d.cases.forEach(c => it(`should generate values with ${d.name} distribution [${c.desc}]`, () => {
                        ut_sample(d.name, c.p);
                    }));
                });
                describe('.pdf()', () => {
                    d.cases.forEach(c => it(`differentiating cdf shuld give pdf [${c.desc}]`, () => {
                        ut_pdf(d.name, c.p);
                    }));
                });
                describe('.test()', () => {
                    d.cases.forEach(c => {
                        it(`should pass for own distribution [${c.desc}]`, () => {
                            ut_test(d.name, c.p, 'self');
                        });
                        if( !c.skip || c.skip.indexOf('test-foreign') === -1) {
                            it(`should reject foreign distribution [${c.desc}]`, () => {
                                ut_test(d.name, c.p, 'foreign');
                            });
                        }
                    });
                });
            }
        });
    });

    describe('Degenerate', () => {
        const p = () => [core.float(-10, 10)];
        describe('.sample()', () => {
            it('should generate values with Degenerate distribution', () => {
                utils.trials(() => {
                    const x0 = p();
                    const degenerate = new dist.Degenerate(...x0);
                    const samples = degenerate.sample(LAPS);
                    return samples.reduce((s, d) => s && d === x0[0], true);
                });

                utils.trials(() => {
                    const degenerate = new dist.Degenerate();
                    const samples = degenerate.sample(LAPS);
                    return samples.reduce((s, d) => s && d === 0, true);
                });
            });
        });

        describe('.pdf()', () => {
            it('differentiating cdf should give pdf', () => {
                ut_pdf('Degenerate', p);
            });
        });
    });
});
