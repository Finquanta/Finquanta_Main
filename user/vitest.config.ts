import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Component tests for the parts of the dashboard whose behaviour cannot be
 * proved by reading them.
 *
 * The app had no frontend test setup at all, which is why the confirmation
 * dialogs — the things standing in front of every destructive action in the
 * product — could only be checked by clicking. Some of what they do is
 * genuinely hard to click: an action that fails midway, a dialog that hands
 * over to a second question, a backdrop clicked while a delete is in flight.
 *
 * No `@vitejs/plugin-react`: it exists for Fast Refresh, which tests do not use,
 * and its current major expects a newer Vite than vitest resolves. esbuild's
 * automatic JSX runtime is all these need, and it is one less version to keep
 * in step.
 *
 * Next's own build is not involved: these render components directly with
 * Testing Library, so there is no dev server, no database and no network.
 */
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**'],
  },
});
