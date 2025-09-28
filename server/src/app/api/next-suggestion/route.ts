import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

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
  comments: Array<{
    id: string;
    author: string;
    content: string;
    createdAt: string;
  }>;
  completed: boolean;
  checked: boolean;
}

interface RepositoryData {
  bugs: Bug[];
  tasks: Task[];
  nextBugId: number;
  nextTaskId: number;
}

// Priority mapping for comparison
const priorityOrder = {
  'critical': 4,
  'high': 3,
  'medium': 2,
  'low': 1
};

// Status mapping for filtering
const openStatuses = ['open', 'todo'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

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
      return NextResponse.json({
        suggestion: null,
        message: 'Repository not found'
      });
    }

    const repositoryData: RepositoryData = JSON.parse(existingData);

    // Filter open bugs and tasks
    const openBugs = repositoryData.bugs.filter(bug => 
      openStatuses.includes(bug.status) && !bug.checked
    );
    
    const openTasks = repositoryData.tasks.filter(task => 
      openStatuses.includes(task.status) && !task.checked
    );

    // If no open items, return completion message
    if (openBugs.length === 0 && openTasks.length === 0) {
      return NextResponse.json({
        suggestion: null,
        message: 'All tasks and bugs have been completed or are in progress',
        type: 'completed'
      });
    }

    // Create combined list with type indicator
    const allItems = [
      ...openBugs.map(bug => ({
        ...bug,
        type: 'bug' as const,
        priorityValue: priorityOrder[bug.severity],
        numericId: parseInt(bug.id.replace('#', ''))
      })),
      ...openTasks.map(task => ({
        ...task,
        type: 'task' as const,
        priorityValue: priorityOrder[task.priority],
        numericId: parseInt(task.id.replace('T-', ''))
      }))
    ];

    // Sort by priority (highest first), then by type (bugs first), then by numeric ID (lowest first)
    allItems.sort((a, b) => {
      // First by priority (highest first)
      if (a.priorityValue !== b.priorityValue) {
        return b.priorityValue - a.priorityValue;
      }
      
      // Then by type (bugs first)
      if (a.type !== b.type) {
        return a.type === 'bug' ? -1 : 1;
      }
      
      // Finally by numeric ID (lowest first)
      return a.numericId - b.numericId;
    });

    const nextSuggestion = allItems[0];

    return NextResponse.json({
      suggestion: {
        id: nextSuggestion.id,
        title: nextSuggestion.title,
        type: nextSuggestion.type,
        priority: nextSuggestion.type === 'bug' ? nextSuggestion.severity : nextSuggestion.priority,
        assignee: nextSuggestion.assignee,
        description: nextSuggestion.description
      },
      message: `Next suggested ${nextSuggestion.type}: ${nextSuggestion.title}`
    });

  } catch (error) {
    console.error('Error in next-suggestion endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
