import gammaLn from './gamma-log'

export default function (x, y) {
  return Math.exp(gammaLn(x) + gammaLn(y) - gammaLn(x + y))
}
