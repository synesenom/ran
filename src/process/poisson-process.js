import Poisson from './poisson'

/**
 * Deprecated alias for `ran.process.Poisson`. `Process` must not appear in `Process`
 * subclass names (decisions/0041-process-subclass-naming-no-process-suffix.md).
 *
 * @class PoissonProcess
 * @memberof ran.process
 * @deprecated Use [ran.process.Poisson]{@link ran.process.Poisson} instead. This class will be removed in v1.33.0.
 * @see ran.process.Poisson
 * @constructor
 */
export default class PoissonProcess extends Poisson {
  /**
   * @param {number} lambda Event rate (must be > 0).
   * @param {number} [dt=1] Time step (must be > 0).
   */
  constructor (lambda, dt = 1) {
    console.warn('[ranjs] ran.process.PoissonProcess is deprecated and will be removed in v1.33.0; use ran.process.Poisson instead.')
    super(lambda, dt)
  }
}
