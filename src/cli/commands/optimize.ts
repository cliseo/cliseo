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

  try {
    // Use Babel to parse and modify the code safely
    const ast = babel.parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    // Flag to track if we modified the AST
    let astModified = false;

    // Add import statement if it doesn't exist
    let helmetImportExists = false;
    traverse.default(ast, {
      ImportDeclaration(path) {
        if (path.node.source.value === 'react-helmet') {
          helmetImportExists = true;
        }
      }
    });

    if (!helmetImportExists) {
      // Add the import at the top level with other imports
      let lastImportIndex = -1;
      
      traverse.default(ast, {
        ImportDeclaration(path) {
          lastImportIndex = Math.max(lastImportIndex, path.node.loc?.end.line || 0);
        }
      });

      if (lastImportIndex > 0) {
        // Add the import after the last import
        const helmetImport = babel.template.default.ast(`import { Helmet } from "react-helmet";`);
        ast.program.body.splice(lastImportIndex, 0, helmetImport);
        astModified = true;
      }
    }

    // Extract component name from file path
    const componentName = filePath.split('/').pop()?.replace(/\.[jt]sx$/, '') || 'Page';

    // Try to find the return statement in the component
    let helmetAdded = false;

    traverse.default(ast, {
      ReturnStatement(path) {
        // Skip if we already added the Helmet
        if (helmetAdded) return;

        // Check if the return statement contains JSX
        const returnArg = path.node.argument;
        if (t.isJSXElement(returnArg)) {
          // Get the first JSX element
          const jsxElement = returnArg;
          
          // Check if it's a fragment or a div that we can add Helmet to
          if (
            (jsxElement.openingElement.name.type === 'JSXIdentifier' && 
             (jsxElement.openingElement.name.name === 'div' || 
              jsxElement.openingElement.name.name === 'Fragment')) ||
            (jsxElement.openingElement.name.type === 'JSXMemberExpression' && 
             jsxElement.openingElement.name.property.name === 'Fragment')
          ) {
            // Create the Helmet JSX element
            const helmetJsx = babel.template.default.ast(`
              <Helmet>
                <title>${componentName}</title>
                <meta name="description" content="${componentName} page" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
              </Helmet>
            `, { plugins: ['jsx'] });

            // Add the Helmet as the first child
            if (jsxElement.children && jsxElement.children.length) {
              jsxElement.children.unshift(helmetJsx.expression);
              helmetAdded = true;
              astModified = true;
              fixes.push('Added react-helmet with meta tags');
            }
          }
        }
      }
    });

    // If we modified the AST, generate the new code
    if (astModified) {
      const output = generate.default(ast, {}, content);
      changed = true;
      return { changed, newContent: output.code, fixes };
    }

    // If we couldn't modify the AST with traversal, fall back to manual string manipulation
    if (!helmetImportExists) {
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
  
      // Try to insert the Helmet component safely - look for a common pattern
      const returnRegex = /return\s*\(\s*<([^>]+)>/;
      const match = newContent.match(returnRegex);
      
      if (match) {
        const insertPoint = newContent.indexOf(match[0]) + match[0].length;
        const helmetJsx = `\n  <Helmet>\n    <title>${componentName}</title>\n    <meta name="description" content="${componentName} page" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n  </Helmet>\n  `;
        
        newContent = newContent.slice(0, insertPoint) + helmetJsx + newContent.slice(insertPoint);
    changed = true;
    fixes.push('Added react-helmet with meta tags');
  }

  return { changed, newContent, fixes };
    }
  } catch (error) {
    console.error('Error while adding React Helmet:', error);
    // If there's an error, return the original content
    return { changed: false, newContent: content, fixes };
  }

  return { changed, newContent: content, fixes };
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

  try {
    // Get component/file name for smarter alt text
    const componentName = filePath.split('/').pop()?.replace(/\.[jt]sx$/, '') || '';

    // Use Babel to parse and modify the code safely
    const ast = babel.parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    let altTextAdded = 0;

    // Find img tags without alt attribute using AST traversal
    traverse.default(ast, {
      JSXOpeningElement(path) {
        if (path.node.name.type === 'JSXIdentifier' && path.node.name.name === 'img') {
          // Check if there's already an alt attribute
          const hasAlt = path.node.attributes.some(attr => 
            t.isJSXAttribute(attr) && attr.name.name === 'alt'
          );

          if (!hasAlt) {
            // Try to find src attribute to generate meaningful alt text
            const srcAttr = path.node.attributes.find(attr => 
              t.isJSXAttribute(attr) && attr.name.name === 'src'
            );
            
            let altText = `${componentName} image`;

            if (srcAttr && t.isJSXAttribute(srcAttr)) {
              if (t.isStringLiteral(srcAttr.value)) {
                // For static src, use the filename
                const srcPath = srcAttr.value.value;
                const fileName = srcPath.split('/').pop()?.split('.')[0] || '';
                if (fileName) altText = fileName;
              } else if (t.isJSXExpressionContainer(srcAttr.value)) {
                // For dynamic src (expressions), use the expression as alt text
                if (t.isIdentifier(srcAttr.value.expression)) {
                  // Add alt={srcVariable}
                  path.node.attributes.push(
                    t.jsxAttribute(
                      t.jsxIdentifier('alt'),
                      t.jsxExpressionContainer(srcAttr.value.expression)
                    )
                  );
                  altTextAdded++;
                  fixes.push(`Added dynamic alt text to image using src variable`);
                  return;
                }
              }
            }

            // Add static alt text if we couldn't extract from src
            path.node.attributes.push(
              t.jsxAttribute(
                t.jsxIdentifier('alt'),
                t.stringLiteral(altText)
              )
            );
            altTextAdded++;
            fixes.push(`Added alt text to image: ${altText}`);
          }
        }
      }
    });

    if (altTextAdded > 0) {
      const output = generate.default(ast, {}, content);
      changed = true;
      return { changed, newContent: output.code, fixes };
    }

    return { changed: false, newContent: content, fixes };
  } catch (error) {
    console.error('Error fixing alt text:', error);
    
    // Fallback to regex-based approach if AST parsing fails
    let newContent = content;

  // Get component/file name for smarter alt text
  const componentName = filePath.split('/').pop()?.replace(/\.[jt]sx$/, '') || '';

  // Find img tags without alt attribute
  const imgRegex = /<img([^>]*)>/g;
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

      // Create new img tag with alt attribute - simpler version to reduce errors
    const newImgTag = imgTag.replace(
        '<img',
      altText.includes('${') ?
          `<img alt={${altText.slice(2, -1)}}` :
          `<img alt="${altText}"`
    );

    newContent = newContent.replace(imgTag, newImgTag);
    changed = true;
    fixes.push(`Added alt text to image: ${altText}`);
  }

  return { changed, newContent, fixes };
  }
}

