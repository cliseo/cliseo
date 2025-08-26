import { glob } from 'glob';
import * as cheerio from 'cheerio';
import chalk from 'chalk';
import ora from 'ora';
import { readFile } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import path from 'path';
import { readFileSync, existsSync } from 'fs';

import { loadConfig } from '../utils/config.js';
import { ScanOptions, SeoIssue, ScanResult } from '../types/index.js';
import fs from 'fs';
// import { authCommand } from './auth.js'; // Removed - no longer needed
// import { file } from '@babel/types'; // Removed - unused import
// import { detectFramework, findProjectRoot } from '../utils/detect-framework.js';
// import { scanReactComponent } from '../frameworks/react.js';
import axios from 'axios';

import readline from 'readline';
import { exec } from 'child_process';

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
 * Scans project for required SEO files (robots.txt, sitemap.xml, llms.txt).
 * 
 * @returns List of SEO issues found.
 */
async function checkRequiredSeoFiles(): Promise<SeoIssue[]> {
  const issues: SeoIssue[] = [];
  const root = findProjectRoot();
  
  // Check in both root and public directories for SEO files
  const possiblePaths = [
    { robots: join(root, 'robots.txt'), sitemap: join(root, 'sitemap.xml'), llms: join(root, 'llms.txt') },
    { robots: join(root, 'public', 'robots.txt'), sitemap: join(root, 'public', 'sitemap.xml'), llms: join(root, 'public', 'llms.txt') }
  ];

  let robotsFound = false;
  let sitemapFound = false;
  let llmsFound = false;

  // Check all possible locations
  for (const paths of possiblePaths) {
    try {
      await readFile(paths.robots, 'utf-8');
      robotsFound = true;
      break;
    } catch {
      // Continue checking other locations
    }
  }

  for (const paths of possiblePaths) {
    try {
      await readFile(paths.sitemap, 'utf-8');
      sitemapFound = true;
      break;
    } catch {
      // Continue checking other locations
    }
  }

  for (const paths of possiblePaths) {
    try {
      await readFile(paths.llms, 'utf-8');
      llmsFound = true;
      break;
    } catch {
      // Continue checking other locations
    }
  }

  if (!robotsFound) {
    issues.push({
      type: 'error',
      message: 'Missing robots.txt file',
      file: 'robots.txt',
      fix: 'Run `cliseo optimize` to generate a robots.txt file with recommended settings',
    });
  }

  if (!sitemapFound) {
    issues.push({
      type: 'error',
      message: 'Missing sitemap.xml file',
      file: 'sitemap.xml',
      fix: 'Run `cliseo optimize` to generate a sitemap.xml file with your site structure',
    });
  }

  if (!llmsFound) {
    issues.push({
      type: 'warning',
      message: 'Missing llms.txt file',
      file: 'llms.txt',
      fix: 'Run `cliseo optimize` to generate an llms.txt file for AI model guidance',
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
  missingLlmsTxt: async (projectRoot: string) => {
    try {
      await readFile(join(projectRoot, 'llms.txt'));
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

  // Check for canonical tags
  if (!content.includes('rel="canonical"')) {
    issues.push({
      type: 'warning',
      message: 'Missing canonical tag',
      file: filePath,
      fix: 'Add a canonical tag to prevent duplicate content issues',
    });
  }
  // Check for Open Graph tags
  if (!content.includes('property="og:')) {
    issues.push({
      type: 'warning',
      message: 'Missing Open Graph tags',
      file: filePath,
      fix: 'Add Open Graph tags for better social media integration',
    });
  }

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

  // Check for critical "use client" + metadata issue
  const hasUseClient = content.includes('"use client"') || content.includes("'use client'");
  const hasMetadataExport = content.includes('export const metadata');
  
  if (hasUseClient && hasMetadataExport) {
    issues.push({
      type: 'error',
      message: 'Client component with metadata export - metadata will be ignored by Next.js',
      file: filePath,
      fix: 'Move metadata to app/layout.tsx or create a server component wrapper. Metadata only works in server components.',
    });
  }

  // Check for missing App Router metadata in server components
  if (!hasUseClient && !hasMetadataExport && filePath.includes('/app/') && (filePath.endsWith('page.tsx') || filePath.endsWith('page.ts'))) {
    issues.push({
      type: 'warning',
      message: 'Missing metadata export for App Router page component',
      file: filePath,
      fix: 'Add export const metadata = { title: "...", description: "..." } for better SEO',
    });
  }

  if (!content.includes('<Head>') && !hasMetadataExport) {
    console.error('No <Head> component found in:', filePath);
    issues.push({
      type: 'warning',
      message: 'No <Head> component or metadata export found for managing meta tags',
      file: filePath,
      fix: 'Consider using next/head or App Router metadata export to manage title and meta tags',
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



/**
 * Main function to scan project for SEO issues.
 * 
 * @param options - Scan options including verbose and JSON output
 */
export async function scanCommand(options: ScanOptions) {
  const spinner = options.json 
    ? { stop: () => {}, succeed: () => {}, fail: () => {}, text: '' } // No-op spinner for JSON mode
    : ora({ text: 'Scanning project for SEO issues...' }).start();
  const config = await loadConfig();
  let results: ScanResult[] = [];
  let framework = 'unknown';
  
  try {

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
      if (options.json) {
        spinner.stop();
        console.error(JSON.stringify({ error: 'No files found to scan. Make sure you are in a project directory.' }));
      } else {
        spinner.fail('No files found to scan. Make sure you are in a project directory.');
      }
      return;
    }

    if (!options.json && (options.verbose || process.env.CLISEO_VERBOSE === 'true')) {
      console.log(chalk.cyan(`📁 Found ${files.length} files to scan`));
    }

    // Limit files for performance
    const MAX_FILES = 500;
    const filteredFiles = files.slice(0, MAX_FILES);
    if (!options.json && files.length > MAX_FILES) {
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



    const fileScanPromises = filteredFiles.map(async (file) => {
      const basicIssues = await performBasicScan(file);
      let frameworkIssues: SeoIssue[] = [];
      
      if (framework === 'react') {
        frameworkIssues = await scanReactComponent(file);
      } else if (framework === 'next.js') {
        frameworkIssues = await scanNextComponent(file);
      } else if (framework == 'vue') {
        frameworkIssues = await scanVueComponent(file);
      }

      if (basicIssues.length > 0 || frameworkIssues.length > 0) {
        results.push({
          file,
          issues: [...basicIssues, ...frameworkIssues],
        });
      }
    });
    await Promise.all(fileScanPromises);

    if (options.json) {
      spinner.stop();
    } else {
      spinner.succeed('Scan completed successfully!');
    }

    // Output results
    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      displayScanResults(results, framework);
    }

  } catch (error) {
    if (options.json) {
      spinner.stop();
      console.error(JSON.stringify({ error: error instanceof Error ? error.message : 'An unexpected error occurred' }));
    } else {
      spinner.fail('Scan failed');
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      } else {
        console.error(chalk.red('An unexpected error occurred'));
      }
    }
    process.exit(1);
  }

  // After displaying results - skip interactive mode for JSON output
  if (options.json) {
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(chalk.greenBright('\nFix these changes? (y/n) '), (answer) => {
    if (answer.toLowerCase() === 'y') {
      const optimizeCommand = 'cliseo optimize';
      console.log(chalk.cyan(`\nRunning ${optimizeCommand}...`));
      exec(optimizeCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(chalk.red(`Error executing ${optimizeCommand}:`, error));
          console.error(chalk.red('Please ensure the command is correct and try again.'));
          return;
        }
        console.log(stdout);
        if (stderr) {
          console.error(chalk.red(stderr));
        }
      });
    }
    rl.close();
  });
}



/**
 * Helper function to display scan results.
 * 
 * @param results - Array of ScanResult objects.
 * @param framework - Detected framework.
 */
function displayScanResults(results: ScanResult[], framework: string) {
  const frameWorkColor = framework === 'react' ? chalk.blue : framework === 'vue' ? chalk.green : chalk.gray;
  console.log(chalk.bold('\nDetected Framework: ' + frameWorkColor(framework.toUpperCase())));

  results.forEach(result => {
    if (result.issues.length > 0) {
      console.log(chalk.underline('\nFile:', result.file));
      result.issues.forEach(issue => {
        const icon = issue.type === 'error' ? '❌' : '⚠️';
        console.log(`${icon} ${chalk.bold(issue.message)}`);
        console.log(`   ${chalk.gray('Fix:')} ${issue.fix}`);
        if (issue.element) {
          console.log(`   ${chalk.gray('Element:')} ${issue.element}`);
        }
        if (issue.explanation) {
          console.log(`   ${chalk.gray('Why:')} ${issue.explanation}`);
        }
      });
    }
  });

  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
  const filesWithIssues = results.filter(r => r.issues.length > 0).length;
  console.log(chalk.bold('\nSummary:'));
  console.log(`Found ${totalIssues} issue${totalIssues === 1 ? '' : 's'} in ${filesWithIssues} file${filesWithIssues === 1 ? '' : 's'}.`);
  
  if (totalIssues > 0) {
    console.log(chalk.gray('\n💡 Run `cliseo optimize` to automatically apply fixes'));
  }
} 
