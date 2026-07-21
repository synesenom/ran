const DescParser = require('./desc-parser')
const TypeParser = require('./type-parser')

// documentation.js nests dotted @param tags (e.g. `@param {Object} options.config`) under the
// parent param's `properties` array rather than returning them as flat top-level params (see
// node_modules/documentation/src/nest.js). Recursing here is what surfaces options-object
// constructors' actual fields (options.logDensity, options.config, ...) in the rendered
// Parameters table instead of silently dropping them behind a single opaque "options: Object" row.
module.exports = function ParamParser (param, location, depth = 0) {
  const isOptional = type => type.type === 'OptionalType' || typeof param.default !== 'undefined'

  const row = {
    // Last path segment only (documentation.js names nested properties by their full dotted
    // path, e.g. "options.config") — depth-based indentation in the template already conveys
    // the nesting, so repeating the parent prefix on every row would be redundant.
    name: param.name.split('.').pop(),
    desc: DescParser(param, location),
    optional: isOptional(param.type),
    default: param.default && param.default.replace('=>', ' => '),
    type: TypeParser(param.type),
    depth
  }

  const children = (param.properties || []).flatMap(child => ParamParser(child, location, depth + 1))

  return [row, ...children]
}
