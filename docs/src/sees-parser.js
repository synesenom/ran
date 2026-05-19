// Converts a single entry from entry.sees into an HTML anchor or plain text.
// Each @see item is an AST paragraph whose children are link nodes and text nodes.
// For URL @see: <a href="url">label</a> where label is trailing text if present, else the URL.
// For plain-text @see: the text itself.
module.exports = function (see) {
  const children = see.description.children[0] ? see.description.children[0].children : []
  const linkNode = children.find(c => c.type === 'link')
  const trailingText = children
    .filter(c => c.type === 'text')
    .map(c => c.value.trim())
    .join('')
    .trim()

  if (linkNode) {
    const url = linkNode.url
    const label = trailingText || linkNode.children.map(c => c.value).join('')
    return `<a href="${url}" target="_blank">${label}</a>`
  }

  return trailingText
}
