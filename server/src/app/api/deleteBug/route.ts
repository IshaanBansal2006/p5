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

interface DeleteBugRequest {
  owner: string;
  repo: string;
  bugId: string;
}

export async function DELETE(request: NextRequest) {
  try {
    const body: DeleteBugRequest = await request.json();
    const { owner, repo, bugId } = body;

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
    
    // Find the bug to delete
    const bugIndex = repositoryData.bugs.findIndex(bug => bug.id === bugId);
    
    if (bugIndex === -1) {
      return NextResponse.json(
        { error: 'Bug not found' },
        { status: 404 }
      );
    }

    // Remove the bug from the array
    const deletedBug = repositoryData.bugs[bugIndex];
    repositoryData.bugs.splice(bugIndex, 1);

    // Update Redis with the modified data
    await redis.set(key, JSON.stringify(repositoryData));

    return NextResponse.json(
      {
        message: `Successfully deleted bug ${bugId}`,
        deletedBug: deletedBug,
        remainingBugs: repositoryData.bugs.length
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in deleteBug endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
