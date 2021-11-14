const documentation = require('documentation');
const pug = require('pug');
const sass = require('node-sass');
const fs = require('fs');
const hljs = require('highlight.js/lib/core');
const { mjpage } = require('mathjax-node-page');
const DescParser = require('./src/desc-parser');
const ParamParser = require('./src/param-parser');
const TypeParser = require('./src/type-parser');


// Register highlight languages.
hljs.registerLanguage('bash', require('highlight.js/lib/languages/bash'))
hljs.registerLanguage('xml', require('highlight.js/lib/languages/xml'))
hljs.registerLanguage('javascript', require('highlight.js/lib/languages/javascript'))


// Prioritized entries.
const PRIORITY = {
  dist: [
    'Distribution'
  ]
}


const comparator = (a, b) => a.name.localeCompare(b.name)


function getSortedEntries (entries, priority) {
  if (typeof priority === 'undefined') {
    return entries.sort(comparator)
  }
  return entries.filter(d => priority.indexOf(d.name) > -1)
    .sort(comparator)
    .concat(entries.filter(d => priority.indexOf(d.name) === -1)
      .sort(comparator)
    )
}


function parseEntry (entry) {
  const name = entry.name
  const params = entry.params.map(ParamParser)

  return {
    name,
    index: `${entry.memberof}.${name}`.slice(4).replace('.', '-'),
    path: entry.memberof,
    signature: `${entry.memberof}.${name}(${params.map((d, i) => `${d.optional ? '[' : ''}${i > 0 ? ', ' : ''}${d.name}`)
      .join('')}${params.filter(d => d.optional).map(() => ']').join('')})`,
    desc: DescParser(entry),
    params: params.length > 0 ? params : undefined,
    returns: (() => {
      let ret = entry.returns[0]
      return ret && {
        desc: DescParser(ret),
        type: TypeParser(ret.type)
      }
    })(),
    examples: entry.examples.length > 0
      ? hljs.highlight('javascript', entry.examples[0].description).value
      : undefined
  }
}


// TODO Make equations readable by replacing e^{} with exp.
(async () => {
  // Compile style.
  const style = sass.renderSync({
    file: './docs/styles/index.scss',
    outputStyle: 'compressed'
  }).css.toString()

  // Parse documentation strings starting from index.js.
  const root = await documentation.build([
    './src/index.js'
  ], {})

  // Build API documentation.
  const docs = root[0].members.static
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
  const menu = docs.map(({name, members}) => ({
    name,
    members: members.map(({index, name}) => ({index, name}))
  }))

  // Build search list.
  const searchList = menu.reduce((list, section) => list.concat(section.members.map(d => d.index)), [])

  // Build API.
  const api = docs.map(d => d.members).flat()

  // Compile index template.
  const template = pug.compileFile('./docs/templates/index.pug')
  let page = template({
    install: {
      browser: hljs.highlight('xml', `<script type="text/javascript" src="ran.min.js"></script>`)
        .value,
      node: hljs.highlight('bash', 'npm install --save ranjs').value
    },
    demo: 'https://beta.observablehq.com/@synesenom/ranjs-demo',
    gitHubBanner: fs.readFileSync('./docs/templates/github-banner.html', {encoding: 'utf-8'}),
    name: 'ranjs',
    menu,
    searchList: JSON.stringify(searchList),
    api,
    style
  })

  // Pre-render math.
  mjpage(page, {
    format: ['TeX'],
    singleDollars: true,
    displayErrors: true
  }, {
    useGlobalCache: true,
    svg: true
  }, result => {
    // Write final page.
    fs.writeFileSync('./docs/index.html', result)
  })
})()
