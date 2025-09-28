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
  avatar_url?: string;
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
  commitsAnalyzed: number;
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
        const cachedRepoData = await octokit.rest.repos.get({ owner, repo });
        const defaultBranch = cachedRepoData.data.default_branch;
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
      try {
        const parsedStats = JSON.parse(cachedStats);
        return NextResponse.json(parsedStats);
      } catch (error) {
        console.warn('Failed to parse cached stats, clearing cache and regenerating:', error);
        console.warn('Cached stats content:', cachedStats?.substring(0, 100) + '...');
        
        // Clear corrupted cache
        try {
          await redis.del(statsCacheKey);
          await redis.del(statsGeneratedKey);
        } catch (delError) {
          console.warn('Failed to clear corrupted cache:', delError);
        }
        
        // Continue to regenerate stats if cache is corrupted
      }
    }

    // Fetch repository data from GitHub
    const [repoData, commits, branches, contributors] = await Promise.all([
      octokit.rest.repos.get({ owner, repo }),
      octokit.rest.repos.listCommits({ owner, repo, per_page: 100 }),
      octokit.rest.repos.listBranches({ owner, repo, per_page: 100 }),
      octokit.rest.repos.listContributors({ owner, repo, per_page: 100 })
    ]);

    // Process commit history for changelog (commits are already in reverse chronological order from GitHub API)
    const commitHistory = commits.data.map(commit => ({
      sha: commit.sha,
      author: commit.commit.author?.name || commit.author?.login || 'Unknown',
      date: commit.commit.author?.date || new Date().toISOString(),
      message: commit.commit.message,
      additions: 0, // Will be populated from commit details
      deletions: 0,
      changes: 0
    }));

    // Get detailed commit stats for first 50 commits (mimicking debug endpoint)
    const detailedCommits: CommitData[] = [];
    for (const commit of commits.data.slice(0, 50)) {
      try {
        const commitDetail = await octokit.rest.repos.getCommit({
          owner,
          repo,
          ref: commit.sha
        });

        const stats = commitDetail.data.stats;
        let author = commit.commit.author?.name || commit.author?.login || 'Unknown';
        
        // Filter out system users and normalize names
        if (author === 'root' || author === 'noreply@github.com' || author === 'GitHub' || 
            author.toLowerCase().includes('bot') || author.toLowerCase().includes('action') ||
            author === 'Unknown' || !author.trim()) {
          author = 'System';
        } else {
          // Normalize author names to handle variations
          author = author.trim();
          // If we have both name and login, prefer the name but fallback to login
          if (commit.commit.author?.name && commit.author?.login) {
            author = commit.commit.author.name.trim();
          }
        }
        
        detailedCommits.push({
          sha: commit.sha,
          author: author,
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

    // Keep commits in GitHub's original order (newest first)
    // detailedCommits are already in the correct order from GitHub API

    // Process time series data - total lines of code over commits in chronological order
    const timeSeriesData: TimeSeriesData[] = [];
    let cumulativeLines = 0;
    
    // Sort commits by date (oldest first) for cumulative calculation - create a copy to avoid mutating original
    const sortedCommits = [...detailedCommits].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    for (const commit of sortedCommits) {
      cumulativeLines += commit.additions - commit.deletions;
      timeSeriesData.push({
        date: commit.date,
        commits: 1,
        linesAdded: commit.additions,
        linesDeleted: commit.deletions,
        contributors: [commit.author]
      });
    }

    // Calculate contributor statistics (mimicking debug endpoint exactly)
    const contributorMap = new Map<string, ContributorStats>();
    
    // First, process detailed commits for accurate stats
    for (const commit of detailedCommits) {
      const author = commit.author;
      if (author === 'System') continue; // Skip system commits
      
      const existing = contributorMap.get(author) || {
        name: author,
        commits: 0,
        additions: 0,
        deletions: 0,
        branches: 0,
        merges: 0,
        avatar_url: undefined
      };

      existing.commits += 1;
      existing.additions += commit.additions;
      existing.deletions += commit.deletions;
      
      if (commit.message.toLowerCase().includes('merge')) {
        existing.merges += 1;
      }

      contributorMap.set(author, existing);
    }
    
    // Then process all commits to get total commit counts
    for (const commit of commits.data) {
      let author = commit.commit.author?.name || commit.author?.login || 'Unknown';
      let avatarUrl = commit.author?.avatar_url;
      
      // Apply same filtering as detailed commits
      if (author === 'root' || author === 'noreply@github.com' || author === 'GitHub' || 
          author.toLowerCase().includes('bot') || author.toLowerCase().includes('action') ||
          author === 'Unknown' || !author.trim()) {
        author = 'System';
        avatarUrl = undefined;
      } else {
        author = author.trim();
        if (commit.commit.author?.name && commit.author?.login) {
          author = commit.commit.author.name.trim();
        }
      }
      
      if (author === 'System') continue; // Skip system commits
      
      const existing = contributorMap.get(author) || {
        name: author,
        commits: 0,
        additions: 0,
        deletions: 0,
        branches: 0,
        merges: 0,
        avatar_url: avatarUrl
      };

      // Only increment commits if we haven't already processed this commit in detailedCommits
      if (!detailedCommits.some(dc => dc.sha === commit.sha)) {
        existing.commits += 1;
        if (commit.commit.message.toLowerCase().includes('merge')) {
          existing.merges += 1;
        }
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
        let author = branchCommits.data[0].commit.author?.name || 
                     branchCommits.data[0].author?.login || 'Unknown';
        
        // Filter out system users and normalize names
        if (author === 'root' || author === 'noreply@github.com' || author === 'GitHub' || 
            author.toLowerCase().includes('bot') || author.toLowerCase().includes('action') ||
            author === 'Unknown' || !author.trim()) {
          author = 'System';
        }
        
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

    const contributorStats = Array.from(contributorMap.values())
      .filter(contributor => contributor.name !== 'System' && contributor.commits > 0);

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

    // Calculate total lines of code from detailed commits
    const totalLinesOfCode = detailedCommits.reduce((total, commit) => {
      return total + commit.additions - commit.deletions;
    }, 0);

    // Calculate current stats
    const currentStats = {
      branches: branches.data.length,
      totalCommits: commits.data.length,
      totalContributors: contributors.data.length,
      totalLinesOfCode: Math.max(totalLinesOfCode, 0) // Ensure non-negative
    };

    // Get historical data for percent change calculation (12 hours ago vs now)
    const historicalData = await redis.get(historicalKey);
    let percentChanges = {
      branches: 0,
      totalCommits: 0,
      totalContributors: 0,
      totalLinesOfCode: 0
    };

    if (historicalData) {
      try {
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
      } catch (error) {
        console.warn('Failed to parse historical data, clearing corrupted cache and using default percent changes:', error);
        console.warn('Historical data content:', historicalData?.substring(0, 100) + '...');
        
        // Clear corrupted historical data
        try {
          await redis.del(historicalKey);
        } catch (delError) {
          console.warn('Failed to clear corrupted historical cache:', delError);
        }
      }
    }

    // Store current stats for future percent change calculations
    try {
      const historicalData = {
        ...currentStats,
        timestamp: new Date().toISOString()
      };
      const historicalJson = JSON.stringify(historicalData);
      // Validate that we can parse it back
      JSON.parse(historicalJson);
      
      await redis.set(historicalKey, historicalJson, { EX: 86400 }); // Expire after 24 hours
    } catch (error) {
      console.error('Failed to serialize historical data for caching:', error);
      // Continue without caching if serialization fails
    }

    const stats: StatsData = {
      branches: { current: currentStats.branches, percentChange: percentChanges.branches },
      totalCommits: { current: currentStats.totalCommits, percentChange: percentChanges.totalCommits },
      totalContributors: { current: currentStats.totalContributors, percentChange: percentChanges.totalContributors },
      totalLinesOfCode: { current: currentStats.totalLinesOfCode, percentChange: percentChanges.totalLinesOfCode },
      commitsAnalyzed: Math.min(100, commits.data.length)
    };

    // Keep commits in the same order as debug endpoint (GitHub's original order)

    // Debug logging
    console.log(`Repository: ${owner}/${repo}`);
    console.log(`Total commits from GitHub: ${commits.data.length}`);
    console.log(`Detailed commits analyzed: ${detailedCommits.length}`);
    console.log(`Contributors found: ${contributorStats.length}`);
    console.log(`Recent commits (first 3):`, detailedCommits.slice(0, 3).map(c => ({
      author: c.author,
      message: c.message.substring(0, 50),
      date: c.date,
      additions: c.additions,
      deletions: c.deletions
    })));

    const response = {
      repository: `${owner}/${repo}`,
      recentCommitHistory: detailedCommits, // Show all detailed commits
      timeSeriesData,
      awards,
      stats,
      contributorStats: contributorStats,
      generatedAt: new Date().toISOString()
    };

    // Cache the response and generation time
    const currentTime = new Date().toISOString();
    
    try {
      const responseJson = JSON.stringify(response);
      // Validate that we can parse it back
      JSON.parse(responseJson);
      
      await redis.set(statsCacheKey, responseJson, { EX: 86400 }); // 24 hours
      await redis.set(statsGeneratedKey, currentTime, { EX: 86400 }); // 24 hours
    } catch (error) {
      console.error('Failed to serialize response for caching:', error);
      // Continue without caching if serialization fails
    }

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
