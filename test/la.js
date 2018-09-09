const assert = require('assert');
const utils = require('../test/test-utils').test_utils;
const la = require('../src/ran').la;

const EPSILON = 1e-10;

describe('la', () => {
    describe('Vector', () => {
        it('should create a 3 dimensional vector', () => {
            let v1 = new la.Vector();
            assert.deepEqual(v1, new la.Vector(3));
            assert.deepEqual(v1, new la.Vector([1, 0, 0]));
            assert.deepEqual(v1, new la.Vector(v1));
        });

        it('should create an N dimensional vector', () => {
            utils.repeat(() => {
                let n = 1 + Math.floor(Math.random() * 100);
                assert.deepEqual(
                    new la.Vector(n),
                    new la.Vector(Array.from({length: n - 1}, () => 0).unshift(1))
                );
            }, 100);
        });

        it('should return the vector as an array', () => {
            utils.repeat(() => {
                let n = 1 + Math.floor(Math.random() * 100);
                let arr = Array.from({length: n}, () => Math.random());
                assert.deepEqual(
                    new la.Vector(arr).v(),
                    arr
                );
            }, 100);
        });

        it('should return the i-th element of a vector', () => {
            let n = 2 + Math.floor(Math.random() * 100);
            let arr = Array.from({length: n}, () => Math.random());
            let v = new la.Vector(arr);
            utils.repeat(() => {
                let i = Math.floor(Math.random() * n);
                assert.deepEqual(v.i(i), arr[i]);
            }, 100);
        });

        it('should set the i-th element of a vector', () => {
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

        it('should apply a function element-wise on a vector', () => {
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

        it('should scale a vector with a scalar', () => {
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

        it('should calculate the dot product of two vectors', () => {
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

    describe('Matrix', () => {
        it('should create a 3x3 matrix', () => {
            let M1 = new la.Matrix();
            assert.deepEqual(M1, new la.Matrix(3));
            assert.deepEqual(M1, new la.Matrix([[1, 0, 0], [0, 1, 0], [0, 0, 1]]));
            assert.deepEqual(M1, new la.Matrix(M1));
        });

        it('should create an NxN matrix', () => {
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

        it('should return the matrix as an array of arrays', () => {
            utils.repeat(() => {
                let n = 1 + Math.floor(Math.random() * 10);
                let arr = Array.from({length: n}, () => Array.from({length: n}, () => Math.random()));
                assert.deepEqual(
                    new la.Matrix(arr).m(),
                    arr
                );
            }, 100);
        });

        it('should return the (i, j)-th element of a matrix', () => {
            let n = 2 + Math.floor(Math.random() * 10);
            let arr = Array.from({length: n}, () => Array.from({length: n}, () => Math.random()));
            let M = new la.Matrix(arr);
            utils.repeat(() => {
                let i = Math.floor(Math.random() * n);
                let j = Math.floor(Math.random() * n);
                assert.deepEqual(M.ij(i, j), arr[i][j]);
            }, 100);
        });

        it('should set the (i, j)-th element of a matrix', () => {
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

        it('should transpose a matrix', () => {
            utils.repeat(() => {
                let n = 1 + Math.floor(Math.random() * 10);
                let arr = Array.from({length: n}, () => Array.from({length: n}, () => Math.random()));
                assert.deepEqual(
                    new la.Matrix(arr).t(),
                    new la.Matrix(arr.map((col, i) => arr.map(row => row[i])))
                );
            }, 100);
        });

        it('should return to original after two transposition', () => {
            utils.repeat(() => {
                let n = 1 + Math.floor(Math.random() * 10);
                let arr = Array.from({length: n}, () => Array.from({length: n}, () => Math.random()));
                let M = new la.Matrix(arr);
                assert.deepEqual(M.t().t(), M);
            }, 100);
        });

        it('should apply a function element-wise on a matrix', () => {
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

        it('should scale the matrix', () => {
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

        it('should multiply two matrices (Freivalds algorithm)', () => {
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

        it('should calculate the LDL decomposition of a matrix', () => {
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

                // Check if D is diagonal
                let md = D.m(),
                    s = 0;
                for (let i = 0; i < n; i++) {
                    for (let j = 0; j < i; j++) {
                        if (i !== j) {
                            s += Math.abs(md[i][j]) + Math.abs(md[j][i]);
                        }
                    }
                }
                assert.equal(s, 0);

                // Check if L is lower unit triangular
                let ld = L.m(),
                    slo = 0,
                    shi = 0;
                for (let i = 0; i < n; i++) {
                    for (let j = 0; j < i; j++) {
                        slo += Math.abs(ld[i][j]);
                        shi += Math.abs(ld[j][i]);
                    }
                }
                assert.equal(shi, 0);
                assert.equal(slo >= 0, true);

                // Check if their product gives the original back
                let m = L.mult(D.mult(L.t())).add(M.scale(-1)).m(),
                    sm = 0;
                for (let i = 0; i < n; i++) {
                    sm += m[i][i];
                    for (let j = 0; j < i; j++) {
                        sm += Math.abs(m[i][j]) + Math.abs(m[j][i]);
                    }
                }
                assert.equal(sm < EPSILON, true);
            }, 100);
        });
    });
});
