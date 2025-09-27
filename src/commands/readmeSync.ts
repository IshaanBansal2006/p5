import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, getDefaultConfig } from '../core/config.js';
import { syncReadme } from '../core/readme.js';

export async function cmdReadmeSync(): Promise<void> {
  const spinner = ora('Syncing README...').start();
  
  try {
    const projectRoot = process.cwd();
    const config = loadConfig(projectRoot) || getDefaultConfig();
    
    await syncReadme(projectRoot, config);
    
    spinner.succeed('README synced successfully!');
    
  } catch (error) {
    spinner.fail('Failed to sync README');
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}
