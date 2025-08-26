import { writeFile, access, readFile } from 'fs/promises';
import { readFileSync, existsSync } from 'fs';
import * as cheerio from 'cheerio';
import { join, dirname, resolve, basename } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { glob } from 'glob';
import fs from 'fs';
import path from 'path';
import { optimizeReactComponents } from './optimize-react.js';
import { optimizeVueComponents } from './optimize-vue.js';
import { optimizeNextjsComponents } from './optimize-next.js';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import axios from 'axios'; // Added for AI optimizations
import { fileURLToPath } from 'url';

// JSX and TypeScript syntax support is handled by @babel/preset-react and @babel/preset-typescript
import { text } from 'stream/consumers';

// Get package.json for version info
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../../package.json'), 'utf8')
);

interface ProjectAnalysis {
  projectName: string;
  description: string;
}

// Helper function to format email display
function formatEmailDisplay(email: string): string {
  // For GitHub users without public email
  if (email && email.includes('@github.user')) {
    const username = email.split('@')[0];
    return `Github: ${username}`;
  }

  // For Google users, check if it's a placeholder
  if (email && email.includes('placeholder')) {
    return 'Google: (private email)';
  }

  // For real emails, show as-is
  return email || 'Not provided';
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
  let llmsCreated = false;

  // decide target directory based on framework
  let targetDir = projectRoot;
  if (framework === 'react' || framework === 'next.js') {
    targetDir = join(projectRoot, 'public');
  }

  // make sure directory exists
  try { await fs.promises.mkdir(targetDir, { recursive: true }); } catch { }

  const robotsPath = join(targetDir, 'robots.txt');
  const sitemapPath = join(targetDir, 'sitemap.xml');
  const llmsPath = join(targetDir, 'llms.txt');

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
    <loc>https://yourdomain.com/about/</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>https://yourdomain.com/contact/</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <!-- Blog section -->
  <url>
    <loc>https://yourdomain.com/blog/</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;

  // llms.txt template for AI model training data
  const llmsContent = `# llms.txt for ${projectRoot.split('/').pop() || 'your site'}

# This file provides guidance for AI models and LLMs about this website
# It helps AI models understand the content and purpose of this site

# Site Information
Site Name: ${projectRoot.split('/').pop() || 'Your Site'}
Site Type: ${framework === 'next.js' ? 'Next.js Application' : framework === 'react' ? 'React Application' : framework === 'vue' ? 'Vue Application' : 'Web Application'}
Framework: ${framework}

# Content Guidelines
- This site contains publicly accessible web content
- Content is intended for human consumption and AI training
- Please respect copyright and fair use guidelines
- Use content responsibly and ethically

# Training Data Usage
- Content may be used for AI model training and improvement
- Please maintain context and accuracy when using this content
- Attribution is appreciated when possible

# Contact Information
- For questions about content usage, please contact the site owner
- This file was generated by cliseo (https://cliseo.com)

# Last Updated
Generated: ${new Date().toISOString()}
Generated by cliseo (https://github.com/cliseo/cliseo)`;

  try { await access(robotsPath); } catch { await writeFile(robotsPath, robotsContent); robotsCreated = true; }
  try { await access(sitemapPath); } catch { await writeFile(sitemapPath, sitemapContent); sitemapCreated = true; }
  try { await access(llmsPath); } catch { await writeFile(llmsPath, llmsContent); llmsCreated = true; }

  return { robotsCreated, sitemapCreated, llmsCreated };
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
    case 'vue':
      if (existsSync(join(projectRoot, 'src', 'pages'))) {
        directories.push(join(projectRoot, 'src', 'pages'));
      }
      if (existsSync(join(projectRoot, 'src', 'views'))) {
        directories.push(join(projectRoot, 'src', 'views'));
      }
      if (existsSync(join(projectRoot, 'src', 'routes'))) {
        directories.push(join(projectRoot, 'src', 'routes'));
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

    // Add language attribute to html element if missing
    if (!$('html').attr('lang')) {
      $('html').attr('lang', 'en');
    }

    // Fix H1 tag issues
    const h1Elements = $('h1');
    if (h1Elements.length === 0) {
      // No H1 found - convert first H2 to H1, or add one if no headings exist
      const firstH2 = $('h2').first();
      if (firstH2.length) {
        const h1Content = firstH2.html();
        firstH2.replaceWith(`<h1>${h1Content}</h1>`);
      } else {
        // Add a placeholder H1 at the beginning of body
        $('body').prepend('<h1>Page Title</h1>');
      }
    } else if (h1Elements.length > 1) {
      // Multiple H1s found - keep first one, convert others to H2
      h1Elements.slice(1).each((_, element) => {
        const h1Content = $(element).html();
        $(element).replaceWith(`<h2>${h1Content}</h2>`);
      });
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
      // only allow Vue 3, optimizations are not supported for previous versions
      if ('vue' in deps) {
        const vueVersion = deps['vue'] as string;
        // Check if version starts with "3" (allowing ^, ~, or direct)
        if (/^[\^~]?3(\.|$)/.test(vueVersion)) {
          return 'vue';
        }
      }
    } catch (e) {
      console.error(e)
    }
  }
  return 'unknown';
}

/**
 * Display next steps guidance after optimization
 */
