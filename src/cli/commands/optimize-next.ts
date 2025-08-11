import { readFileSync, writeFileSync, existsSync } from 'fs';
import * as fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import * as babel from '@babel/core';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import * as t from '@babel/types';
import { parseDocument } from 'htmlparser2';
import { DomUtils } from 'htmlparser2';
import { default as render } from 'dom-serializer';
import { JSDOM } from 'jsdom';
import chalk from 'chalk';

const traverse = _traverse.default;
const generate = _generate.default;

/**
 * Recursively walks up the directory tree to find the project root.
 * Assumes the root contains a `package.json`.
 * 
 * @param {string} [startDir=process.cwd()] - Directory to start search from
 * @returns {string} - Project root directory path 
 */
function findProjectRoot(startDir = process.cwd()): string {
  let dir = path.resolve(startDir);
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

/**
 * Determines if a given file path is likely a Next.js "page" component
 * based on common naming or folder conventions.
 * 
 * @param {string} filePath - Absolute or relative path to the file
 * @returns {boolean} - True if the file is likely a page component
 */
function isLikelyPageFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/'); 
  const fileName = path.basename(filePath);
  
  // Exclude config and utility files
  if (/(config|\.config|\.d\.ts|types|utils|constants|hooks|context)/.test(fileName)) {
    return false;
  }
  
  // Include Next.js App Router files
  if (/\/(app|pages|routes|views)\//.test(normalized)) {
    return true;
  }
  
  // Include component files that might be pages
  if (/components\//.test(normalized) && /(tsx?|jsx?)$/.test(fileName)) {
    return true;
  }
  
  // Include files with page-like names
  if (/(Page|Screen|Route|page|layout)\.(jsx?|tsx?|js?|ts?)$/.test(fileName)) {
    return true;
  }
  
  return false;
}

const headNode = () =>
  t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier('Head'), [], false),
    t.jsxClosingElement(t.jsxIdentifier('Head')),
    [
      // <title>{title}</title>
      t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('title'), [], false),
        t.jsxClosingElement(t.jsxIdentifier('title')),
        [t.jsxExpressionContainer(t.stringLiteral('title'))],
        false
      ),

      // <meta name="description" content={description} />
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('meta'),
          [
            t.jsxAttribute(t.jsxIdentifier('name'), t.stringLiteral('description')),
            t.jsxAttribute(
              t.jsxIdentifier('content'),
              t.stringLiteral('description')
            ),
          ],
          true
        ),
        null,
        [],
        true
      ),

      // <meta name="robots" content="index, follow" />
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('meta'),
          [
            t.jsxAttribute(t.jsxIdentifier('name'), t.stringLiteral('robots')),
            t.jsxAttribute(t.jsxIdentifier('content'), t.stringLiteral('index, follow')),
          ],
          true
        ),
        null,
        [],
        true
      ),

      // <link rel="canonical" href={canonicalUrl} />
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('link'),
          [
            t.jsxAttribute(t.jsxIdentifier('rel'), t.stringLiteral('canonical')),
            t.jsxAttribute(
              t.jsxIdentifier('href'),
              t.stringLiteral('canonicalUrl')
            ),
          ],
          true
        ),
        null,
        [],
        true
      ),

      // <meta property="og:title" content={title} />
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('meta'),
          [
            t.jsxAttribute(t.jsxIdentifier('property'), t.stringLiteral('og:title')),
            t.jsxAttribute(
              t.jsxIdentifier('content'),
              t.stringLiteral('title')
            ),
          ],
          true
        ),
        null,
        [],
        true
      ),

      // <meta property="og:description" content={description} />
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('meta'),
          [
            t.jsxAttribute(t.jsxIdentifier('property'), t.stringLiteral('og:description')),
            t.jsxAttribute(
              t.jsxIdentifier('content'),
              t.stringLiteral('description')
            ),
          ],
          true
        ),
        null,
        [],
        true
      ),

      // <meta property="og:image" content={ogImage} />
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('meta'),
          [
            t.jsxAttribute(t.jsxIdentifier('property'), t.stringLiteral('og:image')),
            t.jsxAttribute(
              t.jsxIdentifier('content'),
              t.stringLiteral('ogImage')
            ),
          ],
          true
        ),
        null,
        [],
        true
      ),

      // <meta property="og:type" content="website" />
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('meta'),
          [
            t.jsxAttribute(t.jsxIdentifier('property'), t.stringLiteral('og:type')),
            t.jsxAttribute(t.jsxIdentifier('content'), t.stringLiteral('website')),
          ],
          true
        ),
        null,
        [],
        true
      ),

      // <meta property="og:url" content={canonicalUrl} />
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('meta'),
          [
            t.jsxAttribute(t.jsxIdentifier('property'), t.stringLiteral('og:url')),
            t.jsxAttribute(
              t.jsxIdentifier('content'),
              t.stringLiteral('canonicalUrl')
            ),
          ],
          true
        ),
        null,
        [],
        true
      ),

      // <meta name="twitter:card" content="summary_large_image" />
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('meta'),
          [
            t.jsxAttribute(t.jsxIdentifier('name'), t.stringLiteral('twitter:card')),
            t.jsxAttribute(t.jsxIdentifier('content'), t.stringLiteral('summary_large_image')),
          ],
          true
        ),
        null,
        [],
        true
      ),

      // <meta name="twitter:title" content={title} />
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('meta'),
          [
            t.jsxAttribute(t.jsxIdentifier('name'), t.stringLiteral('twitter:title')),
            t.jsxAttribute(
              t.jsxIdentifier('content'),
              t.stringLiteral('title')
            ),
          ],
          true
        ),
        null,
        [],
        true
      ),

      // <meta name="twitter:description" content={description} />
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('meta'),
          [
            t.jsxAttribute(t.jsxIdentifier('name'), t.stringLiteral('twitter:description')),
            t.jsxAttribute(
              t.jsxIdentifier('content'),
              t.stringLiteral('description')
            ),
          ],
          true
        ),
        null,
        [],
        true
      ),

      // <meta name="twitter:image" content={ogImage} />
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('meta'),
          [
            t.jsxAttribute(t.jsxIdentifier('name'), t.stringLiteral('twitter:image')),
            t.jsxAttribute(
              t.jsxIdentifier('content'),
              t.stringLiteral('ogImage')
            ),
          ],
          true
        ),
        null,
        [],
        true
      ),
    ],
    false
  );
