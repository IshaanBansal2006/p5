import chalk from 'chalk';
import ora from 'ora';
import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { platform } from 'os';

interface TaskResult {
  name: string;
  success: boolean;
  output: string;
  error?: string;
  duration: number;
}

interface TestConfig {
  preCommit: string[];
  prePush: string[];
}

// Default configuration
const DEFAULT_CONFIG: TestConfig = {
  preCommit: ['lint', 'typecheck'],
  prePush: ['lint', 'typecheck', 'build', 'website']
};

// Check if a package is installed locally
function packageExists(packageName: string): boolean {
  const packageJsonPath = join(process.cwd(), 'package.json');
  if (!existsSync(packageJsonPath)) return false;
  
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    return !!deps[packageName];
  } catch {
    return false;
  }
}

// Find Chrome executable on the system
async function findChrome(): Promise<string> {
  const currentPlatform = platform();
  
  let possiblePaths: string[] = [];
  
  switch (currentPlatform) {
    case 'darwin': // macOS
      possiblePaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'
      ];
      break;
    case 'win32': // Windows
      possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Chromium\\Application\\chrome.exe'
      ];
      break;
    case 'linux': // Linux
      possiblePaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium'
      ];
      break;
    default:
      possiblePaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser'
      ];
  }
  
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }
  
  // If no Chrome found, throw an error with helpful message
  throw new Error(`Chrome not found on ${currentPlatform}. Please install Google Chrome or Chromium.`);
}

// Run command with output capture and timeout
async function runCommand(command: string, args: string[], timeoutMs = 60000): Promise<TaskResult> {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const child = spawn(command, args, { 
      stdio: ['pipe', 'pipe', 'pipe']
      // Removed shell: true to avoid security warning
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    const timeout = setTimeout(() => {
      child.kill();
      resolve({
        name: `${command} ${args.join(' ')}`,
        success: false,
        output: stdout,
        error: 'Command timed out',
        duration: Date.now() - startTime
      });
    }, timeoutMs);
    
    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({
        name: `${command} ${args.join(' ')}`,
        success: code === 0,
        output: stdout,
        error: code !== 0 ? (stderr || stdout) : undefined,
        duration: Date.now() - startTime
      });
    });
    
    child.on('error', (err) => {
      clearTimeout(timeout);
      resolve({
        name: `${command} ${args.join(' ')}`,
        success: false,
        output: stdout,
        error: err.message,
        duration: Date.now() - startTime
      });
    });
  });
}

// Helper to detect common dev server URLs
async function detectServerUrl(): Promise<string | null> {
  const commonUrls = [
    'http://localhost:3000',  // Next.js, React, most common
    'http://localhost:5173',  // Vite
    'http://localhost:8080',  // Vue CLI
    'http://localhost:4200',  // Angular
    'http://localhost:5000',  // Various
    'http://localhost:8000',  // Various
  ];
  
  // Try to detect from package.json scripts
  try {
    const packageJsonPath = join(process.cwd(), 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const startScript = packageJson.scripts?.start || packageJson.scripts?.dev;
      
      if (startScript) {
        // Try to extract port from common patterns
        const portMatch = startScript.match(/--port[=\s]+(\d+)|:(\d+)/);
        if (portMatch) {
          const port = portMatch[1] || portMatch[2];
          return `http://localhost:${port}`;
        }
      }
    }
  } catch {
    // Fallback to common ports
  }
  
  // Test common ports
  for (const url of commonUrls) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        return url;
      }
    } catch {
      // Try next URL
    }
  }
  
  return null;
}

