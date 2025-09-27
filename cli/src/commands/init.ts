import { readFileSync, writeFileSync, existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import { getDefaultConfig, saveConfig } from '../core/config.js';
import { isGitRepository, initGitRepository } from '../core/git.js';
import { createGitHubWorkflow, createHuskyHooks, ensureHuskyInstalled, installHusky } from '../core/ci.js';
import { createPlaywrightConfig, createSmokeTest } from '../core/playwright.js';
import { syncReadme } from '../core/readme.js';

// Auto-detect GitHub repository info
async function detectGitHubRepo(projectRoot: string): Promise<{ owner: string; repo: string } | null> {
  try {
    // Method 1: Try to get from git remote
    try {
      const remoteUrl = execSync('git config --get remote.origin.url', { 
        cwd: projectRoot,
        encoding: 'utf8' 
      }).trim();
      
      // Parse various GitHub URL formats
      const githubRegex = /github\.com[\/:]([^\/]+)\/([^\/\.]+)/;
      const match = remoteUrl.match(githubRegex);
      
      if (match) {
        return {
          owner: match[1],
          repo: match[2]
        };
      }
    } catch (gitError) {
      console.log(gitError)
      console.log(chalk.yellow('⚠️  Could not detect from git remote'));
    }

    // Method 2: Try package.json repository field
    try {
      const packageJsonPath = join(projectRoot, 'package.json');
      const packageJson = JSON.parse(await readFileSync(packageJsonPath, 'utf8'));
      
      if (packageJson.repository) {
        const repoUrl = typeof packageJson.repository === 'string' 
          ? packageJson.repository 
          : packageJson.repository.url;
          
        const githubRegex = /github\.com[\/:]([^\/]+)\/([^\/\.]+)/;
        const match = repoUrl.match(githubRegex);
        
        if (match) {
          return {
            owner: match[1],
            repo: match[2]
          };
        }
      }
    } catch (packageError) {
      console.log(packageError)
      console.log(chalk.yellow('⚠️  Could not detect from package.json'));
    }

    return null;
  } catch (error) {
    console.log(error)
    return null;
  }
}

// Call the register API endpoint
async function callRegisterAPI(owner: string, repo: string, serverUrl: string): Promise<void> {
  try {
    const response = await fetch(`${serverUrl}/api/register?owner=${owner}&repo=${repo}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Register API Error ${response.status}: ${errorData.error || response.statusText}`);
    }
    
    const data = await response.json();
    console.log(chalk.green(`✅ Project registered: ${data.message || 'Success'}`));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.yellow(`⚠️  Registration failed: ${errorMessage}`));
    // Don't fail the entire init process for registration issues
  }
}

