//TODO: eslint setup is mostly copied from hrm-services. I had some problems
// with the jest plugin, so I disabled it for now. We should revisit this.
module.exports = {
  extends: ['airbnb-typescript/base', 'plugin:prettier/recommended'],
  plugins: ['prettier', 'import'],
  rules: {
    'prettier/prettier': ['error'],
    'no-console': 'off',
    '@typescript-eslint/indent': 'off',
    '@typescript-eslint/quotes': 'off',
    'import/prefer-default-export': 'off',
  },
  settings: {
    'import/resolver': {
      typescript: {}, // this loads <rootdir>/tsconfig.json to eslint
      node: {
        extensions: ['.js', '.ts'],
      },
    },
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
    ecmaVersion: 2018, // Allows for the parsing of modern ECMAScript features
    sourceType: 'module', // Allows for the use of imports
  },
  ignorePatterns: ['cdk.out/**'],
};
