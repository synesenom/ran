import Beta from './beta'
import Distribution from './_distribution'

/**
 * Probability density function for the [Balding-Nichols distribution]{@link https://en.wikipedia.org/wiki/Balding%E2%80%93Nichols_model}:
 *
 * $f(x; \alpha, \beta) = \frac{x^{\alpha - 1} (1 - x)^{\beta - 1}}{\mathrm{B}(\alpha, \beta)},$
 *
 * where $\alpha = \frac{1 - F}{F} p$, $\beta = \frac{1 - F}{F} (1 - p)$ and $F, p \in (0, 1)$.
 * Support: $x \in (0, 1)$. It is simply a re-parametrization of the [beta distribution]{@link #dist.Beta}.
 *
 * @class BaldingNichols
 * @memberof ran.dist
 * @see D.J. Balding and R.A. Nichols, "A method for quantifying differentiation between populations at multi-allelic loci and its implications for investigating identity and paternity", Genetica 96, 3–12, 1995.
 * @constructor
 */
export default class BaldingNichols extends Beta {
  // Special parametrization of the beta distribution
  // Source: Balding and Nichols. A method for quantifying differentiation between populations at multi-allelic loci and
  // its implications for investigating identity and paternity. Genetica (96) 3-12, 1995.
  /**
   * @param {number} F Fixation index.
   * @param {number} p Allele frequency.
   */
  constructor (F, p) {
    Distribution.validate({ F, p }, [
      'F > 0', 'F < 1',
      'p > 0', 'p < 1'
    ])
    const f = (1 - F) / F
    super(f * p, f * (1 - p))
    this.p = Object.assign(this.p, { F, p })

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: 1,
      closed: false
    }]
  }

  static _fitInit (data) {
    // mean = p, Var = p(1−p)·F ⇒ p = mean, F = Var/(p(1−p)); clamp into (0, 1) since both are probabilities
    const n = data.length
    const mean = data.reduce((s, x) => s + x, 0) / n
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n
    const p = Math.min(Math.max(mean, 1e-3), 1 - 1e-3)
    const F = Math.min(Math.max(variance / (p * (1 - p)), 1e-3), 1 - 1e-3)
    return [F, p]
  }
}
