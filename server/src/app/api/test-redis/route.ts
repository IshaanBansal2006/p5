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

export async function GET(request: NextRequest) {
  try {
    console.log('Test Redis endpoint called');
    
    // Test Redis connection
    const key = 'IshaanBansal2006-p5';
    const data = await redis.get(key);
    
    if (data) {
      const repositoryData = JSON.parse(data);
      return NextResponse.json({
        success: true,
        message: 'Redis connection successful',
        tasksCount: repositoryData.tasks.length,
        sampleTask: repositoryData.tasks[0]
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'No data found for repository'
      });
    }
  } catch (error) {
    console.error('Error in test-redis endpoint:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
