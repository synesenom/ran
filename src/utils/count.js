export default function (values) {
  return values.reduce((acc, d) => Object.assign(acc, { [d]: (acc[d] || 0) + 1 }), {})
}
