module.exports = config => {
  return (
    config || {
      preset: 'ts-jest',
      rootDir: './tests',
      maxWorkers: 1,
      globals: {
        'ts-jest': {
          // to give support to const enum. Not working, conflicting with module resolution
          useExperimentalLanguageServer: true,
        },
      },
    }
  );
};
