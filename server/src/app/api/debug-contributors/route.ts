import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

// GitHub API client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

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

    // Get commits and contributors data
    const [commits, contributors] = await Promise.all([
      octokit.rest.repos.listCommits({ owner, repo, per_page: 100 }),
      octokit.rest.repos.listContributors({ owner, repo, per_page: 100 })
    ]);

    // Get detailed commit stats for first 50 commits
    const detailedCommits = [];
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
          authorEmail: commit.commit.author?.email,
          committer: commit.commit.committer?.name || commit.committer?.login,
          committerEmail: commit.commit.committer?.email,
          date: commit.commit.author?.date || new Date().toISOString(),
          message: commit.commit.message,
          additions: stats?.additions || 0,
          deletions: stats?.deletions || 0,
          changes: stats?.total || 0,
          files: commitDetail.data.files?.length || 0
        });
      } catch (error) {
        console.warn(`Failed to get details for commit ${commit.sha}:`, error);
      }
    }

    // Calculate contributor stats manually
    const contributorMap = new Map();
    
    // First, process detailed commits for accurate stats
    for (const commit of detailedCommits) {
      const author = commit.author;
      if (author === 'System') continue; // Skip system commits
      
      const existing = contributorMap.get(author) || {
        name: author,
        commits: 0,
        additions: 0,
        deletions: 0,
        files: 0
      };

      existing.commits += 1;
      existing.additions += commit.additions;
      existing.deletions += commit.deletions;
      existing.files += commit.files;

      contributorMap.set(author, existing);
    }
    
    // Then process all commits to get total commit counts
    for (const commit of commits.data) {
      let author = commit.commit.author?.name || commit.author?.login || 'Unknown';
      
      // Apply same filtering as detailed commits
      if (author === 'root' || author === 'noreply@github.com' || author === 'GitHub' || 
          author.toLowerCase().includes('bot') || author.toLowerCase().includes('action') ||
          author === 'Unknown' || !author.trim()) {
        author = 'System';
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
        files: 0
      };

      // Only increment commits if we haven't already processed this commit in detailedCommits
      if (!detailedCommits.some(dc => dc.sha === commit.sha)) {
        existing.commits += 1;
      }

      contributorMap.set(author, existing);
    }

    const contributorStats = Array.from(contributorMap.values())
      .filter(contributor => contributor.name !== 'System')
      .sort((a, b) => b.commits - a.commits);

    return NextResponse.json({
      repository: `${owner}/${repo}`,
      totalCommits: commits.data.length,
      totalContributors: contributors.data.length,
      sampleCommits: detailedCommits,
      contributorStats: contributorStats,
      githubContributors: contributors.data.map(c => ({
        login: c.login,
        contributions: c.contributions,
        avatar_url: c.avatar_url,
        html_url: c.html_url
      }))
    });

  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