// Website testing with Puppeteer Core
async function runWebsiteTests(): Promise<TaskResult> {
  const startTime = Date.now();
  
  try {
    // Dynamic import to avoid requiring puppeteer-core if not installed
    const puppeteer = await import('puppeteer-core');
    
    // Find Chrome executable
    const chromePath = await findChrome();
    
    const browser = await puppeteer.default.launch({ 
      headless: true,
      executablePath: chromePath,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    const page = await browser.newPage();
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Listen for console errors
    page.on('console', (msg: any) => {
      if (msg.type() === 'error') {
        errors.push(`Console error: ${msg.text()}`);
      }
    });
    
    // Listen for page errors
    page.on('pageerror', (error: Error) => {
      errors.push(`Page error: ${error.message}`);
    });
    
    // Listen for failed requests
    page.on('requestfailed', (request: any) => {
      errors.push(`Failed request: ${request.url()} - ${request.failure()?.errorText}`);
    });
    
    // Detect dev server URL
    const url = await detectServerUrl();
    if (!url) {
      await browser.close();
      return {
        name: 'website',
        success: false,
        output: '',
        error: 'Could not detect development server URL. Make sure your dev server is running.',
        duration: Date.now() - startTime
      };
    }
    
    // Test 1: Basic page load
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });
    } catch (error) {
      errors.push(`Failed to load ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Test 2: Check for critical elements
    const title = await page.title();
    if (!title || title === 'Document') {
      warnings.push('Page has no title or generic title');
    }
    
    // Test 3: Check for broken images
    const brokenImages = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images
        .filter(img => !img.complete || img.naturalWidth === 0)
        .map(img => img.src || img.getAttribute('src') || 'unknown');
    });
    
    if (brokenImages.length > 0) {
      errors.push(`Broken images found: ${brokenImages.join(', ')}`);
    }
    
    // Test 4: Check for basic accessibility
    const missingAltImages = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images.filter(img => !img.alt).length;
    });
    
    if (missingAltImages > 0) {
      warnings.push(`${missingAltImages} images missing alt text`);
    }
    
    // Test 5: Check for JavaScript errors in critical actions
    try {
      // Test clicking primary buttons/links (if any)
      // Original: const clickableElements = await page.$('button, a[href], [role="button"]');
      // **Correction: Use page.$$() to get an array of ElementHandle objects.**
      const clickableElements = await page.$$('button, a[href], [role="button"]');
      
      // The rest of the logic relies on clickableElements being an array.
      if (clickableElements && clickableElements.length > 0) {
        // Just test the first few to avoid long test times
        const maxElements = Math.min(3, clickableElements.length);
        
        for (let i = 0; i < maxElements; i++) {
          try {
            const element = clickableElements[i];
            if (element && typeof element.click === 'function') {
              await element.click();
              // Small delay to catch async errors using setTimeout
              await new Promise<void>(resolve => setTimeout(resolve, 100));
            }
          } catch (clickError) {
            console.log(clickError)
            // Non-critical, just note it
            warnings.push(`Click test failed on element ${i + 1}`);
          }
        }
      }
    } catch (error) {
      console.log(error)
      // Non-critical
      warnings.push('Could not perform interaction tests');
    }
    
    await browser.close();
    
    // Compile results
    const output = [
      `✓ Page loaded: ${url}`,
      title ? `✓ Page title: "${title}"` : '',
      brokenImages.length === 0 ? '✓ All images loaded' : '',
      warnings.length > 0 ? `⚠ ${warnings.length} warnings` : '',
      errors.length === 0 ? '✓ No JavaScript errors detected' : ''
    ].filter(Boolean).join('\n');
    
    const allIssues = [...errors, ...warnings.map(w => `Warning: ${w}`)];
    
    return {
      name: 'website',
      success: errors.length === 0, // Warnings don't fail the test
      output,
      error: errors.length > 0 ? allIssues.join('\n') : undefined,
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Provide helpful error messages
    if (errorMessage.includes('Chrome not found')) {
      return {
        name: 'website',
        success: false,
        output: '',
        error: `${errorMessage}\n\nInstall Chrome from: https://www.google.com/chrome/`,
        duration: Date.now() - startTime
      };
    }
    
    return {
      name: 'website',
      success: false,
      output: '',
      error: `Website test failed: ${errorMessage}`,
      duration: Date.now() - startTime
    };
  }
}

