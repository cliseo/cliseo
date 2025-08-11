# cd tests && ./run-tests.sh



#!/bin/bash
# Shell script to run the cliseo automated SEO test runner

# Exit immediately if a command exits with a non-zero status
set -e

echo "Building cliseo tool..."
# Clean previous build and rebuild
rm -rf dist/
npm run build:cli

# Verify the build was successful
if [ ! -f "dist/cli/cli.js" ]; then
  echo "ERROR: CLI build failed - dist/cli/cli.js not found"
  exit 1
fi

echo "CLI build successful!"

echo "Running cliseo automated SEO test runner..."

# Get the absolute path to the tests directory
TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Pre-install dependencies for all fixtures (if not already installed)
echo "Checking React fixture dependencies..."
if [ ! -d "$TESTS_DIR/__fixtures__/react-app/node_modules" ]; then
  echo "Installing dependencies for React fixture..."
  cd "$TESTS_DIR/__fixtures__/react-app" && npm install --prefer-offline && cd "$TESTS_DIR"
else
  echo "React fixture dependencies already installed, skipping..."
fi

echo "Checking Next.js fixture dependencies..."
if [ ! -d "$TESTS_DIR/__fixtures__/next-app/node_modules" ]; then
  echo "Installing dependencies for Next.js fixture..."
  cd "$TESTS_DIR/__fixtures__/next-app" && npm install --prefer-offline && cd "$TESTS_DIR"
else
  echo "Next.js fixture dependencies already installed, skipping..."
fi

# Ensure tsx is available (it's in root devDependencies, but npx will handle it)
# We can add a specific check/install for tsx if needed, but npx should find it.

# Run the test runner using tsx
echo "Running test runner..."
npx tsx "$TESTS_DIR/run.ts" "$@"

echo "cliseo automated SEO test runner completed."