const path = require('path')
const libraryName = 'ran'
const outputDir = 'dist'

const browserConfig = {
  target: 'web',
  mode: 'production',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, outputDir),
    filename: `${libraryName}.min.js`,
    library: libraryName
  }
}

const nodeConfig = {
  target: 'node',
  mode: 'production',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, outputDir),
    filename: `${libraryName}.node.min.js`,
    library: libraryName,
    libraryTarget: 'umd'
  }/* ,
  module: {
    rules: [
      {
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['babel-preset-es2015']
          }
        }
      }
    ]
  } */
}

module.exports = [ browserConfig, nodeConfig ]
