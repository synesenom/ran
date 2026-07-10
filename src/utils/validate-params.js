function parseConstraintTokens (constraint) {
  let tokens = constraint.split(/ (<=|>=|!=) /)
  if (tokens.length === 1) {
    tokens = constraint.split(/ ([=<>]) /)
  }
  return tokens
}

function resolveToken (token, params) {
  return Object.prototype.hasOwnProperty.call(params, token) ? params[token] : parseFloat(token)
}

function violatesConstraint (constraint, params) {
  const tokens = parseConstraintTokens(constraint)
  const a = resolveToken(tokens[0], params)
  const b = resolveToken(tokens[2], params)
  switch (tokens[1]) {
    case '<': return a >= b
    case '<=': return a > b
    case '>': return a <= b
    case '>=': return a < b
    case '!=': return a === b
    /* istanbul ignore next */
    default: return false
  }
}

/**
 * Validates a set of named parameters against a list of constraint strings.
 * Throws if any parameter is undefined, null, or NaN, or if any constraint is violated.
 *
 * @param {Object} params Named parameters to validate.
 * @param {string[]} constraints Constraint strings, e.g. ['sigma > 0', 'n >= 1'].
 * @throws {Error} On missing parameters or violated constraints.
 */
export default function validateParams (params, constraints) {
  // decisions/0004-validate-rejects-undefined-and-nan.md — comparison operators against undefined/null/NaN return false, so missing params would otherwise pass silently
  const missing = Object.entries(params)
    .filter(([, v]) => v === undefined || v === null || Number.isNaN(v))
    .map(([name]) => name)
  if (missing.length > 0) {
    throw Error(`Invalid parameters. Required parameters missing or not a number: ${missing.join(', ')}.`)
  }

  const errors = constraints.filter(c => violatesConstraint(c, params))
  if (errors.length > 0) {
    throw Error(`Invalid parameters. Parameters must satisfy the following constraints: ${constraints.join(', ')}. Got: ${Object.entries(params).map(([name, value]) => `${name} = ${value}`).join(', ')}`)
  }
}
