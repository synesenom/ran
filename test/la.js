import { assert } from 'chai'
import { describe, it } from 'mocha'
import * as la from '../src/la'

const EPSILON = 1e-10

describe('la', () => {
  describe('Vector', () => {
    describe('new Vector()', () => {
      it('should create a 3-dimensional unit vector', () => {
        assert.deepEqual(new la.Vector(), new la.Vector(3))
      })

      it('should create an n-dimensional unit vector', () => {
        const n = 1 + Math.floor(Math.random() * 100)
        assert.deepEqual(
          new la.Vector(n),
          new la.Vector(Array.from({ length: n - 1 }, () => 0).unshift(1))
        )
      })

      it('should copy another vector', () => {
        assert.deepEqual(new la.Vector(), new la.Vector(new la.Vector()))
      })
    })

    describe('.v()', () => {
      it('should return vector as array', () => {
        const n = 1 + Math.floor(Math.random() * 100)
        const arr = Array.from({ length: n }, () => Math.random())
        assert.deepEqual(
          new la.Vector(arr).v(),
          arr
        )
      })
    })

    describe('.i()', () => {
      it('should return the i-th element', () => {
        const n = 2 + Math.floor(Math.random() * 100)
        const arr = Array.from({ length: n }, () => Math.random())
        const v = new la.Vector(arr)
        const i = Math.floor(Math.random() * n)
        assert.deepEqual(v.i(i), arr[i])
      })

      it('should set the i-th element', () => {
        const n = 2 + Math.floor(Math.random() * 10)
        const arr = Array.from({ length: n }, () => Math.random())
        const v = new la.Vector(arr)
        const i = Math.floor(Math.random() * n)
        const s = Math.random()
        v.i(i, s)
        arr[i] = s
        assert.deepEqual(v, new la.Vector(arr))
      })
    })

    describe('.f()', () => {
      it('should apply a function element-wise', () => {
        const funcs = [Math.sqrt, Math.cos, Math.sin, Math.exp, Math.log]
        const n = 2 + Math.floor(Math.random() * 10)
        const arr = Array.from({ length: n }, () => Math.random())
        const func = funcs[Math.floor(Math.random() * funcs.length)]
        assert.deepEqual(
          new la.Vector(arr).f(func),
          new la.Vector(arr.map(d => func(d)))
        )
      })
    })

    describe('.scale()', () => {
      it('should scale the vector element-wise', () => {
        const s = Math.random()
        const n = 1 + Math.floor(Math.random() * 100)
        const arr = Array.from({ length: n }, () => Math.random())
        assert.deepEqual(
          new la.Vector(arr).scale(s),
          new la.Vector(arr.map(d => d * s))
        )
      })
    })

    describe('.add()', () => {
      it('should add two vectors', () => {
        const n = 1 + Math.floor(Math.random() * 100)
        const arr1 = Array.from({ length: n }, () => Math.random())
        const arr2 = Array.from({ length: n }, () => Math.random())
        assert.deepEqual(
          new la.Vector(arr1).add(new la.Vector(arr2)),
          new la.Vector(arr1.map((d, i) => d + arr2[i]))
        )
      })
    })

    describe('.sub()', () => {
      it('should subtract two vectors', () => {
        const n = 1 + Math.floor(Math.random() * 100)
        const arr1 = Array.from({ length: n }, () => Math.random())
        const arr2 = Array.from({ length: n }, () => Math.random())
        assert.deepEqual(
          new la.Vector(arr1).sub(new la.Vector(arr2)),
          new la.Vector(arr1.map((d, i) => d - arr2[i]))
        )
      })
    })

    describe('.dot()', () => {
      it('should compute the dot product of two vectors', () => {
        const n = 1 + Math.floor(Math.random() * 100)
        const arr1 = Array.from({ length: n }, () => Math.random())
        const arr2 = Array.from({ length: n }, () => Math.random())
        assert.deepEqual(
          new la.Vector(arr1).dot(new la.Vector(arr2)),
          arr1.reduce((p, d, i) => p + d * arr2[i], 0)
        )
      })
    })

    describe('.outer()', () => {
      it('should compute the outer product of two vectors', () => {
        const n = 1 + Math.floor(Math.random() * 10)
        const arr1 = Array.from({ length: n }, () => Math.random())
        const arr2 = Array.from({ length: n }, () => Math.random())
        const mat = new la.Matrix(new la.Vector(arr1).outer(new la.Vector(arr2)))
        mat.m().forEach((row, i) => {
          row.forEach((d, j) => {
            assert.equal(d, arr1[i] * arr2[j])
          })
        })
      })
    })
  })

  describe('Matrix', () => {
    describe('new Matrix()', () => {
      it('should create a 3x3 identity matrix', () => {
        assert.deepEqual(new la.Matrix(), new la.Matrix(3))
      })

      it('should create an nxn identity matrix', () => {
        const n = 1 + Math.floor(Math.random() * 10)
        assert.deepEqual(
          new la.Matrix(n),
          new la.Matrix(
            Array.from({ length: n }, (d, i) => Array.from({ length: n }, (dd, j) => i === j ? 1 : 0))
          )
        )
      })

      it('should copy another matrix', () => {
        assert.deepEqual(new la.Matrix(), new la.Matrix(new la.Matrix()))
      })
    })

    describe('.m()', () => {
      it('should return matrix as an array of arrays', () => {
        const n = 1 + Math.floor(Math.random() * 10)
        const arr = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
        assert.deepEqual(
          new la.Matrix(arr).m(),
          arr
        )
      })
    })

    describe('.ij()', () => {
      it('should return the (i, j)-th element', () => {
        const n = 2 + Math.floor(Math.random() * 10)
        const arr = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
        const M = new la.Matrix(arr)
        const i = Math.floor(Math.random() * n)
        const j = Math.floor(Math.random() * n)
        assert.deepEqual(M.ij(i, j), arr[i][j])
      })

      it('should set the (i, j)-th element', () => {
        const n = 2 + Math.floor(Math.random() * 10)
        const arr = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
        const M = new la.Matrix(arr)
        const i = Math.floor(Math.random() * n)
        const j = Math.floor(Math.random() * n)
        const s = Math.random()
        M.ij(i, j, s)
        arr[i][j] = s
        assert.deepEqual(M, new la.Matrix(arr))
      })
    })

    describe('.t()', () => {
      it('should transpose the matrix', () => {
        const n = 1 + Math.floor(Math.random() * 10)
        const arr = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
        assert.deepEqual(
          new la.Matrix(arr).t(),
          new la.Matrix(arr.map((col, i) => arr.map(row => row[i])))
        )
      })

      it('should return original matrix after two transposition', () => {
        const n = 1 + Math.floor(Math.random() * 10)
        const arr = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
        const M = new la.Matrix(arr)
        assert.deepEqual(M.t().t(), M)
      })
    })

    describe('.f()', () => {
      it('should apply a function element-wise', () => {
        const funcs = [Math.sqrt, Math.cos, Math.sin, Math.exp, Math.log]
        const n = 1 + Math.floor(Math.random() * 10)
        const arr = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
        const func = funcs[Math.floor(Math.random() * funcs.length)]
        assert.deepEqual(
          new la.Matrix(arr).f(func),
          new la.Matrix(arr.map(d => d.map(dd => func(dd))))
        )
      })
    })

    describe('.scale()', () => {
      it('should scale a matrix element-wise', () => {
        const s = Math.random()
        const n = 1 + Math.floor(Math.random() * 10)
        const arr = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
        assert.deepEqual(
          new la.Matrix(arr).scale(s),
          new la.Matrix(arr.map(d => d.map(dd => s * dd)))
        )
      })
    })

    describe('.add()', () => {
      it('should add two matrices', () => {
        const n = 1 + Math.floor(Math.random() * 10)
        const arr1 = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
        const arr2 = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
        assert.deepEqual(
          new la.Matrix(arr1).add(new la.Matrix(arr2)),
          new la.Matrix(arr1.map((d, i) => d.map((dd, j) => dd + arr2[i][j])))
        )
      })
    })

    describe('.sub()', () => {
      it('should subtract two matrices', () => {
        const n = 1 + Math.floor(Math.random() * 10)
        const arr1 = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
        const arr2 = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
        assert.deepEqual(
          new la.Matrix(arr1).sub(new la.Matrix(arr2)),
          new la.Matrix(arr1.map((d, i) => d.map((dd, j) => dd - arr2[i][j])))
        )
      })
    })

    describe('.apply()', () => {
      it('should apply a matrix on a vector', () => {
        const n = 1 + Math.floor(Math.random() * 10)
        const arr1 = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
        const arr2 = Array.from({ length: n }, () => Math.random())
        assert.deepEqual(
          new la.Matrix(arr1).apply(new la.Vector(arr2)),
          new la.Vector(arr1.map(d => arr2.reduce((p, dd, i) => p + dd * d[i], 0)))
        )
      })
    })

    describe('.mult()', () => {
      it('should multiply two matrices', () => {
        // Test uses the Freivalds algorithm
        const n = 10
        const M = new la.Matrix(Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random())))
        const N = new la.Matrix(Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random())))
        const C = M.mult(N)
        const r = new la.Vector(Array.from({ length: n }, () => Math.random() > 0.5 ? 1 : 0))
        const P = M.apply(N.apply(r)).add(C.apply(r).scale(-1))
        assert.deepEqual(P.v().reduce((s, d) => s && Math.abs(d) < EPSILON, true), true)
      })
    })

    describe('.ldl()', () => {
      function perform (test) {
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
        const n = 1 + Math.floor(Math.random() * 10)
        const arr = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
        assert.deepEqual(
          new la.Matrix(arr).rowSum(),
          arr.map(row => row.reduce((sum, d) => sum + d, 0))
        )
      })
    })

    describe('.hadamard()', () => {
      it('should return the Hadamard product of two matrices', () => {
        const n = 1 + Math.floor(Math.random() * 10)
        const arr1 = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
        const arr2 = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random()))
        assert.deepEqual(
          new la.Matrix(arr1).hadamard(new la.Matrix(arr2)),
          new la.Matrix(arr1.map((row, i) => row.map((d, j) => d * arr2[i][j])))
        )
      })
    })
  })
})
