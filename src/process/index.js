/**
 * A collection of stochastic process generators.
 *
 * @namespace process
 * @memberof ran
 */
export { default as AR1 } from './ar1'
export { default as BrownianBridge } from './brownian-bridge'
export { default as BrownianMotion } from './brownian-motion'
export { default as CompoundPoisson } from './compound-poisson'
// Deprecated alias for CompoundPoisson — remove in v1.33.0 (decisions/0041-process-subclass-naming-no-process-suffix.md)
export { default as CompoundPoissonProcess } from './compound-poisson-process'
export { default as CoxIngersollRoss } from './cox-ingersoll-ross'
export { default as GeometricBrownianMotion } from './geometric-brownian-motion'
export { default as OrnsteinUhlenbeck } from './ornstein-uhlenbeck'
export { default as Poisson } from './poisson'
// Deprecated alias for Poisson — remove in v1.33.0 (decisions/0041-process-subclass-naming-no-process-suffix.md)
export { default as PoissonProcess } from './poisson-process'
export { default as Process } from './_process'
export { default as RandomWalk } from './random-walk'
