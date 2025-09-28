import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

// Interface for test execution data
interface TestExecution {
  id: string;
  executedAt: string;
  totalErrors: number;
  totalWarnings: number;
  totalDuration: number;
  stage: string;
}

interface DetailedTestExecution extends TestExecution {
  repository: {
    owner: string;
    repo: string;
  };
  sessionId: string;
  errors: Array<{
    taskName: string;
    errorType: 'lint' | 'typecheck' | 'build' | 'test' | 'website' | 'unknown';
    severity: 'error' | 'warning';
    message: string;
    location?: {
      file?: string;
      line?: number;
      column?: number;
    };
    timestamp: string;
    duration: number;
    rawOutput?: string;
  }>;
  summary: {
    byTask: Record<string, number>;
    byType: Record<string, number>;
  };
}

// GET endpoint to retrieve test executions for a repository
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const detailed = searchParams.get('detailed') === 'true';

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing owner or repo parameter' },
        { status: 400 }
      );
    }

    if (detailed) {
      // Get detailed test execution data
      const pattern = `test_executions:${owner}:${repo}:*`;
      const keys = await redis.keys(pattern);
      
      const detailedExecutions: DetailedTestExecution[] = [];
      
      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          try {
            const execution = JSON.parse(data);
            detailedExecutions.push(execution);
          } catch (error) {
            console.warn(`Failed to parse test execution data for key ${key}:`, error);
          }
        }
      }
      
      // Sort by execution time (newest first)
      detailedExecutions.sort((a, b) => 
        new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
      );

      return NextResponse.json({
        repository: { owner, repo },
        executions: detailedExecutions,
        total: detailedExecutions.length
      });
    } else {
      // Get summary list of test executions
      const listKey = `test_executions_list:${owner}:${repo}`;
      const data = await redis.get(listKey);
      
      if (!data) {
        return NextResponse.json({
          repository: { owner, repo },
          executions: [],
          total: 0
        });
      }

      const executions: TestExecution[] = JSON.parse(data);
      
      // Sort by execution time (newest first)
      executions.sort((a, b) => 
        new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
      );

      return NextResponse.json({
        repository: { owner, repo },
        executions,
        total: executions.length
      });
    }

  } catch (error) {
    console.error('Error in test-executions GET handler:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE endpoint to clear test execution data for a repository
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing owner or repo parameter' },
        { status: 400 }
      );
    }

    // Delete all test execution keys for this repository
    const pattern = `test_executions:${owner}:${repo}:*`;
    const keys = await redis.keys(pattern);
    
    for (const key of keys) {
      await redis.del(key);
    }

    // Delete the summary list
    const listKey = `test_executions_list:${owner}:${repo}`;
    await redis.del(listKey);

    return NextResponse.json({
      message: `Cleared ${keys.length} test executions for ${owner}/${repo}`,
      deletedCount: keys.length
    });

  } catch (error) {
    console.error('Error in test-executions DELETE handler:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
