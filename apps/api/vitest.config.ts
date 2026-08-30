import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Ne pas ramasser les tests compilés par tsc dans dist/
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Charge les variables d'env de test avant les suites.
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-minimum-32-chars-xxxxxxxx',
      CORS_ORIGIN: 'http://localhost:5174',
      // DATABASE_URL non défini : les tests qui en ont besoin mockent @/db.
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
