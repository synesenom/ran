// See decisions/0006-jsdoc-enforcement-tooling.md — separate config keeps JSDoc enforcement
// isolated from the editor-hint .eslintrc.js and Standard.js toolchain.
module.exports = {
  env: {
    es6: true,
    node: true
  },
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'module'
  },
  plugins: ['jsdoc'],
  settings: {
    jsdoc: {
      // @method is used throughout for documentation.js compatibility; override the plugin's
      // default preference for @function so existing docs tags aren't treated as violations.
      tagNamePreference: {
        // @method is used for documentation.js compatibility; keep it as-is.
        method: 'method'
      }
    }
  },
  rules: {
    // Require JSDoc on the public API surface only.
    // - ExportDefaultDeclaration: most namespace functions (export default function ...)
    // - ExportNamedDeclaration: named exports (export function levene, export const seed)
    // - MethodDefinition: public class methods, excluding _-prefixed private methods and constructors
    'jsdoc/require-jsdoc': ['error', {
      require: {
        FunctionDeclaration: false,
        MethodDefinition: false,
        ArrowFunctionExpression: false,
        FunctionExpression: false
      },
      contexts: [
        'ExportDefaultDeclaration > FunctionDeclaration',
        'ExportNamedDeclaration > FunctionDeclaration',
        'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
        'MethodDefinition:not([key.name=/^_/]):not([kind=constructor])'
      ],
      checkConstructors: false
    }],
    'jsdoc/check-param-names': 'error',
    'jsdoc/check-tag-names': ['error', {
      // @return is deprecated in JSDoc3; enforce @returns
      definedTags: []
    }],
    'jsdoc/require-param': 'error',
    'jsdoc/require-returns': 'error'
  }
}