// Task implementations
const TASKS: Record<string, () => Promise<TaskResult>> = {
  lint: async () => {
    if (!packageExists('eslint')) {
      return {
        name: 'lint',
        success: true,
        output: 'Skipped: ESLint not installed',
        duration: 0
      };
    }
    
    return await runCommand('npx', ['eslint', '.', '--max-warnings', '0']);
  },
  
  typecheck: async () => {
    if (!packageExists('typescript')) {
      return {
        name: 'typecheck',
        success: true,
        output: 'Skipped: TypeScript not installed',
        duration: 0
      };
    }
    
    if (!existsSync(join(process.cwd(), 'tsconfig.json'))) {
      return {
        name: 'typecheck',
        success: true,
        output: 'Skipped: No tsconfig.json found',
        duration: 0
      };
    }
    
    return await runCommand('npx', ['tsc', '--noEmit']);
  },
  
  build: async () => {
    const buildCommand = await detectBuildCommand();
    if (!buildCommand) {
      return {
        name: 'build',
        success: true,
        output: 'Skipped: No build script detected',
        duration: 0
      };
    }
    
    return await runCommand(buildCommand.command, buildCommand.args);
  },
  
  test: async () => {
    const packageJsonPath = join(process.cwd(), 'package.json');
    if (!existsSync(packageJsonPath)) {
      return {
        name: 'test',
        success: true,
        output: 'Skipped: No package.json found',
        duration: 0
      };
    }
    
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      if (!packageJson.scripts?.test) {
        return {
          name: 'test',
          success: true,
          output: 'Skipped: No test script found',
          duration: 0
        };
      }
      
      return await runCommand('npm', ['test']);
    } catch {
      return {
        name: 'test',
        success: false,
        output: '',
        error: 'Could not read package.json',
        duration: 0
      };
    }
  },
  
  website: async () => {
    if (!packageExists('puppeteer-core')) {
      return {
        name: 'website',
        success: true,
        output: 'Skipped: Puppeteer Core not installed',
        duration: 0
      };
    }

    return await runWebsiteTests();
  }
};

async function detectBuildCommand(): Promise<{ command: string; args: string[] } | null> {
  const packageJsonPath = join(process.cwd(), 'package.json');
  
  if (!existsSync(packageJsonPath)) {
    return null;
  }
  
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    // Check for build script first
    if (packageJson.scripts?.build) {
      return { command: 'npm', args: ['run', 'build'] };
    }
    
    // Check for framework-specific build commands
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps.next || deps['@next/core']) {
      return { command: 'npx', args: ['next', 'build'] };
    }
    
    if (deps.vite) {
      return { command: 'npx', args: ['vite', 'build'] };
    }
    
    if (deps.nuxt || deps.nuxt3) {
      return { command: 'npx', args: ['nuxt', 'build'] };
    }
    
    if (deps['@sveltejs/kit']) {
      return { command: 'npx', args: ['svelte-kit', 'build'] };
    }
    
    if (deps['react-scripts']) {
      return { command: 'npx', args: ['react-scripts', 'build'] };
    }
    
    if (deps.webpack || deps['webpack-cli']) {
      return { command: 'npx', args: ['webpack', '--mode', 'production'] };
    }
    
  } catch (error) {
    console.log(error)
    console.log(chalk.yellow('Warning: Could not parse package.json'));
  }
  
  return null;
}

// Load configuration (with fallback to defaults)
function loadConfig(): TestConfig {
  const configPath = join(process.cwd(), 'p5.config.json');
  
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      return {
        preCommit: config.tests?.preCommit || DEFAULT_CONFIG.preCommit,
        prePush: config.tests?.prePush || DEFAULT_CONFIG.prePush
      };
    } catch {
      console.log(chalk.yellow('Warning: Could not parse p5.config.json, using defaults'));
    }
  }
  
  return DEFAULT_CONFIG;
}

interface TestArgs {
  stage?: string;
  all?: boolean;
}

