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
import axios from 'axios'; // Added for AI optimizations
import { requiresEmailVerification } from './verify-email.js';

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
 * Display next steps guidance after optimization
 */
function showNextSteps(robotsCreated: boolean, sitemapCreated: boolean, aiUsed: boolean) {
  console.log(chalk.bold.cyan('\n📋 Next Steps to Complete Your SEO Setup:'));
  
  let stepNumber = 1;
  
  // Step 1: Update URLs in generated files
  if (robotsCreated || sitemapCreated) {
    console.log(chalk.yellow(`\n${stepNumber}. Update placeholder URLs in generated files:`));
    if (sitemapCreated) {
      console.log(chalk.gray(`   • Edit ${chalk.white('public/sitemap.xml')} - replace "yourdomain.com" with your actual domain`));
    }
    if (robotsCreated) {
      console.log(chalk.gray(`   • Edit ${chalk.white('public/robots.txt')} - update the sitemap URL to your domain`));
    }
    stepNumber++;
  }

  // Step 2: Build and deploy
  console.log(chalk.yellow(`\n${stepNumber}. Build and deploy your changes:`));
  console.log(chalk.gray(`   • Run your build command: ${chalk.white('npm run build')} or ${chalk.white('yarn build')}`));
  console.log(chalk.gray(`   • Deploy to your hosting platform`));
  stepNumber++;

  // Step 3: Submit to Google Search Console
  console.log(chalk.yellow(`\n${stepNumber}. Submit your sitemap to Google Search Console:`));
  console.log(chalk.gray(`   • Visit: ${chalk.underline.blue('https://search.google.com/search-console')}`));
  console.log(chalk.gray(`   • Add your property if not already added`));
  console.log(chalk.gray(`   • Go to ${chalk.white('Sitemaps')} section`));
  console.log(chalk.gray(`   • Submit: ${chalk.white('https://yourdomain.com/sitemap.xml')}`));
  stepNumber++;

  // Step 4: Test your SEO improvements
  console.log(chalk.yellow(`\n${stepNumber}. Test your SEO improvements:`));
  console.log(chalk.gray(`   • Google Rich Results Test: ${chalk.underline.blue('https://search.google.com/test/rich-results')}`));
  console.log(chalk.gray(`   • Facebook Sharing Debugger: ${chalk.underline.blue('https://developers.facebook.com/tools/debug/')}`));
  console.log(chalk.gray(`   • Twitter Card Validator: ${chalk.underline.blue('https://cards-dev.twitter.com/validator')}`));
  
  if (aiUsed) {
    stepNumber++;
    console.log(chalk.yellow(`\n${stepNumber}. AI-Enhanced SEO:`));
    console.log(chalk.gray(`   • Review AI-generated meta descriptions and titles in your components`));
    console.log(chalk.gray(`   • Consider running ${chalk.white('cliseo scan')} to verify all optimizations applied`));
  }

  // Additional tips
  console.log(chalk.bold.blue('\n💡 Pro Tips:'));
  console.log(chalk.gray(`   • Monitor your SEO performance in Google Search Console`));
  console.log(chalk.gray(`   • Run ${chalk.white('cliseo scan')} regularly to catch new SEO issues`));
  console.log(chalk.gray(`   • Consider setting up Google Analytics to track improvements`));
  
  console.log(chalk.bold.green('\n🚀 Your site is now optimized for search engines!'));
  console.log(chalk.gray('   Changes may take a few days to appear in search results.'));
}

/**
 * * Main function to optimize SEO for the project.
 */
