import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { cmdDevpostGen } from './commands/devpostGen.js';
import { cmdReadmeSync } from './commands/readmeSync.js';

export async function runCLI(): Promise<void> {
  await yargs(hideBin(process.argv))
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