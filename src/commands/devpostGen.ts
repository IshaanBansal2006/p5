import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, getDefaultConfig } from '../core/config.js';
import { generateDevpost } from '../core/devpost.js';

export async function cmdDevpostGen(): Promise<void> {
  const spinner = ora('Generating Devpost...').start();
  
  try {
    const projectRoot = process.cwd();
    const config = loadConfig(projectRoot) || getDefaultConfig();
    
    await generateDevpost(projectRoot, config);
    
    spinner.succeed('Devpost generated successfully!');
    
  } catch (error) {
    spinner.fail('Failed to generate Devpost');
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}
