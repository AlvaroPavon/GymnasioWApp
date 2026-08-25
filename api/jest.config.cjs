module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": ["@swc/jest", {
      jsc: {
        parser: { syntax: "typescript" },
        target: "es2023"
      },
      module: { type: "commonjs" }
    }]
  },
  transformIgnorePatterns: ["<rootDir>/src/generated/prisma/", "/node_modules/(?!expo-server-sdk/)"],
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  testPathIgnorePatterns: ["<rootDir>/dist/"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  testMatch: ["**/tests/**/*.test.ts"],
  clearMocks: true
};
