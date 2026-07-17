const documentation = require('documentation')
const pug = require('pug')
const sass = require('sass')
const fs = require('fs')
const path = require('path')
const hljs = require('highlight.js/lib/core')
const { mjpage } = require('mathjax-node-page')
const DescParser = require('./src/desc-parser')
const ParamParser = require('./src/param-parser')
const TypeParser = require('./src/type-parser')
const ThrowsParser = require('./src/throws-parser')
const SeesParser = require('./src/sees-parser')

const REPO_ROOT = path.resolve(__dirname, '..')
const VERSION = require('../package.json').version

// Register highlight languages.
hljs.registerLanguage('bash', require('highlight.js/lib/languages/bash'))
hljs.registerLanguage('xml', require('highlight.js/lib/languages/xml'))
hljs.registerLanguage('javascript', require('highlight.js/lib/languages/javascript'))

// Prioritized entries.
const PRIORITY = {
  dist: [
    'Distribution'
  ],
  mc: [
    'gelmanRubin',
    'runChains',
    'MCMC'
  ],
  process: [
    'Process'
  ]
}

const comparator = (a, b) => a.name.localeCompare(b.name)

function getSortedEntries (entries, priority) {
  if (typeof priority === 'undefined') {
    return entries.sort(comparator)
  }
  // Priority order is the array's own order (not alphabetical) — e.g. mc's
  // ['gelmanRubin', 'runChains', 'MCMC'] must keep MCMC last even though
  // alphabetical sort ('gelmanRubin' < 'MCMC' < 'runChains') would otherwise
  // put it in the middle.
  return entries.filter(d => priority.indexOf(d.name) > -1)
    .sort((a, b) => priority.indexOf(a.name) - priority.indexOf(b.name))
    .concat(entries.filter(d => priority.indexOf(d.name) === -1)
      .sort(comparator)
    )
}

// Distribution classes carry @param/@throws on the constructor's own JSDoc (the
// post-#306 layout: class block has no @param so tsc can pick the constructor
// signature). documentation.js v14 surfaces that block as entry.constructorComment.
// Fall back to it when the class entry itself has no params/throws, otherwise the
// rendered cards show "Name()" with no Parameters table.
function resolveEntrySource (entry) {
  const ctor = entry.constructorComment
  return {
    params: entry.params.length > 0 ? entry.params : (ctor ? ctor.params : []),
    throws: entry.throws.length > 0 ? entry.throws : (ctor ? ctor.throws : [])
  }
}

function resolveLocation (entry) {
  const ctx = entry.context || {}
  return {
    file: ctx.file ? path.relative(REPO_ROOT, ctx.file).split(path.sep).join('/') : null,
    line: ctx.loc && ctx.loc.start ? ctx.loc.start.line : null
  }
}

function sourceLink (location) {
  return location.file && location.line != null
    ? `https://github.com/synesenom/ran/blob/v${VERSION}/${location.file}#L${location.line}`
    : null
}

function renderSignature (entry, params) {
  const args = params.map((d, i) => `${d.optional ? '[' : ''}${i > 0 ? ', ' : ''}${d.name}`).join('')
  const closers = params.filter(d => d.optional).map(() => ']').join('')
  return `${entry.memberof}.${entry.name}(${args}${closers})`
}

function renderReturns (entry, location) {
  const ret = entry.returns[0]
  return ret && {
    desc: DescParser(ret, location),
    type: TypeParser(ret.type)
  }
}

function parseEntry (entry) {
  const name = entry.name
  const { params: sourceParams, throws: sourceThrows } = resolveEntrySource(entry)
  const location = resolveLocation(entry)
  // entry.params, entry.returns[0] and entry.deprecated don't carry their own context, so
  // every DescParser call is given the enclosing entry's location for error reporting (#980).
  const params = sourceParams.map(p => ParamParser(p, location))
  const throws = sourceThrows.map(ThrowsParser)

  return {
    name,
    index: `${entry.memberof}.${name}`.slice(4).replace('.', '-'),
    path: entry.memberof,
    signature: renderSignature(entry, params),
    desc: DescParser(entry, location),
    source: sourceLink(location),
    params: params.length > 0 ? params : undefined,
    returns: renderReturns(entry, location),
    throws: throws.length > 0 ? throws : undefined,
    examples: entry.examples.length > 0
      ? hljs.highlight(entry.examples[0].description, { language: 'javascript' }).value
      : undefined,
    sees: entry.sees.length > 0 ? entry.sees.map(SeesParser) : undefined,
    deprecated: entry.deprecated ? DescParser({ description: entry.deprecated }, location) : undefined
  }
}

