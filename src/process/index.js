/**
 * A collection of stochastic process generators.
 *
 * @namespace process
 * @memberof ran
 */
export { default as BrownianMotion } from './brownian-motion'
export { default as GeometricBrownianMotion } from './geometric-brownian-motion'
export { default as OrnsteinUhlenbeck } from './ornstein-uhlenbeck'
export { default as PoissonProcess } from './poisson-process'
export { default as Process } from './_process'
