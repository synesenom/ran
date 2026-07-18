import { assert } from 'chai'
import { describe, it } from 'mocha'
import DescParser from '../docs/src/desc-parser'

// Minimal mdast fragments shaped like documentation.js's description AST —
// only the fields desc-parser.js actually reads (type, value, url, children).
const text = value => ({ type: 'text', value })
const inlineCode = value => ({ type: 'inlineCode', value })
const jsdocLink = url => ({ type: 'link', url, jsdoc: true, children: [text(url)] })
const paragraph = children => ({ type: 'paragraph', children })
const entry = (...paragraphs) => ({ description: { type: 'root', children: paragraphs } })

describe('docs/desc-parser', () => {
  it('renders a bracketed {@link} as an anchor tag', () => {
    const html = DescParser(entry(paragraph([
      text('Unlike [RWM]'),
      jsdocLink('ran.mc.RWM')
    ])))
    assert.strictEqual(html, "<p>Unlike <a href='ran.mc.RWM' target='_blank'>RWM</a></p>")
  })

  it('converts every {@link} pair in a paragraph, not just the first', () => {
    // Regression test for the assembleLinks() double-increment skip (#997):
    // a paragraph with 3+ alternating (text, link) pairs must have all of
    // them converted, not just the first.
    const html = DescParser(entry(paragraph([
      text('See [A]'),
      jsdocLink('ran.dist.A'),
      text(', [B]'),
      jsdocLink('ran.dist.B'),
      text(' and [C]'),
      jsdocLink('ran.dist.C')
    ])))
    assert.strictEqual(
      html,
      "<p>See <a href='ran.dist.A' target='_blank'>A</a>, <a href='ran.dist.B' target='_blank'>B</a> and <a href='ran.dist.C' target='_blank'>C</a></p>"
    )
  })

  it('throws a localized error instead of crashing on a bare {@link}', () => {
    assert.throws(
      () => DescParser(entry(paragraph([
        text('Unlike'),
        jsdocLink('ran.mc.RWM')
      ])), { file: 'src/mc/adaptive-metropolis.js', line: 14 }),
      /^Error processing docs\/src\/desc-parser\.js: Bare \{@link\} not supported at src\/mc\/adaptive-metropolis\.js:14$/
    )
  })

  it('throws instead of crashing when inline code sits directly in front of a bare {@link}', () => {
    // Reproduces the src/mc/parallel-tempering.js#980 root cause: a `` `code` ``
    // span immediately followed by {@link Symbol} with no [text] wrapper.
    assert.throws(
      () => DescParser(entry(paragraph([
        inlineCode('MCMC'),
        jsdocLink('ran.mc.MCMC')
      ])), { file: 'src/mc/parallel-tempering.js', line: 14 }),
      /Bare \{@link\} not supported at src\/mc\/parallel-tempering\.js:14$/
    )
  })

  it('omits the line number when the location has a file but no line', () => {
    assert.throws(
      () => DescParser(entry(paragraph([
        text('Unlike'),
        jsdocLink('ran.mc.RWM')
      ])), { file: 'src/mc/foo.js', line: null }),
      /Bare \{@link\} not supported at src\/mc\/foo\.js$/
    )
  })

  it('omits the location clause when no location is given', () => {
    assert.throws(
      () => DescParser(entry(paragraph([
        text('Unlike'),
        jsdocLink('ran.mc.RWM')
      ]))),
      /Bare \{@link\} not supported$/
    )
  })
})
