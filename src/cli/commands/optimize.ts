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
import { optimizeNextjsComponents } from './optimize-next.js';
import inquirer from 'inquirer';
import { execSync } from 'child_process';

interface ProjectAnalysis {
  projectName: string;
  description: string;
}

/**
 * Finds the project root directory
 * 
 * @param startDir - Directory to start searching from (default: current working directory)
 * @returns Path to the project root directory
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
 * Ensures the existence of SEO files
 */
async function ensureSeoFiles(framework: string, projectRoot: string) {
  let robotsCreated = false;
  let sitemapCreated = false;

  // decide target directory based on framework
  let targetDir = projectRoot;
  if (framework === 'react' || framework === 'next.js') {
    targetDir = join(projectRoot, 'public');
  }

  // make sure directory exists
  try { await fs.promises.mkdir(targetDir, { recursive: true }); } catch {}

  const robotsPath = join(targetDir, 'robots.txt');
  const sitemapPath = join(targetDir, 'sitemap.xml');

  // Enhanced robots.txt template
  const robotsContent = `# robots.txt for ${projectRoot.split('/').pop() || 'your site'}

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

  try { await access(robotsPath); } catch { await writeFile(robotsPath, robotsContent); robotsCreated = true; }
  try { await access(sitemapPath); } catch { await writeFile(sitemapPath, sitemapContent); sitemapCreated = true; }

  return { robotsCreated, sitemapCreated };
}

/**
 * Determines the pages directory for a given framework
 */
function getPagesDirectory(projectRoot: string, framework: string): string[] {
  const directories: string[] = [];
  switch (framework) {
    case 'next.js':
      if (existsSync(join(projectRoot, 'pages'))) {
        directories.push(join(projectRoot, 'pages'));
      }
      if (existsSync(join(projectRoot, 'app'))) {
        directories.push(join(projectRoot, 'app'));
      }
      break;
    case 'react':
      if (existsSync(join(projectRoot, 'src', 'pages'))) {
        directories.push(join(projectRoot, 'src', 'pages'));
      }
      break;
    case 'angular':
      if (existsSync(join(projectRoot, 'src'))) {
        directories.push(join(projectRoot, 'src'));
      }
      break;
  }
  return directories;
}

/**
 * Gets framework-specific file extensions to optimize
 */
function getFrameworkFileExtensions(framework: string): string[] {
  switch (framework) {
    case 'next.js':
    case 'react':
      return ['**/*.{js,jsx,ts,tsx}'];
    case 'angular':
      return ['**/*.html'];
    default:
      return ['**/*.html'];
  }
}

/**
 * Gets all files to optimize based on framework and pages directory
 */
async function getFilesToOptimize(projectRoot: string, framework: string): Promise<string[]> {
  const pagesDirectories = getPagesDirectory(projectRoot, framework);
  const files: string[] = [];
  
  if (pagesDirectories.length === 0) {
    console.log(chalk.yellow(`⚠️  No pages directory found for ${framework}. Skipping file optimizations.`));
    return files;
  }
  
  if (process.env.CLISEO_VERBOSE === 'true') {
    console.log(chalk.cyan(`📁 Found pages directories: ${pagesDirectories.map(dir => path.relative(projectRoot, dir)).join(', ')}`));
  }
  
  // Get framework-specific file extensions
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
  
  if (process.env.CLISEO_VERBOSE === 'true') {
    console.log(chalk.cyan(`📄 Found ${files.length} files to optimize`));
  }
  return files;
}

/**
 * Adds meta tags to HTML files in the pages directory.
 */
async function addMetaTagsToHtmlFiles(projectRoot: string, framework: string) {
  const files = await getFilesToOptimize(projectRoot, framework);
  
  // Only process HTML files - framework-specific optimizers handle component files
  const htmlFiles = files.filter(file => file.endsWith('.html'));
  
  if (htmlFiles.length === 0) {
    if (process.env.CLISEO_VERBOSE === 'true') {
      console.log(chalk.gray(`No HTML files found in pages directory. Component files will be handled by ${framework} optimizer.`));
    }
    return;
  }
  
  console.log(chalk.cyan(`🔧 Adding meta tags to ${htmlFiles.length} HTML files...`));
  
  for (const file of htmlFiles) {
    const content = await fs.promises.readFile(file, 'utf-8');
    const $ = cheerio.load(content);
    
    // Add title if missing
    if (!$('title').length) {
      $('head').append('<title>Your Site Title</title>');
    }
    
    // Add viewport meta if missing
    if (!$('meta[name="viewport"]').length) {
      $('head').append('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
    }
    
    // Add description meta if missing
    if (!$('meta[name="description"]').length) {
      $('head').append('<meta name="description" content="Your site description">');
    }
    
    await fs.promises.writeFile(file, $.html());
  }
}

/**
 * Adds alt attributes to images in files in the pages directory.
 */
async function addImagesAltAttributes(projectRoot: string, framework: string) {
  const files = await getFilesToOptimize(projectRoot, framework);
  
  // Only process HTML files for image alt attributes
  const htmlFiles = files.filter(file => file.endsWith('.html'));
  
  if (htmlFiles.length === 0) {
    if (process.env.CLISEO_VERBOSE === 'true') {
      console.log(chalk.gray(`No HTML files found in pages directory. Image alt attributes will be handled by framework-specific optimizers.`));
    }
    return;
  }
  
  console.log(chalk.cyan(`🖼️  Adding alt attributes to images in ${htmlFiles.length} HTML files...`));
  
  for (const file of htmlFiles) {
    const content = await fs.promises.readFile(file, 'utf-8');
    const $ = cheerio.load(content);
    
    $('img').each((_, element) => {
      if (!$(element).attr('alt')) {
        const src = $(element).attr('src') || '';
        const alt = path.basename(src, path.extname(src))
          .replace(/[-_]/g, ' ')
          .replace(/([A-Z])/g, ' $1')
          .trim();
        $(element).attr('alt', alt);
      }
    });
    
    await fs.promises.writeFile(file, $.html());
  }
}

/**
 * Scans all package.json files in the project for framework dependencies.
 * Returns the first framework found, or 'unknown' if none found.
 */
async function detectFramework(projectRoot: string): Promise<'react' | 'vue' | 'next.js' | 'angular' | 'unknown'> {
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
      if ('@angular/core' in deps) return 'angular';
      if ('vue' in deps) return 'vue';
    } catch (e) {}
  }
  return 'unknown';
}

/**
 * * Main function to optimize SEO for the project.
 */
export async function optimizeCommand(directory: string | undefined, options: { ai?: boolean; yes?: boolean; dryRun?: boolean }) {
  const dir = resolve(directory || '.');
  const spinner = ora('Starting SEO optimization...').start();

  try {
    // Skip AI analysis since it's been removed
    if (options.ai) {
      spinner.warn(chalk.yellow('⚠️ AI analysis is currently disabled.'));
      console.log('');
    }

    // Continue with the rest of the optimization...
    spinner.start('Running standard SEO optimizations...');
    
    spinner.text = 'Checking SEO files...';
    const framework = await detectFramework(dir);
    
    const { robotsCreated, sitemapCreated } = await ensureSeoFiles(framework, dir);

    if (process.env.CLISEO_VERBOSE === 'true') {
      spinner.succeed('SEO file check complete!');
    } else { spinner.stop(); }

    if (process.env.CLISEO_VERBOSE === 'true') {
      if (robotsCreated) console.log(chalk.green('✔ Created robots.txt'));
      if (sitemapCreated) console.log(chalk.green('✔ Created sitemap.xml'));
      if (!robotsCreated && !sitemapCreated) console.log(chalk.gray('robots.txt and sitemap.xml already exist.'));
    }

    spinner.text = 'Adding proper tags to HTML files...';
    
    // Only process HTML files in the main function - framework-specific optimizers handle component files
    if (framework !== 'unknown') {
      await addMetaTagsToHtmlFiles(dir, framework);
      await addImagesAltAttributes(dir, framework);
    }
    
    if (process.env.CLISEO_VERBOSE === 'true') { spinner.succeed('Tags added to HTML files!'); } else { spinner.stop(); }

    const frameWorkColor = framework === 'react' ? chalk.blue : chalk.gray;
    console.log(chalk.bold('\nDetected Framework: ' + frameWorkColor(framework.toUpperCase())));

    // Framework-specific optimizations
    if (framework === 'react') {
      spinner.text = 'Optimizing React components...';
      try {
        await optimizeReactComponents(dir);
        if (process.env.CLISEO_VERBOSE === 'true') spinner.succeed('React components optimized successfully!'); else spinner.stop();
      } catch (err) {
        spinner.fail('Failed to optimize React components.');
        console.error(err);
      }
    } else if (framework === 'next.js') {
      spinner.text = 'Optimizing Next.js components...';
      try {
        await optimizeNextjsComponents(dir);
        if (process.env.CLISEO_VERBOSE === 'true') spinner.succeed('Next.js components optimized successfully!'); else spinner.stop();
      } catch (err) {
        spinner.fail('Failed to optimize Next.js components.');
        console.error(err);
      }
    } else if (framework === 'angular') {
      spinner.text = 'Running Angular HTML SEO enhancements...';
      spinner.succeed('Angular SEO enhancements complete.');
    }
    else if (framework === 'unknown') {
      console.log(chalk.yellow('⚠️  Unknown framework detected. Only basic SEO files were created.'));
    }

    console.log(chalk.bold.green('\n✅ SEO optimization complete!'));

    // Skip interactive prompts in CI/non-TTY environments or when --yes flag is provided
    const skipPrompts = options.yes || process.env.CI === 'true' || !process.stdin.isTTY;

    if (!skipPrompts) {
      // --- PR creation functionality temporarily disabled ---
      /*
      // Check if we're in a git repository
      try {
        execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });

        // Ask about creating a PR
        const { createPr } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'createPr',
            message: 'Would you like to create a Pull Request with these changes?',
            default: false
          }
        ]);

        if (createPr) {
          spinner.start('Creating Pull Request...');
          try {
            // Create a new branch
            const branchName = `seo-optimization-${Date.now()}`;
            execSync(`git checkout -b ${branchName}`);

            // Add and commit changes
            execSync('git add .');
            execSync('git commit -m "chore: SEO optimizations"');

            // Push branch and create PR
            execSync(`git push -u origin ${branchName}`);

            // Get the current repository URL
            const repoUrl = execSync('git config --get remote.origin.url').toString().trim();
            const prUrl = repoUrl.replace('.git', `/compare/${branchName}`);

            spinner.succeed(chalk.green('Pull Request created!'));
            console.log(chalk.cyan(`PR URL: ${prUrl}`));
          } catch (error) {
            spinner.fail(chalk.red('Failed to create Pull Request.'));
            console.error(error);
          }
        }
      } catch (error) {
        // Not inside a git repository; silently skip PR creation
      }
      */
      // --- End PR creation functionality ---
    }
  } catch (error) {
    spinner.fail(chalk.red('\n❌ An unexpected error occurred during optimization.'));
    if (error instanceof Error) console.error(chalk.red(error.message));
    process.exit(1);
  }
}