# cliseo

[![AGPL License](https://img.shields.io/badge/license-AGPL-blue.svg)](http://www.gnu.org/licenses/agpl-3.0)
[![npm](https://img.shields.io/npm/dt/cliseo.svg)](https://www.npmjs.com/package/cliseo)
[![GitHub stars](https://img.shields.io/github/stars/yourusername/cliseo.svg)](https://github.com/yourusername/cliseo/stargazers)

> Instant AI-Powered SEO Optimization CLI for JavaScript/TypeScript Projects

## 🚀 Features

- 🤖 AI-powered SEO analysis and optimization
- 🔍 Deep scanning of React, Next.js, Astro, and plain HTML/JSX/TSX projects
- 🛠️ Automatic SEO fixes with AI-generated improvements
- 📊 SEO performance tracking and metrics
- 🔄 GitHub integration with automated PR creation
- 📁 Structured `/seo` directory generation
- ⚡ Cross-platform support

## 📦 Installation

```bash
npm install -g cliseo
```

## 🎯 Quick Start

1. Scan your project for SEO issues:
```bash
cliseo scan --ai
```

2. Apply AI-powered optimizations:
```bash
cliseo optimize --ai --model=gpt-4
```

## 🛠️ Commands

### `cliseo scan`
Performs an SEO audit of your project.

Options:
- `--ai`: Enable AI-powered deep analysis
- `--verbose`: Show detailed output
- `--json`: Output results in JSON format

### `cliseo optimize`
Automatically applies SEO fixes to your codebase.

Options:
- `--ai`: Use AI for generating improvements
- `--model=<model>`: Select AI model (gpt-4, gpt-3.5)
- `--git-pr`: Create a Git PR with changes
- `--dry-run`: Preview changes without applying
- `--yes`: Skip confirmation prompts

## ⚙️ Configuration

Create `.cliseorc.json` in your project root:

```json
{
  "aiModel": "gpt-4",
  "createPRs": true,
  "seoDirectory": true,
  "tracking": {
    "anonymous": true,
    "searchConsole": false
  }
}
```

## 📊 SEO Directory Structure

```
/seo
├── structured-data/
│   ├── product.json
│   ├── article.json
│   └── faq.json
├── robots.txt
└── sitemap.xml
```

## 🔑 Authentication

1. Run `cliseo auth` to authenticate with GitHub
2. Follow the prompts to complete OAuth flow
3. Your API key will be stored securely

## 📈 Analytics

Connect to Google Search Console for SEO performance tracking:

```bash
cliseo connect --google-search-console
```

## 📄 License

- Core CLI (Rule-based engine): [AGPL-3.0](LICENSE)
- AI Backend & Premium Features: Commercial License

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📫 Support

- Documentation: [https://docs.cliseo.dev](https://docs.cliseo.dev)
- Issues: [GitHub Issues](https://github.com/yourusername/cliseo/issues)
- Email: support@cliseo.dev
