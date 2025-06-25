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
import ora from 'ora';

const traverse = (_traverse as any).default || _traverse;
const generate = (_generate as any).default || _generate;

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

function addImportIfNeeded(programPath: babel.NodePath<t.Program>, moduleName: string, importName: string, isDefault = false) {
  let importExists = false;
  programPath.get('body').forEach(nodePath => {
    if (nodePath.isImportDeclaration() && nodePath.node.source.value === moduleName) {
      importExists = true;
    }
  });

  if (!importExists) {
    let newImport;
    if (isDefault) {
      newImport = t.importDeclaration(
        [t.importDefaultSpecifier(t.identifier(importName))],
        t.stringLiteral(moduleName)
      );
    } else {
      newImport = t.importDeclaration(
        [t.importSpecifier(t.identifier(importName), t.identifier(importName))],
        t.stringLiteral(moduleName)
      );
    }
    programPath.unshiftContainer('body', newImport);
  }
}

async function transformAppFile(file: string): Promise<void> {
  const code = await fs.readFile(file, 'utf8');
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
    
    let modified = false;
    
  // 1. Modify metadata object
  traverse(ast, {
    ExportNamedDeclaration(path) {
      const declaration = path.node.declaration;
      if (t.isVariableDeclaration(declaration)) {
        declaration.declarations.forEach(declarator => {
          if (t.isIdentifier(declarator.id) && declarator.id.name === 'metadata' && t.isObjectExpression(declarator.init)) {
            const properties = declarator.init.properties;
            const existingKeys = properties.map(p => t.isObjectProperty(p) && t.isIdentifier(p.key) ? p.key.name : null);
            
            const seoProperties = {
              description: 'SEO optimized description',
              canonical: 'https://your-domain.com/your-page',
              openGraph: { title: 'OG Title', description: 'OG Description' },
              twitter: { card: 'summary_large_image', title: 'Twitter Title' }
            };

            if (!existingKeys.includes('description')) {
              properties.push(t.objectProperty(t.identifier('description'), t.stringLiteral(seoProperties.description)));
      modified = true;
    }
            if (!existingKeys.includes('canonical')) {
              properties.push(t.objectProperty(t.identifier('canonical'), t.stringLiteral(seoProperties.canonical)));
      modified = true;
    }
             if (!existingKeys.includes('openGraph')) {
              properties.push(t.objectProperty(t.identifier('openGraph'), t.objectExpression([
                t.objectProperty(t.identifier('title'), t.stringLiteral(seoProperties.openGraph.title)),
                t.objectProperty(t.identifier('description'), t.stringLiteral(seoProperties.openGraph.description)),
              ])));
      modified = true;
    }
             if (!existingKeys.includes('twitter')) {
              properties.push(t.objectProperty(t.identifier('twitter'), t.objectExpression([
                 t.objectProperty(t.identifier('card'), t.stringLiteral(seoProperties.twitter.card)),
                t.objectProperty(t.identifier('title'), t.stringLiteral(seoProperties.twitter.title)),
              ])));
        modified = true;
            }
          }
        });
      }
    }
  });
  
  // 2. Code Modernization (Image and Link)
  let imageImportNeeded = false;
  let linkImportNeeded = false;
  
  traverse(ast, {
    JSXElement(path) {
      const openingElement = path.node.openingElement;
      if (t.isJSXIdentifier(openingElement.name)) {
        if (openingElement.name.name === 'img') {
          openingElement.name.name = 'Image';
          openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier('width'), t.jsxExpressionContainer(t.numericLiteral(500))));
          openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier('height'), t.jsxExpressionContainer(t.numericLiteral(300))));
          if (!openingElement.attributes.some(attr => t.isJSXAttribute(attr) && attr.name.name === 'alt')) {
            openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier('alt'), t.stringLiteral('Description of image')));
          }
          imageImportNeeded = true;
          modified = true;
        } else if (openingElement.name.name === 'a') {
          const hrefAttr = openingElement.attributes.find(attr => t.isJSXAttribute(attr) && attr.name.name === 'href');
          if (hrefAttr && t.isStringLiteral(hrefAttr.value) && hrefAttr.value.value.startsWith('/')) {
            openingElement.name.name = 'Link';
            linkImportNeeded = true;
      modified = true;
    }
        }
      }
    },
  });

  if (imageImportNeeded || linkImportNeeded) {
    traverse(ast, {
      Program(path) {
        if (imageImportNeeded) addImportIfNeeded(path, 'next/image', 'Image', true);
        if (linkImportNeeded) addImportIfNeeded(path, 'next/link', 'Link', true);
        path.stop();
      }
    });
    }
    
    if (modified) {
    const output = generate(ast, {}, code);
    const formattedCode = await prettier.format(output.code, {
        parser: 'typescript',
        semi: true,
        singleQuote: true,
        trailingComma: 'all',
    });
    await fs.writeFile(file, formattedCode, 'utf8');
    console.log(chalk.green(` • Successfully optimized (App Router): ${path.basename(file)}`));
  }
}

