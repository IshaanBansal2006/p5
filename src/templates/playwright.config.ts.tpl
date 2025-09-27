import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  reporter: [['list']],
  use: { 
    headless: true, 
    baseURL: process.env.P5_BASE_URL || 'http://localhost:3000' 
  }
});
