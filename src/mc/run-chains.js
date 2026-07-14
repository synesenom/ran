import RWM from './rwm'
import gelmanRubin from './gelman-rubin'

// Same order-of-magnitude cap as MCMC._MAX_DIM/_MAX_LAG (src/mc/_mcmc.js) — chains multiplies
// the per-instance accumulator footprint that bound already guards, one chain at a time.
const _MAX_CHAINS = 10000

/**
 * Runs multiple independently-seeded [RWM]{@link ran.mc.RWM} chains from the same target density
 * and computes the [Gelman-Rubin]{@link ran.mc.gelmanRubin} convergence diagnostic across them —
 * the recommended workflow for gating MCMC convergence (decisions/0024-mcmc-warmup-convergence-strategy.md),
 * since no signal computable from a single chain can distinguish "converged" from "stuck".
 *
 * @method runChains
 * @memberof ran.mc
 * @param {Function} logDensity The logarithm of the (unnormalized) target density.
 * @param {Object=} config Sampler configuration, forwarded unchanged to each chain's constructor
 * (see [MCMC]{@link ran.mc.MCMC} for supported properties).
 * @param {Object=} options Run configuration. Supported properties:
 * <ul>
 *   <li>{chains}: Number of independent chains to run. Default is 2, minimum 2.</li>
 *   <li>{warmUpBatches}: Number of warm-up batches per chain, forwarded to warmUp(). Default is 100.</li>
 *   <li>{sampleSize}: Number of samples to collect per chain, forwarded to sample(). Default is 1000.</li>
 *   <li>{seeds}: Explicit per-chain seed values. Defaults to [1, 2, ..., chains].</li>
 *   <li>{maxLength}: Maximum number of diagnostic values, forwarded to gelmanRubin().</li>
 * </ul>
 * @returns {Object} Object with properties: samples (number[][][], one sample array per chain) and
 * rhat (number[][], the gelmanRubin() diagnostic across the chains).
 * @throws {Error} If options.chains is not an integer of at least two, or exceeds the maximum
 * allowed chain count, or if options.seeds is provided and its length does not equal options.chains.
 */
export default function runChains (logDensity, config = {}, options = {}) {
  const {
    chains = 2,
    warmUpBatches = 100,
    sampleSize = 1000,
    seeds,
    maxLength
  } = options

  _validateChains(chains)
  _validateSeeds(seeds, chains)

  const resolvedSeeds = seeds || Array.from({ length: chains }, (_, i) => i + 1)

  const samples = resolvedSeeds.map(seed => {
    const sampler = new RWM(logDensity, config).seed(seed)
    sampler.warmUp(null, warmUpBatches)
    return sampler.sample(null, sampleSize)
  })

  return { samples, rhat: gelmanRubin(samples, maxLength) }
}

// Unlike warmUp()/sample()'s own maxBatches/size (unbounded by design — a caller-controlled
// compute-time tradeoff, not a crash risk), chains multiplies the per-instance accumulator
// footprint that MCMC._validateCombinedFootprint() already bounds per chain — an unbounded
// chain count reintroduces the same unbounded-memory risk one instance at a time. Same
// order-of-magnitude cap as MCMC._MAX_DIM/_MAX_LAG for consistency.
// See solutions/testing/2026-07-14-1218-runchains-unbounded-chains-runaway-redtest.md
function _validateChains (chains) {
  if (!Number.isInteger(chains) || chains < 2) {
    throw Error('runChains requires at least two chains')
  }
  if (chains > _MAX_CHAINS) {
    throw Error(`runChains: chains must be at most ${_MAX_CHAINS}`)
  }
}

// seeds.length silently diverging from chains would otherwise let RWM's .map() run fewer
// chains than requested with no signal — see the solution doc linked above.
function _validateSeeds (seeds, chains) {
  if (seeds !== undefined && seeds.length !== chains) {
    throw Error('runChains: seeds.length must equal chains')
  }
}
