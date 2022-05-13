const { defaults } = require('jest-config');

module.exports = config => {
  return (
    config || {
      ...defaults,
      rootDir: '.',
      modulePathIgnorePatterns: ['dist'],
      maxWorkers: 1,
      setupFiles: ['<rootDir>/setTestEnvVars.js'],
    }
  );
};
