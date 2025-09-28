import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

// GitHub API client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

interface CommitData {
  sha: string;
  author: string;
  authorEmail?: string;
  date: string;
  message: string;
  additions: number;
  deletions: number;
  changes: number;
  avatar_url?: string;
  html_url: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const limit = parseInt(searchParams.get('limit') || '10');
    const page = parseInt(searchParams.get('page') || '1');

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing required parameters: owner and repo' },
        { status: 400 }
      );
    }

    // Get the default branch (usually main or master)
    const repoData = await octokit.rest.repos.get({ owner, repo });
    const defaultBranch = repoData.data.default_branch;

    // Get commits from the default branch with pagination
    const commits = await octokit.rest.repos.listCommits({
      owner,
      repo,
      sha: defaultBranch,
      per_page: Math.min(limit, 100), // GitHub API max is 100
      page: page
    });

    if (commits.data.length === 0) {
      return NextResponse.json({
        repository: { owner, repo, defaultBranch },
        commits: [],
        total: 0
      });
    }

    // Get detailed commit stats for each commit
    const detailedCommits: CommitData[] = [];
    for (const commit of commits.data) {
      try {
        const commitDetail = await octokit.rest.repos.getCommit({
          owner,
          repo,
          ref: commit.sha
        });

        const stats = commitDetail.data.stats;
        let author = commit.commit.author?.name || commit.author?.login || 'Unknown';
        let avatarUrl = commit.author?.avatar_url;
        
        // Filter out system users and normalize names
        if (author === 'root' || author === 'noreply@github.com' || author === 'GitHub' || 
            author.toLowerCase().includes('bot') || author.toLowerCase().includes('action') ||
            author === 'Unknown' || !author.trim()) {
          author = 'System';
          avatarUrl = undefined;
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
          date: commit.commit.author?.date || new Date().toISOString(),
          message: commit.commit.message,
          additions: stats?.additions || 0,
          deletions: stats?.deletions || 0,
          changes: stats?.total || 0,
          avatar_url: avatarUrl,
          html_url: commit.html_url
        });
      } catch (error) {
        console.warn(`Failed to get details for commit ${commit.sha}:`, error);
        // Add basic commit info even if detailed stats fail
        detailedCommits.push({
          sha: commit.sha,
          author: commit.commit.author?.name || commit.author?.login || 'Unknown',
          authorEmail: commit.commit.author?.email,
          date: commit.commit.author?.date || new Date().toISOString(),
          message: commit.commit.message,
          additions: 0,
          deletions: 0,
          changes: 0,
          avatar_url: commit.author?.avatar_url,
          html_url: commit.html_url
        });
      }
    }

    return NextResponse.json({
      repository: { owner, repo, defaultBranch },
      commits: detailedCommits,
      total: detailedCommits.length,
      page: page,
      hasMore: commits.data.length === limit, // If we got the full limit, there might be more
      nextPage: commits.data.length === limit ? page + 1 : null
    });

  } catch (error: unknown) {
    console.error('Error in commits endpoint:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
