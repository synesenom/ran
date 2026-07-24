// Bridges test/dist-cases-continuous.js's scipy-vetted refVals into precision-refs-continuous.py's
// self_check() -- @babel/register lets require() load the ESM-syntax test file the same way mocha
// does, and evaluating params() here (rather than parsing the source as text) survives any future
// closure shape, including Hyperexponential's nested { weight, rate } objects.
require('@babel/register')()

const cases = require('../test/dist-cases-continuous.js').default

const data = cases.map(d => ({
  name: d.name,
  refVals: d.refVals || null,
  cases: (d.cases || []).map(c => ({
    params: c.params(),
    refVals: c.refVals || null
  }))
}))

process.stdout.write(JSON.stringify(data))
