# P5 CLI — Hackathon DevFlow-in-a-Box

A Node/TypeScript CLI published as an npm dev dependency for hackathon development workflows.

<!-- P5:STATUS:start -->
_Last updated: 9/27/2025, 10:47:58 AM on branch `main`_


<!-- P5:STATUS:end -->

## Features

- **p5 init** – Scaffold config, hooks, CI, templates
- **p5 test** – Local build + lint + typecheck + Playwright smoke
- **p5 readme sync** – Auto-update marked README sections
- **p5 devpost gen** – Generate/update DEVPOST.md
- **p5 pw:record** – Open Playwright recorder and save a spec
- **p5 config set** – Set config keys (writes to p5.config.ts or .p5rc.json)

## Installation

```bash
npm install -D @p5/cli
```

## Quick Start

```bash
# Initialize P5 in your project
npx p5 init

# Run tests
npx p5 test

# Sync README with latest info
npx p5 readme sync

# Generate Devpost draft
npx p5 devpost gen

# Record Playwright tests
npx p5 pw:record
```

## Commands

### `p5 init`

Scaffolds a complete development workflow:

- Creates `p5.config.ts` with project configuration
- Sets up GitHub Actions workflow (`.github/workflows/p5-ci.yml`)
- Installs and configures Husky git hooks
- Creates Playwright configuration and smoke tests
- Adds npm scripts to your `package.json`
- Updates README with P5 markers

### `p5 test [--stage <stage>]`

Runs tests based on the configured stage:

- `pre-commit`: Runs lint and typecheck
- `pre-push`: Runs build and e2e smoke tests
- `ci`: Runs all tests (union of pre-commit and pre-push)

### `p5 readme sync`

Updates README sections marked with P5 comments:

- **STATUS**: Build badges, last run time, demo links
- **COMMITS**: Recent commits and contributors

### `p5 devpost gen`

Generates a Devpost draft with:

- Auto-detected technologies from your project
- Interactive prompts for project details
- Pre-filled sections based on your config

### `p5 pw:record`

Opens Playwright's codegen tool for recording tests:

- Automatically installs Playwright if needed
- Saves recorded tests as smoke tests
- Normalizes test content for reliability

### `p5 config set <key> <value>`

Updates configuration values using dot notation:

```bash
npx p5 config set project.repo "owner/repo"
npx p5 config set notifications.provider "slack"
npx p5 config set notifications.webhook "https://hooks.slack.com/..."
```

## Configuration

P5 uses `p5.config.ts` (preferred) or `.p5rc.json`:

```typescript
export default {
  project: {
    name: "My Hackathon Project",
    tagline: "An amazing hackathon project",
    repo: "owner/repo",
    demoUrl: "https://myproject.vercel.app"
  },
  tests: {
    preCommit: ["lint", "typecheck"],
    prePush: ["build", "e2e:smoke"]
  },
  notifications: {
    provider: "slack", // "slack" | "discord" | "none"
    webhook: "https://hooks.slack.com/..."
  },
  readme: {
    sections: ["STATUS", "COMMITS"]
  }
} satisfies P5Config;
```

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Node >= 18
- **Bundler**: esbuild
- **Testing**: Playwright for e2e
- **Git Hooks**: Husky
- **CI/CD**: GitHub Actions

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Watch mode
npm run dev
```

## License

MIT

<!-- P5:COMMITS:start -->
### Recent Commits

- `0db479cc` Initial commit — Ishaan Bansal (Invalid Date)

### Contributors

- Ishaan Bansal


<!-- P5:COMMITS:end -->
