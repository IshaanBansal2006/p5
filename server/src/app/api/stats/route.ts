import { NextRequest, NextResponse } from 'next/server';
import { createClient } from 'redis';
import { Octokit } from '@octokit/rest';

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

// GitHub API client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// Debug: Check if token is loaded
console.log('GitHub token loaded:', process.env.GITHUB_TOKEN ? 'Yes' : 'No');
console.log('Token starts with:', process.env.GITHUB_TOKEN?.substring(0, 10) + '...');

interface CommitData {
  sha: string;
  author: string;
  date: string;
  message: string;
  additions: number;
  deletions: number;
  changes: number;
}

interface TimeSeriesData {
  date: string;
  commits: number;
  linesAdded: number;
  linesDeleted: number;
  contributors: string[];
}

interface ContributorStats {
  name: string;
  commits: number;
  additions: number;
  deletions: number;
  branches: number;
  merges: number;
}

interface Awards {
  biggestCommitter: { name: string; commits: number };
  biggestMerger: { name: string; merges: number };
  biggestBrancher: { name: string; branches: number };
  leastContributor: { name: string; commits: number };
}

interface StatsData {
  branches: { current: number; percentChange: number };
  totalCommits: { current: number; percentChange: number };
  totalContributors: { current: number; percentChange: number };
  totalLinesOfCode: { current: number; percentChange: number };
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

    const statsCacheKey = `${owner}-${repo}-stats`;
    const statsGeneratedKey = `${owner}-${repo}-stats-generated`;
    const historicalKey = `stats-historical-${owner}-${repo}`;

    // Check if we have cached stats and when they were generated
    const cachedStats = await redis.get(statsCacheKey);
    const cachedGeneratedTime = await redis.get(statsGeneratedKey);

    // Get the last commit datetime to compare with cached generation time
    let shouldRegenerate = true;
    if (cachedStats && cachedGeneratedTime) {
      try {
        // Get the last commit from the main branch
        const repoData = await octokit.rest.repos.get({ owner, repo });
        const defaultBranch = repoData.data.default_branch;
        const commits = await octokit.rest.repos.listCommits({
          owner,
          repo,
          sha: defaultBranch,
          per_page: 1
        });

        if (commits.data.length > 0) {
          const lastCommitDate = commits.data[0].commit.author?.date || 
                               commits.data[0].commit.committer?.date;
          
          if (lastCommitDate) {
            const lastCommitTime = new Date(lastCommitDate).getTime();
            const cachedTime = new Date(cachedGeneratedTime).getTime();
            
            // Only regenerate if last commit is newer than cached generation time
            shouldRegenerate = lastCommitTime > cachedTime;
          }
        }
      } catch (error) {
        console.warn('Failed to check last commit, regenerating stats:', error);
        shouldRegenerate = true;
      }
    }

    // Return cached stats if they're still valid
    if (cachedStats && !shouldRegenerate) {
      return NextResponse.json(JSON.parse(cachedStats));
    }

    // Fetch repository data from GitHub
    const [repoData, commits, branches, contributors] = await Promise.all([
      octokit.rest.repos.get({ owner, repo }),
      octokit.rest.repos.listCommits({ owner, repo, per_page: 100 }),
      octokit.rest.repos.listBranches({ owner, repo, per_page: 100 }),
      octokit.rest.repos.listContributors({ owner, repo, per_page: 100 })
    ]);

    // Process commit history for changelog
    const commitHistory = commits.data.map(commit => ({
      sha: commit.sha,
      author: commit.commit.author?.name || commit.author?.login || 'Unknown',
      date: commit.commit.author?.date || new Date().toISOString(),
      message: commit.commit.message,
      additions: 0, // Will be populated from commit details
      deletions: 0,
      changes: 0
    }));

    // Get detailed commit stats
    const detailedCommits: CommitData[] = [];
    for (const commit of commits.data.slice(0, 20)) { // Limit to recent 20 commits
      try {
        const commitDetail = await octokit.rest.repos.getCommit({
          owner,
          repo,
          ref: commit.sha
        });
        
        const stats = commitDetail.data.stats;
        detailedCommits.push({
          sha: commit.sha,
          author: commit.commit.author?.name || commit.author?.login || 'Unknown',
          date: commit.commit.author?.date || new Date().toISOString(),
          message: commit.commit.message,
          additions: stats?.additions || 0,
          deletions: stats?.deletions || 0,
          changes: stats?.total || 0
        });
      } catch (error) {
        console.warn(`Failed to get details for commit ${commit.sha}:`, error);
      }
    }

    // Process time series data (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const timeSeriesMap = new Map<string, TimeSeriesData>();
    
