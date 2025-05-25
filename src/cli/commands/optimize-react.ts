import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { glob } from 'glob';
import * as babel from '@babel/core';
import * as t from '@babel/types';
import _traverse from "@babel/traverse";
const traverse = _traverse.default;

function findProjectRoot(startDir = process.cwd()) {
  let dir = path.resolve(startDir);
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const helmetImportName = 'Helmet';

const helmetJSXElement = t.jsxElement(
  t.jsxOpeningElement(t.jsxIdentifier('Helmet'), [], false),
  t.jsxClosingElement(t.jsxIdentifier('Helmet')),
  [
    t.jsxElement(
      t.jsxOpeningElement(t.jsxIdentifier('title'), [], false),
      t.jsxClosingElement(t.jsxIdentifier('title')),
      [t.jsxText('Your Site Title')],
      false
    ),
    t.jsxElement(
      t.jsxOpeningElement(
        t.jsxIdentifier('meta'),
        [t.jsxAttribute(t.jsxIdentifier('name'), t.stringLiteral('description')),
         t.jsxAttribute(t.jsxIdentifier('content'), t.stringLiteral('Default description for this page'))],
        true
      ),
      null,
      [],
      true
    ),
    t.jsxElement(
      t.jsxOpeningElement(
        t.jsxIdentifier('link'),
        [t.jsxAttribute(t.jsxIdentifier('rel'), t.stringLiteral('canonical')),
         t.jsxAttribute(t.jsxIdentifier('href'), t.stringLiteral('https://yourdomain.com/current-page'))],
        true
      ),
      null,
      [],
      true
    ),
  ],
  false
);

async function transformFile(file) {
  console.log(`\nProcessing file: ${file}`);

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

  let helmetImported = false;
  let modified = false;

  traverse(ast, {
    Program(path) {
      console.log('Visiting Program node: checking imports...');
      for (const node of path.node.body) {
        if (
          t.isImportDeclaration(node) &&
          node.source.value === 'react-helmet'
        ) {
          helmetImported = true;
          console.log('Found existing react-helmet import.');
          break;
        }
      }

      if (!helmetImported) {
        console.log('No react-helmet import found, adding import.');
        const importDecl = t.importDeclaration(
          [t.importSpecifier(t.identifier(helmetImportName), t.identifier(helmetImportName))],
          t.stringLiteral('react-helmet')
        );
        path.node.body.unshift(importDecl);
        helmetImported = true;
        modified = true;
      }
    },

    FunctionDeclaration(path) {
      console.log(`Found FunctionDeclaration: ${path.node.id?.name || '[anonymous]'}`);

      if (modified) {
        console.log('File already modified; skipping further changes.');
        return;
      }

      path.traverse({
        ReturnStatement(returnPath) {
          console.log(`Visiting ReturnStatement inside FunctionDeclaration ${path.node.id?.name || '[anonymous]'}`);
          const arg = returnPath.node.argument;
          console.log('ReturnStatement argument type:', arg?.type);

          if (t.isJSXElement(arg)) {
            const tagName = getJSXElementName(arg.openingElement.name);
            console.log('JSXElement root tag:', tagName);

            const hasHelmet =
              tagName === 'Helmet' ||
              arg.children.some(child =>
                t.isJSXElement(child) && getJSXElementName(child.openingElement.name) === 'Helmet'
              );

            if (hasHelmet) {
              console.log('Helmet already present inside returned JSX; skipping insertion.');
            } else {
              console.log('Inserting Helmet into function component JSX.');
              arg.children.unshift(helmetJSXElement);
              modified = true;
              returnPath.stop();
              path.stop();
            }
          } else {
            console.log('Return argument is not a JSXElement; skipping.');
          }
        }
      });
    },

    VariableDeclarator(path) {
      if (modified) return;

      if (
        t.isIdentifier(path.node.id) &&
        (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init))
      ) {
        console.log(`Found variable declarator for function component: ${path.node.id.name}`);

        const func = path.node.init;

        if (func.body && t.isJSXElement(func.body)) {
          console.log('Arrow function concise body returning JSXElement.');
          const hasHelmet = func.body.openingElement.name.name === 'Helmet' || func.body.children.some(child =>
            t.isJSXElement(child) && getJSXElementName(child.openingElement.name) === 'Helmet');

          if (hasHelmet) {
            console.log('Helmet already present inside returned JSX; skipping insertion.');
          } else {
            console.log('Inserting Helmet into concise arrow function JSX.');
            func.body.children.unshift(helmetJSXElement);
            modified = true;
          }
        } else if (func.body && t.isBlockStatement(func.body)) {
          console.log('Arrow/function expression with block body; searching return statements.');

          path.get('init').traverse({
            ReturnStatement(returnPath) {
              const arg = returnPath.node.argument;
              console.log('ReturnStatement argument type:', arg?.type);

              if (t.isJSXElement(arg)) {
                const tagName = getJSXElementName(arg.openingElement.name);
                console.log('JSXElement root tag:', tagName);

                const hasHelmet = tagName === 'Helmet' || arg.children.some(child =>
                  t.isJSXElement(child) && getJSXElementName(child.openingElement.name) === 'Helmet'
                );

                if (hasHelmet) {
                  console.log('Helmet already present in return JSX; skipping insertion.');
                } else {
                  console.log('Inserting Helmet into return JSX in function block body.');
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

    ClassDeclaration(path) {
      if (modified) return;

      console.log(`Found ClassDeclaration: ${path.node.id?.name || '[anonymous]'}`);

      const body = path.node.body.body;
      const renderMethod = body.find(
        method =>
          t.isClassMethod(method) &&
          getJSXElementName(method.key) === 'render' &&
          t.isBlockStatement(method.body)
      );

      if (renderMethod) {
        console.log('Found render() method in class component.');

        path.get('body').get('body').forEach(methodPath => {
          if (methodPath.node.key.name === 'render') {
            methodPath.traverse({
              ReturnStatement(returnPath) {
                console.log('Visiting ReturnStatement inside render method.');
                const arg = returnPath.node.argument;

                if (t.isJSXElement(arg)) {
                  const tagName = getJSXElementName(arg.openingElement.name);
                  console.log('JSXElement root tag in render return:', tagName);

                  const hasHelmet = tagName === 'Helmet' || arg.children.some(child =>
                    t.isJSXElement(child) && getJSXElementName(child.openingElement.name) === 'Helmet');

                  if (hasHelmet) {
                    console.log('Helmet already present in render return JSX; skipping.');
                  } else {
                    console.log('Inserting Helmet into render return JSX.');
                    arg.children.unshift(helmetJSXElement);
                    modified = true;
                    returnPath.stop();
                    path.stop();
                  }
                } else {
                  console.log('Render return is not a JSXElement; skipping.');
                }
              }
            });
          }
        });
      } else {
        console.log('No render method found in class component.');
      }
    },
  });

  if (modified) {
    console.log(`Modifications made in file: ${file}, generating new code...`);
    const output = babel.transformFromAstSync(ast, code, {
      plugins: ['@babel/plugin-syntax-jsx', '@babel/plugin-syntax-typescript'],
      generatorOpts: { retainLines: true, compact: false },
    });
    await fs.writeFile(file, output.code, 'utf-8');
    console.log(`Injected Helmet into ${path.relative(findProjectRoot(), file)}`);
  } else {
    console.log(`No modifications necessary for file: ${file}`);
  }
}


export async function injectHelmetInReact() {
  const root = findProjectRoot();
  const srcDir = path.join(root, 'src');
  const files = await glob('**/*.{js,jsx,ts,tsx}', { cwd: srcDir, absolute: true });

  for (const file of files) {
    try {
      await transformFile(file);
    } catch (err) {
      console.error(`Failed to transform ${file}:`, err);
    }
  }
}


function getJSXElementName(node) {
  if (!node) return null;
  if (node.type === 'JSXIdentifier') return node.name;
  if (node.type === 'JSXMemberExpression') {
    return `${getJSXElementName(node.object)}.${getJSXElementName(node.property)}`;
  }
  return null;
}