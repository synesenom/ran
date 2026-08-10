import { assert } from 'chai'
import { describe, it } from 'mocha'
import processCases from '../process-cases'

// Externally-sourced reference values for the analytical methods, defined in ./process-cases.js.
// Consumed by a plain inline loop rather than a shared runner module — see that file's header for
// why a dist-runner.js-style abstraction is not proportionate at this scale (#1221).
describe('process reference values', () => {
  processCases.forEach(({ name, ctor: Ctor, refs }) => {
    describe(name, () => {
      refs.forEach(({ should, params, method, args, chain, chainArgs, expected, tol, source }) => {
        // The method name is part of the title because `should` alone is not unique: Poisson's
        // mean(t) and variance(t) are both "return lambda*t", and the per-method describe() blocks
        // that used to disambiguate them are gone.
        it(`${method}() should ${should}`, () => {
          const proc = new Ctor(...params())
          const value = proc[method](...args)
          assert.closeTo(chain ? value[chain](...chainArgs) : value, expected, tol, source)
        })
      })
    })
  })
})
