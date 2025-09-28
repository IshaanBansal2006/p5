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

    // Validate required parameters
    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing required parameters: owner and repo' },
        { status: 400 }
      );
    }

    // Get the default branch (usually main or master)
    const repoData = await octokit.rest.repos.get({ owner, repo });
    const defaultBranch = repoData.data.default_branch;

    // Get the latest commit from the default branch
    const commits = await octokit.rest.repos.listCommits({
      owner,
      repo,
      sha: defaultBranch,
      per_page: 1
    });

    if (commits.data.length === 0) {
      return NextResponse.json(
        { error: 'No commits found for the default branch' },
        { status: 404 }
      );
    }

    const lastCommit = commits.data[0];
    const lastCommitDate = lastCommit.commit.author?.date || lastCommit.commit.committer?.date;

    if (!lastCommitDate) {
      return NextResponse.json(
        { error: 'Could not determine last commit date' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      owner,
      repo,
      defaultBranch,
      lastCommit: {
        sha: lastCommit.sha,
        author: lastCommit.commit.author?.name || lastCommit.author?.login || 'Unknown',
        date: lastCommitDate,
        message: lastCommit.commit.message
      }
    });

  } catch (error: unknown) {
    console.error('Error in last-commit endpoint:', error);
    
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
