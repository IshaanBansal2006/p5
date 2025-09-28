import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export async function DELETE(request: NextRequest) {
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

    const cacheKey = `contributors:${owner}:${repo}`;
    
    try {
      const deleted = await redis.del(cacheKey);
      if (deleted > 0) {
        console.log(`Cleared contributors cache for ${owner}/${repo}`);
        return NextResponse.json({
          message: `Successfully cleared contributors cache for ${owner}/${repo}`,
          cleared: true
        });
      } else {
        return NextResponse.json({
          message: `No cache found for ${owner}/${repo}`,
          cleared: false
        });
      }
    } catch (cacheError) {
      console.error('Error clearing contributors cache:', cacheError);
      return NextResponse.json(
        { error: 'Failed to clear cache' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in cache clear endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    const cacheKey = `contributors:${owner}:${repo}`;
    
    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        return NextResponse.json({
          cached: true,
          cachedAt: parsedData.cachedAt,
          totalContributors: parsedData.totalContributors,
          repository: parsedData.repository
        });
      } else {
        return NextResponse.json({
          cached: false,
          message: 'No cached data found'
        });
      }
    } catch (cacheError) {
      console.error('Error checking contributors cache:', cacheError);
      return NextResponse.json(
        { error: 'Failed to check cache status' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in cache status endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
