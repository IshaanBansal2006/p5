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
            default: 'https://www.player5.dev'
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
      'devpost', // Base command for devpost
      'Devpost utilities',
      (yargs) => {
        // Sub-command for 'gen'
        return yargs.command(
          // Updated command: 'gen [action] [owner] [repo]'
          'gen [action] [owner] [repo]',
          'Generate Devpost draft (use "new" for localhost testing)',
          (yargs) => {
            return yargs
              .positional('action', { // Added new positional argument
                describe: 'Action to perform (e.g., "new")',
                type: 'string',
                choices: ['new'],
                default: undefined
              })
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
                default: 'https://www.player5.dev'
              });
          },
          async (args) => {
            // Logic to override the server option if 'action' is 'new'
            if (args.action === 'new') {
              args.server = 'http://localhost:3000';
            }
            
            // The rest of the arguments (owner, repo, server, etc.) are passed along
            await cmdDevpostGen(args);
          }
        ).demandCommand(1, 'Please specify a devpost subcommand like "gen"'); // Ensure a subcommand is provided
      }
    ) // The 'devpost' command block ends here
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
            default: 'https://www.player5.dev'
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