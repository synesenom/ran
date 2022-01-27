function extractLinkText (node) {
  const re = /\[(.*?)\]/;
  return re.exec(node.value)[1]
}

function removeLinkText (node, text) {
  return node.value.replace(`[${text}]`, '')
    .replace('{@link', '')
}

function extractLinkURL (node) {
  return node.url.replace('}', '')
}

const assembleLinks = children => {
  for (let i = 0; i < children.length; i++) {
    if (children[i + 1] && children[i + 1].type === 'link') {
      const linkText = extractLinkText(children[i])
      const context = removeLinkText(children[i], linkText)
      const linkUrl = extractLinkURL(children[i + 1])
      children[i].value = `${context} <a href='${linkUrl}' target='_blank'>${linkText}</a>`
      delete children[i + 1]
      i += 2
    }
  }
  return children
}

const simplify = str => str.replace(/\s+/g, ' ')

const dfs = (obj, key, map) => {
  if (Array.isArray(obj.children)) {
    return map(assembleLinks(obj.children).map(d => dfs(d, key, map)))
  } else {
    return obj[key]
  }
}

module.exports = obj => dfs(obj.description, 'value', d => simplify(d.join('')))
