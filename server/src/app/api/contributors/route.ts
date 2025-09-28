import { NextRequest, NextResponse } from 'next/server';

interface GitHubContributor {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  contributions: number;
}

interface Contributor {
  login: string;
  id: number;
  avatarUrl: string;
  profileUrl: string;
  contributions: number;
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

    // Fetch contributors from GitHub API
    const githubResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contributors`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'P5-BuildGuard',
          ...(process.env.GITHUB_TOKEN && {
            'Authorization': `token ${process.env.GITHUB_TOKEN}`
          })
        }
      }
    );

    if (!githubResponse.ok) {
      if (githubResponse.status === 404) {
        return NextResponse.json(
          { error: 'Repository not found' },
          { status: 404 }
        );
      }
      
      if (githubResponse.status === 403) {
        return NextResponse.json(
          { error: 'GitHub API rate limit exceeded' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to fetch contributors from GitHub' },
        { status: githubResponse.status }
      );
    }

    const githubContributors: GitHubContributor[] = await githubResponse.json();

    // Transform GitHub contributors to our format
    const contributors: Contributor[] = githubContributors.map(contributor => ({
      login: contributor.login,
      id: contributor.id,
      avatarUrl: contributor.avatar_url,
      profileUrl: contributor.html_url,
      contributions: contributor.contributions
    }));

    return NextResponse.json({
      contributors,
      totalContributors: contributors.length,
      repository: `${owner}/${repo}`
    });

  } catch (error) {
    console.error('Error fetching contributors:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


