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

function extractLinkText (node, location) {
  const re = /\[(.*?)\]/
  const match = re.exec(node.value)
  if (!match) {
    // documentation.js only strips `[text]` off the preceding node for
    // `[text]{@link Symbol}`; a bare `{@link Symbol}` (or a `` `code` ``
    // span sitting directly in front of the link) leaves no brackets to
    // find, so failing loudly here beats a null-dereference deep in the
    // AST walk (see #980).
    const where = location && location.file
      ? ` at ${location.file}${location.line != null ? `:${location.line}` : ''}`
      : ''
    throw new Error(`Error processing docs/src/desc-parser.js: Bare {@link} not supported${where}`)
  }
  return match[1]
}

function removeLinkText (node, text) {
  return node.value.replace(`[${text}]`, '')
    .replace('{@link', '')
}

function extractLinkURL (node) {
  return node.url.replace('}', '')
}

const assembleLinks = (children, location) => {
  for (let i = 0; i < children.length; i++) {
    if (children[i + 1] && children[i + 1].type === 'link') {
      const linkText = extractLinkText(children[i], location)
      const context = removeLinkText(children[i], linkText)
      const linkUrl = extractLinkURL(children[i + 1])
      children[i].value = `${context} <a href='${linkUrl}' target='_blank'>${linkText}</a>`
      delete children[i + 1]
      // Consumed (i, i+1); the loop's own i++ covers one step, so advance by
      // 1 more to land on i+2 — the start of the next unconsumed pair — not
      // i+3 (#997: the extra +1 here previously skipped that pair entirely).
      // See solutions/tooling/2026-07-18-1806-desc-parser-double-increment-skip.md
      i += 1
    }
  }
  return children
}

const simplify = str => str.replace(/\s+/g, ' ')

const renderNode = (node, location) => {
  if (Array.isArray(node.children)) {
    return assembleLinks(node.children, location).map(child => renderNode(child, location)).join('')
  }
  return node.value || ''
}

module.exports = (obj, location) => {
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
    .map(p => `<p>${simplify(renderNode(p, location)).trim()}</p>`)

  // Fallback for descriptions with no paragraph nodes (rare — e.g. a
  // single bare text root): render the whole subtree inline.
  if (paragraphs.length === 0) {
    return simplify(renderNode(root, location)).trim()
  }
  return paragraphs.join('')
}
