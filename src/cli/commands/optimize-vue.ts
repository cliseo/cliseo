import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { join, relative } from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import { BASIC_PLACEHOLDERS, buildHeadTagStrings } from '../utils/seoTemplates.js';

const IMG_WITHOUT_ALT = /<img\b(?![^>]*\balt\s*=)([^>]*?)(\/?>)/gi;

function isLikelyVuePage(filePath: string): boolean {
  const normalised = filePath.replace(/\\/g, '/');
  if (!normalised.endsWith('.vue')) {
    return false;
  }
  return /\/(pages|views|routes)\//.test(normalised);
}

async function collectVuePages(projectRoot: string): Promise<string[]> {
  const candidates = await glob('src/{pages,views,routes}/**/*.vue', {
    cwd: projectRoot,
    absolute: true,
    ignore: ['**/node_modules/**'],
  });

  return candidates.filter(isLikelyVuePage);
}

function ensureTemplateHeading(template: string, placeholder: string) {
  if (/<h1\b/i.test(template)) {
    return { updated: template, added: false };
  }

  const lines = template.split('\n');
  const firstContentIndex = lines.findIndex((line) => line.trim().length > 0);
  const indent = firstContentIndex >= 0 ? lines[firstContentIndex].match(/^\s*/)?.[0] ?? '' : '';
  const headingLine = `${indent}<h1>${placeholder}</h1>`;

  if (firstContentIndex >= 0) {
    lines.splice(firstContentIndex, 0, headingLine);
  } else {
    lines.push(headingLine);
  }

  return { updated: lines.join('\n'), added: true };
}

function ensureTemplateImageAlt(template: string, placeholder: string) {
  let replacements = 0;
  const updated = template.replace(IMG_WITHOUT_ALT, (_match, attrs: string, closing: string) => {
    replacements += 1;
    const paddedAttrs = attrs.endsWith(' ') || attrs.length === 0 ? attrs : `${attrs} `;
    return `<img${paddedAttrs}alt="${placeholder}"${closing}`;
  });
  return { updated, replacements };
}

export async function optimizeVueComponents(projectRoot: string) {
  if (!existsSync(projectRoot)) {
    return;
  }

  const files = await collectVuePages(projectRoot);
  if (files.length === 0) {
    return;
  }

  let filesChanged = 0;
  let altUpdates = 0;
  let headingsAdded = 0;
  let headBlocksAdded = 0;

  for (const file of files) {
    try {
      const original = await fs.readFile(file, 'utf8');
      const templateMatch = original.match(/<template>([\s\S]*?)<\/template>/);
      if (!templateMatch) {
        continue;
      }

      const templateContent = templateMatch[1];
      let updatedTemplate = templateContent;

      const altResult = ensureTemplateImageAlt(updatedTemplate, BASIC_PLACEHOLDERS.imageAlt);
      updatedTemplate = altResult.updated;
      altUpdates += altResult.replacements;

      const headingResult = ensureTemplateHeading(updatedTemplate, BASIC_PLACEHOLDERS.h1);
      updatedTemplate = headingResult.updated;
      if (headingResult.added) {
        headingsAdded += 1;
      }

      const { title, meta, links } = buildHeadTagStrings();
      const needsTitle = !/<title>.*<\/title>/.test(updatedTemplate);
      const missingMeta = meta.filter((tag) => !updatedTemplate.includes(tag));
      const missingLinks = links.filter((tag) => !updatedTemplate.includes(tag));

      if ((needsTitle || missingMeta.length || missingLinks.length) && !updatedTemplate.includes('<Teleport to="head"')) {
        const headBlockLines = [
          '<Teleport to="head">',
          `  <title>${title}</title>`,
          ...missingMeta.map((tag) => `  ${tag}`),
          ...missingLinks.map((tag) => `  ${tag}`),
          '</Teleport>',
        ];
        updatedTemplate = headBlockLines.join('\n') + '\n' + updatedTemplate;
        headBlocksAdded += 1;
      }

      if (updatedTemplate === templateContent) {
        continue;
      }

      const updatedFile = original.replace(templateContent, updatedTemplate);
      await fs.writeFile(file, updatedFile, 'utf8');
      filesChanged += 1;
      console.log(chalk.gray(`• Updated ${relative(projectRoot, file)}`));
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Skipped ${relative(projectRoot, file)} (could not update)`));
    }
  }

  if (filesChanged > 0) {
    console.log(
      chalk.cyan(
        `Vue pages updated: ${filesChanged}. Alt tags added: ${altUpdates}. H1 inserted: ${headingsAdded}. Head blocks added: ${headBlocksAdded}.`,
      ),
    );
  }
}
