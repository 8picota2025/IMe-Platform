export default {
  plugins: ['prettier-plugin-astro'],
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  trailingComma: 'es5',
  bracketSpacing: true,
  arrowParens: 'avoid',
  endOfLine: 'lf',
  overrides: [
    {
      files: ['*.astro'],
      options: {
        parser: 'astro',
      },
    },
    {
      files: ['*.{json,jsonc}'],
      options: {
        parser: 'json',
      },
    },
    {
      files: ['*.{md,mdx}'],
      options: {
        parser: 'markdown',
        printWidth: 80,
      },
    },
  ],
};