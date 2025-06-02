# cd tests && ./run-tests.sh



#!/bin/bash
# Shell script to run the CLISEO automated SEO test runner

# Exit immediately if a command exits with a non-zero status
set -e

echo "Building CLISEO tool..."
# Go to project root, build the CLI, then come back or run in subshell
npm run build:cli

echo "Running CLISEO automated SEO test runner..."

# Install dependencies for all fixtures
echo "Installing dependencies for React fixture..."
cd tests/__fixtures__/react-app && npm install && cd ../..

echo "Installing dependencies for Next.js fixture..."
cd ../tests/__fixtures__/next-app && npm install && cd ../../

echo "Installing dependencies for Angular fixture..."
cd ../tests/__fixtures__/angular-app && npm install && cd ../../

# Ensure tsx is available (it's in root devDependencies, but npx will handle it)
# We can add a specific check/install for tsx if needed, but npx should find it.

# Run the test runner using tsx
echo "Running test runner..."
npx tsx ./run.ts "$@"

echo "CLISEO automated SEO test runner completed."