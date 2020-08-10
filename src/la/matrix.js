import Vector from './vector'

/**
 * Class representing an immutable real square matrix.
 *
 * @class Matrix
 * @memberOf ran.la
 * @param {(number|Array|ran.la.Matrix)=} arg The constructor argument. If it is a number, it sets the
 * linear dimension of the matrix. If it is an array of arrays, the matrix is initialized with the array
 * elements. If it is another matrix, it is copied to this matrix. If not specified, a 3x3 identity matrix is
 * created.
 * @constructor
 * @example
 *
 * let M1 = new ran.la.Matrix()
 * let M2 = new ran.la.Matrix(3)
 * let M3 = new ran.la.Matrix([[1, 0, 0], [0, 1, 0], [0, 0, 1]])
 * let M4 = new ran.la.Matrix(M1)
 * //    ┌         ┐
 * //    │ 1  0  0 │
 * // => │ 0  1  0 │
 * //    │ 0  0  1 │
 * //    └         ┘
 *
 */
class Matrix {
  constructor (arg) {
    if (typeof arg === 'number') {
      this._m = Array.from({ length: arg }, () => new Array(arg).fill(0))
      for (let i = 0; i < arg; i++) {
        this._m[i][i] = 1
      }
    } else if (Array.isArray(arg)) {
      this._m = arg
    } else if (typeof arg === 'object' && Array.isArray(arg._m)) {
      this._m = arg._m
    } else {
      this._m = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
    }
  }

  /**
   * Returns the matrix as an array of arrays.
   *
   * @method m
   * @memberOf ran.la.Matrix
   * @returns {Array[]} The matrix in an array of array representation.
   * @example
   *
   * let M = new ran.la.Matrix()
   * M.m()
   * // => [ [ 1, 0, 0 ],
   * //      [ 0, 1, 0 ],
   * //      [ 0, 0, 1 ] ]
   *
   */
  m () {
    return this._m.map(d => d.slice())
  }

  /**
   * Returns or sets an element of the matrix.
   *
   * @method ij
   * @memberOf ran.la.Matrix
   * @param {number} i Row index of the element.
   * @param {number} j Column index of the element.
   * @param {number=} value The new value of the element at the i-th row and j-th column. If not specified,
   * the value at (i, j) is returned.
   * @example
   *
   * let M = new ran.la.Matrix()
   *
   * M.ij(1, 1)
   * // => 1
   *
   * M.ij(1, 2)
   * // => 0
   *
   * M.ij(1, 2, 5)
   * //    ┌         ┐
   * //    │ 1  0  0 │
   * // => │ 0  1  0 │
   * //    │ 0  5  1 │
   * //    └         ┘
   *
   */
  ij (i, j, value) {
    if (typeof value !== 'undefined') {
      this._m[i][j] = value
    } else {
      return this._m[i][j]
    }
  }

  /**
   * Performs an operation on the matrix element-wise.
   *
   * @method f
   * @memberOf ran.la.Matrix
   * @param {Function} func Function to apply on each element. May take three parameters: the element's value and its
   * row and column indices.
   * @returns {ran.la.Matrix} The transformed matrix.
   * @example
   *
   * let M = new ran.la.Matrix([[1, 2], [3, 4]])
   * M.f(d => d * d)
   * //    ┌      ┐
   * // => │ 1  4 │
   * //    │ 9 16 │
   * //    └      ┘
   *
   */
  f (func) {
    // TODO Unit test arguments i and j.
    return new Matrix(this._m.map((row, i) => row.map((d, j) => func(d, i, j))))
  }

  /**
   * Multiplies the matrix with a scalar.
   *
   * @method scale
   * @memberOf ran.la.Matrix
   * @param {number} s The scalar to multiply matrix with.
   * @returns {ran.la.Matrix} The scaled matrix.
   * @example
   *
   * let M = new ran.la.Matrix([[1, 2], [3, 4]])
   * M.scale(2)
   * //    ┌      ┐
   * // => │ 2  4 │
   * //    │ 6  8 │
   * //    └      ┘
   *
   */
  scale (s) {
    return this.f(x => x * s)
  }

  /**
   * Adds another matrix to the current matrix.
   *
   * @method add
   * @memberOf ran.la.Matrix
   * @param {ran.la.Matrix} mat The matrix to add.
   * @returns {ran.la.Matrix} The sum of the two matrices.
   * @example
   *
   * let M = new ran.la.Matrix([[1, 2], [3, 4]])
   * let N = new ran.la.Matrix([[5, 6], [7, 8]])
   * M.add(N)
   * //    ┌        ┐
   * // => │  6   8 │
   * //    │ 10  12 │
   * //    └        ┘
   *
   */
  add (mat) {
    const m = mat.m()
    return new Matrix(this._m.map((row, i) => row.map((d, j) => d + m[i][j])))
  }

