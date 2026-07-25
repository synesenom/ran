import CompoundPoisson from './compound-poisson'

/**
 * Deprecated alias for {@link ran.process.CompoundPoisson}. `Process` must not appear in
 * `Process` subclass names (decisions/0041-process-subclass-naming-no-process-suffix.md).
 *
 * @class CompoundPoissonProcess
 * @memberof ran.process
 * @deprecated Use [ran.process.CompoundPoisson]{@link ran.process.CompoundPoisson} instead. This class will be removed in v1.33.0.
 * @see ran.process.CompoundPoisson
 * @constructor
 */
export default class CompoundPoissonProcess extends CompoundPoisson {
  /**
   * @param {Object} jumpDist A `ran.dist` Distribution instance whose `.sample()` method supplies jump sizes.
   * @param {number} lambda Arrival rate (must be > 0).
   * @param {number} [dt=1] Time step (must be > 0).
   */
  constructor (jumpDist, lambda, dt = 1) {
    console.warn('[ranjs] ran.process.CompoundPoissonProcess is deprecated and will be removed in v1.33.0; use ran.process.CompoundPoisson instead.')
    super(jumpDist, lambda, dt)
  }
}
