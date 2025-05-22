import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { glob } from 'glob';
import OpenAI from 'openai';
import simpleGit from 'simple-git';
import { loadConfig } from '../utils/config.js';
import { OptimizeOptions, SeoIssue } from '../types/index.js';
import * as cheerio from 'cheerio';
import fs from 'fs';
import * as babel from '@babel/core';
import generate from '@babel/generator';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

const git = simpleGit();

// Check if a file is a page component
function isPageComponent(filePath: string): boolean {
  const pagePatterns = [
    /\/pages\//,           // pages directory
    /\/views\//,           // views directory
    /\/screens\//,         // screens directory
    /\/routes\//,          // routes directory
    /^src\/App\.tsx$/,    // App component
  ];
  return pagePatterns.some(pattern => pattern.test(filePath));
}

async function createSeoDirectory() {
  const seoDir = 'seo';
  const structuredDataDir = join(seoDir, 'structured-data');
  
  // Create directories
  await mkdir(seoDir, { recursive: true });
  await mkdir(structuredDataDir, { recursive: true });
  
  // Create basic templates
  const templates = {
    'robots.txt': `User-agent: *
Allow: /

Sitemap: https://yourdomain.com/sitemap.xml`,
    
    'structured-data/product.json': {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": "Product Name",
      "description": "Product description",
      "brand": {
        "@type": "Brand",
        "name": "Brand Name"
      },
      "offers": {
        "@type": "Offer",
        "price": "0.00",
        "priceCurrency": "USD"
      }
    },
    
    'structured-data/article.json': {
      "@context": "https://schema.org/",
      "@type": "Article",
      "headline": "Article Title",
      "author": {
        "@type": "Person",
        "name": "Author Name"
      },
      "datePublished": "2024-01-01T00:00:00Z"
    }
  };
  
  // Write template files
  for (const [file, content] of Object.entries(templates)) {
    const filePath = join(seoDir, file);
    await writeFile(
      filePath,
      typeof content === 'string' ? content : JSON.stringify(content, null, 2)
    );
  }
}

async function generateAiOptimizations(content: string, openai: OpenAI): Promise<SeoIssue[]> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an SEO expert. Generate specific, actionable optimizations for the provided HTML content."
        },
        {
          role: "user",
          content: `Generate SEO optimizations for this HTML:\n\n${content}`
        }
      ]
    });

    const suggestions = completion.choices[0].message.content;
    
    // Parse AI suggestions into structured format
    return suggestions.split('\n')
      .filter(line => line.trim())
      .map(suggestion => ({
        type: 'ai-suggestion',
        message: suggestion,
        file: '',  // Will be set later
        fix: suggestion
      }));
  } catch (error) {
    console.error('Error generating AI optimizations:', error);
    return [];
  }
}

async function applyOptimizations(file: string, issues: SeoIssue[]): Promise<string> {
  let content = await readFile(file, 'utf-8');
  
  for (const issue of issues) {
    // This is a simplified version - in reality, you'd want more sophisticated
    // parsing and application of fixes based on the issue type and context
    if (issue.fix.includes('<')) {
      // It's probably HTML - try to insert it in appropriate place
      if (issue.fix.includes('</head>')) {
        content = content.replace('</head>', `${issue.fix}\n</head>`);
      } else if (issue.fix.includes('</body>')) {
        content = content.replace('</body>', `${issue.fix}\n</body>`);
      }
    }
  }
  
  return content;
}

async function createPullRequest(files: string[]) {
  const branchName = `seo-optimizations-${Date.now()}`;
  
  await git.checkoutLocalBranch(branchName);
  await git.add(files);
  await git.commit('feat: AI-powered SEO optimizations');
  await git.push('origin', branchName);
  
  // Note: In a real implementation, you'd use the GitHub API to create the PR
  console.log(chalk.green(`\nPush successful! Create a PR for branch: ${branchName}`));
}

