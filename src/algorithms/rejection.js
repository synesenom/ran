import { MAX_ITER } from '../core/constants'

/**
 * Performs rejection sampling.
 *
 * @method rejection
 * @memberof ran.dist
 * @param {ran.core.Xoshiro128p} r Random generator.
 * @param {Function} g Generator for the sample (major function).
 * @param {Function} accept The function that returns the acceptance threshold.
 * @param {Function=} transform Optional transformation to apply once the sample is accepted (for transformed
 * distributions).
 * @return {(number|undefined)} The sampled random variate.
 * @ignore
 */
export default function (r, g, accept, transform) {
  for (let trial = 0; trial < MAX_ITER; trial++) {
    const x = g()
    if (r.next() < accept(x)) {
      return typeof transform !== 'undefined' ? transform(x) : x
    }
  }
}