export async function optimizeCommand(directory: string | undefined, options: { ai?: boolean; yes?: boolean; dryRun?: boolean }) {
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
        
        // Skip interactive prompts in CI/non-TTY environments or when --yes flag is provided
        const skipPrompts = options.yes || process.env.CI === 'true' || !process.stdin.isTTY;
        
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
            console.log(chalk.cyan('\n🌐 Starting authentication...'));
            try {
              const { authenticateUser } = await import('../utils/auth.js');
              const authResult = await authenticateUser();
              
                             if (authResult.success) {
                 console.log(chalk.green('\n✅ Authentication successful!'));
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
      
      // Check email verification for AI features
      const needsVerification = await requiresEmailVerification();
      if (needsVerification) {
        console.log(chalk.yellow('\n⚠️  Email verification required for AI features'));
        console.log(chalk.cyan('Please verify your email first:'));
        console.log(chalk.gray('  cliseo verify-email\n'));
        return;
      }

      // AI MODE: Do AI optimizations ONLY
      if (!spinner.isSpinning) {
        spinner.start('Running AI-powered optimization...');
      } else {
        spinner.text = 'Running AI-powered optimization...';
      }
      
      try {
        await performAiOptimizations(dir);
        spinner.succeed(chalk.green('✅ AI optimizations applied successfully!'));
        
        // Show next steps for AI mode (no files created, but still need deployment steps)
        showNextSteps(false, false, true);
      } catch (err) {
        spinner.fail('AI optimization failed');
        
        // Clean, user-friendly error handling
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        
        if (errorMessage.includes('Authentication failed')) {
          console.log(chalk.yellow('\n🔐 Authentication expired'));
          console.log(chalk.gray('Your session has expired and you need to sign in again.'));
          
          // Skip interactive prompts in CI/non-TTY environments or when --yes flag is provided
          const skipPrompts = options.yes || process.env.CI === 'true' || !process.stdin.isTTY;
          
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
              console.log(chalk.cyan('\n🌐 Starting authentication...'));
              try {
                const { authenticateUser } = await import('../utils/auth.js');
                const authResult = await authenticateUser();
                
                                 if (authResult.success) {
                   console.log(chalk.green('\n✅ Authentication successful!'));
                   console.log(chalk.cyan(`👤 ${formatEmailDisplay(authResult.email || '')}`));
                   console.log(chalk.gray(`🤖 AI Access: ${authResult.aiAccess ? 'Enabled' : 'Disabled'}`));
                   
                   if (authResult.aiAccess) {
                    console.log(chalk.cyan('\n🔄 Retrying AI optimization...'));
                    await performAiOptimizations(dir);
                    console.log(chalk.green('✅ AI optimizations applied successfully!'));
                    showNextSteps(false, false, true);
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
          
          // Skip interactive prompts in CI/non-TTY environments or when --yes flag is provided
          const skipPrompts = options.yes || process.env.CI === 'true' || !process.stdin.isTTY;
          
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
          console.log(chalk.cyan('Alternative:'));
          console.log(chalk.white('  cliseo optimize  # Use standard optimization'));
        } else if (errorMessage.includes('Could not gather enough website context')) {
          console.log(chalk.yellow('\n⚠️  Insufficient content for AI analysis'));
          console.log(chalk.gray('AI needs a README.md file or page components to analyze.'));
          console.log(chalk.cyan('To fix this:'));
          console.log(chalk.white('  • Add a README.md file describing your project'));
          console.log(chalk.white('  • Or use standard optimization: cliseo optimize'));
        } else {
          console.log(chalk.yellow('\n⚠️  AI optimization failed'));
          console.log(chalk.gray(`Error: ${errorMessage}`));
          console.log(chalk.cyan('Alternative:'));
          console.log(chalk.white('  cliseo optimize  # Use standard optimization'));
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
        spinner.fail('Failed to optimize React components');
        if (process.env.CLISEO_VERBOSE === 'true') {
          console.error(err);
        } else {
          console.log(chalk.yellow(`⚠️  Could not optimize some React components`));
        }
      }
    } else if (framework === 'next.js') {
      spinner.text = 'Optimizing Next.js components...';
      try {
        await optimizeNextjsComponents(dir);
        if (process.env.CLISEO_VERBOSE === 'true') spinner.succeed('Next.js components optimized successfully!'); else spinner.stop();
      } catch (err) {
        spinner.fail('Failed to optimize Next.js components');
        if (process.env.CLISEO_VERBOSE === 'true') {
          console.error(err);
        } else {
          console.log(chalk.yellow(`⚠️  Could not optimize some Next.js components`));
        }
      }
    } else if (framework === 'angular') {
      spinner.text = 'Running Angular HTML SEO enhancements...';
      spinner.succeed('Angular SEO enhancements complete.');
    }
    else if (framework == 'vue') {
      console.log(chalk.yellow('Optimizations for the Vue framwork are still under development.'));
    }
    else if (framework === 'unknown') {
      console.log(chalk.yellow('⚠️  Unknown framework detected. Only basic SEO files were created.'));
    }

    console.log(chalk.bold.green('\n✅ SEO optimization complete!'));

    // Show next steps guidance
    showNextSteps(robotsCreated, sitemapCreated, options.ai || false);

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
    spinner.fail(chalk.red('Optimization failed'));
    console.log(chalk.yellow('\n⚠️  An unexpected error occurred'));
    
    if (error instanceof Error) {
      if (process.env.CLISEO_VERBOSE === 'true') {
        console.error(chalk.red(error.message));
        console.error(error.stack);
      } else {
        console.log(chalk.gray(`Error: ${error.message}`));
        console.log(chalk.gray('Run with CLISEO_VERBOSE=true for more details'));
      }
    }
    
    console.log(chalk.cyan('\nTroubleshooting:'));
    console.log(chalk.white('  • Check that you\'re in a valid project directory'));
    console.log(chalk.white('  • Ensure you have write permissions'));
    console.log(chalk.white('  • Try running in verbose mode: CLISEO_VERBOSE=true cliseo optimize'));
    console.log('');
    process.exit(1);
  }
}

/**
 * Perform AI-powered optimizations using authenticated backend
 */
async function performAiOptimizations(projectDir: string): Promise<void> {
  try {
    const { getAuthToken } = await import('../utils/config.js');
    const token = await getAuthToken();
    
    if (!token) {
      throw new Error('Authentication token not found');
    }

    // Step 1: Gather website context (README + pages)
    const websiteContext = await gatherWebsiteContext(projectDir);
    
    if (!websiteContext.readme && websiteContext.pages.length === 0) {
      throw new Error('Could not gather enough website context for AI analysis');
    }

    // Step 2: Send to OpenAI for analysis
    console.log(chalk.cyan('🔍 Analyzing website context with AI...'));
    const response = await axios.post('https://a8iza6csua.execute-api.us-east-2.amazonaws.com/ask-openai', {
      readme: websiteContext.readme,
      pages: websiteContext.pages,
      context: 'seo-optimization'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    // Step 3: Apply AI-generated optimizations to components
    const aiSuggestions = response.data;
    console.log(chalk.cyan('🤖 Applying AI-powered optimizations...'));
    
    await applyAiOptimizationsToComponents(projectDir, aiSuggestions);
    
    console.log(chalk.green('✅ AI optimizations applied successfully!'));
    
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
 * Gather website context for AI analysis
 */
async function gatherWebsiteContext(projectDir: string): Promise<{readme: string, pages: string[]}> {
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

  // Debug info in verbose mode
  if (process.env.CLISEO_VERBOSE === 'true') {
    const totalSize = context.readme.length + context.pages.join('').length;
    console.log(chalk.gray(`Context gathered: README (${context.readme.length} chars), Pages (${context.pages.length} files, ${context.pages.join('').length} chars), Total: ${totalSize} chars`));
  }

  return context;
}

/**
 * Apply AI-generated optimizations to React/Next.js components
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

    // Only show metadata in verbose mode
    if (process.env.CLISEO_VERBOSE === 'true') {
      console.log(chalk.blue('AI-Generated SEO Metadata:'));
      console.log(chalk.gray(`Title: ${aiData.title}`));
      console.log(chalk.gray(`Description: ${aiData.description}`));
      console.log(chalk.gray(`Keywords: ${aiData.keywords}`));
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
        if (process.env.CLISEO_VERBOSE === 'true') {
          console.warn(chalk.yellow(`Failed to optimize ${file}: ${error}`));
        }
      }
    }

    console.log(chalk.green(`✅ Applied AI metadata to ${modifiedCount} component(s)`));
    
  } catch (error) {
    if (process.env.CLISEO_VERBOSE === 'true') {
      console.error(chalk.red('Failed to parse AI response:'), error);
    }
    throw new Error('Invalid AI response format');
  }
}

/**
 * Inject AI-generated metadata into a React component file
 */
async function injectAiMetadata(filePath: string, aiData: any): Promise<boolean> {
  const fs = await import('fs');
  const babel = await import('@babel/core');
  const t = await import('@babel/types');
  
  try {
    const source = await fs.promises.readFile(filePath, 'utf-8');
    
    // Parse with Babel (similar to optimize-react.ts)
    const ast = babel.parse(source, {
      sourceType: 'module',
      filename: filePath,
      plugins: [
        ['@babel/plugin-syntax-jsx', { allowNamespaces: true }],
        ['@babel/plugin-syntax-typescript', { isTSX: true, allExtensions: true }]
      ]
    });

    if (!ast) return false;

    let modified = false;
    let helmetImported = false;

    // Create AI-powered Helmet JSX element
    const aiHelmetElement = createAiHelmetElement(aiData, t);

    babel.traverse(ast, {
      Program(path: any) {
        // Check if react-helmet is already imported
        for (const node of path.node.body) {
          if (
            t.isImportDeclaration(node) &&
            node.source.value === 'react-helmet'
          ) {
            helmetImported = true;
            break;
          }
        }

        // Add import if missing
        if (!helmetImported) {
          const importDecl = t.importDeclaration(
            [t.importSpecifier(t.identifier('Helmet'), t.identifier('Helmet'))],
            t.stringLiteral('react-helmet')
          );
          path.node.body.unshift(importDecl);
          helmetImported = true;
        }
      },

      // Find and modify JSX returns
      ReturnStatement(path: any) {
        const arg = path.node.argument;
        if (t.isJSXElement(arg)) {
          const hasHelmet = arg.children.some((child: any) =>
            t.isJSXElement(child) && getJSXElementName(child.openingElement.name) === 'Helmet'
          );

          if (!hasHelmet) {
            arg.children.unshift(aiHelmetElement);
            modified = true;
          }
        }
      }
    });

    if (modified) {
      const output = babel.transformFromAstSync(ast, source, {
        configFile: false,
        generatorOpts: { retainLines: true, compact: false },
      });

      if (output && output.code) {
        await fs.promises.writeFile(filePath, output.code, 'utf-8');
        return true;
      }
    }

    return false;
  } catch (error) {
    if (process.env.CLISEO_VERBOSE === 'true') {
      console.warn(`Error processing ${filePath}:`, error);
    }
    return false;
  }
}

/**
 * Create a Helmet JSX element with AI-generated metadata
 */
function createAiHelmetElement(aiData: any, t: any) {
  const children = [];

  // Title
  if (aiData.title) {
    children.push(
      t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('title'), [], false),
        t.jsxClosingElement(t.jsxIdentifier('title')),
        [t.jsxText(aiData.title)],
        false
      )
    );
  }

  // Meta description
  if (aiData.description) {
    children.push(
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('meta'),
          [
            t.jsxAttribute(t.jsxIdentifier('name'), t.stringLiteral('description')),
            t.jsxAttribute(t.jsxIdentifier('content'), t.stringLiteral(aiData.description))
          ],
          true
        ),
        null,
        [],
        true
      )
    );
  }

  // Keywords
  if (aiData.keywords) {
    children.push(
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('meta'),
          [
            t.jsxAttribute(t.jsxIdentifier('name'), t.stringLiteral('keywords')),
            t.jsxAttribute(t.jsxIdentifier('content'), t.stringLiteral(aiData.keywords))
          ],
          true
        ),
        null,
        [],
        true
      )
    );
  }

  // Open Graph tags
  if (aiData.og_title) {
    children.push(
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('meta'),
          [
            t.jsxAttribute(t.jsxIdentifier('property'), t.stringLiteral('og:title')),
            t.jsxAttribute(t.jsxIdentifier('content'), t.stringLiteral(aiData.og_title))
          ],
          true
        ),
        null,
        [],
        true
      )
    );
  }

  if (aiData.og_description) {
    children.push(
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('meta'),
          [
            t.jsxAttribute(t.jsxIdentifier('property'), t.stringLiteral('og:description')),
            t.jsxAttribute(t.jsxIdentifier('content'), t.stringLiteral(aiData.og_description))
          ],
          true
        ),
        null,
        [],
        true
      )
    );
  }

  // Twitter Card tags
  if (aiData.twitter_title) {
    children.push(
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('meta'),
          [
            t.jsxAttribute(t.jsxIdentifier('name'), t.stringLiteral('twitter:title')),
            t.jsxAttribute(t.jsxIdentifier('content'), t.stringLiteral(aiData.twitter_title))
          ],
          true
        ),
        null,
        [],
        true
      )
    );
  }

  if (aiData.twitter_description) {
    children.push(
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('meta'),
          [
            t.jsxAttribute(t.jsxIdentifier('name'), t.stringLiteral('twitter:description')),
            t.jsxAttribute(t.jsxIdentifier('content'), t.stringLiteral(aiData.twitter_description))
          ],
          true
        ),
        null,
        [],
        true
      )
    );
  }

  // Return complete Helmet element
  return t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier('Helmet'), [], false),
    t.jsxClosingElement(t.jsxIdentifier('Helmet')),
    children,
    false
  );
}

/**
 * Helper function to get JSX element name
 */
function getJSXElementName(node: any): string | null {
  if (!node) return null;
  if (node.type === 'JSXIdentifier') return node.name;
  if (node.type === 'JSXMemberExpression') {
    return `${getJSXElementName(node.object)}.${getJSXElementName(node.property)}`;
  }
  return null;
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