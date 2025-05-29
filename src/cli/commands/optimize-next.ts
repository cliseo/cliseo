import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import * as babel from '@babel/core';
import * as t from '@babel/types';
import prettier from 'prettier';
import _traverse from "@babel/traverse";
const traverse = _traverse.default;

/**
 * Recursively walks up the directory tree to find the project root.
 * Assumes the root contains a `package.json`.
 * 
 * @param {string} [startDir=process.cwd()] - Directory to start search from
 * @returns {string} - Project root directory path
 */
function findProjectRoot(startDir = process.cwd()) {
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
function isLikelyPageFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/'); 
  return (
    /\/(pages|routes|views)\//.test(normalized) || 
    /(Page|Screen|Route)\.(jsx?|tsx?|js?|ts?)$/.test(path.basename(filePath))
  );
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
function getJSXElementName(name) {
  return t.isJSXIdentifier(name) ? name.name : '';
}

/**
 * Injects next/head tags into a Next.js component file.
 * 
 * @param {string} file - Path to the file to transform
 */
export async function transformFile(file) {
  const code = await fs.readFile(file, 'utf-8');

  const ast = babel.parseSync(code, {
    sourceType: 'module',
    plugins: [
      '@babel/plugin-syntax-jsx',
      [
        '@babel/plugin-syntax-typescript',
        {
          isTSX: true,
          allExtensions: true,
        },
      ],
    ],
  });

  let headImported = false;
  let imageImported = false;
  let modified = false;

  traverse(ast, {
    Program(path) {
      for (const node of path.node.body) {
        if (
          t.isImportDeclaration(node) &&
          node.source.value === 'next/head'
        ) {
          headImported = true;
        }
        if (
          t.isImportDeclaration(node) &&
          node.source.value === 'next/image'
        ) {
          imageImported = true;
        }
      }

      if (!headImported) {
        const importDecl = t.importDeclaration(
          [t.importDefaultSpecifier(t.identifier('Head'))],
          t.stringLiteral('next/head')
        );
        path.node.body.unshift(importDecl);
        headImported = true;
      }
      if (!imageImported) {
        const importDecl = t.importDeclaration(
          [t.importDefaultSpecifier(t.identifier('Image'))],
          t.stringLiteral('next/image')
        );
        path.node.body.unshift(importDecl);
        imageImported = true;
      }
    },

    FunctionDeclaration(path) {
      path.traverse({
        ReturnStatement(returnPath) {
          const arg = returnPath.node.argument;

          if (t.isJSXElement(arg)) {
            const tagName = getJSXElementName(arg.openingElement.name);
            const hasHead = arg.children.some(
              child =>
                t.isJSXElement(child) &&
                getJSXElementName(child.openingElement.name) === 'Head'
            );

            if (!hasHead) {
              arg.children.unshift(seoHeadJSXElement);
              modified = true;
              returnPath.stop();
              path.stop();
            }
          }
        },
      });
    },

    VariableDeclarator(path) {
      if (
        t.isIdentifier(path.node.id) &&
        (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init))
      ) {
        const func = path.node.init;

        if (func.body && t.isJSXElement(func.body)) {
          const hasHead = func.body.children.some(
            child =>
              t.isJSXElement(child) &&
              getJSXElementName(child.openingElement.name) === 'Head'
          );

          if (!hasHead) {
            func.body.children.unshift(seoHeadJSXElement);
            modified = true;
          }
        } else if (t.isBlockStatement(func.body)) {
          path.get('init').traverse({
            ReturnStatement(returnPath) {
              const arg = returnPath.node.argument;

              if (t.isJSXElement(arg)) {
                const hasHead = arg.children.some(
                  child =>
                    t.isJSXElement(child) &&
                    getJSXElementName(child.openingElement.name) === 'Head'
                );

                if (!hasHead) {
                  arg.children.unshift(seoHeadJSXElement);
                  modified = true;
                  returnPath.stop();
                }
              }
            },
          });
        }
      }
    },

    ClassDeclaration(path) {
      const renderMethod = path.node.body.body.find(
        method =>
          t.isClassMethod(method) &&
          getJSXElementName(method.key) === 'render' &&
          t.isBlockStatement(method.body)
      );

      if (renderMethod) {
        path.get('body').get('body').forEach(methodPath => {
          if (methodPath.node.key.name === 'render') {
            methodPath.traverse({
              ReturnStatement(returnPath) {
                const arg = returnPath.node.argument;

                if (t.isJSXElement(arg)) {
                  const hasHead = arg.children.some(
                    child =>
                      t.isJSXElement(child) &&
                      getJSXElementName(child.openingElement.name) === 'Head'
                  );

                  if (!hasHead) {
                    arg.children.unshift(seoHeadJSXElement);
                    modified = true;
                    returnPath.stop();
                  }
                }
              },
            });
          }
        });
      }
    },
    JSXElement(path) {
        const opening = path.node.openingElement;
        const tagName = getJSXElementName(opening.name);

        if (tagName === 'img') {
        // Change tag to Image
        opening.name.name = 'Image';

        // If there's a closing tag
        if (path.node.closingElement) {
            path.node.closingElement.name.name = 'Image';
        }

        // Add width and height if missing
        const existingAttrs = new Set(opening.attributes.map(attr => attr.name?.name));
        if (!existingAttrs.has('width')) {
            opening.attributes.push(
            t.jsxAttribute(t.jsxIdentifier('width'), t.jsxExpressionContainer(t.numericLiteral(500)))
            );
        }
        if (!existingAttrs.has('height')) {
            opening.attributes.push(
            t.jsxAttribute(t.jsxIdentifier('height'), t.jsxExpressionContainer(t.numericLiteral(300)))
            );
        }
        if (!existingAttrs.has('alt')) {
            opening.attributes.push(
            t.jsxAttribute(t.jsxIdentifier('alt'), t.stringLiteral('Image description'))
            );
        }
        modified = true;
      }
    }
  });

  if (modified) {
    console.log(` • Injected SEO optimizations in file: ${file}`);
    const output = babel.transformFromAstSync(ast, code, {
      plugins: ['@babel/plugin-syntax-jsx', '@babel/plugin-syntax-typescript'],
      generatorOpts: { retainLines: true, compact: false },
    });

    const formatted = await prettier.format(output.code, {
      parser: 'babel-ts',
      semi: true,
      singleQuote: false,
      trailingComma: 'none',
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
    });

    await fs.writeFile(file, formatted, 'utf-8');
  }
}

/**
 * Optimizes Next.js components by injecting SEO-friendly <Head> tags.
 */
export async function optimizeNextComponents() {
  const root = findProjectRoot();
  const srcDir = path.join(root, 'src');
  const files = await glob('**/*.{js,jsx,ts,tsx}', { cwd: srcDir, absolute: true });

  for (const file of files) {
    if (!isLikelyPageFile(file)) continue;

    try {
      await transformFile(file);
    } catch (err) {
      console.error(`Failed to transform ${file}:`, err);
    }
  }
}

