module.exports = config => {
  return (
    config || {
      preset: 'ts-jest',
      rootDir: '.',
      maxWorkers: 1,
      setupFiles: ['<rootDir>/setTestEnvVars.js'],
      globals: {
        'ts-jest': {
          // to give support to const enum. Not working, conflicting with module resolution
          useExperimentalLanguageServer: true,
        },
      },
    }
  );
};
