// Bridges precision-refs-special.py's mpmath-computed grid into ranjs's own src/special/
// implementation -- @babel/register lets require() load the ESM-syntax special-function
// module the same way mocha does, mirroring the dump-dist-cases-json.js precedent.
require('@babel/register').default()

const special = require('../src/special/index.js')

const FN = {
  besselI: special.besselI,
  besselISpherical: special.besselISpherical,
  besselIExpScaled: special.besselIExpScaled,
  besselISphericalExpScaled: special.besselISphericalExpScaled,
  logBesselIExpScaled: special.logBesselIExpScaled,
  besselInu: special.besselInu,
  besselK: special.besselK,
  besselKnu: special.besselKnu,
  digamma: special.digamma,
  gamma: special.gamma,
  logGamma: special.logGamma,
  gammaLowerIncomplete: special.gammaLowerIncomplete,
  gammaUpperIncomplete: special.gammaUpperIncomplete,
  gammaLowerIncompleteInv: special.gammaLowerIncompleteInv,
  beta: special.beta,
  logBeta: special.logBeta,
  betaIncomplete: special.betaIncomplete,
  regularizedBetaIncomplete: special.regularizedBetaIncomplete,
  logBinomial: special.logBinomial
}

// JSON has no Infinity/NaN literal (JSON.stringify silently emits `null` for both), so encode
// them as tagged strings the Python side decodes explicitly instead of losing the distinction.
function encode (value) {
  if (Number.isNaN(value)) return 'NaN'
  if (value === Infinity) return 'Infinity'
  if (value === -Infinity) return '-Infinity'
  return value
}

let input = ''
process.stdin.on('data', chunk => { input += chunk })
process.stdin.on('end', () => {
  const points = JSON.parse(input)
  const results = points.map(({ fn, args }) => {
    try {
      return { value: encode(FN[fn](...args)) }
    } catch (ex) {
      return { error: String(ex) }
    }
  })
  process.stdout.write(JSON.stringify(results))
})
