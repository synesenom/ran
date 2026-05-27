import Nakagami from './nakagami'

/**
 * Probability density function for the [Nakagami distribution]{@link https://en.wikipedia.org/wiki/Nakagami_distribution}
 * (previously mis-labelled as the Hoyt distribution):
 *
 * $f(x; m, \omega) = \frac{2m^m}{\Gamma(m) \omega^m} x^{2m - 1} e^{-\frac{m}{\omega} x^2},$
 *
 * where $m \ge 0.5$ and $\omega > 0$. Support: $x > 0$.
 *
 * @class Hoyt
 * @memberof ran.dist
 * @deprecated Use [ran.dist.Nakagami]{@link ran.dist.Nakagami} instead. This class will be removed in a future major release.
 * @see ran.dist.Nakagami
 * @constructor
 */
export default class Hoyt extends Nakagami {
  /**
   * @param {number} q Shape parameter (same as m in Nakagami).
   * @param {number} omega Spread parameter.
   */
  constructor (q, omega) {
    // Hoyt was implementing Nakagami-m under the wrong name; warn before full removal
    console.warn('ran.dist.Hoyt is deprecated and will be removed in a future major release; use ran.dist.Nakagami instead.')
    super(q, omega)
  }
}
