import { readFileSync, writeFileSync, existsSync } from 'fs';
import * as fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import * as babel from '@babel/core';
import * as t from '@babel/types';
import prettier from 'prettier';
import jsxSyntax from '@babel/plugin-syntax-jsx';
import typescriptSyntax from '@babel/plugin-syntax-typescript';
import reactJsx from '@babel/plugin-transform-react-jsx';
import typescriptTransform from '@babel/plugin-transform-typescript';
import reactPreset from '@babel/preset-react';
import typescriptPreset from '@babel/preset-typescript';

const helmetImportName = 'Helmet';

const schemaObject = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Your Page Title",
  "description": "Your page description",
  "url": "https://yourdomain.com/current-page"
};

const helmetJSXElement = t.jsxElement(
  t.jsxOpeningElement(t.jsxIdentifier('Helmet'), [], false),
  t.jsxClosingElement(t.jsxIdentifier('Helmet')),
  [
    // title element
    t.jsxElement(
      t.jsxOpeningElement(t.jsxIdentifier('title'), [], false),
      t.jsxClosingElement(t.jsxIdentifier('title')),
      [t.jsxText('Your Site Title')],
      false
    ),

    // meta description
    t.jsxElement(
      t.jsxOpeningElement(
        t.jsxIdentifier('meta'),
        [
          t.jsxAttribute(t.jsxIdentifier('name'), t.stringLiteral('description')),
          t.jsxAttribute(t.jsxIdentifier('content'), t.stringLiteral('Default description for this page'))
        ],
        true
      ),
      null,
      [],
      true
    ),

    // canonical link
    t.jsxElement(
      t.jsxOpeningElement(
        t.jsxIdentifier('link'),
        [
          t.jsxAttribute(t.jsxIdentifier('rel'), t.stringLiteral('canonical')),
          t.jsxAttribute(t.jsxIdentifier('href'), t.stringLiteral('https://yourdomain.com/current-page'))
        ],
        true
      ),
      null,
      [],
      true
    ),

    // schema script tag with dangerouslySetInnerHTML
    t.jsxElement(
      t.jsxOpeningElement(
        t.jsxIdentifier('script'),
        [
          t.jsxAttribute(t.jsxIdentifier('type'), t.stringLiteral('application/ld+json')),
          t.jsxAttribute(
            t.jsxIdentifier('dangerouslySetInnerHTML'),
            t.jsxExpressionContainer(
              t.objectExpression([
                t.objectProperty(
                  t.identifier('__html'),
                  t.stringLiteral(JSON.stringify(schemaObject, null, 2))
                )
              ])
            )
          )
        ],
        true
      ),
      null,
      [],
      true
    )
  ],
  false
);

/**
 * Determines if a given file path is likely a React "page" component
 * based on common naming or folder conventions.
 * Skips main entry files like App.tsx.
 */
function isLikelyPageFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const base = path.basename(filePath);
  
  // Must be in pages directory
  if (!/\/(pages|routes|views)\//.test(normalized)) {
    return false;
  }
  
  // Exclude main entry files like App.tsx, App.jsx, index.tsx, index.jsx
  if (/^(App|index)\.(jsx?|tsx?)$/.test(base)) {
    return false;
  }
  
  return true;
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
 * Helper function to get the name of a JSX element (or nested member expression).
 * 
 * @param {t.JSXIdentifier | t.JSXMemberExpression} node - JSX node to extract name from
 * @returns {string | null} - The extracted name or null
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
 * Parses and transforms a React component file by injecting Helmet metadata.
 * 
 * - Detects if the file is already using `react-helmet`
 * - Adds an import and JSX element if not present
 * 
 * @param {string} file - Absolute path to the source file
 */
