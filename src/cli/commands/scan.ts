import { glob } from 'glob';
import * as cheerio from 'cheerio';
import chalk from 'chalk';
import ora from 'ora';
import { readFile } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import path from 'path';
import { readFileSync, existsSync } from 'fs';
import OpenAI from 'openai';
import { loadConfig } from '../utils/config.js';
import { ScanOptions, SeoIssue, ScanResult } from '../types/index.js';
import fs from 'fs';
// import { authCommand } from './auth.js'; // Removed - no longer needed
// import { file } from '@babel/types'; // Removed - unused import
// import { detectFramework, findProjectRoot } from '../utils/detect-framework.js';
// import { scanReactComponent } from '../frameworks/react.js';
import axios from 'axios';

/** 
 * Find project root (where package.json is)
 * 
 * @param startDir - Directory to start search from
 * @returns Path to project root directory
 */
function findProjectRoot(startDir = process.cwd()): string {
  let dir = resolve(startDir);
  while (dir !== dirname(dir)) {
    if (fs.existsSync(join(dir, 'package.json'))) return dir;
    dir = dirname(dir);
  }
  return process.cwd(); // fallback
}

/**
 * Scans all package.json files in the project for framework dependencies.
 * Returns the first framework found, or 'unknown' if none found.
 */
async function detectFramework(projectRoot: string): Promise<'react' | 'vue' | 'next.js' | 'unknown'> {
  // Find all package.json files, excluding node_modules and common build/test dirs
  const packageJsonFiles = await glob('**/package.json', {
    cwd: projectRoot,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/out/**',
      '**/.git/**',
      '**/coverage/**',
      '**/test/**',
      '**/tests/**',
      '**/__tests__/**',
      '**/__mocks__/**',
      '**/vendor/**',
      '**/public/**'
    ],
    absolute: true,
    dot: true
  });

  for (const pkgPath of packageJsonFiles) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if ('next' in deps) return 'next.js';
      if ('react' in deps || 'react-dom' in deps) return 'react';
      if ('vue' in deps) return 'vue';
    } catch (e) {
      // Ignore parse errors
    }
  }
  return 'unknown';
}

/**
 * Scans project for required SEO files (robots.txt, sitemap.xml).
 * 
 * @returns List of SEO issues found.
 */
async function checkRequiredSeoFiles(): Promise<SeoIssue[]> {
  const issues: SeoIssue[] = [];
  const root = findProjectRoot();
  const robotsPath = join(root, 'robots.txt');
  const sitemapPath = join(root, 'sitemap.xml');

  try {
    await readFile(robotsPath, 'utf-8');
  } catch {
    issues.push({
      type: 'error',
      message: 'Missing robots.txt file',
      file: 'robots.txt',
      fix: 'Run `cliseo optimize` to generate a robots.txt file with recommended settings',
    });
  }

  try {
    await readFile(sitemapPath, 'utf-8');
  } catch {
    issues.push({
      type: 'error',
      message: 'Missing sitemap.xml file',
      file: 'sitemap.xml',
      fix: 'Run `cliseo optimize` to generate a sitemap.xml file with your site structure',
    });
  }

  return issues;
}

/* Basic SEO rules for scan */
const basicSeoRules = {
  missingTitle: (doc: cheerio.CheerioAPI) => !doc('title').length,
  missingMetaDescription: (doc: cheerio.CheerioAPI) => !doc('meta[name="description"]').length,
  missingAltTags: (doc: cheerio.CheerioAPI) => doc('img:not([alt])').length > 0,
  missingViewport: (doc: cheerio.CheerioAPI) => !doc('meta[name="viewport"]').length,
  missingRobotsTxt: async (projectRoot: string) => {
    try {
      await readFile(join(projectRoot, 'robots.txt'));
      return false;
    } catch {
      return true;
    }
  },
};

/**
 * Checks if a file is a page component that needs meta tag management
 * 
 * @param filePath - Path to file to scan
 * @returns True if the file is a page component, false otherwise.
*/
function isPageComponent(filePath: string): boolean {
  // Skip entry point files
  if (filePath.endsWith('main.tsx') || filePath.endsWith('index.tsx') || filePath.endsWith('App.tsx')) {
    return false;
  }

  // Skip files that don't export a component
  if (filePath.endsWith('vite-env.d.ts') || filePath.endsWith('.css')) {
    return false;
  }

  const pagePatterns = [
    /\/pages\//,           // pages directory
    /\/views\//,           // views directory
    /\/screens\//,         // screens directory
    /\/routes\//,          // routes directory
    /^src\/App\.tsx$/,    // App component
  ];
  
  return pagePatterns.some(pattern => pattern.test(filePath));
}

/**
 * Checks file for missing schema.org markup
 * 
 * @param filePath - Path to file to scan
 * @returns List of SEO issues found.
 */
async function checkSchemaMarkup(filePath: string): Promise<SeoIssue[]> {
  const issues: SeoIssue[] = [];
  const content = await readFile(filePath, 'utf-8');

  // Only check page components
  if (!isPageComponent(filePath)) {
    return issues;
  }

  // Check for existing schema markup
  const hasSchemaScript = content.includes('application/ld+json');
  const hasSchemaProps = content.includes('itemScope') || content.includes('itemType');

  if (!hasSchemaScript && !hasSchemaProps) {
    // Determine page type from file path/name
    const fileName = filePath.toLowerCase();
    if (fileName.includes('blog') || fileName.includes('article')) {
      issues.push({
        type: 'warning',
        message: 'Missing Article schema markup',
        file: filePath,
        fix: 'Add Article schema.org markup for better search results',
      });
    } else if (fileName.includes('product')) {
      issues.push({
        type: 'warning',
        message: 'Missing Product schema markup',
        file: filePath,
        fix: 'Add Product schema.org markup for rich product snippets',
      });
    } else {
      issues.push({
        type: 'warning',
        message: 'Missing WebPage schema markup',
        file: filePath,
        fix: 'Add basic WebPage schema.org markup',
      });
    }
  }

  return issues;
}

/**
 * Checks React component for SEO issues.
 * 
 * @param filePath - Path to React component file to scan.
 * @returns List of SEO issues found.
 */
async function scanReactComponent(filePath: string): Promise<SeoIssue[]> {
  //ignore entry point files
  if (filePath.endsWith('main.tsx') || filePath.endsWith('index.tsx') || filePath.endsWith('App.tsx')) {
    return [];
  }
  const issues: SeoIssue[] = [];
  const content = await readFile(filePath, 'utf-8');
  
  // Check if file uses React Helmet or similar
  const hasHelmet = content.includes('import { Helmet }') || 
                   content.includes("import {Helmet}") ||
                   content.includes('import {Head}') ||
                   content.includes('import { Head }') ||
                   content.includes('next/head') ||
                   content.includes('useHead') ||
                   content.includes('useSeoMeta');
  
  if (!hasHelmet && isPageComponent(filePath)) {
    // Check if the file might be using Helmet from a parent component
    const appContent = await readFile(join(dirname(filePath), '../App.tsx'), 'utf-8').catch(() => '');
    const hasParentHelmet = appContent.includes('import { Helmet }') || appContent.includes('<Helmet>');
    
    if (!hasParentHelmet) {
      issues.push({
        type: 'warning',
        message: 'No meta tag management library found',
        file: filePath,
        fix: 'Consider using react-helmet, next/head, or similar for managing meta tags',
      });
    }
  }

  // Check for img tags without alt using regex that accounts for JSX
  const imgTagRegex = /<img[^>]*?>/g;
  const altRegex = /alt=["'][^"']*["']|alt=\{[^}]+\}/;
  
  let match;
  while ((match = imgTagRegex.exec(content)) !== null) {
    const imgTag = match[0];
    if (!altRegex.test(imgTag)) {
      issues.push({
        type: 'warning',
        message: 'Image missing alt text',
        file: filePath,
        element: imgTag,
        fix: 'Add descriptive alt text to the image',
      });
    }
  }

  const linkRegex = /<(?:Link|a)[^>]*>([^<]*)<\/(?:Link|a)>/g;
  while ((match = linkRegex.exec(content)) !== null) {
    const linkTag = match[0];
    const linkText = match[1].trim();

    // Check for empty links
    if (!linkText) {
      issues.push({
        type: 'error',
        message: 'Empty link found',
        file: filePath,
        element: linkTag,
        fix: 'Add descriptive text to the link',
      });
    }
  }

  // Check for links that only contain images without alt text
  const imgLinkRegex = /<(?:Link|a)[^>]*>\s*<img[^>]*?>\s*<\/(?:Link|a)>/g;
  while ((match = imgLinkRegex.exec(content)) !== null) {
    const linkTag = match[0];
    if (!altRegex.test(linkTag)) {
      issues.push({
        type: 'warning',
        message: 'Link contains image without alt text',
        file: filePath,
        element: linkTag,
        fix: 'Add alt text to the image to describe the link destination',
      });
    }
  }

  // Check for semantic HTML issues
  const divRegex = /<div[^>]*>.*?<\/div>/g;
  while ((match = divRegex.exec(content)) !== null) {
    const divContent = match[0].toLowerCase();
    if (divContent.includes('nav') && !divContent.includes('<nav')) {
      issues.push({
        type: 'warning',
        message: 'Navigation not using semantic <nav> element',
        file: filePath,
        element: match[0],
        fix: 'Replace div with semantic <nav> element for better SEO',
      });
    }
    if ((divContent.includes('main content') || divContent.includes('content main')) && !divContent.includes('<main')) {
      issues.push({
        type: 'warning',
        message: 'Main content not using semantic <main> element',
        file: filePath,
        element: match[0],
        fix: 'Replace div with semantic <main> element for better SEO',
      });
    }
  }

  // Check for schema markup
  const schemaIssues = await checkSchemaMarkup(filePath);
  issues.push(...schemaIssues);

  return issues;
}

/**
 * Checks Vue component for SEO issues.
 * 
 * @param filePath - Path to Vue component file to scan.
 * @returns List of SEO issues found.
 */
async function scanVueComponent(filePath: string): Promise<SeoIssue[]> {
  const issues: SeoIssue[] = [];
  const content = await readFile(filePath, 'utf-8');

  //entry point files
  
  if (filePath.endsWith('main.tsx') || filePath.endsWith('main.js')) {
    const usesVueMeta = /['"]vue-meta['"]/.test(content) || content.includes('createMetaManager');

      if (!usesVueMeta) {
        issues.push({
        type: 'warning',
        message: 'No meta tag management library found',
        file: filePath,
        fix: 'Consider using vue-meta or @vueuse/head for managing meta tags.',
      });
      }

  }
 
  
  // Check if file uses Vue-meta or similar
  const hasMeta = /metaInfo\s*\(|\bmeta\s*:\s*\[/.test(content);
  
  if (!hasMeta && isPageComponent(filePath)) {
      issues.push({
        type: 'warning',
        message: 'No meta tag management library found',
        file: filePath,
        fix: 'Add a metaInfo() block using vue-meta or define meta:[] for SEO.',
      });
    
  }

  // Check for schema markup
  const schemaIssues = await checkSchemaMarkup(filePath);
  issues.push(...schemaIssues);

  return issues;
}

/**
 * Checks Next component for SEO issues.
 * 
 * @param filePath - Path to Next component file to scan.
 * @returns List of SEO issues found.
 */
async function scanNextComponent(filePath: string): Promise<SeoIssue[]> {
  const issues: SeoIssue[] = [];
  const content = await readFile(filePath, 'utf-8');

  if(!isPageComponent(filePath)) return issues;

  if (!content.includes('<Head>')) {
    console.error('No <Head> component found in:', filePath);
    issues.push({
      type: 'warning',
      message: 'No <Head> component found for managing meta tags',
      file: filePath,
      fix: 'Consider using next/head, to manage title and meta tags in page components',
    });
  }
  if (content.includes('<img') && !content.includes('next/image')) {
    console.error('Image without next/image component found in:', filePath);
    issues.push({
      type: 'warning',
      message: '<img> used without next/image component',
      file: filePath,
      fix: 'Consider using next/image, to optimize images for SEO',
    });
  } 

  console.error('Next.js component scan complete:', filePath);

  return issues;
}

/**
 * Checks file for basic SEO tags (title, meta description, alt tags, viewport).
 * 
 * @param filePath - Path to file to scan
 * @returns List of SEO issues found
 */
async function performBasicScan(filePath: string): Promise<SeoIssue[]> {

  const framework = await detectFramework(findProjectRoot());
  // Skip HTML files for popular frameworks (we assume they handle SEO through components)
  if (framework != 'unknown') return [];

  if (!filePath.endsWith('.html')) return [];

  const issues: SeoIssue[] = [];
  const content = await readFile(filePath, 'utf-8');
  const $ = cheerio.load(content);

  // Check basic SEO rules
  if (basicSeoRules.missingTitle($)) {
    issues.push({
      type: 'error',
      message: 'Missing title tag',
      file: filePath,
      fix: 'Add a descriptive title tag',
    });
  }

  if (basicSeoRules.missingMetaDescription($)) {
    issues.push({
      type: 'warning',
      message: 'Missing meta description',
      file: filePath,
      fix: 'Add a meta description tag',
    });
  }

  if (basicSeoRules.missingAltTags($)) {
    const images = $('img:not([alt])');
    images.each((_, img) => {
      issues.push({
        type: 'warning',
        message: 'Image missing alt text',
        file: filePath,
        element: $.html(img),
        fix: 'Add descriptive alt text to the image',
      });
    });
  }

  if (basicSeoRules.missingViewport($)) {
    issues.push({
      type: 'warning',
      message: 'Missing viewport meta tag',
      file: filePath,
      fix: 'Add viewport meta tag for responsive design',
    });
  }

  return issues;
}

async function performAiScan(filePath: string, openai: OpenAI): Promise<SeoIssue[]> {
  const content = await readFile(filePath, 'utf-8');
  const framework = await detectFramework(findProjectRoot());
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an SEO expert. Analyze the ${framework} code and provide specific SEO improvements. Focus on:
1. Meta tags and title management
2. Image optimization
3. Semantic HTML structure
4. Schema.org markup
5. Accessibility
6. Performance considerations
7. Framework-specific best practices`
        },
        {
          role: "user",
          content: `Analyze this ${framework} code for SEO issues and provide specific fixes. Format each issue as a separate line starting with "ISSUE: ":\n\n${content}`
        }
      ]
    });

    const analysis = completion.choices[0].message.content;
    
    if (!analysis) {
      return [];
    }

    // Parse AI response into structured issues
    return analysis.split('\n')
      .filter(line => line.trim().startsWith('ISSUE: '))
      .map(line => {
        const message = line.replace('ISSUE: ', '').trim();
        return {
          type: 'ai-suggestion',
          message,
          file: filePath,
          fix: message
        };
      });

  } catch (error) {
    console.error('Error during AI analysis:', error);
    return [];
  }
}

/**
 * Main function to scan project for SEO issues.
 * 
 * @param options - Scan options including AI flag and JSON output
 */
export async function scanCommand(options: ScanOptions) {
  const spinner = ora({ 
    text: 'Scanning project for SEO issues...', 
    stream: options.json ? process.stderr : process.stdout 
  }).start();
  const config = await loadConfig();
  let results: ScanResult[] = [];
  let framework = 'unknown';
  
  try {
    // Check authentication if AI is requested
    if (options.ai) {
      const { isAuthenticated, hasAiAccess } = await import('../utils/config.js');
      const isAuth = await isAuthenticated();
      const hasAi = await hasAiAccess();
      
      if (!isAuth) {
        spinner.stop();
        console.log(chalk.yellow('\n⚠️  Authentication required for AI features'));
        console.log(chalk.cyan('Please authenticate first:'));
        console.log(chalk.gray('  cliseo auth\n'));
        return;
      }
      
      if (!hasAi) {
        spinner.stop();
        console.log(chalk.yellow('\n⚠️  AI features are not enabled for your account'));
        console.log(chalk.gray('Contact support or upgrade your plan to access AI features.\n'));
        return;
      }
    }

    const root = findProjectRoot();
    const files = await glob('**/*.{html,jsx,tsx,ts,js,vue}', {
      cwd: root,
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/out/**',
        '**/.git/**',
        '**/coverage/**',
        '**/test/**',
        '**/tests/**',
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/vendor/**',
        '**/public/**'
      ],
      absolute: true,
      dot: true
    });

    if (files.length === 0) {
      spinner.fail('No files found to scan. Make sure you are in a project directory.');
      return;
    }

    if (options.verbose || process.env.CLISEO_VERBOSE === 'true') {
      console.log(chalk.cyan(`📁 Found ${files.length} files to scan`));
    }

    // Limit files for performance
    const MAX_FILES = 500;
    const filteredFiles = files.slice(0, MAX_FILES);
    if (files.length > MAX_FILES) {
      console.log(chalk.yellow(`⚠️  Limited scan to first ${MAX_FILES} files for performance`));
    }

    framework = await detectFramework(root);
    
    const seoFileIssues = await checkRequiredSeoFiles();
    if (seoFileIssues.length > 0) {
      results.push({
        file: 'SEO Files',
        issues: seoFileIssues,
      });
    }

    // Initialize OpenAI if AI is enabled
    let openai: OpenAI | undefined;
    if (options.ai) {
      spinner.text = 'Initializing AI analysis...';
      const { getAuthToken } = await import('../utils/config.js');
      const token = await getAuthToken();
      
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // For AI features, we'll use the backend's OpenAI integration
      // rather than initializing OpenAI directly in the CLI
      spinner.text = 'Running AI-powered deep analysis...';
    }

    for (const file of filteredFiles) {
      const basicIssues = await performBasicScan(file);
      let frameworkIssues: SeoIssue[] = [];
      
      if (framework === 'react') {
        frameworkIssues = await scanReactComponent(file);
      } else if (framework === 'next.js') {
        frameworkIssues = await scanNextComponent(file);
      } else if (framework == 'vue') {
        frameworkIssues = await scanVueComponent(file);
      }

      // Perform AI analysis if enabled
      let aiIssues: SeoIssue[] = [];
      if (options.ai) {
        aiIssues = await performAiScanWithAuth(file);
      }

      if (basicIssues.length > 0 || frameworkIssues.length > 0 || aiIssues.length > 0) {
        results.push({
          file,
          issues: [...basicIssues, ...frameworkIssues, ...aiIssues],
        });
      }
    }

    spinner.succeed('Scan completed successfully!');

    // Output results
    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      displayScanResults(results, framework, options.ai);
    }

  } catch (error) {
    spinner.fail('Scan failed');
    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    } else {
      console.error(chalk.red('An unexpected error occurred'));
    }
    process.exit(1);
  }
}

/**
 * Perform AI scan using authenticated backend request
 */
async function performAiScanWithAuth(file: string): Promise<SeoIssue[]> {
  try {
    const { getAuthToken } = await import('../utils/config.js');
    const token = await getAuthToken();
    
    if (!token) {
      return [];
    }

    // Read file content
    const content = await readFile(file, 'utf-8');
    
    // Make request to backend AI endpoint
    const response = await axios.post('https://a8iza6csua.execute-api.us-east-2.amazonaws.com/ask-openai', {
      prompt: `Analyze this file for SEO issues and provide specific recommendations:\n\nFile: ${file}\n\nContent:\n${content}`,
      context: 'seo-analysis'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    // Parse AI response into issues
    const aiResponse = response.data.response;
    
    // Simple parsing - in a real implementation, you'd want more sophisticated parsing
    const issues: SeoIssue[] = [];
    if (aiResponse && aiResponse.includes('SEO')) {
      issues.push({
        type: 'ai-suggestion',
        message: 'AI-powered SEO recommendations available',
        file,
        fix: aiResponse,
      });
    }

    return issues;
  } catch (error) {
    console.warn(chalk.yellow('⚠️  AI analysis failed for file:', file));
    return [];
  }
}

/**
 * Helper function to display scan results.
 * 
 * @param results - Array of ScanResult objects.
 * @param framework - Detected framework.
 * @param aiEnabled - Boolean indicating if AI is enabled.
 */
function displayScanResults(results: ScanResult[], framework: string, aiEnabled: boolean) {
  const frameWorkColor = framework === 'react' ? chalk.blue : framework === 'vue' ? chalk.green : chalk.gray;
  console.log(chalk.bold('\nDetected Framework: ' + frameWorkColor(framework.toUpperCase())));

  results.forEach(result => {
    if (result.issues.length > 0) {
      console.log(chalk.underline('\nFile:', result.file));
      result.issues.forEach(issue => {
        const icon = issue.type === 'error' ? '❌' : issue.type === 'ai-suggestion' ? '🤖' : '⚠️';
        console.log(`${icon} ${chalk.bold(issue.message)}`);
        console.log(`   ${chalk.gray('Fix:')} ${issue.fix}`);
        if (issue.element) {
          console.log(`   ${chalk.gray('Element:')} ${issue.element}`);
        }
      });
    }
  });

     const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
   const filesWithIssues = results.filter(r => r.issues.length > 0).length;
   console.log(chalk.bold('\nSummary:'));
   console.log(`Found ${totalIssues} issue${totalIssues === 1 ? '' : 's'} in ${filesWithIssues} file${filesWithIssues === 1 ? '' : 's'}.`);
} 
