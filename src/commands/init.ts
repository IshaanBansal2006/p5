import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import { P5Config, getDefaultConfig, saveConfig } from '../core/config.js';
import { isGitRepository, initGitRepository } from '../core/git.js';
import { createGitHubWorkflow, createHuskyHooks, ensureHuskyInstalled, installHusky } from '../core/ci.js';
import { createPlaywrightConfig, createSmokeTest } from '../core/playwright.js';
import { syncReadme } from '../core/readme.js';
import { runCommand } from '../core/shell.js';

export async function cmdInit(): Promise<void> {
  const spinner = ora('Initializing P5 project...').start();
  
  try {
    const projectRoot = process.cwd();
    
    // Check if we're in a git repository
    if (!(await isGitRepository())) {
      spinner.text = 'Initializing git repository...';
      await initGitRepository();
    }
    
    // Load or create config
    spinner.text = 'Setting up configuration...';
    let config = getDefaultConfig();
    
    // Prompt for project details
    const responses = await prompts([
      {
        type: 'text',
        name: 'name',
        message: 'Project name:',
        initial: config.project.name
      },
      {
        type: 'text',
        name: 'tagline',
        message: 'Project tagline (optional):',
        initial: config.project.tagline
      },
      {
        type: 'text',
        name: 'repo',
        message: 'GitHub repository (owner/repo, optional):',
        initial: config.project.repo
      },
      {
        type: 'text',
        name: 'demoUrl',
        message: 'Demo URL (optional):',
        initial: config.project.demoUrl
      }
    ]);
    
    config.project = { ...config.project, ...responses };
    saveConfig(projectRoot, config);
    
    // Install husky if needed
    spinner.text = 'Setting up git hooks...';
    if (!(await ensureHuskyInstalled(projectRoot))) {
      await installHusky(projectRoot);
    }
    await createHuskyHooks(projectRoot);
    
    // Create GitHub workflow
    spinner.text = 'Creating GitHub workflow...';
    createGitHubWorkflow(projectRoot);
    
    // Set up Playwright
    spinner.text = 'Setting up Playwright...';
    createPlaywrightConfig(projectRoot);
    createSmokeTest(projectRoot);
    
    // Install Playwright if not present
    const { ensurePlaywrightInstalled, installPlaywright } = await import('../core/playwright.js');
    if (!(await ensurePlaywrightInstalled())) {
      await installPlaywright();
    }
    
    // Add npm scripts to package.json
    spinner.text = 'Adding npm scripts...';
    await addNpmScripts(projectRoot);
    
    // Sync README
    spinner.text = 'Syncing README...';
    await syncReadme(projectRoot, config);
    
    spinner.succeed('P5 project initialized successfully!');
    
    console.log(chalk.green('\n🎉 Your project is ready!'));
    console.log(chalk.blue('\nNext steps:'));
    console.log('  npx p5 test          # Run tests');
    console.log('  npx p5 readme sync   # Update README');
    console.log('  npx p5 devpost gen   # Generate Devpost');
    console.log('  npx p5 pw:record     # Record Playwright tests');
    
  } catch (error) {
    spinner.fail('Failed to initialize project');
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}

async function addNpmScripts(projectRoot: string): Promise<void> {
  const packageJsonPath = join(projectRoot, 'package.json');
  
  if (!existsSync(packageJsonPath)) {
    console.log(chalk.yellow('⚠️  No package.json found, skipping script addition'));
    return;
  }
  
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    
    const scripts = {
      'p5:test': 'p5 test',
      'p5:readme': 'p5 readme sync',
      'p5:devpost': 'p5 devpost gen'
    };
    
    let added = false;
    for (const [key, value] of Object.entries(scripts)) {
      if (!packageJson.scripts[key]) {
        packageJson.scripts[key] = value;
        added = true;
      }
    }
    
    if (added) {
      writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log(chalk.green('✅ Added P5 scripts to package.json'));
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️  Could not update package.json scripts'));
  }
}
