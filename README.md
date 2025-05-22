# cliseo

[![AGPL License](https://img.shields.io/badge/license-AGPL-blue.svg)](http://www.gnu.org/licenses/agpl-3.0)
[![npm](https://img.shields.io/npm/dt/cliseo.svg)](https://www.npmjs.com/package/cliseo)
[![GitHub stars](https://img.shields.io/github/stars/ryanjhermes/cliseo.svg)](https://github.com/ryanjhermes/cliseo/stargazers)

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

Options:
- `--dry-run`: Preview changes without applying
- `--yes`: Skip confirmation prompts

## ⚙️ Configuration

Create `.cliseorc.json` in your project root:

```json
{
  "seoDirectory": true,
  "tracking": {
    "anonymous": true
  }
}
```

## 📊 SEO Directory Structure

```
/seo
├── structured-data/
│   ├── product.json
│   ├── article.json
├── robots.txt
└── sitemap.xml
```

## 🔍 What Gets Optimized

### React/Next.js Projects
- Meta tag management with react-helmet
- Image alt text optimization
- Link accessibility improvements
- Schema.org markup injection
- Semantic HTML structure

### Static HTML
- Title tag optimization
- Meta description management
- Viewport configuration
- Image alt attributes
- Basic SEO structure

## 📄 License

[AGPL-3.0](LICENSE)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📫 Support

- Documentation: [https://docs.cliseo.dev](https://docs.cliseo.dev)
- Issues: [GitHub Issues](https://github.com/ryanjhermes/cliseo/issues)
- Email: support@cliseo.dev

## 🚧 Development Status

This project is actively maintained. AI features are in development and will be released in future versions. The current version focuses on providing reliable, rule-based SEO optimizations.