async function transformPagesFile(file: string): Promise<void> {
  const code = await fs.readFile(file, 'utf8');
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  
  let modified = false;

  const jsonLdObject = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "url": "https://your-domain.com/",
    "name": "Your Site Name",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://your-domain.com/search?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  const headChildren = [
    t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('title'), [], false), t.jsxClosingElement(t.jsxIdentifier('title')), [t.jsxText('SEO Title')]),
    t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('meta'), [t.jsxAttribute(t.jsxIdentifier('name'), t.stringLiteral('description')), t.jsxAttribute(t.jsxIdentifier('content'), t.stringLiteral('SEO Description'))], true), null, [], true),
    t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('meta'), [t.jsxAttribute(t.jsxIdentifier('name'), t.stringLiteral('robots')), t.jsxAttribute(t.jsxIdentifier('content'), t.stringLiteral('index, follow'))], true), null, [], true),
    t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('link'), [t.jsxAttribute(t.jsxIdentifier('rel'), t.stringLiteral('canonical')), t.jsxAttribute(t.jsxIdentifier('href'), t.stringLiteral('https://your-domain.com/your-page'))], true), null, [], true),
    
    t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('meta'), [t.jsxAttribute(t.jsxIdentifier('property'), t.stringLiteral('og:type')), t.jsxAttribute(t.jsxIdentifier('content'), t.stringLiteral('website'))], true), null, [], true),
    t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('meta'), [t.jsxAttribute(t.jsxIdentifier('property'), t.stringLiteral('og:title')), t.jsxAttribute(t.jsxIdentifier('content'), t.stringLiteral('Open Graph Title'))], true), null, [], true),
    t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('meta'), [t.jsxAttribute(t.jsxIdentifier('property'), t.stringLiteral('og:description')), t.jsxAttribute(t.jsxIdentifier('content'), t.stringLiteral('Open Graph Description'))], true), null, [], true),
    t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('meta'), [t.jsxAttribute(t.jsxIdentifier('property'), t.stringLiteral('og:url')), t.jsxAttribute(t.jsxIdentifier('content'), t.stringLiteral('https://your-domain.com/your-page'))], true), null, [], true),

    t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('meta'), [t.jsxAttribute(t.jsxIdentifier('name'), t.stringLiteral('twitter:card')), t.jsxAttribute(t.jsxIdentifier('content'), t.stringLiteral('summary_large_image'))], true), null, [], true),
    t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('meta'), [t.jsxAttribute(t.jsxIdentifier('name'), t.stringLiteral('twitter:title')), t.jsxAttribute(t.jsxIdentifier('content'), t.stringLiteral('Twitter Title'))], true), null, [], true),
    t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('meta'), [t.jsxAttribute(t.jsxIdentifier('name'), t.stringLiteral('twitter:description')), t.jsxAttribute(t.jsxIdentifier('content'), t.stringLiteral('Twitter Description'))], true), null, [], true),

    t.jsxElement(
      t.jsxOpeningElement(t.jsxIdentifier('script'), [
          t.jsxAttribute(t.jsxIdentifier('type'), t.stringLiteral('application/ld+json')),
          t.jsxAttribute(
              t.jsxIdentifier('dangerouslySetInnerHTML'),
              t.jsxExpressionContainer(
                  t.objectExpression([
                      t.objectProperty(
                          t.identifier('__html'),
                          t.callExpression(
                            t.memberExpression(t.identifier('JSON'), t.identifier('stringify')),
                            [t.valueToNode(jsonLdObject)]
                          )
                      )
                  ])
              )
          )
      ], false),
      t.jsxClosingElement(t.jsxIdentifier('script')),
      []
    )
  ];

  const headElement = t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier('Head'), [], false),
    t.jsxClosingElement(t.jsxIdentifier('Head')),
    headChildren
  );

  traverse(ast, {
    ReturnStatement(path) {
      if (t.isJSXElement(path.node.argument)) {
        const rootElement = path.node.argument;
        if (!rootElement.children.some(child => t.isJSXElement(child) && t.isJSXIdentifier(child.openingElement.name) && child.openingElement.name.name === 'Head')) {
            // Find JSX Fragment and add head, otherwise create a new one
            if(t.isJSXFragment(rootElement)){
                 rootElement.children.unshift(headElement);
            } else {
                 const newFragment = t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), [headElement, rootElement]);
                 path.get('argument').replaceWith(newFragment);
            }
            modified = true;
        }
        path.stop();
      }
    },
  });

  let headImportNeeded = modified;
  let imageImportNeeded = false;
  let linkImportNeeded = false;

   traverse(ast, {
    JSXElement(path) {
      const openingElement = path.node.openingElement;
      if (t.isJSXIdentifier(openingElement.name)) {
        if (openingElement.name.name === 'img') {
          openingElement.name.name = 'Image';
          openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier('width'), t.jsxExpressionContainer(t.numericLiteral(500))));
          openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier('height'), t.jsxExpressionContainer(t.numericLiteral(300))));
           if (!openingElement.attributes.some(attr => t.isJSXAttribute(attr) && attr.name.name === 'alt')) {
            openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier('alt'), t.stringLiteral('Description of image')));
          }
          imageImportNeeded = true;
          modified = true;
        } else if (openingElement.name.name === 'a') {
          const hrefAttr = openingElement.attributes.find(attr => t.isJSXAttribute(attr) && attr.name.name === 'href');
          if (hrefAttr && t.isStringLiteral(hrefAttr.value) && hrefAttr.value.value.startsWith('/')) {
            openingElement.name.name = 'Link';
            linkImportNeeded = true;
            modified = true;
          }
        }
      }
    },
  });

  if (headImportNeeded || imageImportNeeded || linkImportNeeded) {
    traverse(ast, {
      Program(path) {
        if (headImportNeeded) addImportIfNeeded(path, 'next/head', 'Head', true);
        if (imageImportNeeded) addImportIfNeeded(path, 'next/image', 'Image', true);
        if (linkImportNeeded) addImportIfNeeded(path, 'next/link', 'Link', true);
        path.stop();
      }
    });
  }

  if (modified) {
    const output = generate(ast, {}, code);
    const formattedCode = await prettier.format(output.code, {
        parser: 'typescript',
        semi: true,
        singleQuote: true,
        trailingComma: 'all',
    });
    await fs.writeFile(file, formattedCode, 'utf8');
    console.log(chalk.green(` • Successfully optimized (Pages Router): ${path.basename(file)}`));
  }
}

