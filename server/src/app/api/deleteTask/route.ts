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
  bugs: Array<{
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
  }>;
  tasks: Task[];
  nextBugId: number;
  nextTaskId: number;
}

interface DeleteTaskRequest {
  owner: string;
  repo: string;
  taskId: string;
}

export async function DELETE(request: NextRequest) {
  try {
    const body: DeleteTaskRequest = await request.json();
    const { owner, repo, taskId } = body;

    // Validate required parameters
    if (!owner || !repo || !taskId) {
      return NextResponse.json(
        { error: 'Missing required parameters: owner, repo, and taskId' },
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
    
    // Find the task to delete
    const taskIndex = repositoryData.tasks.findIndex(task => task.id === taskId);
    
    if (taskIndex === -1) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Remove the task from the array
    const deletedTask = repositoryData.tasks[taskIndex];
    repositoryData.tasks.splice(taskIndex, 1);

    // Update Redis with the modified data
    await redis.set(key, JSON.stringify(repositoryData));

    return NextResponse.json(
      {
        message: `Successfully deleted task ${taskId}`,
        deletedTask: deletedTask,
        remainingTasks: repositoryData.tasks.length
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in deleteTask endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
