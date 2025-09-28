import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const branch = searchParams.get('branch') || 'main';

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing required parameters: owner and repo' },
        { status: 400 }
      );
    }

    // Clear all commits cache for this repository and branch
    const pattern = `commits:${owner}:${repo}:${branch}:*`;
    
    try {
      const keys = await redis.keys(pattern);
      let deletedCount = 0;
      
      for (const key of keys) {
        const deleted = await redis.del(key);
        if (deleted > 0) deletedCount++;
      }
      
      console.log(`Cleared ${deletedCount} commits cache entries for ${owner}/${repo}/${branch}`);
      return NextResponse.json({
        message: `Successfully cleared ${deletedCount} commits cache entries for ${owner}/${repo}/${branch}`,
        cleared: deletedCount
      });
    } catch (cacheError) {
      console.error('Error clearing commits cache:', cacheError);
      return NextResponse.json(
        { error: 'Failed to clear cache' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in commits cache clear endpoint:', error);
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
    const branch = searchParams.get('branch') || 'main';

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing required parameters: owner and repo' },
        { status: 400 }
      );
    }

    // Get all cache keys for this repository and branch
    const pattern = `commits:${owner}:${repo}:${branch}:*`;
    
    try {
      const keys = await redis.keys(pattern);
      const cacheInfo = [];
      
      for (const key of keys) {
        const cachedData = await redis.get(key);
        if (cachedData) {
          try {
            const parsedData = JSON.parse(cachedData);
            cacheInfo.push({
              key: key.replace(`commits:${owner}:${repo}:${branch}:`, ''),
              cachedAt: parsedData.cachedAt,
              totalCommits: parsedData.totalCommits,
              page: parsedData.page,
              limit: parsedData.limit
            });
          } catch (parseError) {
            console.warn('Failed to parse cached data for key:', key, parseError);
          }
        }
      }
      
      return NextResponse.json({
        cached: cacheInfo.length > 0,
        cacheEntries: cacheInfo,
        totalEntries: cacheInfo.length,
        repository: `${owner}/${repo}`,
        branch
      });
    } catch (cacheError) {
      console.error('Error checking commits cache:', cacheError);
      return NextResponse.json(
        { error: 'Failed to check cache status' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in commits cache status endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
