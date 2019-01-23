import { assert } from 'chai';
import { describe, it } from 'mocha';
import utils from './test-utils';
import * as la from '../src/la';

const EPSILON = 1e-10;

describe('la', () => {
    describe('Vector', () => {
        describe('new Vector()', () => {
            it('should create a 3-dimensional unit vector', () => {
                assert.deepEqual(new la.Vector(), new la.Vector(3));
            });

            it('should create an n-dimensional unit vector', () => {
                utils.repeat(() => {
                    let n = 1 + Math.floor(Math.random() * 100);
                    assert.deepEqual(
                        new la.Vector(n),
                        new la.Vector(Array.from({length: n - 1}, () => 0).unshift(1))
                    );
                }, 100);
            });

            it('should copy another vector', () => {
                assert.deepEqual(new la.Vector(), new la.Vector(new la.Vector()));
            });
        });

        describe('.v()', () => {
            it('should return vector as array', () => {
                utils.repeat(() => {
                    let n = 1 + Math.floor(Math.random() * 100);
                    let arr = Array.from({length: n}, () => Math.random());
                    assert.deepEqual(
                        new la.Vector(arr).v(),
                        arr
                    );
                }, 100);
            });
        });

        describe('.i()', () => {
            it('should return the i-th element', () => {
                let n = 2 + Math.floor(Math.random() * 100);
                let arr = Array.from({length: n}, () => Math.random());
                let v = new la.Vector(arr);
                utils.repeat(() => {
                    let i = Math.floor(Math.random() * n);
                    assert.deepEqual(v.i(i), arr[i]);
                }, 100);
            });

            it('should set the i-th element', () => {
                let n = 2 + Math.floor(Math.random() * 10);
                let arr = Array.from({length: n}, () => Math.random());
                let v = new la.Vector(arr);
                utils.repeat(() => {
                    let i = Math.floor(Math.random() * n);
                    let s = Math.random();
                    v.i(i, s);
                    arr[i] = s;
                    assert.deepEqual(v, new la.Vector(arr));
                }, 100);
            });
        });


        describe('.f()', () => {
            it('should apply a function element-wise', () => {
                let funcs = [Math.sqrt, Math.cos, Math.sin, Math.exp, Math.log];
                utils.repeat(() => {
                    let n = 2 + Math.floor(Math.random() * 10);
                    let arr = Array.from({length: n}, () => Math.random());
                    let func = funcs[Math.floor(Math.random() * funcs.length)];
                    assert.deepEqual(
                        new la.Vector(arr).f(func),
                        new la.Vector(arr.map(d => func(d)))
                    );
                }, 100);
            });
        });

        describe('.scale()', () => {
            it('should scale the vector element-wise', () => {
                utils.repeat(() => {
                    let s = Math.random();
                    let n = 1 + Math.floor(Math.random() * 100);
                    let arr = Array.from({length: n}, () => Math.random());
                    assert.deepEqual(
                        new la.Vector(arr).scale(s),
                        new la.Vector(arr.map(d => d * s))
                    );
                }, 100);
            });
        });

        describe('.add()', () => {
            it('should add two vectors', () => {
                utils.repeat(() => {
                    let n = 1 + Math.floor(Math.random() * 100);
                    let arr1 = Array.from({length: n}, () => Math.random());
                    let arr2 = Array.from({length: n}, () => Math.random());
                    assert.deepEqual(
                        new la.Vector(arr1).add(new la.Vector(arr2)),
                        new la.Vector(arr1.map((d, i) => d + arr2[i]))
                    );
                }, 100);
            });
        });

        describe('.dot()', () => {
            it('should compute the dot product of two vectors', () => {
                utils.repeat(() => {
                    let n = 1 + Math.floor(Math.random() * 100);
                    let arr1 = Array.from({length: n}, () => Math.random());
                    let arr2 = Array.from({length: n}, () => Math.random());
                    assert.deepEqual(
                        new la.Vector(arr1).dot(new la.Vector(arr2)),
                        arr1.reduce((p, d, i) => p + d * arr2[i], 0)
                    );
                }, 100);
            });
        });
    });

    describe('Matrix', () => {
        describe('new Matrix()', () => {
            it('should create a 3x3 identity matrix', () => {
                assert.deepEqual(new la.Matrix(), new la.Matrix(3));
            });

            it('should create an nxn identity matrix', () => {
                utils.repeat(() => {
                    let n = 1 + Math.floor(Math.random() * 10);
                    assert.deepEqual(
                        new la.Matrix(n),
                        new la.Matrix(
                            Array.from({length: n}, (d, i) => Array.from({length: n}, (dd, j) => i === j ? 1 : 0))
                        )
                    );
                }, 100);
            });

            it('should copy another matrix', () => {
                assert.deepEqual(new la.Matrix(), new la.Matrix(new la.Matrix()))
            });
        });

        describe('.m()', () => {
            it('should return matrix as an array of arrays', () => {
                utils.repeat(() => {
                    let n = 1 + Math.floor(Math.random() * 10);
                    let arr = Array.from({length: n}, () => Array.from({length: n}, () => Math.random()));
                    assert.deepEqual(
                        new la.Matrix(arr).m(),
                        arr
                    );
                }, 100);
            });
        });

        describe('.ij()', () => {
            it('should return the (i, j)-th element', () => {
                let n = 2 + Math.floor(Math.random() * 10);
                let arr = Array.from({length: n}, () => Array.from({length: n}, () => Math.random()));
                let M = new la.Matrix(arr);
                utils.repeat(() => {
                    let i = Math.floor(Math.random() * n);
                    let j = Math.floor(Math.random() * n);
                    assert.deepEqual(M.ij(i, j), arr[i][j]);
                }, 100);
            });

            it('should set the (i, j)-th element', () => {
                let n = 2 + Math.floor(Math.random() * 10);
                let arr = Array.from({length: n}, () => Array.from({length: n}, () => Math.random()));
                let M = new la.Matrix(arr);
                utils.repeat(() => {
                    let i = Math.floor(Math.random() * n);
                    let j = Math.floor(Math.random() * n);
                    let s = Math.random();
                    M.ij(i, j, s);
                    arr[i][j] = s;
                    assert.deepEqual(M, new la.Matrix(arr));
                }, 100);
            });
        });

        describe('.t()', () => {
            it('should transpose the matrix', () => {
                utils.repeat(() => {
                    let n = 1 + Math.floor(Math.random() * 10);
                    let arr = Array.from({length: n}, () => Array.from({length: n}, () => Math.random()));
                    assert.deepEqual(
                        new la.Matrix(arr).t(),
                        new la.Matrix(arr.map((col, i) => arr.map(row => row[i])))
                    );
                }, 100);
            });

            it('should return original matrix after two transposition', () => {
                utils.repeat(() => {
                    let n = 1 + Math.floor(Math.random() * 10);
                    let arr = Array.from({length: n}, () => Array.from({length: n}, () => Math.random()));
                    let M = new la.Matrix(arr);
                    assert.deepEqual(M.t().t(), M);
                }, 100);
            });
        });

        describe('.f()', () => {
            it('should apply a function element-wise', () => {
                let funcs = [Math.sqrt, Math.cos, Math.sin, Math.exp, Math.log];
                utils.repeat(() => {
                    let n = 1 + Math.floor(Math.random() * 10);
                    let arr = Array.from({length: n}, () => Array.from({length: n}, () => Math.random()));
                    let func = funcs[Math.floor(Math.random() * funcs.length)];
                    assert.deepEqual(
                        new la.Matrix(arr).f(func),
                        new la.Matrix(arr.map(d => d.map(dd => func(dd))))
                    );
                }, 100);
            });
        });

        describe('.scale()', () => {
            it('should scale a matrix element-wise', () => {
                utils.repeat(() => {
                    let s = Math.random();
                    let n = 1 + Math.floor(Math.random() * 10);
                    let arr = Array.from({length: n}, () => Array.from({length: n}, () => Math.random()));
                    assert.deepEqual(
                        new la.Matrix(arr).scale(s),
                        new la.Matrix(arr.map(d => d.map(dd => s * dd)))
                    );
                }, 100);
            });
        });

        describe('.add()', () => {
            it('should add two matrices', () => {
                utils.repeat(() => {
                    let n = 1 + Math.floor(Math.random() * 10);
                    let arr1 = Array.from({length: n}, () => Array.from({length: n}, () => Math.random()));
                    let arr2 = Array.from({length: n}, () => Array.from({length: n}, () => Math.random()));
                    assert.deepEqual(
                        new la.Matrix(arr1).add(new la.Matrix(arr2)),
                        new la.Matrix(arr1.map((d, i) => d.map((dd, j) => dd + arr2[i][j])))
                    );
                }, 100);
            });
        });

        describe('.act()', () => {
            it('should act a matrix on a vector', () => {
                utils.repeat(() => {
                    let n = 1 + Math.floor(Math.random() * 10);
                    let arr1 = Array.from({length: n}, () => Array.from({length: n}, () => Math.random()));
                    let arr2 = Array.from({length: n}, () => Math.random());
                    assert.deepEqual(
                        new la.Matrix(arr1).act(new la.Vector(arr2)),
                        new la.Vector(arr1.map(d => arr2.reduce((p, dd, i) => p + dd * d[i], 0)))
                    );
                }, 100);
            });
        });

        describe('.mult()', () => {
            it('should multiply two matrices', () => {
                // Test uses the Freivalds algorithm
                let n = 10;
                let M = new la.Matrix(Array.from({length: n}, () => Array.from({length: n}, () => Math.random())));
                let N = new la.Matrix(Array.from({length: n}, () => Array.from({length: n}, () => Math.random())));
                let C = M.mult(N);
                utils.repeat(() => {
                    let r = new la.Vector(Array.from({length: n}, () => Math.random() > 0.5 ? 1 : 0));
                    let P = M.act(N.act(r)).add(C.act(r).scale(-1));
                    assert.deepEqual(P.v().reduce((s, d) => s && Math.abs(d) < EPSILON, true), true);
                }, 100);
            });
        });

        describe('.ldl()', () => {
            function perform(test) {
                utils.repeat(() => {
                    let n = 1 + Math.floor(Math.random() * 10);
                    let arr = Array.from({length: n}, () => Array.from({length: n}, () => 0));
                    for (let i = 0; i < n; i++) {
                        arr[i][i] = Math.random();
                        for (let j = 0; j < i; j++) {
                            arr[i][j] = arr[j][i] = Math.random();
                        }
                    }
                    let M = new la.Matrix(arr);
                    let {D, L} = M.ldl();
                    test(D, L, M);
                }, 100);
            }

            it('D should be a diagonal matrix', () => {
                perform((D, L, M) => {
                    let md = D.m(),
                        s = 0;
                    for (let i = 0; i < M.m().length; i++) {
                        for (let j = 0; j < i; j++) {
                            if (i !== j) {
                                s += Math.abs(md[i][j]) + Math.abs(md[j][i]);
                            }
                        }
                    }
                    assert.equal(s, 0);
                });
            });

            it('L should be a lower triangular matrix', () => {
                perform((D, L, M) => {
                    let ld = L.m(),
                        slo = 0,
                        shi = 0;
                    for (let i = 0; i < M.m().length; i++) {
                        for (let j = 0; j < i; j++) {
                            slo += Math.abs(ld[i][j]);
                            shi += Math.abs(ld[j][i]);
                        }
                    }
                    assert.equal(shi, 0);
                    assert.equal(slo >= 0, true);
                });
            });

            it('LDL should be equal to M', () => {
                perform((D, L, M) => {
                    let m = L.mult(D.mult(L.t())).add(M.scale(-1)).m(),
                        sm = 0;
                    for (let i = 0; i < M.m().length; i++) {
                        sm += m[i][i];
                        for (let j = 0; j < i; j++) {
                            sm += Math.abs(m[i][j]) + Math.abs(m[j][i]);
                        }
                    }
                    assert.equal(sm < EPSILON, true);
                });
            });
        });
    });
});
