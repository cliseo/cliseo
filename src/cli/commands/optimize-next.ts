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
 * Fixes the critical "use client" + metadata export issue
 * by removing metadata from client component and suggesting proper placement
 */
async function fixClientComponentMetadata(file: string, code: string): Promise<void> {
  try {
    // Extract the metadata export to suggest where to move it
    const metadataMatch = code.match(/export const metadata = \{[^}]*\}[^;]*;?/s);
    
    if (!metadataMatch) {
      console.log(chalk.yellow(`   Could not extract metadata from ${file}`));
      return;
    }
    
    const metadataCode = metadataMatch[0];
    
    // Remove the metadata export from the client component
    const fixedCode = code.replace(metadataMatch[0], '').replace(/\n\s*\n\s*\n/g, '\n\n'); // Clean up extra blank lines
    
    // Write the fixed client component (without metadata)
    await fs.writeFile(file, fixedCode, 'utf8');
    console.log(chalk.green(`   ✅ Removed metadata export from client component: ${file}`));
    
    // Try to find and update layout.tsx
    const projectRoot = findProjectRoot(path.dirname(file));
    const layoutPaths = [
      path.join(path.dirname(file), 'layout.tsx'),
      path.join(path.dirname(file), 'layout.ts'),
      path.join(projectRoot, 'app', 'layout.tsx'),
      path.join(projectRoot, 'app', 'layout.ts'),
    ];
    
    let layoutFound = false;
    for (const layoutPath of layoutPaths) {
      if (existsSync(layoutPath)) {
        await addMetadataToLayout(layoutPath, metadataCode);
        layoutFound = true;
        break;
      }
    }
    
    if (!layoutFound) {
      console.log(chalk.yellow(`   📝 Create app/layout.tsx and add this metadata:`));
      console.log(chalk.gray(`   ${metadataCode}`));
    }
    
  } catch (error) {
    console.log(chalk.red(`   ❌ Failed to fix client component metadata in ${file}: ${error}`));
  }
}

/**
 * Adds metadata to layout.tsx if it doesn't already have it
 */
async function addMetadataToLayout(layoutPath: string, metadataCode: string): Promise<void> {
  try {
    const layoutContent = await fs.readFile(layoutPath, 'utf8');
    
    // Check if layout already has metadata
    if (layoutContent.includes('export const metadata')) {
      console.log(chalk.yellow(`   Layout already has metadata: ${layoutPath}`));
      return;
    }
    
    // Find insertion point (after imports, before default export)
    const importPattern = /^import\s+.*?;?\s*$/gm;
    let lastImportIndex = -1;
    let match;
    
    while ((match = importPattern.exec(layoutContent)) !== null) {
      lastImportIndex = match.index + match[0].length;
    }
    
    let insertionPoint = 0;
    if (lastImportIndex !== -1) {
      insertionPoint = lastImportIndex;
    }
    
    // Insert metadata
    const beforeContent = layoutContent.substring(0, insertionPoint);
    const afterContent = layoutContent.substring(insertionPoint);
    
    let separator = '';
    if (!beforeContent.endsWith('\n')) {
      separator += '\n';
    }
    separator += '\n';
    
    const modifiedLayout = beforeContent + separator + metadataCode + '\n' + afterContent;
    
    await fs.writeFile(layoutPath, modifiedLayout, 'utf8');
    console.log(chalk.green(`   ✅ Added metadata to layout: ${layoutPath}`));
    
  } catch (error) {
    console.log(chalk.red(`   ❌ Failed to update layout ${layoutPath}: ${error}`));
  }
}

/**
 * Enhances existing metadata with missing SEO fields
 */
