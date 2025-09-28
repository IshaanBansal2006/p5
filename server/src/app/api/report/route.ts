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

// Processed error with priority
interface ProcessedError {
  id: string;
  taskName: string;
  errorType: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  priority: 'low' | 'medium' | 'high';
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
  firstSeen: string;
  lastSeen: string;
  occurrences: number;
  category?: string;
  suggestedFix?: string;
}

// Redis data structure for repository bugs - Updated to match document structure
interface RepositoryData {
  bugs: ProcessedError[];
  tasks: any[]; // Add tasks array to match your document structure
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
async function processErrorsWithGemini(errors: DetailedError[]): Promise<ProcessedError[]> {
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
You are an expert code analysis assistant. I have a list of ${errors.length} code errors and warnings that need to be processed.

TASK: 
1. Remove duplicates errors (same  messages)
2. Assign severity ratings: "low", "medium", or "high" based on:
   - HIGH: Build failures, type errors, runtime crashes, security issues
   - MEDIUM: Linting errors, deprecated usage, performance issues
   - LOW: Style warnings, minor linting issues, documentation warnings
3. Categorize errors (e.g., "Type Error", "Lint Rule", "Build Issue", "Runtime Error")
4. Suggest fixes where possible

ERRORS TO PROCESS:
${JSON.stringify(errorSummary, null, 2)}

RESPONSE FORMAT (JSON only, no markdown):
{
  "uniqueErrors": [
    {
      "originalIndexes": [0, 5, 12],
      "taskName": "lint",
      "errorType": "lint",
      "severity": "medium",
      "message": "Combined/representative error message",
      "priority": "medium",
      "category": "Lint Rule",
      "suggestedFix": "Add missing semicolon at end of statement",
      "occurrences": 3,
      "representativeLocation": {
        "file": "src/component.ts",
        "line": 45
      }
    }
  ],
  "summary": {
    "originalCount": ${errors.length},
    "uniqueCount": 0,
    "highPriority": 0,
    "mediumPriority": 0,
    "lowPriority": 0
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
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', text);
      throw new Error('Invalid JSON response from Gemini');
    }

    // Convert Gemini's processed errors to our format
    const processedErrors: ProcessedError[] = geminiResult.uniqueErrors.map((error: any, index: number) => {
      const now = new Date().toISOString();
      return {
        id: `${Date.now()}-${index}`,
        taskName: error.taskName,
        errorType: error.errorType,
        severity: error.severity, // This should now be 'low' | 'medium' | 'high'
        message: error.message,
        priority: error.priority, // Same as severity for consistency
        location: error.representativeLocation,
        firstSeen: now,
        lastSeen: now,
        occurrences: error.occurrences || 1,
        category: error.category,
        suggestedFix: error.suggestedFix
      };
    });

    console.log(`Processed ${errors.length} errors into ${processedErrors.length} unique items`);
    
    // Log summary of processed errors by priority
    const priorityCounts = processedErrors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('Priority breakdown:', priorityCounts);
    
    return processedErrors;

  } catch (error) {
    console.error('Error processing with Gemini:', error);
    
    // Fallback: basic deduplication without AI
    const uniqueErrors = errors.reduce((acc: ProcessedError[], curr, index) => {
      const existing = acc.find(e => 
        e.message === curr.message && 
        e.taskName === curr.taskName &&
        e.location?.file === curr.location?.file
      );

      if (existing) {
        existing.occurrences += 1;
        existing.lastSeen = curr.timestamp;
      } else {
        // Map original severity to our priority scale
        const severity = mapSeverityToPriority(curr.severity, curr.taskName, curr.errorType);
        
        acc.push({
          id: `fallback-${Date.now()}-${index}`,
          taskName: curr.taskName,
          errorType: curr.errorType,
          severity: severity,
          message: curr.message,
          priority: severity, // Same as severity for consistency
          location: curr.location,
          firstSeen: curr.timestamp,
          lastSeen: curr.timestamp,
          occurrences: 1,
          category: `${curr.taskName} issue`
        });
      }
      return acc;
    }, []);

    return uniqueErrors.length > 0 ? uniqueErrors : fallbackProcessedErrors;
  }
}

// Helper function to log error details in a readable format
function logErrorSummary(errors: ProcessedError[], title: string) {
  console.log(`\n=== ${title} ===`);
  if (errors.length === 0) {
    console.log('No errors to display.');
    return;
  }
  
  // Group by severity for better readability
  const grouped = errors.reduce((acc, error) => {
    if (!acc[error.severity]) acc[error.severity] = [];
    acc[error.severity].push(error);
    return acc;
  }, {} as Record<string, ProcessedError[]>);
  
  Object.entries(grouped).forEach(([severity, errs]) => {
    console.log(`\n${severity.toUpperCase()} Priority (${errs.length}):`);
    errs.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.taskName}: ${error.message.substring(0, 80)}${error.message.length > 80 ? '...' : ''}`);
      if (error.location?.file) {
        console.log(`     📁 ${error.location.file}:${error.location.line || '?'}`);
      }
      if (error.suggestedFix) {
        console.log(`     🔧 ${error.suggestedFix.substring(0, 60)}${error.suggestedFix.length > 60 ? '...' : ''}`);
      }
    });
  });
  console.log('');
}

// Helper function to map original severity to priority scale
function mapSeverityToPriority(
  originalSeverity: 'error' | 'warning', 
  taskName: string, 
  errorType: string
): 'low' | 'medium' | 'high' {
  // High priority conditions
  if (originalSeverity === 'error') {
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
function mergeBugs(existingBugs: ProcessedError[], newBugs: ProcessedError[]): ProcessedError[] {
  const merged = [...existingBugs];
  
  for (const newBug of newBugs) {
    const existingIndex = merged.findIndex(bug => 
      bug.message === newBug.message &&
      bug.taskName === newBug.taskName &&
      bug.location?.file === newBug.location?.file &&
      bug.location?.line === newBug.location?.line
    );

    if (existingIndex >= 0) {
      // Update existing bug
      merged[existingIndex] = {
        ...merged[existingIndex],
        lastSeen: newBug.lastSeen,
        occurrences: merged[existingIndex].occurrences + newBug.occurrences,
        priority: newBug.priority // Update priority in case it changed
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
    const processedErrors = await processErrorsWithGemini(errorCollection.errors);
    
    // Log the unique processed errors
    console.log('\n=== PROCESSED UNIQUE ERRORS ===');
    processedErrors.forEach((error, index) => {
      console.log(`${index + 1}. [${error.severity.toUpperCase()}] ${error.taskName}:`);
      console.log(`   Message: ${error.message}`);
      console.log(`   Category: ${error.category || 'N/A'}`);
      console.log(`   Location: ${error.location?.file || 'N/A'}:${error.location?.line || 'N/A'}`);
      console.log(`   Occurrences: ${error.occurrences}`);
      if (error.suggestedFix) {
        console.log(`   Fix: ${error.suggestedFix}`);
      }
      console.log('');
    });
    console.log(`Total unique errors processed: ${processedErrors.length}\n`);

    // Step 2: Get existing data from Redis
    const existingData = await getRepositoryData(owner, repo);

    // Step 3: Merge new bugs with existing ones
    const mergedBugs = mergeBugs(existingData.bugs, processedErrors);
    
    // Log merge results
    console.log(`=== MERGE RESULTS ===`);
    console.log(`Existing bugs in DB: ${existingData.bugs.length}`);
    console.log(`New unique errors: ${processedErrors.length}`);
    console.log(`Total after merge: ${mergedBugs.length}`);
    console.log('');

    // Step 4: Save back to Redis (preserve tasks)
    const updatedData: RepositoryData = {
      bugs: mergedBugs,
      tasks: existingData.tasks // Preserve existing tasks
    };
    
    await saveRepositoryData(owner, repo, updatedData);

    // Step 5: Prepare response with insights
    const highPriorityBugs = mergedBugs.filter(b => b.severity === 'high');
    const mediumPriorityBugs = mergedBugs.filter(b => b.severity === 'medium');
    const lowPriorityBugs = mergedBugs.filter(b => b.severity === 'low');

    const insights = [
      `Processed ${errorCollection.errors.length} errors into ${processedErrors.length} unique issues`,
      `Total bugs in repository: ${mergedBugs.length}`,
      `Priority breakdown: ${highPriorityBugs.length} high, ${mediumPriorityBugs.length} medium, ${lowPriorityBugs.length} low`
    ];

    const suggestions = [];
    
    if (highPriorityBugs.length > 0) {
      suggestions.push(`❗ Address ${highPriorityBugs.length} high-priority issues first`);
      // Add specific suggestions from high-priority bugs
      highPriorityBugs.slice(0, 3).forEach(bug => {
        if (bug.suggestedFix) {
          suggestions.push(`🔧 ${bug.suggestedFix}`);
        }
      });
    }

    if (processedErrors.length > 5) {
      suggestions.push('Consider setting up automated linting and pre-commit hooks');
    }

    return NextResponse.json({
      success: true,
      processed: {
        original: errorCollection.errors.length,
        unique: processedErrors.length,
        total: mergedBugs.length
      },
      priority: {
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
      // Add the detailed unique errors to the response
      uniqueErrors: processedErrors.map(error => ({
        id: error.id,
        severity: error.severity,
        taskName: error.taskName,
        message: error.message,
        category: error.category,
        location: error.location,
        occurrences: error.occurrences,
        suggestedFix: error.suggestedFix
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