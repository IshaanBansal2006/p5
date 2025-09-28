import { NextRequest, NextResponse } from 'next/server';
import { createClient } from 'redis';

// Redis client configuration
const redis = createClient({
  username: 'default',
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

// Connect to Redis
redis.on('error', (err) => console.log('Redis Client Error', err));
await redis.connect();


interface ReadmeData {
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
}

interface RepoData {
  owner: {
    login: string;
  };
  name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  created_at: string;
  updated_at: string;
  topics?: string[];
  license?: {
    name: string;
  };
  homepage?: string;
}

// interface RepoInsights {
//   tree: FileData[];
//   releases: ReleaseData[];
// }

interface FileData {
  path: string;
}

interface ReleaseData {
  tag_name: string;
  name: string | null;
  published_at: string;
}

// Function to format README data into markdown
function formatReadmeMarkdown(data: ReadmeData): string {
  return `# ${data.title}

${data.description}

## Features

${data.features.map(feature => `- ${feature}`).join('\n')}

## Installation

${data.installation}

## Usage

${data.usage}

${data.api_documentation}

## Contributing

${data.contributing}

## License

${data.license}

## Acknowledgments

${data.acknowledgments}

## Tech Stack

${data.tech_stack.map(tech => `- ${tech}`).join('\n')}

---

**Repository:** [${data.name}](${data.github_url})`;
}

// Function to fetch GitHub repository data
async function fetchGitHubRepo(owner: string, repo: string) {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'README-Generator',
        ...(process.env.GITHUB_TOKEN && {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
        })
      }
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching GitHub repo:', error);
    throw error;
  }
}

// Function to fetch existing README content
async function fetchExistingReadme(owner: string, repo: string) {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'README-Generator',
        ...(process.env.GITHUB_TOKEN && {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
        })
      }
    });
    
    if (!response.ok) {
      return null; // README might not exist
    }
    
    const data = await response.json();
    return Buffer.from(data.content, 'base64').toString('utf-8');
  } catch (error) {
    console.error('Error fetching existing README:', error);
    return null;
  }
}

// Function to fetch package.json or similar config files for tech stack
async function fetchTechStack(owner: string, repo: string) {
  const techFiles = [
    'package.json',
    'requirements.txt',
    'Gemfile',
    'pom.xml',
    'Cargo.toml',
    'go.mod',
    'composer.json',
    'setup.py',
    'Pipfile'
  ];
  
  const technologies = new Set<string>();
  
  for (const file of techFiles) {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${file}`, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'README-Generator',
          ...(process.env.GITHUB_TOKEN && {
            'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
          })
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        
        // Parse different file types
        if (file === 'package.json') {
          const pkg = JSON.parse(content);
          Object.keys(pkg.dependencies || {}).forEach(dep => {
            if (!dep.startsWith('@types/') && !dep.includes('test') && !dep.includes('eslint')) {
              technologies.add(dep);
            }
          });
          Object.keys(pkg.devDependencies || {}).forEach(dep => {
            if (['typescript', 'webpack', 'vite', 'rollup', 'babel'].includes(dep)) {
              technologies.add(dep);
            }
          });
        } else if (file === 'requirements.txt') {
          content.split('\n').forEach(line => {
            const pkg = line.split('==')[0].split('>=')[0].split('<=')[0].trim();
            if (pkg && !pkg.startsWith('#')) technologies.add(pkg);
          });
        }
      }
    } catch {
      continue;
    }
  }
  
  return Array.from(technologies);
}

// Function to analyze repository structure and get additional context
async function getRepoInsights(owner: string, repo: string) {
  try {
    // Get languages breakdown
    const languagesResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'README-Generator',
        ...(process.env.GITHUB_TOKEN && {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
        })
      }
    });
    
    const languages = languagesResponse.ok ? await languagesResponse.json() : {};
    
    // Get repository tree for structure analysis
    const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'README-Generator',
        ...(process.env.GITHUB_TOKEN && {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
        })
      }
    });
    
    const tree = treeResponse.ok ? await treeResponse.json() : { tree: [] };
    
    // Get recent releases
    const releasesResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=5`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'README-Generator',
        ...(process.env.GITHUB_TOKEN && {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
        })
      }
    });
    
    const releases = releasesResponse.ok ? await releasesResponse.json() : [];
    
    return { languages, tree: tree.tree || [], releases };
  } catch (error) {
    console.error('Error getting repo insights:', error);
    return { languages: {}, tree: [], releases: [] };
  }
}

