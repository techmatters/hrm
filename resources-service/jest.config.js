module.exports = config => {
  return (
    config || {
      preset: 'ts-jest',
      rootDir: './tests',
      maxWorkers: 1,
    }
  );
};
