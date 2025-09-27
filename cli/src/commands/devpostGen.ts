import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
// Removed config import - not needed for this implementation

interface DevpostResponse {
  message: string;
  github_url: string;
  devpost: string;
  raw_data: {
    inspiration: string;
    what_it_does: string;
    how_built: string;
    challenges: string;
    accomplishments: string;
    learned: string;
    whats_next: string;
    built_with_list: string[];
    name: string;
    github_url: string;
  };
}

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

// Call the Next.js server API
async function callDevpostAPI(owner: string, repo: string, serverUrl: string): Promise<DevpostResponse> {
  const response = await fetch(`${serverUrl}/api/devpost?owner=${owner}&repo=${repo}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`API Error ${response.status}: ${errorData.error || response.statusText}`);
  }
  
  return await response.json();
}

// Create devpost.md file
async function createDevpostFile(devpostData: DevpostResponse, projectRoot: string): Promise<void> {
  const devpostPath = path.join(projectRoot, 'devpost.md');
  
  // Enhanced markdown with metadata
  const markdownContent = `# ${devpostData.raw_data.name}

> **GitHub Repository:** [${devpostData.raw_data.name}](${devpostData.github_url})
> 
> **Generated:** ${new Date().toLocaleDateString()}

${devpostData.devpost}

---

## 🔗 Links
- **GitHub Repository:** ${devpostData.github_url}
- **Built With:** ${devpostData.raw_data.built_with_list.join(' • ')}

---
*This devpost was automatically generated from the repository analysis.*
`;

  await fs.writeFile(devpostPath, markdownContent, 'utf8');
}

// Simple interface for the arguments
interface DevpostArgs {
  owner?: string;
  repo?: string;
  server: string;
}

export async function cmdDevpostGen(args: DevpostArgs): Promise<void> {
  const ownerArg = args.owner;
  const repoArg = args.repo;
  const serverUrl = args.server;
  const spinner = ora('Analyzing project...').start();
  
  try {
    const projectRoot = process.cwd();
    // Removed config loading - not needed for this implementation
    
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
        console.log(chalk.cyan('   p5 devpost generate <owner> <repo>'));
        console.log(chalk.cyan('   Example: p5 devpost generate facebook react'));
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
    spinner.text = `Generating devpost for ${owner}/${repo}...`;
    
    const devpostData = await callDevpostAPI(owner, repo, serverUrl);
    
    // Create the markdown file
    spinner.text = 'Creating devpost.md file...';
    await createDevpostFile(devpostData, projectRoot);
    
    spinner.succeed(`Devpost generated successfully for ${owner}/${repo}!`);
    
    // Success message with details
    console.log(chalk.green('\n✅ Devpost Generation Complete!'));
    console.log(chalk.cyan(`📁 File created: ${path.join(projectRoot, 'devpost.md')}`));
    console.log(chalk.gray(`🔗 Repository: ${devpostData.github_url}`));
    console.log(chalk.gray(`🛠️  Technologies: ${devpostData.raw_data.built_with_list.slice(0, 5).join(', ')}${devpostData.raw_data.built_with_list.length > 5 ? '...' : ''}`));
    
  } catch (error) {
    spinner.fail('Failed to generate Devpost');
    
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        console.error(chalk.red('\n❌ Could not connect to server'));
        console.log(chalk.yellow('💡 Make sure your Next.js server is running:'));
        console.log(chalk.cyan('   cd server && npm run dev'));
      } else if (error.message.includes('404')) {
        console.error(chalk.red('\n❌ Repository not found on GitHub'));
      } else if (error.message.includes('409')) {
        console.error(chalk.red('\n❌ Repository already registered - try a different repo'));
      } else {
        console.error(chalk.red('\n❌ Error:'), error.message);
      }
    } else {
      console.error(chalk.red('❌ Unknown error occurred'));
    }
    
    process.exit(1);
  }
}