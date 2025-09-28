import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { cmdDevpostGen } from './commands/devpostGen.js';
import { cmdReadmeSync } from './commands/readmeSync.js';
import { cmdInit } from './commands/init.js';
import { cmdTest } from './commands/test.js';
import { cmdDashboard } from './commands/dashboard.js';

export async function runCLI(): Promise<void> {
  await yargs(hideBin(process.argv))
    .command(
      'init',
      'Initialize P5 project with full setup',
      (yargs) => {
        return yargs
          .option('server', {
            alias: 's',
            describe: 'Server URL for P5 APIs',
            type: 'string',
            default: 'http://localhost:3000'
          });
      },
      async (args) => {
        await cmdInit(args);
      }
    )
    .command(
      'test [stage]',
      'Run project tests',
      (yargs) => {
        return yargs
          .positional('stage', {
            describe: 'Test stage to run',
            type: 'string',
            choices: ['pre-commit', 'pre-push', 'ci']
          })
          .option('all', {
            alias: 'a',
            describe: 'Run all available tests',
            type: 'boolean',
            default: false
          });
      },
      async (args) => {
        await cmdTest(args);
      }
    )
    .command(
      'dashboard [owner] [repo]',
      'Open P5 dashboard for repository',
      (yargs) => {
        return yargs
          .positional('owner', {
            describe: 'GitHub repository owner',
            type: 'string'
          })
          .positional('repo', {
            describe: 'GitHub repository name',
            type: 'string'
          })
          .option('open', {
            alias: 'o',
            describe: 'Automatically open dashboard in browser',
            type: 'boolean',
            default: false
          });
      },
      async (args) => {
        await cmdDashboard(args);
      }
    )
    .command(
      'devpost gen [owner] [repo]',
      'Generate Devpost draft',
      (yargs) => {
        return yargs
          .positional('owner', {
            describe: 'GitHub repository owner',
            type: 'string'
          })
          .positional('repo', {
            describe: 'GitHub repository name',
            type: 'string'
          })
          .option('server', {
            alias: 's',
            describe: 'Server URL for devpost API',
            type: 'string',
            default: 'http://localhost:3000'
          });
      },
      async (args) => {
        await cmdDevpostGen(args);
      }
    )
    .command(
      'readme sync [owner] [repo]',
      'Generate and sync README.md file',
      (yargs) => {
        return yargs
          .positional('owner', {
            describe: 'GitHub repository owner',
            type: 'string'
          })
          .positional('repo', {
            describe: 'GitHub repository name',
            type: 'string'
          })
          .option('server', {
            alias: 's',
            describe: 'Server URL for README API',
            type: 'string',
            default: 'http://localhost:3000'
          });
      },
      async (args) => {
        await cmdReadmeSync(args);
      }
    )
    .demandCommand(1, 'You need at least one command before moving on')
    .help()
    .argv;
}