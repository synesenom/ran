import { assert } from 'chai'
import { describe, it } from 'mocha'
import { repeat } from './test-utils'
import * as la from '../src/la'

const EPSILON = 1e-10

describe('la', () => {
  describe('Vector', () => {
    describe('new Vector()', () => {
      it('should create a 3-dimensional unit vector', () => {
        assert.deepEqual(new la.Vector(), new la.Vector(3))
      })

      it('should create an n-dimensional unit vector', () => {
        assert.deepEqual(new la.Vector(5), new la.Vector([1, 0, 0, 0, 0]))
      })

      it('should copy another vector', () => {
        assert.deepEqual(new la.Vector([1, 0, 0, 0]), new la.Vector(new la.Vector(4)))
      })
    })

    describe('.v()', () => {
      it('should return vector as array', () => {
        assert.deepEqual(new la.Vector([1.2, 3.4, 5.6, 7.8]).v(), [1.2, 3.4, 5.6, 7.8])
      })
    })

    describe('.i()', () => {
      it('should return the i-th element', () => {
        assert.equal(new la.Vector([1.2, 3.4, 5.6, 7.8]).i(2), 5.6)
      })

      it('should set the i-th element', () => {
        assert.equal(new la.Vector([1.2, 3.4, 5.6, 7.8]).i(2, 9.0).i(2), 9.0)
      })
    })

    describe('.f()', () => {
      it('should apply a function element-wise', () => {
        assert.deepEqual(new la.Vector([1.2, 3.4, 5.6, 7.8]).f(x => x * 2), new la.Vector([2.4, 6.8, 11.2, 15.6]))
      })
    })

    describe('.scale()', () => {
      it('should scale the vector element-wise', () => {
        it('should apply a function element-wise', () => {
          assert.deepEqual(new la.Vector([1.2, 3.4, 5.6, 7.8]).scale(2), new la.Vector([2.4, 6.8, 11.2, 15.6]))
        })
      })
    })

    describe('.add()', () => {
      it('should add two vectors', () => {
        assert.deepEqual(new la.Vector([1, 2, 3]).add(new la.Vector([6, 7, 8])), new la.Vector([7, 9, 11]))
      })
    })

    describe('.sub()', () => {
      it('should subtract two vectors', () => {
        assert.deepEqual(new la.Vector([1, 2, 3]).sub(new la.Vector([6, 7, 8])), new la.Vector([-5, -5, -5]))
      })
    })

    describe('.dot()', () => {
      it('should compute the dot product of two vectors', () => {
        assert.deepEqual(new la.Vector([1.2, 3.4, 5.6, 7.8]).dot(new la.Vector([1, 2, 3, 4])), 56)
      })
    })

    describe('.outer()', () => {
      it('should compute the outer product of two vectors', () => {
        assert.deepEqual(new la.Vector([1, 2, 3]).outer(new la.Vector([4, 5, 6])), [
          [4, 5, 6], [8, 10, 12], [12, 15, 18]
        ])
      })
    })
  })

  describe('Matrix', () => {
    describe('new Matrix()', () => {
      it('should create a 3x3 identity matrix', () => {
        assert.deepEqual(new la.Matrix(), new la.Matrix(3))
      })

      it('should create an nxn identity matrix', () => {
        repeat(() => {
          const n = 1 + Math.floor(Math.random() * 10)
          assert.deepEqual(
            new la.Matrix(n),
            new la.Matrix(
              Array.from({ length: n }, (d, i) => Array.from({ length: n }, (dd, j) => i === j ? 1 : 0))
            )
          )
        }, 100)
      })

      it('should copy another matrix', () => {
        assert.deepEqual(new la.Matrix(), new la.Matrix(new la.Matrix()))
      })
    })

    describe('.m()', () => {
      it('should return matrix as an array of arrays', () => {
        repeat(() => {
          const n = 1 + Math.floor(Math.random() * 10)
          const arr = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
          assert.deepEqual(
            new la.Matrix(arr).m(),
            arr
          )
        }, 100)
      })
    })

    describe('.ij()', () => {
      it('should return the (i, j)-th element', () => {
        const n = 2 + Math.floor(Math.random() * 10)
        const arr = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
        const M = new la.Matrix(arr)
        repeat(() => {
          const i = Math.floor(Math.random() * n)
          const j = Math.floor(Math.random() * n)
          assert.deepEqual(M.ij(i, j), arr[i][j])
        }, 100)
      })

      it('should set the (i, j)-th element', () => {
        const n = 2 + Math.floor(Math.random() * 10)
        const arr = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
        const M = new la.Matrix(arr)
        repeat(() => {
          const i = Math.floor(Math.random() * n)
          const j = Math.floor(Math.random() * n)
          const s = Math.random()
          M.ij(i, j, s)
          arr[i][j] = s
          assert.deepEqual(M, new la.Matrix(arr))
        }, 100)
      })
    })

    describe('.t()', () => {
      it('should transpose the matrix', () => {
        repeat(() => {
          const n = 1 + Math.floor(Math.random() * 10)
          const arr = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
          assert.deepEqual(
            new la.Matrix(arr).t(),
            new la.Matrix(arr.map((col, i) => arr.map(row => row[i])))
          )
        }, 100)
      })

      it('should return original matrix after two transposition', () => {
        repeat(() => {
          const n = 1 + Math.floor(Math.random() * 10)
          const arr = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
          const M = new la.Matrix(arr)
          assert.deepEqual(M.t().t(), M)
        }, 100)
      })
    })

    describe('.f()', () => {
      it('should apply a function element-wise', () => {
        const funcs = [Math.sqrt, Math.cos, Math.sin, Math.exp, Math.log]
        repeat(() => {
          const n = 1 + Math.floor(Math.random() * 10)
          const arr = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
          const func = funcs[Math.floor(Math.random() * funcs.length)]
          assert.deepEqual(
            new la.Matrix(arr).f(func),
            new la.Matrix(arr.map(d => d.map(dd => func(dd))))
          )
        }, 100)
      })
    })

    describe('.scale()', () => {
      it('should scale a matrix element-wise', () => {
        repeat(() => {
          const s = Math.random()
          const n = 1 + Math.floor(Math.random() * 10)
          const arr = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
          assert.deepEqual(
            new la.Matrix(arr).scale(s),
            new la.Matrix(arr.map(d => d.map(dd => s * dd)))
          )
        }, 100)
      })
    })

    describe('.add()', () => {
      it('should add two matrices', () => {
        repeat(() => {
          const n = 1 + Math.floor(Math.random() * 10)
          const arr1 = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
          const arr2 = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
          assert.deepEqual(
            new la.Matrix(arr1).add(new la.Matrix(arr2)),
            new la.Matrix(arr1.map((d, i) => d.map((dd, j) => dd + arr2[i][j])))
          )
        }, 100)
      })
    })

    describe('.sub()', () => {
      it('should subtract two matrices', () => {
        repeat(() => {
          const n = 1 + Math.floor(Math.random() * 10)
          const arr1 = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
          const arr2 = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
          assert.deepEqual(
            new la.Matrix(arr1).sub(new la.Matrix(arr2)),
            new la.Matrix(arr1.map((d, i) => d.map((dd, j) => dd - arr2[i][j])))
          )
        }, 100)
      })
    })

    describe('.apply()', () => {
      it('should apply a matrix on a vector', () => {
        repeat(() => {
          const n = 1 + Math.floor(Math.random() * 10)
          const arr1 = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
          const arr2 = Array.from({ length: n }, () => Math.random())
          assert.deepEqual(
            new la.Matrix(arr1).apply(new la.Vector(arr2)),
            new la.Vector(arr1.map(d => arr2.reduce((p, dd, i) => p + dd * d[i], 0)))
          )
        }, 100)
      })
    })

    describe('.mult()', () => {
      it('should multiply two matrices', () => {
        // Test uses the Freivalds algorithm
        const n = 10
        const M = new la.Matrix(Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random())))
        const N = new la.Matrix(Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random())))
        const C = M.mult(N)
        repeat(() => {
          const r = new la.Vector(Array.from({ length: n }, () => Math.random() > 0.5 ? 1 : 0))
          const P = M.apply(N.apply(r)).add(C.apply(r).scale(-1))
          assert.deepEqual(P.v().reduce((s, d) => s && Math.abs(d) < EPSILON, true), true)
        }, 100)
      })
    })

    describe('.ldl()', () => {
      function perform (test) {
        repeat(() => {
          const n = 1 + Math.floor(Math.random() * 10)
          const arr = Array.from({ length: n }, () => Array.from({ length: n }, () => 0))
          for (let i = 0; i < n; i++) {
            arr[i][i] = Math.random()
            for (let j = 0; j < i; j++) {
              arr[i][j] = arr[j][i] = Math.random()
            }
          }
          const M = new la.Matrix(arr)
          const { D, L } = M.ldl()
          test(D, L, M)
        }, 100)
      }

      it('D should be a diagonal matrix', () => {
        perform((D, L, M) => {
          const md = D.m()

          let s = 0
          for (let i = 0; i < M.m().length; i++) {
            for (let j = 0; j < i; j++) {
              if (i !== j) {
                s += Math.abs(md[i][j]) + Math.abs(md[j][i])
              }
            }
          }
          assert.equal(s, 0)
        })
      })

      it('L should be a lower triangular matrix', () => {
        perform((D, L, M) => {
          const ld = L.m()

          let slo = 0

          let shi = 0
          for (let i = 0; i < M.m().length; i++) {
            for (let j = 0; j < i; j++) {
              slo += Math.abs(ld[i][j])
              shi += Math.abs(ld[j][i])
            }
          }
          assert.equal(shi, 0)
          assert.equal(slo >= 0, true)
        })
      })

      it('LDL should be equal to M', () => {
        perform((D, L, M) => {
          const m = L.mult(D.mult(L.t())).add(M.scale(-1)).m()

          let sm = 0
          for (let i = 0; i < M.m().length; i++) {
            sm += m[i][i]
            for (let j = 0; j < i; j++) {
              sm += Math.abs(m[i][j]) + Math.abs(m[j][i])
            }
          }
          assert.equal(sm < EPSILON, true)
        })
      })
    })

    describe('.rowSum()', () => {
      it('should return the row sum of the matrix', () => {
        repeat(() => {
          const n = 1 + Math.floor(Math.random() * 10)
          const arr = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
          assert.deepEqual(
            new la.Matrix(arr).rowSum(),
            arr.map(row => row.reduce((sum, d) => sum + d, 0))
          )
        }, 100)
      })
    })

    describe('.hadamard()', () => {
      it('should return the Hadamard product of two matrices', () => {
        repeat(() => {
          const n = 1 + Math.floor(Math.random() * 10)
          const arr1 = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
          const arr2 = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
          assert.deepEqual(
            new la.Matrix(arr1).hadamard(new la.Matrix(arr2)),
            new la.Matrix(arr1.map((row, i) => row.map((d, j) => d * arr2[i][j])))
          )
        }, 100)
      })
    })
  })
})
