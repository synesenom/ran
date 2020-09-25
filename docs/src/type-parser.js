const flattenDeep = require('lodash.flattendeep')

module.exports = type => {
  const parseTypeApplication = elem => {
    let type = elem.applications[0].name
    switch (elem.expression.name) {
      case 'Array':
        return type + '[]'
    }
  }

  const parseType = elem => {
    switch(elem.type) {
      case 'OptionalType':
        return parseType(elem.expression)
      case 'NullLiteral':
        return ['null']
      case 'NameExpression':
        return [elem.name]
      case 'TypeApplication':
        return [parseTypeApplication(elem)]
      case 'UndefinedLiteral':
        return ['undefined']
      case 'UnionType':
        return elem.elements.map(parseType)
    }
  }

  return flattenDeep(parseType(type))
}
