import { runCLI } from './cli.js';

runCLI().catch((e: Error) => {
  console.error('CLI Error:', e.message);
  process.exit(1);
});