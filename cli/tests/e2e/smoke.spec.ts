import { test, expect } from '@playwright/test';

test.describe('smoke', () => {
  test('homepage renders', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);
  });
});
