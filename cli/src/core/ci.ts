import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

export function createGitHubWorkflow(projectRoot: string): void {
  const workflowDir = join(projectRoot, '.github', 'workflows');
  const workflowPath = join(workflowDir, 'p5-ci.yml');
  
  if (existsSync(workflowPath)) {
    console.log(chalk.blue('ℹ️  GitHub workflow already exists'));
    return;
  }
  
  // Ensure .github/workflows directory exists
  if (!existsSync(workflowDir)) {
    mkdirSync(workflowDir, { recursive: true });
  }
  
  const workflowContent = `name: P5 CI
on:
  pull_request:
  push:
    branches: [ main, master ]
jobs:
  p5:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci || npm i
      - run: npx playwright install --with-deps
      - run: npx p5 test --stage ci
      - name: Sync README (main only)
        if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
        run: npx p5 readme sync
      - name: Post Failure Comment
        if: failure() && github.event_name == 'pull_request'
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: node -e "import('./dist/index.js').then(m=>m.default?.postCiFailure?.()).catch(()=>{})"
`;

  writeFileSync(workflowPath, workflowContent);
  console.log(chalk.green('✅ GitHub workflow created'));
}

export async function createHuskyHooks(projectRoot: string): Promise<void> {
  const huskyDir = join(projectRoot, '.husky');
  const preCommitPath = join(huskyDir, 'pre-commit');
  const prePushPath = join(huskyDir, 'pre-push');
  
  // Ensure .husky directory exists
  if (!existsSync(huskyDir)) {
    mkdirSync(huskyDir, { recursive: true });
  }
  
  // Create pre-commit hook
  if (!existsSync(preCommitPath)) {
    const preCommitContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
npx p5 test --stage pre-commit
`;
    writeFileSync(preCommitPath, preCommitContent);
    // Make executable
    const { chmod } = await import('fs');
    chmod(preCommitPath, 0o755, () => {});
    console.log(chalk.green('✅ Pre-commit hook created'));
  }
  
  // Create pre-push hook
  if (!existsSync(prePushPath)) {
    const prePushContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
npx p5 test --stage pre-push
`;
    writeFileSync(prePushPath, prePushContent);
    // Make executable
    const { chmod } = await import('fs');
    chmod(prePushPath, 0o755, () => {});
    console.log(chalk.green('✅ Pre-push hook created'));
  }
}

export async function ensureHuskyInstalled(projectRoot: string): Promise<boolean> {
  const packageJsonPath = join(projectRoot, 'package.json');
  
  if (!existsSync(packageJsonPath)) {
    return false;
  }
  
  try {
    const packageJson = JSON.parse(require('fs').readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.devDependencies?.husky || packageJson.dependencies?.husky;
  } catch {
    return false;
  }
}

export async function installHusky(_projectRoot: string): Promise<boolean> {
  const { runCommand } = await import('./shell.js');
  
  console.log(chalk.blue('📦 Installing husky...'));
  const result = await runCommand('npm', ['install', '--save-dev', 'husky']);
  
  if (result.success) {
    // Initialize husky
    await runCommand('npx', ['husky', 'init']);
    console.log(chalk.green('✅ Husky installed and initialized'));
  }
  
  return result.success;
}