function showNextSteps(robotsCreated: boolean, sitemapCreated: boolean, llmsCreated: boolean, aiUsed: boolean) {
  console.log(chalk.bold.cyan('\nNext Steps to Complete Your SEO Setup:'));
  console.log(chalk.underline.blue('https://cliseo.com/blog/next-steps-seo-setup'));

  console.log(chalk.gray('\npsst... check this out 👇 \nhttps://github.com/cliseo/cliseo'));
}

/**
 * * Main function to optimize SEO for the project.
 */
export async function optimizeCommand(directory: string | undefined, options: { ai?: boolean }) {
  const dir = resolve(directory || '.');
  const spinner = ora('Starting SEO optimization...').start();
  try {
    // Check authentication if AI is requested
    if (options.ai) {
      const { isAuthenticated, hasAiAccess, loadConfig } = await import('../utils/config.js');
      const isAuth = await isAuthenticated();
      const hasAi = await hasAiAccess();

      // Show account status
      spinner.stop();
      if (isAuth) {
        try {
          const config = await loadConfig();
          console.log(chalk.cyan(`👤 ${formatEmailDisplay(config.userEmail || '')}`));
          console.log(chalk.gray(`🤖 AI Access: ${hasAi ? 'Enabled' : 'Disabled'}`));
        } catch {
          console.log(chalk.yellow('👤 Authentication status unclear'));
        }
      } else {
        console.log(chalk.gray('👤 Not logged in'));
      }

      if (!isAuth) {
        console.log(chalk.yellow('\n⚠️  Authentication required for AI features'));
        console.log(chalk.gray('You need to sign in to use AI-powered optimizations.'));

        // Skip interactive prompts in CI/non-TTY environments
        const skipPrompts = process.env.CI === 'true' || !process.stdin.isTTY;

        if (!skipPrompts) {
          const { shouldAuth } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'shouldAuth',
              message: 'Would you like to sign in now?',
              default: true,
            },
          ]);

          if (shouldAuth) {
            console.log(chalk.cyan('\nStarting authentication...'));
            try {
              const { authenticateUser } = await import('../utils/auth.js');
              const authResult = await authenticateUser();

              if (authResult.success) {
                console.log(chalk.cyan(`👤 ${formatEmailDisplay(authResult.email || '')}`));
                console.log(chalk.gray(`🤖 AI Access: ${authResult.aiAccess ? 'Enabled' : 'Disabled'}`));

                if (authResult.aiAccess) {
                  // Continue with AI optimization - spinner will be started in main flow
                } else {
                  console.log(chalk.yellow('\n⚠️  AI features are not enabled for your account.'));
                  console.log(chalk.gray('Upgrade your plan to access AI features.'));
                  return;
                }
              } else {
                console.log(chalk.red('\n❌ Authentication failed:'));
                console.log(chalk.red(authResult.error || 'Unknown error occurred'));
                return;
              }
            } catch (authError) {
              console.log(chalk.red('\n❌ Authentication failed'));
              console.log(chalk.gray('Please try again later or visit https://cliseo.com/ for support.'));
              return;
            }
          } else {
            console.log(chalk.gray('Authentication cancelled.'));
            return;
          }
        } else {
          console.log(chalk.cyan('Please authenticate first:'));
          console.log(chalk.gray('  cliseo auth\n'));
          return;
        }
      }

      if (!hasAi) {
        console.log(chalk.yellow('\n⚠️  AI features are not enabled for your account'));
        console.log(chalk.gray('Your account doesn\'t have access to AI features.'));
        console.log('');
        console.log(chalk.green('Visit https://cliseo.com to upgrade'));
        console.log('');
        return;
      }



      // AI MODE: Do AI optimizations AND create SEO files
      if (!spinner.isSpinning) {
        spinner.start('Running AI-powered optimization...');
      } else {
        spinner.text = 'Running AI-powered optimization...';
      }

      try {
        // First detect framework for SEO files
        const framework = await detectFramework(dir);

        // Get AI analysis and enhanced SEO files from backend
        spinner.text = 'Analyzing project with AI...';
        const aiData = await getAiAnalysis(dir);

        // Create AI-enhanced SEO files if backend provides them
        spinner.text = 'Creating AI-enhanced SEO files...';
        const { robotsCreated, sitemapCreated, llmsCreated } = await createAiSeoFiles(framework, dir, aiData);

        // Apply comprehensive AI optimizations
        spinner.text = 'Applying AI optimizations...';
        const optimizationResults = await applyComprehensiveAiOptimizations(dir, aiData);

        spinner.succeed(chalk.green('✅ AI optimizations applied successfully!'));

        // Show summary of all AI optimizations
        if (optimizationResults && optimizationResults.totalFixes > 0) {
          console.log(chalk.cyan(`🔗 Fixed ${optimizationResults.totalFixes} non-descriptive link${optimizationResults.totalFixes === 1 ? '' : 's'} in ${optimizationResults.filesModified} file${optimizationResults.filesModified === 1 ? '' : 's'}`));
        }

        // Show AI optimization results
        if (robotsCreated || sitemapCreated || llmsCreated) {
          console.log(chalk.cyan('\n📄 AI-Enhanced SEO Files Created:'));
          if (robotsCreated) console.log(chalk.green('  ✔ robots.txt (AI-optimized)'));
          if (sitemapCreated) console.log(chalk.green('  ✔ sitemap.xml (AI-optimized)'));
          if (llmsCreated) console.log(chalk.green('  ✔ llms.txt (AI-optimized)'));
        }

        // Show next steps for AI mode (include SEO files info)
        showNextSteps(robotsCreated, sitemapCreated, llmsCreated, true);
        return; // Exit after showing next steps
      } catch (err) {
        spinner.fail('AI optimization failed');

        // Clean, user-friendly error handling
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        if (errorMessage.includes('Authentication failed')) {
          console.log(chalk.yellow('\n🔒 Authentication expired'));
          console.log(chalk.gray('Your session has expired and you need to sign in again.'));

          // Skip interactive prompts in CI/non-TTY environments
          const skipPrompts = process.env.CI === 'true' || !process.stdin.isTTY;

          if (!skipPrompts) {
            const { shouldAuth } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'shouldAuth',
                message: 'Would you like to sign in now?',
                default: true,
              },
            ]);

            if (shouldAuth) {
              console.log(chalk.cyan('\nStarting authentication...'));
              try {
                const { authenticateUser } = await import('../utils/auth.js');
                const authResult = await authenticateUser();

                if (authResult.success) {
                  console.log(chalk.cyan(`👤 ${formatEmailDisplay(authResult.email || '')}`));
                  console.log(chalk.gray(`🤖 AI Access: ${authResult.aiAccess ? 'Enabled' : 'Disabled'}`));

                  if (authResult.aiAccess) {
                    console.log(chalk.cyan('\n🔄 Retrying AI optimization...'));
                    await performAiOptimizations(dir);
                    console.log(chalk.green('✅ AI optimizations applied successfully!'));
                    showNextSteps(false, false, false, true);
                    return;
                  } else {
                    console.log(chalk.yellow('\n⚠️  AI features are not enabled for your account.'));
                    console.log(chalk.gray('Upgrade your plan to access AI features.'));
                  }
                } else {
                  console.log(chalk.red('\n❌ Authentication failed:'));
                  console.log(chalk.red(authResult.error || 'Unknown error occurred'));
                }
              } catch (authError) {
                console.log(chalk.red('\n❌ Authentication failed'));
                console.log(chalk.gray('Please try again later or visit https://cliseo.com/ for support.'));
              }
            } else {
              console.log(chalk.gray('Authentication cancelled.'));
            }
          } else {
            console.log(chalk.cyan('Please authenticate first:'));
            console.log(chalk.white('  cliseo auth'));
            console.log(chalk.gray('\nThen try running the AI optimization again.'));
          }
        } else if (errorMessage.includes('AI features not enabled')) {
          console.log(chalk.yellow('\n⚠️  AI features not available'));
          console.log(chalk.gray('There\'s a permission mismatch with your account.'));

          // Skip interactive prompts in CI/non-TTY environments
          const skipPrompts = process.env.CI === 'true' || !process.stdin.isTTY;

          if (!skipPrompts) {
            const { action } = await inquirer.prompt([
              {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: [
                  { name: 'Sign out and try again (recommended)', value: 'logout' },
                  { name: 'Use standard optimization instead', value: 'standard' },
                  { name: 'Cancel', value: 'cancel' }
                ],
              },
            ]);

            if (action === 'logout') {
              console.log(chalk.cyan('\n🔓 Signing you out...'));
              try {
                const { logoutUser } = await import('../utils/auth.js');
                await logoutUser();
                console.log(chalk.green('✅ Successfully signed out'));
                console.log(chalk.gray('Please run the command again to sign in with fresh credentials.'));
              } catch (logoutError) {
                console.log(chalk.red('❌ Failed to sign out'));
                console.log(chalk.gray('You may need to clear your credentials manually.'));
              }
            } else if (action === 'standard') {
              console.log(chalk.cyan('\n🔄 Switching to standard optimization...'));
              // Restart the command with standard optimization
              return optimizeCommand(directory, { ...options, ai: false });
            } else {
              console.log(chalk.gray('Operation cancelled.'));
            }
          } else {
            console.log(chalk.cyan('Options:'));
            console.log(chalk.white('  • Sign out and retry: cliseo auth (logout) && cliseo optimize --ai'));
            console.log(chalk.white('  • Use standard optimization: cliseo optimize'));
          }
        } else if (errorMessage.includes('AI service temporarily unavailable')) {
          console.log(chalk.yellow('\n⚠️  AI service temporarily unavailable'));
          console.log(chalk.gray('Please try again in a few minutes.'));
        } else if (errorMessage.includes('Could not gather enough website context')) {
          console.log(chalk.yellow('\n⚠️  Insufficient content for AI analysis'));
          console.log(chalk.gray('AI needs a README.md file or page components to analyze.'));
          console.log(chalk.cyan('To fix this:'));
          console.log(chalk.white('  • Add a README.md file describing your project'));
          console.log(chalk.white('  • Or use standard optimization: cliseo optimize'));
        } else {
          console.log(chalk.yellow('\n⚠️  AI optimization failed'));
          console.log(chalk.gray(`Error: ${errorMessage}`));
        }

        console.log(''); // Add spacing
        process.exit(1);
      }

      return; // Exit here - AI mode doesn't do standard optimizations
    }

    // STANDARD MODE: Do traditional rule-based optimizations
    spinner.text = 'Running standard SEO optimizations...';

    spinner.text = 'Checking SEO files...';
    const framework = await detectFramework(dir);

    const { robotsCreated, sitemapCreated, llmsCreated } = await ensureSeoFiles(framework, dir);

    spinner.stop();



    spinner.text = 'Adding proper tags to HTML files...';

    // Only process HTML files in the main function - framework-specific optimizers handle component files
    if (framework !== 'unknown') {
      await addMetaTagsToHtmlFiles(dir, framework);
      await addImagesAltAttributes(dir, framework);
    }

    spinner.stop();

    const frameWorkColor = framework === 'react' ? chalk.blue : chalk.gray;
    console.log(chalk.bold('\nDetected Framework: ' + frameWorkColor(framework.toUpperCase())));

    // Framework-specific optimizations
    if (framework === 'react') {
      spinner.text = 'Optimizing React components...';
      try {
        await optimizeReactComponents(dir);
        spinner.stop();
      } catch (err) {
        spinner.fail('Failed to optimize React components');
        console.log(chalk.yellow('⚠️  Could not optimize some React components'));
      }
    } else if (framework === 'next.js') {
      spinner.text = 'Optimizing Next.js components...';
      try {
        await optimizeNextjsComponents(dir);
        spinner.stop();
      } catch (err) {
        spinner.fail('Failed to optimize Next.js components');
        console.log(chalk.yellow('⚠️  Could not optimize some Next.js components'));
      }
    } else if (framework === 'angular') {
      spinner.text = 'Running Angular HTML SEO enhancements...';
      spinner.succeed('Angular SEO enhancements complete.');
    }
    else if (framework == 'vue') {
      spinner.text = 'Optimizing Vue components...';
      try {
        await optimizeVueComponents(dir);
        spinner.stop();
      } catch (err) {
        spinner.fail('Failed to optimize Vue components');
        console.log(chalk.yellow('⚠️  Could not optimize some Vue components'));
      }
    }
    else if (framework === 'unknown') {
      console.log(chalk.yellow('⚠️  Unknown framework detected. Only basic SEO files were created.'));
    }

    console.log(chalk.bold.green('\nSEO optimization complete!'));

    // Show next steps guidance
    showNextSteps(robotsCreated, sitemapCreated, llmsCreated, options.ai || false);

    // Skip interactive prompts in CI/non-TTY environments
    const skipPrompts = process.env.CI === 'true' || !process.stdin.isTTY;

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
    spinner.fail(chalk.red('Optimization failed'));
    console.log(chalk.yellow('\n⚠️  An unexpected error occurred'));

    if (error instanceof Error) {
      console.log(chalk.gray(`Error: ${error.message}`));
    }

    console.log(chalk.cyan('\nTroubleshooting:'));
    console.log(chalk.white('  • Check that you\'re in a valid project directory'));
    console.log(chalk.white('  • Ensure you have write permissions'));
    console.log(chalk.white('  • Check the project structure and try again'));
    console.log('');
    process.exit(1);
  }
}



