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

// Types for error reporting
interface DetailedError {
  taskName: string;
  errorType: 'lint' | 'typecheck' | 'build' | 'test' | 'website' | 'unknown';
  severity: 'error' | 'warning';
  message: string;
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
  timestamp: string;
  duration: number;
  rawOutput?: string;
}

interface RepositoryInfo {
  owner: string;
  repo: string;
  branch?: string;
  commit?: string;
  remoteUrl?: string;
}

interface ErrorCollection {
  sessionId: string;
  repository: RepositoryInfo;
  totalErrors: number;
  totalWarnings: number;
  totalDuration: number;
  stage: string;
  errors: DetailedError[];
  summary: {
    byTask: Record<string, number>;
    byType: Record<string, number>;
  };
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

// Function to extract repository info from git
async function getRepositoryInfo(): Promise<RepositoryInfo> {
  try {
    // Get remote URL
    const remoteResult = await runCommand('git', ['remote', 'get-url', 'origin']);
    let owner = '', repo = '', remoteUrl = '';
    
    if (remoteResult.success && remoteResult.output) {
      remoteUrl = remoteResult.output.trim();
      
      // Parse GitHub URLs (both SSH and HTTPS)
      // SSH: git@github.com:owner/repo.git
      // HTTPS: https://github.com/owner/repo.git
      const sshMatch = remoteUrl.match(/git@github\.com:([^\/]+)\/(.+?)(?:\.git)?$/);
      const httpsMatch = remoteUrl.match(/https:\/\/github\.com\/([^\/]+)\/(.+?)(?:\.git)?$/);
      
      if (sshMatch) {
        [, owner, repo] = sshMatch;
      } else if (httpsMatch) {
        [, owner, repo] = httpsMatch;
      }
    }
    
    // Get current branch
    const branchResult = await runCommand('git', ['branch', '--show-current']);
    const branch = branchResult.success ? branchResult.output.trim() : undefined;
    
    // Get current commit hash
    const commitResult = await runCommand('git', ['rev-parse', 'HEAD']);
    const commit = commitResult.success ? commitResult.output.trim().substring(0, 7) : undefined;
    
    return {
      owner: owner || 'unknown',
      repo: repo || 'unknown', 
      branch,
      commit,
      remoteUrl: remoteUrl || undefined
    };
  } catch (error) {
    console.log('Could not extract git info:', error);
    return {
      owner: 'unknown',
      repo: 'unknown'
    };
  }
}

// Enhanced error parsing functions
function parseDetailedErrors(results: TaskResult[]): DetailedError[] {
  const detailedErrors: DetailedError[] = [];
  
  for (const result of results.filter(r => !r.success && r.error)) {
    const timestamp = new Date().toISOString();
    
    switch (result.name) {
      case 'lint': { // Start a new scope here
        // Parse ESLint output
        const eslintErrors = parseEslintError(result.error!, result, timestamp);
        detailedErrors.push(...eslintErrors);
        break;
      } // End the new scope here
        
      case 'typecheck': { // Start a new scope here
        // Parse TypeScript output 
        const tsErrors = parseTypescriptError(result.error!, result, timestamp);
        detailedErrors.push(...tsErrors);
        break;
      }
        
      case 'build':
      case 'test':
      case 'website':
      default:
        // Generic error parsing
        detailedErrors.push({
          taskName: result.name,
          errorType: (result.name as any) || 'unknown',
          severity: 'error', // Default to error for failed tasks
          message: result.error!,
          timestamp,
          duration: result.duration,
          rawOutput: result.error
        });
    }
  }
  
  return detailedErrors;
}

function parseEslintError(output: string, taskResult: TaskResult, timestamp: string): DetailedError[] {
  const errors: DetailedError[] = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    // ESLint format: /path/to/file.js:line:column: error/warning message
    const match = line.match(/(.+?):(\d+):(\d+):\s+(error|warning)\s+(.+)/);
    if (match) {
      const [, file, lineNum, column, severity, message] = match;
      errors.push({
        taskName: taskResult.name,
        errorType: 'lint',
        severity: severity as 'error' | 'warning',
        message: message.trim(),
        location: {
          file: file.replace(process.cwd(), '.'), // Relative path
          line: parseInt(lineNum),
          column: parseInt(column)
        },
        timestamp,
        duration: taskResult.duration,
        rawOutput: line
      });
    }
  }
  
  // If no specific errors found, create a generic one
  if (errors.length === 0) {
    errors.push({
      taskName: taskResult.name,
      errorType: 'lint',
      severity: 'error',
      message: output.trim() || 'Linting failed',
      timestamp,
      duration: taskResult.duration,
      rawOutput: output
    });
  }
  
