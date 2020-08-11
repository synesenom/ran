import sign from '../utils/sign'

export default function (x, y) {
  let n = 0
  for (let i = 1; i < x.length; i++) {
    for (let j = 0; j < i; j++) {
      if (sign(x[i] - x[j]) * sign(y[i] - y[j]) < 0) {
        n++
      }
    }
  }
  return n
}
