import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

interface ReadmeResponse {
  message: string;
  github_url: string;
  readme: string;
  raw_data: {
    title: string;
    description: string;
    features: string[];
    installation: string;
    usage: string;
    api_documentation: string;
    contributing: string;
    license: string;
    acknowledgments: string;
    tech_stack: string[];
    name: string;
    github_url: string;
  };
}

// Auto-detect GitHub repository info (reusing same logic as devpost)
async function detectGitHubRepo(projectRoot: string): Promise<{ owner: string; repo: string } | null> {
  try {
    // Method 1: Try to get from git remote
    try {
      const remoteUrl = execSync('git config --get remote.origin.url', { 
        cwd: projectRoot,
        encoding: 'utf8' 
      }).trim();
      
      // Parse various GitHub URL formats
      // https://github.com/owner/repo.git
      // git@github.com:owner/repo.git
      // https://github.com/owner/repo
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
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      
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

// Call the Next.js server API for README generation
async function callReadmeAPI(owner: string, repo: string, serverUrl: string): Promise<ReadmeResponse> {
  const response = await fetch(`${serverUrl}/api/readme?owner=${owner}&repo=${repo}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`API Error ${response.status}: ${errorData.error || response.statusText}`);
  }
  
  return await response.json();
}

// Create/update README.md file
async function createReadmeFile(readmeData: ReadmeResponse, projectRoot: string): Promise<string> {
  const readmePath = path.join(projectRoot, 'README.md');
  
  // Check if README already exists
  let existingReadme = '';
  try {
    existingReadme = await fs.readFile(readmePath, 'utf8');
  } catch (error) {
    console.log(error)
    // README doesn't exist, that's fine
  }
  
  // Enhanced markdown with generation metadata
  const markdownContent = `${readmeData.readme}

---

*This README was automatically generated from repository analysis on ${new Date().toLocaleDateString()}*
`;

  await fs.writeFile(readmePath, markdownContent, 'utf8');
  
  return existingReadme ? 'updated' : 'created';
}

// Interface for command arguments
interface ReadmeArgs {
  owner?: string;
  repo?: string;
  server: string;
}

export async function cmdReadmeSync(args: ReadmeArgs): Promise<void> {
  const ownerArg = args.owner;
  const repoArg = args.repo;
  const serverUrl = args.server;
  const spinner = ora('Analyzing project...').start();
  
  try {
    const projectRoot = process.cwd();
    
    let owner = ownerArg;
    let repo = repoArg;
    
    // Auto-detect if not provided
    if (!owner || !repo) {
      spinner.text = 'Detecting GitHub repository...';
      
      const detected = await detectGitHubRepo(projectRoot);
      
      if (detected) {
        owner = owner || detected.owner;
        repo = repo || detected.repo;
        spinner.text = `Found repository: ${owner}/${repo}`;
      } else {
        spinner.fail('Could not auto-detect GitHub repository');
        console.log(chalk.red('\n❌ Unable to detect GitHub repository automatically.'));
        console.log(chalk.yellow('\n💡 Please provide owner and repo manually:'));
        console.log(chalk.cyan('   p5 readme sync <owner> <repo>'));
        console.log(chalk.cyan('   Example: p5 readme sync facebook react'));
        console.log(chalk.gray('\n   Or ensure you\'re in a git repository with GitHub remote.'));
        process.exit(1);
      }
    }
    
    if (!owner || !repo) {
      spinner.fail('Missing repository information');
      console.log(chalk.red('❌ Owner and repo are required'));
      process.exit(1);
    }
    
    // Call the server API
    spinner.text = `Generating README for ${owner}/${repo}...`;
    
    const readmeData = await callReadmeAPI(owner, repo, serverUrl);
    
    // Create/update the README file
    spinner.text = 'Creating README.md file...';
    const action = await createReadmeFile(readmeData, projectRoot);
    
    spinner.succeed(`README ${action} successfully for ${owner}/${repo}!`);
    
    // Success message with details
    console.log(chalk.green('\n✅ README Sync Complete!'));
    console.log(chalk.cyan(`📁 File ${action}: ${path.join(projectRoot, 'README.md')}`));
    console.log(chalk.gray(`🔗 Repository: ${readmeData.github_url}`));
    console.log(chalk.gray(`📋 Features: ${readmeData.raw_data.features.length} key features identified`));
    console.log(chalk.gray(`🛠️  Tech Stack: ${readmeData.raw_data.tech_stack.slice(0, 5).join(', ')}${readmeData.raw_data.tech_stack.length > 5 ? '...' : ''}`));
    
  } catch (error) {
    spinner.fail('Failed to sync README');
    
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        console.error(chalk.red('\n❌ Could not connect to server'));
        console.log(chalk.yellow('💡 Make sure your Next.js server is running:'));
        console.log(chalk.cyan('   cd server && npm run dev'));
      } else if (error.message.includes('404')) {
        console.error(chalk.red('\n❌ Repository not found on GitHub'));
      } else if (error.message.includes('409')) {
        console.error(chalk.red('\n❌ Repository already has a cached README - try a different repo'));
      } else {
        console.error(chalk.red('\n❌ Error:'), error.message);
      }
    } else {
      console.error(chalk.red('❌ Unknown error occurred'));
    }
    
    process.exit(1);
  }
}