export async function optimizeNextjsComponents(targetDir?: string): Promise<void> {
  const rootDir = targetDir || process.cwd();
  console.log(chalk.blue(`Processing Next.js components from root: ${rootDir}`));

  const appDirs = [path.join(rootDir, 'app'), path.join(rootDir, 'src', 'app')].filter(dir => existsSync(dir));
  const pagesDirs = [path.join(rootDir, 'pages'), path.join(rootDir, 'src', 'pages')].filter(dir => existsSync(dir));

  if (appDirs.length === 0 && pagesDirs.length === 0) {
    console.log(chalk.yellow('No pages or app directory found. Skipping component optimization.'));
    return;
  }

  for (const dir of appDirs) {
    const files = await glob('**/*.{js,jsx,ts,tsx}', { cwd: dir, absolute: true, ignore: ['**/node_modules/**', '**/*.test.*'] });
    for (const file of files) {
      try { await transformAppFile(file); } catch (e) { console.error(chalk.red(`Failed to transform ${file}`), e); }
    }
  }

  for (const dir of pagesDirs) {
    const files = await glob('**/*.{js,jsx,ts,tsx}', { cwd: dir, absolute: true, ignore: ['**/node_modules/**', '**/*.test.*'] });
    for (const file of files) {
      try { await transformPagesFile(file); } catch (e) { console.error(chalk.red(`Failed to transform ${file}`), e); }
    }
  }
} 