import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';


// Task interface definition
interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'todo' | 'in-progress' | 'completed' | 'cancelled';
  assignee: string;
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
  tasks: Task[];
}

interface AddTasksRequest {
  owner: string;
  repo: string;
  tasks: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'comments' | 'completed' | 'checked'>[];
}

// Generate unique task ID
function generateTaskId(): string {
  return `T-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}


export async function POST(request: NextRequest) {
  try {
    const body: AddTasksRequest = await request.json();
    const { owner, repo, tasks } = body;

    // Validate required parameters
    if (!owner || !repo || !tasks || !Array.isArray(tasks)) {
      return NextResponse.json(
        { error: 'Missing required parameters: owner, repo, and tasks array' },
        { status: 400 }
      );
    }

    // Validate task structure - only title is mandatory
    for (const task of tasks) {
      if (!task.title || task.title.trim() === '') {
        return NextResponse.json(
          { error: 'Each task must have a title' },
          { status: 400 }
        );
      }

      // Validate priority if provided, otherwise it will get a default value
      if (task.priority && !['low', 'medium', 'high', 'critical'].includes(task.priority)) {
        return NextResponse.json(
          { error: 'Priority must be one of: low, medium, high, critical' },
          { status: 400 }
        );
      }

      // Validate status if provided, otherwise it will get a default value
      if (task.status && !['todo', 'in-progress', 'completed', 'cancelled'].includes(task.status)) {
        return NextResponse.json(
          { error: 'Status must be one of: todo, in-progress, completed, cancelled' },
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
        tasks: []
      };
    }

    // Process and add new tasks with default values
    const currentTime = new Date().toISOString();
    const newTasks: Task[] = tasks.map(task => ({
      id: generateTaskId(),
      title: task.title.trim(),
      description: task.description || 'No description provided',
      priority: task.priority || 'medium',
      status: task.status || 'todo',
      assignee: task.assignee || 'unassigned',
      dueDate: task.dueDate || '',
      createdAt: currentTime,
      updatedAt: currentTime,
      tags: task.tags || [],
      comments: [],
      completed: (task.status || 'todo') === 'completed',
      checked: false
    }));

    // Add new tasks to existing tasks
    repositoryData.tasks.push(...newTasks);

    // Update Redis with the new data
    await redis.set(key, JSON.stringify(repositoryData));

    return NextResponse.json(
      {
        message: `Successfully added ${newTasks.length} tasks to ${owner}/${repo}`,
        addedTasks: newTasks.length,
        totalTasks: repositoryData.tasks.length,
        tasks: newTasks
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error in addTasks endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve tasks for a repository
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
      // Return empty tasks array if repository not found
      return NextResponse.json({
        repository: `${owner}/${repo}`,
        tasks: [],
        totalTasks: 0
      });
    }

    const repositoryData: RepositoryData = JSON.parse(existingData);

    return NextResponse.json({
      repository: `${owner}/${repo}`,
      tasks: repositoryData.tasks,
      totalTasks: repositoryData.tasks.length
    });

  } catch (error) {
    console.error('Error in getTasks endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