const seoHeadJSXElement = headNode();

/**
 * Gets the name of a JSX element from its identifier.
 * 
 * @param name - The name of the JSX element
 * @returns {string} - The name of the JSX element as a string
 */
function getJSXElementName(name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName): string {
  return t.isJSXIdentifier(name) ? name.name : '';
}

/**
 * Injects next/head tags into a Next.js component file.
 * 
 * @param {string} file - Path to the file to transform
 */
export async function transformFile(file: string): Promise<void> {
  console.log(`Reading file: ${file}`);
  const code = await fs.readFile(file, 'utf8');

  if (code.includes('@next/head')) {
    console.log(chalk.yellow(`Skipping file with @next/head import: ${file}`));
    return;
  }

  // Check if metadata already exists using string search first (safer approach)
  if (code.includes('export const metadata')) {
    console.log(`Metadata export already exists in: ${file}`);
    return;
  }

  // Use precise string insertion to preserve ALL original formatting
  let modifiedCode = code;
  let modified = false;

  const metadataExport = `export const metadata = {
  description: 'SEO optimized description',
  robots: 'index, follow',
  openGraph: {
    title: 'OpenGraph Title',
    description: 'OpenGraph Description',
  },
};

`;

  // Find insertion point using regex to avoid split/join which can affect formatting
  const importPattern = /^import\s+.*?;?\s*$/gm;
  let lastImportIndex = -1;
  let match;
  
  // Find the end of the last import statement
  while ((match = importPattern.exec(code)) !== null) {
    lastImportIndex = match.index + match[0].length;
  }
  
  if (lastImportIndex === -1) {
    // No imports found, insert at beginning of file
    modifiedCode = metadataExport + code;
  } else {
    // Insert after the last import, preserving exact formatting
    const beforeImports = code.substring(0, lastImportIndex);
    const afterImports = code.substring(lastImportIndex);
    
    // Add newlines only if needed
    let separator = '';
    if (!beforeImports.endsWith('\n')) {
      separator += '\n';
    }
    separator += '\n'; // One blank line before metadata
    
    modifiedCode = beforeImports + separator + metadataExport + afterImports;
  }
  
  modified = true;

  if (modified) {
    // Don't apply Prettier to entire file to preserve original formatting
    // Only the metadata export we added is already properly formatted
    await fs.writeFile(file, modifiedCode, 'utf8');
    console.log(chalk.green(` • Successfully injected SEO optimizations in file: ${file}`));
  } else {
    console.log(`No modifications needed for: ${file}`);
  }
}

/**
 * Optimizes Next.js components by injecting SEO-friendly <Head> tags.
 */
export async function optimizeNextjsComponents(targetDir?: string): Promise<void> {
  const rootDir = targetDir || process.cwd();
  console.log(chalk.blue(`Processing Next.js components from root: ${rootDir}`));

  const pagesDir = path.join(rootDir, 'pages');
  const appDir = path.join(rootDir, 'app');
  const srcPagesDir = path.join(rootDir, 'src', 'pages');
  const srcAppDir = path.join(rootDir, 'src', 'app');

  const componentDirs = [pagesDir, appDir, srcPagesDir, srcAppDir].filter(dir =>
    existsSync(dir)
  );

  if (componentDirs.length === 0) {
    console.log(chalk.yellow('No pages or app directory found. Skipping component optimization.'));
    return;
  }

  let totalFilesProcessed = 0;

  for (const dir of componentDirs) {
    console.log(chalk.cyan(`Searching for Next.js files in: ${dir}`));
    const files = await glob('**/*.{js,jsx,ts,tsx}', {
      cwd: dir,
      absolute: true,
      ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*'],
    });

    console.log(chalk.cyan(`Found ${files.length} files in ${dir}`));

    for (const file of files) {
      try {
        await transformFile(file);
        totalFilesProcessed++;
      } catch (error) {
        console.error(chalk.red(`Failed to transform ${file}:`), error);
      }
    }
  }
  console.log(`\nProcessed ${totalFilesProcessed} Next.js files total.\n`);
} 