async function enhanceExistingMetadata(file: string, code: string): Promise<void> {
  try {
    // Parse existing metadata to see what's missing
    const metadataMatch = code.match(/export const metadata[^=]*=\s*(\{[^}]*\})/s);
    if (!metadataMatch) {
      console.log(chalk.yellow(`   Could not parse metadata in ${file}`));
      return;
    }

    const existingMetadata = metadataMatch[1];
    const missingFields = [];

    // Check for missing essential SEO fields
    if (!existingMetadata.includes('openGraph')) missingFields.push('openGraph');
    if (!existingMetadata.includes('twitter')) missingFields.push('twitter');
    if (!existingMetadata.includes('robots')) missingFields.push('robots');
    if (!existingMetadata.includes('viewport')) missingFields.push('viewport');

    if (missingFields.length === 0) {
      console.log(chalk.green(`   ✅ Metadata is complete in ${file}`));
      return;
    }

    console.log(chalk.yellow(`   📝 Adding missing SEO fields: ${missingFields.join(', ')}`));
    console.log(chalk.gray(`   💡 Use --ai flag for personalized content instead of placeholders`));

    // Build enhancement string
    let enhancements = '';
    if (missingFields.includes('viewport')) {
      enhancements += `\n  viewport: 'width=device-width, initial-scale=1',`;
    }
    if (missingFields.includes('robots')) {
      enhancements += `\n  robots: 'index, follow',`;
    }
    if (missingFields.includes('openGraph')) {
      enhancements += `\n  openGraph: {
    title: 'Replace with your site title',
    description: 'Replace with your site description',
    type: 'website',
    url: 'https://yourdomain.com',
  },`;
    }
    if (missingFields.includes('twitter')) {
      enhancements += `\n  twitter: {
    card: 'summary_large_image',
    title: 'Replace with your site title',
    description: 'Replace with your site description',
  },`;
    }

    // Insert enhancements before the closing brace
    const enhancedCode = code.replace(
      /(\}\s*;?\s*)$/m,
      `${enhancements}\n$1`
    );

    await fs.writeFile(file, enhancedCode, 'utf8');
    console.log(chalk.green(`   ✅ Added SEO metadata structure in ${file}`));
    console.log(chalk.cyan(`   📝 Remember to replace placeholder text with your actual content`));

  } catch (error) {
    console.log(chalk.red(`   ❌ Failed to enhance metadata in ${file}: ${error}`));
  }
}

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

  // Check for critical "use client" + metadata issue
  const hasUseClient = code.includes('"use client"') || code.includes("'use client'");
  const hasMetadataExport = code.includes('export const metadata');
  
  if (hasUseClient && hasMetadataExport) {
    console.log(chalk.red(`⚠️  CRITICAL SEO ISSUE: ${file} has "use client" with metadata export`));
    console.log(chalk.yellow(`   Metadata will be ignored by Next.js in client components`));
    
    // Attempt to fix by removing metadata from client component and suggesting layout.tsx
    await fixClientComponentMetadata(file, code);
    return;
  }

  // Skip adding metadata to client components (they can't use it)
  if (hasUseClient) {
    console.log(chalk.yellow(`Skipping client component (metadata not supported): ${file}`));
    return;
  }

  // Check if metadata already exists and enhance it if incomplete
  if (hasMetadataExport) {
    console.log(`Metadata export found in: ${file}`);
    await enhanceExistingMetadata(file, code);
    return;
  }

  // Use precise string insertion to preserve ALL original formatting
  let modifiedCode = code;
  let modified = false;

  const metadataExport = `export const metadata = {
  title: 'Replace with your page title',
  description: 'Replace with your page description - describe what this page is about',
  robots: 'index, follow',
  viewport: 'width=device-width, initial-scale=1',
  openGraph: {
    title: 'Replace with your site title',
    description: 'Replace with your site description',
    type: 'website',
    url: 'https://yourdomain.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Replace with your site title',
    description: 'Replace with your site description',
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
    console.log(chalk.green(` • Added SEO metadata structure to: ${file}`));
    console.log(chalk.cyan(`   📝 Replace placeholder text with your actual content (or use cliseo optimize --ai for automatic content)`));
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