import { writeFile, access, readFile } from 'fs/promises';
import { readFileSync, existsSync } from 'fs';
import * as cheerio from 'cheerio';
import { join, dirname, resolve } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { glob } from 'glob';
import fs from 'fs';
import path from 'path';
import { optimizeReactComponents } from './optimize-react.js';
import { optimizeAngular } from './optimize-angular.js';
import { optimizeNextjsComponents } from './optimize-next.js';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

interface ProjectAnalysis {
  projectName: string;
  description: string;
}

function findProjectRoot(startDir = process.cwd()): string {
  let dir = resolve(startDir);
  while (dir !== dirname(dir)) {
    if (fs.existsSync(join(dir, 'package.json'))) return dir;
    dir = dirname(dir);
  }
  return process.cwd(); 
}

async function ensureSeoFiles(framework: string, projectRoot: string) {
  let robotsCreated = false;
  let sitemapCreated = false;

  let targetDir = projectRoot;
  if (framework === 'react' || framework === 'next.js') {
    targetDir = join(projectRoot, 'public');
  } else if (framework === 'angular') {
    targetDir = join(projectRoot, 'src', 'assets');
  }

  try { await fs.promises.mkdir(targetDir, { recursive: true }); } catch {}

  const robotsPath = join(targetDir, 'robots.txt');
  const sitemapPath = join(targetDir, 'sitemap.xml');

  const robotsContent = `# robots.txt for ${projectRoot.split('/').pop() || 'your site'}

User-agent: *
Allow: /

Disallow: /admin/
Disallow: /private/
Disallow: /api/
Disallow: /_next/
Disallow: /static/

User-agent: GPTBot
Crawl-delay: 1

User-agent: ChatGPT-User
Crawl-delay: 1

Sitemap: https://yourdomain.com/sitemap.xml`;

  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://yourdomain.com/</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

  try { await access(robotsPath); } catch { await writeFile(robotsPath, robotsContent); robotsCreated = true; }
  try { await access(sitemapPath); } catch { await writeFile(sitemapPath, sitemapContent); sitemapCreated = true; }

  if (framework === 'angular' && sitemapCreated) {
    if (process.env.CLISEO_VERBOSE === 'true') {
      console.log(chalk.yellow('ℹ️  Remember to ensure sitemap.xml is listed under assets in angular.json so it is copied to the build output.'));
    }
  }

  return { robotsCreated, sitemapCreated };
}

function getPagesDirectory(projectRoot: string, framework: string): string[] {
  const directories: string[] = [];
  
  switch (framework) {
    case 'next.js':
      if (existsSync(join(projectRoot, 'pages'))) directories.push(join(projectRoot, 'pages'));
      if (existsSync(join(projectRoot, 'app'))) directories.push(join(projectRoot, 'app'));
      break;
    case 'react':
      if (existsSync(join(projectRoot, 'src', 'pages'))) directories.push(join(projectRoot, 'src', 'pages'));
      break;
    case 'angular':
      if (existsSync(join(projectRoot, 'src', 'app', 'pages'))) {
        directories.push(join(projectRoot, 'src', 'app', 'pages'));
      } else if (existsSync(join(projectRoot, 'src', 'app'))) {
        directories.push(join(projectRoot, 'src', 'app'));
      }
      break;
  }
  return directories;
}

function getFrameworkFileExtensions(framework: string): string[] {
  switch (framework) {
    case 'next.js':
    case 'react':
      return ['**/*.{js,jsx,ts,tsx}'];
    case 'angular':
      return ['**/*.ts', '**/*.html'];
    default:
      return ['**/*.html'];
  }
}

async function getFilesToOptimize(projectRoot: string, framework: string): Promise<string[]> {
  const pagesDirectories = getPagesDirectory(projectRoot, framework);
  const files: string[] = [];
  
  if (pagesDirectories.length === 0) {
    return files;
  }
  
  const extensions = getFrameworkFileExtensions(framework);
  
  for (const pagesDir of pagesDirectories) {
    for (const ext of extensions) {
      const foundFiles = await glob(ext, {
        cwd: pagesDir,
        absolute: true,
        ignore: ['**/node_modules/**']
      });
      files.push(...foundFiles);
    }
  }
  return files;
}

async function addMetaTagsToHtmlFiles(projectRoot: string, framework: string) {
  const files = await getFilesToOptimize(projectRoot, framework);
  const htmlFiles = files.filter(file => file.endsWith('.html'));
  
  if (htmlFiles.length === 0) return;
  
  for (const file of htmlFiles) {
    const content = await fs.promises.readFile(file, 'utf-8');
    const $ = cheerio.load(content);
    if (!$('title').length) $('head').append('<title>Your Site Title</title>');
    if (!$('meta[name="description"]').length) $('head').append('<meta name="description" content="Your site description" />');
    await fs.promises.writeFile(file, $.html());
  }
}

async function addImagesAltAttributes(projectRoot: string, framework: string) {
  const files = await getFilesToOptimize(projectRoot, framework);
  const imageFiles = files.filter(file => file.endsWith('.html') || file.endsWith('.jsx') || file.endsWith('.tsx'));

  if (imageFiles.length === 0) return;

  for (const file of imageFiles) {
    const content = await fs.promises.readFile(file, 'utf-8');
    const $ = cheerio.load(content);
    
    $('img:not([alt])').attr('alt', 'Image description');
    
    await fs.promises.writeFile(file, $.html());
  }
}

async function detectFramework(projectRoot: string): Promise<'angular' | 'react' | 'next.js' | 'unknown'> {
  try {
    const packageJsonPath = join(projectRoot, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (dependencies['next']) return 'next.js';
    if (dependencies['@angular/core']) return 'angular';
    if (dependencies['react']) return 'react';
    
    return 'unknown';
  } catch (error) {
    return 'unknown';
  }
}


export async function optimizeCommand(directory: string | undefined, options: { ai?: boolean; yes?: boolean; dryRun?: boolean }) {
  const dir = directory ? resolve(process.cwd(), directory) : process.cwd();
  
  const spinner = ora('Detecting framework...').start();
  const framework = await detectFramework(dir);
  spinner.succeed(`Detected ${framework} project.`);
  
  if (framework === 'unknown') {
    console.log(chalk.red('Could not determine project framework. Please run this command from the root of a Next.js, React, or Angular project.'));
    return;
  }

  const { robotsCreated, sitemapCreated } = await ensureSeoFiles(framework, dir);
  if (robotsCreated) console.log(chalk.green('✓ Created robots.txt'));
  if (sitemapCreated) console.log(chalk.green('✓ Created sitemap.xml'));

  switch (framework) {
    case 'next.js':
      spinner.start('Optimizing Next.js components...');
      try {
        await optimizeNextjsComponents(dir);
        spinner.succeed('Next.js components optimized.');
      } catch (err) {
        spinner.fail('Next.js optimization failed.');
        console.error(err);
      }
      break;

    case 'react':
      spinner.start('Optimizing React components...');
      try {
        await optimizeReactComponents(dir);
        spinner.succeed('React components optimized.');
      } catch (err) {
        spinner.fail('React optimization failed.');
        console.error(err);
      }
      break;

    case 'angular':
      spinner.start('Optimizing Angular components...');
      try {
         await optimizeAngular(dir);
         spinner.succeed('Angular components optimized.');
      } catch (err) {
         spinner.fail('Angular optimization failed.');
         console.error(err);
      }
      break;
    default:
      console.log('Could not determine project type. Skipping framework-specific optimizations.');
      break;
  }
} 