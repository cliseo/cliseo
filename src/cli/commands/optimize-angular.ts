import { readFileSync, writeFileSync, existsSync } from 'fs';
import { glob } from 'glob';
import { parseDocument } from 'htmlparser2';
import { DomUtils } from 'htmlparser2';
import { default as render } from 'dom-serializer';
import * as babel from '@babel/core';
import * as t from '@babel/types';
import generate from '@babel/generator';
import traverse from '@babel/traverse';
import { JSDOM } from 'jsdom';
import prettier from 'prettier';

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

/**
 * Updates the NgModule imports to include NgOptimizedImage if necessary.
 * 
 * @param componentArg - The object expression representing the component's metadata.
 */
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

/**
 * Optimizes Angular images by converting <img> tags to use ngOptimizedImage.
 * It also updates the associated TypeScript files to import NgOptimizedImage
 * and adds it to the component's imports if necessary.
 * 
 * @param file - The path to the Angular HTML file to optimize.
 */
export async function optimizeAngularImages(file: string) {
  console.log(`Processing ${file}...`);
  const original = readFileSync(file, 'utf8');
  const dom = parseDocument(original);
  let updated = false;

  // Modify <img> tags
  DomUtils.findAll(elem => {
    if (elem.name === 'img' && elem.attribs && elem.attribs.src) {
      const src = elem.attribs.src;

      if (elem.attribs['ngOptimizedImage']) return false;

      delete elem.attribs.src;
      console.log(` • Converting <img src="${src}"> to ngOptimizedImage in ${file}`);
      elem.attribs['ngOptimizedImage'] = '';
      elem.attribs['[src]'] = `'${src}'`;
      updated = true;
    }
    return false; // Always return boolean
  }, dom.children);

  // TS file variables
  let ast: babel.ParseResult | null = null;
  let tsUpdated = false;
  let tsFile: string | null = null;

  if (updated) {
    // Write updated HTML
    const output = render(dom, { encodeEntities: 'utf8' });
    writeFileSync(file, output, 'utf8');
    console.log(` • Updated ${file} with ngOptimizedImage.`);

    // Attempt to locate associated .ts file
    tsFile = file.replace(/\.html$/, '.ts');
    if (existsSync(tsFile)) {
      const tsCode = readFileSync(tsFile, 'utf8');
      ast = babel.parseSync(tsCode, {
        sourceType: 'module',
        plugins: [
          '@babel/plugin-syntax-typescript',
          ['@babel/plugin-proposal-decorators', { legacy: true }],
        ],
      });
      
      if (!ast) {
        console.error(`Cannot parse ${tsFile}`);
        return;
      }

      // @ts-ignore – traverse typing mismatch under certain module resolutions
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
    }
  }
  
  if (tsUpdated && ast && tsFile) { 
    // @ts-ignore – generate typing mismatch under certain module resolutions
    const updatedCode = generate(ast, {
      retainLines: true,
    }).code;

    // Format the updated TypeScript code
    const formattedCode = await prettier.format(updatedCode, {
      parser: 'babel-ts',
      semi: true,
      singleQuote: false,
      jsxSingleQuote: false,
      trailingComma: 'none',
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
    });
    
    writeFileSync(tsFile, formattedCode, 'utf8');
  }
}

/**
 * Transforms Angular component files to ensure they implement OnInit, and Title and Meta services are injected.
 * 
 * @param file - The path to the Angular component file to transform.
 */
