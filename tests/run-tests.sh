# cd tests && ./run-tests.sh



#!/bin/bash
# Shell script to run the cliseo automated SEO test runner

# Exit immediately if a command exits with a non-zero status
set -e

echo "Building cliseo tool..."
# Go to project root, build the CLI, then come back or run in subshell
npm run build:cli

echo "Running cliseo automated SEO test runner..."

# Get the absolute path to the tests directory
TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Install dependencies for all fixtures
echo "Installing dependencies for React fixture..."
cd "$TESTS_DIR/__fixtures__/react-app" && npm install && cd "$TESTS_DIR"

echo "Installing dependencies for Next.js fixture..."
cd "$TESTS_DIR/__fixtures__/next-app" && npm install && cd "$TESTS_DIR"

echo "Installing dependencies for Angular fixture..."
cd "$TESTS_DIR/__fixtures__/angular-app" && npm install && cd "$TESTS_DIR"

# Ensure tsx is available (it's in root devDependencies, but npx will handle it)
# We can add a specific check/install for tsx if needed, but npx should find it.

# Run the test runner using tsx
echo "Running test runner..."
npx tsx "$TESTS_DIR/run.ts" "$@"

echo "cliseo automated SEO test runner completed."