import * as fs from 'fs/promises';
import * as nodePath from 'path';
import { glob } from 'glob';
import * as babel from '@babel/core';
import _generate from '@babel/generator';
import * as t from '@babel/types';
import prettier from 'prettier';
import chalk from 'chalk';
import ora from 'ora';
import { JSDOM } from 'jsdom';

const generate = (_generate as any).default || _generate;
const HELMET_PACKAGE = 'react-helmet-async';

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

function isLikelyPage(filePath: string): boolean {
  // Normalize path to use forward slashes for consistent regex matching
  const normalizedPath = filePath.replace(/\\/g, '/');
  const dir = nodePath.dirname(normalizedPath);
  const base = nodePath.basename(normalizedPath);

  // Exclude files in any 'components' directory
  if (dir.includes('/components')) {
    return false;
  }

  // Exclude the typical main entry file name
  if (base.startsWith('main.')) {
    return false;
  }

  // Check if the file is inside a standard page directory ('pages', 'views', 'routes')
  // The regex looks for these as complete directory names in the path.
  if (/\/pages\b|\/views\b|\/routes\b/.test(dir)) {
    return true;
  }
  
  // As a fallback, check for common page naming conventions like 'Home.tsx' or 'AboutPage.jsx'
  if (base.toLowerCase().includes('home') || /Page\.(tsx|jsx)$/.test(base)) {
    return true;
  }

  return false;
}

async function getEntryPoint(projectRoot: string): Promise<string | null> {
    const htmlPath = nodePath.join(projectRoot, 'index.html');
    if (!(await fileExists(htmlPath))) {
        console.log(chalk.yellow("Could not find index.html in the project root."));
        return null;
    }

    const htmlContent = await fs.readFile(htmlPath, 'utf-8');
    const dom = new JSDOM(htmlContent);
    const scriptTags = dom.window.document.querySelectorAll('script[type="module"][src]');
    
    for (const scriptTag of scriptTags) {
        const src = scriptTag.getAttribute('src')!;
        if (!src.startsWith('http') && !src.startsWith('//')) {
            // This is a local script. Resolve its full path.
            const entryPath = nodePath.join(projectRoot, src.startsWith('/') ? src.slice(1) : src);
            return entryPath;
        }
    }
    
    console.log(chalk.yellow("Could not find a local module script tag in index.html to identify the entry point."));
    return null;
}

async function transformEntryPoint(filePath: string): Promise<boolean> {
  const source = await fs.readFile(filePath, 'utf-8');
  const ast = await babel.parseAsync(source, {
    filename: filePath,
    sourceType: 'module',
    presets: ['@babel/preset-typescript', ['@babel/preset-react', { runtime: 'automatic' }]],
  });

  if (!ast) return false;
  let modified = false;

  babel.traverse(ast, {
    Program(path) {
      const hasHelmetProviderImport = path.node.body.some(
        (stmt) =>
          t.isImportDeclaration(stmt) &&
          stmt.source.value === HELMET_PACKAGE &&
          stmt.specifiers.some(
            (spec) => t.isImportSpecifier(spec) && t.isIdentifier(spec.imported) && spec.imported.name === 'HelmetProvider'
          )
      );

      if (!hasHelmetProviderImport) {
        const importDecl = t.importDeclaration(
          [t.importSpecifier(t.identifier('HelmetProvider'), t.identifier('HelmetProvider'))],
          t.stringLiteral(HELMET_PACKAGE)
        );
        path.unshiftContainer('body', importDecl);
        modified = true;
      }
    },
    CallExpression(path) {
      const callee = path.get('callee');
      if (callee.matchesPattern('ReactDOM.createRoot') || callee.matchesPattern('ReactDOM.render')) {
        const renderMethod = path.parentPath;
        if (renderMethod.isCallExpression() && t.isMemberExpression(renderMethod.node.callee) && t.isIdentifier(renderMethod.node.callee.property, { name: 'render' })) {
          const appElement = renderMethod.node.arguments[0];

          if (t.isJSXElement(appElement) && t.isJSXIdentifier(appElement.openingElement.name) && appElement.openingElement.name.name === 'HelmetProvider') {
            return;
          }

          const helmetProvider = t.jsxElement(
            t.jsxOpeningElement(t.jsxIdentifier('HelmetProvider'), [], false),
            t.jsxClosingElement(t.jsxIdentifier('HelmetProvider')),
            [t.jsxText('\n'), appElement as any, t.jsxText('\n')],
            false
          );
          
          renderMethod.node.arguments[0] = helmetProvider;
          modified = true;
        }
      }
    },
  });

  if (modified) {
    const { code } = generate(ast, { retainLines: true });
    const formatted = await prettier.format(code, { parser: 'typescript', singleQuote: true });
    await fs.writeFile(filePath, formatted);
    return true;
  }

  return false;
}