async function transformFile(file: string): Promise<boolean> {
  const source = await fs.readFile(file, 'utf-8');
  const ast = babel.parse(source, {
    sourceType: 'module',
    filename: file,
    plugins: [
      [jsxSyntax, { allowNamespaces: true }],
      [typescriptSyntax, { isTSX: true, allExtensions: true }],
      reactJsx,
      typescriptTransform
    ],
    presets: [
      [reactPreset, { runtime: 'automatic' }],
      [typescriptPreset, { allExtensions: true, isTSX: true }]
    ]
  });

  if (!ast) {
    if (process.env.CLISEO_VERBOSE === 'true') {
      console.error(`[cliseo debug] Cannot parse ${file}`);
    }
    return false;
  }

  let helmetImported = false;
  let modified = false;

  babel.traverse(ast, {
    Program(path) {
      for (const node of path.node.body) {
        if (
          t.isImportDeclaration(node) &&
          node.source.value === 'react-helmet'
        ) {
          helmetImported = true;
          break;
        }
      }

      if (!helmetImported) {
        const importDecl = t.importDeclaration(
          [t.importSpecifier(t.identifier(helmetImportName), t.identifier(helmetImportName))],
          t.stringLiteral('react-helmet')
        );
        path.node.body.unshift(importDecl);
        helmetImported = true;
      }
    },

    /**
     * Handles standard function components (e.g. `function Home() { return (...) }`)
     */
    FunctionDeclaration(path) {
      if (modified) {
        return;
      }

      path.traverse({
        ReturnStatement(returnPath) {
          const arg = returnPath.node.argument;

          if (t.isJSXElement(arg)) {
            const tagName = getJSXElementName(arg.openingElement.name);

            const hasHelmet =
              tagName === 'Helmet' ||
              arg.children.some(child =>
                t.isJSXElement(child) && getJSXElementName(child.openingElement.name) === 'Helmet'
              );

            if (!hasHelmet) {
              arg.children.unshift(helmetJSXElement);
              returnPath.stop();
              modified = true;
            }
          }
        }
      });
    },
    
    /**
     * Handles arrow or named function expressions assigned to variables
     * (e.g. `const Home = () => { return (...) }`)
     */
    VariableDeclarator(path) {
      if (modified) return;

      if (
        t.isIdentifier(path.node.id) &&
        (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init))
      ) {

        const func = path.node.init;

        if (func.body && t.isJSXElement(func.body)) {
          const hasHelmet = func.body.children.some(child =>
            t.isJSXElement(child) && getJSXElementName(child.openingElement.name) === 'Helmet');

          if (!hasHelmet) {
            func.body.children.unshift(helmetJSXElement);
            modified = true;
          }
        } else if (func.body && t.isBlockStatement(func.body)) {

          path.get('init').traverse({
            ReturnStatement(returnPath) {
              const arg = returnPath.node.argument;

              if (t.isJSXElement(arg)) {
                const tagName = getJSXElementName(arg.openingElement.name);

                const hasHelmet = tagName === 'Helmet' || arg.children.some(child =>
                  t.isJSXElement(child) && getJSXElementName(child.openingElement.name) === 'Helmet'
                );

                if (!hasHelmet) {
                  arg.children.unshift(helmetJSXElement);
                  modified = true;
                  returnPath.stop();
                }
              }
            }
          });
        }
      }
    },

    /**
     * Handles class components with a render() method
     */
    ClassDeclaration(path) {
      if (modified) return;

      const body = path.node.body.body;
      const renderMethod = body.find(
        method =>
          t.isClassMethod(method) &&
          t.isIdentifier(method.key) && method.key.name === 'render' &&
          t.isBlockStatement(method.body)
      );

      if (renderMethod) {
        path.get('body').get('body').forEach(methodPath => {
          if (methodPath.isClassMethod() && t.isIdentifier(methodPath.node.key) && methodPath.node.key.name === 'render') {
            methodPath.traverse({
              ReturnStatement(returnPath) {
                const arg = returnPath.node.argument;

                if (t.isJSXElement(arg)) {
                  const tagName = getJSXElementName(arg.openingElement.name);

                  const hasHelmet = tagName === 'Helmet' || arg.children.some(child =>
                    t.isJSXElement(child) && getJSXElementName(child.openingElement.name) === 'Helmet');

                  if (!hasHelmet) {
                    arg.children.unshift(helmetJSXElement);
                    modified = true;
                    returnPath.stop();
                  }
                }
              }
            });
          }
        });
      }
    },

    JSXElement(path) {
      const opening = path.node.openingElement;
      const tagName = getJSXElementName(opening.name);

      if (tagName === 'Helmet') {
        let hasSchema = false;
        let hasTitle = false;
        let hasDescription = false;

        path.node.children.forEach(child => {
          if (t.isJSXElement(child)) {
            const childName = getJSXElementName(child.openingElement.name);
            if (childName === 'script') {
              const typeAttr = child.openingElement.attributes.find(attr =>
                t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === 'type');
              if (
                typeAttr &&
                t.isJSXAttribute(typeAttr) &&
                typeAttr.value &&
                t.isStringLiteral(typeAttr.value) &&
                typeAttr.value.value === 'application/ld+json'
              ) {
                hasSchema = true;
              }
            } else if (childName === 'title') {
              hasTitle = true;
            } else if (childName === 'meta') {
              const nameAttr = child.openingElement.attributes.find(attr =>
                t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === 'name');
              if (
                nameAttr &&
                t.isJSXAttribute(nameAttr) &&
                nameAttr.value &&
                t.isStringLiteral(nameAttr.value) &&
                nameAttr.value.value === 'description'
              ) {
                hasDescription = true;
              }
            }
          }
        });

        if (!hasTitle) {
          path.node.children.unshift(
            t.jsxElement(
              t.jsxOpeningElement(t.jsxIdentifier('title'), [], false),
              t.jsxClosingElement(t.jsxIdentifier('title')),
              [t.jsxText('Your Site Title')],
              false
            )
          );
          modified = true;
        }

        if (!hasDescription) {
          path.node.children.unshift(
            t.jsxElement(
              t.jsxOpeningElement(
                t.jsxIdentifier('meta'),
                [
                  t.jsxAttribute(t.jsxIdentifier('name'), t.stringLiteral('description')),
                  t.jsxAttribute(
                    t.jsxIdentifier('content'),
                    t.stringLiteral('Default description for this page')
                  )
                ],
                true
              ),
              null,
              [],
              true
            )
          );
          modified = true;
        }

        if (!hasSchema) {
          path.node.children.push(
            t.jsxElement(
              t.jsxOpeningElement(
                t.jsxIdentifier('script'),
                [
                  t.jsxAttribute(t.jsxIdentifier('type'), t.stringLiteral('application/ld+json')),
                  t.jsxAttribute(
                    t.jsxIdentifier('dangerouslySetInnerHTML'),
                    t.jsxExpressionContainer(
                      t.objectExpression([
                        t.objectProperty(
                          t.identifier('__html'),
                          t.stringLiteral(JSON.stringify(schemaObject, null, 2))
                        )
                      ])
                    )
                  )
                ],
                true
              ),
              null,
              [],
              true
            )
          );
          modified = true;
        }
      }

      if (tagName === 'img') {
        // Add alt attribute if missing
        const hasAlt = opening.attributes.some(attr => 
          t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === 'alt'
        );

        if (!hasAlt) {
          opening.attributes.push(
            t.jsxAttribute(t.jsxIdentifier('alt'), t.stringLiteral('Image description'))
          );
          modified = true; 
        }
      }   
    },
  });

  if (modified) {
    if (process.env.CLISEO_VERBOSE === 'true') {
      console.log(`[cliseo debug] Modifications made in file: ${file}, writing changes...`);
    }
    const output = babel.transformFromAstSync(ast, source, {
      configFile: true,
      generatorOpts: { retainLines: true, compact: false },
    });

    if (output && output.code) {
      // Prettier formatting disabled to minimize diff noise
      // If you prefer to format the output, uncomment the block below and add your own Prettier options
      /*
      const formatted = await prettier.format(output.code, {
        parser: 'babel-ts',
        semi: true,
        singleQuote: false,
        jsxSingleQuote: false,
        trailingComma: 'none',
        printWidth: 80,
        tabWidth: 2,
        useTabs: false,
      });
      await fs.writeFile(file, formatted, 'utf-8');
      */

      await fs.writeFile(file, output.code, 'utf-8');
    }
    return true;
  } else {
    if (process.env.CLISEO_VERBOSE === 'true') {
      console.log(`[cliseo debug] No modifications needed for file: ${file}`);
    }
    return false;
  }
}

