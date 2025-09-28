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


interface DevpostData {
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
  size: number;
}

// interface RepoInsights {
//   totalCommits: number;
//   contributors: string[];
//   recentActivity: string;
//   mainTechnologies: string[];
//   commits: CommitData[];
//   issues: IssueData[];
// }

interface CommitData {
  commit: {
    message: string;
    author: {
      date: string;
    };
  };
}

interface IssueData {
  title: string;
  state: 'open' | 'closed';
}

// Function to fetch GitHub repository data
async function fetchGitHubRepo(owner: string, repo: string) {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Devpost-Generator',
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

// Function to fetch README content
async function fetchReadme(owner: string, repo: string) {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Devpost-Generator',
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
    console.error('Error fetching README:', error);
    return null;
  }
}

// Function to fetch package.json or similar config files
async function fetchTechStack(owner: string, repo: string) {
  const techFiles = [
    'package.json',
    'requirements.txt',
    'Gemfile',
    'pom.xml',
    'Cargo.toml',
    'go.mod',
    'composer.json'
  ];
  
  const technologies = new Set<string>();
  
  for (const file of techFiles) {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${file}`, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'Devpost-Generator',
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
          Object.keys(pkg.dependencies || {}).forEach(dep => technologies.add(dep));
          Object.keys(pkg.devDependencies || {}).forEach(dep => technologies.add(dep));
        } else if (file === 'requirements.txt') {
          content.split('\n').forEach(line => {
            const pkg = line.split('==')[0].split('>=')[0].split('<=')[0].trim();
            if (pkg) technologies.add(pkg);
          });
        }
        // Add more parsers for other file types as needed
      }
    } catch {
      // Continue to next file if this one fails
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
        'User-Agent': 'Devpost-Generator',
        ...(process.env.GITHUB_TOKEN && {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
        })
      }
    });
    
    const languages = languagesResponse.ok ? await languagesResponse.json() : {};
    
    // Get recent commits for development insights
    const commitsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=20`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Devpost-Generator',
        ...(process.env.GITHUB_TOKEN && {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
        })
      }
    });
    
    const commits = commitsResponse.ok ? await commitsResponse.json() : [];
    
    // Get issues for challenges insight
    const issuesResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=50`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Devpost-Generator',
        ...(process.env.GITHUB_TOKEN && {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
        })
      }
    });
    
    const issues = issuesResponse.ok ? await issuesResponse.json() : [];
    
    return { languages, commits, issues };
  } catch (error) {
    console.error('Error getting repo insights:', error);
    return { languages: {}, commits: [], issues: [] };
  }
}

// Function to generate devpost using AI
async function generateDevpost(repoData: RepoData, readmeContent: string | null, techStack: string[]): Promise<DevpostData> {
  // Get additional repository insights
  const insights = await getRepoInsights(repoData.owner.login, repoData.name);
  
  // Create a rich, contextual prompt
  const contextualPrompt = `
You are an expert at writing compelling Devpost submissions. Create a unique, engaging devpost for this GitHub repository that tells the authentic story behind the project.

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
- Size: ${repoData.size} KB

LANGUAGE BREAKDOWN:
${Object.entries(insights.languages).map(([lang, bytes]) => `${lang}: ${bytes} bytes`).join('\n')}

RECENT DEVELOPMENT ACTIVITY:
${insights.commits.slice(0, 10).map((commit: CommitData) => 
  `- ${commit.commit.message.split('\n')[0]} (${new Date(commit.commit.author.date).toLocaleDateString()})`
).join('\n')}

ISSUES & CHALLENGES CONTEXT:
${insights.issues.slice(0, 15).map((issue: IssueData) => 
  `- ${issue.title} ${issue.state === 'closed' ? '[RESOLVED]' : '[OPEN]'}`
).join('\n')}

README CONTENT:
${readmeContent || 'No README available'}

DETECTED TECH STACK:
${techStack.join(', ')}

WRITING INSTRUCTIONS:
Write a compelling, authentic devpost that:

