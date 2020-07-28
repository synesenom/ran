export default function (values) {
  let min = values[0]
  for (let x of values) {
    min = Math.min(x, min)
  }
  return min
}
