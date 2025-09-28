import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

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

    // Fetch repository information from GitHub
    const repoData = await octokit.rest.repos.get({
      owner,
      repo,
    });

    return NextResponse.json({
      stargazers_count: repoData.data.stargazers_count,
      forks_count: repoData.data.forks_count,
      name: repoData.data.name,
      full_name: repoData.data.full_name,
      description: repoData.data.description,
      language: repoData.data.language,
      updated_at: repoData.data.updated_at,
    });

  } catch (error) {
    console.error('Error fetching repo info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repository information' },
      { status: 500 }
    );
  }
}