// Fix link accessibility issues
async function fixLinkAccessibility(filePath: string): Promise<{ changed: boolean, newContent: string, fixes: string[] }> {
  const content = await readFile(filePath, 'utf-8');
  const fixes: string[] = [];
  let changed = false;

  try {
    // Use Babel to parse and modify the code safely
    const ast = babel.parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    let linksFixed = 0;
    const nonDescriptiveText = ['click here', 'here', 'read more', 'learn more', 'more', 'link'];

    // Find link elements with non-descriptive text
    traverse.default(ast, {
      JSXElement(path) {
        if (path.node.openingElement.name.type !== 'JSXIdentifier') return;
        
        const tagName = path.node.openingElement.name.name;
        
        if (tagName !== 'Link' && tagName !== 'a') return;
        
        // Check for href/to attribute
        let urlAttr = path.node.openingElement.attributes.find(attr => 
          t.isJSXAttribute(attr) && 
          (attr.name.name === 'href' || attr.name.name === 'to')
        );
        
        if (!urlAttr || !t.isJSXAttribute(urlAttr)) return;
        
        // Extract URL
        let url = '';
        if (t.isStringLiteral(urlAttr.value)) {
          url = urlAttr.value.value;
        } else {
          return; // Skip dynamic URLs for now
        }
        
        // Check if the link has non-descriptive text
        if (path.node.children.length === 1 && 
            t.isJSXText(path.node.children[0])) {
          const linkText = path.node.children[0].value.trim().toLowerCase();
          
          if (nonDescriptiveText.includes(linkText)) {
            // Extract better text from URL
            const pathParts = url.split(/[/?_-]/).filter(Boolean);
            const lastPart = pathParts[pathParts.length - 1] || '';
            const betterText = lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
            
            // Replace the text
            path.node.children[0] = t.jsxText(betterText);
            linksFixed++;
            fixes.push(`Improved link text: "${linkText}" → "${betterText}"`);
          }
        }
      }
    });

    if (linksFixed > 0) {
      const output = generate.default(ast, {}, content);
      changed = true;
      return { changed, newContent: output.code, fixes };
    }

    return { changed: false, newContent: content, fixes };
  } catch (error) {
    console.error('Error fixing link accessibility:', error);
    
    // Fallback to regex-based approach
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

  try {
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
    const url = `https://yourdomain.com${filePath.includes('index') ? '/' : `/${componentName.toLowerCase()}`}`;

  // Determine page type and create appropriate schema
    const fileName = filePath.toLowerCase();
    let schema = {};

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

    // Use Babel to parse the code
    const ast = babel.parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    // Flag to track if we modified the AST
    let astModified = false;

    // Add Helmet import if needed
    let helmetImportExists = false;
    traverse.default(ast, {
      ImportDeclaration(path) {
        if (path.node.source.value === 'react-helmet') {
          helmetImportExists = true;
        }
      }
    });

    if (!helmetImportExists) {
      // Add the import at the top level with other imports
      let lastImportIndex = -1;
      
      traverse.default(ast, {
        ImportDeclaration(path) {
          lastImportIndex = Math.max(lastImportIndex, path.node.loc?.end.line || 0);
        }
      });

      if (lastImportIndex > 0) {
        // Add the import after the last import
        const helmetImport = babel.template.default.ast(`import { Helmet } from "react-helmet";`);
        ast.program.body.splice(lastImportIndex, 0, helmetImport);
        astModified = true;
      }
    }

    // Create the schema script
    const schemaJson = JSON.stringify(schema, null, 2);
    
    // Add schema to the return statement with Helmet
    let schemaAdded = false;
    
    traverse.default(ast, {
      ReturnStatement(path) {
        // Skip if we already added the schema
        if (schemaAdded) return;

        // Check if the return statement contains JSX
        const returnArg = path.node.argument;
        if (t.isJSXElement(returnArg)) {
          // Get the first JSX element
          const jsxElement = returnArg;
          
          // Create a template for the Helmet with schema
          const helmetTemplate = babel.template.default.ast(`
            <Helmet>
              <script type="application/ld+json">
                {\`${schemaJson.replace(/`/g, '\\`')}\`}
              </script>
            </Helmet>
          `, { plugins: ['jsx'] });

          // Check if we need to wrap in a fragment
          const needsFragment = 
            !t.isJSXFragment(jsxElement) && 
            !(jsxElement.openingElement.name.type === 'JSXIdentifier' && 
              jsxElement.openingElement.name.name === 'div');
          
          if (needsFragment) {
            // Create a new fragment with our Helmet and the original element
            const fragment = t.jsxFragment(
              t.jsxOpeningFragment(),
              t.jsxClosingFragment(),
              [helmetTemplate.expression, jsxElement]
            );
            
            // Replace the return argument with our fragment
            path.get('argument').replaceWith(fragment);
          } else {
            // Just add the Helmet as the first child
            if (jsxElement.children) {
              jsxElement.children.unshift(helmetTemplate.expression);
    }
          }
          
          schemaAdded = true;
          astModified = true;
    fixes.push(`Added ${schema['@type']} schema markup`);
  }
      }
    });

    // If we modified the AST, generate the new code
    if (astModified) {
      const output = generate.default(ast, {}, content);
      changed = true;
      return { changed, newContent: output.code, fixes };
    }
    
    // If we couldn't modify with AST, fall back to the previous implementation
    let newContent = content;
    
    // Add Helmet import if needed
    if (!helmetImportExists) {
      const lastImportMatch = content.match(/^import .+?;[\r\n]*/gm);
      if (lastImportMatch) {
        const lastImportIndex = content.lastIndexOf(lastImportMatch[lastImportMatch.length - 1]) + lastImportMatch[lastImportMatch.length - 1].length;
        newContent = content.slice(0, lastImportIndex) + 
          `import { Helmet } from "react-helmet";\n` +
          content.slice(lastImportIndex);
      } else {
        newContent = `import { Helmet } from "react-helmet";\n${newContent}`;
      }
    }
    
    // Create the schema script
    const schemaScript = `<script type="application/ld+json">{\`${schemaJson.replace(/`/g, '\\`')}\`}</script>`;
    
    // Try to add the Helmet with schema in a safer way
    const returnPattern = /return\s*\(\s*(?:<[^>]*>)/;
    const match = newContent.match(returnPattern);
    if (match) {
      const insertPoint = match.index! + match[0].length;
      const helmetElement = `\n  <Helmet>\n    ${schemaScript}\n  </Helmet>\n  `;
      
      newContent = newContent.slice(0, insertPoint) + helmetElement + newContent.slice(insertPoint);
      changed = true;
      fixes.push(`Added ${schema['@type']} schema markup`);
  }

  return { changed, newContent, fixes };
  } catch (error) {
    console.error('Error adding schema markup:', error);
    return { changed: false, newContent: content, fixes };
  }
}

