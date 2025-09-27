#!/bin/bash

echo "🧪 P5 CLI Testing Suite"
echo "======================="

# Test 1: Help commands
echo "1. Testing help commands..."
node dist/index.js --help > /dev/null && echo "✅ Help command works" || echo "❌ Help command failed"

# Test 2: Individual command help
echo "2. Testing individual command help..."
node dist/index.js test --help > /dev/null && echo "✅ Test help works" || echo "❌ Test help failed"

# Test 3: Configuration
echo "3. Testing configuration..."
node dist/index.js config set project.name "Test Project" > /dev/null && echo "✅ Config set works" || echo "❌ Config set failed"

# Test 4: README sync
echo "4. Testing README sync..."
node dist/index.js readme sync > /dev/null && echo "✅ README sync works" || echo "❌ README sync failed"

# Test 5: Test command (will fail but should handle gracefully)
echo "5. Testing test command..."
node dist/index.js test --stage pre-commit > /dev/null 2>&1 && echo "✅ Test command works" || echo "⚠️  Test command failed (expected - no eslint config)"

echo ""
echo "🎉 Testing complete! Check results above."
