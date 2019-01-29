import { gammaLn } from '../special'
import Custom from './custom'

export default class extends Custom {
  constructor (N, K, n) {
    let weights = []
    let min = Math.max(0, n + K - N)
    let max = Math.min(n, K)
    for (let k = min; k < max; k++) {
      // Calculate numerator and denominator
      let num1 = gammaLn(K + 1) - gammaLn(k + 1) - gammaLn(K - k + 1)
      let num2 = gammaLn(N - K + 1) - gammaLn(n - k + 1) - gammaLn(N - K - n + k + 1)
      let denom = gammaLn(N + 1) - gammaLn(n + 1) - gammaLn(N - n + 1)

      // Add weight
      weights.push(Math.exp(num1 + num2 - denom))
    }
    super(weights)
  }
}
