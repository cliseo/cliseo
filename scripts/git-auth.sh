#!/usr/bin/env bash
# Git credential helper for Amplify build: returns a tokenized URL so Git can
# authenticate to GitHub for private submodules. GH_PAT must be set in the
# environment variables inside Amplify.

echo "https://x-access-token:${GH_PAT}@github.com" 