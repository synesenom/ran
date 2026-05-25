// Renders a documentation.js description AST into HTML.
//
// Markdown descriptions in the source JSDoc carry paragraph breaks (blank
// lines between blocks like prose → formula → prose), but the old parser
// flattened the whole tree into a single inline string, which both
// collapsed paragraphs visually and stripped breathing room around
// standalone math. We now emit one <p> per markdown paragraph and let
// the page CSS handle spacing. {@link …} fragments (which arrive in the
// AST as adjacent [text, link] pairs) are stitched back into a single
// <a> per pair via assembleLinks.

function extractLinkText (node) {
  const re = /\[(.*?)\]/
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

const renderNode = node => {
  if (Array.isArray(node.children)) {
    return assembleLinks(node.children).map(renderNode).join('')
  }
  return node.value || ''
}

module.exports = obj => {
  const root = obj.description
  if (!root || !Array.isArray(root.children)) {
    return ''
  }
  // Each top-level child of a markdown description is typically a
  // paragraph node. Wrap each in <p> so multi-paragraph descriptions
  // ("Generator for X:" → "$f(...)$" → "with μ ∈ ℝ …") keep their
  // semantic breaks; this is what gives standalone formulas vertical
  // breathing room in the rendered card.
  const paragraphs = root.children
    .filter(c => c.type === 'paragraph')
    .map(p => `<p>${simplify(renderNode(p)).trim()}</p>`)

  // Fallback for descriptions with no paragraph nodes (rare — e.g. a
  // single bare text root): render the whole subtree inline.
  if (paragraphs.length === 0) {
    return simplify(renderNode(root)).trim()
  }
  return paragraphs.join('')
}
