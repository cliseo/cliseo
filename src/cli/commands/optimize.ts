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

      // AI MODE: Do AI optimizations ONLY
      spinner.text = 'Running AI-powered optimization...';
      console.log(chalk.green('\n🤖 AI-powered optimization enabled!'));
      
      try {
        await performAiOptimizations(dir);
        spinner.succeed(chalk.green('✅ AI optimizations applied successfully!'));
      } catch (err) {
        spinner.fail('Failed to apply AI optimizations.');
        console.error(err);
        console.log(chalk.yellow('\n⚠️  AI mode was requested but failed. No optimizations were applied.'));
        console.log(chalk.gray('To run standard optimizations instead, use: cliseo optimize (without --ai flag)\n'));
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
    else if (framework == 'vue') {
      console.log(chalk.yellow('Optimizations for the Vue framwork are still under development.'));
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

    console.log(chalk.blue('AI-Generated SEO Metadata:'));
    console.log(chalk.gray(`Title: ${aiData.title}`));
    console.log(chalk.gray(`Description: ${aiData.description}`));
    console.log(chalk.gray(`Keywords: ${aiData.keywords}`));

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
        console.warn(chalk.yellow(`Failed to optimize ${file}: ${error}`));
      }
    }

    console.log(chalk.green(`✅ Applied AI metadata to ${modifiedCount} component(s)`));
    
  } catch (error) {
    console.error(chalk.red('Failed to parse AI response:'), error);
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
    console.warn(`Error processing ${filePath}:`, error);
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