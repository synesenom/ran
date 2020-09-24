//import AutoCorrelation from './auto-correlation'

export default class {
  constructor (logDensity, config = {}, initialState = {}) {
    // Logarithmic probability density.
    this.lnp = logDensity

    // Dimension of the state.
    this.dim = config.dim || 1

    // Maximum length of the history to store.
    this.maxHistory = config.maxHistory || 1e4

    // Constraints
    // TODO Add constraints to _iter
    this.constraints = config.constraints

    // Current state
    this.x = initialState.x || Array.from({ length: this.dim }, Math.random)

    // Sampling rate during sampling
    this.samplingRate = initialState.samplingRate || 1

    // Any internal variables
    this.internal = initialState.internal || {}

    // Acceptance
    //this.acceptance = new AcceptanceRate(1000)
  }

  _iter () {
    throw Error('_iterate() is not implemented')
  }

  _adjust () {
    throw Error('_adjust() is not implemented')
  }

  state () {
    return {
      x: this.x,
      samplingRate: this.samplingRate,
      internal: this.internal
    }
  }

  warmUp (options, onProgress) {
    const numBatches = options.numBatches || 100
    const iterPerBatch = options.iterPerBatch || 1e4
    //const autoCorrelation = new AutoCorrelation(iterPerBatch, 100)

    // Run batches
    for (let batch = 0; batch < numBatches; batch++) {
      //autoCorrelation.reset()
      for (let iteration = 0; iteration < iterPerBatch; iteration++) {
        // Get new state
        const i = this._iter(this.x, true)
        this.x = i.x

        // Update accumulators
        //autoCorrelation.update(i.x)
        this.acceptance.update(i.accepted)

        // Adjust internal parameters
        this._adjust(i)
      }

      // Compute auto-correlation
      /*const z = autoCorrelation.compute().reduce((first, d) => {
        for (let i = 0; i < d.length - 1; i++) {
          if (Math.abs(d[i]) <= 0.05) {
            return Math.max(first, i)
          }
        }
      }, 0)
       */

      // Change sampling rate based on auto-correlation
      if (z > this.samplingRate) {
        this.samplingRate++
      } else if (z < this.samplingRate && this.samplingRate > 1) {
        this.samplingRate--
      }

      // Call optional onProgress
      onProgress && onProgress(batch)
    }
  }

  sample (options, onProgress) {
    // Sampling parameters
    const sampleSize = options.sampleSize || 1000
    const maxIterations = this.samplingRate * sampleSize
    const batchSize = maxIterations / 100

    // Start sampling
    const samples = []
    for (let i = 0; i < maxIterations; i++) {
      // Get new state
      const i = this._iter(this.x)
      this.x = i.x

      // Adjust occasionally, also send progress status
      if (i % batchSize === 0) {
        onProgress && onProgress(i / batchSize)
      }

      // Collect sample
      if (i % this.samplingRate === 0) {
        samples.push(this.x)
      }
    }

    return samples
  }
}
