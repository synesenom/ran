import RWM from './rwm'
import gelmanRubin from './gelman-rubin'

// Same order-of-magnitude cap as MCMC._MAX_DIM/_MAX_LAG (src/mc/_mcmc.js) — chains multiplies
// the per-instance accumulator footprint that bound already guards, one chain at a time.
const _MAX_CHAINS = 10000

/**
 * @overload
 * @param {Function} Sampler An [MCMC]{@link ran.mc.MCMC} subclass (e.g. [RWM]{@link ran.mc.RWM},
 * [AdaptiveMetropolis]{@link ran.mc.AdaptiveMetropolis}, [Slice]{@link ran.mc.Slice},
 * [Gibbs]{@link ran.mc.Gibbs}, [HMC]{@link ran.mc.HMC}, [MALA]{@link ran.mc.MALA}, or
 * [NUTS]{@link ran.mc.NUTS}) to drive each chain.
 * @param {Object} samplerOptions Options object forwarded verbatim to `new Sampler(samplerOptions)`
 * for every chain — the same shape that sampler's own options-object constructor accepts (e.g.
 * `{logDensity, config, initialState}` for RWM/AdaptiveMetropolis/Slice, `{logDensity,
 * gradLogDensity, config, initialState}` for HMC/MALA/NUTS, `{conditionals, config, initialState}`
 * for Gibbs).
 * @param {Object=} runOptions Run configuration. Supported properties:
 * <ul>
 *   <li>{chains}: Number of independent chains to run. Default is 2, minimum 2.</li>
 *   <li>{warmUpBatches}: Number of warm-up batches per chain, forwarded to warmUp(). Default is 100.</li>
 *   <li>{sampleSize}: Number of samples to collect per chain, forwarded to sample(). Default is 1000.</li>
 *   <li>{seeds}: Explicit per-chain seed values. Defaults to [1, 2, ..., chains].</li>
 *   <li>{maxLength}: Maximum number of diagnostic values, forwarded to gelmanRubin().</li>
 * </ul>
 */
/**
 * @overload
 * @param {Function} logDensity The logarithm of the (unnormalized) target density (this positional
 * form is deprecated and RWM-only — see the Sampler-driven overload above).
 * @param {Object=} config RWM configuration, forwarded unchanged to each chain's constructor.
 * @param {Object=} options Run configuration (see `runOptions` in the overload above).
 */
/**
 * Runs multiple independently-seeded [MCMC]{@link ran.mc.MCMC} chains from the same target and
 * computes the [Gelman-Rubin]{@link ran.mc.gelmanRubin} convergence diagnostic across them — the
 * recommended workflow for gating MCMC convergence (decisions/0024-mcmc-warmup-convergence-strategy.md),
 * since no signal computable from a single chain can distinguish "converged" from "stuck".
 * `samplerOptions` is forwarded to `new Sampler(samplerOptions)` without inspecting its keys, so any
 * migrated `MCMC` subclass — including `Gibbs`, whose options object has no `logDensity` at all — can
 * drive the diagnostic the same way (decisions/0033-generalized-runchains-sampler-driver.md).
 *
 * @method runChains
 * @memberof ran.mc
 * @param {Function} Sampler The `MCMC` subclass to drive each chain, or (deprecated positional
 * form) the target log-density for an implicit `RWM` driver — see the two overloads above.
 * @param {Object=} samplerOptions Options forwarded to `new Sampler(samplerOptions)` (or, in the
 * deprecated form, RWM's own `config`).
 * @param {Object=} runOptions Run configuration — see the overloads above.
 * @returns {Object} Object with properties: samples (number[][][], one sample array per chain) and
 * rhat (number[][], the gelmanRubin() diagnostic across the chains).
 * @throws {Error} If runOptions.chains is not an integer of at least two, or exceeds the maximum
 * allowed chain count, or if runOptions.seeds is provided and its length does not equal
 * runOptions.chains.
 */
export default function runChains (Sampler, samplerOptions = {}, runOptions = {}) {
  const resolved = _resolveRunChainsArgs(Sampler, samplerOptions, runOptions)

  const {
    chains = 2,
    warmUpBatches = 100,
    sampleSize = 1000,
    seeds,
    maxLength
  } = resolved.runOptions

  _validateChains(chains)
  _validateSeeds(seeds, chains)

  const resolvedSeeds = seeds || Array.from({ length: chains }, (_, i) => i + 1)

  const samples = resolvedSeeds.map(seed => {
    const sampler = new resolved.Sampler(resolved.samplerOptions).seed(seed)
    sampler.warmUp(null, warmUpBatches)
    return sampler.sample(null, sampleSize)
  })

  return { samples, rhat: gelmanRubin(samples, maxLength) }
}

// Distinguishes the new (Sampler, samplerOptions, runOptions) form from the legacy
// (logDensity, config, options) form. Both a Sampler class and a logDensity function are
// typeof 'function', so the check is structural on _iter — the protected hook every MCMC
// subclass is required to override (MCMC._iter throws 'not implemented' as the base
// behavior) — mirroring MCMC._isOptionsForm/Gibbs._resolveGibbsConstructorArgs's own
// structural-detection idiom rather than importing MCMC for an instanceof check. An arrow
// logDensity has no .prototype at all; a function-expression logDensity has a .prototype but
// no _iter on it; any MCMC subclass (even the abstract MCMC class itself, which fails fast
// with its own "is abstract" error on construction) finds _iter via its prototype chain.
// See decisions/0033-generalized-runchains-sampler-driver.md.
function _isSamplerClass (arg) {
  return typeof arg === 'function' && arg.prototype !== undefined && typeof arg.prototype._iter === 'function'
}

function _resolveRunChainsArgs (samplerOrLogDensity, samplerOptionsOrConfig, runOptionsOrOptions) {
  if (_isSamplerClass(samplerOrLogDensity)) {
    return { Sampler: samplerOrLogDensity, samplerOptions: samplerOptionsOrConfig, runOptions: runOptionsOrOptions }
  }
  // Fired once per call (not once per process) so every legacy call site stays visible across
  // a session, matching the cadence of every other MCMC deprecation warning.
  console.warn('[ranjs] positional runChains(logDensity, config, options) is deprecated and will be removed in v1.32.0; use runChains(Sampler, samplerOptions, runOptions) instead, e.g. runChains(RWM, { logDensity, config }, runOptions).')
  return {
    Sampler: RWM,
    samplerOptions: { logDensity: samplerOrLogDensity, config: samplerOptionsOrConfig },
    runOptions: runOptionsOrOptions
  }
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

// seeds.length silently diverging from chains would otherwise let the sampler's own .map() run
// fewer chains than requested with no signal — see the solution doc linked above.
function _validateSeeds (seeds, chains) {
  if (seeds !== undefined && seeds.length !== chains) {
    throw Error('runChains: seeds.length must equal chains')
  }
}
