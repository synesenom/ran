const documentation = require('documentation');
const pug = require('pug');
const fs = require('fs');
const getDesc = require('./dfs');
const ParamParser = require('./param-parser');
const TypeParser = require('./type-parser');


function parseEntry (entry) {
  const name = entry.name
  const params = entry.params.map(ParamParser)
  console.log(`${entry.memberof}.${name}`.slice(4))

  return {
    name,
    index: `${entry.memberof}.${name}`.slice(4).replace('.', '-'),
    path: entry.memberof,
    signature: `${name}(${params.map((d, i) => `${d.optional ? '[' : ''}${i > 0 ? ', ' : ''}${d.name}`)
      .join('')}${params.filter(d => d.optional).map(() => ']').join('')})`,
    desc: getDesc(entry),
    params: params.length > 0 ? params : undefined,
    returns: (() => {
      let ret = entry.returns[0]
      return ret && {
        desc: getDesc(ret),
        type: TypeParser(ret.type)
      }
    })(),
    examples: entry.examples.length > 0 ? entry.examples[0].description : undefined
  }
}


// TODO Fix broken math in descriptions.
// TODO Fix order ot entries in dist.
(async () => {
  // Start from index.js
  const root = await documentation.build([
    './src/index.js',
    './src/dispersion.js',
    './src/dist.js',
    './src/la.js',
    './src/shape.js'
  ], {});

  // Build documentation.
  const docs = root[0].members.static.sort((a, b) => a.name.localeCompare(b.name))
    .map(m => ({
      name: m.name,
      members: m.members.static.sort((a, b) => a.name.localeCompare(b.name))
        .map(entry => {
          // First level member.
          let items = [parseEntry(entry)]

          // Member's children.
          if (entry.members.static.length > 0) {
            items = items.concat(entry.members.static.map(parseEntry))
          }
          return items
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
  const template = pug.compileFile(`./docs/index.pug`)
  fs.writeFileSync('docs/index.html', template({
    name: 'ranjs',
    menu,
    searchList: JSON.stringify(searchList),
    api
  }));
})()
