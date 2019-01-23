import assert from 'assert';
import { describe, it } from 'mocha';
import ts from '../src/ts';


describe('ts', () => {
    describe('Cov', () => {
        describe('.compute()', () => {
            it('should compute covariance', () => {
                const cov = new ts.Cov();
                for (let i=0; i<10000; i++) {
                    cov.update([-Math.log(Math.random()) / 0.5]);
                }
                assert.equal(Math.abs(cov.compute().m()[0][0] - 4) / 4 < 0.05, true);
            });
        });
        describe('.reset()', () => {
            it('should clear history', () => {
                const cov = new ts.Cov(2);
                for (let i = 0; i < 10; i++) {
                    let r = Math.random();
                    cov.update([r, 2 * r + 0.1 * Math.random() - 0.05]);
                }
                cov.reset();
                assert.deepEqual(cov.compute().m(), [[0, 0], [0, 0]]);
            });
        });
    });

    describe('AC', () => {
        describe('.compute()', () => {
            it('should compute the auto-correlation', () => {
                const ac = new ts.AC();
                for (let i=1; i<10010; i++) {
                    ac.update([i % 2 === 0 ? 1 : -1]);
                }
                let res = ac.compute()[0];
                assert.equal(res.filter((d, i) => i % 2 === 0).reduce((acc, d) => acc + d, 0) > 0.9*50, true);
                assert.equal(res.filter((d, i) => i % 2 === 1).reduce((acc, d) => acc + d, 0) < 0.9*50, true);
            });
        });
        describe('.reset()', () => {
            it('should clear history', () => {
                const ac = new ts.AC(2, 3);
                for (let i=0; i<10; i++) {
                    ac.update([i + Math.random(), i + 1 / Math.random()]);
                }
                ac.reset();
                assert.deepEqual(ac.compute(), [[undefined, undefined, undefined], [undefined, undefined, undefined]]);
            });
        });
    });
});
