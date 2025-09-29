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
- **SEO File Generation**: Creates `robots.txt`, `sitemap.xml`, and `llms.txt` with sensible placeholders
- **Baseline Head Bundle**: Ensures title, meta description, robots, canonical, Open Graph, and Twitter tags across HTML, React, Next.js, and Vue
- **Image Alt Text**: Adds descriptive alt attributes to images when missing
- **Accessible Headings**: Adds a fallback `<h1>` when a page has none
- **Semantic Suggestions**: Highlights opportunities to improve structural markup during scans

### 🤖 AI-Powered Features (Premium)
- **Context-Aware Metadata**: Generates titles, descriptions, canonical URLs, and social tags that reflect each page
- **Framework-Aware Injection**: Writes metadata into React Helmet, Next.js metadata/head blocks, and Vue Teleport sections
- **Adaptive Image Alt Text**: Suggests descriptive alt attributes based on the surrounding content
- **Structured Data Guidance**: Provides JSON-LD blocks when enough context exists for safe inference
- **Actionable Summaries**: Highlights remaining manual opportunities after AI optimizations run

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

**What `cliseo optimize` Adds**
- `robots.txt`, `sitemap.xml`, and `llms.txt` if missing, using safe placeholders you can customize later
- A baseline head bundle (title, meta description, robots, canonical, Open Graph, Twitter) across HTML, React, Next.js, and Vue
- Alt attributes for images without descriptions
- A fallback `<h1>` near the top of each page when none exists

**What `cliseo scan` Reports**
- Missing meta descriptions, language attributes, and H1s that still need attention
- Images that are still missing alt text
- Missing SEO files (`robots.txt`, `sitemap.xml`, `llms.txt`)
- Framework-specific warnings that the optimizer cannot auto-fix

Run `cliseo scan` first to see the current gaps, then `cliseo optimize` (with or without `--ai`) to apply fixes.

1. **Scan your project** for SEO issues:
```bash
cliseo scan
```

2. **Apply optimizations** automatically:
```bash
cliseo optimize
```

## 🛠️ Command Reference

### `cliseo scan [options]`
Performs an SEO audit of your project.

**Options:**
- `--json`: Output results in JSON format

**Examples:**
```bash
cliseo scan
cliseo scan --json
```

### `cliseo optimize [options]`
Automatically applies SEO fixes to your codebase.

**Options:**
- `--ai`: Use AI for generating improvements (requires authentication)

**Examples:**
```bash
cliseo optimize
cliseo optimize --ai
```

### `cliseo auth`
Authenticate with cliseo for AI features.

**Example:**
```bash
cliseo auth
```

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
