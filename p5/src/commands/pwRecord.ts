import chalk from 'chalk';
import ora from 'ora';
import { openPlaywrightRecorder, ensurePlaywrightInstalled, installPlaywright } from '../core/playwright.js';

export async function cmdPwRecord(): Promise<void> {
  const spinner = ora('Preparing Playwright recorder...').start();
  
  try {
    // Check if Playwright is installed
    if (!(await ensurePlaywrightInstalled())) {
      spinner.text = 'Installing Playwright...';
      const installed = await installPlaywright();
      if (!installed) {
        spinner.fail('Failed to install Playwright');
        process.exit(1);
      }
    }
    
    spinner.succeed('Playwright ready!');
    
    // Open the recorder
    await openPlaywrightRecorder();
    
  } catch (error) {
    spinner.fail('Failed to open Playwright recorder');
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}
