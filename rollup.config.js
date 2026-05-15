import { createRequire } from 'module'
import terser from '@rollup/plugin-terser'
import { nodeResolve } from '@rollup/plugin-node-resolve'

// createRequire lets this ESM config read package.json without a JSON plugin
// See decisions/0001-rollup4-esm-cjs-dual-output.md
const require = createRequire(import.meta.url)
const meta = require('./package.json')

const copyright = `// ${meta.homepage} v${meta.version} Copyright ${(new Date).getFullYear()} ${meta.author.name}`

export default {
  input: 'src/index.js',
  plugins: [nodeResolve()],
  output: [
    {
      file: 'dist/ranjs.esm.js',
      format: 'es',
      banner: copyright
    },
    {
      file: 'dist/ranjs.cjs.js',
      format: 'cjs',
      banner: copyright
    },
    {
      file: 'dist/ranjs.min.js',
      format: 'umd',
      name: 'ranjs',
      plugins: [terser({ output: { preamble: copyright } })]
    }
  ]
}