async function transformAngularComponents(file: string) {
  console.log(`Processing ${file}...`);
  const code = readFileSync(file, 'utf-8');
  const ast = babel.parseSync(code, {
    sourceType: 'module',
    plugins: [
      '@babel/plugin-syntax-jsx',
      ['@babel/plugin-syntax-typescript', { isTSX: true, allExtensions: true }],
      ['@babel/plugin-proposal-decorators', { legacy: true }],
    ],
  });

  if (!ast) {
    console.error(`Cannot parse ${file}`);
    return;
  }

  let updated = false;
  let needsSeoLogic = false;

  // @ts-ignore – traverse typing mismatch under certain module resolutions
  traverse(ast, {
    ClassDeclaration(path) {
      // Add implements OnInit if missing
      const hasImplementsOnInit = path.node.implements?.some(
        (impl) =>
          t.isTSExpressionWithTypeArguments(impl) &&
          t.isIdentifier(impl.expression, { name: 'OnInit' })
      );

      if (!hasImplementsOnInit) {
        if (!path.node.implements) path.node.implements = [];
        path.node.implements.push(
          t.tsExpressionWithTypeArguments(t.identifier('OnInit'))
        );
        updated = true;
        needsSeoLogic = true;
      }

      // Ensure constructor injects Title and Meta
      let constructorFound = false;

      path.get('body.body').forEach((childPath) => {
        if (childPath.isClassMethod({ kind: 'constructor' })) {
          constructorFound = true;

          const hasParam = (name: string) =>
            childPath.node.params.some(
              (p) =>
                // constructor parameters could be TSParameterProperty or Identifier with typeAnnotation
                (t.isTSParameterProperty(p) && t.isIdentifier(p.parameter, { name })) ||
                (t.isIdentifier(p) && p.name === name)
            );

          const addParam = (name: string, typeName: string) => {
            const id = t.identifier(name);
            id.typeAnnotation = t.tsTypeAnnotation(
              t.tsTypeReference(t.identifier(typeName))
            );
            const param = t.tsParameterProperty(id);
            param.accessibility = 'private';
            childPath.node.params.push(param);
          };

          if (!hasParam('titleService')) {
            addParam('titleService', 'Title');
            updated = true;
            needsSeoLogic = true;
          }

          if (!hasParam('metaService')) {
            addParam('metaService', 'Meta');
            updated = true;
            needsSeoLogic = true;
          }
        }
      });

      if (!constructorFound) {
        // create constructor with injected Title and Meta
        const titleId = t.identifier('titleService');
        titleId.typeAnnotation = t.tsTypeAnnotation(
          t.tsTypeReference(t.identifier('Title'))
        );

        const metaId = t.identifier('metaService');
        metaId.typeAnnotation = t.tsTypeAnnotation(
          t.tsTypeReference(t.identifier('Meta'))
        );

        const titleParam = t.tsParameterProperty(titleId);
        titleParam.accessibility = 'private';

        const metaParam = t.tsParameterProperty(metaId);
        metaParam.accessibility = 'private';

        const constructorMethod = t.classMethod(
          'constructor',
          t.identifier('constructor'),
          [titleParam, metaParam],
          t.blockStatement([])
        );

        path.node.body.body.unshift(constructorMethod);
        updated = true;
        needsSeoLogic = true;
      }

      // Add or update ngOnInit method
      const ngOnInitMethod = path.node.body.body.find(
        (m) => t.isClassMethod(m) && t.isIdentifier(m.key, { name: 'ngOnInit' })
      );

      const titleSetCall = t.expressionStatement(
        t.callExpression(
          t.memberExpression(
            t.memberExpression(t.thisExpression(), t.identifier('titleService')),
            t.identifier('setTitle')
          ),
          [t.stringLiteral('Example Page')]
        )
      );

      const metaUpdateCall = t.expressionStatement(
        t.callExpression(
          t.memberExpression(
            t.memberExpression(t.thisExpression(), t.identifier('metaService')),
            t.identifier('updateTag')
          ),
          [
            t.objectExpression([
              t.objectProperty(t.identifier('name'), t.stringLiteral('description')),
              t.objectProperty(t.identifier('content'), t.stringLiteral('This is an example page for SEO.')),
            ]),
          ]
        )
      );

      if (ngOnInitMethod) {
        const body = (ngOnInitMethod as t.ClassMethod).body.body;

        const hasTitleCall = body.some(
          (stmt) =>
            t.isExpressionStatement(stmt) &&
            t.isCallExpression(stmt.expression) &&
            t.isMemberExpression(stmt.expression.callee) &&
            t.isIdentifier(stmt.expression.callee.property, { name: 'setTitle' })
        );

        const hasMetaCall = body.some(
          (stmt) =>
            t.isExpressionStatement(stmt) &&
            t.isCallExpression(stmt.expression) &&
            t.isMemberExpression(stmt.expression.callee) &&
            t.isIdentifier(stmt.expression.callee.property, { name: 'updateTag' })
        );

        if (!hasTitleCall) {
          body.push(titleSetCall);
          updated = true;
          needsSeoLogic = true;
        }
        if (!hasMetaCall) {
          body.push(metaUpdateCall);
          updated = true;
          needsSeoLogic = true;
        }
      } else {
        const method = t.classMethod(
          'method',
          t.identifier('ngOnInit'),
          [],
          t.blockStatement([titleSetCall, metaUpdateCall])
        );
        method.returnType = t.tsTypeAnnotation(t.tsVoidKeyword());
        path.node.body.body.push(method);
        updated = true;
        needsSeoLogic = true;
      }
    },

    Program: {
      exit(path) {
        if (!needsSeoLogic) return;

        // Add imports only if needed

        // Import Title & Meta
        const hasTitleMetaImport = path.node.body.some(
          (n) =>
            t.isImportDeclaration(n) &&
            n.source.value === '@angular/platform-browser'
        );

        if (!hasTitleMetaImport) {
          path.node.body.unshift(
            t.importDeclaration(
              [
                t.importSpecifier(t.identifier('Title'), t.identifier('Title')),
                t.importSpecifier(t.identifier('Meta'), t.identifier('Meta')),
              ],
              t.stringLiteral('@angular/platform-browser')
            )
          );
          updated = true;
        }

        // Ensure OnInit is imported
        const hasOnInitImport = path.node.body.some(
          (n) =>
            t.isImportDeclaration(n) &&
            n.source.value === '@angular/core' &&
            n.specifiers.some(
              (s) =>
                t.isImportSpecifier(s) &&
                t.isIdentifier(s.imported, { name: 'OnInit' })
            )
        );

        if (!hasOnInitImport) {
          const angularCoreImport = path.node.body.find(
            (n) =>
              t.isImportDeclaration(n) && n.source.value === '@angular/core'
          );

          if (angularCoreImport && t.isImportDeclaration(angularCoreImport)) {
            angularCoreImport.specifiers.push(
              t.importSpecifier(t.identifier('OnInit'), t.identifier('OnInit'))
            );
          } else {
            path.node.body.unshift(
              t.importDeclaration(
                [t.importSpecifier(t.identifier('OnInit'), t.identifier('OnInit'))],
                t.stringLiteral('@angular/core')
              )
            );
          }
          updated = true;
        }
      },
    },
  });

  if (updated) {
    // @ts-ignore – generate typing mismatch under certain module resolutions
    const output = generate(
      ast,
      {
        retainLines: true,
        retainFunctionParens: true,
      },
      code
    );
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
    writeFileSync(file, formatted, 'utf-8');
    console.log(` • Updated ${file} with Angular SEO optimizations.`);
  }
}

/**
 * Optimizes Angular project components by ensuring proper title tags, meta tags, and image optimizations.
 **/
export async function optimizeAngularComponents() {
  const htmlFiles = glob.sync('src/app/pages/**/*.html');

  for (const file of htmlFiles) {
    try {
      await optimizeAngularImages(file);
    } catch (err) {
      console.error(`Error processing ${file}:`, err);
    }
  }

  const tsFiles = glob.sync('src/app/pages/**/*.component.ts');

  for (const file of tsFiles) {
    try {
      await transformAngularComponents(file);
    } catch (err) {
      console.error(`Error processing ${file}:`, err);
    }
  }
}