// --- New: Static (non-AI) SEO optimizer ---
async function optimizeStaticSeo(filePath: string): Promise<{ changed: boolean, newContent: string, fixes: string[] }> {
  let content = await readFile(filePath, 'utf-8');
  let changed = false;
  const fixes: string[] = [];
  const $ = cheerio.load(content);

  // Add <title> if missing
  if ($('title').length === 0) {
    $('head').prepend('<title>My Site</title>');
    fixes.push('Added <title>');
    changed = true;
  }
  // Add <meta name="description"> if missing
  if ($('meta[name="description"]').length === 0) {
    $('head').append('<meta name="description" content="My site description">');
    fixes.push('Added <meta name="description">');
    changed = true;
  }
  // Add <meta name="viewport"> if missing
  if ($('meta[name="viewport"]').length === 0) {
    $('head').append('<meta name="viewport" content="width=device-width, initial-scale=1">');
    fixes.push('Added <meta name="viewport">');
    changed = true;
  }
  // Add alt="" to <img> tags missing alt
  $('img:not([alt])').each((_, img) => {
    $(img).attr('alt', '');
    fixes.push('Added alt to <img>');
    changed = true;
  });

  if (changed) {
    content = $.html();
  }
  return { changed, newContent: content, fixes };
}

// --- Find project root (where package.json is) ---
function findProjectRoot(startDir = process.cwd()): string {
  let dir = resolve(startDir);
  while (dir !== dirname(dir)) {
    if (fs.existsSync(join(dir, 'package.json'))) return dir;
    dir = dirname(dir);
  }
  return process.cwd(); // fallback
}

// --- New: Create robots.txt and sitemap.xml if missing in project root ---
async function ensureSeoFiles() {
  let robotsCreated = false;
  let sitemapCreated = false;
  const root = findProjectRoot();
  const robotsPath = join(root, 'robots.txt');
  const sitemapPath = join(root, 'sitemap.xml');

  // Enhanced robots.txt template
  const robotsContent = `# robots.txt for ${root.split('/').pop() || 'your site'}

# Allow all crawlers
User-agent: *
Allow: /

# Disallow admin and private areas
Disallow: /admin/
Disallow: /private/
Disallow: /api/
Disallow: /_next/
Disallow: /static/

# Crawl-delay for specific bots
User-agent: GPTBot
Crawl-delay: 1

User-agent: ChatGPT-User
Crawl-delay: 1

# Sitemap location
Sitemap: https://yourdomain.com/sitemap.xml`;

  // Enhanced sitemap.xml template
  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  <!-- Homepage -->
  <url>
    <loc>https://yourdomain.com/</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  
  <!-- Common pages -->
  <url>
    <loc>https://yourdomain.com/about</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>https://yourdomain.com/contact</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <!-- Blog section -->
  <url>
    <loc>https://yourdomain.com/blog</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;

  try {
    await access(robotsPath);
  } catch {
    await writeFile(robotsPath, robotsContent);
    robotsCreated = true;
  }

  try {
    await access(sitemapPath);
  } catch {
    await writeFile(sitemapPath, sitemapContent);
    sitemapCreated = true;
  }

  return { robotsCreated, sitemapCreated };
}

// --- Fix alt tags in JSX/TSX using Babel ---
async function fixAltInJsxTsx(filePath: string): Promise<{ changed: boolean, newContent: string, fixes: string[] }> {
  const code = await readFile(filePath, 'utf-8');
  let changed = false;
  const fixes: string[] = [];
  
  // Import presets dynamically
  const presetReact = await import('@babel/preset-react');
  const presetTypescript = await import('@babel/preset-typescript');
  
  const result = await babel.transformAsync(code, {
    filename: filePath,
    presets: [presetReact.default, presetTypescript.default],
    plugins: [],
    ast: true,
    code: false,
  });
  if (!result || !result.ast) return { changed: false, newContent: code, fixes };
  traverse.default(result.ast, {
    JSXOpeningElement(path) {
      if (path.node.name && t.isJSXIdentifier(path.node.name) && path.node.name.name === 'img') {
        const hasAlt = path.node.attributes.some(attr => t.isJSXAttribute(attr) && attr.name.name === 'alt');
        if (!hasAlt) {
          path.node.attributes.push(t.jsxAttribute(t.jsxIdentifier('alt'), t.stringLiteral('image')));
          changed = true;
          fixes.push('Added alt to <img>');
        }
      }
    }
  });
  if (changed) {
    const output = generate.default(result.ast, {}, code);
    return { changed, newContent: output.code, fixes };
  }
  return { changed: false, newContent: code, fixes };
}

