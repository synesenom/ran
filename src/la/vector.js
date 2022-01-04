/**
 * Class representing a real vector.
 *
 * @class Vector
 * @memberof ran.la
 * @param {(number|Array|ran.la.Vector)=} arg The constructor argument. If it is a number, it sets the
 * dimension of the vector. If it is an array, the vector is initialized with the array elements. If it is
 * another vector, it is copied to this vector. If not specified, a 3D vector is created directing in the X
 * axis.
 * @constructor
 * @ignore
 * @example
 *
 * let vec1 = new ran.la.Vector()
 * let vec2 = new ran.la.Vector(3)
 * let vec3 = new ran.la.Vector([1, 0, 0])
 * let vec4 = new ran.la.Vector(vec1)
 * // => ( 1, 0, 0 )
 *
 */
class Vector {
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
   * @memberof ran.la.Vector
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
   * @memberof ran.la.Vector
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
    if (typeof value !== 'undefined') {
      this._v[i] = value
    } else {
      return this._v[i]
    }
  }

  /**
   * Performs an operation on the vector element-wise.
   *
   * @method f
   * @memberof ran.la.Vector
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
   * @memberof ran.la.Vector
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
   * @memberof ran.la.Vector
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
    const v = vec.v()
    return new Vector(this._v.map((d, i) => d + v[i]))
  }

  /**
   * Subtracts another vector from this vector.
   *
   * @method sub
   * @memberof ran.la.Vector
   * @param {ran.la.Vector} vec The vector to subtract.
   * @returns {ran.la.Vector} The difference vector.
   * @example
   *
   * let v = new ran.la.Vector([4, 5, 6])
   * let w = new ran.la.Vector([1, 1, 1])
   * v.sub(w)
   * // => ( 3, 4, 5 )
   *
   */
  sub (vec) {
    const v = vec.v()
    return new Vector(this._v.map((d, i) => d - v[i]))
  }

  /**
   * Calculates the dot product with another vector.
   *
   * @method dot
   * @memberof ran.la.Vector
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
    const v = vec.v()
    return this._v.reduce((sum, d, i) => sum + d * v[i], 0)
  }

  /**
   * Calculates the outer product with another vector.
   *
   * @method outer
   * @memberof ran.la.Vector
   * @param vec {ran.la.Vector} vec Vector to multiply with (from the right).
   * @returns {Array[]} An array of arrays representing the outer product.
   * @example
   *
   * let v = new ran.la.Vector([1, 2, 3])
   * let w = new ran.la.Vector([4, 5, 6])
   * v.outer(w)
   * // => [[4,   5,  6],
   *        [8,  10, 12],
   *        [12, 15, 18]]
   */
  outer (vec) {
    return this._v.map(u => vec.scale(u).v())
  }
}

export default Vector
