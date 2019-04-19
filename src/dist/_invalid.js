import Distribution from './_distribution'

/**
 * Generator of an invalid (not implemented) distribution. Only for testing purposes.
 *
 * @class InvalidDiscrete
 * @memberOf ran.dist
 * @private
 */
export default class extends Distribution {
  constructor () {
    super('discrete', arguments.length)
    this.s = [{
      value: -Infinity,
      closed: false
    }, {
      value: Infinity,
      closed: false
    }]
  }
}
