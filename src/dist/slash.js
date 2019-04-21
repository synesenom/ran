import Normal from './normal'

/**
 * Generator for the [slash distribution]{@link https://en.wikipedia.org/wiki/Slash_distribution}:
 *
 * $$f(x) = \begin{cases}\frac{\varphi(0) - \varphi(x)}{x^2} &\quad\text{if $x \ne 0$},\\\frac{1}{2 \sqrt{2 \pi}} &\quad\text{if $x = 0$}\\\end{cases},$$
 *
 * where \(\varphi(x)\) is the probability density function of the standard normal distribution. Support: \(x \in \mathbb{R}\).
 *
 * @class Slash
 * @memberOf ran.dist
 * @constructor
 */
export default class extends Normal {
  constructor () {
    super(0, 1)
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
    this.mode = 0
    this.c1 = [
      0.5 / Math.sqrt(2 * Math.PI)
    ]
  }

  _generator () {
    // Direct sampling by the ratio of normal and uniform variates
    return super._generator() / this.r.next()
  }

  _pdf (x) {
    return x === 0
      ? this.c1[0]
      : (super._pdf(0) - super._pdf(x)) / (x * x)
  }

  _cdf (x) {
    return x === 0
      ? 0.5
      : super._cdf(x) - (super._pdf(0) - super._pdf(x)) / x
  }

  _q (p) {
    // Start with an estimate of the normal distribution's quantile
    let x0 = super._q(p)

    // Find true quantile with root finding
    return this._qEstimateRoot(p, x0)
  }
}
