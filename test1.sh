#!/bin/bash
set -e

# Build the CLI
npm install
npm run build:cli
npm link --force

# Run optimize