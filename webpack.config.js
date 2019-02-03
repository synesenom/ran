const path = require('path')
const libraryName = 'ran'
const outputDir = 'dist'

const browserConfig = {
  target: 'web',
  mode: 'production',
  output: {
    path: path.resolve(__dirname, outputDir),
    filename: `${libraryName}.min.js`,
    library: libraryName
  }
}

const nodeConfig = {
  target: 'node',
  mode: 'production',
  output: {
    path: path.resolve(__dirname, outputDir),
    filename: `${libraryName}.node.min.js`,
    library: libraryName
  }
}

module.exports = [ browserConfig, nodeConfig ]