async function findReactFiles(dir: string): Promise<string[]> {
  // Only look in the pages directory
  const pagesDir = path.join(dir, 'pages');
  if (!existsSync(pagesDir)) {
    console.log(`No pages directory found at ${pagesDir}`);
    return [];
  }
  
  const files = await glob('**/*.{js,jsx,ts,tsx}', { cwd: pagesDir, absolute: true });
  return files;
}

/**
 * Injects Helmet metadata into all relevant React page files in the project.
 * This skips files that don't appear to be top-level page components.
 */
export async function optimizeReactComponents(projectRoot: string): Promise<void> {
  const srcDir = path.join(projectRoot, 'src');
  const files = await findReactFiles(srcDir);

  if (files.length === 0) {
    if (process.env.CLISEO_VERBOSE === 'true') {
      console.log('No React page files found to optimize.');
    }
    return;
  }

  if (process.env.CLISEO_VERBOSE === 'true') {
    console.log(`Found ${files.length} React page files to optimize:`);
  }
   
  let modifiedCount = 0;
  for (const file of files) {
    if (!isLikelyPageFile(file)) {
      if (process.env.CLISEO_VERBOSE === 'true') console.log(`Skipping: ${path.relative(projectRoot, file)}`);
      continue;
    }

    if (process.env.CLISEO_VERBOSE === 'true') console.log(`Processing: ${path.relative(projectRoot, file)}`);
    try {
      const changed = await transformFile(file);
      if (changed) modifiedCount++;
    } catch (error) {
      console.error(`Failed to transform ${file}: ${error}`);
    }
  }

  const summaryMsg = `React components optimized${modifiedCount ? `: modified ${modifiedCount} file(s)` : ' (no changes needed)'}`;
  console.log(summaryMsg);
} 