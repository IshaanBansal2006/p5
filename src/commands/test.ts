import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, getDefaultConfig } from '../core/config.js';
import { runCommandWithOutput, extractFailingFiles } from '../core/shell.js';
import { findLikelyCulprits } from '../core/git.js';
import { sendNotification } from '../core/notifications.js';
import { TaskResult } from '../types/config.js';

const TASKS: Record<string, () => Promise<TaskResult>> = {
  lint: async () => {
    const result = await runCommandWithOutput('npx', ['eslint', '.']);
    return {
      name: 'lint',
      success: result.success,
      output: result.stdout,
      error: result.stderr,
      failingFiles: result.success ? [] : extractFailingFiles(result.stderr + result.stdout)
    };
  },
  
  typecheck: async () => {
    const result = await runCommandWithOutput('npx', ['tsc', '-p', '.', '--noEmit']);
    return {
      name: 'typecheck',
      success: result.success,
      output: result.stdout,
      error: result.stderr,
      failingFiles: result.success ? [] : extractFailingFiles(result.stderr + result.stdout)
    };
  },
  
  build: async () => {
    const buildCommand = await detectBuildCommand();
    if (!buildCommand) {
      return {
        name: 'build',
        success: true,
        output: 'Skipped: No build script detected',
        failingFiles: []
      };
    }
    
    const result = await runCommandWithOutput(buildCommand[0], buildCommand[1]);
    return {
      name: 'build',
      success: result.success,
      output: result.stdout,
      error: result.stderr,
      failingFiles: result.success ? [] : extractFailingFiles(result.stderr + result.stdout)
    };
  },
  
  'e2e:smoke': async () => {
    const result = await runCommandWithOutput('npx', ['playwright', 'test', '-g', 'smoke']);
    return {
      name: 'e2e:smoke',
      success: result.success,
      output: result.stdout,
      error: result.stderr,
      failingFiles: []
    };
  }
};

export async function cmdTest(stage?: string): Promise<void> {
  const spinner = ora('Running tests...').start();
  
  try {
    const projectRoot = process.cwd();
    const config = loadConfig(projectRoot) || getDefaultConfig();
    
    // Determine which tasks to run based on stage
    let tasksToRun: string[];
    
    if (stage === 'pre-commit') {
      tasksToRun = config.tests.preCommit;
    } else if (stage === 'pre-push') {
      tasksToRun = config.tests.prePush;
    } else if (stage === 'ci') {
      tasksToRun = [...new Set([...config.tests.preCommit, ...config.tests.prePush])];
    } else {
      // Default to pre-push tasks
      tasksToRun = config.tests.prePush;
    }
    
    spinner.text = `Running ${tasksToRun.join(', ')}...`;
    
    const results: TaskResult[] = [];
    const failedTasks: TaskResult[] = [];
    
    // Run each task
    for (const taskName of tasksToRun) {
      if (TASKS[taskName]) {
        const result = await TASKS[taskName]();
        results.push(result);
        
        if (!result.success) {
          failedTasks.push(result);
        }
      } else {
        console.log(chalk.yellow(`⚠️  Unknown task: ${taskName}`));
      }
    }
    
    // Print results
    console.log('\n' + chalk.bold('Test Results:'));
    console.log('─'.repeat(50));
    
    for (const result of results) {
      const status = result.success ? chalk.green('✅') : chalk.red('❌');
      const name = chalk.bold(result.name);
      console.log(`${status} ${name}`);
      
      if (!result.success && result.error) {
        console.log(chalk.red('   Error:'), result.error);
      }
    }
    
    if (failedTasks.length > 0) {
      console.log('\n' + chalk.red('❌ Some tests failed!'));
      
      // Find likely culprits
      const allFailingFiles = failedTasks.flatMap(task => task.failingFiles || []);
      const suspects = await findLikelyCulprits(allFailingFiles);
      
      if (suspects.length > 0) {
        console.log('\n' + chalk.yellow('🔍 Likely suspects:'));
        for (const suspect of suspects) {
          console.log(`   ${suspect.sha} ${suspect.message} — ${suspect.author}`);
        }
      }
      
      // Send notifications if configured
      if (config.notifications.provider !== 'none') {
        const topSuspect = suspects[0];
        const suspectInfo = topSuspect ? { author: topSuspect.author, sha: topSuspect.sha } : undefined;
        
        await sendNotification(
          config,
          `${failedTasks.map(t => t.name).join(', ')} failed`,
          process.env.GITHUB_REF_NAME || 'main',
          suspectInfo
        );
      }
      
      process.exit(1);
    } else {
      spinner.succeed('All tests passed!');
    }
    
  } catch (error) {
    spinner.fail('Test execution failed');
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}

async function detectBuildCommand(): Promise<[string, string[]] | null> {
  const { readFileSync, existsSync } = await import('fs');
  const { join } = await import('path');
  
  const packageJsonPath = join(process.cwd(), 'package.json');
  
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      
      // Check for build script
      if (packageJson.scripts?.build) {
        return ['npm', ['run', 'build']];
      }
      
      // Check for common frameworks
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (deps.next) {
        return ['npx', ['next', 'build']];
      }
      
      if (deps.vite) {
        return ['npx', ['vite', 'build']];
      }
      
      if (deps.nuxt) {
        return ['npx', ['nuxt', 'build']];
      }
      
      if (deps.svelte) {
        return ['npx', ['svelte-kit', 'build']];
      }
      
    } catch (error) {
      // Ignore JSON parse errors
    }
  }
  
  return null;
}
