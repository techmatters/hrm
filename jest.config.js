// For rapidly running non flex UI dependent tests locally
const { defaults } = require('jest-config');

module.exports = config => {
  return (
    config || {
      ...defaults,
      rootDir: '.',
      modulePathIgnorePatterns: ['dist'],
      maxWorkers: 1,
    }
  );
};
