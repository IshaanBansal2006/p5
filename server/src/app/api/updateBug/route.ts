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

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'todo' | 'in-progress' | 'completed' | 'cancelled';
  assignee: string;
  reporter: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  comments: TaskComment[];
  completed: boolean;
  checked: boolean;
}

interface TaskComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

interface RepositoryData {
  bugs: Bug[];
  tasks: Task[];
}

interface UpdateBugRequest {
  owner: string;
  repo: string;
  bugId: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
}

export async function PUT(request: NextRequest) {
  try {
    const body: UpdateBugRequest = await request.json();
    const { owner, repo, bugId, status } = body;

    // Validate required parameters
    if (!owner || !repo || !bugId || !status) {
      return NextResponse.json(
        { error: 'Missing required parameters: owner, repo, bugId, and status' },
        { status: 400 }
      );
    }

    // Validate status
    if (!['open', 'in-progress', 'resolved', 'closed'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be one of: open, in-progress, resolved, closed' },
        { status: 400 }
      );
    }

    // Create the Redis key
    const key = `${owner}-${repo}`;

    // Get existing data
    const existingData = await redis.get(key);
    
    if (!existingData) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      );
    }

    const repositoryData: RepositoryData = JSON.parse(existingData);

    // Find the bug to update
    const bugIndex = repositoryData.bugs.findIndex(bug => bug.id === bugId);
    
    if (bugIndex === -1) {
      return NextResponse.json(
        { error: 'Bug not found' },
        { status: 404 }
      );
    }

    // Update the bug
    const currentTime = new Date().toISOString();
    const updatedBug = {
      ...repositoryData.bugs[bugIndex],
      status,
      updatedAt: currentTime
    };

    repositoryData.bugs[bugIndex] = updatedBug;

    // Update Redis with the modified data
    await redis.set(key, JSON.stringify(repositoryData));

    return NextResponse.json(
      {
        message: `Successfully updated bug ${bugId} status to ${status}`,
        bug: updatedBug
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in updateBug endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
