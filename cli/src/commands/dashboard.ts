import chalk from 'chalk';
import { spawn } from 'child_process';
import { platform } from 'os';

interface RepositoryInfo {
  owner: string;
  repo: string;
}

interface DashboardArgs {
  owner?: string;
  repo?: string;
  open?: boolean;
}

// Function to extract repository info from git (same as in test.ts)
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
    
    return {
      owner: owner || 'unknown',
      repo: repo || 'unknown'
    };
  } catch (error) {
    console.log('Could not extract git info:', error);
    return {
      owner: 'unknown',
      repo: 'unknown'
    };
  }
}

// Helper function to run commands (simplified version from test.ts)
async function runCommand(command: string, args: string[]): Promise<{success: boolean, output: string}> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { 
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      resolve({
        success: code === 0,
        output: stdout || stderr
      });
    });
    
    child.on('error', (err) => {
      resolve({
        success: false,
        output: err.message
      });
    });
  });
}

// Function to open URL in default browser
async function openInBrowser(url: string): Promise<boolean> {
  try {
    const currentPlatform = platform();
    let command: string;
    let args: string[];

    switch (currentPlatform) {
      case 'darwin': // macOS
        command = 'open';
        args = [url];
        break;
      case 'win32': // Windows
        command = 'start';
        args = ['', url]; // Empty string is required for start command
        break;
      case 'linux': // Linux
        command = 'xdg-open';
        args = [url];
        break;
      default:
        console.log(chalk.yellow('⚠️  Unsupported platform for auto-opening browser'));
        return false;
    }

    const result = await runCommand(command, args);
    return result.success;
  } catch (error) {
    console.log(error)
    console.log(chalk.yellow('⚠️  Failed to open browser automatically'));
    return false;
  }
}

export async function cmdDashboard(args: DashboardArgs = {}): Promise<void> {
  try {
    let owner = args.owner;
    let repo = args.repo;

    // If owner/repo not provided as arguments, try to detect from git
    if (!owner || !repo) {
      console.log(chalk.blue('🔍 Detecting repository info from git...'));
      
      const repoInfo = await getRepositoryInfo();
      
      if (repoInfo.owner === 'unknown' || repoInfo.repo === 'unknown') {
        console.log(chalk.red('❌ Could not determine repository owner/repo'));
        console.log(chalk.gray('Please provide owner and repo as arguments:'));
        console.log(chalk.gray('  p5 dashboard <owner> <repo>'));
        console.log(chalk.gray('Or run this command from within a git repository with a GitHub remote.'));
        return;
      }
      
      owner = repoInfo.owner;
      repo = repoInfo.repo;
      
      console.log(chalk.green(`✅ Detected repository: ${owner}/${repo}`));
    }

    // Construct the dashboard URL
    const dashboardUrl = `https://www.player5.dev/${owner}/${repo}`;
    
    console.log(chalk.cyan('\n🎯 P5 Dashboard'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.white(`Repository: ${chalk.bold(`${owner}/${repo}`)}`));
    console.log(chalk.white(`Dashboard: ${chalk.underline(dashboardUrl)}`));
    
    // Open in browser if requested
    if (args.open) {
      console.log(chalk.blue('\n🌐 Opening dashboard in browser...'));
      
      const opened = await openInBrowser(dashboardUrl);
      
      if (opened) {
        console.log(chalk.green('✅ Dashboard opened in your default browser'));
      } else {
        console.log(chalk.yellow('⚠️  Could not open browser automatically'));
        console.log(chalk.gray('Please visit the URL manually: ') + chalk.underline(dashboardUrl));
      }
    } else {
      console.log(chalk.gray('\n💡 Tip: Use --open or -o to automatically open in browser'));
      console.log(chalk.gray('Example: p5 dashboard --open'));
    }

    console.log('');

  } catch (error) {
    console.error(chalk.red('❌ Dashboard command failed'));
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(chalk.red('Error:'), errorMessage);
    process.exit(1);
  }
}