export async function cmdTest(args: TestArgs = {}): Promise<void> {
  const spinner = ora('Loading test configuration...').start();
  
  try {
    const config = loadConfig();
    const stage = args.stage;
    const runAll = args.all;
    
    // Determine which tasks to run
    let tasksToRun: string[];
    
    if (runAll) {
      // Run all available tasks
      tasksToRun = Object.keys(TASKS);
    } else if (stage === 'pre-commit') {
      tasksToRun = config.preCommit;
    } else if (stage === 'pre-push') {
      tasksToRun = config.prePush;
    } else if (stage === 'ci') {
      // Run all unique tasks for CI
      tasksToRun = [...new Set([...config.preCommit, ...config.prePush])];
    } else {
      // Default: run pre-push tasks
      tasksToRun = config.prePush;
    }
    
    if (tasksToRun.length === 0) {
      spinner.info('No tasks configured to run');
      return;
    }
    
    spinner.text = `Running ${tasksToRun.length} task(s): ${tasksToRun.join(', ')}`;
    
    const results: TaskResult[] = [];
    const failedTasks: TaskResult[] = [];
    
    // Run each task sequentially
    for (const taskName of tasksToRun) {
      if (TASKS[taskName]) {
        spinner.text = `Running ${taskName}...`;
        const result = await TASKS[taskName]();
        results.push(result);
        
        if (!result.success) {
          failedTasks.push(result);
        }
      } else {
        console.log(chalk.yellow(`\n⚠️  Unknown task: ${taskName}`));
        results.push({
          name: taskName,
          success: false,
          output: '',
          error: 'Unknown task',
          duration: 0
        });
        failedTasks.push(results[results.length - 1]);
      }
    }
    
    spinner.stop();
    
    // Print results
    console.log('\n' + chalk.bold('Test Results:'));
    console.log('─'.repeat(60));
    
    for (const result of results) {
      const status = result.success ? chalk.green('✅') : chalk.red('❌');
      const name = chalk.bold(result.name);
      const duration = chalk.gray(`(${result.duration}ms)`);
      console.log(`${status} ${name} ${duration}`);
      
      if (result.output && result.output.includes('Skipped:')) {
        console.log(chalk.gray(`   ${result.output}`));
      }
      
      if (!result.success && result.error) {
        console.log(chalk.red('   Error:'), result.error.split('\n')[0]);
      }
    }
    
    console.log('─'.repeat(60));
    
    if (failedTasks.length > 0) {
      console.log(chalk.red(`\n❌ ${failedTasks.length} task(s) failed!`));
      
      // Show detailed errors for failed tasks
      for (const task of failedTasks) {
        if (task.error && !task.error.includes('Unknown task')) {
          console.log(chalk.red(`\n📋 ${task.name} Details:`));
          console.log(chalk.gray('─'.repeat(50)));
          
          // Parse and format the error output for better readability
          const errorLines = task.error.split('\n').filter(line => line.trim());
          
          for (const line of errorLines.slice(0, 20)) { // Limit to first 20 lines
            if (line.includes('error') || line.includes('Error')) {
              console.log(chalk.red(`  ${line}`));
            } else if (line.includes('warning') || line.includes('Warning')) {
              console.log(chalk.yellow(`  ${line}`));
            } else if (line.match(/^\s*at\s+/) || line.includes(':')) {
              // Stack trace or file location
              console.log(chalk.blue(`  ${line}`));
            } else {
              console.log(chalk.gray(`  ${line}`));
            }
          }
          
          if (errorLines.length > 20) {
            console.log(chalk.gray(`  ... and ${errorLines.length - 20} more lines`));
          }
        }
      }
      
      process.exit(1);
    } else {
      const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
      console.log(chalk.green(`\n✅ All tasks passed! (${totalTime}ms total)`));
    }
    
  } catch (error) {
    spinner.fail('Test execution failed');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(chalk.red('Error:'), errorMessage);
    process.exit(1);
  }
}