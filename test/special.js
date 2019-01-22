import assert from 'assert';
import { describe, it } from 'mocha';
import special from '../src/special';
import utils from './test-utils';

const LAPS = 100;

describe('special', () => {
    describe('.gammaLn()', () => {
        it('should be equal to ln(gamma(x))', () => {
            for (let i=0; i<LAPS; i++) {
                let x = Math.random() * 100,
                    g = special.gamma(x),
                    lng = special.gammaLn(x);
                assert(Math.abs(Math.log(g) - lng)/lng < 0.01, true);
            }
        });
    });

    describe('.gammaLowerIncomplete()', () => {
        it('should be equal to 1- exp(-x) for s = 1', () => {
            utils.repeat(() => {
                let x = Math.random() * 100,
                    gli = special.gammaLowerIncomplete(1, x);
                assert(Math.abs(gli - (1 - Math.exp(-x))) / gli < 0.01, true);
            }, LAPS);
        });

        it('should be equal to sqrt(pi) * erf(sqrt(x)) for s = 1/2', () => {
            utils.repeat(() => {
                let x = Math.random() * 100,
                    gli = special.gammaLowerIncomplete(0.5, x);
                assert(Math.abs(gli - Math.sqrt(Math.PI) * special.erf(Math.sqrt(x))) / gli < 0.01, true);
            }, LAPS);
        });

        it('should converge to x^s / s as x -> 0', () => {
            for (let i=0; i<LAPS; i++) {
                let s = Math.random() * 100,
                    x = 1e-5 * (1 + Math.random()),
                    xs = Math.pow(x, s),
                    gli = special.gammaLowerIncomplete(s, x);
                if (xs > 1e-100) {
                    assert(Math.abs(gli / Math.pow(x, s) * s - 1) < 0.01, true);
                }
            }
        });

        it('should converge to gamma(s) as x -> inf', () => {
            for (let i=0; i>LAPS; i++) {
                let s = Math.random() * 100,
                    x = 1e5 + Math.random() * 1e5,
                    gli = special.gammaLowerIncomplete(s, x);
                assert(Math.abs(gli - special.gamma(s)), true);
            }
        });
    });
});