// Fix semantic HTML issues
async function fixSemanticHtml(filePath: string): Promise<{ changed: boolean, newContent: string, fixes: string[] }> {
  const content = await readFile(filePath, 'utf-8');
  const fixes: string[] = [];
  let changed = false;
  
  try {
    // Use Babel to parse and modify the code safely
    const ast = babel.parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    // Track changes
    let semanticElementsAdded = 0;

    // Traverse the AST to find potential div elements to replace
    traverse.default(ast, {
      JSXOpeningElement(path) {
        if (path.node.name.type !== 'JSXIdentifier' || path.node.name.name !== 'div') {
          return;
        }

        // Check if this div should be a semantic element
        const classAttr = path.node.attributes.find(attr => 
          t.isJSXAttribute(attr) && 
          attr.name.name === 'className'
        );

        if (!classAttr || !t.isJSXAttribute(classAttr) || !t.isStringLiteral(classAttr.value)) {
          return;
        }

        const className = classAttr.value.value.toLowerCase();
        let semanticTag = null;

        // Determine if this div should be a semantic element
        if (className.includes('nav') || className.includes('navigation')) {
          semanticTag = 'nav';
        } else if (className.includes('main') || className.includes('content-main')) {
          semanticTag = 'main';
        } else if (className.includes('header') || className.includes('banner')) {
          semanticTag = 'header';
        } else if (className.includes('footer')) {
          semanticTag = 'footer';
        } else if (className.includes('aside') || className.includes('sidebar')) {
          semanticTag = 'aside';
        }

        // Replace div with semantic element if found
        if (semanticTag) {
          path.node.name = t.jsxIdentifier(semanticTag);
          
          // Also need to update the closing tag
          const jsxElement = path.findParent(path => path.isJSXElement());
          if (jsxElement && t.isJSXElement(jsxElement.node) && 
              t.isJSXClosingElement(jsxElement.node.closingElement) &&
              t.isJSXIdentifier(jsxElement.node.closingElement.name) &&
              jsxElement.node.closingElement.name.name === 'div') {
            jsxElement.node.closingElement.name = t.jsxIdentifier(semanticTag);
          }
          
          semanticElementsAdded++;
          fixes.push(`Replaced div with semantic ${semanticTag} element`);
        }
      }
    });

    if (semanticElementsAdded > 0) {
      const output = generate.default(ast, {}, content);
      changed = true;
      return { changed, newContent: output.code, fixes };
    }

    // If no changes made with AST, fall back to safer regex approach
  let newContent = content;

  // Replace navigation divs with nav, ensuring closing tags match
    // Only replace if the regex pattern is clear and unlikely to cause issues
    const navDivRegex = /<div([^>]*?)(?:class|className)=["']([^"']*(?:nav|navigation)[^"']*)["']([^>]*?)>[\s\S]*?<\/div>/gi;
    newContent = newContent.replace(navDivRegex, (match, before, className, after) => {
    if (!match.includes('<nav')) {
      changed = true;
      fixes.push('Replaced div with semantic nav element');
      return match.replace(/<div/i, '<nav').replace(/<\/div>/i, '</nav>');
    }
    return match;
  });

  // Replace main content divs with main
    const mainDivRegex = /<div([^>]*?)(?:class|className)=["']([^"']*(?:main|content-main|main-content)[^"']*)["']([^>]*?)>[\s\S]*?<\/div>/gi;
    newContent = newContent.replace(mainDivRegex, (match, before, className, after) => {
    if (!match.includes('<main')) {
      changed = true;
      fixes.push('Replaced div with semantic main element');
      return match.replace(/<div/i, '<main').replace(/<\/div>/i, '</main>');
    }
    return match;
  });

  return { changed, newContent, fixes };
  } catch (error) {
    console.error('Error fixing semantic HTML:', error);
    return { changed: false, newContent: content, fixes };
  }
}

