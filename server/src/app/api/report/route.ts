import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Redis from 'ioredis';

// Types for the incoming data structure
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

// Standard Bug interface to match the rest of the application
interface Bug {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  assignee: string;
  reporter: string;
  createdAt: string;
  updatedAt: string;
  labels: string[];
  checked: boolean;
}

// Repository data structure to match the standard schema
interface RepositoryData {
  bugs: Bug[];
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    assignee: string;
    reporter: string;
    dueDate: string;
    createdAt: string;
    updatedAt: string;
    tags: string[];
    comments: Array<{
      id: string;
      author: string;
      content: string;
      createdAt: string;
    }>;
    completed: boolean;
    checked: boolean;
  }>;
}

// Initialize Redis client with environment variables
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  connectTimeout: 10000,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Function to process errors with Gemini AI
async function processErrorsWithGemini(errors: DetailedError[]): Promise<Bug[]> {
  try {
    // Prepare the error data for Gemini
    const errorSummary = errors.map((error, index) => ({
      index,
      taskName: error.taskName,
      errorType: error.errorType,
      severity: error.severity,
      message: error.message,
      file: error.location?.file,
      line: error.location?.line
    }));

    const prompt = `
You are an expert code analysis assistant. I have a list of ${errors.length} code errors and warnings that need to be processed and converted into bug reports.

TASK: 
1. Remove duplicate errors (same messages)
2. Assign severity ratings: "low", "medium", "high", or "critical" based on:
   - CRITICAL: Security vulnerabilities, data loss, system crashes, critical build failures
   - HIGH: Build failures, type errors, runtime crashes, blocking issues, test failures
   - MEDIUM: Linting errors, deprecated usage, performance issues, warnings that could cause problems
   - LOW: Style warnings, minor linting issues, documentation warnings, cosmetic issues
3. Create meaningful bug titles (max 80 chars) that clearly describe the issue
4. Write detailed descriptions that include:
   - What the error is
   - Where it occurs (file/line if available)
   - Why it's happening
   - Impact on the application
5. Generate appropriate labels that categorize the bug (2-4 labels max)
6. Provide actionable suggested fixes when possible

FIELD REQUIREMENTS:
- title: Clear, concise bug title (e.g., "TypeScript error: Missing return type annotation")
- description: Detailed explanation with context and impact
- severity: One of "low", "medium", "high", "critical"
- labels: Array of 2-4 relevant tags (e.g., ["typescript", "typecheck", "error-handling"])
- suggestedFix: Specific, actionable fix instructions
- occurrences: Number of times this error appears
- representativeLocation: Most common file/line where this occurs
- taskName: The task that generated this error (lint, typecheck, build, test, website)
- errorType: The type of error (lint, typecheck, build, test, website, unknown)

ERRORS TO PROCESS:
${JSON.stringify(errorSummary, null, 2)}

RESPONSE FORMAT (JSON only, no markdown):
{
  "uniqueBugs": [
    {
      "title": "TypeScript error: Missing return type annotation in User component",
      "description": "The User component is missing a return type annotation for its render method. This causes TypeScript compilation to fail and prevents the build from completing. The error occurs in the main User component file and affects the entire application's type safety.",
      "severity": "high",
      "labels": ["typescript", "typecheck", "component", "type-safety"],
      "suggestedFix": "Add explicit return type annotation: 'render(): JSX.Element' or 'render(): React.ReactElement'",
      "occurrences": 3,
      "representativeLocation": {
        "file": "src/components/User.tsx",
        "line": 15
      },
      "taskName": "typecheck",
      "errorType": "typecheck"
    }
  ],
  "summary": {
    "originalCount": ${errors.length},
    "uniqueCount": 0,
    "criticalCount": 0,
    "highCount": 0,
    "mediumCount": 0,
    "lowCount": 0
  }
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse Gemini's response
    let geminiResult;
    try {
      // Clean the response text (remove markdown formatting if present)
      const cleanText = text.replace(/```json\s*|\s*```/g, '').trim();
      geminiResult = JSON.parse(cleanText);
    } catch {
      console.error('Failed to parse Gemini response:', text);
      throw new Error('Invalid JSON response from Gemini');
    }

    // Convert Gemini's processed errors to Bug format
    const processedBugs: Bug[] = geminiResult.uniqueBugs.map((error: {
      title: string;
      description: string;
      severity: string;
      labels: string[];
      suggestedFix?: string;
      occurrences: number;
      representativeLocation?: {
        file?: string;
        line?: number;
      };
      taskName: string;
      errorType: string;
    }, index: number) => {
      const now = new Date().toISOString();
      const bugId = generateBugId(error.title);
      
      // Create a comprehensive description that includes the suggested fix
      let fullDescription = error.description;
      if (error.suggestedFix) {
        fullDescription += `\n\nSuggested Fix: ${error.suggestedFix}`;
      }
      if (error.representativeLocation?.file) {
        fullDescription += `\n\nLocation: ${error.representativeLocation.file}`;
        if (error.representativeLocation.line) {
          fullDescription += `:${error.representativeLocation.line}`;
        }
      }
      if (error.occurrences > 1) {
        fullDescription += `\n\nThis issue occurs ${error.occurrences} times.`;
      }
      
      return {
        id: bugId,
        title: error.title,
        description: fullDescription,
        severity: error.severity as 'low' | 'medium' | 'high' | 'critical',
        status: 'open',
        assignee: 'unassigned',
        reporter: 'system',
        createdAt: now,
        updatedAt: now,
        labels: error.labels || [],
        checked: false
      };
    });

    console.log(`Processed ${errors.length} errors into ${processedBugs.length} unique bugs`);
    
    // Log summary of processed bugs by severity
    const severityCounts = processedBugs.reduce((acc, bug) => {
      acc[bug.severity] = (acc[bug.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('Severity breakdown:', severityCounts);
    
    return processedBugs;

  } catch (error) {
    console.error('Error processing with Gemini:', error);
    
    // Fallback: basic deduplication without AI
    const uniqueBugs = errors.reduce((acc: Bug[], curr, index) => {
      const existing = acc.find(bug => 
        bug.description.includes(curr.message) && 
        bug.title.includes(curr.taskName)
      );

      if (existing) {
        // Update occurrence count in description
        const occurrenceMatch = existing.description.match(/This issue occurs (\d+) times/);
        const currentCount = occurrenceMatch ? parseInt(occurrenceMatch[1]) : 1;
        existing.description = existing.description.replace(
          /This issue occurs \d+ times/, 
          `This issue occurs ${currentCount + 1} times`
        );
        existing.updatedAt = new Date().toISOString();
      } else {
        // Map original severity to our severity scale
        const severity = mapSeverityToBugSeverity(curr.severity, curr.taskName, curr.errorType);
        
        const now = new Date().toISOString();
        
        // Create a better title from the error message
        const title = curr.message.length > 60 
          ? `${curr.taskName} Error: ${curr.message.substring(0, 60)}...`
          : `${curr.taskName} Error: ${curr.message}`;
        
        const bugId = generateBugId(title, curr.message);
        
        // Create a comprehensive description
        let description = `Error in ${curr.taskName}: ${curr.message}`;
        if (curr.location?.file) {
          description += `\n\nLocation: ${curr.location.file}`;
          if (curr.location.line) {
            description += `:${curr.location.line}`;
          }
        }
        description += `\n\nThis error was detected during the ${curr.taskName} phase of the build process.`;
        
        // Generate appropriate labels
        const labels = [curr.taskName, curr.errorType];
        if (curr.location?.file) {
          const fileExt = curr.location.file.split('.').pop();
          if (fileExt && ['ts', 'tsx', 'js', 'jsx'].includes(fileExt)) {
            labels.push('javascript', 'typescript');
          }
        }
        
        acc.push({
          id: bugId,
          title: title,
          description: description,
          severity: severity,
          status: 'open',
          assignee: 'unassigned',
          reporter: 'system',
          createdAt: now,
          updatedAt: now,
          labels: labels,
          checked: false
        });
      }
      return acc;
    }, []);

    return uniqueBugs;
  }
}


// Helper function to generate meaningful bug IDs
function generateBugId(title: string, message?: string): string {
  const source = title || message || 'unknown-error';
  const errorHash = source.toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);
  return `bug-${errorHash}-${Date.now().toString().slice(-6)}`;
}

// Helper function to map original severity to bug severity scale
function mapSeverityToBugSeverity(
  originalSeverity: 'error' | 'warning', 
  taskName: string, 
  errorType: string
): 'low' | 'medium' | 'high' | 'critical' {
  // High priority conditions
  if (originalSeverity == 'error') {
    if (taskName === 'build' || taskName === 'typecheck') {
      return 'high'; // Build failures and type errors are critical
    }
    if (taskName === 'test') {
      return 'high'; // Test failures are critical
    }
    if (errorType === 'website' && taskName === 'website') {
      return 'high'; // Runtime crashes and console errors
    }
  }

  // Medium priority conditions
  if (originalSeverity === 'error' && taskName === 'lint') {
    return 'medium'; // Linting errors are medium priority
  }
  
  if (originalSeverity === 'warning') {
    if (taskName === 'typecheck' || taskName === 'build') {
      return 'medium'; // Build/type warnings can indicate future issues
    }
  }

  // Low priority (default for warnings and minor issues)
  return 'low';
}

// FIXED: Function to get existing data from Redis (using string operations instead of hash)
async function getRepositoryData(owner: string, repo: string): Promise<RepositoryData> {
  try {
    const key = `${owner}-${repo}`;
    
    // First, check what type of data exists at this key
    const keyType = await redis.type(key);
    console.log(`Key ${key} has type: ${keyType}`);
    
    if (keyType === 'none') {
      // Key doesn't exist, return default structure
      return { bugs: [], tasks: [] };
    }
    
    let data: string | null = null;
    
    if (keyType === 'string') {
      // Key contains string data (our new format)
      data = await redis.get(key);
    } else if (keyType === 'hash') {
      // Key contains hash data (old format) - migrate it
      console.log(`Migrating hash data to string format for key: ${key}`);
      const hashData = await redis.hget(key, 'bugs');
      if (hashData) {
        const bugs = JSON.parse(hashData);
        const migratedData = { bugs, tasks: [] };
        // Save in new format and delete old hash
        await redis.set(key, JSON.stringify(migratedData));
        await redis.del(`${key}_old`); // Delete old hash structure
        return migratedData;
      }
    } else {
      // Key contains unexpected data type - delete and start fresh
      console.log(`Unexpected key type ${keyType} for ${key}, deleting and starting fresh`);
      await redis.del(key);
      return { bugs: [], tasks: [] };
    }

    if (!data) {
      return { bugs: [], tasks: [] };
    }

    const parsed = JSON.parse(data);
    
    // Ensure the parsed data has the expected structure
    return {
      bugs: Array.isArray(parsed.bugs) ? parsed.bugs : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : []
    };
    
  } catch (error) {
    console.error('Error getting data from Redis:', error);
    return { bugs: [], tasks: [] };
  }
}

// FIXED: Function to save data to Redis (using string operations instead of hash)
async function saveRepositoryData(owner: string, repo: string, data: RepositoryData): Promise<void> {
  try {
    const key = `${owner}-${repo}`;
    
    // Save as JSON string instead of hash
    await redis.set(key, JSON.stringify(data));
    
    // Set expiration (optional - 30 days)
    await redis.expire(key, 30 * 24 * 60 * 60);
    
    console.log(`Saved ${data.bugs.length} bugs and ${data.tasks.length} tasks to Redis for ${owner}/${repo}`);
  } catch (error) {
    console.error('Error saving data to Redis:', error);
    throw error;
  }
}

// Function to merge new bugs with existing ones
function mergeBugs(existingBugs: Bug[], newBugs: Bug[]): Bug[] {
  const merged = [...existingBugs];
  
  for (const newBug of newBugs) {
    const existingIndex = merged.findIndex(bug => 
      bug.title === newBug.title &&
      bug.description === newBug.description
    );

    if (existingIndex >= 0) {
      // Update existing bug
      merged[existingIndex] = {
        ...merged[existingIndex],
        updatedAt: newBug.updatedAt,
        severity: newBug.severity, // Update severity in case it changed
        status: newBug.status // Update status in case it changed
      };
    } else {
      // Add new bug
      merged.push(newBug);
    }
  }

  return merged;
}

// Main API handler
export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const errorCollection: ErrorCollection = await request.json();
    
    if (!errorCollection.repository?.owner || !errorCollection.repository?.repo) {
      return NextResponse.json(
        { error: 'Missing repository owner or repo name' },
        { status: 400 }
      );
    }

    if (!errorCollection.errors || errorCollection.errors.length === 0) {
      return NextResponse.json(
        { message: 'No errors to process', totalBugs: 0 },
        { status: 200 }
      );
    }

    const { owner, repo } = errorCollection.repository;
    
    console.log(`Processing ${errorCollection.errors.length} errors for ${owner}/${repo}`);

    // Log all the non-unique errors before processing
    console.log('\n=== RAW ERRORS SENT TO GEMINI ===');
    errorCollection.errors.forEach((error, index) => {
      console.log(`${index + 1}. [${error.severity.toUpperCase()}] ${error.taskName} (${error.errorType}):`);
      console.log(`   Message: ${error.message}`);
      console.log(`   Location: ${error.location?.file || 'N/A'}:${error.location?.line || 'N/A'}`);
      console.log(`   Duration: ${error.duration}ms`);
      console.log(`   Timestamp: ${error.timestamp}`);
      console.log('');
    });
    console.log(`Total raw errors: ${errorCollection.errors.length}\n`);

    // Step 1: Process errors with Gemini AI
    const processedBugs = await processErrorsWithGemini(errorCollection.errors);
    
    // Log the unique processed bugs
    console.log('\n=== PROCESSED UNIQUE BUGS ===');
    processedBugs.forEach((bug, index) => {
      console.log(`${index + 1}. [${bug.severity.toUpperCase()}] ${bug.title}:`);
      console.log(`   Description: ${bug.description.substring(0, 100)}${bug.description.length > 100 ? '...' : ''}`);
      console.log(`   Labels: ${bug.labels.join(', ')}`);
      console.log(`   Status: ${bug.status}`);
      console.log(`   Assignee: ${bug.assignee}`);
      console.log('');
    });
    console.log(`Total unique bugs processed: ${processedBugs.length}\n`);

    // Step 2: Get existing data from Redis
    const existingData = await getRepositoryData(owner, repo);

    // Step 3: Merge new bugs with existing ones
    const mergedBugs = mergeBugs(existingData.bugs, processedBugs);
    
    // Log merge results
    console.log(`=== MERGE RESULTS ===`);
    console.log(`Existing bugs in DB: ${existingData.bugs.length}`);
    console.log(`New unique bugs: ${processedBugs.length}`);
    console.log(`Total after merge: ${mergedBugs.length}`);
    console.log('');

    // Step 4: Save back to Redis (preserve tasks)
    const updatedData: RepositoryData = {
      bugs: mergedBugs,
      tasks: existingData.tasks // Preserve existing tasks
    };
    
    await saveRepositoryData(owner, repo, updatedData);

    // Step 5: Prepare response with insights
    const criticalBugs = mergedBugs.filter(b => b.severity === 'critical');
    const highPriorityBugs = mergedBugs.filter(b => b.severity === 'high');
    const mediumPriorityBugs = mergedBugs.filter(b => b.severity === 'medium');
    const lowPriorityBugs = mergedBugs.filter(b => b.severity === 'low');

    const insights = [
      `Processed ${errorCollection.errors.length} errors into ${processedBugs.length} unique bugs`,
      `Total bugs in repository: ${mergedBugs.length}`,
      `Severity breakdown: ${criticalBugs.length} critical, ${highPriorityBugs.length} high, ${mediumPriorityBugs.length} medium, ${lowPriorityBugs.length} low`
    ];

    const suggestions = [];
    
    if (criticalBugs.length > 0) {
      suggestions.push(`🚨 Address ${criticalBugs.length} critical issues immediately`);
    }
    
    if (highPriorityBugs.length > 0) {
      suggestions.push(`❗ Address ${highPriorityBugs.length} high-priority issues first`);
    }

    if (processedBugs.length > 5) {
      suggestions.push('Consider setting up automated linting and pre-commit hooks');
    }

    return NextResponse.json({
      success: true,
      processed: {
        original: errorCollection.errors.length,
        unique: processedBugs.length,
        total: mergedBugs.length
      },
      priority: {
        critical: criticalBugs.length,
        high: highPriorityBugs.length,
        medium: mediumPriorityBugs.length,
        low: lowPriorityBugs.length
      },
      insights,
      suggestions,
      repository: {
        owner,
        repo,
        lastUpdated: new Date().toISOString()
      },
      // Add the detailed unique bugs to the response
      uniqueBugs: processedBugs.map(bug => ({
        id: bug.id,
        title: bug.title,
        description: bug.description,
        severity: bug.severity,
        status: bug.status,
        assignee: bug.assignee,
        labels: bug.labels,
        createdAt: bug.createdAt,
        updatedAt: bug.updatedAt
      }))
    });

  } catch (error) {
    console.error('Error in report handler:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// FIXED: GET endpoint to retrieve current data for a repository
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing owner or repo parameter' },
        { status: 400 }
      );
    }

    const data = await getRepositoryData(owner, repo);
    
    return NextResponse.json({
      repository: { owner, repo },
      totalBugs: data.bugs.length,
      totalTasks: data.tasks.length,
      bugs: data.bugs.map(bug => ({
        ...bug,
        // Don't expose internal IDs or sensitive data
        rawOutput: undefined
      })),
      tasks: data.tasks
    });

  } catch (error) {
    console.error('Error in GET handler:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}