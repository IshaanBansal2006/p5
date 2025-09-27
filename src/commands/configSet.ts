import chalk from 'chalk';
import ora from 'ora';
import { setConfigValue } from '../core/config.js';

export async function cmdConfigSet(key: string, value: string): Promise<void> {
  const spinner = ora(`Setting ${key} = ${value}...`).start();
  
  try {
    const projectRoot = process.cwd();
    const success = setConfigValue(projectRoot, key, value);
    
    if (success) {
      spinner.succeed(`Configuration updated: ${key} = ${value}`);
    } else {
      spinner.fail('Failed to update configuration');
      process.exit(1);
    }
    
  } catch (error) {
    spinner.fail('Failed to set configuration');
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}
