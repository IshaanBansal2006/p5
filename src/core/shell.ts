import { execa } from 'execa';
import chalk from 'chalk';

export interface ShellResult {
  code: number;
  stdout: string;
  stderr: string;
  success: boolean;
}

export async function runCommand(
  command: string,
  args: string[] = [],
  options: { cwd?: string; silent?: boolean } = {}
): Promise<ShellResult> {
  const { cwd = process.cwd(), silent = false } = options;
  
  try {
    if (!silent) {
      console.log(chalk.blue(`Running: ${command} ${args.join(' ')}`));
    }
    
    const result = await execa(command, args, {
      cwd,
      reject: false,
      stdio: silent ? 'pipe' : 'inherit'
    });
    
    return {
      code: result.exitCode || 0,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      success: result.exitCode === 0
    };
  } catch (error) {
    return {
      code: 1,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      success: false
    };
  }
}

export async function runCommandWithOutput(
  command: string,
  args: string[] = [],
  options: { cwd?: string } = {}
): Promise<ShellResult> {
  return runCommand(command, args, { ...options, silent: true });
}

export function extractFailingFiles(output: string): string[] {
  const files = new Set<string>();
  
  // Common patterns for failing files
  const patterns = [
    /^(.+):(\d+):(\d+):/gm,  // file:line:col
    /^(.+):(\d+):/gm,         // file:line
    /at (.+):(\d+):(\d+)/gm,  // at file:line:col
    /Error in (.+):/gm,       // Error in file:
    /Failed to compile (.+)/gm, // Failed to compile file
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(output)) !== null) {
      const file = match[1];
      if (file && !file.includes('node_modules') && !file.includes('dist')) {
        files.add(file);
      }
    }
  }
  
  return Array.from(files);
}
