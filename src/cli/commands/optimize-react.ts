import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { join, relative } from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import { BASIC_PLACEHOLDERS, buildHeadTagStrings } from '../utils/seoTemplates.js';

const IMG_WITHOUT_ALT = /<img\b(?![^>]*\balt\s*=)([^>]*?)(\/?>)/gi;

function isReactSource(file: string): boolean {
  return /\.(?:jsx|tsx|js|ts)$/.test(file);
}

function isLikelyPageFile(filePath: string): boolean {
  const normalised = filePath.replace(/\\/g, '/');
  if (!isReactSource(normalised)) {
    return false;
  }

  if (/\/(pages|views|screens|routes)\//.test(normalised)) {
    return true;
  }

  const base = normalised.split('/').pop() || '';
  if (/^(App|Page|Screen|View)\.(jsx?|tsx?)$/.test(base)) {
    return true;
  }

  return false;
}

async function collectReactCandidates(projectRoot: string): Promise<string[]> {
  const searchRoots = [
    join(projectRoot, 'src'),
    join(projectRoot, 'pages'),
    join(projectRoot, 'app'),
  ];

  const files = new Set<string>();

  for (const root of searchRoots) {
    if (!existsSync(root)) continue;

    const matches = await glob('**/*.{js,jsx,ts,tsx}', {
      cwd: root,
      absolute: true,
      ignore: ['**/node_modules/**', '**/*.d.ts', '**/*.test.*', '**/*.spec.*'],
    });

    matches
      .filter(isLikelyPageFile)
      .forEach((file) => files.add(file));
  }

  return Array.from(files);
}

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

export async function optimizeReactComponents(projectRoot: string) {
  const files = await collectReactCandidates(projectRoot);
  if (files.length === 0) {
    return;
  }

  let filesChanged = 0;
  let totalAltUpdates = 0;
  let headingsAdded = 0;
  let helmetInserted = 0;
  let helmetAugmented = 0;

  for (const file of files) {
    try {
      const original = await fs.readFile(file, 'utf8');
      let modified = original;

      const needsHelmet = /return\s*\(/.test(modified);
      const hasHelmetImport = /from\s+['"]react-helmet['"]/i.test(modified);
      const hasHelmetUsage = /<Helmet[\s>]/.test(modified);
      const { title, meta, links } = buildHeadTagStrings();

      const missingMeta = meta.filter((tag) => !new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(modified));
      const missingLinks = links.filter((tag) => !new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(modified));
      const titleMissing = !/<title>.*?<\/title>/.test(modified);

      if (hasHelmetUsage && (titleMissing || missingMeta.length || missingLinks.length)) {
        const helmetOpenIndex = modified.indexOf('<Helmet');
        const helmetCloseIndex = modified.indexOf('</Helmet>', helmetOpenIndex);
        if (helmetOpenIndex !== -1 && helmetCloseIndex !== -1) {
          const helmetBlock = modified.slice(helmetOpenIndex, helmetCloseIndex);
          const blockHasTitle = /<title>.*?<\/title>/.test(helmetBlock);
          const blockMissingMeta = missingMeta.filter((tag) => !helmetBlock.includes(tag));
          const blockMissingLinks = missingLinks.filter((tag) => !helmetBlock.includes(tag));

          if (!blockHasTitle || blockMissingMeta.length || blockMissingLinks.length) {
            const closeLineStart = modified.lastIndexOf('\n', helmetCloseIndex);
            const indent = closeLineStart === -1 ? '' : (modified.slice(closeLineStart + 1, helmetCloseIndex).match(/^\s*/) || [''])[0];
            const insertionLines: string[] = [];
            if (!blockHasTitle) {
              insertionLines.push(`${indent}  <title>${title}</title>`);
            }
            blockMissingMeta.forEach((tag) => insertionLines.push(`${indent}  ${tag}`));
            blockMissingLinks.forEach((tag) => insertionLines.push(`${indent}  ${tag}`));

            if (insertionLines.length) {
              const insertion = '\n' + insertionLines.join('\n');
              modified = modified.slice(0, helmetCloseIndex) + insertion + modified.slice(helmetCloseIndex);
              helmetAugmented += 1;
            }
          }
        }
      }

      if (!hasHelmetUsage && needsHelmet && (titleMissing || missingMeta.length || missingLinks.length)) {
        if (!hasHelmetImport) {
          const importBlock = "import { Helmet } from 'react-helmet';\n";
          const importMatch = modified.match(/^(import[^;]+;\s*\n)+/m);
          if (importMatch) {
            const insertPos = importMatch[0].length;
            modified = modified.slice(0, insertPos) + importBlock + modified.slice(insertPos);
          } else {
            modified = importBlock + modified;
          }
        }

        if (!hasHelmetUsage) {
          const returnMatch = /return\s*\(\s*\n?\s*(<[^>]+>)/.exec(modified);
          if (returnMatch && returnMatch.index !== undefined) {
            const jsxStart = returnMatch.index + returnMatch[0].length - returnMatch[1].length;
            const tagEnd = modified.indexOf('>', jsxStart) + 1;
            const lines = modified.slice(0, jsxStart).split('\n');
            const indentation = (lines[lines.length - 1].match(/^\s*/)?.[0] || '  ') + '  ';

            const helmetLines = [
              '<Helmet>',
              `  <title>${title}</title>`,
              ...missingMeta.map((tag) => `  ${tag}`),
              ...missingLinks.map((tag) => `  ${tag}`),
              '</Helmet>',
            ].join('\n' + indentation);

            const block = '\n' + indentation + helmetLines + '\n';
            modified = modified.slice(0, tagEnd) + block + modified.slice(tagEnd);
            helmetInserted += 1;
          }
        }
      }

      const altResult = ensureImageAltAttributes(modified, BASIC_PLACEHOLDERS.imageAlt);
      modified = altResult.updated;
      totalAltUpdates += altResult.replacements;

      const headingResult = ensurePrimaryHeading(modified, BASIC_PLACEHOLDERS.h1);
      modified = headingResult.updated;
      if (headingResult.added) {
        headingsAdded += 1;
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
        `React pages updated: ${filesChanged}. Alt tags added: ${totalAltUpdates}. H1 inserted: ${headingsAdded}. Helmet blocks added: ${helmetInserted}. Helmet blocks updated: ${helmetAugmented}.`,
      ),
    );
  }
}
