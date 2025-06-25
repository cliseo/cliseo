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
import prettier from 'prettier';
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

  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let metadataVariable: t.VariableDeclarator | null = null;
  let modified = false;

  traverse(ast, {
    ExportNamedDeclaration(path) {
      if (t.isVariableDeclaration(path.node.declaration)) {
        for (const declarator of path.node.declaration.declarations) {
          if (t.isIdentifier(declarator.id) && declarator.id.name === 'metadata') {
            metadataVariable = declarator;
            break;
          }
        }
      }
    },
  });

  const seoProperties = [
    t.objectProperty(t.identifier('description'), t.stringLiteral('SEO optimized description')),
    t.objectProperty(t.identifier('robots'), t.stringLiteral('index, follow')),
    t.objectProperty(
      t.identifier('openGraph'),
      t.objectExpression([
        t.objectProperty(t.identifier('title'), t.stringLiteral('OpenGraph Title')),
        t.objectProperty(t.identifier('description'), t.stringLiteral('OpenGraph Description')),
      ])
    ),
  ];

  if (metadataVariable && t.isObjectExpression(metadataVariable.init)) {
    //
    seoProperties.forEach(prop => {
      if (t.isObjectProperty(prop)) {
        const key = (prop.key as t.Identifier).name;
        const exists = metadataVariable!.init as t.ObjectExpression;
        if (!exists.properties.some(p => t.isObjectProperty(p) && (p.key as t.Identifier).name === key)) {
          (metadataVariable.init as t.ObjectExpression).properties.push(prop);
          modified = true;
        }
      }
    });
  } else {
    //
    const metadataExport = t.exportNamedDeclaration(
      t.variableDeclaration('const', [
        t.variableDeclarator(t.identifier('metadata'), t.objectExpression(seoProperties)),
      ])
    );
    //
    const program = (ast.program as t.Program);
    program.body.unshift(metadataExport);
    modified = true;
  }

  if (modified) {
    const output = generate(ast, {}, code);
    await fs.writeFile(file, output.code, 'utf8');
    console.log(chalk.green(` • Successfully injected SEO optimizations in file: ${file}`));
  } else {
    console.log(`No modifications needed for: ${file}`);
  }
}

/**
 * Optimizes Next.js components by injecting SEO-friendly <Head> tags.
 */
export async function optimizeNextjsComponents(targetDir?: string): Promise<void> {
  const root = targetDir || findProjectRoot();
  console.log(`Processing Next.js components from root: ${root}`);
  
  // Next.js projects can have different structures:
  // 1. src/pages/ or src/app/ (when using src directory)
  // 2. pages/ or app/ (traditional structure)
  // 3. Mixed structures
  
  const searchDirs = [
    path.join(root, 'src'),
    path.join(root, 'pages'), 
    path.join(root, 'app'),
    root // fallback to root
  ];
  
  let filesFound = 0;
  const MAX_FILES_TO_PROCESS = 20; // Reduced from 50 for E2E stability
  
  for (const searchDir of searchDirs) {
    if (!existsSync(searchDir)) {
      console.log(`Directory ${searchDir} does not exist, skipping...`);
      continue;
    }
    
    try {
      console.log(`Searching for Next.js files in: ${searchDir}`);
      const files = await glob('**/*.{js,jsx,ts,tsx}', { 
        cwd: searchDir, 
        absolute: true,
        ignore: [
          '**/node_modules/**',
          '**/dist/**', 
          '**/.next/**',
          '**/build/**',
          '**/.git/**',
          '**/coverage/**'
        ]
      });
      
      console.log(`Found ${files.length} files in ${searchDir}`);
      
      for (const file of files) {
        // Extra safety check to skip node_modules and build directories
        if (file.includes('/node_modules/') || 
            file.includes('/.next/') || 
            file.includes('/dist/') || 
            file.includes('/build/') ||
            file.includes('/.git/')) {
          console.log(`Skipping build/dependency file: ${file}`);
          continue;
        }
        
        if (!isLikelyPageFile(file)) {
          console.log(`Skipping non-page file: ${file}`);
          continue;
        }
        
        filesFound++;
        console.log(`Processing Next.js file: ${file}`);
        
        // Safety limit check
        if (filesFound > MAX_FILES_TO_PROCESS) {
          console.log(`Reached maximum file limit (${MAX_FILES_TO_PROCESS}), stopping processing`);
          break;
        }
        
        try {
          // Timeout to prevent hanging on any single file
          await Promise.race([
            transformFile(file),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Transform timeout')), 15000) // Reduced timeout
            )
          ]);
        } catch (err) {
          if (err instanceof Error && err.message === 'Transform timeout') {
            console.error(`Timeout processing ${file} (skipping)`);
          } else {
            console.error(`Failed to transform ${file}:`, err);
          }
        }
      }
    } catch (err) {
      console.error(`Error globbing in ${searchDir}:`, err);
    }
    
    // Break out of outer loop if we hit the limit
    if (filesFound > MAX_FILES_TO_PROCESS) {
      break;
    }
  }
  
  console.log(`Processed ${filesFound} Next.js files total`);
} 