// Function to generate README using AI
async function generateReadme(repoData: RepoData, existingReadme: string | null, techStack: string[]): Promise<ReadmeData> {
  // Get additional repository insights
  const insights = await getRepoInsights(repoData.owner.login, repoData.name);
  
  // Analyze project structure
  const hasTests = insights.tree.some((file: FileData) => 
    file.path.includes('test') || file.path.includes('spec') || file.path.endsWith('.test.js') || file.path.endsWith('.spec.js')
  );
  
  const hasDocker = insights.tree.some((file: FileData) => 
    file.path.includes('Dockerfile') || file.path.includes('docker-compose')
  );
  
  const hasCI = insights.tree.some((file: FileData) => 
    file.path.includes('.github/workflows') || file.path.includes('.gitlab-ci') || file.path.includes('.travis')
  );
  
  const isWebProject = Object.keys(insights.languages).includes('JavaScript') || 
                       Object.keys(insights.languages).includes('TypeScript') || 
                       techStack.some(tech => ['react', 'vue', 'angular', 'next', 'nuxt'].includes(tech));
                       
  const isAPIProject = techStack.some(tech => ['express', 'fastapi', 'flask', 'django', 'spring'].includes(tech)) ||
                       insights.tree.some((file: FileData) => file.path.includes('api/') || file.path.includes('routes/'));

  // Create a rich, contextual prompt
  const contextualPrompt = `
You are an expert technical writer specializing in creating comprehensive, professional README files. Generate a detailed README for this GitHub repository that follows modern documentation best practices.

REPOSITORY ANALYSIS:
- Name: ${repoData.name}
- Description: ${repoData.description || 'No description provided'}
- Primary Language: ${repoData.language || 'Not specified'}
- Stars: ${repoData.stargazers_count || 0}
- Forks: ${repoData.forks_count || 0}
- Created: ${repoData.created_at}
- Last Updated: ${repoData.updated_at}
- Topics/Tags: ${repoData.topics?.join(', ') || 'None'}
- License: ${repoData.license?.name || 'Not specified'}
- Homepage: ${repoData.homepage || 'None'}
- Has Tests: ${hasTests}
- Has Docker: ${hasDocker}
- Has CI/CD: ${hasCI}
- Is Web Project: ${isWebProject}
- Is API Project: ${isAPIProject}

LANGUAGE BREAKDOWN:
${Object.entries(insights.languages).map(([lang, bytes]) => `${lang}: ${bytes} bytes`).join('\n')}

PROJECT STRUCTURE INSIGHTS:
${insights.tree.slice(0, 20).map((file: FileData) => `- ${file.path}`).join('\n')}

EXISTING README (if any):
${existingReadme || 'No existing README found'}

DETECTED TECH STACK:
${techStack.join(', ')}

RECENT RELEASES:
${insights.releases.slice(0, 3).map((release: ReleaseData) => 
  `- ${release.tag_name}: ${release.name || 'No title'} (${new Date(release.published_at).toLocaleDateString()})`
).join('\n')}

WRITING INSTRUCTIONS:
Create a comprehensive README that includes:

1. **TITLE**: Should be the project name, possibly with a tagline if the description suggests one

2. **DESCRIPTION**: Expand on the repository description with more context about what the project solves and why it matters

3. **FEATURES**: List 4-8 key features based on the codebase analysis, tech stack, and project structure. Be specific and highlight what makes this project unique

4. **INSTALLATION**: Provide clear, step-by-step installation instructions appropriate for the tech stack. Include prerequisites, package manager commands, and any environment setup needed

5. **USAGE**: Show practical examples of how to use the project. Include code snippets, command-line examples, or API usage depending on the project type

6. **API_DOCUMENTATION**: If this appears to be an API project, provide basic API documentation with endpoints and example requests/responses. Otherwise, explain the main interfaces or public methods

7. **CONTRIBUTING**: Standard contributing guidelines that encourage community participation and explain the development process

8. **LICENSE**: Reference the license and explain what it means for users

9. **ACKNOWLEDGMENTS**: Generic but thoughtful acknowledgments for contributors, inspiration, or tools used

Focus on clarity, practical examples, and helping users get started quickly. Make it scannable with good formatting and appropriate technical depth.

Return ONLY a JSON object with these exact keys: title, description, features (as array), installation, usage, api_documentation, contributing, license, acknowledgments, tech_stack (as array), name, github_url
`;

  // Gemini API call
  try {
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: contextualPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
          responseMimeType: "application/json"
        }
      })
    });

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiResponse.status} ${geminiResponse.statusText}`);
    }

    const geminiData = await geminiResponse.json();
    
    if (!geminiData.candidates || !geminiData.candidates[0] || !geminiData.candidates[0].content) {
      throw new Error('Invalid response format from Gemini API');
    }

    const generatedContent = geminiData.candidates[0].content.parts[0].text;
    
    try {
      return JSON.parse(generatedContent);
    } catch (parseError) {
      console.error('Error parsing Gemini response as JSON:', parseError);
      console.error('Raw response:', generatedContent);
      throw new Error('Failed to parse AI response as JSON');
    }
    
  } catch (aiError) {
    console.error('AI generation failed:', aiError);
    // Fall back to enhanced placeholder if AI fails
  }

  // Enhanced placeholder with more dynamic content based on actual repo data
  const primaryLang = repoData.language || 'JavaScript';
  
  return {
    title: repoData.name,
    description: repoData.description || `A ${primaryLang} project that provides essential functionality for developers.`,
    features: [
      `Built with ${primaryLang} for optimal performance`,
      `Comprehensive ${techStack.length > 0 ? techStack.slice(0, 2).join(' and ') : 'technology'} integration`,
      hasTests ? 'Thoroughly tested codebase' : 'Clean, maintainable code',
      hasDocker ? 'Docker support for easy deployment' : 'Easy installation and setup',
      `${Object.keys(insights.languages).length} programming languages supported`
    ],
    installation: `## Prerequisites\n\n- ${primaryLang === 'JavaScript' || primaryLang === 'TypeScript' ? 'Node.js (v16 or higher)' : primaryLang === 'Python' ? 'Python 3.7+' : `${primaryLang} development environment`}\n\n## Installation\n\n\`\`\`bash\n# Clone the repository\ngit clone https://github.com/${repoData.owner.login}/${repoData.name}.git\ncd ${repoData.name}\n\n# Install dependencies\n${primaryLang === 'JavaScript' || primaryLang === 'TypeScript' ? 'npm install' : primaryLang === 'Python' ? 'pip install -r requirements.txt' : '# Follow language-specific installation'}\n\`\`\``,
    usage: `## Basic Usage\n\n\`\`\`${primaryLang.toLowerCase()}\n// Example usage\n${primaryLang === 'JavaScript' || primaryLang === 'TypeScript' ? `import { ${repoData.name} } from './${repoData.name}';\n\nconst result = ${repoData.name}.process();\nconsole.log(result);` : primaryLang === 'Python' ? `from ${repoData.name} import main\n\nresult = main()\nprint(result)` : `// Add your ${primaryLang} usage example here`}\n\`\`\``,
    api_documentation: isAPIProject ? 
      `## API Endpoints\n\n### GET /api/example\nReturns example data\n\n**Response:**\n\`\`\`json\n{\n  "status": "success",\n  "data": {}\n}\n\`\`\`` : 
      `## API Reference\n\nDocumentation for the main interfaces and methods will be added here.`,
    contributing: `## Contributing\n\n1. Fork the repository\n2. Create your feature branch (\`git checkout -b feature/amazing-feature\`)\n3. Commit your changes (\`git commit -m 'Add some amazing feature'\`)\n4. Push to the branch (\`git push origin feature/amazing-feature\`)\n5. Open a Pull Request`,
    license: `This project is licensed under the ${repoData.license?.name || 'MIT'} License - see the [LICENSE](LICENSE) file for details.`,
    acknowledgments: `- Thanks to all contributors who have helped shape this project\n- Inspired by the open source community\n- Built with amazing tools and libraries`,
    tech_stack: [
      ...Object.keys(insights.languages),
      ...techStack,
      ...(repoData.topics || [])
    ].filter((item, index, arr) => arr.indexOf(item) === index && item), // Remove duplicates
    name: repoData.name,
    github_url: repoData.html_url
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    // Validate required parameters
    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing required parameters: owner and repo' },
        { status: 400 }
      );
    }

    // Validate parameter format
    if (typeof owner !== 'string' || typeof repo !== 'string') {
      return NextResponse.json(
        { error: 'Invalid parameter format' },
        { status: 400 }
      );
    }

    // Check if README already exists in Redis
    const readmeKey = `readme-${owner}-${repo}`;
    const existingReadme = await redis.get(readmeKey);
    
    if (existingReadme) {
      const cachedData = JSON.parse(existingReadme);
      
      // Format cached data to match the expected response structure
      const formattedReadme = formatReadmeMarkdown(cachedData);

      return NextResponse.json(
        { 
          message: `README for ${owner}/${repo} retrieved from cache`,
          github_url: cachedData.github_url,
          readme: formattedReadme,
          raw_data: cachedData,
          cached: true
        },
        { status: 200 }
      );
    }

    // Fetch repository data from GitHub
    const repoData = await fetchGitHubRepo(owner, repo);
    
    // Fetch existing README content
    const existingReadmeContent = await fetchExistingReadme(owner, repo);
    
    // Analyze tech stack
    const techStack = await fetchTechStack(owner, repo);
    
    // Generate README content using AI
    const readmeData = await generateReadme(repoData, existingReadmeContent, techStack);
    
    // Store in Redis for future requests
    await redis.set(readmeKey, JSON.stringify(readmeData), {
      EX: 3600 // Cache for 1 hour
    });

    // Format the response as a complete README
    const formattedReadme = formatReadmeMarkdown(readmeData);

    return NextResponse.json(
      {
        message: `README generated successfully for ${owner}/${repo}`,
        github_url: `https://github.com/${owner}/${repo}`,
        readme: formattedReadme,
        raw_data: readmeData
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error in README generation endpoint:', error);
    
    if (error instanceof Error && error.message.includes('GitHub API error')) {
      return NextResponse.json(
        { error: 'Repository not found or inaccessible' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}