1. **INSPIRATION**: Dig deep into WHY this project exists. What problem sparked this? What was the "aha!" moment? Make it personal and relatable. Avoid generic statements like "we wanted to solve a problem."

2. **WHAT IT DOES**: Paint a vivid picture of the user experience. What happens when someone uses this? Focus on the value and impact, not just features. Use specific examples and scenarios.

3. **HOW WE BUILT IT**: Tell the technical story with personality. What was the development journey like? Which technologies were chosen and why? Mention specific challenges in the architecture or implementation that made this unique.

4. **CHALLENGES**: Use the issues/commits to identify REAL challenges. Don't be generic - mention specific technical hurdles, learning curves, or unexpected problems that came up during development.

5. **ACCOMPLISHMENTS**: What makes this project special? Focus on unique features, technical achievements, or problems solved in innovative ways. Quantify when possible.

6. **WHAT WE LEARNED**: Connect the learning to the specific technologies and challenges faced. What would you do differently? What surprised you?

7. **WHAT'S NEXT**: Based on open issues, recent commits, and the project's trajectory, what are the realistic next steps? Be specific about planned features or improvements.

8. **BUILT WITH**: Create a comprehensive, well-organized list that goes beyond just the main languages. Include frameworks, libraries, services, tools, platforms, but don't include useless packages that aren't truly impactful used or any node modules.

Make each section feel authentic and specific to this project. Vary your writing style between sections - some can be more technical, others more storytelling. Write as if you're genuinely passionate about what you built.

