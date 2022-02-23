module.exports = {
  extends: [
    "airbnb-base",
    "prettier",
    "plugin:jest/recommended",
    "plugin:jest/style",
  ],
  plugins: ["prettier", "jest"],
  rules: {
    "prettier/prettier": ["error"],
    "no-console": "off",
  },
  env: {
    "jest/globals": true,
  },
  ignorePatterns: ["dist/**"]
};