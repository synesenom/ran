export default function (values) {
  let min = values[0]
  for (const x of values) {
    min = Math.min(x, min)
  }
  return min
}
