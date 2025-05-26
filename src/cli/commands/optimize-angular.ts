import fs from 'fs/promises';
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import * as babel from '@babel/core';
import * as t from '@babel/types';
import { generate } from '@babel/generator';
import _traverse from '@babel/traverse';
const traverse = _traverse.default;

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
      console.log(`✅ Updated ${file} with Angular SEO optimizations.`);
    }
  });
}
