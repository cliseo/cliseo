import { readFileSync, writeFileSync, existsSync } from 'fs';
import * as fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import * as babel from '@babel/core';
import _traverse, { NodePath } from '@babel/traverse';
import _generate from '@babel/generator';
import * as t from '@babel/types';
import chalk from 'chalk';
import * as cheerio from 'cheerio';
import * as prettier from 'prettier';
import ora from 'ora';

const traverse = (_traverse as any).default || _traverse;
const generate = (_generate as any).default || _generate;

const SEO_IMPORTS = {
    OnInit: '@angular/core',
    Title: '@angular/platform-browser',
    Meta: '@angular/platform-browser',
    Renderer2: '@angular/core',
    Inject: '@angular/core',
    DOCUMENT: '@angular/common',
    NgOptimizedImage: '@angular/common',
    RouterLink: '@angular/router',
};

const META_SERVICE_NAME = 'meta';
const TITLE_SERVICE_NAME = 'title';

// Main function to orchestrate the optimization of an Angular project
export async function optimizeAngular(projectDir: string): Promise<void> {
    console.log(chalk.blue('Optimizing Angular project...'));
    const componentTsFiles = await glob('src/app/**/*.component.ts', {
        cwd: projectDir,
        absolute: true,
        ignore: ['**/node_modules/**'],
    });

    let modifiedCount = 0;
    for (const tsFile of componentTsFiles) {
        const modified = await processComponent(tsFile);
        if (modified) {
            modifiedCount++;
        }
    }

    if (modifiedCount > 0) {
        console.log(chalk.green.bold(`\nSuccessfully optimized ${modifiedCount} Angular components.`));
  } else {
        console.log(chalk.yellow('No Angular components required modification.'));
    }
}

// Processes a single component file (.ts) and its corresponding template (.html)
async function processComponent(tsFilePath: string): Promise<boolean> {
    const tsCode = await fs.readFile(tsFilePath, 'utf8');
    const ast = babel.parse(tsCode, { sourceType: 'module', plugins: ['typescript', 'decorators'] });

    let tsModified = false;
    let htmlModified = false;
    let templateUrl = '';

    if (ast) {
        traverse(ast, {
            Decorator(decoratorPath) {
                const decoratorNode = decoratorPath.node;
                if (t.isCallExpression(decoratorNode.expression) && t.isIdentifier(decoratorNode.expression.callee) && decoratorNode.expression.callee.name === 'Component') {
                    const componentOptions = decoratorNode.expression.arguments[0];
                    if (t.isObjectExpression(componentOptions)) {
                        const templateUrlProp = componentOptions.properties.find(p => t.isObjectProperty(p) && t.isIdentifier(p.key) && p.key.name === 'templateUrl');
                        if (templateUrlProp && t.isObjectProperty(templateUrlProp) && t.isStringLiteral(templateUrlProp.value)) {
                            templateUrl = path.resolve(path.dirname(tsFilePath), templateUrlProp.value.value);
                        }
                    }
                }
            },
            ClassDeclaration(path) {
                if (isAngularComponent(path)) {
                    if (updateClass(path)) {
                        tsModified = true;
                    }
                }
            },
        });
    }

    if (templateUrl && existsSync(templateUrl)) {
        htmlModified = await updateTemplate(templateUrl);
    }

    if (tsModified) {
        const { code } = generate(ast, { retainLines: true });
        const formattedCode = await prettier.format(code, { parser: 'typescript', semi: false, singleQuote: true });
        await fs.writeFile(tsFilePath, formattedCode, 'utf8');
        console.log(chalk.green(` • Updated component logic: ${path.basename(tsFilePath)}`));
    }
    
    return tsModified || htmlModified;
}