async function transformPageFile(filePath: string, projectName: string): Promise<boolean> {
    const source = await fs.readFile(filePath, 'utf-8');
    const ast = await babel.parseAsync(source, {
        filename: filePath,
        sourceType: 'module',
        presets: ['@babel/preset-typescript', ['@babel/preset-react', { runtime: 'automatic' }]],
    });

    if (!ast) return false;
    let modified = false;
    const fileName = nodePath.basename(filePath);

    const pageName = nodePath.basename(filePath, nodePath.extname(filePath));
    const title = `${pageName.charAt(0).toUpperCase() + pageName.slice(1)} | ${projectName}`;
    const description = `This is the ${pageName} page for ${projectName}.`;

    const schemaData = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description: description,
      // NOTE: The URL is a placeholder as it cannot be known at build time.
      // A more advanced implementation might use environment variables.
      url: `https://your-domain.com/${pageName.toLowerCase()}`,
    };

    const helmetElement = t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('Helmet'), [], false),
        t.jsxClosingElement(t.jsxIdentifier('Helmet')),
        [
            t.jsxText('\n    '),
            t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('title'), [], false), t.jsxClosingElement(t.jsxIdentifier('title')), [t.jsxText(title)]),
            t.jsxText('\n    '),
            t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('meta'), [t.jsxAttribute(t.jsxIdentifier('name'), t.stringLiteral('description')), t.jsxAttribute(t.jsxIdentifier('content'), t.stringLiteral(description))], true), null, [], true),
            t.jsxText('\n    '),
            t.jsxElement(
                t.jsxOpeningElement(
                    t.jsxIdentifier('script'),
                    [t.jsxAttribute(t.jsxIdentifier('type'), t.stringLiteral('application/ld+json'))],
                    false
                ),
                t.jsxClosingElement(t.jsxIdentifier('script')),
                [t.jsxText(JSON.stringify(schemaData, null, 2))]
            ),
            t.jsxText('\n'),
        ]
    );

    babel.traverse(ast, {
        Program(path) {
            let helmetImported = false;
            path.get('body').forEach(nodePath => {
                if (nodePath.isImportDeclaration()) {
                    const source = nodePath.node.source.value;
                    if (source === 'react-helmet') {
                        nodePath.node.source.value = HELMET_PACKAGE; // Upgrade from react-helmet
                        modified = true;
                        helmetImported = true;
                    } else if (source === HELMET_PACKAGE) {
                        helmetImported = true;
                    }
                }
            });

            if (!helmetImported) {
                path.unshiftContainer('body', t.importDeclaration([t.importSpecifier(t.identifier('Helmet'), t.identifier('Helmet'))], t.stringLiteral(HELMET_PACKAGE)));
                modified = true;
            }
        },
        JSXElement(path) {
            if (t.isJSXIdentifier(path.node.openingElement.name, { name: 'Helmet' })) {
                // Found an existing Helmet component, replace its children
                path.node.children = helmetElement.children;
                modified = true;
                path.stop(); // Stop traversal once we've updated the Helmet component
            }
        },
        ReturnStatement(path) {
            // This visitor runs after the JSXElement visitor. 
            // If we've already modified a Helmet component, we don't need to do anything here.
            if (modified) return;

            if (path.findParent(p => p.isFunction())) {
                const arg = path.node.argument;
                if (arg && (t.isJSXElement(arg) || t.isJSXFragment(arg))) {
                    arg.children.unshift(t.jsxText('\n'), helmetElement, t.jsxText('\n'));
                    modified = true;
                }
            }
        }
    });

    if (modified) {
        const { code } = generate(ast, { retainLines: true });
        const formatted = await prettier.format(code, { parser: 'typescript', singleQuote: true });
        await fs.writeFile(filePath, formatted);
        return true;
    }
    return false;
}


export async function optimizeReactComponents(projectRoot: string): Promise<void> {
  const spinner = ora('Optimizing React components...').start();
  
  const pkgPath = nodePath.join(projectRoot, 'package.json');
  if (!(await fileExists(pkgPath))) {
    spinner.fail(chalk.red('Could not find package.json. Aborting optimization.'));
    return;
  }

  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  if (!deps[HELMET_PACKAGE]) {
    spinner.fail(chalk.red.bold(`'${HELMET_PACKAGE}' is required for React SEO optimization.`));
    console.log(chalk.yellow(`Please install it by running: npm install ${HELMET_PACKAGE} or yarn add ${HELMET_PACKAGE}`));
    return;
  }

  const entryPoint = await getEntryPoint(projectRoot);
  if (!entryPoint) {
      spinner.fail(chalk.red("Failed to find the project's entry point."));
      return;
  }
  
  spinner.text = 'Injecting HelmetProvider into entry point...';
  const providerInjected = await transformEntryPoint(entryPoint);
  if (providerInjected) {
      spinner.succeed(chalk.green(`Successfully injected HelmetProvider into ${nodePath.basename(entryPoint)}.`));
  } else {
      spinner.warn(chalk.yellow(`HelmetProvider already configured or no changes needed in ${nodePath.basename(entryPoint)}.`));
  }

  spinner.start('Finding and optimizing page components...');
  const files = await glob('src/**/*.{ts,tsx,js,jsx}', { cwd: projectRoot, absolute: true, ignore: '**/node_modules/**' });
  const pageFiles = files.filter(isLikelyPage).filter((f) => f !== entryPoint);

  if (pageFiles.length === 0) {
    spinner.warn(chalk.yellow('No page components found to optimize.'));
    return;
  }
  
  spinner.info(`Found ${pageFiles.length} page components to optimize.`);

  let modifiedCount = 0;
  for (const file of pageFiles) {
    spinner.text = `Optimizing ${nodePath.basename(file)}...`;
    if (await transformPageFile(file, pkg.name || 'Your App')) {
      modifiedCount++;
    }
  }

  if (modifiedCount > 0) {
    spinner.succeed(chalk.green.bold(`Successfully optimized ${modifiedCount} page components.`));
  } else {
    spinner.warn(chalk.yellow('No page components were modified.'));
  }
}