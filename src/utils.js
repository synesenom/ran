/**
 * Sums the element of an array.
 *
 * @method _sum
 * @memberOf ran
 * @param {Array} arr Array of numbers to sum over.
 * @param {number=} pow Power to raise each element before summing up.
 * @return {number} The sum.
 * @private
 */
export function _sum(arr, pow = 1) {
    if (pow !== 1) {
        return arr.reduce((sum, d) => {
            return sum + Math.pow(d, pow);
        }, 0);
    } else {
        return arr.reduce((sum, d) => {
            return sum + d;
        }, 0);
    }
}

/**
 * The main random number generator.
 * If min > max, a random number in (max, min) is generated.
 *
 * @method r
 * @memberOf ran.utils
 * @param {number} min Lower boundary.
 * @param {number} max Upper boundary.
 * @returns {number} Random number.
 * @private
 */
export function r(min, max) {
    return min < max ? Math.random() * (max - min) + min : Math.random() * (min - max) + max;
}

/**
 * Runs a generator once or several times to return a single value or an array of values.
 *
 * @method some
 * @memberOf ran
 * @param {function} generator Random generator to use.
 * @param {number=} k Number of values to generate.
 * @returns {(number|string|Array)} Single value or array of generated values.
 * @private
 */
export function some(generator, k = 1) {
    if (k < 2)
        return generator();
    else {
        return Array.from({length: k}, () => generator());
    }
}