import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    testTimeout: 30000,
    typecheck: {
      tsconfig: 'tests/unit/tsconfig.json',
    },
  },
});
