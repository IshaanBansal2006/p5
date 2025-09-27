import { runCommand } from './shell.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

export async function openPlaywrightRecorder(baseUrl?: string): Promise<void> {
  const url = baseUrl || process.env.P5_BASE_URL || 'http://localhost:3000';
  
  console.log(chalk.blue(`🎭 Opening Playwright recorder for ${url}`));
  console.log(chalk.yellow('💡 Tip: Record your interactions, then save the test when done'));
  
  const result = await runCommand('npx', ['playwright', 'codegen', url]);
  
  if (!result.success) {
    console.log(chalk.red('❌ Failed to open Playwright recorder'));
    console.log(chalk.yellow('Make sure Playwright is installed: npx playwright install'));
    return;
  }
  
  console.log(chalk.green('✅ Playwright recorder session completed'));
}

export async function saveRecordedTest(
  projectRoot: string,
  testContent: string,
  filename: string = 'recorded.spec.ts'
): Promise<void> {
  const testDir = join(projectRoot, 'tests', 'e2e');
  const testPath = join(testDir, filename);
  
  // Ensure test directory exists
  if (!existsSync(testDir)) {
    await runCommand('mkdir', ['-p', testDir]);
  }
  
  // Normalize the test content
  const normalizedContent = normalizeTestContent(testContent);
  
  writeFileSync(testPath, normalizedContent);
  console.log(chalk.green(`✅ Test saved to ${testPath}`));
}

function normalizeTestContent(content: string): string {
  // Ensure the test has proper imports
  if (!content.includes("import { test, expect }")) {
    content = `import { test, expect } from '@playwright/test';\n\n${content}`;
  }
  
  // Wrap in smoke describe if not already wrapped
  if (!content.includes("test.describe('smoke'")) {
    content = content.replace(
      /import { test, expect } from '@playwright\/test';\n\n/,
      `import { test, expect } from '@playwright/test';\n\ntest.describe('smoke', () => {\n`
    );
    content += '\n});';
  }
  
  // Remove flaky waits and add proper waits
  content = content.replace(/page\.waitForTimeout\(\d+\)/g, 'await page.waitForLoadState("networkidle")');
  
  // Add proper test titles if missing
  if (!content.includes("test('")) {
    content = content.replace(
      /test\(/g,
      "test('recorded test', async ({ page }) => {"
    );
  }
  
  return content;
}

export async function ensurePlaywrightInstalled(): Promise<boolean> {
  const result = await runCommand('npx', ['playwright', '--version']);
  return result.success;
}

export async function installPlaywright(): Promise<boolean> {
  console.log(chalk.blue('📦 Installing Playwright...'));
  const result = await runCommand('npx', ['playwright', 'install', '--with-deps']);
  return result.success;
}

export function createPlaywrightConfig(projectRoot: string): void {
  const configPath = join(projectRoot, 'playwright.config.ts');
  
  if (existsSync(configPath)) {
    console.log(chalk.blue('ℹ️  Playwright config already exists'));
    return;
  }
  
  const configContent = `import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  reporter: [['list']],
  use: { 
    headless: true, 
    baseURL: process.env.P5_BASE_URL || 'http://localhost:3000' 
  }
});
`;

  writeFileSync(configPath, configContent);
  console.log(chalk.green('✅ Playwright config created'));
}

export function createSmokeTest(projectRoot: string): void {
  const testDir = join(projectRoot, 'tests', 'e2e');
  const testPath = join(testDir, 'smoke.spec.ts');
  
  if (existsSync(testPath)) {
    console.log(chalk.blue('ℹ️  Smoke test already exists'));
    return;
  }
  
  // Ensure test directory exists
  if (!existsSync(testDir)) {
    runCommand('mkdir', ['-p', testDir]);
  }
  
  const testContent = `import { test, expect } from '@playwright/test';

test.describe('smoke', () => {
  test('homepage renders', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);
  });
});
`;

  writeFileSync(testPath, testContent);
  console.log(chalk.green('✅ Smoke test created'));
}
