import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

// Bug interface definition
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
  nextBugId: number;
  nextTaskId: number;
}

interface AddBugRequest {
  owner: string;
  repo: string;
  bugs: Omit<Bug, 'id' | 'createdAt' | 'updatedAt' | 'checked'>[];
}

// Generate sequential bug ID
function generateBugId(nextBugId: number): string {
  return `#${nextBugId}`;
}

export async function POST(request: NextRequest) {
  try {
    const body: AddBugRequest = await request.json();
    const { owner, repo, bugs } = body;

    // Validate required parameters
    if (!owner || !repo || !bugs || !Array.isArray(bugs)) {
      return NextResponse.json(
        { error: 'Missing required parameters: owner, repo, and bugs array' },
        { status: 400 }
      );
    }

    // Validate bug structure - only title is required
    for (const bug of bugs) {
      if (!bug.title || bug.title.trim() === '') {
        return NextResponse.json(
          { error: 'Bug title is required' },
          { status: 400 }
        );
      }

      // Validate severity if provided
      if (bug.severity && !['low', 'medium', 'high', 'critical'].includes(bug.severity)) {
        return NextResponse.json(
          { error: 'Severity must be one of: low, medium, high, critical' },
          { status: 400 }
        );
      }

      // Validate status if provided
      if (bug.status && !['open', 'in-progress', 'resolved', 'closed'].includes(bug.status)) {
        return NextResponse.json(
          { error: 'Status must be one of: open, in-progress, resolved, closed' },
          { status: 400 }
        );
      }
    }

    // Create the Redis key
    const key = `${owner}-${repo}`;

    // Get existing data or create new structure
    const existingData = await redis.get(key);
    let repositoryData: RepositoryData;

    if (existingData) {
      repositoryData = JSON.parse(existingData);
    } else {
      repositoryData = {
        bugs: [],
        tasks: [],
        nextBugId: 1,
        nextTaskId: 1
      };
    }

    // Ensure counters exist for existing repositories
    if (repositoryData.nextBugId === undefined) {
      repositoryData.nextBugId = Math.max(1, repositoryData.bugs.length + 1);
    }
    if (repositoryData.nextTaskId === undefined) {
      repositoryData.nextTaskId = Math.max(1, repositoryData.tasks.length + 1);
    }

    // Process and add new bugs with default values for empty fields
    const currentTime = new Date().toISOString();
    const newBugs: Bug[] = bugs.map((bug, index) => ({
      id: generateBugId(repositoryData.nextBugId + index),
      title: bug.title,
      description: bug.description?.trim() || ' ',
      severity: bug.severity || 'medium',
      status: bug.status || 'open',
      assignee: bug.assignee?.trim() || 'unassigned',
      reporter: bug.reporter?.trim() || 'unassigned',
      createdAt: currentTime,
      updatedAt: currentTime,
      labels: bug.labels || [],
      checked: false
    }));

    // Update the next bug ID counter
    repositoryData.nextBugId += bugs.length;

    // Add new bugs to existing bugs
    repositoryData.bugs.push(...newBugs);

    // Update Redis with the new data
    await redis.set(key, JSON.stringify(repositoryData));

    return NextResponse.json(
      {
        message: `Successfully added ${newBugs.length} bugs to ${owner}/${repo}`,
        addedBugs: newBugs.length,
        totalBugs: repositoryData.bugs.length,
        bugs: newBugs
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error in addBug endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve bugs for a repository
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

    // Create the Redis key
    const key = `${owner}-${repo}`;

    // Get existing data
    const existingData = await redis.get(key);
    
    if (!existingData) {
      // Return empty bugs array if repository not found
      return NextResponse.json({
        repository: `${owner}/${repo}`,
        bugs: [],
        totalBugs: 0
      });
    }

    const repositoryData: RepositoryData = JSON.parse(existingData);

    return NextResponse.json({
      repository: `${owner}/${repo}`,
      bugs: repositoryData.bugs,
      totalBugs: repositoryData.bugs.length
    });

  } catch (error) {
    console.error('Error in getBugs endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}