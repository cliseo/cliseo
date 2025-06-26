<img height="80" src="https://cliseo.com/Standalone Logo.png">

[![AGPL License](https://img.shields.io/badge/license-AGPL-blue.svg)](http://www.gnu.org/licenses/agpl-3.0)
[![npm](https://img.shields.io/npm/dt/cliseo.svg)](https://www.npmjs.com/package/cliseo)
[![GitHub stars](https://img.shields.io/github/stars/cliseo/cliseo.svg)](https://github.com/cliseo/cliseo/stargazers)
[![E2E Tests](https://github.com/cliseo/cliseo/actions/workflows/e2e-tests.yml/badge.svg)](https://github.com/cliseo/cliseo/actions/workflows/e2e-tests.yml)

[Website](https://cliseo.com) | [Documentation](https://cliseo.com/docs/) | [Github](https://github.com/cliseo/cliseo)


> Free SEO Optimization CLI for JavaScript/TypeScript Projects (AI features coming soon!)

## 🚀 Features

### Current Features
- 🔍 Deep scanning of React, Next.js, and plain HTML/JSX/TSX projects
- 🛠️ Automatic SEO fixes for common issues
- 📁 SEO file generation (robots.txt, sitemap.xml)
- ⚡ Cross-platform support

### Coming Soon
- 🤖 AI-powered SEO analysis and optimization
- 📊 SEO performance tracking and metrics
- 🔄 GitHub integration with automated PR creation
- 📈 Google Search Console integration

## 📦 Installation

```bash
npm install -g cliseo
```

## 🎯 Quick Start

1. Scan your project for SEO issues:
```bash
cliseo scan
```

2. Apply optimizations:
```bash
cliseo optimize
```

## 🛠️ Commands

### `cliseo scan`
Performs an SEO audit of your project.

Options:
- `--verbose`: Show detailed output
- `--json`: Output results in JSON format

### `cliseo optimize`
Automatically applies SEO fixes to your codebase.

## 🤝 Contribute

We welcome contributions of all kinds to **Cliseo** — whether it's fixing bugs, adding new features, improving performance, or even enhancing the documentation!

### How to Contribute

1. **Fork this repo** and clone your fork.
2. Create a new branch for your feature or fix:
   ```bash
   git checkout -b your-feature-name
   ```
3. Make your changes and commit them with clear messages.
4. Push to your fork:
   ```bash
   git push origin your-feature-name
   ```
5. Open a Pull Request to the `main` branch of this repo.

### Contribution Guidelines

- 📑 Keep your code clean and well-commented.
- 💡 If adding a new feature, include a brief description in the PR.
- 🪲 If fixing a bug, describe the issue and how your fix solves it.
- 🧪 Run any relevant tests (or add some if they don't exist!).
  - Tests for React and Next applications can be found in `./tests/run-tests.sh`
- ❌ Avoid making large unrelated changes in a single PR.

### Not Sure Where to Start?

Check out the [Issues](../../issues) tab for things marked with:

- `good first issue`
- `help wanted`
