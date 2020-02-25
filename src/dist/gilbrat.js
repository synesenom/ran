import LogNormal from './log-normal'

/**
 * Generator for the [Gilbrat's distribution]{@link http://mathworld.wolfram.com/GibratsDistribution.html}:
 *
 * $$f(x) = \frac{1}{x \sqrt{2 \pi}}e^{-\frac{\ln x^2}{2}}.$$
 *
 * Support: \(x > 0\). Note that this distribution is simply a special case of the [log-normal]{@link #dist.LogNormal}.
 *
 * @class Gilbrat
 * @memberOf ran.dist
 * @constructor
 */
export default class extends LogNormal {
  // Special case of log-normal
  constructor () {
    super(0, 1)
  }
}