// Updates the TypeScript class (.ts) for SEO
function updateClass(classPath: NodePath<t.ClassDeclaration>): boolean {
    let modified = false;

    // 1. Ensure class implements OnInit
    const implementsOnInit = classPath.node.implements?.some(impl => t.isTSExpressionWithTypeArguments(impl) && t.isIdentifier(impl.expression) && impl.expression.name === 'OnInit') ?? false;
    if (!implementsOnInit) {
        const onInitIdentifier = t.tsExpressionWithTypeArguments(t.identifier('OnInit'));
        if (classPath.node.implements) {
            classPath.node.implements.push(onInitIdentifier);
        } else {
            classPath.node.implements = [onInitIdentifier];
        }
        modified = true;
    }

    // 2. Inject services in constructor
    const servicesToInject = { title: 'Title', meta: 'Meta', renderer: 'Renderer2' };
    let constructorPath = classPath.get('body').get('body').find(p => p.isClassMethod({ kind: 'constructor' })) as NodePath<t.ClassMethod> | undefined;

    if (!constructorPath) {
        const newConstructor = t.classMethod('constructor', t.identifier('constructor'), [], t.blockStatement([]));
        classPath.get('body').unshiftContainer('body', newConstructor);
        constructorPath = classPath.get('body').get('body')[0] as NodePath<t.ClassMethod>;
        modified = true;
    }
    
    Object.entries(servicesToInject).forEach(([propName, serviceName]) => {
        const alreadyInjected = constructorPath.node.params.some(p => {
            if (t.isTSParameterProperty(p)) {
                const identifier = p.parameter;
                if (t.isIdentifier(identifier)) {
                    return identifier.name === propName;
                }
            }
            return false;
        });

        if (!alreadyInjected) {
            const paramId = t.identifier(propName);
            paramId.typeAnnotation = t.tsTypeAnnotation(t.tsTypeReference(t.identifier(serviceName)));
            
            const param = t.tsParameterProperty(paramId);
            param.accessibility = 'public';

            constructorPath.node.params.push(param);
            modified = true;
        }
    });

    const hasDocumentInjection = constructorPath.node.params.some(p => t.isTSParameterProperty(p) && p.parameter.decorators?.some(d => t.isCallExpression(d.expression) && t.isIdentifier(d.expression.callee) && d.expression.callee.name === 'Inject'));
    if (!hasDocumentInjection) {
        const docIdentifier = t.identifier('document');
        docIdentifier.typeAnnotation = t.tsTypeAnnotation(t.tsTypeReference(t.identifier('Document')));

        const docParam = t.tsParameterProperty(docIdentifier);
        docParam.accessibility = 'private';
        docParam.decorators = [t.decorator(t.callExpression(t.identifier('Inject'), [t.identifier('DOCUMENT')]))];
        
        constructorPath.node.params.push(docParam);
        modified = true;
    }

    // 3. Create or update ngOnInit for meta tags
    let ngOnInitPath = classPath.get('body').get('body').find(p => {
        return p.isClassMethod({ kind: 'method' }) && t.isIdentifier(p.node.key) && p.node.key.name === 'ngOnInit';
    }) as NodePath<t.ClassMethod> | undefined;

    if (!ngOnInitPath) {
        const newNgOnInit = t.classMethod('method', t.identifier('ngOnInit'), [], t.blockStatement([]));
        constructorPath.insertAfter(newNgOnInit);
        ngOnInitPath = constructorPath.getNextSibling() as NodePath<t.ClassMethod>;
        modified = true;
    }

    const tags = [
        `this.title.setTitle('SEO Optimized Title');`,
        `this.meta.addTag({ name: 'description', content: 'SEO Description' });`,
        `this.meta.addTag({ name: 'robots', content: 'index, follow' });`,
        `this.meta.addTag({ rel: 'canonical', href: 'https://your-domain.com/page' });`,
        `this.meta.addTag({ property: 'og:title', content: 'Open Graph Title' });`,
        `this.meta.addTag({ property: 'og:description', content: 'Open Graph Description' });`,
        `this.meta.addTag({ name: 'twitter:card', content: 'summary_large_image' });`,
        `this.meta.addTag({ name: 'twitter:title', content: 'Twitter Title' });`,
    ];

    const existingStatements = ngOnInitPath.get('body').get('body').map(stmt => generate(stmt).code);
    tags.forEach(tagCode => {
        if (!existingStatements.some(s => s.includes(tagCode.slice(0, -1)))) {
            ngOnInitPath.get('body').pushContainer('body', t.expressionStatement(t.identifier(tagCode)));
            modified = true;
        }
    });

    const ngOnInitSource = generate(ngOnInitPath.node).code;
    if (!ngOnInitSource.includes("createElement('script')")) {
        const jsonLdObject = {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Your Site Name",
            "url": "https://your-domain.com/"
        };

        const jsonLdAstNodes = [
            t.variableDeclaration('const', [
                t.variableDeclarator(
                    t.identifier('script'),
                    t.callExpression(
                        t.memberExpression(t.memberExpression(t.thisExpression(), t.identifier('renderer')), t.identifier('createElement')),
                        [t.stringLiteral('script')]
                    )
                )
            ]),
            t.expressionStatement(t.callExpression(
                t.memberExpression(t.memberExpression(t.thisExpression(), t.identifier('renderer')), t.identifier('setAttribute')),
                [t.identifier('script'), t.stringLiteral('type'), t.stringLiteral('application/ld+json')]
            )),
            t.expressionStatement(t.assignmentExpression(
                '=',
                t.memberExpression(t.identifier('script'), t.identifier('textContent')),
                t.stringLiteral(JSON.stringify(jsonLdObject, null, 2))
            )),
            t.expressionStatement(t.callExpression(
                t.memberExpression(t.memberExpression(t.thisExpression(), t.identifier('renderer')), t.identifier('appendChild')),
                [t.memberExpression(t.memberExpression(t.thisExpression(), t.identifier('document')), t.identifier('head')), t.identifier('script')]
            ))
        ];
        jsonLdAstNodes.forEach(node => {
            ngOnInitPath.get('body').pushContainer('body', node);
        });
        modified = true;
    }

    // 4. Add imports if they don't exist
    const programPath = classPath.findParent(p => p.isProgram()) as NodePath<t.Program>;
    if (programPath) {
        Object.entries(SEO_IMPORTS).forEach(([name, source]) => {
            addImportIfNeeded(programPath, source, name);
        });
    }

    return modified;
}

