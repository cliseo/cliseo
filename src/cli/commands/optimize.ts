import { writeFile, access } from 'fs/promises';
import * as cheerio from 'cheerio';
import { join, dirname, resolve } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { glob } from 'glob';
import fs from 'fs';
import { html } from 'node_modules/cheerio/dist/esm/static';

// --- Find project root (where package.json is) ---
function findProjectRoot(startDir = process.cwd()): string {
  let dir = resolve(startDir);
  while (dir !== dirname(dir)) {
    if (fs.existsSync(join(dir, 'package.json'))) return dir;
    dir = dirname(dir);
  }
  return process.cwd(); // fallback
}

// --- New: Create robots.txt and sitemap.xml if missing in project root ---
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

// add meta tags to all HTML files //
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

    await fs.promises.writeFile(file, $.html());

  }
}


// --- Main function to optimize SEO files --- //
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

    spinner.text = 'Adding meta tags to HTML files...';
    await addMetaTagsToHtmlFiles();
    spinner.succeed('Meta tags added to HTML files!');

    console.log(chalk.green('✔ SEO optimization complete!'));
    console.log(chalk.gray('You can now customize your robots.txt and sitemap.xml files.'));
    console.log(chalk.yellow('Make sure to update the URLs in sitemap.xml to match your site.'));
    console.log(chalk.yellow('You can also customize the meta tags in your HTML files.'));
    console.log(chalk.blue('For more information, visit: https://cliseo.com/seo-guide'));
    console.log(chalk.green('Happy optimizing!'));
  } catch (error) {
    spinner.fail('SEO file generation failed!');
    console.error(error);
    process.exit(1);
  }
}