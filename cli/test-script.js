#!/usr/bin/env node

// Test script for P5 CLI
const { spawn } = require('child_process');

async function runTest() {
  console.log('🧪 Testing P5 CLI...\n');
  
  // Test 1: Help command
  console.log('1. Testing help command...');
  await runCommand(['node', 'dist/index.js', '--help']);
  
  // Test 2: Test command help
  console.log('\n2. Testing test command help...');
  await runCommand(['node', 'dist/index.js', 'test', '--help']);
  
  // Test 3: Config set
  console.log('\n3. Testing config set...');
  await runCommand(['node', 'dist/index.js', 'config', 'set', 'project.name', 'Test Project']);
  
  // Test 4: Readme sync
  console.log('\n4. Testing readme sync...');
  await runCommand(['node', 'dist/index.js', 'readme', 'sync']);
  
  console.log('\n✅ All tests completed!');
}

function runCommand(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(args[0], args.slice(1), {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}

runTest().catch(console.error);
