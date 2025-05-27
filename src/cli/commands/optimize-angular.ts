import fs from 'fs/promises';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { glob } from 'glob';
import { parseDocument } from 'htmlparser2';
import { DomUtils } from 'htmlparser2';
import { default as render } from 'dom-serializer';
import * as babel from '@babel/core';
import * as t from '@babel/types';
import { generate } from '@babel/generator';
import _traverse from '@babel/traverse';
const traverse = _traverse.default;

/**
 * Checks if the given component argument is a standalone Angular component.
 * 
 * @param {t.ObjectExpression} componentArg - The object expression representing the component's metadata.
 * @returns {boolean} - True if the component is standalone, false otherwise.
 */
function isStandaloneComponent(componentArg: t.ObjectExpression): boolean {
  return componentArg.properties.some(
    (prop) =>
      t.isObjectProperty(prop) &&
      t.isIdentifier(prop.key, { name: 'standalone' }) &&
      t.isBooleanLiteral(prop.value, { value: true })
  );
}


function updateNgModuleImports(componentArg: t.ObjectExpression) {
  // Find the 'imports' property, narrowing type to ObjectProperty
  const importsProp = componentArg.properties.find(
    (p): p is t.ObjectProperty =>
      t.isObjectProperty(p) &&
      t.isIdentifier(p.key, { name: 'imports' })
  );

  if (importsProp) {
    // importsProp.value must be an ArrayExpression to add new imports
    if (t.isArrayExpression(importsProp.value)) {
      // Example: add NgOptimizedImage to the imports array if not already there
      const hasNgOptimizedImage = importsProp.value.elements.some(el =>
        t.isIdentifier(el, { name: 'NgOptimizedImage' })
      );

      if (!hasNgOptimizedImage) {
        importsProp.value.elements.push(t.identifier('NgOptimizedImage'));
      }
    }
  } else {
    // No imports property found — create one
    const newImportsProp = t.objectProperty(
      t.identifier('imports'),
      t.arrayExpression([t.identifier('NgOptimizedImage')])
    );
    componentArg.properties.push(newImportsProp);
  }
}

export function optimizeAngularImages() {
  const files = glob.sync('src/app/**/*.html');

  files.forEach((file) => {
    const original = readFileSync(file, 'utf8');
    const dom = parseDocument(original);
    let updated = false;

    // Modify <img> tags
    DomUtils.findAll(elem => {
      if (elem.name === 'img' && elem.attribs && elem.attribs.src) {
        const src = elem.attribs.src;

        if (elem.attribs['ngOptimizedImage']) return false;

        delete elem.attribs.src;
        elem.attribs['ngOptimizedImage'] = '';
        elem.attribs['[src]'] = `'${src}'`;
        updated = true;
      }
    }, dom.children);

    if (updated) {
      // Write updated HTML
      const output = render(dom, { encodeEntities: 'utf8' });
      writeFileSync(file, output, 'utf8');
      console.log(`Updated ${file} with ngOptimizedImage.`);

      // Attempt to locate associated .ts file
      const tsFile = file.replace(/\.html$/, '.ts');
      if (existsSync(tsFile)) {
        const tsCode = readFileSync(tsFile, 'utf8');
        const ast = babel.parseSync(tsCode, {
          sourceType: 'module',
          plugins: [
            '@babel/plugin-syntax-typescript',
            ['@babel/plugin-proposal-decorators', { legacy: true }],
          ],
        });

        let tsUpdated = false;

        traverse(ast, {
          Program(path) {
            const hasNgOptimizedImageImport = path.node.body.some(
              (n) =>
                t.isImportDeclaration(n) &&
                n.source.value === '@angular/common' &&
                n.specifiers.some(
                  (s) =>
                    t.isImportSpecifier(s) &&
                    t.isIdentifier(s.imported) && s.imported.name === 'NgOptimizedImage'
                )
            );

            if (!hasNgOptimizedImageImport) {
              path.node.body.unshift(
                t.importDeclaration(
                  [
                    t.importSpecifier(
                      t.identifier('NgOptimizedImage'),
                      t.identifier('NgOptimizedImage')
                    ),
                  ],
                  t.stringLiteral('@angular/common')
                )
              );
              tsUpdated = true;
            }
          },
          ClassDeclaration(path) {
            const decorators = path.node.decorators;
            if (!decorators) return;

            decorators.forEach((decorator) => {
              if (
                t.isDecorator(decorator) &&
                t.isCallExpression(decorator.expression) &&
                t.isIdentifier(decorator.expression.callee, { name: 'Component' })
              ) {
                const componentArg = decorator.expression.arguments[0];
                if (!t.isObjectExpression(componentArg)) return;

                if (isStandaloneComponent(componentArg)) {
                  updateNgModuleImports(componentArg); // only if standalone
                  tsUpdated = true;
                }
              }
            });
          }
        });

        if (tsUpdated) {
          const updatedCode = generate(ast, {
            retainLines: true,
            quotes: 'single',
          }).code;
          writeFileSync(tsFile, updatedCode, 'utf8');
        }
      }
    }
  });
}

export async function optimizeAngularComponents() {
  const files = glob.sync('src/app/**/*.ts');

  files.forEach((file) => {
    const code = readFileSync(file, 'utf-8');
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
        [
          '@babel/plugin-proposal-decorators',
          {
            legacy: true,
          },
        ],
      ],
    });

    let updated = false;

    traverse(ast, {
      Program(path) {
        const hasImport = path.node.body.some(
          (n) =>
            t.isImportDeclaration(n) &&
            n.source.value === '@angular/platform-browser'
        );

        if (!hasImport) {
          path.node.body.unshift(
            t.importDeclaration(
              [
                t.importSpecifier(
                  t.identifier('Title'),
                  t.identifier('Title')
                ),
                t.importSpecifier(t.identifier('Meta'), t.identifier('Meta')),
              ],
              t.stringLiteral('@angular/platform-browser')
            )
          );
          updated = true;
        }
      },

      ClassMethod(path) {
        if (path.node.kind !== 'constructor') return;

        const hasParam = (name) =>
          path.node.params.some((p) =>
            t.isTSParameterProperty(p) &&
            t.isIdentifier(p.parameter) &&
            p.parameter.name === name
          );

        const addParam = (name, typeName) => {
            const id = t.identifier(name);
            id.typeAnnotation = t.tsTypeAnnotation(
            t.tsTypeReference(t.identifier(typeName))
            );

            const param = t.tsParameterProperty(id);
            param.accessibility = 'private';

            path.node.params.push(param);

        };

        if (!hasParam('titleService')) {
          addParam('titleService', 'Title');
          updated = true;
        }

        if (!hasParam('metaService')) {
          addParam('metaService', 'Meta');
          updated = true;
        }
      },
    });

    if (updated) {
      const output = generate(
        ast,
        {
          retainLines: true,
          quotes: 'single',
          jsonCompatibleStrings: true,
          jsescOption: { minimal: true },
        },
        code
      );
      writeFileSync(file, output.code, 'utf-8');
      console.log(`Updated ${file} with Angular SEO optimizations.`);
    }
  });
}
