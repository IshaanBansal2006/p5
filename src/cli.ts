import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { cmdInit } from './commands/init.js';
import { cmdTest } from './commands/test.js';
import { cmdReadmeSync } from './commands/readmeSync.js';
import { cmdDevpostGen } from './commands/devpostGen.js';
import { cmdPwRecord } from './commands/pwRecord.js';
import { cmdConfigSet } from './commands/configSet.js';

export async function runCLI() {
  await yargs(hideBin(process.argv))
    .scriptName('p5')
    .usage('$0 <command> [options]')
    .command('init', 'Scaffold config, hooks, CI, templates', {}, cmdInit)
    .command('test', 'Run local build + quick smoke', (yargs) => {
      return yargs.option('stage', {
        type: 'string',
        choices: ['pre-commit', 'pre-push', 'ci'],
        description: 'Test stage'
      });
    }, (argv) => cmdTest(argv.stage))
    .command('readme sync', 'Update README marked sections', {}, cmdReadmeSync)
    .command('devpost gen', 'Generate Devpost draft', {}, cmdDevpostGen)
    .command('pw:record', 'Open Playwright recorder and save a spec', {}, cmdPwRecord)
    .command('config set <key> <value>', 'Set config values', {}, (argv) => cmdConfigSet(argv.key as string, argv.value as string))
    .version('0.1.0')
    .help()
    .parseAsync();
}
