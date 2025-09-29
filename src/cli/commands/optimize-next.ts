import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { join, relative } from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import { BASIC_PLACEHOLDERS, buildHeadTagStrings } from '../utils/seoTemplates.js';

const IMG_WITHOUT_ALT = /<img\b(?![^>]*\balt\s*=)([^>]*?)(\/?>)/gi;

function ensureImageAltAttributes(source: string, placeholder: string) {
  let replacements = 0;
  const updated = source.replace(IMG_WITHOUT_ALT, (_match, attrs: string, closing: string) => {
    replacements += 1;
    const paddedAttrs = attrs.endsWith(' ') || attrs.length === 0 ? attrs : `${attrs} `;
    return `<img${paddedAttrs}alt="${placeholder}"${closing}`;
  });
  return { updated, replacements };
}

function ensurePrimaryHeading(source: string, placeholder: string) {
  if (/<h1\b/i.test(source)) {
    return { updated: source, added: false };
  }

  const returnMatch = /return\s*\(\s*\n([ \t]*)/.exec(source);
  if (!returnMatch) {
    return { updated: source, added: false };
  }

  const indent = returnMatch[1] || '  ';
  const insertIndex = returnMatch.index + returnMatch[0].length;
  const snippet = `${indent}<h1>${placeholder}</h1>\n`;

  return {
    updated: source.slice(0, insertIndex) + snippet + source.slice(insertIndex),
    added: true,
  };
}

async function collectAppRouterPages(projectRoot: string): Promise<string[]> {
  if (!existsSync(join(projectRoot, 'app'))) {
    return [];
  }

  return glob('app/**/page.{js,jsx,ts,tsx}', {
    cwd: projectRoot,
    absolute: true,
    ignore: ['**/node_modules/**'],
  });
}

async function collectPagesRouterFiles(projectRoot: string): Promise<string[]> {
  if (!existsSync(join(projectRoot, 'pages'))) {
    return [];
  }

  return glob('pages/**/*.{js,jsx,ts,tsx}', {
    cwd: projectRoot,
    absolute: true,
    ignore: ['**/node_modules/**', '**/_app.*', '**/_document.*', '**/_error.*'],
  });
}

function ensureMetadataExport(content: string) {
  if (/export\s+const\s+metadata\s*=/.test(content)) {
    return { updated: content, added: false };
  }

  const metadataBlock = `export const metadata = {
  title: '${BASIC_PLACEHOLDERS.title}',
  description: '${BASIC_PLACEHOLDERS.description}',
  robots: '${BASIC_PLACEHOLDERS.robots}',
  alternates: {
    canonical: '${BASIC_PLACEHOLDERS.canonical}'
  },
  openGraph: {
    title: '${BASIC_PLACEHOLDERS.title}',
    description: '${BASIC_PLACEHOLDERS.description}'
  },
  twitter: {
    title: '${BASIC_PLACEHOLDERS.title}',
    description: '${BASIC_PLACEHOLDERS.description}'
  }
};

`;

  const useClientMatch = content.match(/['"]use client['"]/);
  let insertIndex = 0;
  if (useClientMatch && useClientMatch.index !== undefined) {
    const endOfLine = content.indexOf('\n', useClientMatch.index + useClientMatch[0].length);
    insertIndex = endOfLine >= 0 ? endOfLine + 1 : content.length;
  }

  return {
    updated: content.slice(0, insertIndex) + metadataBlock + content.slice(insertIndex),
    added: true,
  };
}

function ensureHeadImport(content: string) {
  if (/from\s+['"]next\/head['"]/.test(content)) {
    return { updated: content, added: false };
  }

  const importBlock = "import Head from 'next/head';\n";
  const importMatch = content.match(/^(import[^;]+;\s*\n)+/m);
  if (importMatch) {
    const insertPos = importMatch[0].length;
    return {
      updated: content.slice(0, insertPos) + importBlock + content.slice(insertPos),
      added: true,
    };
  }

  return {
    updated: importBlock + content,
    added: true,
  };
}

function ensureHeadBlock(content: string) {
  if (/<Head>/.test(content)) {
    return { updated: content, added: false };
  }

  const returnMatch = /return\s*\(\s*\n([ \t]*)/.exec(content);
  if (!returnMatch) {
    return { updated: content, added: false };
  }

  const indent = returnMatch[1] || '  ';
  const { meta, links, title } = buildHeadTagStrings();
  const headLines = [
    `${indent}<Head>`,
    `${indent}  <title>${title}</title>`,
    ...meta.map((tag) => `${indent}  ${tag}`),
    ...links.map((tag) => `${indent}  ${tag}`),
    `${indent}</Head>\n`,
  ];
  const headBlock = headLines.join('\n');
  const insertIndex = returnMatch.index + returnMatch[0].length;

  return {
    updated: content.slice(0, insertIndex) + headBlock + content.slice(insertIndex),
    added: true,
  };
}

export async function optimizeNextjsComponents(projectRoot: string) {
  const appRouterPages = await collectAppRouterPages(projectRoot);
  const pagesRouterFiles = await collectPagesRouterFiles(projectRoot);

  let filesChanged = 0;
  let altUpdates = 0;
  let headingsAdded = 0;
  let metadataAdded = 0;
  let headBlocksAdded = 0;

  for (const file of [...appRouterPages, ...pagesRouterFiles]) {
    try {
      const original = await fs.readFile(file, 'utf8');
      let modified = original;

      const altResult = ensureImageAltAttributes(modified, BASIC_PLACEHOLDERS.imageAlt);
      modified = altResult.updated;
      altUpdates += altResult.replacements;

      const headingResult = ensurePrimaryHeading(modified, BASIC_PLACEHOLDERS.h1);
      modified = headingResult.updated;
      if (headingResult.added) {
        headingsAdded += 1;
      }

      if (appRouterPages.includes(file)) {
        const metadataResult = ensureMetadataExport(modified);
        modified = metadataResult.updated;
        if (metadataResult.added) {
          metadataAdded += 1;
        }
      } else {
        const importResult = ensureHeadImport(modified);
        modified = importResult.updated;
        const headResult = ensureHeadBlock(modified);
        modified = headResult.updated;
        if (headResult.added) {
          headBlocksAdded += 1;
        }
      }

      if (modified !== original) {
        await fs.writeFile(file, modified, 'utf8');
        filesChanged += 1;
        console.log(chalk.gray(`• Updated ${relative(projectRoot, file)}`));
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Skipped ${relative(projectRoot, file)} (could not update)`));
    }
  }

  if (filesChanged > 0) {
    console.log(
      chalk.cyan(
        `Next.js files updated: ${filesChanged}. Alt tags added: ${altUpdates}. H1 inserted: ${headingsAdded}. Metadata blocks added: ${metadataAdded + headBlocksAdded}.`,
      ),
    );
  }
}