    for (const commit of commits.data) {
      const commitDate = new Date(commit.commit.author?.date || new Date());
      if (commitDate >= thirtyDaysAgo) {
        const dateKey = commitDate.toISOString().split('T')[0];
        const existing = timeSeriesMap.get(dateKey) || {
          date: dateKey,
          commits: 0,
          linesAdded: 0,
          linesDeleted: 0,
          contributors: []
        };
        
        existing.commits += 1;
        existing.contributors.push(commit.commit.author?.name || commit.author?.login || 'Unknown');
        timeSeriesMap.set(dateKey, existing);
      }
    }

    const timeSeriesData = Array.from(timeSeriesMap.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate contributor statistics
    const contributorMap = new Map<string, ContributorStats>();
    
    for (const commit of commits.data) {
      const author = commit.commit.author?.name || commit.author?.login || 'Unknown';
      const existing = contributorMap.get(author) || {
        name: author,
        commits: 0,
        additions: 0,
        deletions: 0,
        branches: 0,
        merges: 0
      };
      
      existing.commits += 1;
      if (commit.commit.message.toLowerCase().includes('merge')) {
        existing.merges += 1;
      }
      
      contributorMap.set(author, existing);
    }

    // Count branches per contributor
    for (const branch of branches.data) {
      const branchCommits = await octokit.rest.repos.listCommits({
        owner,
        repo,
        sha: branch.name,
        per_page: 1
      });
      
      if (branchCommits.data.length > 0) {
        const author = branchCommits.data[0].commit.author?.name || 
                     branchCommits.data[0].author?.login || 'Unknown';
        const existing = contributorMap.get(author) || {
          name: author,
          commits: 0,
          additions: 0,
          deletions: 0,
          branches: 0,
          merges: 0
        };
        existing.branches += 1;
        contributorMap.set(author, existing);
      }
    }

    const contributorStats = Array.from(contributorMap.values());

    // Calculate awards
    const awards: Awards = {
      biggestCommitter: contributorStats.reduce((max, curr) => 
        curr.commits > max.commits ? curr : max, contributorStats[0] || { name: 'None', commits: 0 }),
      biggestMerger: contributorStats.reduce((max, curr) => 
        curr.merges > max.merges ? curr : max, contributorStats[0] || { name: 'None', merges: 0 }),
      biggestBrancher: contributorStats.reduce((max, curr) => 
        curr.branches > max.branches ? curr : max, contributorStats[0] || { name: 'None', branches: 0 }),
      leastContributor: contributorStats.reduce((min, curr) => 
        curr.commits < min.commits ? curr : min, contributorStats[0] || { name: 'None', commits: 0 })
    };

    // Calculate current stats
    const currentStats = {
      branches: branches.data.length,
      totalCommits: commits.data.length,
      totalContributors: contributors.data.length,
      totalLinesOfCode: repoData.data.size || 0
    };

    // Get historical data for percent change calculation
    const historicalData = await redis.get(historicalKey);
    let percentChanges = {
      branches: 0,
      totalCommits: 0,
      totalContributors: 0,
      totalLinesOfCode: 0
    };

    if (historicalData) {
      const historical = JSON.parse(historicalData);
      const twelveHoursAgo = new Date();
      twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);
      
      if (new Date(historical.timestamp) >= twelveHoursAgo) {
        percentChanges = {
          branches: calculatePercentChange(historical.branches, currentStats.branches),
          totalCommits: calculatePercentChange(historical.totalCommits, currentStats.totalCommits),
          totalContributors: calculatePercentChange(historical.totalContributors, currentStats.totalContributors),
          totalLinesOfCode: calculatePercentChange(historical.totalLinesOfCode, currentStats.totalLinesOfCode)
        };
      }
    }

    // Store current stats for future percent change calculations
    await redis.set(historicalKey, JSON.stringify({
      ...currentStats,
      timestamp: new Date().toISOString()
    }), { EX: 86400 }); // Expire after 24 hours

    const stats: StatsData = {
      branches: { current: currentStats.branches, percentChange: percentChanges.branches },
      totalCommits: { current: currentStats.totalCommits, percentChange: percentChanges.totalCommits },
      totalContributors: { current: currentStats.totalContributors, percentChange: percentChanges.totalContributors },
      totalLinesOfCode: { current: currentStats.totalLinesOfCode, percentChange: percentChanges.totalLinesOfCode }
    };

    const response = {
      repository: `${owner}/${repo}`,
      recentCommitHistory: detailedCommits,
      timeSeriesData,
      awards,
      stats,
      generatedAt: new Date().toISOString()
    };

    // Cache the response and generation time
    const currentTime = new Date().toISOString();
    await redis.set(statsCacheKey, JSON.stringify(response), { EX: 86400 }); // 24 hours
    await redis.set(statsGeneratedKey, currentTime, { EX: 86400 }); // 24 hours

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in stats endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculatePercentChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return Math.round(((newValue - oldValue) / oldValue) * 100 * 100) / 100; // Round to 2 decimal places
}