  return errors;
}

function parseTypescriptError(output: string, taskResult: TaskResult, timestamp: string): DetailedError[] {
  const errors: DetailedError[] = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    // TypeScript format: src/file.ts(line,column): error TS2304: message
    const match = line.match(/(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+TS\d+:\s*(.+)/);
    if (match) {
      const [, file, lineNum, column, severity, message] = match;
      errors.push({
        taskName: taskResult.name,
        errorType: 'typecheck',
        severity: severity as 'error' | 'warning',
        message: message.trim(),
        location: {
          file: file.replace(process.cwd(), '.'),
          line: parseInt(lineNum),
          column: parseInt(column)
        },
        timestamp,
        duration: taskResult.duration,
        rawOutput: line
      });
    }
  }
  
  // If no specific errors found, create a generic one
  if (errors.length === 0) {
    errors.push({
      taskName: taskResult.name,
      errorType: 'typecheck',
      severity: 'error',
      message: output.trim() || 'Type checking failed',
      timestamp,
      duration: taskResult.duration,
      rawOutput: output
    });
  }
  
  return errors;
}

// Function to send errors to the report API
async function sendErrorsToReport(
  results: TaskResult[], 
  stage: string,
  repository: RepositoryInfo
): Promise<void> {
  try {
    const detailedErrors = parseDetailedErrors(results);
    
    if (detailedErrors.length === 0) {
      return; // No errors to report
    }
    
    const sessionId = `${repository.owner}-${repository.repo}-${Date.now()}`;
    
    // Count errors and warnings
    const totalErrors = detailedErrors.filter(e => e.severity === 'error').length;
    const totalWarnings = detailedErrors.filter(e => e.severity === 'warning').length;
    
    // Create summary statistics
    const byTask: Record<string, number> = {};
    const byType: Record<string, number> = {};
    
    for (const error of detailedErrors) {
      byTask[error.taskName] = (byTask[error.taskName] || 0) + 1;
      byType[error.errorType] = (byType[error.errorType] || 0) + 1;
    }
    
    const errorCollection: ErrorCollection = {
      sessionId,
      repository,
      totalErrors,
      totalWarnings,
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
      stage,
      errors: detailedErrors,
      summary: {
        byTask,
        byType
      }
    };
    
    // Get the API endpoint from environment or use default
    const apiEndpoint = process.env.REPORT_API_URL || 'http://localhost:3000/api/report';
    
    console.log(chalk.blue('\n📤 Sending error data to analysis server...'));
    
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorCollection)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(chalk.green('✅ Error data sent successfully'));
      
      // Display insights from the server
      if (result.insights && result.insights.length > 0) {
        console.log(chalk.cyan('\n🔍 Analysis Insights:'));
        for (const insight of result.insights) {
          console.log(chalk.cyan(`  • ${insight}`));
        }
      }
      
      if (result.suggestions && result.suggestions.length > 0) {
        console.log(chalk.yellow('\n💡 Suggestions:'));
        for (const suggestion of result.suggestions) {
          console.log(chalk.yellow(`  • ${suggestion}`));
        }
      }
      
      // Display priority breakdown if available
      if (result.priority) {
        console.log(chalk.magenta('\n📊 Priority Breakdown:'));
        console.log(chalk.red(`  High: ${result.priority.high}`));
        console.log(chalk.yellow(`  Medium: ${result.priority.medium}`));
        console.log(chalk.green(`  Low: ${result.priority.low}`));
      }
      
    } else {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.log(chalk.red('❌ Failed to send error data:'), errorText);
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red('❌ Error sending data to server:'), errorMessage);
    
    // Don't fail the entire process if reporting fails
    if (process.env.NODE_ENV === 'development') {
      console.log(chalk.gray('  (Error reporting failed, but continuing with tests)'));
    }
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
      const clickableElements = await page.$$('button, a[href], [role="button"]');
      
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
    const stage = args.stage || 'default';
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
      
      // **NEW: Send errors to report API if there are failures**
      try {
        const repository = await getRepositoryInfo();
        
        // Only send to report API if we have valid repository info
        if (repository.owner !== 'unknown' && repository.repo !== 'unknown') {
          await sendErrorsToReport(results, stage, repository);
        } else {
          console.log(chalk.yellow('\n⚠️  Could not determine repository info - skipping error reporting'));
        }
      } catch (reportError) {
        // Don't fail the entire process if error reporting fails
        console.log(chalk.yellow('⚠️  Error reporting failed, but continuing...'));
        if (process.env.NODE_ENV === 'development') {
          console.log(chalk.gray(`   ${reportError instanceof Error ? reportError.message : 'Unknown error'}`));
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