/**
 * Modul yang diuji (analytics/ dan lib/format) murni TypeScript tanpa impor
 * React Native, jadi cukup transform Babel biasa di lingkungan Node —
 * jauh lebih ringan dan stabil daripada preset React Native penuh.
 */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\.tsx?$': [
      'babel-jest',
      {
        babelrc: false,
        configFile: false,
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          '@babel/preset-typescript',
        ],
      },
    ],
  },
  // Alias "@/..." harus dikenali Jest juga, bukan cuma TypeScript & Metro.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/src/**/*.test.ts'],
};