// Add React meta tag management to page components
async function addReactMetaManagement(filePath: string): Promise<{ changed: boolean, newContent: string, fixes: string[] }> {
  const content = await readFile(filePath, 'utf-8');
  const fixes: string[] = [];
  let changed = false;

  // Only modify page components and App.tsx
  if (!filePath.includes('/pages/') && !filePath.endsWith('App.tsx')) {
    return { changed, newContent: content, fixes };
  }

  // Check if file already has meta management
  if (content.includes('import { Helmet }') || 
      content.includes("import {Helmet}") ||
      content.includes('import { Head }') ||
      content.includes('import {Head}') ||
      content.includes('next/head')) {
    return { changed, newContent: content, fixes };
  }

  // Install react-helmet if not already installed
  try {
    const packageJsonPath = join(findProjectRoot(), 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
    
    if (!packageJson.dependencies?.['react-helmet'] && !packageJson.devDependencies?.['react-helmet']) {
      // Run npm install
      const { execSync } = await import('child_process');
      execSync('npm install react-helmet @types/react-helmet', { stdio: 'inherit' });
      fixes.push('Installed react-helmet and its types');
    }
  } catch (error) {
    console.error('Failed to install react-helmet:', error);
    return { changed, newContent: content, fixes };
  }

  // Add react-helmet import and usage
  let newContent = content;
  
  // Add import statement after other imports
  const lastImportMatch = content.match(/^import .+?;[\r\n]*/gm);
  if (lastImportMatch) {
    const lastImportIndex = content.lastIndexOf(lastImportMatch[lastImportMatch.length - 1]) + lastImportMatch[lastImportMatch.length - 1].length;
    newContent = content.slice(0, lastImportIndex) + 
      `import { Helmet } from "react-helmet";\n` +
      content.slice(lastImportIndex);
  } else {
    newContent = `import { Helmet } from "react-helmet";\n${newContent}`;
  }
  
  // Extract component name from file path
  const componentName = filePath.split('/').pop()?.replace(/\.[jt]sx$/, '') || 'Page';
  
  // Find the first JSX element after return statement
  const componentMatch = newContent.match(/(?:const|function)\s+\w+\s*=\s*(?:\(\)\s*=>|\([^)]*\)\s*=>|\([^)]*\)\s*{[^}]*return)\s*\(\s*<([^>]+)>/s);
  if (componentMatch) {
    const openingTag = componentMatch[0];
    const insertIndex = openingTag.lastIndexOf('<') + componentMatch[1].length + 1;
    const indent = openingTag.match(/^\s*/)?.[0] || '';
    const nextIndent = indent + '  ';
    
    // Add Helmet component right after the first opening tag
    newContent = newContent.slice(0, insertIndex) + '>\n' +
      `${nextIndent}<Helmet>\n` +
      `${nextIndent}  <title>${componentName}</title>\n` +
      `${nextIndent}  <meta name="description" content="${componentName} page" />\n` +
      `${nextIndent}  <meta name="viewport" content="width=device-width, initial-scale=1" />\n` +
      `${nextIndent}</Helmet>` +
      newContent.slice(insertIndex + 1);
    
    changed = true;
    fixes.push('Added react-helmet with meta tags');
  }

  return { changed, newContent, fixes };
}

// Helper function to find the closing tag of a JSX element
function findClosingJsx(content: string): { start: number, end: number } | null {
  let depth = 1;
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    
    // Handle string literals
    if ((char === '"' || char === "'") && content[i - 1] !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
      continue;
    }
    
    if (!inString) {
      if (char === '<' && content[i + 1] !== '/') depth++;
      if (char === '<' && content[i + 1] === '/') depth--;
      if (char === '/' && content[i + 1] === '>') depth--;
      
      if (depth === 0) {
        return { start: 0, end: i + 2 };
      }
    }
  }
  
  return null;
}

