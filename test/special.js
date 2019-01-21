import assert from 'assert';
import { describe, it } from 'mocha';
import special from '../src/special';
import utils from './test-utils';

const LAPS = 100;

describe('special', () => {
    it('ln(gamma(x)) should be equal to gammaLn(x)', () => {
        for (let i=0; i<LAPS; i++) {
            let x = Math.random() * 100,
                g = special.gamma(x),
                lng = special.gammaLn(x);
            assert(Math.abs(Math.log(g) - lng)/lng < 0.01, true);
        }
    });

    it('gammaLowerIncomplete(1, x) = 1 - exp(-x)', () => {
        utils.repeat(() => {
            let x = Math.random() * 100,
                gli = special.gammaLowerIncomplete(1, x);
            assert(Math.abs(gli - (1 - Math.exp(-x))) / gli < 0.01, true);
        }, LAPS);
    });

    it('gammaLowerIncomplete(1/2, x) = sqrt(pi) * erf(sqrt(x))', () => {
        utils.repeat(() => {
            let x = Math.random() * 100,
                gli = special.gammaLowerIncomplete(0.5, x);
            assert(Math.abs(gli - Math.sqrt(Math.PI) * special.erf(Math.sqrt(x))) / gli < 0.01, true);
        }, LAPS);
    });

    it('gammaLowerIncomplete(s, x) / x^s -> 1/s as x -> inf', () => {
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
});
