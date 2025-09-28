import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

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

// Call the Next.js server API with improved error handling
async function callDevpostAPI(owner: string, repo: string, serverUrl: string): Promise<DevpostResponse> {
  console.log(`DEBUG: Making API call to: ${serverUrl}/api/devpost?owner=${owner}&repo=${repo}`);
  
  try {
    const response = await fetch(`${serverUrl}/api/devpost?owner=${owner}&repo=${repo}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log(`DEBUG: Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      let errorMessage = `API Error ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        console.log('DEBUG: Error response data:', errorData);
        errorMessage = errorData.error || errorMessage;
      } catch {
        console.log('DEBUG: Could not parse error response as JSON');
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log('DEBUG: API response data structure:', {
      hasMessage: !!data.message,
      hasGithubUrl: !!data.github_url,
      hasDevpost: !!data.devpost,
      hasRawData: !!data.raw_data,
      hasData: !!data.data,
      hasCached: !!data.cached,
      hasName: !!(data.raw_data && data.raw_data.name) || !!(data.data && data.data.name)
    });
    
    // Handle both response formats: new devpost vs cached devpost
    let normalizedData: DevpostResponse;
    
    if (data.cached && data.data) {
      // Cached devpost format: { data: {...}, cached: true }
      console.log('DEBUG: Processing cached devpost response');
      const cachedData = data.data;
      
      // Create formatted devpost content from cached data
      const formattedDevpost = `## Inspiration
${cachedData.inspiration}

## What It Does
${cachedData.what_it_does}

## How We Built It
${cachedData.how_built}

## Challenges We Ran Into
${cachedData.challenges}

## Accomplishments that We're Proud Of
${cachedData.accomplishments}

## What We Learned
${cachedData.learned}

## What's next for ${cachedData.name}
${cachedData.whats_next}

## Built With
${cachedData.built_with_list.map((tech: string) => `• ${tech}`).join('\n')}`;

      normalizedData = {
        message: data.message,
        github_url: cachedData.github_url,
        devpost: formattedDevpost,
        raw_data: cachedData
      };
    } else if (data.raw_data) {
      // New devpost format: { raw_data: {...}, devpost: "...", github_url: "..." }
      console.log('DEBUG: Processing new devpost response');
      normalizedData = data;
    } else {
      console.log('DEBUG: Invalid response structure:', JSON.stringify(data, null, 2));
      throw new Error('Invalid API response: missing required data structure');
    }
    
    // Final validation
    if (!normalizedData.raw_data || !normalizedData.raw_data.name) {
      throw new Error('Invalid API response: missing name in data');
    }
    
    return normalizedData;
  } catch (error) {
    console.log('DEBUG: API call error:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Could not connect to server. Make sure your Next.js server is running.');
    }
    throw error;
  }
}

// Create devpost.md file with better error handling
async function createDevpostFile(devpostData: DevpostResponse, projectRoot: string): Promise<void> {
  try {
    console.log('DEBUG: Creating file with data:', {
      hasRawData: !!devpostData.raw_data,
      hasName: !!(devpostData.raw_data && devpostData.raw_data.name),
      name: devpostData.raw_data?.name
    });
    
    const devpostPath = path.join(projectRoot, 'devpost.md');
    
    // Validate required data before using it
    if (!devpostData.raw_data || !devpostData.raw_data.name) {
      throw new Error('Invalid devpost data: missing name in raw_data');
    }
    
    // Enhanced markdown with metadata
    const markdownContent = `# ${devpostData.raw_data.name}

> **GitHub Repository:** [${devpostData.raw_data.name}](${devpostData.github_url})
> 
> **Generated:** ${new Date().toLocaleDateString()}

${devpostData.devpost}

---

## 🔗 Links
- **GitHub Repository:** ${devpostData.github_url}
- **Built With:** ${devpostData.raw_data.built_with_list?.join(' • ') || 'N/A'}

---
*This devpost was automatically generated from the repository analysis.*
`;

    await fs.writeFile(devpostPath, markdownContent, 'utf8');
    console.log('DEBUG: File created successfully');
  } catch (error) {
    console.log('DEBUG: File creation error:', error);
    throw new Error(`Failed to create devpost file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
  
  console.log('DEBUG: Starting with args:', { ownerArg, repoArg, serverUrl });
  
  const spinner = ora('Analyzing project...').start();
  
  try {
    const projectRoot = process.cwd();
    
    let owner = ownerArg;
    let repo = repoArg;
    
    // Auto-detect if not provided
    if (!owner || !repo) {
      spinner.text = 'Detecting GitHub repository...';
      
      const detected = await detectGitHubRepo(projectRoot);
      console.log('\nDEBUG: Detected repo result:', detected);
      
      if (detected) {
        owner = owner || detected.owner;
        repo = repo || detected.repo;
        spinner.text = `Found repository: ${owner}/${repo}`;
        console.log('DEBUG: Current owner:', owner, 'repo:', repo);
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
    
    // Validate server URL
    if (!serverUrl) {
      spinner.fail('Missing server URL');
      console.log(chalk.red('❌ Server URL is required'));
      console.log(chalk.yellow('💡 Make sure to pass --server flag or set default server URL'));
      process.exit(1);
    }
    
    // Call the server API
    spinner.text = `Generating devpost for ${owner}/${repo}...`;
    
    let devpostData: DevpostResponse;
    try {
      devpostData = await callDevpostAPI(owner, repo, serverUrl);
      console.log('DEBUG: API call successful');
    } catch (apiError) {
      spinner.fail('API call failed');
      console.log('DEBUG: API call failed with error:', apiError);
      
      if (apiError instanceof Error) {
        if (apiError.message.includes('Could not connect to server')) {
          console.error(chalk.red('\n❌ Could not connect to server'));
          console.log(chalk.yellow('💡 Make sure your Next.js server is running:'));
          console.log(chalk.cyan('   cd server && npm run dev'));
          console.log(chalk.yellow('💡 And make sure the server URL is correct:'));
          console.log(chalk.cyan(`   Current server URL: ${serverUrl}`));
        } else if (apiError.message.includes('404')) {
          console.error(chalk.red('\n❌ Repository not found on GitHub'));
          console.log(chalk.yellow('💡 Check that the repository exists and is public'));
        } else if (apiError.message.includes('409')) {
          console.error(chalk.red('\n❌ Repository already registered - try a different repo'));
        } else if (apiError.message.includes('500')) {
          console.error(chalk.red('\n❌ Server error - check server logs'));
        } else {
          console.error(chalk.red('\n❌ API Error:'), apiError.message);
        }
      } else {
        console.error(chalk.red('❌ Unknown API error occurred'));
      }
      
      process.exit(1);
    }
    
    // Validate the response data
    if (!devpostData || !devpostData.raw_data) {
      spinner.fail('Invalid response from server');
      console.error(chalk.red('\n❌ Server returned invalid data'));
      console.log(chalk.yellow('💡 Check server logs for errors'));
      process.exit(1);
    }
    
    // Create the markdown file
    spinner.text = 'Creating devpost.md file...';
    try {
      await createDevpostFile(devpostData, projectRoot);
    } catch (fileError) {
      spinner.fail('Failed to create file');
      console.error(chalk.red('\n❌ File creation error:'), fileError instanceof Error ? fileError.message : 'Unknown error');
      process.exit(1);
    }
    
    spinner.succeed(`Devpost generated successfully for ${owner}/${repo}!`);
    
    // Success message with details
    console.log(chalk.green('\n✅ Devpost Generation Complete!'));
    console.log(chalk.cyan(`📁 File created: ${path.join(projectRoot, 'devpost.md')}`));
    console.log(chalk.gray(`🔗 Repository: ${devpostData.github_url}`));
    
    if (devpostData.raw_data.built_with_list && devpostData.raw_data.built_with_list.length > 0) {
      const techList = devpostData.raw_data.built_with_list.slice(0, 5).join(', ');
      const extraCount = devpostData.raw_data.built_with_list.length - 5;
      console.log(chalk.gray(`🛠️  Technologies: ${techList}${extraCount > 0 ? `... and ${extraCount} more` : ''}`));
    }
    
  } catch (error) {
    spinner.fail('Failed to generate Devpost');
    console.log('DEBUG: Unexpected error in main function:', error);
    
    if (error instanceof Error) {
      console.error(chalk.red('\n❌ Unexpected Error:'), error.message);
      console.log(chalk.yellow('\n💡 Debug information:'));
      console.log(chalk.gray(`   - Server URL: ${serverUrl}`));
      console.log(chalk.gray(`   - Owner: ${ownerArg || 'auto-detected'}`));
      console.log(chalk.gray(`   - Repo: ${repoArg || 'auto-detected'}`));
    } else {
      console.error(chalk.red('❌ Unknown error occurred'));
    }
    
    process.exit(1);
  }
}