Return ONLY a JSON object with these exact keys: inspiration, what_it_does, how_built, challenges, accomplishments, learned, whats_next, built_with_list (as array), name, github_url
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
          temperature: 0.8,
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
  console.log("WE ARE GOING MANUAL")
  const primaryLang = repoData.language || 'JavaScript';
  const repoAge = Math.floor((new Date().getTime() - new Date(repoData.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const isPopular = repoData.stargazers_count > 50;
  const hasIssues = insights.issues.length > 0;
  const isActivelyMaintained = insights.commits.length > 5;
  
  // Generate unique content based on repository characteristics
  let inspirationStory = "";
  if (repoData.description?.includes('bot') || repoData.name.includes('bot')) {
    inspirationStory = `The idea for ${repoData.name} came from watching repetitive tasks eat away at productivity. We realized that automation wasn't just about saving time—it was about freeing humans to focus on what they do best: creative problem-solving.`;
  } else if (repoData.topics?.includes('web') || primaryLang === 'JavaScript') {
    inspirationStory = `In an era where web experiences make or break user engagement, ${repoData.name} was born from the frustration of existing solutions that just didn't quite fit. We saw an opportunity to build something that developers would actually want to use.`;
  } else if (primaryLang === 'Python' && repoData.description?.includes('data')) {
    inspirationStory = `Data tells stories, but only if you know how to listen. ${repoData.name} emerged from countless hours of wrestling with messy datasets and thinking "there has to be a better way to unlock these insights."`;
  } else {
    inspirationStory = `${repoData.name} started as a late-night conversation about the gaps we saw in existing solutions. What began as a simple idea evolved into something we genuinely believe can make a difference in how people approach ${repoData.language?.toLowerCase() || 'software'} development.`;
  }

  return {
    inspiration: inspirationStory,
    what_it_does: `${repoData.name} ${repoData.description || 'transforms how developers interact with their codebase'}. ${isPopular ? `With ${repoData.stargazers_count} stars and growing, it's clear that developers appreciate` : 'It focuses on providing'} a streamlined experience that ${primaryLang === 'Python' ? 'leverages Python\'s simplicity' : primaryLang === 'JavaScript' ? 'harnesses modern web technologies' : `utilizes ${primaryLang}'s strengths`} to deliver results that matter.`,
    
    how_built: `Building ${repoData.name} was a journey through ${Object.keys(insights.languages).join(', ')}. ${isActivelyMaintained ? `Over ${repoAge} days of development with ${insights.commits.length} commits,` : 'Through careful development,'} we crafted an architecture that balances performance with maintainability. The core is built in ${primaryLang}, ${techStack.length > 0 ? `with key dependencies on ${techStack.slice(0, 3).join(', ')}` : 'using modern best practices'}.`,
    
    challenges: hasIssues ? 
      `Development wasn't without its hurdles. ${insights.issues.filter((issue: IssueData) => issue.state === 'closed').length > 0 ? 'We tackled issues ranging from' : 'We\'re actively working on challenges including'} ${insights.issues.slice(0, 2).map((issue: IssueData) => issue.title.toLowerCase()).join(' and ')}. Each obstacle taught us something new about ${primaryLang} development and pushed us to find more elegant solutions.` :
      `The biggest challenge was balancing feature completeness with code simplicity. Working with ${primaryLang}, we had to make tough architectural decisions about how to structure the codebase for both current needs and future scalability.`,
    
    accomplishments: `We're particularly proud of ${isPopular ? `earning ${repoData.stargazers_count} stars from the community` : 'building something that solves a real problem'}. ${repoData.forks_count > 10 ? `With ${repoData.forks_count} forks, developers are actively building on our work.` : ''} The clean integration of ${Object.keys(insights.languages).slice(0, 2).join(' and ')} demonstrates that good architecture doesn't have to be complex.`,
    
    learned: `This project deepened our understanding of ${primaryLang} beyond just syntax—we learned about ${techStack.includes('react') ? 'React ecosystem patterns' : techStack.includes('express') ? 'Node.js backend architecture' : `${primaryLang} best practices`}. ${isActivelyMaintained ? 'The iterative development process' : 'Working on this project'} taught us the value of community feedback and the importance of documentation that developers actually want to read.`,
    
    whats_next: insights.issues.filter((issue: IssueData) => issue.state === 'open').length > 0 ?
      `The roadmap for ${repoData.name} is driven by community needs. We're prioritizing ${insights.issues.filter((issue: IssueData) => issue.state === 'open').slice(0, 2).map((issue: IssueData) => issue.title.toLowerCase()).join(' and ')}, while also exploring how to expand the core functionality without compromising simplicity.` :
      `Future development focuses on performance optimization and expanding ${primaryLang} compatibility. We're exploring integration opportunities and considering how ${repoData.name} can evolve with the changing development landscape.`,
    
    built_with_list: [
      ...Object.keys(insights.languages),
      ...techStack,
      ...(repoData.topics || []),
      'GitHub API',
      'Git'
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

    // Check if devpost already exists in Redis
    const devpostKey = `devpost-${owner}-${repo}`;
    const existingDevpost = await redis.get(devpostKey);
    
    if (existingDevpost) {
      return NextResponse.json(
        { 
          message: `Devpost for ${owner}/${repo} already exists`,
          data: JSON.parse(existingDevpost),
          cached: true
        },
        { status: 200 }
      );
    }

    // Fetch repository data from GitHub
    const repoData = await fetchGitHubRepo(owner, repo);
    
    // Fetch README content
    const readmeContent = await fetchReadme(owner, repo);
    
    // Analyze tech stack
    const techStack = await fetchTechStack(owner, repo);
    
    // Generate devpost content using AI
    const devpostData = await generateDevpost(repoData, readmeContent, techStack);
    
    // Store in Redis for future requests
    await redis.set(devpostKey, JSON.stringify(devpostData), {
      EX: 3600 // Cache for 1 hour
    });

    // Format the response as requested
    const formattedDevpost = `## Inspiration
${devpostData.inspiration}

## What It Does
${devpostData.what_it_does}

## How We Built It
${devpostData.how_built}

## Challenges We Ran Into
${devpostData.challenges}

## Accomplishments that We're Proud Of
${devpostData.accomplishments}

## What We Learned
${devpostData.learned}

## What's next for ${devpostData.name}
${devpostData.whats_next}

## Built With
${devpostData.built_with_list.map(tech => `• ${tech}`).join('\n')}`;

    return NextResponse.json(
      {
        message: `Devpost generated successfully for ${owner}/${repo}`,
        github_url: `https://github.com/${owner}/${repo}`,
        devpost: formattedDevpost,
        raw_data: devpostData
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error in devpost generation endpoint:', error);
    
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