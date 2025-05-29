import { writeFile, access, readFile } from 'fs/promises';
import { readFileSync, existsSync } from 'fs';
import * as cheerio from 'cheerio';
import { join, dirname, resolve } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { glob } from 'glob';
import fs from 'fs';
import path from 'path';
import { injectHelmetInReact } from './optimize-react.js';
import { optimizeAngularComponents } from './optimize-angular.js';

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

/**
 * * Adds meta tags to HTML files in the project.
 */
async function addMetaTagsToHtmlFiles() {
  const root = findProjectRoot();
  const htmlFiles = await glob('**/*.html', { cwd: root, absolute: true });

  for(const file of htmlFiles) {
    const content = await fs.promises.readFile(file, 'utf-8');
    const $ = cheerio.load(content);

    const head = $('head');
    if(head.length === 0) continue; 

    if ($('meta[name="description"]').length === 0) {
      head.append('<meta name="description" content="Your default description here">');
    }

    if ($('meta[name="keywords"]').length === 0) {
      head.append('\n<meta name="keywords" content="keyword1, keyword2, keyword3">');
    }

    if ($('meta[name="author"]').length === 0) {
      head.append('\n<meta name="author" content="Your Name">');
    }

    if ($('link[rel="canonical"]').length === 0) {
      head.append('\n<link rel="canonical" href="https://yourdomain.com/">');
    }

    await fs.promises.writeFile(file, $.html());

  }
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
 * * Adds alt attributes to images in HTML files.
 */
async function addImagesAltAttributes() {
  const root = findProjectRoot();
  const htmlFiles = await glob('**/*.html', { cwd: root, absolute: true });

  for (const file of htmlFiles) {
    // read HTML file for images
    const content = await fs.promises.readFile(file, 'utf-8');
    const $ = cheerio.load(content);

    let modified = false;

    const images = $('img');

    for (const img of images.toArray()) {
      // Check if alt attribute is missing
      if (!$(img).attr('alt')) {
        // Set a default alt text
        $(img).attr('alt', 'Image description');
        modified = true;
      }
      
    }
    if(modified) {
        console.log(`Modified ${file}: Added alt attribute to image(s)`);
        await fs.promises.writeFile(file, $.html());
    }
  }
}



// --- TODO: Ensure pages have <title> tags --- //
// --- TODO: Add structured data (application/ld+json) --- //

/**
 * * Main function to optimize SEO for the project.
 */
export async function optimizeCommand() {
  const spinner = ora('Preparing SEO files...').start();

  try {
    spinner.text = 'Checking SEO files...';
    const { robotsCreated, sitemapCreated } = await ensureSeoFiles();

    spinner.succeed('SEO file check complete!');

    if (robotsCreated) {
      console.log(chalk.green('✔ Created robots.txt'));
    }
    if (sitemapCreated) {
      console.log(chalk.green('✔ Created sitemap.xml'));
    }
    if (!robotsCreated && !sitemapCreated) {
      console.log(chalk.gray('robots.txt and sitemap.xml already exist.'));
    }

    spinner.text = 'Adding proper tags to HTML files...';
    await addMetaTagsToHtmlFiles();
    await addImagesAltAttributes();
    spinner.succeed('Tags added to HTML files!');

    const framework = detectFramework(findProjectRoot());
    const frameWorkColor = framework === 'angular' ? chalk.red : framework === 'react' ? chalk.blue : framework === 'vue' ? chalk.green : chalk.gray;
    console.log(chalk.bold('\nDetected Framework: ' + frameWorkColor(framework.toUpperCase())));

    // React optimizations
    if (framework === 'react') {
      spinner.text = 'React detected but Helmet not found. Installing react-helmet...';
      try {
        await injectHelmetInReact();
        spinner.succeed('Injected react-helmet into React components!');
      } catch (err) {
        spinner.text = 'Failed to inject react-helmet.';
        console.error(err);
      }
    }

    //Angular optimizations
    if (framework === 'angular') {
      spinner.text = 'Angular detected. Optimizing Angular components...';
      try {
        await optimizeAngularComponents();
        spinner.succeed('Angular components optimized successfully!');
      } catch (err) {
        spinner.fail('Failed to optimize Angular components.');
        console.error(err);
      }
    }

    if (framework === 'vue') {
      console.log(chalk.bgRedBright('Cliseo does not currently support the Vue framework. \nWe recommend implementing @vueuse/head for SEO optimizations in Vue projects.'));
    }

    if (framework === 'next.js') {
      console.log(chalk.bgRedBright('Cliseo does not currently support the Next.js framework.'));
    }

    console.log(chalk.green('\n✔ SEO optimization complete!\n'));
    console.log(chalk.magentaBright('Make sure to update the URLs in sitemap.xml to match your site.'));
    console.log(chalk.magentaBright('Ensure to update modified files with your actual content.'));
    console.log(chalk.blue('For more information, visit: https://cliseo.com/seo-guide'));
    console.log(chalk.whiteBright('Happy optimizing!\n\n'));
  } catch (error) {
    spinner.fail('SEO file generation failed!\n\n');
    console.error(error);
    process.exit(1);
  }
}