/**
 * Get project name from package.json or directory name
 */
async function getProjectName(projectRoot: string): Promise<string> {
  try {
    const packageJsonPath = join(projectRoot, 'package.json');
    if (existsSync(packageJsonPath)) {
      const pkg = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
      return pkg.name || basename(projectRoot);
    }
  } catch (error) {
    // Fallback to directory name
  }
  return basename(projectRoot);
}



/**
 * Create AI-enhanced SEO files using backend response (fallback to standard if no seo_files)
 */
async function createAiSeoFiles(framework: string, projectRoot: string, aiData: any): Promise<{ robotsCreated: boolean; sitemapCreated: boolean; llmsCreated: boolean }> {
  // If backend provides enhanced SEO files, use them
  if (aiData.seo_files) {
    let robotsCreated = false;
    let sitemapCreated = false;
    let llmsCreated = false;

    // Determine target directory
    let targetDir = projectRoot;
    if (framework === 'react' || framework === 'next.js') {
      targetDir = join(projectRoot, 'public');
    }

    // Ensure directory exists
    try { await fs.promises.mkdir(targetDir, { recursive: true }); } catch { }

    const robotsPath = join(targetDir, 'robots.txt');
    const sitemapPath = join(targetDir, 'sitemap.xml');
    const llmsPath = join(targetDir, 'llms.txt');

    // Write AI-enhanced files from backend
    if (aiData.seo_files.robots_txt) {
      try {
        await access(robotsPath);
      } catch {
        await writeFile(robotsPath, aiData.seo_files.robots_txt);
        robotsCreated = true;
      }
    }

    if (aiData.seo_files.sitemap_xml) {
      try {
        await access(sitemapPath);
      } catch {
        await writeFile(sitemapPath, aiData.seo_files.sitemap_xml);
        sitemapCreated = true;
      }
    }

    if (aiData.seo_files.llms_txt) {
      try {
        await access(llmsPath);
      } catch {
        await writeFile(llmsPath, aiData.seo_files.llms_txt);
        llmsCreated = true;
      }
    }

    return { robotsCreated, sitemapCreated, llmsCreated };
  }

  // Fallback to standard SEO files if backend doesn't provide enhanced ones
  return await ensureSeoFiles(framework, projectRoot);
}

