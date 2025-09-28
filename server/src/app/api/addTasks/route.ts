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

interface Bug {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee: string;
  reporter: string;
  createdAt: string;
  updatedAt: string;
  labels: string[];
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

    // Validate task structure
    for (const task of tasks) {
      if (!task.title || !task.description || !task.priority || !task.status || !task.assignee || !task.reporter) {
        return NextResponse.json(
          { error: 'Each task must have title, description, priority, status, assignee, and reporter' },
          { status: 400 }
        );
      }

      if (!['low', 'medium', 'high', 'critical'].includes(task.priority)) {
        return NextResponse.json(
          { error: 'Priority must be one of: low, medium, high, critical' },
          { status: 400 }
        );
      }

      if (!['todo', 'in-progress', 'completed', 'cancelled'].includes(task.status)) {
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

    // Process and add new tasks
    const currentTime = new Date().toISOString();
    const newTasks: Task[] = tasks.map(task => ({
      id: generateTaskId(),
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      assignee: task.assignee,
      reporter: task.reporter,
      dueDate: task.dueDate,
      createdAt: currentTime,
      updatedAt: currentTime,
      tags: task.tags || [],
      comments: [],
      completed: task.status === 'completed',
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