// TODO Make equations readable by replacing e^{} with exp.
(async () => {
  // Compile style to disk so every page links the same external stylesheet.
  console.log('Compiling style')
  const compiledStyle = sass.compile('./docs/styles/index.scss', { style: 'compressed' }).css
  fs.writeFileSync('./docs/styles/style.css', compiledStyle)

  // Parse documentation strings starting from index.js.
  console.log('Parsing docstrings')
  const root = await documentation.build([
    './src/index.js'
  ], {})

  // Build API documentation.
  console.log('Building API content')
  // documentation@v14 returns top-level entries as a flat array; the `ran`
  // module is not guaranteed to be root[0] (orphan classes like
  // Hyperexponential, IrwinHall, NegativeBinomial precede it). Find it by
  // kind+name instead of indexing positionally.
  const moduleEntry = root.find(d => d.kind === 'module' && d.name === 'ran')
  if (!moduleEntry) {
    throw new Error('docs build: could not find `ran` module entry in documentation output')
  }
  const docs = moduleEntry.members.static
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(m => ({
      name: m.name,
      members: getSortedEntries(m.members.static, PRIORITY[m.name])
        .map(entry => {
          // First level member.
          let items = [parseEntry(entry)]

          // Member's children.
          if (entry.members.static.length > 0) {
            items = items.concat(entry.members.static.map(parseEntry))
          }
          return getSortedEntries(items, [entry.name])
        })
        .flat()
    }))

  // Build menu.
  console.log('Building the menu')
  const menu = docs.map(({ name, members }) => ({
    name,
    members: members.map(({ index, name }) => ({ index, name }))
  }))

  // Build search list.
  console.log('Building the search list')
  const searchList = menu.reduce((list, section) => list.concat(section.members.map(d => d.index)), [])

  // Build API.
  const api = docs.map(d => d.members).flat()

  // Page-list-driven build. See decisions/0002-docs-pages-array.md
  // and solutions/tooling/2026-05-16-1135-docs-pages-array-build.md.
  // Adding a page is one entry here + one Pug template that extends _layout.
  const pages = [
    {
      template: './docs/templates/index.pug',
      output: 'index.html',
      navLabel: 'API',
      data: {
        install: {
          browser: hljs.highlight('<script type="text/javascript" src="ran.min.js"></script>', { language: 'xml' })
            .value,
          node: hljs.highlight('npm install --save ranjs', { language: 'bash' }).value
        },
        demo: 'https://beta.observablehq.com/@synesenom/ranjs-demo',
        menu,
        searchList: JSON.stringify(searchList),
        api
      }
    },
    {
      template: './docs/templates/porting-scipy.pug',
      output: 'porting-scipy.html',
      navLabel: 'SciPy Porting',
      data: {}
    },
    {
      template: './docs/templates/parameter-estimation.pug',
      output: 'parameter-estimation.html',
      navLabel: 'Parameter Estimation',
      data: {}
    },
    {
      template: './docs/templates/demo.pug',
      output: 'demo.html',
      navLabel: 'Demo',
      data: {}
    }
  ]

  // Copy the minified bundle into docs/ so GitHub Pages (which deploys only
  // docs/) can serve it — the template references it as ranjs.min.js.
  console.log('Copying ranjs.min.js')
  fs.copyFileSync('./dist/ranjs.min.js', './docs/ranjs.min.js')

  for (const pageDef of pages) {
    console.log(`Rendering ${pageDef.output}`)
    const template = pug.compileFile(pageDef.template)
    const rendered = template({
      name: 'ranjs',
      ...pageDef.data,
      pages,
      currentPage: pageDef.output
    })

    // mjpage is callback-based; wrap so the loop awaits each page. Note:
    // useGlobalCache shares MathJax's SVG glyph cache across this single
    // process invocation — fine while index.html is the only math-bearing
    // page; revisit if a future math-rendering page is added (see #116).
    await new Promise((resolve, reject) => {
      mjpage(rendered, {
        format: ['TeX'],
        singleDollars: true,
        displayErrors: true
      }, {
        useGlobalCache: true,
        svg: true
      }, result => {
        try {
          fs.writeFileSync(`./docs/${pageDef.output}`, result)
          resolve()
        } catch (err) {
          reject(err)
        }
      })
    })
  }
})()
