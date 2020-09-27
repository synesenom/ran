const documentation = require('documentation');
const pug = require('pug');
const sass = require('node-sass');
const fs = require('fs');
const DescParser = require('./src/desc-parser');
const ParamParser = require('./src/param-parser');
const TypeParser = require('./src/type-parser');


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
    signature: `${name}(${params.map((d, i) => `${d.optional ? '[' : ''}${i > 0 ? ', ' : ''}${d.name}`)
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
    examples: entry.examples.length > 0 ? entry.examples[0].description : undefined
  }
}


// TODO Make equations readable by replacing e^{} with exp.
(async () => {
  // Compile style.
  const style = sass.renderSync({
    file: './docs/styles/index.scss',
    outputStyle: 'compressed'
  }).css.toString()

  // Start from index.js
  const root = await documentation.build([
    './src/index.js'
  ], {})

  // Build documentation.
  const docs = root[0].members.static.sort((a, b) => a.name.localeCompare(b.name))
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
  const template = pug.compileFile(`./docs/templates/index.pug`)
  fs.writeFileSync('./docs/index.html', template({
    gitHubBanner: fs.readFileSync('./docs/templates/github-banner.html', {encoding: 'utf-8'}),
    name: 'ranjs',
    menu,
    searchList: JSON.stringify(searchList),
    api,
    style
  }))
})()