// Fix alt text in React components
async function fixReactAltText(filePath: string): Promise<{ changed: boolean, newContent: string, fixes: string[] }> {
  const content = await readFile(filePath, 'utf-8');
  const fixes: string[] = [];
  let changed = false;

  // Get component/file name for smarter alt text
  const componentName = filePath.split('/').pop()?.replace(/\.[jt]sx$/, '') || '';

  // Find img tags without alt attribute
  const imgRegex = /<img([^>]*)>/g;
  let newContent = content;
  let match;

  while ((match = imgRegex.exec(content)) !== null) {
    const imgTag = match[0];
    const attributes = match[1];

    // Skip if already has alt attribute
    if (attributes.includes('alt=')) {
      continue;
    }

    // Try to find src attribute to generate meaningful alt text
    const srcMatch = attributes.match(/src=["']([^"']+)["']/);
    const srcPath = srcMatch ? srcMatch[1] : '';
    let altText = '';

    if (srcPath.includes('{')) {
      // For dynamic src, use the variable name
      const varMatch = srcPath.match(/\{([^}]+)\}/);
      if (varMatch) {
        altText = `\${${varMatch[1]}}`;
      }
    } else {
      // For static src, use the filename or component context
      const fileName = srcPath.split('/').pop()?.split('.')[0] || '';
      altText = fileName || `${componentName} image`;
    }

    // Create new img tag with alt attribute
    const newImgTag = imgTag.replace(
      /(<img[^>]*)>/,
      altText.includes('${') ?
        `$1 alt={${altText.slice(2, -1)}}/>` :
        `$1 alt="${altText}"/>`
    );

    newContent = newContent.replace(imgTag, newImgTag);
    changed = true;
    fixes.push(`Added alt text to image: ${altText}`);
  }

  return { changed, newContent, fixes };
}

// Fix link accessibility issues
async function fixLinkAccessibility(filePath: string): Promise<{ changed: boolean, newContent: string, fixes: string[] }> {
  const content = await readFile(filePath, 'utf-8');
  const fixes: string[] = [];
  let changed = false;
  let newContent = content;

  // Fix non-descriptive link text
  const linkRegex = /<Link[^>]*to=["']([^"']+)["'][^>]*>([^<]*)<\/Link>|<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/g;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const [fullMatch, linkTo, linkText, aHref, aText] = match;
    const path = linkTo || aHref;
    const text = (linkText || aText || '').trim();
    
    // Check for non-descriptive text
    const nonDescriptiveText = ['click here', 'here', 'read more', 'learn more', 'more', 'link'];
    if (nonDescriptiveText.includes(text.toLowerCase())) {
      // Convert path to readable text
      const pathParts = path.split(/[/?_-]/).filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1] || '';
      const betterText = lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
      
      // Preserve the original tag type and attributes
      const newLink = fullMatch.replace(
        />([^<]*)</,
        `>${betterText}<`
      );
      
      newContent = newContent.replace(fullMatch, newLink);
      changed = true;
      fixes.push(`Improved link text: "${text}" → "${betterText}"`);
    }
  }

  return { changed, newContent, fixes };
}

