import js from '@eslint/js'
import ts from 'typescript-eslint'
import astro from 'eslint-plugin-astro'

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  ...astro.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // src/data/raw_js_cms.js: artefacto de referencia extraído en F0 (JS de navegador
    // del sitio legado, no es código fuente de la app). Se excluye del lint.
    ignores: ['dist/', '.astro/', 'node_modules/', 'public/', 'src/data/raw_js_cms.js'],
  },
]
