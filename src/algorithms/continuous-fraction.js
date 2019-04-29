export default class {
  constructor (x0, updater, a, b) {
    this.x = x0
    this.updater = updater
    this.aj = a
    this.bj = b

    // Init method variables
    this.a = 0
    this.b = b(x0)
    this.delta = 1
  }
}