const assembleLinks = children => {
  for (let i = 0; i < children.length; i++) {
    if (children[i].type === 'linkReference') {
      children[i + 1].value = `<a href='${children[i + 1].url}'>${children[i].children[0].value}</a>`
      delete children[i].children
      delete children[i + 1].children
    }
  }
  return children
}

const simplify = str => str.replace(/\s+/g, ' ')

const _dfs = (obj, key, map) => {
  if (Array.isArray(obj.children)) {
    return map(assembleLinks(obj.children).map(d => _dfs(d, key, map)))
  } else {
    return obj[key]
  }
}

module.exports = obj => _dfs(obj.description, 'value', d => simplify(d.join(' ')))