/**
 * Get comprehensive AI analysis data for the project using unified API call
 */
async function getAiAnalysis(projectDir: string): Promise<any> {
  try {
    const { getAuthToken } = await import('../utils/config.js');
    const token = await getAuthToken();

    if (!token) {
      throw new Error('Authentication token not found');
    }

    // Gather comprehensive project context
    const projectContext = await gatherComprehensiveContext(projectDir);

    if (projectContext.pages.length === 0) {
      throw new Error('Could not gather enough website context for AI analysis');
    }

    // Send unified request to backend
    const apiBase = process.env.API_URL || process.env.CLISEO_API_URL || 'https://a8iza6csua.execute-api.us-east-2.amazonaws.com';
    if (!apiBase) {
      throw new Error('Missing API base URL. Set API_URL or CLISEO_API_URL in your environment.');
    }
    
    const response = await axios.post(`${apiBase}/ask-openai`, {
      readme: projectContext.readme,
      pages: projectContext.pages,
      components: projectContext.components,
      request_type: 'full_optimization'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('Authentication failed. Please run `cliseo auth` to re-authenticate.');
      } else if (error.response?.status === 403) {
        throw new Error('AI features not enabled for your account. Please upgrade your plan.');
      } else if (error.response?.status === 500) {
        throw new Error('AI service temporarily unavailable. Please try again later.');
      }
    }

    throw new Error(`AI optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Perform AI-powered optimizations using authenticated backend (legacy function kept for compatibility)
 */
async function performAiOptimizations(projectDir: string): Promise<void> {
  const aiData = await getAiAnalysis(projectDir);
  await applyAiOptimizationsToComponents(projectDir, aiData);
}

/**
 * Gather website context for AI analysis
 */
async function gatherComprehensiveContext(projectDir: string): Promise<{ 
  readme: string, 
  pages: string[], 
  components: Array<{path: string, content: string}> 
}> {
  const context = {
    readme: '',
    pages: [] as string[],
    components: [] as Array<{path: string, content: string}>
  };

  // Try to read README (with size limit)
  const readmeFiles = ['README.md', 'readme.md', 'README.txt', 'readme.txt'];
  for (const readmeFile of readmeFiles) {
    try {
      const readmePath = join(projectDir, readmeFile);
      if (existsSync(readmePath)) {
        let readmeContent = await readFile(readmePath, 'utf-8');
        // Truncate README if too long
        if (readmeContent.length > 2000) {
          readmeContent = readmeContent.substring(0, 2000) + '...[truncated]';
        }
        context.readme = readmeContent;
        break;
      }
    } catch (error) {
      // Continue to next README file
    }
  }

  // Gather page components for content analysis
  const framework = await detectFramework(projectDir);
  const pageDirectories = getPagesDirectory(projectDir, framework);

  const maxTotalPagesSize = 3000;
  let currentPagesSize = 0;

  for (const pagesDir of pageDirectories) {
    try {
      const pageFiles = await glob('**/*.{js,jsx,ts,tsx,vue}', {
        cwd: pagesDir,
        absolute: true,
        ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*']
      });

      // Read page files for content analysis
      const limitedFiles = pageFiles.slice(0, 3);

      for (const file of limitedFiles) {
        if (currentPagesSize >= maxTotalPagesSize) {
          break;
        }

        try {
          let content = await readFile(file, 'utf-8');
          const relativePath = path.relative(projectDir, file);

          // Truncate individual file content if needed
          const maxFileSize = 1000;
          if (content.length > maxFileSize) {
            content = content.substring(0, maxFileSize) + '...[truncated]';
          }

          const fileEntry = `File: ${relativePath}\n${content}\n\n`;

          // Check if adding this file would exceed our total limit
          if (currentPagesSize + fileEntry.length <= maxTotalPagesSize) {
            context.pages.push(fileEntry);
            currentPagesSize += fileEntry.length;
          } else {
            // Add what we can of this file
            const remainingSpace = maxTotalPagesSize - currentPagesSize;
            if (remainingSpace > 100) {
              const truncatedEntry = fileEntry.substring(0, remainingSpace) + '...[truncated]';
              context.pages.push(truncatedEntry);
            }
            break;
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }

  // Gather component files for link analysis
  try {
    const componentFiles = await glob('src/**/*.{js,jsx,ts,tsx,vue}', {
      cwd: projectDir,
      absolute: true,
      ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*', '**/*.d.ts']
    });

    // Limit to 5 components to avoid oversized requests
    const limitedComponents = componentFiles.slice(0, 5);

    for (const file of limitedComponents) {
      try {
        let content = await readFile(file, 'utf-8');
        
        // Truncate large files
        if (content.length > 800) {
          content = content.substring(0, 800) + '...[truncated]';
        }
        
        const relativePath = path.relative(projectDir, file);
        context.components.push({
          path: relativePath,
          content: content
        });
        
      } catch (error) {
        // Skip files that can't be read
      }
    }
  } catch (error) {
    // Continue without components if glob fails
  }



  return context;
}

// Legacy function kept for backward compatibility
async function gatherWebsiteContext(projectDir: string): Promise<{ readme: string, pages: string[] }> {
  const context = {
    readme: '',
    pages: [] as string[]
  };

  // Try to read README (with size limit)
  const readmeFiles = ['README.md', 'readme.md', 'README.txt', 'readme.txt'];
  for (const readmeFile of readmeFiles) {
    try {
      const readmePath = join(projectDir, readmeFile);
      if (existsSync(readmePath)) {
        let readmeContent = await readFile(readmePath, 'utf-8');
        // Truncate README if too long (prioritize README with generous limit)
        if (readmeContent.length > 2000) {
          readmeContent = readmeContent.substring(0, 2000) + '...[truncated]';
        }
        context.readme = readmeContent;
        break;
      }
    } catch (error) {
      // Continue to next README file
    }
  }

  // Gather page components (with size limits)
  const framework = await detectFramework(projectDir);
  const pageDirectories = getPagesDirectory(projectDir, framework);

  const maxTotalPagesSize = 3000; // Remaining space after README
  let currentPagesSize = 0;

  for (const pagesDir of pageDirectories) {
    try {
      const pageFiles = await glob('**/*.{js,jsx,ts,tsx,vue}', {
        cwd: pagesDir,
        absolute: true,
        ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*']
      });

      // Read up to 3 page files for context (reduced from 5 to manage size)
      const limitedFiles = pageFiles.slice(0, 3);

      for (const file of limitedFiles) {
        if (currentPagesSize >= maxTotalPagesSize) {
          break; // Stop if we've hit our size limit
        }

        try {
          let content = await readFile(file, 'utf-8');
          const relativePath = path.relative(projectDir, file);

          // Truncate individual file content if needed
          const maxFileSize = 1000; // Max size per file
          if (content.length > maxFileSize) {
            content = content.substring(0, maxFileSize) + '...[truncated]';
          }

          const fileEntry = `File: ${relativePath}\n${content}\n\n`;

          // Check if adding this file would exceed our total limit
          if (currentPagesSize + fileEntry.length <= maxTotalPagesSize) {
            context.pages.push(fileEntry);
            currentPagesSize += fileEntry.length;
          } else {
            // Add what we can of this file
            const remainingSpace = maxTotalPagesSize - currentPagesSize;
            if (remainingSpace > 100) { // Only add if we have meaningful space left
              const truncatedEntry = fileEntry.substring(0, remainingSpace) + '...[truncated]';
              context.pages.push(truncatedEntry);
            }
            break;
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }



  return context;
}

/**
 * Apply comprehensive AI optimizations from unified response
 */
async function applyComprehensiveAiOptimizations(projectDir: string, aiData: any): Promise<{ totalFixes: number; filesModified: number }> {
  let totalFixes = 0;
  let filesModified = 0;

  try {
    // Apply component fixes if provided
    if (aiData.component_fixes && typeof aiData.component_fixes === 'object') {
      for (const [filePath, fixes] of Object.entries(aiData.component_fixes)) {
        if (Array.isArray(fixes) && fixes.length > 0) {
          try {
            // Apply fixes to the specific file
            // For now, we'll just count them
            totalFixes += fixes.length;
            filesModified++;
          } catch (error) {

          }
        }
      }
    }

    // Apply traditional component optimizations if no component_fixes provided
    if (!aiData.component_fixes) {
      await applyAiOptimizationsToComponents(projectDir, aiData);
    }

    // Apply link text fixes using traditional method
    const linkFixResults = await applyLinkTextFixes(projectDir);
    if (linkFixResults) {
      totalFixes += linkFixResults.totalFixes;
      filesModified += linkFixResults.filesModified;
    }

    return { totalFixes, filesModified };

  } catch (error) {
    return { totalFixes, filesModified };
  }
}

/**
 * Apply AI-generated optimizations to React/Next.js components (legacy)
 */
async function applyAiOptimizationsToComponents(projectDir: string, aiSuggestions: any): Promise<void> {
  try {
    // Parse the AI response
    let aiData;
    if (typeof aiSuggestions === 'string') {
      aiData = JSON.parse(aiSuggestions);
    } else if (aiSuggestions.response) {
      aiData = JSON.parse(aiSuggestions.response);
    } else {
      aiData = aiSuggestions;
    }



    // Detect framework and get page files
    const framework = await detectFramework(projectDir);
    const pageFiles = await getFilesToOptimize(projectDir, framework);

    // Filter for React/Next.js component files
    const componentFiles = pageFiles.filter(file =>
      file.endsWith('.jsx') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.ts')
    );

    if (componentFiles.length === 0) {
      console.log(chalk.yellow('No React/Next.js component files found to optimize with AI.'));
      return;
    }

    let modifiedCount = 0;

    for (const file of componentFiles) {
      try {
        const modified = await injectAiMetadata(file, aiData);
        if (modified) {
          modifiedCount++;
        }
      } catch (error) {

      }
    }

    console.log(chalk.green(`✅ Applied AI metadata to ${modifiedCount} component(s)`));

  } catch (error) {
    throw new Error('Invalid AI response format');
  }
}

/**
 * Inject AI-generated metadata into a React component file using string manipulation
 * to preserve original formatting (similar to optimize-react.ts approach)
 */
async function injectAiMetadata(filePath: string, aiData: any): Promise<boolean> {
  const fs = await import('fs');

  try {
    const source = await fs.promises.readFile(filePath, 'utf-8');
    let modifiedSource = source;
    let modified = false;

    // Check if react-helmet is already imported
    const hasHelmetImport = /import.*{.*Helmet.*}.*from.*['"]react-helmet['"]/.test(source);

    // Check if Helmet is already being used
    const hasHelmetUsage = /<Helmet[\s>]/.test(source);

    if (hasHelmetUsage) {
      return false;
    }

    // Add import if missing - preserve original import formatting
    if (!hasHelmetImport) {
      const importMatch = modifiedSource.match(/^(import.*from.*['"][^'"]*['"];?\s*\n)*/m);
      if (importMatch) {
        const insertPos = importMatch[0].length;
        modifiedSource =
          modifiedSource.slice(0, insertPos) +
          `import { Helmet } from 'react-helmet';\n` +
          modifiedSource.slice(insertPos);
        modified = true;
      }
    }

    // Find JSX return statements and add Helmet - preserve original formatting
    const returnMatches = [...modifiedSource.matchAll(/return\s*\(\s*\n?\s*(<[^>]+>)/g)];

    for (const match of returnMatches) {
      const jsxStart = match.index! + match[0].length - match[1].length;

      // Find the opening JSX tag
      const openingTag = match[1];
      const tagEnd = modifiedSource.indexOf('>', jsxStart) + 1;

      // Find the indentation of the JSX element to match existing style
      const lines = modifiedSource.slice(0, jsxStart).split('\n');
      const lastLine = lines[lines.length - 1];
      const indentation = lastLine.match(/^\s*/)?.[0] || '    ';

      // Create AI-powered Helmet element with proper formatting
      const helmetElement = createAiHelmetString(aiData, indentation);

      // Insert Helmet right after the opening tag, preserving original formatting
      modifiedSource =
        modifiedSource.slice(0, tagEnd) +
        '\n' + indentation + helmetElement +
        modifiedSource.slice(tagEnd);
      modified = true;
      break; // Only modify the first return statement
    }

    if (modified) {
      await fs.promises.writeFile(filePath, modifiedSource, 'utf-8');
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Create AI-powered Helmet JSX string with proper formatting (no AST transformation)
 */
function createAiHelmetString(aiData: any, indentation: string): string {
  const indent = indentation;
  const innerIndent = indentation + '  ';

  let helmet = `<Helmet>`;

  // Title
  if (aiData.title) {
    helmet += `\n${innerIndent}<title>${aiData.title}</title>`;
  }

  // Meta description
  if (aiData.description) {
    helmet += `\n${innerIndent}<meta name="description" content="${aiData.description}" />`;
  }

  // Keywords
  if (aiData.keywords) {
    helmet += `\n${innerIndent}<meta name="keywords" content="${aiData.keywords}" />`;
  }

  // Open Graph tags
  if (aiData.og_title) {
    helmet += `\n${innerIndent}<meta property="og:title" content="${aiData.og_title}" />`;
  }

  if (aiData.og_description) {
    helmet += `\n${innerIndent}<meta property="og:description" content="${aiData.og_description}" />`;
  }

  // Twitter Card tags
  if (aiData.twitter_title) {
    helmet += `\n${innerIndent}<meta name="twitter:title" content="${aiData.twitter_title}" />`;
  }

  if (aiData.twitter_description) {
    helmet += `\n${innerIndent}<meta name="twitter:description" content="${aiData.twitter_description}" />`;
  }

  helmet += `\n${indent}</Helmet>`;

  return helmet;
}



/**
 * Analyzes the project structure to provide context for AI optimizations.
 * This is a placeholder and would require a real implementation to fetch
 * actual project data (e.g., from package.json, git, etc.)
 */
async function analyzeProject(projectDir: string): Promise<ProjectAnalysis> {
  const packageJsonPath = join(projectDir, 'package.json');
  if (existsSync(packageJsonPath)) {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return {
      projectName: pkg.name || 'Your Project',
      description: pkg.description || 'A description of your project.',
    };
  }
  return {
    projectName: 'Your Project',
    description: 'No package.json found. Cannot provide detailed analysis.',
  };
}

/**
 * Apply AI-generated link text fixes to project files
 */
async function applyLinkTextFixes(projectDir: string): Promise<{ totalFixes: number; filesModified: number }> {
  try {
    const { getAuthToken } = await import('../utils/config.js');
    const token = await getAuthToken();

    if (!token) {
      return null;
    }

    // Get all relevant files to scan for link issues
    const framework = await detectFramework(projectDir);
    const files = await getFilesToOptimize(projectDir, framework);

    // Filter for files that can contain links
    const linkFiles = files.filter(file =>
      file.endsWith('.jsx') || file.endsWith('.tsx') ||
      file.endsWith('.js') || file.endsWith('.ts') ||
      file.endsWith('.vue') || file.endsWith('.html')
    );

    if (linkFiles.length === 0) {
      return null;
    }

    let totalFixesApplied = 0;
    let filesModified = 0;

    // Process files in smaller batches to avoid overwhelming the API
    const batchSize = 3;
    for (let i = 0; i < linkFiles.length; i += batchSize) {
      const batch = linkFiles.slice(i, i + batchSize);

      const batchPromises = batch.map(async (file) => {
        try {
          const fixesApplied = await fixLinksInFile(file, token);
          if (fixesApplied > 0) {
            return { file, fixes: fixesApplied };
          }
          return null;
        } catch (error) {
          if (false) {
            console.warn(chalk.yellow(`Failed to fix links in ${file}: ${error}`));
          }
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        if (result) {
          totalFixesApplied += result.fixes;
          filesModified++;
        }
      }

      // Small delay between batches to be respectful to the API
      if (i + batchSize < linkFiles.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return {
      totalFixes: totalFixesApplied,
      filesModified: filesModified
    };

  } catch (error) {
    if (false) {
      console.error(chalk.red('Error applying link text fixes:'), error);
    }
    // Don't throw - this is a non-critical enhancement
    return { totalFixes: 0, filesModified: 0 };
  }
}

/**
 * Fix non-descriptive links in a single file using AI analysis
 */
async function fixLinksInFile(filePath: string, authToken: string): Promise<number> {
  const fs = await import('fs');

  try {
    // Read file content
    const originalContent = await fs.promises.readFile(filePath, 'utf-8');

    // Skip files that are too large to avoid token limits
    if (originalContent.length > 10000) {
      if (false) {
        console.log(chalk.gray(`Skipping large file: ${filePath}`));
      }
      return 0;
    }

    // Make request to backend for link analysis
    const response = await axios.post('https://a8iza6csua.execute-api.us-east-2.amazonaws.com/ask-openai', {
      prompt: `Analyze and fix non-descriptive link text in this file:\n\nFile: ${filePath}`,
      context: 'seo-analysis',
      file_content: originalContent,
      file_path: filePath
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000
    });

    const responseData = response.data;
    let fixesApplied = 0;
    let modifiedContent = originalContent;

    // Apply structured AI fixes if available
    if (responseData.structured_analysis && responseData.structured_analysis.issues) {
      for (const issue of responseData.structured_analysis.issues) {
        if (issue.type === 'link_text' && issue.original && issue.suggested_fix) {
          // Apply the fix using string replacement
          const beforeCount = (modifiedContent.match(new RegExp(escapeRegExp(issue.original), 'g')) || []).length;
          modifiedContent = modifiedContent.replace(new RegExp(escapeRegExp(issue.original), 'g'), issue.suggested_fix);
          const afterCount = (modifiedContent.match(new RegExp(escapeRegExp(issue.original), 'g')) || []).length;

          if (beforeCount > afterCount) {
            fixesApplied += (beforeCount - afterCount);
            if (false) {
              console.log(chalk.cyan(`  Fixed: "${issue.original}" → "${issue.suggested_fix}"`));
            }
          }
        }
      }
    }

    // Apply regex-detected fixes if available
    if (responseData.link_issues && responseData.link_issues.length > 0) {
      for (const linkIssue of responseData.link_issues) {
        // For regex-detected issues, we need to generate better replacement text
        const betterText = generateBetterLinkText(linkIssue.text, linkIssue.href);
        if (betterText && betterText !== linkIssue.text) {
          const originalElement = linkIssue.full_element;
          const improvedElement = originalElement.replace(linkIssue.text, betterText);

          const beforeCount = (modifiedContent.match(new RegExp(escapeRegExp(originalElement), 'g')) || []).length;
          modifiedContent = modifiedContent.replace(new RegExp(escapeRegExp(originalElement), 'g'), improvedElement);
          const afterCount = (modifiedContent.match(new RegExp(escapeRegExp(originalElement), 'g')) || []).length;

          if (beforeCount > afterCount) {
            fixesApplied += (beforeCount - afterCount);
            if (false) {
              console.log(chalk.cyan(`  Fixed: "${linkIssue.text}" → "${betterText}"`));
            }
          }
        }
      }
    }

    // Write back the modified content if changes were made
    if (fixesApplied > 0) {
      await fs.promises.writeFile(filePath, modifiedContent, 'utf-8');
      if (false) {
        console.log(chalk.green(`✅ Applied ${fixesApplied} link fix${fixesApplied === 1 ? '' : 'es'} to ${filePath}`));
      }
    }

    return fixesApplied;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 503) {
        if (false) {
          console.log(chalk.yellow('AI service temporarily unavailable for link fixes'));
        }
      } else if (false) {
        console.log(chalk.yellow(`AI request failed for ${filePath}: ${error.response?.data?.error || error.message}`));
      }
    } else if (false) {
      console.log(chalk.yellow(`Error fixing links in ${filePath}: ${error}`));
    }
    return 0;
  }
}

/**
 * Generate better link text based on href and current text
 */
function generateBetterLinkText(currentText: string, href: string): string {
  const text = currentText.toLowerCase().trim();

  // Don't change if it's already reasonably descriptive
  if (text.length > 10 && !['here', 'click here', 'read more', 'learn more', 'more', 'this', 'link'].includes(text)) {
    return currentText;
  }

  // Generate better text based on href
  if (href.includes('/about')) return 'about us';
  if (href.includes('/contact')) return 'contact us';
  if (href.includes('/pricing')) return 'view pricing';
  if (href.includes('/docs') || href.includes('/documentation')) return 'documentation';
  if (href.includes('/blog')) return 'blog';
  if (href.includes('/support')) return 'support';
  if (href.includes('/help')) return 'help center';
  if (href.includes('/signup') || href.includes('/register')) return 'sign up';
  if (href.includes('/login') || href.includes('/signin')) return 'sign in';
  if (href.includes('/download')) return 'download';
  if (href.includes('/features')) return 'features';
  if (href.includes('/api')) return 'API documentation';
  if (href.includes('/rate-limits')) return 'rate limits documentation';
  if (href.includes('/terms')) return 'terms of service';
  if (href.includes('/privacy')) return 'privacy policy';

  // Extract meaningful parts from path
  const pathParts = href.split('/').filter(part => part && !part.includes('.'));
  if (pathParts.length > 0) {
    const lastPart = pathParts[pathParts.length - 1];
    // Convert kebab-case or snake_case to readable text
    const readable = lastPart.replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    if (readable.length > 2) {
      return readable;
    }
  }

  // Fallback: return original if we can't improve it
  return currentText;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}