import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://poc:poc@127.0.0.1:5433/cocos_test?sslmode=disable';
let database: URL;
try {
  database = new URL(databaseUrl);
} catch {
  throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL');
}
if (
  !['postgres:', 'postgresql:'].includes(database.protocol) ||
  !['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) ||
  !database.pathname.endsWith('_test') ||
  ['host', 'port', 'user', 'password', 'database'].some((key) =>
    database.searchParams.has(key),
  )
) {
  throw new Error(
    'E2E requires a local PostgreSQL database with a name ending in _test',
  );
}

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: { NODE_ENV: 'test', DATABASE_URL: databaseUrl },
  },
});