// Call the readme sync API
async function callReadmeAPI(owner: string, repo: string, serverUrl: string): Promise<void> {
  try {
    const response = await fetch(`${serverUrl}/api/readme?owner=${owner}&repo=${repo}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`README API Error ${response.status}: ${errorData.error || response.statusText}`);
    }
    
    const readmeData = await response.json();
    
    // Write the README file locally
    const readmePath = join(process.cwd(), 'README.md');
    await writeFileSync(readmePath, readmeData.readme, 'utf8');
    
    console.log(chalk.green(`✅ README synced from server`));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.yellow(`⚠️  README sync failed: ${errorMessage}`));
    // Fall back to local README sync if available
  }
}

interface InitArgs {
  server?: string;
}

export async function cmdInit(args: InitArgs = {}): Promise<void> {
  const serverUrl = args.server || 'http://localhost:3000';
  const spinner = ora('Initializing P5 project...').start();
  
  try {
    const projectRoot = process.cwd();
    
    // Check if we're in a git repository
    if (!(await isGitRepository())) {
      spinner.text = 'Initializing git repository...';
      await initGitRepository();
    }
    
    // Auto-detect GitHub repository info
    spinner.text = 'Detecting GitHub repository...';
    const detectedRepo = await detectGitHubRepo(projectRoot);
    
    // Load or create config
    spinner.text = 'Setting up configuration...';
    const config = getDefaultConfig();
    
    // Prompt for project details
    spinner.stop(); // Stop spinner for interactive prompts
    
    const responses = await prompts([
      {
        type: 'text',
        name: 'name',
        message: 'Project name:',
        initial: config.project.name || detectedRepo?.repo
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
        message: 'GitHub repository (owner/repo):',
        initial: config.project.repo || (detectedRepo ? `${detectedRepo.owner}/${detectedRepo.repo}` : ''),
        validate: (value) => {
          if (!value) return 'GitHub repository is required';
          if (!value.includes('/')) return 'Format should be owner/repo';
          return true;
        }
      },
      {
        type: 'text',
        name: 'demoUrl',
        message: 'Demo URL (optional):',
        initial: config.project.demoUrl
      }
    ]);
    
    if (!responses.repo) {
      console.log(chalk.red('❌ GitHub repository is required for initialization'));
      process.exit(1);
    }
    
    const [owner, repo] = responses.repo.split('/');
    
    config.project = { ...config.project, ...responses };
    saveConfig(projectRoot, config);
    
    spinner.start('Installing dependencies...');
    
    // Install husky if needed
    spinner.text = 'Setting up git hooks...';
    if (!(await ensureHuskyInstalled(projectRoot))) {
      await installHusky(projectRoot);
    }
    await createHuskyHooks(projectRoot);
    
    // Create GitHub workflow
    spinner.text = 'Creating GitHub workflow...';
    createGitHubWorkflow(projectRoot);
    
    // Set up Playwright (config only - skip installation)
    spinner.text = 'Setting up Playwright...';
    
    // Ensure the test directory exists first
    const testDir = join(projectRoot, 'tests', 'e2e');
    await mkdir(testDir, { recursive: true });
    
    createPlaywrightConfig(projectRoot);
    createSmokeTest(projectRoot);
    
    // Skip Playwright installation during init - let user install later
    console.log(chalk.yellow('⚠️  Playwright setup complete. Run "npx playwright install" when ready to install browsers.'));
    
    // Add npm scripts to package.json
    spinner.text = 'Adding npm scripts...';
    await addNpmScripts(projectRoot);
    
    // Register project with server
    spinner.text = `Registering project with server...`;
    await callRegisterAPI(owner, repo, serverUrl);
    
    // Sync README using server API
    spinner.text = 'Syncing README from server...';
    await callReadmeAPI(owner, repo, serverUrl);
    
    // Fall back to local README sync if server failed
    if (!existsSync(join(projectRoot, 'README.md'))) {
      spinner.text = 'Creating local README...';
      await syncReadme(projectRoot, config);
    }
    
    spinner.succeed('P5 project initialized successfully!');
    
    console.log(chalk.green('\n🎉 Your project is ready!'));
    console.log(chalk.blue('\nProject Details:'));
    console.log(`  📦 Name: ${responses.name}`);
    console.log(`  🔗 Repository: https://github.com/${owner}/${repo}`);
    if (responses.tagline) console.log(`  💡 Tagline: ${responses.tagline}`);
    if (responses.demoUrl) console.log(`  🌐 Demo: ${responses.demoUrl}`);
    
    console.log(chalk.blue('\nNext steps:'));
    console.log('  npx playwright install   # Install browser binaries');
    console.log('  npx p5 test              # Run tests');
    console.log('  npx p5 readme sync       # Update README');
    console.log('  npx p5 devpost gen       # Generate Devpost');
    console.log('  npx p5 pw:record         # Record Playwright tests');
    
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
      'p5:devpost': 'p5 devpost gen',
      'p5:init': 'p5 init'
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
  } catch (_error) {
    console.log(chalk.yellow('⚠️  Could not update package.json scripts'));
  }
}