import Normal from './normal'
import Distribution from './_distribution'

export default class extends Normal {
  constructor (alpha = 1) {
    super(0, 1)

    // Validate parameters
    this.p = { alpha }
    Distribution._validate({ alpha }, [
      'alpha > 0'
    ])

    // Set support
    this.s = [{
      value: 0,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }

  _generator () {
    return 1 / (this.p.alpha - super._q())
  }
}