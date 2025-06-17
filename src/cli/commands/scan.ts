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
import { authCommand } from './auth.js';
// import { detectFramework, findProjectRoot } from '../utils/detect-framework.js';
// import { scanReactComponent } from '../frameworks/react.js';

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
async function detectFramework(projectRoot: string): Promise<'angular' | 'react' | 'vue' | 'next.js' | 'unknown'> {
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
      if ('@angular/core' in deps) return 'angular';
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
  //ignor entry point files
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
 * Checks Angular component for SEO issues.
 * 
 * @param filePath - Path to Angular component file to scan.
 * @returns List of SEO issues found.
 */
async function scanAngularComponent(filePath: string): Promise<SeoIssue[]> {
  const issues: SeoIssue[] = [];
  const content = await readFile(filePath, 'utf-8');

  if (filePath.endsWith('app.component.ts') && !(content.includes('titleService: Title') || content.includes('metaService: Meta'))) {
    issues.push({
      type: 'warning',
      message: 'No title and meta management found for app component',
      file: filePath,
      fix: 'Consider using @angular/platform-browser, to manage title and meta tags in standalone components',
    });
  }
  else if (content.includes('standalone: true') && !(content.includes('titleService: Title') || content.includes('metaService: Meta'))) {
    issues.push({
      type: 'warning',
      message: 'No title and meta management found for standalone component',
      file: filePath,
      fix: 'Consider using @angular/platform-browser, to manage title and meta tags in standalone components',
    });
  } 
  else if (content.includes('<img') && !content.includes('ngOptimizedImage')) {
    issues.push({
      type: 'warning',
      message: 'Image without ngOptimizedImage directive',
      file: filePath,
      fix: 'Add ngOptimizedImage directive to optimize images for SEO',
    });
  }

  return issues;
}

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
    const root = findProjectRoot();
    const files = await glob('**/*.{html,jsx,tsx,ts,js}', {
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

    // Filter out any files that still managed to get through (like nested node_modules)
    const filteredFiles = files.filter(file => {
      return !file.includes(`${path.sep}node_modules${path.sep}`) &&
             !file.includes('/node_modules/') &&
             !file.includes('node_modules\\') &&
             !file.includes(`${path.sep}dist${path.sep}`) &&
             !file.includes('/dist/') &&
             !file.includes('dist\\') &&
             !file.includes(`${path.sep}build${path.sep}`) &&
             !file.includes('/build/') &&
             !file.includes('build\\') &&
             !file.includes(`${path.sep}.next${path.sep}`) &&
             !file.includes('/.next/') &&
             !file.includes('.next\\') &&
             !file.includes(`${path.sep}out${path.sep}`) &&
             !file.includes('/out/') &&
             !file.includes('out\\') &&
             !file.includes(`${path.sep}.git${path.sep}`) &&
             !file.includes('/.git/') &&
             !file.includes('.git\\') &&
             !file.includes(`${path.sep}coverage${path.sep}`) &&
             !file.includes('/coverage/') &&
             !file.includes('coverage\\') &&
             !file.includes(`${path.sep}test${path.sep}`) &&
             !file.includes('/test/') &&
             !file.includes('test\\') &&
             !file.includes(`${path.sep}tests${path.sep}`) &&
             !file.includes('/tests/') &&
             !file.includes('tests\\') &&
             !file.includes(`${path.sep}__tests__${path.sep}`) &&
             !file.includes('/__tests__/') &&
             !file.includes('__tests__\\') &&
             !file.includes(`${path.sep}__mocks__${path.sep}`) &&
             !file.includes('/__mocks__/') &&
             !file.includes('__mocks__\\') &&
             !file.includes(`${path.sep}vendor${path.sep}`) &&
             !file.includes('/vendor/') &&
             !file.includes('vendor\\') &&
             !file.includes(`${path.sep}public${path.sep}`) &&
             !file.includes('/public/') &&
             !file.includes('public\\');
    });

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
      // Check if user is authenticated
      if (!config.openaiApiKey) {
        spinner.stop();
        console.log(chalk.yellow('\n⚠️  Authentication required for AI features'));
        console.log(chalk.cyan('\nPlease log in to use AI-powered features:'));
        await authCommand();
        // Reload config after authentication
        const newConfig = await loadConfig();
        if (!newConfig.openaiApiKey) {
          throw new Error('Authentication failed. Please try again.');
        }
        spinner.start('Running AI-powered deep analysis...');
        openai = new OpenAI({ apiKey: newConfig.openaiApiKey });
      } else {
        openai = new OpenAI({ apiKey: config.openaiApiKey });
        spinner.text = 'Running AI-powered deep analysis...';
      }
    }

    for (const file of filteredFiles) {
      const basicIssues = await performBasicScan(file);
      let frameworkIssues: SeoIssue[] = [];
      
      if (framework === 'react') {
        frameworkIssues = await scanReactComponent(file);
      } else if (framework === 'angular') {
        frameworkIssues = await scanAngularComponent(file);
      } else if (framework === 'next.js') {
        frameworkIssues = await scanNextComponent(file);
      }

      // Perform AI analysis if enabled
      let aiIssues: SeoIssue[] = [];
      if (options.ai && openai) {
        aiIssues = await performAiScan(file, openai);
      }

      if (basicIssues.length > 0 || frameworkIssues.length > 0 || aiIssues.length > 0) {
        results.push({
          file,
          issues: [...basicIssues, ...frameworkIssues, ...aiIssues],
        });
      }
    }

    if (options.json) {
      spinner.stop();
      console.log(JSON.stringify(results, null, 2));
    } else {
      spinner.succeed('Scan complete!');
      const frameWorkColor = framework === 'angular' ? chalk.red : framework === 'react' ? chalk.blue : framework === 'vue' ? chalk.green : chalk.gray;
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
      console.log(`Found ${totalIssues} issue${totalIssues === 1 ? '' : 's'} in ${filesWithIssues} file${filesWithIssues === 1 ? '' : 's'} (scanned ${files.length} files total).`);
    }

  } catch (error) {
    if (!options.json) {
      spinner.fail('Scan failed!');
    }
    console.error(error);
    process.exit(1);
  }
} 
