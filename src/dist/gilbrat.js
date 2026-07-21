import LogNormal from './log-normal'

/**
 * Probability density function for the [Gilbrat's distribution]{@link http://mathworld.wolfram.com/GibratsDistribution.html}:
 *
 * $f(x) = \frac{1}{x \sqrt{2 \pi}}e^{-\frac{\ln x^2}{2}}.$
 *
 * Support: $x > 0$.
 *
 * @class Gilbrat
 * @memberof ran.dist
 * @constructor
 */
export default class Gilbrat extends LogNormal {
  // Special case of log-normal
  /** */
  constructor () {
    super(0, 1)

    // Gilbrat has 0 free parameters (both mu and sigma are fixed constants); override the 2 inherited from LogNormal/Normal
    // solutions/distribution/2026-06-07-2138-continuous-subclass-natural-params.md
    this.k = 0
  }
}
