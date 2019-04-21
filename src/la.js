/**
 * Namespaces containing various linear algebra classes and methods.
 *
 * @namespace la
 * @memberOf ran
 * @private
 */

/**
   * Class representing a real vector.
   *
   * @class Vector
   * @memberOf ran.la
   * @param {(number|Array|ran.la.Vector)=} arg The constructor argument. If it is a number, it sets the
   * dimension of the vector. If it is an array, the vector is initialized with the array elements. If it is
   * another vector, it is copied to this vector. If not specified, a 3D vector is created directing in the X
   * axis.
   * @constructor
   * @example
   *
   * let vec1 = new ran.la.Vector()
   * let vec2 = new ran.la.Vector(3)
   * let vec3 = new ran.la.Vector([1, 0, 0])
   * let vec4 = new ran.la.Vector(vec1)
   * // => ( 1, 0, 0 )
   *
   */
export class Vector {
  constructor (arg) {
    if (typeof arg === 'number') {
      this._v = new Array(arg).fill(0)
      this._v[0] = 1
    } else if (Array.isArray(arg)) {
      this._v = arg
    } else if (typeof arg === 'object' && Array.isArray(arg._v)) {
      this._v = arg._v
    } else {
      this._v = [1, 0, 0]
    }
  }

  /**
     * Returns the vector as an array.
     *
     * @method v
     * @memberOf ran.la.Vector
     * @returns {Array} The vector as an array.
     * @example
     *
     * let vec = new ran.la.Vector(3)
     * vec.v()
     * // => [ 1, 0, 0 ]
     *
     */
  v () {
    return this._v
  }

  /**
     * Returns or sets an element of the vector.
     *
     * @method i
     * @memberOf ran.la.Vector
     * @param {number} i Index of the element.
     * @param {number=} value The new value of the i-th element. If not specified, the value at i is returned.
     * @example
     *
     * let v = new ran.la.Vector()
     *
     * v.i(0)
     * // => 1
     *
     * v.i(1)
     * // => 0
     *
     * v.i(1, 2)
     * // => ( 1, 2, 0 )
     *
     */
  i (i, value) {
    if (value !== undefined) {
      this._v[i] = value
    } else {
      return this._v[i]
    }
  }

  /**
     * Performs an operation on the vector element-wise.
     *
     * @method f
     * @memberOf ran.la.Vector
     * @param {Function} func Function to apply on each element.
     * @returns {ran.la.Vector} The transformed matrix.
     * @example
     *
     * let v = new ran.la.Vector([1, 2, 3])
     * v.f(d => d * d)
     * // => ( 1, 4, 9 )
     *
     */
  f (func) {
    return new Vector(this._v.map(d => func(d)))
  }

  /**
     * Multiplies this vector with a scalar.
     *
     * @method scale
     * @memberOf ran.la.Vector
     * @param {number} s Scalar to multiply vector with.
     * @returns {ran.la.Vector} The scaled vector.
     * @example
     *
     * let vec = new ran.la.Vector([1, 2, 3])
     * vec.scale(2)
     * // => ( 2, 4, 6 )
     *
     */
  scale (s) {
    return new Vector(this._v.map(d => d * s))
  }

  /**
     * Adds another vector to this vector.
     *
     * @method add
     * @memberOf ran.la.Vector
     * @param {ran.la.Vector} vec The vector to add.
     * @returns {ran.la.Vector} The sum vector.
     * @example
     *
     * let v = new ran.la.Vector([1, 2, 3])
     * let w = new ran.la.Vector([4, 5, 6])
     * v.add(w)
     * // => ( 5, 7, 9 )
     *
     */
  add (vec) {
    let v = vec.v()
    return new Vector(this._v.map((d, i) => d + v[i]))
  }

  /**
     * Calculates the dot product with another vector.
     *
     * @method dot
     * @memberOf ran.la.Vector
     * @param {ran.la.Vector} vec Vector to multiply with.
     * @returns {number} The dot product.
     * @example
     *
     * let v = new ran.la.Vector([1, 2, 3])
     * let w = new ran.la.Vector([4, 5, 6])
     * v.dot(w)
     * // => 32
     *
     */
  dot (vec) {
    let v = vec.v()
    return this._v.reduce((sum, d, i) => sum + d * v[i], 0)
  }
}

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
export class Matrix {
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
    if (value !== undefined) {
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
     * @param {Function} func Function to apply on each element.
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
    return new Matrix(this._m.map(row => row.map(d => func(d))))
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
    let m = mat.m()
    return new Matrix(this._m.map((row, i) => row.map((d, j) => d + m[i][j])))
  }

  /**
     * Multiplies the matrix with another matrix (from the right).
     *
     * @method mult
     * @memberOf ran.la.Matrix
     * @param {ran.la.Matrix} mat Matrix to multiply current matrix with.
     * @returns {ran.la.Matrix} The product matrix.
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
    let m = mat.m()
    let n = this._m.length
    let r = new Matrix(n)
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
     * Multiplies a vector with the matrix (acts this matrix on a vector).
     *
     * @method act
     * @memberOf ran.la.Matrix
     * @param {ran.la.Vector} vec Vector to act matrix on.
     * @returns {ran.la.Vector} The mapped vector.
     * @example
     *
     * let M = new ran.la.Matrix([[1, 2], [3, 4]])
     * let v = new ran.la.Vector([5, 6])
     * M.act(v)
     * // => ( 17, 39 )
     *
     */
  act (vec) {
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
    let n = this._m.length

    let D = new Matrix(n)

    let L = new Matrix(n)

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
}
