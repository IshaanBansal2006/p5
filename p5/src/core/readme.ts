import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { P5Config } from '../types/config.js';
import { getRecentCommits, getContributors } from './git.js';
import chalk from 'chalk';

const STATUS_MARKER_START = '<!-- P5:STATUS:start -->';
const STATUS_MARKER_END = '<!-- P5:STATUS:end -->';
const COMMITS_MARKER_START = '<!-- P5:COMMITS:start -->';
const COMMITS_MARKER_END = '<!-- P5:COMMITS:end -->';

export function replaceBetweenMarkers(
  content: string,
  startMarker: string,
  endMarker: string,
  newContent: string
): string {
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);
  
  if (startIndex === -1 || endIndex === -1) {
    return content;
  }
  
  const before = content.substring(0, startIndex + startMarker.length);
  const after = content.substring(endIndex);
  
  return before + '\n' + newContent + '\n' + after;
}

export async function generateStatusSection(config: P5Config): Promise<string> {
  const now = new Date().toLocaleString();
  const branch = process.env.GITHUB_REF_NAME || 'main';
  
  let statusContent = `_Last updated: ${now} on branch \`${branch}\`_\n\n`;
  
  if (config.project.repo) {
    const badgeUrl = `https://img.shields.io/github/actions/workflow/status/${config.project.repo}/p5-ci.yml`;
    statusContent += `![P5 CI](${badgeUrl})\n\n`;
  }
  
  if (config.project.demoUrl) {
    statusContent += `🚀 [Live Demo](${config.project.demoUrl})\n\n`;
  }
  
  return statusContent;
}

export async function generateCommitsSection(): Promise<string> {
  const commits = await getRecentCommits(5);
  const contributors = await getContributors(5);
  
  let commitsContent = '### Recent Commits\n\n';
  
  if (commits.length === 0) {
    commitsContent += '_No recent commits found._\n\n';
  } else {
    for (const commit of commits) {
      const timeAgo = getRelativeTime(commit.date);
      commitsContent += `- \`${commit.sha}\` ${commit.message} — ${commit.author} (${timeAgo})\n`;
    }
    commitsContent += '\n';
  }
  
  commitsContent += '### Contributors\n\n';
  
  if (contributors.length === 0) {
    commitsContent += '_No contributors found._\n\n';
  } else {
    commitsContent += contributors.map(contributor => `- ${contributor}`).join('\n') + '\n\n';
  }
  
  return commitsContent;
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export async function syncReadme(projectRoot: string, config: P5Config): Promise<void> {
  const readmePath = join(projectRoot, 'README.md');
  
  if (!existsSync(readmePath)) {
    console.log(chalk.yellow('⚠️  README.md not found, creating from template...'));
    await createReadmeFromTemplate(projectRoot, config);
    return;
  }
  
  let content = readFileSync(readmePath, 'utf-8');
  let updated = false;
  
  if (config.readme.sections.includes('STATUS')) {
    const statusContent = await generateStatusSection(config);
    const newContent = replaceBetweenMarkers(content, STATUS_MARKER_START, STATUS_MARKER_END, statusContent);
    if (newContent !== content) {
      content = newContent;
      updated = true;
    }
  }
  
  if (config.readme.sections.includes('COMMITS')) {
    const commitsContent = await generateCommitsSection();
    const newContent = replaceBetweenMarkers(content, COMMITS_MARKER_START, COMMITS_MARKER_END, commitsContent);
    if (newContent !== content) {
      content = newContent;
      updated = true;
    }
  }
  
  if (updated) {
    writeFileSync(readmePath, content);
    console.log(chalk.green('✅ README.md updated successfully'));
  } else {
    console.log(chalk.blue('ℹ️  README.md is already up to date'));
  }
}

async function createReadmeFromTemplate(projectRoot: string, config: P5Config): Promise<void> {
  const readmePath = join(projectRoot, 'README.md');
  
  const statusContent = await generateStatusSection(config);
  const commitsContent = await generateCommitsSection();
  
  const readmeContent = `# ${config.project.name}

${config.project.tagline || 'A hackathon project built with P5'}

${STATUS_MARKER_START}
${statusContent}
${STATUS_MARKER_END}

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Development

This project uses P5 for automated testing and development workflows.

\`\`\`bash
# Run tests
npx p5 test

# Sync README
npx p5 readme sync

# Generate Devpost
npx p5 devpost gen
\`\`\`

${COMMITS_MARKER_START}
${commitsContent}
${COMMITS_MARKER_END}
`;

  writeFileSync(readmePath, readmeContent);
  console.log(chalk.green('✅ README.md created from template'));
}
