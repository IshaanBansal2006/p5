import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { redis } from '@/lib/redis';

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
        id: '', // Will be assigned by addBug endpoint
        title: error.title,
        description: fullDescription,
        severity: error.severity as 'low' | 'medium' | 'high' | 'critical',
        status: 'open',
        assignee: 'unassigned',
        reporter: 'p5testing',
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
          id: '', // Will be assigned by addBug endpoint
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


// Function to call addBug endpoint for each processed bug
async function addBugsViaAPI(owner: string, repo: string, bugs: Bug[]): Promise<{
  success: boolean;
  addedBugs: Bug[];
  totalBugs: number;
  error?: string;
}> {
  try {
    // Convert Bug[] to the format expected by addBug endpoint
    const bugsForAddBug = bugs.map(bug => ({
      title: bug.title,
      description: bug.description,
      severity: bug.severity,
      status: bug.status,
      assignee: bug.assignee,
      reporter: bug.reporter,
      labels: bug.labels
    }));

    // Make internal call to addBug endpoint
    const addBugResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/addBug`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        owner,
        repo,
        bugs: bugsForAddBug
      })
    });

    if (!addBugResponse.ok) {
      const errorData = await addBugResponse.json();
      throw new Error(`addBug API call failed: ${errorData.error || 'Unknown error'}`);
    }

    const addBugResult = await addBugResponse.json();

    // Return the bugs with their new sequential IDs
    return {
      success: true,
      addedBugs: addBugResult.bugs || [],
      totalBugs: addBugResult.totalBugs || 0
    };

  } catch (error) {
    console.error('Error calling addBug API:', error);
    return {
      success: false,
      addedBugs: [],
      totalBugs: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
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

    // Store test execution data in Redis
    const testExecutionData = {
      id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      repository: { owner, repo },
      executedAt: new Date().toISOString(),
      totalErrors: errorCollection.totalErrors,
      totalWarnings: errorCollection.totalWarnings,
      totalDuration: errorCollection.totalDuration,
      stage: errorCollection.stage,
      sessionId: errorCollection.sessionId,
      errors: errorCollection.errors.map(error => ({
        taskName: error.taskName,
        errorType: error.errorType,
        severity: error.severity,
        message: error.message,
        location: error.location,
        timestamp: error.timestamp,
        duration: error.duration,
        rawOutput: error.rawOutput
      })),
      summary: errorCollection.summary
    };

    // Store in Redis with a key pattern: test_executions:{owner}:{repo}:{timestamp}
    const redisKey = `test_executions:${owner}:${repo}:${testExecutionData.id}`;
    await redis.set(redisKey, JSON.stringify(testExecutionData));

    // Also store in a list for easy retrieval of all test executions for a repo
    const listKey = `test_executions_list:${owner}:${repo}`;
    const existingList = await redis.get(listKey);
    const testExecutions = existingList ? JSON.parse(existingList) : [];
    testExecutions.push({
      id: testExecutionData.id,
      executedAt: testExecutionData.executedAt,
      totalErrors: testExecutionData.totalErrors,
      totalWarnings: testExecutionData.totalWarnings,
      totalDuration: testExecutionData.totalDuration,
      stage: testExecutionData.stage
    });
    
    // Keep only the last 50 test executions to prevent unlimited growth
    const trimmedExecutions = testExecutions.slice(-50);
    await redis.set(listKey, JSON.stringify(trimmedExecutions));

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

    // Step 2: Add bugs via addBug API to ensure consistent numbering
    const addBugResult = await addBugsViaAPI(owner, repo, processedBugs);

    if (!addBugResult.success) {
      return NextResponse.json(
        {
          error: 'Failed to add bugs to repository',
          details: addBugResult.error
        },
        { status: 500 }
      );
    }

    // Log results
    console.log(`=== BUG ADDITION RESULTS ===`);
    console.log(`Processed unique bugs: ${processedBugs.length}`);
    console.log(`Successfully added bugs: ${addBugResult.addedBugs.length}`);
    console.log(`Total bugs in repository: ${addBugResult.totalBugs}`);
    console.log('');

    // Step 3: Prepare response with insights
    const criticalBugs = addBugResult.addedBugs.filter(b => b.severity === 'critical');
    const highPriorityBugs = addBugResult.addedBugs.filter(b => b.severity === 'high');
    const mediumPriorityBugs = addBugResult.addedBugs.filter(b => b.severity === 'medium');
    const lowPriorityBugs = addBugResult.addedBugs.filter(b => b.severity === 'low');

    const insights = [
      `Processed ${errorCollection.errors.length} errors into ${processedBugs.length} unique bugs`,
      `Successfully added ${addBugResult.addedBugs.length} bugs to repository`,
      `Total bugs in repository: ${addBugResult.totalBugs}`,
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
        added: addBugResult.addedBugs.length,
        total: addBugResult.totalBugs
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
      // Add the detailed added bugs to the response (with consistent sequential IDs)
      addedBugs: addBugResult.addedBugs.map(bug => ({
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

// GET endpoint to retrieve current data for a repository via addBug endpoint
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

    // Use addBug endpoint to get repository data
    const addBugResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/addBug?owner=${owner}&repo=${repo}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!addBugResponse.ok) {
      const errorData = await addBugResponse.json();
      throw new Error(`Failed to fetch repository data: ${errorData.error || 'Unknown error'}`);
    }

    const data = await addBugResponse.json();

    return NextResponse.json({
      repository: { owner, repo },
      totalBugs: data.totalBugs || 0,
      bugs: data.bugs || []
    });

  } catch (error) {
    console.error('Error in GET handler:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
