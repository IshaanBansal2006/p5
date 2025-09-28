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

interface UpdateTaskRequest {
  owner: string;
  repo: string;
  taskId: string;
  status: 'todo' | 'in-progress' | 'completed' | 'cancelled';
}

export async function PUT(request: NextRequest) {
  try {
    const body: UpdateTaskRequest = await request.json();
    const { owner, repo, taskId, status } = body;

    // Validate required parameters
    if (!owner || !repo || !taskId || !status) {
      return NextResponse.json(
        { error: 'Missing required parameters: owner, repo, taskId, and status' },
        { status: 400 }
      );
    }

    // Validate status
    if (!['todo', 'in-progress', 'completed', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be one of: todo, in-progress, completed, cancelled' },
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

    // Find the task to update
    const taskIndex = repositoryData.tasks.findIndex(task => task.id === taskId);
    
    if (taskIndex === -1) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Update the task
    const currentTime = new Date().toISOString();
    const updatedTask = {
      ...repositoryData.tasks[taskIndex],
      status,
      completed: status === 'completed',
      updatedAt: currentTime
    };

    repositoryData.tasks[taskIndex] = updatedTask;

    // Update Redis with the modified data
    await redis.set(key, JSON.stringify(repositoryData));

    return NextResponse.json(
      {
        message: `Successfully updated task ${taskId} status to ${status}`,
        task: updatedTask
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in updateTask endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