// Add schema.org markup
async function addSchemaMarkup(filePath: string): Promise<{ changed: boolean, newContent: string, fixes: string[] }> {
  const content = await readFile(filePath, 'utf-8');
  const fixes: string[] = [];
  let changed = false;

  // Only modify page components
  if (!isPageComponent(filePath)) {
    return { changed, newContent: content, fixes };
  }

  // Check if schema already exists
  if (content.includes('application/ld+json') || content.includes('itemScope')) {
    return { changed, newContent: content, fixes };
  }

  let newContent = content;
  const fileName = filePath.toLowerCase();
  let schema = {};

  // Extract component name and title
  const componentName = filePath.split('/').pop()?.replace(/\.[jt]sx$/, '') || '';
  const title = componentName.replace(/([A-Z])/g, ' $1').trim();

  // Try to extract description from comments or content
  let description = '';
  const descriptionMatch = content.match(/\/\*\s*(.*?)\s*\*\//);
  if (descriptionMatch) {
    description = descriptionMatch[1];
  } else {
    description = `${title} page`;
  }

  // Get the current URL
  const url = `https://yourdomain.com${fileName.includes('index') ? '/' : `/${componentName.toLowerCase()}`}`;

  // Determine page type and create appropriate schema
  if (fileName.includes('blog') || fileName.includes('article')) {
    schema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description: description,
      author: {
        '@type': 'Person',
        name: 'Site Author'
      },
      datePublished: new Date().toISOString(),
      publisher: {
        '@type': 'Organization',
        name: 'Your Organization',
        logo: {
          '@type': 'ImageObject',
          url: 'https://yourdomain.com/logo.png'
        }
      }
    };
  } else if (fileName.includes('product')) {
    schema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: title,
      description: description,
      offers: {
        '@type': 'Offer',
        price: '0.00',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock'
      }
    };
  } else {
    schema = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description: description,
      url: url
    };
  }

  // Create the schema script with proper JSX escaping
  const schemaJson = JSON.stringify(schema, null, 2).replace(/`/g, '\\`');
  const schemaScript = `<script type="application/ld+json">{\`${schemaJson}\`}</script>`;

  // First, check if Helmet is already imported
  const hasHelmetImport = content.includes('import { Helmet }');
  
  // Find all complete import statements
  const importRegex = /^import\s+.*?;$/gm;
  const imports = Array.from(new Set(content.match(importRegex) || []));
  
  // Find the component's return statement
  const returnRegex = /return\s*\(\s*(?:<[\s\S]*$)/m;
  const returnMatch = content.match(returnRegex);

  if (!returnMatch) {
    return { changed, newContent: content, fixes };
  }

  // Split content at the return statement
  const beforeReturn = content.slice(0, returnMatch.index);
  let afterReturn = content.slice(returnMatch.index!);

  // Add Helmet import if needed
  if (!hasHelmetImport) {
    imports.push('import { Helmet } from "react-helmet";');
  }

  // Find the first JSX element
  const jsxMatch = afterReturn.match(/^\s*return\s*\(\s*(<[^>]*>)/);
  if (jsxMatch) {
    const [fullMatch, firstTag] = jsxMatch;
    const indent = fullMatch.match(/^\s*/)?.[0] || '';
    const helmetComponent = `${indent}<Helmet>\n${schemaScript}\n${indent}</Helmet>\n${indent}`;

    // If already wrapped in fragment, add after opening
    if (firstTag === '<>') {
      const openingTagEnd = afterReturn.indexOf('<>') + 2;
      afterReturn = 
        afterReturn.slice(0, openingTagEnd) + 
        '\n' + helmetComponent +
        afterReturn.slice(openingTagEnd);
    } else {
      // Wrap in fragment and add Helmet
      afterReturn = afterReturn.replace(
        /return\s*\(\s*/,
        `return (\n${indent}<>\n${helmetComponent}`
      );
      // Add closing fragment before the last closing parenthesis
      const lastParen = afterReturn.lastIndexOf(')');
      afterReturn = 
        afterReturn.slice(0, lastParen) +
        `\n${indent}</>\n${indent}` +
        afterReturn.slice(lastParen);
    }
    changed = true;
    fixes.push(`Added ${schema['@type']} schema markup`);
  }

  // Reconstruct the file with unique imports
  if (changed) {
    newContent = [
      ...Array.from(new Set(imports)), // Remove duplicate imports
      '',
      beforeReturn.trim(),
      '',
      afterReturn.trim()
    ].join('\n');
  }

  return { changed, newContent, fixes };
}

// Fix semantic HTML issues
async function fixSemanticHtml(filePath: string): Promise<{ changed: boolean, newContent: string, fixes: string[] }> {
  const content = await readFile(filePath, 'utf-8');
  const fixes: string[] = [];
  let changed = false;
  let newContent = content;

  // Replace navigation divs with nav, ensuring closing tags match
  const navDivRegex = /<div([^>]*?)(?:nav|navigation).*?>[\s\S]*?<\/div>/gi;
  newContent = newContent.replace(navDivRegex, (match, attributes) => {
    if (!match.includes('<nav')) {
      changed = true;
      fixes.push('Replaced div with semantic nav element');
      return match.replace(/<div/i, '<nav').replace(/<\/div>/i, '</nav>');
    }
    return match;
  });

  // Replace main content divs with main
  const mainDivRegex = /<div([^>]*?)(?:main|content-main|main-content).*?>[\s\S]*?<\/div>/gi;
  newContent = newContent.replace(mainDivRegex, (match, attributes) => {
    if (!match.includes('<main')) {
      changed = true;
      fixes.push('Replaced div with semantic main element');
      return match.replace(/<div/i, '<main').replace(/<\/div>/i, '</main>');
    }
    return match;
  });

  return { changed, newContent, fixes };
}

export async function optimizeCommand(options: OptimizeOptions) {
  const spinner = ora('Preparing SEO optimizations...').start();
  const config = await loadConfig();
  
  try {
    // Create /seo directory if enabled
    if (config.seoDirectory) {
      await createSeoDirectory();
    }

    // Find all HTML/JSX/TSX files
    const files = await glob('**/*.{html,jsx,tsx}', {
      ignore: ['node_modules/**', 'dist/**', 'build/**', 'seo/**'],
    });

    const modifiedFiles: string[] = [];
    const summary: Record<string, string[]> = {};

    spinner.text = 'Analyzing files...';

    let openai;
    if (options.ai) {
      if (!config.openaiApiKey) {
        spinner.fail('OpenAI API key not found!');
        console.log('Run `cliseo auth` to set up your API key.');
        process.exit(1);
      }
      openai = new OpenAI({
        apiKey: config.openaiApiKey
      });
    }

    for (const file of files) {
      if (options.ai && openai) {
        // AI optimizations (existing code)
        let optimizations: SeoIssue[] = [];
        optimizations = await generateAiOptimizations(await readFile(file, 'utf-8'), openai);
        optimizations.forEach(opt => opt.file = file);
        
        if (optimizations.length > 0) {
          if (options.dryRun) {
            console.log(chalk.underline(`\nOptimizations for ${file}:`));
            optimizations.forEach(opt => {
              console.log(`• ${chalk.bold(opt.message)}`);
              console.log(`  ${chalk.gray('Fix:')} ${opt.fix}`);
            });
            continue;
          }

          if (!options.yes) {
            const { proceed } = await inquirer.prompt([{
              type: 'confirm',
              name: 'proceed',
              message: `Apply ${optimizations.length} optimizations to ${file}?`,
              default: true,
            }]);
            if (!proceed) continue;
          }

          const optimizedContent = await applyOptimizations(file, optimizations);
          await writeFile(file, optimizedContent);
          modifiedFiles.push(file);
          summary[file] = optimizations.map(opt => opt.message);
        }
      } else if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
        // React-specific optimizations
        let content = await readFile(file, 'utf-8');
        let changed = false;
        let fixes: string[] = [];

        // Add meta tag management
        const metaResult = await addReactMetaManagement(file);
        if (metaResult.changed) {
          content = metaResult.newContent;
          changed = true;
          fixes = fixes.concat(metaResult.fixes);
        }

        // Fix alt text
        const altResult = await fixReactAltText(file);
        if (altResult.changed) {
          content = altResult.newContent;
          changed = true;
          fixes = fixes.concat(altResult.fixes);
        }

        // Fix link accessibility
        const linkResult = await fixLinkAccessibility(file);
        if (linkResult.changed) {
          content = linkResult.newContent;
          changed = true;
          fixes = fixes.concat(linkResult.fixes);
        }

        // Add schema markup
        const schemaResult = await addSchemaMarkup(file);
        if (schemaResult.changed) {
          content = schemaResult.newContent;
          changed = true;
          fixes = fixes.concat(schemaResult.fixes);
        }

        // Fix semantic HTML
        const semanticResult = await fixSemanticHtml(file);
        if (semanticResult.changed) {
          content = semanticResult.newContent;
          changed = true;
          fixes = fixes.concat(semanticResult.fixes);
        }

        if (changed) {
          spinner.text = `Optimizing ${file}...`;
          await writeFile(file, content);
          modifiedFiles.push(file);
          summary[file] = fixes;
        }
      } else {
        // Regular HTML optimizations (existing code)
        const { changed, newContent, fixes } = await optimizeStaticSeo(file);
        if (changed) {
          await writeFile(file, newContent);
          modifiedFiles.push(file);
          summary[file] = fixes;
        }
      }
    }

    // Ensure robots.txt and sitemap.xml exist
    spinner.text = 'Checking SEO files...';
    const { robotsCreated, sitemapCreated } = await ensureSeoFiles();

    spinner.succeed('SEO optimizations complete!');

    // Output summary
    if (modifiedFiles.length > 0) {
      console.log(chalk.bold('\nOptimized files:'));
      for (const file of modifiedFiles) {
        console.log(chalk.green(`✔ ${file}`));
        summary[file].forEach(fix => {
          console.log(chalk.gray(`  - ${fix}`));
        });
      }
    } else {
      console.log(chalk.yellow('No HTML/JSX/TSX files needed changes.'));
    }

    if (robotsCreated) {
      console.log(chalk.green('✔ Created robots.txt'));
    }
    if (sitemapCreated) {
      console.log(chalk.green('✔ Created sitemap.xml'));
    }
    if (!robotsCreated && !sitemapCreated) {
      console.log(chalk.gray('robots.txt and sitemap.xml already exist.'));
    }

  } catch (error) {
    spinner.fail('Optimization failed!');
    console.error(error);
    process.exit(1);
  }
} 