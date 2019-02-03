/**
 * A small library for robust generation of various random variates, testing data against distributions, calculating
 * different statistical properties, or sampling unknown distributions using advanced MCMC methods.
 *
 * @module ran
 */

import * as core from './core'
import * as la from './la'
import * as dist from './dist'
import * as ts from './ts'
import * as mc from './mc'

export { core, la, dist, ts, mc }

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
