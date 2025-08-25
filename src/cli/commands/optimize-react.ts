import { readFileSync, writeFileSync, existsSync } from 'fs';
import * as fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import * as t from '@babel/types';
import { execSync } from 'child_process';
import chalk from 'chalk';

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
  
  // If it's in a pages/routes/views directory, it's likely a page
  if (/\/(pages|routes|views)\//.test(normalized)) {
    // Exclude main entry files like App.tsx, App.jsx, index.tsx, index.jsx in pages dir
    if (/^(App|index)\.(jsx?|tsx?)$/.test(base)) {
      return false;
    }
    return true;
  }
  
  // For files outside of pages directories (like App.jsx in src root),
  // they are likely page files if they're top-level components
  if (/^App\.(jsx?|tsx?)$/.test(base)) {
    return true; // App.jsx is the main page component
  }
  
  // Files that look like page components
  if (/(Page|Screen|Route|View)\.(jsx?|tsx?)$/.test(base)) {
    return true;
  }
  
  return false;
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
 * - Preserves original formatting by using targeted string manipulation
 * 
 * @param {string} file - Absolute path to the source file
 */
async function transformFile(file: string): Promise<boolean> {
  const source = await fs.readFile(file, 'utf-8');
  let modifiedSource = source;
  let modified = false;

  // Check if react-helmet is already imported
  const hasHelmetImport = /import.*{.*Helmet.*}.*from.*['"]react-helmet['"]/.test(source);
  
  // Check if Helmet is already being used
  const hasHelmetUsage = /<Helmet[\s>]/.test(source);

  if (hasHelmetUsage) {
    if (process.env.CLISEO_VERBOSE === 'true') {
      console.log(`[cliseo debug] File already has Helmet usage: ${file}`);
    }
    return false;
  }

  // Add import if missing
  if (!hasHelmetImport) {
    const importMatch = modifiedSource.match(/^(import.*from.*['"][^'"]*['"];?\s*\n)*/m);
    if (importMatch) {
      const insertPos = importMatch[0].length;
      modifiedSource = 
        modifiedSource.slice(0, insertPos) +
        `import { Helmet } from 'react-helmet';\n` +
        modifiedSource.slice(insertPos);
      modified = true;
    }
  }

  // Find JSX return statements and add Helmet
  const returnMatches = [...modifiedSource.matchAll(/return\s*\(\s*\n?\s*(<[^>]+>)/g)];
  
  for (const match of returnMatches) {
    const returnIndex = match.index!;
    const jsxStart = match.index! + match[0].length - match[1].length;
    
    // Find the opening JSX tag
    const openingTag = match[1];
    const tagEnd = modifiedSource.indexOf('>', jsxStart) + 1;
    
    // Find the indentation of the JSX element
    const lines = modifiedSource.slice(0, jsxStart).split('\n');
    const lastLine = lines[lines.length - 1];
    const indentation = lastLine.match(/^\s*/)?.[0] || '    ';
    
    // Create properly formatted Helmet element
    const helmetElement = `<Helmet>
${indentation}  <title>Your Site Title</title>
${indentation}  <meta name="description" content="Default description for this page" />
${indentation}  <link rel="canonical" href="https://yourdomain.com/current-page" />
${indentation}  <script 
${indentation}    type="application/ld+json" 
${indentation}    dangerouslySetInnerHTML={{
${indentation}      __html: JSON.stringify({
${indentation}        "@context": "https://schema.org",
${indentation}        "@type": "WebPage", 
${indentation}        "name": "Your Page Title",
${indentation}        "description": "Your page description",
${indentation}        "url": "https://yourdomain.com/current-page"
${indentation}      }, null, 2)
${indentation}    }}
${indentation}  />
${indentation}</Helmet>
${indentation}`;

    // Insert Helmet right after the opening tag
    modifiedSource = 
      modifiedSource.slice(0, tagEnd) +
      '\n' + indentation + helmetElement +
      modifiedSource.slice(tagEnd);
    modified = true;
    break; // Only modify the first return statement
  }

  // Add alt attributes to images missing them
  const imgMatches = [...modifiedSource.matchAll(/<img\s+[^>]*src=[^>]*(?!alt\s*=)[^>]*>/g)];
  
  for (const match of imgMatches.reverse()) { // Reverse to maintain indices
    const imgTag = match[0];
    const imgIndex = match.index!;
    
    // Check if it already has alt attribute
    if (!/\salt\s*=/.test(imgTag)) {
      const modifiedImg = imgTag.replace(/(\s*\/?>)$/, ' alt="Image description"$1');
      modifiedSource = 
        modifiedSource.slice(0, imgIndex) +
        modifiedImg +
        modifiedSource.slice(imgIndex + imgTag.length);
      modified = true;
    }
  }

  if (modified) {
    if (process.env.CLISEO_VERBOSE === 'true') {
      console.log(`[cliseo debug] Modifications made in file: ${file}, writing changes...`);
    }
    await fs.writeFile(file, modifiedSource, 'utf-8');
    return true;
  } else {
    if (process.env.CLISEO_VERBOSE === 'true') {
      console.log(`[cliseo debug] No modifications needed for file: ${file}`);
    }
    return false;
  }
}

async function findReactFiles(dir: string): Promise<string[]> {
  // First try to find a pages directory
  const pagesDir = path.join(dir, 'pages');
  if (existsSync(pagesDir)) {
    const files = await glob('**/*.{js,jsx,ts,tsx}', { cwd: pagesDir, absolute: true });
    if (files.length > 0) {
      console.log(`Found ${files.length} files in pages directory`);
      return files;
    }
  }
  
  // If no pages directory or no files found, look for page-like components in the entire src directory
  if (existsSync(dir)) {
    const allFiles = await glob('**/*.{js,jsx,ts,tsx}', { 
      cwd: dir, 
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
    });
    
    // Filter to likely page components (App.jsx, or files in specific directories)
    const pageFiles = allFiles.filter(file => {
      const relativePath = path.relative(dir, file);
      const fileName = path.basename(file);
      
      // Include main App file
      if (fileName === 'App.jsx' || fileName === 'App.tsx') return true;
      
      // Include files in views, screens, or routes directories
      if (/\/(views|screens|routes|pages)\//.test(relativePath)) return true;
      
      // Include files that look like page components
      if (/(Page|Screen|Route|View)\.(jsx?|tsx?)$/.test(fileName)) return true;
      
      return false;
    });
    
    if (pageFiles.length > 0) {
      console.log(`Found ${pageFiles.length} page-like components in src directory`);
      return pageFiles;
    }
  }
  
  console.log(`No React page components found in ${dir}`);
  return [];
}

/**
 * Installs react-helmet dependency if not already present
 */
async function installReactHelmet(projectRoot: string): Promise<boolean> {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  
  if (!existsSync(packageJsonPath)) {
    console.log(chalk.yellow('⚠️  No package.json found, skipping react-helmet installation'));
    return false;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    // Check if react-helmet is already installed
    if (deps['react-helmet']) {
      console.log(chalk.green('✅ react-helmet already installed'));
      return true;
    }

    console.log(chalk.cyan('📦 Installing react-helmet dependency...'));
    
    // Determine package manager
    const hasYarnLock = existsSync(path.join(projectRoot, 'yarn.lock'));
    const hasPnpmLock = existsSync(path.join(projectRoot, 'pnpm-lock.yaml'));
    
    let installCommand;
    if (hasPnpmLock) {
      installCommand = 'pnpm add react-helmet';
    } else if (hasYarnLock) {
      installCommand = 'yarn add react-helmet';
    } else {
      installCommand = 'npm install react-helmet';
    }

    execSync(installCommand, { 
      cwd: projectRoot, 
      stdio: 'pipe' // Don't show output unless there's an error
    });
    
    console.log(chalk.green('✅ Successfully installed react-helmet'));
    return true;
    
  } catch (error) {
    console.log(chalk.red(`❌ Failed to install react-helmet: ${error instanceof Error ? error.message : 'Unknown error'}`));
    return false;
  }
}

/**
 * Injects Helmet metadata into all relevant React page files in the project.
 * This skips files that don't appear to be top-level page components.
 */
export async function optimizeReactComponents(projectRoot: string): Promise<void> {
  // First, ensure react-helmet is installed
  const helmetInstalled = await installReactHelmet(projectRoot);
  if (!helmetInstalled) {
    console.log(chalk.yellow('⚠️  Skipping React optimization due to react-helmet installation failure'));
    return;
  }

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