/**
 * A small library for robust generation of various random variates, testing data against distributions, calculating
 * different statistical properties, or sampling unknown distributions using advanced MCMC methods.
 *
 * @module ran
 */

export * as core from './core'
export * as la from './la'
export * as dist from './dist'
export * as ts from './ts'
export * as mc from './mc'

// TODO next()
// TODO trend()
// TODO noise()
// TODO mean(power)
// TODO correlation()
// TODO Processes to add: https://en.wikipedia.org/wiki/Stochastic_process
// TODO Brown
// TODO Wiener
// TODO Orstein-Uhlenbeck
// TODO Gaussian
// TODO Galton-Watson
