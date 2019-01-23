import assert from 'assert';
import { describe, it } from 'mocha';
import utils from './test-utils';
import { _sum } from '../src/utils';

const LAPS = 100;

describe('utils', () => {
    describe('._sum()', () => {
        it('should sum integers', () => {
            utils.repeat(() => {
                const n = Math.floor(2 + Math.random() * 100);
                assert(
                    _sum(Array.from({length: n}, (d, i) => i)),
                    n * (n + 1) / 2
                );
            }, LAPS);
        });

        it('should sum cubes', () => {
            utils.repeat(() => {
                const n = Math.floor(2 + Math.random() * 100),
                    a = n * (n + 1) / 2;
                assert(
                    _sum(Array.from({length: n}, (d, i) => i), 3),
                    a * a
                );
            }, LAPS);
        });
    });
});