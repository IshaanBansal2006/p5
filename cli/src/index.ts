import { runCLI } from './cli.js';

runCLI().catch(e => {
  console.error(e);
  process.exit(1);
});
