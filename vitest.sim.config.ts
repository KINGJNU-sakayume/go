import { defineConfig } from 'vitest/config';

// Balance simulations (not part of the normal test run): `npm run sim`
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.sim.test.ts'],
    testTimeout: 600_000,
  },
});
