<div style="margin-bottom: 16px;">
  <img src="https://cliseo.com/README%20Logo.png?v=2025" width="688px" style="border: none;">
</div>


[![Website](https://img.shields.io/website?url=https%3A%2F%2Fcliseo.com&up_message=cliseo.com&up_color=blue)](https://cliseo.com)
[![Documentation](https://img.shields.io/badge/docs-read-blue)](https://cliseo.com/docs/)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL%20V3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0.en.html)
[![npm version](https://img.shields.io/npm/v/cliseo.svg)](https://www.npmjs.com/package/cliseo)
[![GitHub stars](https://img.shields.io/github/stars/cliseo/cliseo.svg)](https://github.com/cliseo//cliseo/stargazers)
[![npm downloads](https://img.shields.io/npm/dt/cliseo.svg)](https://www.npmjs.com/package/cliseo)

### SEO Optimization CLI for JavaScript/TypeScript Projects 

[Show our GitHub some love 🔗](https://github.com/cliseo/cliseo)

<img src="https://cliseo.com/Diff.png?v=2025" width="700px" style="border: none;">
 

Most developers know SEO matters, but it’s often overlooked or left until the end— especially in modern frontend frameworks. Cliseo makes technical SEO automatic and accessible by detecting your framework (React, Next.js, Angular soon) and injecting essential elements like meta tags, alt text, JSON-LD schema, sitemap.xml, and robots.txt.

The goal isn’t to guarantee search rankings, but to ensure your site meets baseline SEO standards and is fully crawlable by search engines. Cliseo helps bring your Google Lighthouse SEO score to 100, giving your content, keywords, and link-building efforts a strong technical foundation to build on.

## ✨ Features

### 🔍 Framework Detection & Scanning
- **Smart Framework Detection**: Automatically detects React, Next.js, Vue 3, and HTML projects
- **Comprehensive SEO Audit**: Scans for missing meta tags, alt attributes, canonical links, schema markup, and semantic HTML issues
- **Component-Level Analysis**: Deep scanning of page components and routes
- **Detailed Issue Reporting**: Clear, actionable feedback with specific fix recommendations

### 🛠️ Intelligent Optimizations
- **SEO File Generation**: Creates optimized `robots.txt` and `sitemap.xml` files
- **Meta Tag Injection**: Automatically adds title, description, viewport, and Open Graph tags
- **Schema.org Markup**: Injects JSON-LD structured data for better search results
- **Image Alt Text**: Adds descriptive alt attributes to images
- **Semantic HTML**: Suggests improvements for better accessibility and SEO

### 🤖 AI-Powered Features (Premium)
- **AI Content Analysis**: Advanced project understanding and context-aware optimizations
- **Smart Metadata Generation**: AI-generated titles, descriptions, and keywords based on your content
- **Custom SEO Recommendations**: Personalized suggestions tailored to your specific project
- **Enhanced Schema Markup**: AI-driven structured data optimization

### 🎯 Framework-Specific Support
- **React**: React Helmet integration with JSX-aware optimization
- **Next.js**: App Router and Pages Router support with metadata API integration
- **Vue 3**: Vue-meta integration with Composition API support
- **HTML**: Direct manipulation for static sites and legacy projects

### 🔐 Authentication & Services
- **Secure Authentication**: OAuth integration with Google and GitHub
- **Email Verification**: Enhanced security for AI features
- **Service Connections**: Future Google Search Console integration

## 📦 Installation

Install globally for easy access from any project:

```bash
npm install -g cliseo
```

## 🎯 Quick Start

1. **Scan your project** for SEO issues:
```bash
cliseo scan
```

2. **Apply optimizations** automatically:
```bash
cliseo optimize
```

3. **Use AI features** (requires authentication):
```bash
cliseo scan --ai
cliseo optimize --ai
```

## 🛠️ Command Reference

### `cliseo scan [options]`
Performs a comprehensive SEO audit of your project.

**Options:**
- `--ai`: Enable AI-powered deep analysis (requires authentication)
- `--verbose`: Show detailed output and debugging information
- `--json`: Output results in JSON format for automation

**Example output:**
```
Detected Framework: REACT
✅ Found 12 files to scan
⚠️  Missing meta description in src/pages/About.tsx
🤖 AI Suggestion: Add product schema markup for better e-commerce visibility
```

### `cliseo optimize [directory] [options]`
Automatically applies SEO improvements to your codebase.

**Options:**
- `--ai`: Use AI for intelligent, context-aware optimizations (requires authentication)
- `--dry-run`: Preview changes without applying them
- `--yes`: Skip confirmation prompts (useful for CI/CD)

**What it does:**
- Creates/updates `robots.txt` and `sitemap.xml`
- Injects framework-appropriate meta tags
- Adds missing alt attributes to images
- Installs and configures SEO libraries (react-helmet, vue-meta)

### `cliseo auth`
Manage authentication for AI-powered features.

**Features:**
- Sign in with Google or GitHub
- View account status and AI access
- Manage email verification
- Upgrade to premium plans

### `cliseo verify-email`
Send or check email verification status for AI features.

### `cliseo connect [options]`
Connect external services (Coming Soon).

**Options:**
- `--google-search-console`: Connect Google Search Console

## 🤝 Contribute

We welcome contributions of all kinds to **cliseo** — whether it's fixing bugs, adding new features, improving performance, or even enhancing the documentation!

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

</div>
