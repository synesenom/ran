import { terser } from 'rollup-plugin-terser'
import * as meta from "./package.json";

const copyright = `// ${meta.homepage} v${meta.version} Copyright ${(new Date).getFullYear()} ${meta.author.name}`;

export default {
  input: 'src/index.js',
  plugins: [
    terser({output: {preamble: copyright}})
  ],
  output: {
    file: 'dist/ranjs.min.js',
    format: 'umd',
    name: 'ranjs',
    indent: false,
  }
};
