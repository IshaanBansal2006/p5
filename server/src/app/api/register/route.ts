import { NextRequest, NextResponse } from 'next/server';
import { createClient } from 'redis';

// Redis client configuration
const redis = createClient({
  username: 'default',
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

// Connect to Redis
redis.on('error', (err) => console.log('Redis Client Error', err));
await redis.connect();

interface RegisterRequest {
  owner: string;
  repo: string;
}

interface RepositoryData {
  bugs: any[];
  tasks: any[];
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
      ); 11427
    }

    // Validate parameter format (basic validation)
    if (typeof owner !== 'string' || typeof repo !== 'string') {
      return NextResponse.json(
        { error: 'Invalid parameter format' },
        { status: 400 }
      );
    }

    // Create the Redis key
    const key = `${owner}-${repo}`;

    // Check if the key already exists
    const exists = await redis.exists(key);
    if (exists) {
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

  } catch (error) {
    console.error('Error in register endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
