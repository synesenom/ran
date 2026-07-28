/**
 * Ordinary least squares fit of y = intercept + slope*x over paired samples. Shared by
 * OrnsteinUhlenbeck.fit() and CoxIngersollRoss.fit() (stage 1 AR(1) regression, and CIR's
 * stage 2 conditional-variance regression), since both reduce to the same y = a + b*x + eps
 * form even though the underlying process being estimated differs.
 *
 * @param {Array} xs Regressor values.
 * @param {Array} ys Response values, same length as xs.
 * @returns {{slope: number, intercept: number}} OLS slope and intercept.
 * @ignore
 */
export default function ols (xs, ys) {
  const n = xs.length
  let sx = 0
  let sy = 0
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < n; i++) {
    sx += xs[i]
    sy += ys[i]
    sxy += xs[i] * ys[i]
    sxx += xs[i] * xs[i]
  }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx)
  const intercept = (sy - slope * sx) / n
  return { slope, intercept }
}
