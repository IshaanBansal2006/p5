import { runCommandWithOutput } from './shell.js';
import { Commit } from '../types/config.js';

export async function getCurrentBranch(): Promise<string> {
  const result = await runCommandWithOutput('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  return result.success ? result.stdout.trim() : 'main';
}

export async function getDefaultRemoteBranch(): Promise<string> {
  const result = await runCommandWithOutput('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (result.success) {
    return result.stdout.trim();
  }
  
  // Fallback to main or master
  const mainResult = await runCommandWithOutput('git', ['rev-parse', '--verify', 'refs/heads/main']);
  if (mainResult.success) {
    return 'main';
  }
  
  return 'master';
}

export async function getChangedCommitsSinceBase(baseRefOrRemote: string): Promise<Commit[]> {
  const result = await runCommandWithOutput('git', [
    'log',
    '--oneline',
    '--format=%H|%an|%ae|%s|%ad',
    '--date=iso',
    `${baseRefOrRemote}..HEAD`
  ]);
  
  if (!result.success) {
    return [];
  }
  
  const commits: Commit[] = [];
  const lines = result.stdout.trim().split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    const [sha, author, email, message, dateStr] = line.split('|');
    if (sha && author && email && message) {
      commits.push({
        sha: sha.substring(0, 8), // Short SHA
        author,
        email,
        message,
        date: new Date(dateStr)
      });
    }
  }
  
  return commits;
}

export async function getCommitFiles(sha: string): Promise<string[]> {
  const result = await runCommandWithOutput('git', ['show', '--name-only', '--format=', sha]);
  if (!result.success) {
    return [];
  }
  
  return result.stdout
    .trim()
    .split('\n')
    .filter(line => line.trim() && !line.includes('node_modules'))
    .map(line => line.trim());
}

export async function findLikelyCulprits(failingFiles: string[]): Promise<Commit[]> {
  if (failingFiles.length === 0) {
    return [];
  }
  
  const baseRef = await getDefaultRemoteBranch();
  const commits = await getChangedCommitsSinceBase(baseRef);
  
  if (commits.length === 0) {
    return [];
  }
  
  // Score commits by file overlap
  const scoredCommits = await Promise.all(
    commits.map(async (commit) => {
      const commitFiles = await getCommitFiles(commit.sha);
      const overlap = failingFiles.filter(file => 
        commitFiles.some(commitFile => 
          commitFile.includes(file) || file.includes(commitFile)
        )
      ).length;
      
      return { commit, score: overlap };
    })
  );
  
  // Sort by score (descending) then by date (descending)
  scoredCommits.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    return b.commit.date.getTime() - a.commit.date.getTime();
  });
  
  // Return top 3 suspects
  return scoredCommits
    .filter(item => item.score > 0)
    .slice(0, 3)
    .map(item => item.commit);
}

export async function isGitRepository(): Promise<boolean> {
  const result = await runCommandWithOutput('git', ['rev-parse', '--git-dir']);
  return result.success;
}

export async function initGitRepository(): Promise<boolean> {
  const result = await runCommandWithOutput('git', ['init']);
  return result.success;
}

export async function getRecentCommits(count: number = 5): Promise<Commit[]> {
  const result = await runCommandWithOutput('git', [
    'log',
    `-${count}`,
    '--oneline',
    '--format=%H|%an|%ae|%s|%ad',
    '--date=relative'
  ]);
  
  if (!result.success) {
    return [];
  }
  
  const commits: Commit[] = [];
  const lines = result.stdout.trim().split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    const [sha, author, email, message, dateStr] = line.split('|');
    if (sha && author && email && message) {
      commits.push({
        sha: sha.substring(0, 8),
        author,
        email,
        message,
        date: new Date(dateStr)
      });
    }
  }
  
  return commits;
}

export async function getContributors(count: number = 5): Promise<string[]> {
  const result = await runCommandWithOutput('git', [
    'log',
    '--format=%an',
    '--since=1.month.ago'
  ]);
  
  if (!result.success) {
    return [];
  }
  
  const authors = result.stdout
    .trim()
    .split('\n')
    .filter(line => line.trim());
  
  // Count occurrences and get unique authors
  const authorCount = new Map<string, number>();
  for (const author of authors) {
    authorCount.set(author, (authorCount.get(author) || 0) + 1);
  }
  
  // Sort by commit count and return top contributors
  return Array.from(authorCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([author]) => author);
}
