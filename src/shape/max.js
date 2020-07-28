export default function (values) {
  let max = values[0]
  for (let x of values) {
    max = Math.max(x, max)
  }
  return max
}
