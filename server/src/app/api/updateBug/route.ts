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
}

interface UpdateBugRequest {
  owner: string;
  repo: string;
  bugId: string;
  title?: string;
  description?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'open' | 'in-progress' | 'resolved' | 'closed';
  assignee?: string;
  reporter?: string;
  labels?: string[];
  updatedAt?: string;
}

export async function PUT(request: NextRequest) {
  try {
    const body: UpdateBugRequest = await request.json();
    const { owner, repo, bugId, ...updateData } = body;

    // Validate required parameters
    if (!owner || !repo || !bugId) {
      return NextResponse.json(
        { error: 'Missing required parameters: owner, repo, and bugId' },
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
    const updatedBug = {
      ...repositoryData.bugs[bugIndex],
      ...updateData,
      updatedAt: updateData.updatedAt || new Date().toISOString()
    };

    repositoryData.bugs[bugIndex] = updatedBug;

    // Update Redis with the modified data
    await redis.set(key, JSON.stringify(repositoryData));

    return NextResponse.json(
      {
        message: `Successfully updated bug ${bugId}`,
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