// Updates the HTML template (.html) for SEO
async function updateTemplate(templatePath: string): Promise<boolean> {
    let html = await fs.readFile(templatePath, 'utf8');
    const $ = cheerio.load(html, { xmlMode: true });
    let modified = false;

    // 1. Modernize <img> tags
    $('img').each((i, el) => {
        const img = $(el);
        if (img.attr('src') && !img.attr('ngSrc')) {
            img.attr('ngSrc', img.attr('src'));
            img.removeAttr('src');
            img.attr('width', '500'); // Placeholder
            img.attr('height', '300'); // Placeholder
            modified = true;
        }
        if (!img.attr('alt')) {
            img.attr('alt', 'Placeholder alt text');
            modified = true;
        }
    });

    // 2. Modernize <a> tags
    $('a[href^="/"]').each((i, el) => {
        const link = $(el);
        if (!link.attr('routerLink')) {
            link.attr('routerLink', link.attr('href'));
            link.removeAttr('href');
            modified = true;
        }
    });

    if (modified) {
        const newHtml = $.html();
        const formattedHtml = await prettier.format(newHtml, {
            parser: 'html',
        });
        await fs.writeFile(templatePath, formattedHtml, 'utf8');
        console.log(chalk.green(` • Modernized template: ${path.basename(templatePath)}`));
    }

    return modified;
}

// Helper to add a TypeScript import if it's missing
function addImportIfNeeded(programPath: NodePath<t.Program>, moduleName: string, importName: string) {
    let importExists = false;
    programPath.get('body').forEach(nodePath => {
        if (nodePath.isImportDeclaration() && nodePath.node.source.value === moduleName) {
            const hasSpecifier = nodePath.node.specifiers.some(spec => t.isImportSpecifier(spec) && t.isIdentifier(spec.local) && spec.local.name === importName);
            if(hasSpecifier) {
                importExists = true;
            }
        }
    });

    if (!importExists) {
        let importDeclaration = programPath.get('body').find(p => p.isImportDeclaration() && p.node.source.value === moduleName) as NodePath<t.ImportDeclaration> | undefined;
        
        if (importDeclaration) { // Module imported, but not the specifier
            importDeclaration.node.specifiers.push(t.importSpecifier(t.identifier(importName), t.identifier(importName)));
        } else { // Module not imported at all
            programPath.unshiftContainer('body', t.importDeclaration(
                [t.importSpecifier(t.identifier(importName), t.identifier(importName))],
                t.stringLiteral(moduleName)
            ));
        }
    }
}

function isAngularComponent(path: NodePath<t.ClassDeclaration>): boolean {
    return path.node.decorators?.some(d => 
        t.isCallExpression(d.expression) &&
        t.isIdentifier(d.expression.callee) &&
        d.expression.callee.name === 'Component'
    ) ?? false;
} 