// Helper function to get error message safely
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  } else if (typeof error === 'string') {
    return error;
  } else if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return String(error);
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
    const errors: Record<string, string> = {};

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
      try {
        spinner.text = `Analyzing ${file}...`;
        
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
          try {
        // React-specific optimizations
        let content = await readFile(file, 'utf-8');
            let originalContent = content; // Keep a copy of the original
        let changed = false;
        let fixes: string[] = [];
            let fileModified = false;

        // Add meta tag management
            try {
        const metaResult = await addReactMetaManagement(file);
        if (metaResult.changed) {
          content = metaResult.newContent;
          changed = true;
                fileModified = true;
          fixes = fixes.concat(metaResult.fixes);
              }
            } catch (metaError) {
              console.error(`Error adding meta management to ${file}:`, metaError);
              errors[file] = `Failed to add meta management: ${getErrorMessage(metaError)}`;
        }

        // Fix alt text
            try {
        const altResult = await fixReactAltText(file);
        if (altResult.changed) {
          content = altResult.newContent;
          changed = true;
                fileModified = true;
          fixes = fixes.concat(altResult.fixes);
              }
            } catch (altError) {
              console.error(`Error fixing alt text in ${file}:`, altError);
              errors[file] = `Failed to fix alt text: ${getErrorMessage(altError)}`;
        }

        // Fix link accessibility
            try {
        const linkResult = await fixLinkAccessibility(file);
        if (linkResult.changed) {
          content = linkResult.newContent;
          changed = true;
                fileModified = true;
          fixes = fixes.concat(linkResult.fixes);
              }
            } catch (linkError) {
              console.error(`Error fixing link accessibility in ${file}:`, linkError);
              errors[file] = `Failed to fix link accessibility: ${getErrorMessage(linkError)}`;
        }

        // Add schema markup
            try {
        const schemaResult = await addSchemaMarkup(file);
        if (schemaResult.changed) {
          content = schemaResult.newContent;
          changed = true;
                fileModified = true;
          fixes = fixes.concat(schemaResult.fixes);
              }
            } catch (schemaError) {
              console.error(`Error adding schema markup to ${file}:`, schemaError);
              errors[file] = `Failed to add schema markup: ${getErrorMessage(schemaError)}`;
        }

        // Fix semantic HTML
            try {
        const semanticResult = await fixSemanticHtml(file);
        if (semanticResult.changed) {
          content = semanticResult.newContent;
          changed = true;
                fileModified = true;
          fixes = fixes.concat(semanticResult.fixes);
              }
            } catch (semanticError) {
              console.error(`Error fixing semantic HTML in ${file}:`, semanticError);
              errors[file] = `Failed to fix semantic HTML: ${getErrorMessage(semanticError)}`;
        }

        if (changed) {
          spinner.text = `Optimizing ${file}...`;
              
              // Verify code is valid before writing
              try {
                const ast = babel.parse(content, {
                  sourceType: 'module',
                  plugins: ['jsx', 'typescript'],
                });
                
                if (ast) {
          await writeFile(file, content);
          modifiedFiles.push(file);
          summary[file] = fixes;
                } else {
                  // If parsing fails, don't write the file
                  errors[file] = 'Generated invalid code that failed to parse';
                  console.error(`Error: Generated invalid code for ${file}, skipping...`);
                }
              } catch (parseError) {
                // If there's a parsing error, don't write the file
                errors[file] = `Generated invalid code: ${getErrorMessage(parseError)}`;
                console.error(`Error: Generated invalid code for ${file}, skipping...`);
                
                // Diagnostic info
                console.debug('Parse error details:', parseError);
              }
            }
          } catch (reactError) {
            errors[file] = `Failed to process React file: ${getErrorMessage(reactError)}`;
            console.error(`Error processing React file ${file}:`, reactError);
        }
      } else {
          // Regular HTML optimizations
          try {
        const { changed, newContent, fixes } = await optimizeStaticSeo(file);
        if (changed) {
          await writeFile(file, newContent);
          modifiedFiles.push(file);
          summary[file] = fixes;
        }
          } catch (htmlError) {
            errors[file] = `Failed to optimize HTML: ${getErrorMessage(htmlError)}`;
            console.error(`Error optimizing HTML file ${file}:`, htmlError);
          }
        }
      } catch (fileError) {
        errors[file] = `Failed to process file: ${getErrorMessage(fileError)}`;
        console.error(`Error processing file ${file}:`, fileError);
      }
    }

    // Ensure robots.txt and sitemap.xml exist
    spinner.text = 'Checking SEO files...';
    try {
    const { robotsCreated, sitemapCreated } = await ensureSeoFiles();

      if (Object.keys(errors).length > 0) {
        spinner.warn('SEO optimizations completed with some errors!');
      } else {
    spinner.succeed('SEO optimizations complete!');
      }

    // Output summary
    if (modifiedFiles.length > 0) {
      console.log(chalk.bold('\nOptimized files:'));
      for (const file of modifiedFiles) {
        console.log(chalk.green(`✔ ${file}`));
          if (summary[file]) {
        summary[file].forEach(fix => {
          console.log(chalk.gray(`  - ${fix}`));
        });
          }
      }
    } else {
      console.log(chalk.yellow('No HTML/JSX/TSX files needed changes.'));
    }

      // Output errors if any
      if (Object.keys(errors).length > 0) {
        console.log(chalk.bold('\nErrors:'));
        for (const [file, errorMsg] of Object.entries(errors)) {
          console.log(chalk.red(`✘ ${file}: ${errorMsg}`));
        }
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
    } catch (seoFilesError) {
      spinner.warn('SEO file generation had issues');
      console.error('Error creating SEO files:', seoFilesError);
    }

  } catch (error) {
    spinner.fail('Optimization failed!');
    console.error(error);
    process.exit(1);
  }
} 