  /**
   * Subtracts another matrix from the current matrix.
   *
   * @method sub
   * @memberOf ran.la.Matrix
   * @param {ran.la.Matrix} mat The matrix to subtract.
   * @returns {ran.la.Matrix} The difference of the two matrices.
   * @example
   *
   * let M = new ran.la.Matrix([[5, 6], [7, 8]])
   * let N = new ran.la.Matrix([[1, 1], [1, 1]])
   * M.add(N)
   * //    ┌      ┐
   * // => │ 4  5 │
   * //    │ 6  7 │
   * //    └      ┘
   *
   */
  sub (mat) {
    const m = mat.m()
    return new Matrix(this._m.map((row, i) => row.map((d, j) => d - m[i][j])))
  }

  /**
   * Multiplies the matrix with another matrix (from the right).
   *
   * @method mult
   * @memberOf ran.la.Matrix
   * @param {Matrix} mat Matrix to multiply current matrix with.
   * @returns {Matrix} The product matrix.
   * @example
   *
   * let M = new ran.la.Matrix([[1, 2], [3, 4]])
   * let N = new ran.la.Matrix([[5, 6], [7, 8]])
   * M.mult(N)
   * //    ┌        ┐
   * // => │ 19  22 │
   * //    │ 43  50 │
   * //    └        ┘
   *
   */
  mult (mat) {
    const m = mat.m()
    const n = this._m.length
    const r = new Matrix(n)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let rij = 0
        for (let k = 0; k < n; k++) {
          rij += this._m[i][k] * m[k][j]
        }
        r.ij(i, j, rij)
      }
    }
    return r
  }

  /**
   * Returns the transpose of the matrix.
   *
   * @method t
   * @memberOf ran.la.Matrix
   * @returns {ran.la.Matrix} The transposed matrix.
   * @example
   *
   * let M = new ran.la.Matrix([[1, 2], [3, 4]])
   * M.t()
   * //    ┌      ┐
   * // => │ 1  3 │
   * //    │ 2  4 │
   * //    └      ┘
   *
   */
  t () {
    return new Matrix(this._m[0].map((col, i) => this._m.map(row => row[i])))
  }

  /**
   * Multiplies a vector with the matrix (applies this matrix on a vector).
   *
   * @method apply
   * @memberOf ran.la.Matrix
   * @param {ran.la.Vector} vec Vector to apply matrix on.
   * @returns {ran.la.Vector} The mapped vector.
   * @example
   *
   * let M = new ran.la.Matrix([[1, 2], [3, 4]])
   * let v = new ran.la.Vector([5, 6])
   * M.apply(v)
   * // => ( 17, 39 )
   *
   */
  apply (vec) {
    return new Vector(this._m.map(d => vec.dot(new Vector(d))))
  }

  /**
   * Performs the [LDL decomposition]{@link https://en.wikipedia.org/wiki/Cholesky_decomposition} of the
   * matrix.
   *
   * @method ldl
   * @memberOf ran.la.Matrix
   * @returns {Object} Object containing two properties: {D} and {L} representing the corresponding matrices
   * in the LDL decomposition.
   * @example
   *
   * let M = new Matrix([[4, 12, -16], [12, 37, -43], [-16, -43, 98]])
   * M.ldl()
   * //        ┌          ┐       ┌         ┐
   * //        │  1  0  0 │       │ 4  0  0 │
   * // => L = │  3  1  0 │,  D = │ 0  1  0 │
   * //        │ -4  5  1 │       │ 0  0  9 │
   * //        └          ┘       └         ┘
   *
   */
  ldl () {
    // Init D, L
    const n = this._m.length

    const D = new Matrix(n)

    const L = new Matrix(n)

    // Perform decomposition
    for (let j = 0; j < n; j++) {
      // Update D
      let dj = this.ij(j, j)
      for (let k = 0; k < j; k++) {
        dj -= D.ij(k, k) * L.ij(j, k) * L.ij(j, k)
      }
      D.ij(j, j, dj)

      // Update L
      for (let i = n - 1; i > j; i--) {
        let lij = this.ij(i, j)
        for (let k = 0; k < j; k++) {
          lij -= D.ij(k, k) * L.ij(i, k) * L.ij(j, k)
        }
        L.ij(i, j, lij / dj)
      }
    }

    return { D, L }
  }

  /**
   * Returns an array representing the row sums of the matrix.
   *
   * @method rowSum
   * @methodOf ran.la.Matrix
   * @return {number[]} Array containing the row sums.
   */
  rowSum () {
    return this._m.map(row => row.reduce((sum, d) => sum + d, 0))
  }

  /**
   * Returns the Hadamard (element-wise) product of the matrix with another matrix
   *
   * @method hadamard
   * @methodOf ran.la.Matrix
   * @param {ran.la.Matrix} mat Matrix to calculate element-wise product with.
   * @return {ran.la.Matrix} The result matrix.
   */
  hadamard (mat) {
    const m = mat.m()
    return this.f((d, i, j) => d * m[i][j])
  }
}

export default Matrix
