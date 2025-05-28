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
import { file } from '@babel/types';
import { is } from 'node_modules/cheerio/dist/esm/api/traversing.js';

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
 * Scans project for framework type.
 * 
 * @param projectRoot - Path to project root directory
 * @returns Detected framework: 'angular', 'react', 'vue', or 'unknown'.
 */
function detectFramework(projectRoot: string): 'angular' | 'react' | 'vue' | 'next.js' | 'unknown' {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (!existsSync(packageJsonPath)) return 'unknown';

  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  if ('@angular/core' in deps) return 'angular';
  if ('react' in deps || 'react-dom' in deps) return 'react';
  if ('vue' in deps) return 'vue';
  if ('next' in deps) return 'next.js';

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

  // Check for links without descriptive text
  const linkRegex = /<(?:Link|a)[^>]*>([^<]*)<\/(?:Link|a)>/g;
  while ((match = linkRegex.exec(content)) !== null) {
    const linkTag = match[0];
    const linkText = match[1].trim();

    // Check for non-descriptive link text
    const nonDescriptiveText = ['click here', 'here', 'read more', 'learn more', 'more', 'link'];
    if (nonDescriptiveText.includes(linkText.toLowerCase())) {
      issues.push({
        type: 'warning',
        message: 'Non-descriptive link text found',
        file: filePath,
        element: linkTag,
        fix: 'Use descriptive text that explains where the link goes',
      });
    }

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

/**
 * Checks file for basic SEO tags (title, meta description, alt tags, viewport).
 * 
 * @param filePath - Path to file to scan
 * @returns List of SEO issues found
 */
async function performBasicScan(filePath: string): Promise<SeoIssue[]> {

  const framework = detectFramework(findProjectRoot());
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

// async function performAiScan(filePath: string, openai: OpenAI): Promise<SeoIssue[]> {
//   const content = await readFile(filePath, 'utf-8');
  
//   try {
//     const completion = await openai.chat.completions.create({
//       model: "gpt-4",
//       messages: [
//         {
//           role: "system",
//           content: "You are an SEO expert. Analyze the HTML content and provide specific SEO improvements."
//         },
//         {
//           role: "user",
//           content: `Analyze this HTML for SEO issues and provide specific fixes:\n\n${content}`
//         }
//       ]
//     });

//     const analysis = completion.choices[0].message.content;
    
//     // Parse AI response into structured issues
//     // This is a simplified version - you'd want more robust parsing
//     return analysis.split('\n')
//       .filter(line => line.trim())
//       .map(issue => ({
//         type: 'ai-suggestion',
//         message: issue,
//         file: filePath,
//         fix: issue
//       }));

//   } catch (error) {
//     console.error('Error during AI analysis:', error);
//     return [];
//   }
// }

/**
 * Main function to scan project for SEO issues.
 * 
 * @param options - Scan options including AI flag and JSON output
 */
export async function scanCommand(options: ScanOptions) {
  const spinner = ora('Scanning project for SEO issues...').start();
  const config = await loadConfig();
  
  try {
    // Find all HTML/JSX/TSX files
    const files = await glob('**/*.{html,jsx,tsx,ts}', {
      ignore: ['node_modules/**', 'dist/**', 'build/**'],
    });

    // let openai;
    // if (options.ai) {
    //   if (!config.openaiApiKey) {
    //     spinner.fail('OpenAI API key not found!');
    //     console.log('Run `cliseo auth` to set up your API key.');
    //     process.exit(1);
    //   }
      
    //   openai = new OpenAI({
    //     apiKey: config.openaiApiKey
    //   });
    // }

    const results: ScanResult[] = [];

    // Check for required SEO files first
    const seoFileIssues = await checkRequiredSeoFiles();
    if (seoFileIssues.length > 0) {
      results.push({
        file: 'SEO Files',
        issues: seoFileIssues,
      });
    }

    const framework = detectFramework(findProjectRoot());

    // Scan all files
   for (const file of files) {
    const basicIssues = await performBasicScan(file);

    let frameworkIssues: SeoIssue[] = [];

    if (framework === 'react') {
      frameworkIssues = await scanReactComponent(file);
    } else if (framework === 'angular') {
      frameworkIssues = await scanAngularComponent(file); 
    } else if (framework === 'vue') {
      //frameworkIssues = await scanVueComponent(file);
    }

    // let aiIssues: SeoIssue[] = [];
    // if (options.ai && openai) {
    //   aiIssues = await performAiScan(file, openai);
    // }

    if (basicIssues.length > 0 || frameworkIssues.length > 0 /* || aiIssues.length > 0 */) {
      results.push({
        file,
        issues: [...basicIssues, ...frameworkIssues /*, ...aiIssues */],
      });
    }
  }


    spinner.succeed('Scan complete!');
    const frameWorkColor = framework === 'angular' ? chalk.red : framework === 'react' ? chalk.blue : framework === 'vue' ? chalk.green : chalk.gray;
    console.log(chalk.bold('\nDetected Framework: ' + frameWorkColor(framework.toUpperCase())));

    // Output results
    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
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
          });
        }
      });

      // Summary
      const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
      const filesWithIssues = results.length;
      console.log(chalk.bold('\nSummary:'));
      console.log(`Found ${totalIssues} issue${totalIssues === 1 ? '' : 's'} in ${filesWithIssues} file${filesWithIssues === 1 ? '' : 's'} (scanned ${files.length} files total).`);
    }

  } catch (error) {
    spinner.fail('Scan failed!');
    console.error(error);
    process.exit(1);
  }
} 
