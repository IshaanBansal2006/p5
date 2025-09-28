import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { Octokit } from '@octokit/rest';


// GitHub API client for validation
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});


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

interface Task {
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
  comments: { id: string; author: string; content: string; createdAt: string; }[];
  completed: boolean;
  checked: boolean;
}

interface RepositoryData {
  bugs: Bug[];
  tasks: Task[];
}

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

    // Validate parameter format (basic validation)
    if (typeof owner !== 'string' || typeof repo !== 'string') {
      return NextResponse.json(
        { error: 'Invalid parameter format' },
        { status: 400 }
      );
    }

    // Validate that the repository exists on GitHub
    try {
      await octokit.rest.repos.get({ owner, repo });
    } catch {
      return NextResponse.json(
        { error: `Repository ${owner}/${repo} not found on GitHub` },
        { status: 404 }
      );
    }

    // Create the Redis key
    const key = `${owner}-${repo}`;

    // Check if the key already exists
    const existingData = await redis.get(key);
    if (existingData) {
      return NextResponse.json(
        { error: `Repository ${owner}/${repo} is already registered` },
        { status: 409 }
      );
    }

    // Create the initial data structure
    const initialData: RepositoryData = {
      bugs: [],
      tasks: []
    };

    // Store the data in Redis
    await redis.set(key, JSON.stringify(initialData));

    return NextResponse.json(
      {
        message: `Repository ${owner}/${repo} registered successfully`,
        key: key,
        data: initialData
      },
      { status: 201 }
    );

  } catch {
    console.error('Error in register endpoint');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
