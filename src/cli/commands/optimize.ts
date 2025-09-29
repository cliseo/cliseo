import { readFile, writeFile } from 'fs/promises';
import { readFileSync, existsSync } from 'fs';
import * as cheerio from 'cheerio';
import { join, dirname, resolve, basename } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { glob } from 'glob';
import fs from 'fs';
import path from 'path';
import { optimizeReactComponents } from './optimize-react.js';
import { optimizeVueComponents } from './optimize-vue.js';
import { optimizeNextjsComponents } from './optimize-next.js';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import axios from 'axios'; // Added for AI optimizations
import { fileURLToPath } from 'url';
import { ensureSeoFiles as ensureSeoAssets, SupportedFramework } from '../utils/seoFiles.js';
import { BASIC_PLACEHOLDERS } from '../utils/seoTemplates.js';
import {
  ensureHeadDefaults as applyHeadDefaults,
  ensurePrimaryHeading,
  ensureImageAltAttributes,
  ensureHtmlLanguage,
  ensureGeoMeta,
} from '../utils/domSeo.js';

// Get package.json for version info
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../../package.json'), 'utf8')
);

interface ProjectAnalysis {
  projectName: string;
  description: string;
}

// Helper function to format email display
function formatEmailDisplay(email: string): string {
  // For GitHub users without public email
  if (email && email.includes('@github.user')) {
    const username = email.split('@')[0];
    return `Github: ${username}`;
  }

  // For Google users, check if it's a placeholder
  if (email && email.includes('placeholder')) {
    return 'Google: (private email)';
  }

  // For real emails, show as-is
  return email || 'Not provided';
}

/**
 * Finds the project root directory
 * 
 * @param startDir - Directory to start searching from (default: current working directory)
 * @returns Path to the project root directory
 */
function findProjectRoot(startDir = process.cwd()): string {
  let dir = resolve(startDir);
  while (dir !== dirname(dir)) {
    if (fs.existsSync(join(dir, 'package.json'))) return dir;
    dir = dirname(dir);
  }
  return process.cwd(); // fallback
}

/**
 * Determines the pages directory for a given framework
 */
function getPagesDirectory(projectRoot: string, framework: SupportedFramework): string[] {
  const directories: string[] = [];
  switch (framework) {
    case 'next.js':
      if (existsSync(join(projectRoot, 'pages'))) {
        directories.push(join(projectRoot, 'pages'));
      }
      if (existsSync(join(projectRoot, 'app'))) {
        directories.push(join(projectRoot, 'app'));
      }
      if (existsSync(join(projectRoot, 'public'))) {
        directories.push(join(projectRoot, 'public'));
      }
      break;
    case 'react':
      if (existsSync(join(projectRoot, 'src', 'pages'))) {
        directories.push(join(projectRoot, 'src', 'pages'));
      }
      if (existsSync(join(projectRoot, 'public'))) {
        directories.push(join(projectRoot, 'public'));
      }
      if (existsSync(join(projectRoot, 'src'))) {
        directories.push(join(projectRoot, 'src'));
      }
      break;
    case 'angular':
      if (existsSync(join(projectRoot, 'src'))) {
        directories.push(join(projectRoot, 'src'));
      }
      break;
    case 'vue':
      if (existsSync(join(projectRoot, 'src', 'pages'))) {
        directories.push(join(projectRoot, 'src', 'pages'));
      }
      if (existsSync(join(projectRoot, 'src', 'views'))) {
        directories.push(join(projectRoot, 'src', 'views'));
      }
      if (existsSync(join(projectRoot, 'src', 'routes'))) {
        directories.push(join(projectRoot, 'src', 'routes'));
      }
      if (existsSync(join(projectRoot, 'public'))) {
        directories.push(join(projectRoot, 'public'));
      }
      break;
  }
  return directories;
}

/**
 * Gets framework-specific file extensions to optimize
 */
function getFrameworkFileExtensions(framework: SupportedFramework): string[] {
  switch (framework) {
    case 'next.js':
    case 'react':
      return ['**/*.{js,jsx,ts,tsx,html}'];
    case 'angular':
      return ['**/*.html'];
    case 'vue':
      return ['**/*.{vue,html}'];
    default:
      return ['**/*.html'];
  }
}

/**
 * Gets all files to optimize based on framework and pages directory
 */
async function getFilesToOptimize(projectRoot: string, framework: SupportedFramework): Promise<string[]> {
  const pagesDirectories = getPagesDirectory(projectRoot, framework);
  const files: string[] = [];

  if (pagesDirectories.length === 0) {
    console.log(chalk.yellow(`⚠️  No pages directory found for ${framework}. Skipping file optimizations.`));
    return files;
  }



  // Get framework-specific file extensions
  const extensions = getFrameworkFileExtensions(framework);

  for (const pagesDir of pagesDirectories) {
    for (const ext of extensions) {
      const foundFiles = await glob(ext, {
        cwd: pagesDir,
        absolute: true,
        ignore: ['**/node_modules/**']
      });
      files.push(...foundFiles);
    }
  }


  return files;
}

interface HtmlOptimizationStats {
  file: string;
  addedTitle: boolean;
  addedMeta: number;
  addedLinks: number;
  languageAdded: boolean;
  h1Added: boolean;
  altUpdated: number;
  geoAdded: number;
}

interface AiPageSuggestion {
  file: string;
  title?: string;
  description?: string;
  canonical?: string;
  robots?: string;
  language?: string;
  h1?: string;
  openGraph?: Record<string, string>;
  twitter?: Record<string, string>;
  meta?: Record<string, string>;
  jsonLd?: string | Record<string, unknown>;
  imageAlts?: Array<{ src?: string; alt: string }>;
  framework?: 'react' | 'next' | 'vue' | 'html';
}

type SuggestedMeta = { attribute: 'name' | 'property'; key: string; content: string };
type SuggestedLink = { rel: string; href: string };

interface SuggestionTagSet {
  title?: string;
  meta: SuggestedMeta[];
  links: SuggestedLink[];
}

function parseAiSuggestion(raw: any): AiPageSuggestion | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const file = typeof raw.file === 'string' ? raw.file : typeof raw.path === 'string' ? raw.path : undefined;
  if (!file) {
    return null;
  }

  const suggestion: AiPageSuggestion = { file };

  const metaSource = raw.meta || raw.metadata || {};

  suggestion.title = raw.title || metaSource.title;
  suggestion.description = raw.description || metaSource.description;
  suggestion.canonical = raw.canonical || metaSource.canonical;
  suggestion.robots = raw.robots || metaSource.robots;
  suggestion.language = raw.language || metaSource.language;
  suggestion.h1 = raw.h1 || raw.heading || raw.primary_heading;

  if (raw.openGraph || raw.open_graph) {
    suggestion.openGraph = raw.openGraph || raw.open_graph;
  }
  if (raw.twitter) {
    suggestion.twitter = raw.twitter;
  }
  if (raw.metaTags || raw.meta_tags || metaSource.tags) {
    suggestion.meta = raw.metaTags || raw.meta_tags || metaSource.tags;
  }
  if (raw.jsonLd || raw.json_ld || metaSource.jsonLd) {
    suggestion.jsonLd = raw.jsonLd || raw.json_ld || metaSource.jsonLd;
  }
  if (Array.isArray(raw.imageAlts) || Array.isArray(raw.image_alts)) {
    suggestion.imageAlts = (raw.imageAlts || raw.image_alts) as Array<{ src?: string; alt: string }>;
  }

  return suggestion;
}

function extractAiSuggestions(aiData: any): AiPageSuggestion[] {
  if (!aiData || typeof aiData !== 'object') {
    return [];
  }

  const buckets = [aiData.pageOptimizations, aiData.page_optimizations, aiData.pages];
  const suggestions: AiPageSuggestion[] = [];

  for (const bucket of buckets) {
    if (Array.isArray(bucket)) {
      bucket.forEach((entry) => {
        const parsed = parseAiSuggestion(entry);
        if (parsed) {
          suggestions.push(parsed);
        }
      });
    }
  }

  return suggestions;
}

function buildTagsFromSuggestion(suggestion: AiPageSuggestion): SuggestionTagSet {
  const meta: SuggestedMeta[] = [];
  const links: SuggestedLink[] = [];

  const pushMeta = (attribute: 'name' | 'property', key: string, value?: unknown) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      meta.push({ attribute, key, content: value.trim() });
    }
  };

  if (suggestion.description) {
    pushMeta('name', 'description', suggestion.description);
  }
  if (suggestion.robots) {
    pushMeta('name', 'robots', suggestion.robots);
  }

  if (suggestion.meta && typeof suggestion.meta === 'object') {
    Object.entries(suggestion.meta).forEach(([key, value]) => pushMeta('name', key, value));
  }

  if (suggestion.openGraph && typeof suggestion.openGraph === 'object') {
    Object.entries(suggestion.openGraph).forEach(([key, value]) => pushMeta('property', `og:${key}`, value));
  }

  if (suggestion.twitter && typeof suggestion.twitter === 'object') {
    Object.entries(suggestion.twitter).forEach(([key, value]) => pushMeta('name', `twitter:${key}`, value));
  }

  if (suggestion.canonical) {
    links.push({ rel: 'canonical', href: suggestion.canonical });
  }

  return {
    title: suggestion.title,
    meta,
    links,
  };
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function metaTagToString(meta: SuggestedMeta): string {
  const attribute = meta.attribute === 'property' ? 'property' : 'name';
  return `<meta ${attribute}="${meta.key}" content="${escapeHtmlAttribute(meta.content)}" />`;
}

function linkTagToString(link: SuggestedLink): string {
  return `<link rel="${link.rel}" href="${escapeHtmlAttribute(link.href)}" />`;
}

function metaExistsInBlock(block: string, meta: SuggestedMeta): boolean {
  const attribute = meta.attribute === 'property' ? 'property' : 'name';
  const regex = new RegExp(`<meta[^>]*${attribute}=["']${escapeRegExp(meta.key)}["']`, 'i');
  return regex.test(block);
}

function linkExistsInBlock(block: string, link: SuggestedLink): boolean {
  const regex = new RegExp(`<link[^>]*rel=["']${escapeRegExp(link.rel)}["'][^>]*href=["']${escapeRegExp(link.href)}["']`, 'i');
  return regex.test(block);
}

function escapeJsString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function applyImageAltSuggestionsInMarkup(
  source: string,
  images: Array<{ src?: string; alt: string }>
): { updated: string; changed: boolean } {
  let updated = source;
  let changed = false;

  images.forEach((image) => {
    if (!image || !image.alt || !image.src) {
      return;
    }

    const pattern = new RegExp(`(<img[^>]*src=[\"']${escapeRegExp(image.src)}[\"'][^>]*)(alt=[^>]*?)?(\/?>)`, 'gi');
    updated = updated.replace(pattern, (_match, prefix: string, altPart: string | undefined, suffix: string) => {
      const altAttribute = `alt="${escapeHtmlAttribute(image.alt)}"`;
      if (altPart) {
        if (altPart.includes(image.alt)) {
          return `${prefix}${altPart}${suffix}`;
        }
        changed = true;
        return `${prefix}${altAttribute}${suffix}`;
      }
      changed = true;
      const spacer = prefix.endsWith(' ') ? '' : ' ';
      return `${prefix}${spacer}${altAttribute}${suffix}`;
    });
  });

  return { updated, changed };
}

function setMetaTag(
  $: cheerio.CheerioAPI,
  attribute: 'name' | 'property',
  key: string,
  value: string
) {
  const selector = `meta[${attribute}="${key}"]`;
  const existing = $('head').find(selector).first();
  if (existing.length) {
    existing.attr('content', value);
  } else {
    $('head').append(`<meta ${attribute}="${key}" content="${value}" />`);
  }
}

function setLinkTag($: cheerio.CheerioAPI, rel: string, href: string) {
  const existing = $('head').find(`link[rel="${rel}"]`).first();
  if (existing.length) {
    existing.attr('href', href);
  } else {
    $('head').append(`<link rel="${rel}" href="${href}" />`);
  }
}

async function optimizeHtmlDocument(filePath: string): Promise<HtmlOptimizationStats | null> {
  try {
    const original = await readFile(filePath, 'utf8');
    if (!/<html[\s>]/i.test(original)) {
      return null;
    }
    const $ = cheerio.load(original);

    const languageAdded = ensureHtmlLanguage($);
    const headStats = applyHeadDefaults($);
    const geoAdded = ensureGeoMeta($);
    const h1Added = ensurePrimaryHeading($);
    const altUpdated = ensureImageAltAttributes($);

    const updated = $.html();

    if (updated && updated.trim() !== original.trim()) {
      await writeFile(filePath, updated, 'utf8');
      return {
        file: filePath,
        addedTitle: headStats.addedTitle,
        addedMeta: headStats.addedMeta,
        addedLinks: headStats.addedLinks,
        languageAdded,
        h1Added,
        altUpdated,
        geoAdded,
      };
    }
  } catch (error) {
    // Non-HTML fragments (like Angular partials) may fail to parse; ignore gracefully
  }

  return null;
}

async function optimizeHtmlLikeFiles(projectRoot: string, framework: SupportedFramework): Promise<HtmlOptimizationStats[]> {
  const files = await getFilesToOptimize(projectRoot, framework);
  const htmlFiles = files.filter((file) => file.toLowerCase().endsWith('.html'));
  const results: HtmlOptimizationStats[] = [];

  for (const file of htmlFiles) {
    const outcome = await optimizeHtmlDocument(file);
    if (outcome) {
      results.push(outcome);
    }
  }

  return results;
}

async function applyAiSuggestionToHtmlFile(projectRoot: string, suggestion: AiPageSuggestion): Promise<boolean> {
  const targetPath = path.isAbsolute(suggestion.file)
    ? suggestion.file
    : join(projectRoot, suggestion.file);

  if (!existsSync(targetPath)) {
    return false;
  }

  const original = await readFile(targetPath, 'utf8');
  const $ = cheerio.load(original);

  const tagSet = buildTagsFromSuggestion(suggestion);

  if (suggestion.language) {
    $('html').attr('lang', suggestion.language);
  }

  if (tagSet.title) {
    if ($('head > title').length) {
      $('head > title').first().text(tagSet.title);
    } else {
      $('head').prepend(`<title>${tagSet.title}</title>`);
    }
  }

  tagSet.meta.forEach((tag) => setMetaTag($, tag.attribute, tag.key, tag.content));
  tagSet.links.forEach((link) => setLinkTag($, link.rel, link.href));

  if (suggestion.h1) {
    if ($('h1').length) {
      $('h1').first().text(suggestion.h1);
    } else {
      ensurePrimaryHeading($, suggestion.h1);
    }
  } else {
    ensurePrimaryHeading($);
  }

  if (suggestion.imageAlts && suggestion.imageAlts.length > 0) {
    suggestion.imageAlts.forEach((image) => {
      if (!image.alt) {
        return;
      }
      if (image.src) {
        const selector = `img[src="${image.src}"]`;
        const node = $(selector).first();
        if (node.length) {
          node.attr('alt', image.alt);
        }
      }
    });
  }

  ensureImageAltAttributes($);

  if (suggestion.jsonLd) {
    const json = typeof suggestion.jsonLd === 'string'
      ? suggestion.jsonLd
      : JSON.stringify(suggestion.jsonLd, null, 2);

    const existing = $('script[type="application/ld+json"]').first();
    if (existing.length) {
      existing.text(json);
    } else {
      $('head').append(`<script type="application/ld+json">${json}</script>`);
    }
  }

  const updated = $.html();
  if (updated.trim() !== original.trim()) {
    await writeFile(targetPath, updated, 'utf8');
    return true;
  }

  return false;
}

async function applyAiSuggestionToReactFile(projectRoot: string, suggestion: AiPageSuggestion): Promise<boolean> {
  const targetPath = path.isAbsolute(suggestion.file)
    ? suggestion.file
    : join(projectRoot, suggestion.file);

  if (!existsSync(targetPath)) {
    return false;
  }

  const ext = path.extname(targetPath).toLowerCase();
  if (!['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
    return false;
  }

  let source = await readFile(targetPath, 'utf8');
  const original = source;
  const tags = buildTagsFromSuggestion(suggestion);
  let changed = false;

  if (suggestion.h1) {
    const h1Regex = /(<h1[^>]*>)([\s\S]*?)(<\/h1>)/;
    if (h1Regex.test(source)) {
      source = source.replace(h1Regex, `$1${suggestion.h1}$3`);
      changed = true;
    }
  }

  if (suggestion.imageAlts && suggestion.imageAlts.length > 0) {
    const result = applyImageAltSuggestionsInMarkup(source, suggestion.imageAlts);
    if (result.changed) {
      source = result.updated;
      changed = true;
    }
  }

  const needsHelmet = /return\s*\(/.test(source) && (tags.title || tags.meta.length || tags.links.length);
  if (needsHelmet) {
    const helmetRegex = /<Helmet[\s\S]*?<\/Helmet>/i;
    const metaStrings = tags.meta.map(metaTagToString);
    const linkStrings = tags.links.map(linkTagToString);

    const helmetMatch = helmetRegex.exec(source);
    if (helmetMatch) {
      let block = helmetMatch[0];
      let inner = helmetMatch[0].replace(/^<Helmet[^>]*>/i, '').replace(/<\/Helmet>$/i, '');
      const indent = helmetMatch[0].match(/\n([ \t]*)<\/Helmet>/)?.[1] ?? '  ';
      const innerIndent = indent + '  ';

      if (tags.title) {
        if (/<title>.*?<\/title>/i.test(inner)) {
          inner = inner.replace(/<title>[\s\S]*?<\/title>/i, `<title>${tags.title}</title>`);
        } else {
          inner = `\n${innerIndent}<title>${tags.title}</title>${inner}`;
        }
      }

      tags.meta.forEach((metaDef, idx) => {
        const metaString = metaStrings[idx];
        if (!metaExistsInBlock(inner, metaDef)) {
          inner = inner.replace(/\s*$/, `\n${innerIndent}${metaString}`);
        }
      });

      tags.links.forEach((linkDef, idx) => {
        const linkString = linkStrings[idx];
        if (!linkExistsInBlock(inner, linkDef)) {
          inner = inner.replace(/\s*$/, `\n${innerIndent}${linkString}`);
        }
      });

      const rebuiltBlock = `<Helmet>${inner.replace(/^\n/, '')}\n${indent}</Helmet>`;
      source = source.replace(helmetMatch[0], rebuiltBlock);
      changed = true;
    } else {
      const importBlock = "import { Helmet } from 'react-helmet';\n";
      if (!/from\s+['"]react-helmet['"]/i.test(source)) {
        const importMatch = source.match(/^(import[^;]+;\s*\n)+/m);
        if (importMatch) {
          const insertPos = importMatch[0].length;
          source = source.slice(0, insertPos) + importBlock + source.slice(insertPos);
        } else {
          source = importBlock + source;
        }
        changed = true;
      }

      const returnMatch = /return\s*\(\s*\n?\s*(<[^>]+>)/.exec(source);
      if (returnMatch && returnMatch.index !== undefined) {
        const jsxStart = returnMatch.index + returnMatch[0].length - returnMatch[1].length;
        const tagEnd = source.indexOf('>', jsxStart) + 1;
        const lines = source.slice(0, jsxStart).split('\n');
        const indentation = (lines[lines.length - 1].match(/^\s*/)?.[0] || '  ') + '  ';
        const insideIndent = indentation + '  ';

        const helmetLines: string[] = ['<Helmet>'];
        if (tags.title) {
          helmetLines.push(`  <title>${tags.title}</title>`);
        }
        metaStrings.forEach((metaString) => helmetLines.push(`  ${metaString}`));
        linkStrings.forEach((linkString) => helmetLines.push(`  ${linkString}`));
        helmetLines.push('</Helmet>');

        const formatted = helmetLines
          .map((line) => (line.startsWith('</Helmet') ? indentation + line : indentation + line))
          .join('\n') + '\n';

        source = source.slice(0, tagEnd) + '\n' + formatted + source.slice(tagEnd);
        changed = true;
      }
    }
  }

  if (changed && source !== original) {
    await writeFile(targetPath, source, 'utf8');
    return true;
  }

  return false;
}

async function applyAiSuggestionToVueFile(projectRoot: string, suggestion: AiPageSuggestion): Promise<boolean> {
  const targetPath = path.isAbsolute(suggestion.file)
    ? suggestion.file
    : join(projectRoot, suggestion.file);

  if (!existsSync(targetPath) || path.extname(targetPath).toLowerCase() !== '.vue') {
    return false;
  }

  let source = await readFile(targetPath, 'utf8');
  const original = source;
  const templateMatch = source.match(/<template>([\s\S]*?)<\/template>/);
  if (!templateMatch) {
    return false;
  }

  let templateContent = templateMatch[1];
  let changed = false;
  const tags = buildTagsFromSuggestion(suggestion);
  const metaStrings = tags.meta.map(metaTagToString);
  const linkStrings = tags.links.map(linkTagToString);

  if (suggestion.h1) {
    const h1Regex = /(<h1[^>]*>)([\s\S]*?)(<\/h1>)/;
    if (h1Regex.test(templateContent)) {
      templateContent = templateContent.replace(h1Regex, `$1${suggestion.h1}$3`);
      changed = true;
    }
  }

  if (suggestion.imageAlts && suggestion.imageAlts.length > 0) {
    const result = applyImageAltSuggestionsInMarkup(templateContent, suggestion.imageAlts);
    if (result.changed) {
      templateContent = result.updated;
      changed = true;
    }
  }

  const teleportRegex = /<Teleport to="head">([\s\S]*?)<\/Teleport>/i;
  if (tags.title || tags.meta.length || tags.links.length) {
    const teleportMatch = teleportRegex.exec(templateContent);
    if (teleportMatch) {
      let block = teleportMatch[0];
      let inner = teleportMatch[1];
      const indent = teleportMatch[0].match(/\n([ \t]*)<\/Teleport>/)?.[1] ?? '  ';
      const innerIndent = indent + '  ';

      if (tags.title) {
        if (/<title>.*?<\/title>/i.test(inner)) {
          inner = inner.replace(/<title>[\s\S]*?<\/title>/i, `<title>${tags.title}</title>`);
        } else {
          inner = `\n${innerIndent}<title>${tags.title}</title>${inner}`;
        }
      }

      tags.meta.forEach((metaDef, idx) => {
        if (!metaExistsInBlock(inner, metaDef)) {
          inner = inner.replace(/\s*$/, `\n${innerIndent}${metaStrings[idx]}`);
        }
      });

      tags.links.forEach((linkDef, idx) => {
        if (!linkExistsInBlock(inner, linkDef)) {
          inner = inner.replace(/\s*$/, `\n${innerIndent}${linkStrings[idx]}`);
        }
      });

      const rebuilt = `<Teleport to="head">${inner.replace(/^\n/, '')}\n${indent}</Teleport>`;
      templateContent = templateContent.replace(teleportMatch[0], rebuilt);
      changed = true;
    } else {
      const headLines: string[] = ['<Teleport to="head">'];
      if (tags.title) {
        headLines.push(`  <title>${tags.title}</title>`);
      }
      metaStrings.forEach((metaString) => headLines.push(`  ${metaString}`));
      linkStrings.forEach((linkString) => headLines.push(`  ${linkString}`));
      headLines.push('</Teleport>');

      const block = headLines.join('\n') + '\n';
      templateContent = block + templateContent;
      changed = true;
    }
  }

  if (changed) {
    source = source.replace(templateMatch[0], `<template>${templateContent}</template>`);
    await writeFile(targetPath, source, 'utf8');
    return true;
  }

  return false;
}
function buildMetadataExportFromSuggestion(suggestion: AiPageSuggestion): string {
  const lines: string[] = ['export const metadata = {'];

  if (suggestion.title) {
    lines.push(`  title: '${escapeJsString(suggestion.title)}',`);
  }
  if (suggestion.description) {
    lines.push(`  description: '${escapeJsString(suggestion.description)}',`);
  }
  if (suggestion.robots) {
    lines.push(`  robots: '${escapeJsString(suggestion.robots)}',`);
  }
  if (suggestion.canonical) {
    lines.push('  alternates: {');
    lines.push(`    canonical: '${escapeJsString(suggestion.canonical)}'`);
    lines.push('  },');
  }
  if (suggestion.openGraph && Object.keys(suggestion.openGraph).length > 0) {
    lines.push('  openGraph: {');
    Object.entries(suggestion.openGraph).forEach(([key, value]) => {
      if (typeof value === 'string' && value.trim()) {
        lines.push(`    ${key}: '${escapeJsString(value)}',`);
      }
    });
    if (lines[lines.length - 1].endsWith(',')) {
      const last = lines[lines.length - 1];
      lines[lines.length - 1] = last.slice(0, -1);
    }
    lines.push('  },');
  }
  if (suggestion.twitter && Object.keys(suggestion.twitter).length > 0) {
    lines.push('  twitter: {');
    Object.entries(suggestion.twitter).forEach(([key, value]) => {
      if (typeof value === 'string' && value.trim()) {
        lines.push(`    ${key}: '${escapeJsString(value)}',`);
      }
    });
    if (lines[lines.length - 1].endsWith(',')) {
      const last = lines[lines.length - 1];
      lines[lines.length - 1] = last.slice(0, -1);
    }
    lines.push('  },');
  }

  if (lines[lines.length - 1].endsWith(',')) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = last.slice(0, -1);
  }

  lines.push('};');
  return lines.join('\n');
}

async function applyAiSuggestionToNextFile(projectRoot: string, suggestion: AiPageSuggestion): Promise<boolean> {
  const targetPath = path.isAbsolute(suggestion.file)
    ? suggestion.file
    : join(projectRoot, suggestion.file);

  if (!existsSync(targetPath)) {
    return false;
  }

  const ext = path.extname(targetPath).toLowerCase();
  if (!['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
    return false;
  }

  let source = await readFile(targetPath, 'utf8');
  const original = source;
  const normalised = targetPath.replace(/\\/g, '/');
  const isAppRouter = /\/app\//.test(normalised) && /\/page\.(js|jsx|ts|tsx)$/.test(normalised);
  const tags = buildTagsFromSuggestion(suggestion);
  const metaStrings = tags.meta.map(metaTagToString);
  const linkStrings = tags.links.map(linkTagToString);
  let changed = false;

  if (isAppRouter) {
    if (tags.title || tags.meta.length || tags.links.length || suggestion.description || suggestion.robots) {
      const metadataBlock = buildMetadataExportFromSuggestion(suggestion);
      const metadataRegex = /export const metadata = {[\s\S]*?};\s*/;
      if (metadataRegex.test(source)) {
        source = source.replace(metadataRegex, metadataBlock + '\n');
      } else {
        const useClientMatch = source.match(/['"]use client['"];?/);
        let insertIndex = 0;
        if (useClientMatch && useClientMatch.index !== undefined) {
          const end = source.indexOf('\n', useClientMatch.index + useClientMatch[0].length);
          insertIndex = end >= 0 ? end + 1 : useClientMatch.index + useClientMatch[0].length;
        }
        source = source.slice(0, insertIndex) + metadataBlock + '\n' + source.slice(insertIndex);
      }
      changed = true;
    }
  } else {
    if (tags.title || tags.meta.length || tags.links.length) {
      if (!/from\s+['"]next\/head['"]/i.test(source)) {
        const importBlock = "import Head from 'next/head';\n";
        const importMatch = source.match(/^(import[^;]+;\s*\n)+/m);
        if (importMatch) {
          const insertPos = importMatch[0].length;
          source = source.slice(0, insertPos) + importBlock + source.slice(insertPos);
        } else {
          source = importBlock + source;
        }
        changed = true;
      }

      const headRegex = /<Head[\s\S]*?<\/Head>/i;
      const headMatch = headRegex.exec(source);
      if (headMatch) {
        let block = headMatch[0];
        let inner = block.replace(/^<Head[^>]*>/i, '').replace(/<\/Head>$/i, '');
        const indent = headMatch[0].match(/\n([ \t]*)<\/Head>/)?.[1] ?? '  ';
        const innerIndent = indent + '  ';

        if (tags.title) {
          if (/<title>.*?<\/title>/i.test(inner)) {
            inner = inner.replace(/<title>[\s\S]*?<\/title>/i, `<title>${tags.title}</title>`);
          } else {
            inner = `\n${innerIndent}<title>${tags.title}</title>${inner}`;
          }
        }

        tags.meta.forEach((metaDef, idx) => {
          if (!metaExistsInBlock(inner, metaDef)) {
            inner = inner.replace(/\s*$/, `\n${innerIndent}${metaStrings[idx]}`);
          }
        });

        tags.links.forEach((linkDef, idx) => {
          if (!linkExistsInBlock(inner, linkDef)) {
            inner = inner.replace(/\s*$/, `\n${innerIndent}${linkStrings[idx]}`);
          }
        });

        const rebuilt = `<Head>${inner.replace(/^\n/, '')}\n${indent}</Head>`;
        source = source.replace(headMatch[0], rebuilt);
        changed = true;
      } else {
        const returnMatch = /return\s*\(\s*\n?\s*(<[^>]+>)/.exec(source);
        if (returnMatch && returnMatch.index !== undefined) {
          const jsxStart = returnMatch.index + returnMatch[0].length - returnMatch[1].length;
          const tagEnd = source.indexOf('>', jsxStart) + 1;
          const lines = source.slice(0, jsxStart).split('\n');
          const indentation = (lines[lines.length - 1].match(/^\s*/)?.[0] || '  ') + '  ';

          const headLines: string[] = ['<Head>'];
          if (tags.title) {
            headLines.push(`  <title>${tags.title}</title>`);
          }
          metaStrings.forEach((metaString) => headLines.push(`  ${metaString}`));
          linkStrings.forEach((linkString) => headLines.push(`  ${linkString}`));
          headLines.push('</Head>');

          const formatted = headLines
            .map((line) => (line.startsWith('</Head') ? indentation.trimEnd() + line : indentation + line))
            .join('\n') + '\n';

          source = source.slice(0, tagEnd) + '\n' + formatted + source.slice(tagEnd);
          changed = true;
        }
      }
    }
  }

  if (suggestion.h1) {
    const h1Regex = /(<h1[^>]*>)([\s\S]*?)(<\/h1>)/;
    if (h1Regex.test(source)) {
      source = source.replace(h1Regex, `$1${suggestion.h1}$3`);
      changed = true;
    }
  }

  if (suggestion.imageAlts && suggestion.imageAlts.length > 0) {
    const result = applyImageAltSuggestionsInMarkup(source, suggestion.imageAlts);
    if (result.changed) {
      source = result.updated;
      changed = true;
    }
  }

  if (changed && source !== original) {
    await writeFile(targetPath, source, 'utf8');
    return true;
  }

  return false;
}

/**
 * Scans all package.json files in the project for framework dependencies.
 * Returns the first framework found, or 'unknown' if none found.
 */
async function detectFramework(projectRoot: string): Promise<SupportedFramework> {
  const packageJsonFiles = await glob('**/package.json', {
    cwd: projectRoot,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/out/**',
      '**/.git/**',
      '**/coverage/**',
      '**/test/**',
      '**/tests/**',
      '**/__tests__/**',
      '**/__mocks__/**',
      '**/vendor/**',
      '**/public/**'
    ],
    absolute: true,
    dot: true
  });
  for (const pkgPath of packageJsonFiles) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if ('next' in deps) return 'next.js';
      if ('react' in deps || 'react-dom' in deps) return 'react';
      if ('@angular/core' in deps) return 'angular';
      // only allow Vue 3, optimizations are not supported for previous versions
      if ('vue' in deps) {
        const vueVersion = deps['vue'] as string;
        // Check if version starts with "3" (allowing ^, ~, or direct)
        if (/^[\^~]?3(\.|$)/.test(vueVersion)) {
          return 'vue';
        }
      }
    } catch (e) {
      console.error(e)
    }
  }
  return 'unknown';
}

/**
 * Display next steps guidance after optimization
 */
function showNextSteps(robotsCreated: boolean, sitemapCreated: boolean, llmsCreated: boolean, aiUsed: boolean) {
  console.log(chalk.bold.cyan('\nNext Steps to Complete Your SEO Setup:'));
  console.log(chalk.underline.blue('https://cliseo.com/blog/next-steps-seo-setup'));

  console.log(chalk.gray('\npsst... check this out 👇 \nhttps://github.com/cliseo/cliseo'));
}

/**
 * * Main function to optimize SEO for the project.
 */
export async function optimizeCommand(directory: string | undefined, options: { ai?: boolean }) {
  const dir = resolve(directory || '.');
  const spinner = ora('Starting SEO optimization...').start();
  try {
    // Check authentication if AI is requested
    if (options.ai) {
      const { isAuthenticated, hasAiAccess, loadConfig } = await import('../utils/config.js');
      const isAuth = await isAuthenticated();
      const hasAi = await hasAiAccess();

      // Show account status
      spinner.stop();
      if (isAuth) {
        try {
          const config = await loadConfig();
          console.log(chalk.cyan(`👤 ${formatEmailDisplay(config.userEmail || '')}`));
          console.log(chalk.gray(`🤖 AI Access: ${hasAi ? 'Enabled' : 'Disabled'}`));
        } catch {
          console.log(chalk.yellow('👤 Authentication status unclear'));
        }
      } else {
        console.log(chalk.gray('👤 Not logged in'));
      }

      if (!isAuth) {
        console.log(chalk.yellow('\n⚠️  Authentication required for AI features'));
        console.log(chalk.gray('You need to sign in to use AI-powered optimizations.'));

        // Skip interactive prompts in CI/non-TTY environments
        const skipPrompts = process.env.CI === 'true' || !process.stdin.isTTY;

        if (!skipPrompts) {
          const { shouldAuth } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'shouldAuth',
              message: 'Would you like to sign in now?',
              default: true,
            },
          ]);

          if (shouldAuth) {
            console.log(chalk.cyan('\nStarting authentication...'));
            try {
              const { authenticateUser } = await import('../utils/auth.js');
              const authResult = await authenticateUser();

              if (authResult.success) {
                console.log(chalk.cyan(`👤 ${formatEmailDisplay(authResult.email || '')}`));
                console.log(chalk.gray(`🤖 AI Access: ${authResult.aiAccess ? 'Enabled' : 'Disabled'}`));

                if (authResult.aiAccess) {
                  // Continue with AI optimization - spinner will be started in main flow
                } else {
                  console.log(chalk.yellow('\n⚠️  AI features are not enabled for your account.'));
                  console.log(chalk.gray('Upgrade your plan to access AI features.'));
                  return;
                }
              } else {
                console.log(chalk.red('\n❌ Authentication failed:'));
                console.log(chalk.red(authResult.error || 'Unknown error occurred'));
                return;
              }
            } catch (authError) {
              console.log(chalk.red('\n❌ Authentication failed'));
              console.log(chalk.gray('Please try again later or visit https://cliseo.com/ for support.'));
              return;
            }
          } else {
            console.log(chalk.gray('Authentication cancelled.'));
            return;
          }
        } else {
          console.log(chalk.cyan('Please authenticate first:'));
          console.log(chalk.gray('  cliseo auth\n'));
          return;
        }
      }

      if (!hasAi) {
        console.log(chalk.yellow('\n⚠️  AI features are not enabled for your account'));
        console.log(chalk.gray('Your account doesn\'t have access to AI features.'));
        console.log('');
        console.log(chalk.green('Visit https://cliseo.com to upgrade'));
        console.log('');
        return;
      }



      // AI MODE: Do AI optimizations AND create SEO files
      if (!spinner.isSpinning) {
        spinner.start('Running AI-powered optimization...');
      } else {
        spinner.text = 'Running AI-powered optimization...';
      }

      try {
        // First detect framework for SEO files
        const framework = await detectFramework(dir);

        // Get AI analysis and enhanced SEO files from backend
        spinner.text = 'Analyzing project with AI...';
        const aiData = await getAiAnalysis(dir);

        // Create AI-enhanced SEO files if backend provides them
        spinner.text = 'Creating AI-enhanced SEO files...';
        const { robotsCreated, sitemapCreated, llmsCreated } = await createAiSeoFiles(framework, dir, aiData);

        // Apply comprehensive AI optimizations
        spinner.text = 'Applying AI optimizations...';
        const optimizationResults = await applyComprehensiveAiOptimizations(dir, aiData);

        spinner.succeed(chalk.green('✅ AI optimizations applied successfully!'));

        // Show summary of all AI optimizations
        if (optimizationResults && optimizationResults.totalFixes > 0) {
          console.log(chalk.cyan(`🔗 Fixed ${optimizationResults.totalFixes} non-descriptive link${optimizationResults.totalFixes === 1 ? '' : 's'} in ${optimizationResults.filesModified} file${optimizationResults.filesModified === 1 ? '' : 's'}`));
        }

        // Show AI optimization results
        if (robotsCreated || sitemapCreated || llmsCreated) {
          console.log(chalk.cyan('\n📄 AI-Enhanced SEO Files Created:'));
          if (robotsCreated) console.log(chalk.green('  ✔ robots.txt (AI-optimized)'));
          if (sitemapCreated) console.log(chalk.green('  ✔ sitemap.xml (AI-optimized)'));
          if (llmsCreated) console.log(chalk.green('  ✔ llms.txt (AI-optimized)'));
        }

        // Show next steps for AI mode (include SEO files info)
        showNextSteps(robotsCreated, sitemapCreated, llmsCreated, true);
        return; // Exit after showing next steps
      } catch (err) {
        spinner.fail('AI optimization failed');

        // Clean, user-friendly error handling
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        if (errorMessage.includes('Authentication failed')) {
          console.log(chalk.yellow('\n🔒 Authentication expired'));
          console.log(chalk.gray('Your session has expired and you need to sign in again.'));

          // Skip interactive prompts in CI/non-TTY environments
          const skipPrompts = process.env.CI === 'true' || !process.stdin.isTTY;

          if (!skipPrompts) {
            const { shouldAuth } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'shouldAuth',
                message: 'Would you like to sign in now?',
                default: true,
              },
            ]);

            if (shouldAuth) {
              console.log(chalk.cyan('\nStarting authentication...'));
              try {
                const { authenticateUser } = await import('../utils/auth.js');
                const authResult = await authenticateUser();

                if (authResult.success) {
                  console.log(chalk.cyan(`👤 ${formatEmailDisplay(authResult.email || '')}`));
                  console.log(chalk.gray(`🤖 AI Access: ${authResult.aiAccess ? 'Enabled' : 'Disabled'}`));

                  if (authResult.aiAccess) {
                    console.log(chalk.cyan('\n🔄 Retrying AI optimization...'));
                    await performAiOptimizations(dir);
                    console.log(chalk.green('✅ AI optimizations applied successfully!'));
                    showNextSteps(false, false, false, true);
                    return;
                  } else {
                    console.log(chalk.yellow('\n⚠️  AI features are not enabled for your account.'));
                    console.log(chalk.gray('Upgrade your plan to access AI features.'));
                  }
                } else {
                  console.log(chalk.red('\n❌ Authentication failed:'));
                  console.log(chalk.red(authResult.error || 'Unknown error occurred'));
                }
              } catch (authError) {
                console.log(chalk.red('\n❌ Authentication failed'));
                console.log(chalk.gray('Please try again later or visit https://cliseo.com/ for support.'));
              }
            } else {
              console.log(chalk.gray('Authentication cancelled.'));
            }
          } else {
            console.log(chalk.cyan('Please authenticate first:'));
            console.log(chalk.white('  cliseo auth'));
            console.log(chalk.gray('\nThen try running the AI optimization again.'));
          }
        } else if (errorMessage.includes('AI features not enabled')) {
          console.log(chalk.yellow('\n⚠️  AI features not available'));
          console.log(chalk.gray('There\'s a permission mismatch with your account.'));

          // Skip interactive prompts in CI/non-TTY environments
          const skipPrompts = process.env.CI === 'true' || !process.stdin.isTTY;

          if (!skipPrompts) {
            const { action } = await inquirer.prompt([
              {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: [
                  { name: 'Sign out and try again (recommended)', value: 'logout' },
                  { name: 'Use standard optimization instead', value: 'standard' },
                  { name: 'Cancel', value: 'cancel' }
                ],
              },
            ]);

            if (action === 'logout') {
              console.log(chalk.cyan('\n🔓 Signing you out...'));
              try {
                const { logoutUser } = await import('../utils/auth.js');
                await logoutUser();
                console.log(chalk.green('✅ Successfully signed out'));
                console.log(chalk.gray('Please run the command again to sign in with fresh credentials.'));
              } catch (logoutError) {
                console.log(chalk.red('❌ Failed to sign out'));
                console.log(chalk.gray('You may need to clear your credentials manually.'));
              }
            } else if (action === 'standard') {
              console.log(chalk.cyan('\n🔄 Switching to standard optimization...'));
              // Restart the command with standard optimization
              return optimizeCommand(directory, { ...options, ai: false });
            } else {
              console.log(chalk.gray('Operation cancelled.'));
            }
          } else {
            console.log(chalk.cyan('Options:'));
            console.log(chalk.white('  • Sign out and retry: cliseo auth (logout) && cliseo optimize --ai'));
            console.log(chalk.white('  • Use standard optimization: cliseo optimize'));
          }
        } else if (errorMessage.includes('AI service temporarily unavailable')) {
          console.log(chalk.yellow('\n⚠️  AI service temporarily unavailable'));
          console.log(chalk.gray('Please try again in a few minutes.'));
        } else if (errorMessage.includes('Could not gather enough website context')) {
          console.log(chalk.yellow('\n⚠️  Insufficient content for AI analysis'));
          console.log(chalk.gray('AI needs a README.md file or page components to analyze.'));
          console.log(chalk.cyan('To fix this:'));
          console.log(chalk.white('  • Add a README.md file describing your project'));
          console.log(chalk.white('  • Or use standard optimization: cliseo optimize'));
        } else {
          console.log(chalk.yellow('\n⚠️  AI optimization failed'));
          console.log(chalk.gray(`Error: ${errorMessage}`));
        }

        console.log(''); // Add spacing
        process.exit(1);
      }

      return; // Exit here - AI mode doesn't do standard optimizations
    }

    // STANDARD MODE: Do traditional rule-based optimizations
    spinner.text = 'Running standard SEO optimizations...';

    const framework: SupportedFramework = await detectFramework(dir);

    spinner.text = 'Ensuring baseline SEO files...';
    const seoFileResult = await ensureSeoAssets(dir, { framework });

    spinner.text = 'Applying baseline HTML optimizations...';
    const htmlResults = await optimizeHtmlLikeFiles(dir, framework);
    const htmlTouched = htmlResults.length;

    spinner.stop();

    const frameWorkColor = framework === 'react' ? chalk.blue : chalk.gray;
    console.log(chalk.bold('\nDetected Framework: ' + frameWorkColor(framework.toUpperCase())));

    // Framework-specific optimizations
    if (framework === 'react') {
      spinner.start('Optimizing React components...');
      try {
        await optimizeReactComponents(dir);
        spinner.stop();
      } catch (err) {
        spinner.fail('Failed to optimize React components');
        console.log(chalk.yellow('⚠️  Could not optimize some React components'));
      }
    } else if (framework === 'next.js') {
      spinner.start('Optimizing Next.js components...');
      try {
        await optimizeNextjsComponents(dir);
        spinner.stop();
      } catch (err) {
        spinner.fail('Failed to optimize Next.js components');
        console.log(chalk.yellow('⚠️  Could not optimize some Next.js components'));
      }
    } else if (framework === 'angular') {
      spinner.start('Running Angular HTML SEO enhancements...');
      spinner.succeed('Angular HTML SEO enhancements complete.');
    }
    else if (framework == 'vue') {
      spinner.start('Optimizing Vue components...');
      try {
        await optimizeVueComponents(dir);
        spinner.stop();
      } catch (err) {
        spinner.fail('Failed to optimize Vue components');
        console.log(chalk.yellow('⚠️  Could not optimize some Vue components'));
      }
    }
    else if (framework === 'unknown') {
      console.log(chalk.yellow('⚠️  Unknown framework detected. Only basic SEO files were created.'));
    }

    console.log(chalk.bold.green('\nSEO optimization complete!'));

    // Show next steps guidance
    if (htmlTouched > 0) {
      const totalMeta = htmlResults.reduce((sum, result) => sum + result.addedMeta, 0);
      const totalAlts = htmlResults.reduce((sum, result) => sum + result.altUpdated, 0);
      const headingsAdded = htmlResults.filter((result) => result.h1Added).length;
      console.log(
        chalk.gray(
          `Updated ${htmlTouched} HTML file${htmlTouched === 1 ? '' : 's'} (meta added: ${totalMeta}, alt text added: ${totalAlts}, h1 inserted: ${headingsAdded}).`,
        ),
      );
    }

    showNextSteps(seoFileResult.robotsCreated, seoFileResult.sitemapCreated, seoFileResult.llmsCreated, options.ai || false);

    // Skip interactive prompts in CI/non-TTY environments
    const skipPrompts = process.env.CI === 'true' || !process.stdin.isTTY;

    if (!skipPrompts) {
      // --- PR creation functionality temporarily disabled ---
      /*
      // Check if we're in a git repository
      try {
        execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });

        // Ask about creating a PR
        const { createPr } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'createPr',
            message: 'Would you like to create a Pull Request with these changes?',
            default: false
          }
        ]);

        if (createPr) {
          spinner.start('Creating Pull Request...');
          try {
            // Create a new branch
            const branchName = `seo-optimization-${Date.now()}`;
            execSync(`git checkout -b ${branchName}`);

            // Add and commit changes
            execSync('git add .');
            execSync('git commit -m "chore: SEO optimizations"');

            // Push branch and create PR
            execSync(`git push -u origin ${branchName}`);

            // Get the current repository URL
            const repoUrl = execSync('git config --get remote.origin.url').toString().trim();
            const prUrl = repoUrl.replace('.git', `/compare/${branchName}`);

            spinner.succeed(chalk.green('Pull Request created!'));
            console.log(chalk.cyan(`PR URL: ${prUrl}`));
          } catch (error) {
            spinner.fail(chalk.red('Failed to create Pull Request.'));
            console.error(error);
          }
        }
      } catch (error) {
        // Not inside a git repository; silently skip PR creation
      }
      */
      // --- End PR creation functionality ---
    }
  } catch (error) {
    spinner.fail(chalk.red('Optimization failed'));
    console.log(chalk.yellow('\n⚠️  An unexpected error occurred'));

    if (error instanceof Error) {
      console.log(chalk.gray(`Error: ${error.message}`));
    }

    console.log(chalk.cyan('\nTroubleshooting:'));
    console.log(chalk.white('  • Check that you\'re in a valid project directory'));
    console.log(chalk.white('  • Ensure you have write permissions'));
    console.log(chalk.white('  • Check the project structure and try again'));
    console.log('');
    process.exit(1);
  }
}



/**
 * Get project name from package.json or directory name
 */
async function getProjectName(projectRoot: string): Promise<string> {
  try {
    const packageJsonPath = join(projectRoot, 'package.json');
    if (existsSync(packageJsonPath)) {
      const pkg = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
      return pkg.name || basename(projectRoot);
    }
  } catch (error) {
    // Fallback to directory name
  }
  return basename(projectRoot);
}



/**
 * Create AI-enhanced SEO files using backend response (fallback to standard if no seo_files)
 */
async function createAiSeoFiles(framework: SupportedFramework, projectRoot: string, aiData: any): Promise<{ robotsCreated: boolean; sitemapCreated: boolean; llmsCreated: boolean }> {
  // If backend provides enhanced SEO files, use them
  if (aiData.seo_files) {
    let robotsCreated = false;
    let sitemapCreated = false;
    let llmsCreated = false;

    let targetDir = projectRoot;
    if (framework === 'react' || framework === 'next.js') {
      targetDir = join(projectRoot, 'public');
    }

    await fs.promises.mkdir(targetDir, { recursive: true });

    const robotsPath = join(targetDir, 'robots.txt');
    const sitemapPath = join(targetDir, 'sitemap.xml');
    const llmsPath = join(targetDir, 'llms.txt');

    if (aiData.seo_files.robots_txt && !existsSync(robotsPath)) {
      await writeFile(robotsPath, aiData.seo_files.robots_txt, 'utf8');
      robotsCreated = true;
    }

    if (aiData.seo_files.sitemap_xml && !existsSync(sitemapPath)) {
      await writeFile(sitemapPath, aiData.seo_files.sitemap_xml, 'utf8');
      sitemapCreated = true;
    }

    if (aiData.seo_files.llms_txt && !existsSync(llmsPath)) {
      await writeFile(llmsPath, aiData.seo_files.llms_txt, 'utf8');
      llmsCreated = true;
    }

    return { robotsCreated, sitemapCreated, llmsCreated };
  }

  // Fallback to standard SEO files if backend doesn't provide enhanced ones
  const fallback = await ensureSeoAssets(projectRoot, { framework });
  return {
    robotsCreated: fallback.robotsCreated,
    sitemapCreated: fallback.sitemapCreated,
    llmsCreated: fallback.llmsCreated,
  };
}

/**
 * Get comprehensive AI analysis data for the project using unified API call
 */
async function getAiAnalysis(projectDir: string): Promise<any> {
  try {
    const { getAuthToken } = await import('../utils/config.js');
    const token = await getAuthToken();

    if (!token) {
      throw new Error('Authentication token not found');
    }

    // Gather comprehensive project context
    const projectContext = await gatherComprehensiveContext(projectDir);

    if (projectContext.pages.length === 0) {
      throw new Error('Could not gather enough website context for AI analysis');
    }

    // Send unified request to backend
    const apiBase = process.env.API_URL || process.env.CLISEO_API_URL || 'https://a8iza6csua.execute-api.us-east-2.amazonaws.com';
    if (!apiBase) {
      throw new Error('Missing API base URL. Set API_URL or CLISEO_API_URL in your environment.');
    }
    
    const response = await axios.post(`${apiBase}/ask-openai`, {
      readme: projectContext.readme,
      pages: projectContext.pages,
      components: projectContext.components,
      routes: projectContext.routes,
      package: projectContext.package,
      request_type: 'full_optimization'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('Authentication failed. Please run `cliseo auth` to re-authenticate.');
      } else if (error.response?.status === 403) {
        throw new Error('AI features not enabled for your account. Please upgrade your plan.');
      } else if (error.response?.status === 500) {
        throw new Error('AI service temporarily unavailable. Please try again later.');
      }
    }

    throw new Error(`AI optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Perform AI-powered optimizations using authenticated backend (legacy function kept for compatibility)
 */
async function performAiOptimizations(projectDir: string): Promise<void> {
  const aiData = await getAiAnalysis(projectDir);
  await applyAiOptimizationsToComponents(projectDir, aiData);
}

/**
 * Gather website context for AI analysis
 */
async function gatherComprehensiveContext(projectDir: string): Promise<{ 
  readme: string,
  pages: string[],
  components: Array<{ path: string, content: string }>,
  routes: string[],
  package?: { name?: string; description?: string }
}> {
  const context = {
    readme: '',
    pages: [] as string[],
    components: [] as Array<{path: string, content: string}>,
    routes: [] as string[],
    package: undefined as { name?: string; description?: string } | undefined,
  };

  // Try to read README (with size limit)
  const readmeFiles = ['README.md', 'readme.md', 'README.txt', 'readme.txt'];
  for (const readmeFile of readmeFiles) {
    try {
      const readmePath = join(projectDir, readmeFile);
      if (existsSync(readmePath)) {
        let readmeContent = await readFile(readmePath, 'utf-8');
        // Truncate README if too long
        if (readmeContent.length > 2000) {
          readmeContent = readmeContent.substring(0, 2000) + '...[truncated]';
        }
        context.readme = readmeContent;
        break;
      }
    } catch (error) {
      // Continue to next README file
    }
  }

  try {
    const pkg = JSON.parse(await readFile(join(projectDir, 'package.json'), 'utf-8'));
    context.package = { name: pkg.name, description: pkg.description };
  } catch (error) {
    // Optional metadata
  }

  // Gather page components for content analysis
  const framework = await detectFramework(projectDir);
  const pageDirectories = getPagesDirectory(projectDir, framework);

  const maxTotalPagesSize = 3000;
  let currentPagesSize = 0;

  for (const pagesDir of pageDirectories) {
    try {
      const pageFiles = await glob('**/*.{js,jsx,ts,tsx,vue}', {
        cwd: pagesDir,
        absolute: true,
        ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*']
      });

      // Read page files for content analysis
      const limitedFiles = pageFiles.slice(0, 3);

      for (const file of limitedFiles) {
        if (currentPagesSize >= maxTotalPagesSize) {
          break;
        }

        try {
          let content = await readFile(file, 'utf-8');
          const relativePath = path.relative(projectDir, file);
          context.routes.push(relativePath);

          // Truncate individual file content if needed
          const maxFileSize = 1000;
          if (content.length > maxFileSize) {
            content = content.substring(0, maxFileSize) + '...[truncated]';
          }

          const fileEntry = `File: ${relativePath}\n${content}\n\n`;

          // Check if adding this file would exceed our total limit
          if (currentPagesSize + fileEntry.length <= maxTotalPagesSize) {
            context.pages.push(fileEntry);
            currentPagesSize += fileEntry.length;
          } else {
            // Add what we can of this file
            const remainingSpace = maxTotalPagesSize - currentPagesSize;
            if (remainingSpace > 100) {
              const truncatedEntry = fileEntry.substring(0, remainingSpace) + '...[truncated]';
              context.pages.push(truncatedEntry);
            }
            break;
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }

  // Gather component files for link analysis
  try {
    const componentFiles = await glob('src/**/*.{js,jsx,ts,tsx,vue}', {
      cwd: projectDir,
      absolute: true,
      ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*', '**/*.d.ts']
    });

    // Limit to 5 components to avoid oversized requests
    const limitedComponents = componentFiles.slice(0, 5);

    for (const file of limitedComponents) {
      try {
        let content = await readFile(file, 'utf-8');
        
        // Truncate large files
        if (content.length > 800) {
          content = content.substring(0, 800) + '...[truncated]';
        }
        
        const relativePath = path.relative(projectDir, file);
        context.components.push({
          path: relativePath,
          content: content
        });
        
      } catch (error) {
        // Skip files that can't be read
      }
    }
  } catch (error) {
    // Continue without components if glob fails
  }



  return context;
}

// Legacy function kept for backward compatibility
async function gatherWebsiteContext(projectDir: string): Promise<{ readme: string, pages: string[] }> {
  const context = {
    readme: '',
    pages: [] as string[]
  };

  // Try to read README (with size limit)
  const readmeFiles = ['README.md', 'readme.md', 'README.txt', 'readme.txt'];
  for (const readmeFile of readmeFiles) {
    try {
      const readmePath = join(projectDir, readmeFile);
      if (existsSync(readmePath)) {
        let readmeContent = await readFile(readmePath, 'utf-8');
        // Truncate README if too long (prioritize README with generous limit)
        if (readmeContent.length > 2000) {
          readmeContent = readmeContent.substring(0, 2000) + '...[truncated]';
        }
        context.readme = readmeContent;
        break;
      }
    } catch (error) {
      // Continue to next README file
    }
  }

  // Gather page components (with size limits)
  const framework = await detectFramework(projectDir);
  const pageDirectories = getPagesDirectory(projectDir, framework);

  const maxTotalPagesSize = 3000; // Remaining space after README
  let currentPagesSize = 0;

  for (const pagesDir of pageDirectories) {
    try {
      const pageFiles = await glob('**/*.{js,jsx,ts,tsx,vue}', {
        cwd: pagesDir,
        absolute: true,
        ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*']
      });

      // Read up to 3 page files for context (reduced from 5 to manage size)
      const limitedFiles = pageFiles.slice(0, 3);

      for (const file of limitedFiles) {
        if (currentPagesSize >= maxTotalPagesSize) {
          break; // Stop if we've hit our size limit
        }

        try {
          let content = await readFile(file, 'utf-8');
          const relativePath = path.relative(projectDir, file);

          // Truncate individual file content if needed
          const maxFileSize = 1000; // Max size per file
          if (content.length > maxFileSize) {
            content = content.substring(0, maxFileSize) + '...[truncated]';
          }

          const fileEntry = `File: ${relativePath}\n${content}\n\n`;

          // Check if adding this file would exceed our total limit
          if (currentPagesSize + fileEntry.length <= maxTotalPagesSize) {
            context.pages.push(fileEntry);
            currentPagesSize += fileEntry.length;
          } else {
            // Add what we can of this file
            const remainingSpace = maxTotalPagesSize - currentPagesSize;
            if (remainingSpace > 100) { // Only add if we have meaningful space left
              const truncatedEntry = fileEntry.substring(0, remainingSpace) + '...[truncated]';
              context.pages.push(truncatedEntry);
            }
            break;
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }



  return context;
}

/**
 * Apply comprehensive AI optimizations from unified response
 */
async function applyComprehensiveAiOptimizations(projectDir: string, aiData: any): Promise<{ totalFixes: number; filesModified: number }> {
  let totalFixes = 0;
  let filesModified = 0;

  try {
    const suggestions = extractAiSuggestions(aiData);

    if (suggestions.length > 0) {
      for (const suggestion of suggestions) {
        const resolvedPath = path.isAbsolute(suggestion.file)
          ? suggestion.file
          : join(projectDir, suggestion.file);
        const ext = path.extname(resolvedPath).toLowerCase();
        const normalised = resolvedPath.replace(/\\/g, '/');
        const frameworkHint = suggestion.framework;
        let applied = false;

        if (ext === '.html') {
          applied = await applyAiSuggestionToHtmlFile(projectDir, suggestion);
        } else if (ext === '.vue' || frameworkHint === 'vue') {
          applied = await applyAiSuggestionToVueFile(projectDir, suggestion);
        } else if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
          const isNext =
            frameworkHint === 'next' || /\/app\//.test(normalised) || /\/pages\//.test(normalised) || /next\//i.test(normalised);
          if (isNext) {
            applied = await applyAiSuggestionToNextFile(projectDir, suggestion);
          } else {
            applied = await applyAiSuggestionToReactFile(projectDir, suggestion);
          }
        }

        if (applied) {
          filesModified += 1;
          totalFixes += 1;
        }
      }

      const linkFixResults = await applyLinkTextFixes(projectDir);
      if (linkFixResults) {
        totalFixes += linkFixResults.totalFixes;
        filesModified += linkFixResults.filesModified;
      }

      return { totalFixes, filesModified };
    }

    // Fallback to legacy behaviour if no structured suggestions returned
    await applyAiOptimizationsToComponents(projectDir, aiData);
    const linkFixResults = await applyLinkTextFixes(projectDir);
    if (linkFixResults) {
      totalFixes += linkFixResults.totalFixes;
      filesModified += linkFixResults.filesModified;
    }
    return { totalFixes, filesModified };

  } catch (error) {
    return { totalFixes, filesModified };
  }
}

/**
 * Apply AI-generated optimizations to React/Next.js components (legacy)
 */
async function applyAiOptimizationsToComponents(projectDir: string, aiSuggestions: any): Promise<void> {
  try {
    // Parse the AI response
    let aiData;
    if (typeof aiSuggestions === 'string') {
      aiData = JSON.parse(aiSuggestions);
    } else if (aiSuggestions.response) {
      aiData = JSON.parse(aiSuggestions.response);
    } else {
      aiData = aiSuggestions;
    }



    // Detect framework and get page files
    const framework = await detectFramework(projectDir);
    const pageFiles = await getFilesToOptimize(projectDir, framework);

    // Filter for React/Next.js component files
    const componentFiles = pageFiles.filter(file =>
      file.endsWith('.jsx') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.ts')
    );

    if (componentFiles.length === 0) {
      console.log(chalk.yellow('No React/Next.js component files found to optimize with AI.'));
      return;
    }

    let modifiedCount = 0;

    for (const file of componentFiles) {
      try {
        const modified = await injectAiMetadata(file, aiData);
        if (modified) {
          modifiedCount++;
        }
      } catch (error) {

      }
    }

    console.log(chalk.green(`✅ Applied AI metadata to ${modifiedCount} component(s)`));

  } catch (error) {
    throw new Error('Invalid AI response format');
  }
}

/**
 * Inject AI-generated metadata into a React component file using string manipulation
 * to preserve original formatting (similar to optimize-react.ts approach)
 */
async function injectAiMetadata(filePath: string, aiData: any): Promise<boolean> {
  const fs = await import('fs');

  try {
    const source = await fs.promises.readFile(filePath, 'utf-8');
    let modifiedSource = source;
    let modified = false;

    // Check if react-helmet is already imported
    const hasHelmetImport = /import.*{.*Helmet.*}.*from.*['"]react-helmet['"]/.test(source);

    // Check if Helmet is already being used
    const hasHelmetUsage = /<Helmet[\s>]/.test(source);

    if (hasHelmetUsage) {
      return false;
    }

    // Add import if missing - preserve original import formatting
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

    // Find JSX return statements and add Helmet - preserve original formatting
    const returnMatches = [...modifiedSource.matchAll(/return\s*\(\s*\n?\s*(<[^>]+>)/g)];

    for (const match of returnMatches) {
      const jsxStart = match.index! + match[0].length - match[1].length;

      // Find the opening JSX tag
      const openingTag = match[1];
      const tagEnd = modifiedSource.indexOf('>', jsxStart) + 1;

      // Find the indentation of the JSX element to match existing style
      const lines = modifiedSource.slice(0, jsxStart).split('\n');
      const lastLine = lines[lines.length - 1];
      const indentation = lastLine.match(/^\s*/)?.[0] || '    ';

      // Create AI-powered Helmet element with proper formatting
      const helmetElement = createAiHelmetString(aiData, indentation);

      // Insert Helmet right after the opening tag, preserving original formatting
      modifiedSource =
        modifiedSource.slice(0, tagEnd) +
        '\n' + indentation + helmetElement +
        modifiedSource.slice(tagEnd);
      modified = true;
      break; // Only modify the first return statement
    }

    if (modified) {
      await fs.promises.writeFile(filePath, modifiedSource, 'utf-8');
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Create AI-powered Helmet JSX string with proper formatting (no AST transformation)
 */
function createAiHelmetString(aiData: any, indentation: string): string {
  const indent = indentation;
  const innerIndent = indentation + '  ';

  let helmet = `<Helmet>`;

  // Title
  if (aiData.title) {
    helmet += `\n${innerIndent}<title>${aiData.title}</title>`;
  }

  // Meta description
  if (aiData.description) {
    helmet += `\n${innerIndent}<meta name="description" content="${aiData.description}" />`;
  }

  // Keywords
  if (aiData.keywords) {
    helmet += `\n${innerIndent}<meta name="keywords" content="${aiData.keywords}" />`;
  }

  // Open Graph tags
  if (aiData.og_title) {
    helmet += `\n${innerIndent}<meta property="og:title" content="${aiData.og_title}" />`;
  }

  if (aiData.og_description) {
    helmet += `\n${innerIndent}<meta property="og:description" content="${aiData.og_description}" />`;
  }

  // Twitter Card tags
  if (aiData.twitter_title) {
    helmet += `\n${innerIndent}<meta name="twitter:title" content="${aiData.twitter_title}" />`;
  }

  if (aiData.twitter_description) {
    helmet += `\n${innerIndent}<meta name="twitter:description" content="${aiData.twitter_description}" />`;
  }

  helmet += `\n${indent}</Helmet>`;

  return helmet;
}



/**
 * Analyzes the project structure to provide context for AI optimizations.
 * This is a placeholder and would require a real implementation to fetch
 * actual project data (e.g., from package.json, git, etc.)
 */
async function analyzeProject(projectDir: string): Promise<ProjectAnalysis> {
  const packageJsonPath = join(projectDir, 'package.json');
  if (existsSync(packageJsonPath)) {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return {
      projectName: pkg.name || 'Your Project',
      description: pkg.description || 'A description of your project.',
    };
  }
  return {
    projectName: 'Your Project',
    description: 'No package.json found. Cannot provide detailed analysis.',
  };
}

/**
 * Apply AI-generated link text fixes to project files
 */
async function applyLinkTextFixes(projectDir: string): Promise<{ totalFixes: number; filesModified: number }> {
  try {
    const { getAuthToken } = await import('../utils/config.js');
    const token = await getAuthToken();

    if (!token) {
      return null;
    }

    // Get all relevant files to scan for link issues
    const framework = await detectFramework(projectDir);
    const files = await getFilesToOptimize(projectDir, framework);

    // Filter for files that can contain links
    const linkFiles = files.filter(file =>
      file.endsWith('.jsx') || file.endsWith('.tsx') ||
      file.endsWith('.js') || file.endsWith('.ts') ||
      file.endsWith('.vue') || file.endsWith('.html')
    );

    if (linkFiles.length === 0) {
      return null;
    }

    let totalFixesApplied = 0;
    let filesModified = 0;

    // Process files in smaller batches to avoid overwhelming the API
    const batchSize = 3;
    for (let i = 0; i < linkFiles.length; i += batchSize) {
      const batch = linkFiles.slice(i, i + batchSize);

      const batchPromises = batch.map(async (file) => {
        try {
          const fixesApplied = await fixLinksInFile(file, token);
          if (fixesApplied > 0) {
            return { file, fixes: fixesApplied };
          }
          return null;
        } catch (error) {
          if (false) {
            console.warn(chalk.yellow(`Failed to fix links in ${file}: ${error}`));
          }
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        if (result) {
          totalFixesApplied += result.fixes;
          filesModified++;
        }
      }

      // Small delay between batches to be respectful to the API
      if (i + batchSize < linkFiles.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return {
      totalFixes: totalFixesApplied,
      filesModified: filesModified
    };

  } catch (error) {
    if (false) {
      console.error(chalk.red('Error applying link text fixes:'), error);
    }
    // Don't throw - this is a non-critical enhancement
    return { totalFixes: 0, filesModified: 0 };
  }
}

/**
 * Fix non-descriptive links in a single file using AI analysis
 */
async function fixLinksInFile(filePath: string, authToken: string): Promise<number> {
  const fs = await import('fs');

  try {
    // Read file content
    const originalContent = await fs.promises.readFile(filePath, 'utf-8');

    // Skip files that are too large to avoid token limits
    if (originalContent.length > 10000) {
      if (false) {
        console.log(chalk.gray(`Skipping large file: ${filePath}`));
      }
      return 0;
    }

    // Make request to backend for link analysis
    const response = await axios.post('https://a8iza6csua.execute-api.us-east-2.amazonaws.com/ask-openai', {
      prompt: `Analyze and fix non-descriptive link text in this file:\n\nFile: ${filePath}`,
      context: 'seo-analysis',
      file_content: originalContent,
      file_path: filePath
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000
    });

    const responseData = response.data;
    let fixesApplied = 0;
    let modifiedContent = originalContent;

    // Apply structured AI fixes if available
    if (responseData.structured_analysis && responseData.structured_analysis.issues) {
      for (const issue of responseData.structured_analysis.issues) {
        if (issue.type === 'link_text' && issue.original && issue.suggested_fix) {
          // Apply the fix using string replacement
          const beforeCount = (modifiedContent.match(new RegExp(escapeRegExp(issue.original), 'g')) || []).length;
          modifiedContent = modifiedContent.replace(new RegExp(escapeRegExp(issue.original), 'g'), issue.suggested_fix);
          const afterCount = (modifiedContent.match(new RegExp(escapeRegExp(issue.original), 'g')) || []).length;

          if (beforeCount > afterCount) {
            fixesApplied += (beforeCount - afterCount);
            if (false) {
              console.log(chalk.cyan(`  Fixed: "${issue.original}" → "${issue.suggested_fix}"`));
            }
          }
        }
      }
    }

    // Apply regex-detected fixes if available
    if (responseData.link_issues && responseData.link_issues.length > 0) {
      for (const linkIssue of responseData.link_issues) {
        // For regex-detected issues, we need to generate better replacement text
        const betterText = generateBetterLinkText(linkIssue.text, linkIssue.href);
        if (betterText && betterText !== linkIssue.text) {
          const originalElement = linkIssue.full_element;
          const improvedElement = originalElement.replace(linkIssue.text, betterText);

          const beforeCount = (modifiedContent.match(new RegExp(escapeRegExp(originalElement), 'g')) || []).length;
          modifiedContent = modifiedContent.replace(new RegExp(escapeRegExp(originalElement), 'g'), improvedElement);
          const afterCount = (modifiedContent.match(new RegExp(escapeRegExp(originalElement), 'g')) || []).length;

          if (beforeCount > afterCount) {
            fixesApplied += (beforeCount - afterCount);
            if (false) {
              console.log(chalk.cyan(`  Fixed: "${linkIssue.text}" → "${betterText}"`));
            }
          }
        }
      }
    }

    // Write back the modified content if changes were made
    if (fixesApplied > 0) {
      await fs.promises.writeFile(filePath, modifiedContent, 'utf-8');
      if (false) {
        console.log(chalk.green(`✅ Applied ${fixesApplied} link fix${fixesApplied === 1 ? '' : 'es'} to ${filePath}`));
      }
    }

    return fixesApplied;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 503) {
        if (false) {
          console.log(chalk.yellow('AI service temporarily unavailable for link fixes'));
        }
      } else if (false) {
        console.log(chalk.yellow(`AI request failed for ${filePath}: ${error.response?.data?.error || error.message}`));
      }
    } else if (false) {
      console.log(chalk.yellow(`Error fixing links in ${filePath}: ${error}`));
    }
    return 0;
  }
}

/**
 * Generate better link text based on href and current text
 */
function generateBetterLinkText(currentText: string, href: string): string {
  const text = currentText.toLowerCase().trim();

  // Don't change if it's already reasonably descriptive
  if (text.length > 10 && !['here', 'click here', 'read more', 'learn more', 'more', 'this', 'link'].includes(text)) {
    return currentText;
  }

  // Generate better text based on href
  if (href.includes('/about')) return 'about us';
  if (href.includes('/contact')) return 'contact us';
  if (href.includes('/pricing')) return 'view pricing';
  if (href.includes('/docs') || href.includes('/documentation')) return 'documentation';
  if (href.includes('/blog')) return 'blog';
  if (href.includes('/support')) return 'support';
  if (href.includes('/help')) return 'help center';
  if (href.includes('/signup') || href.includes('/register')) return 'sign up';
  if (href.includes('/login') || href.includes('/signin')) return 'sign in';
  if (href.includes('/download')) return 'download';
  if (href.includes('/features')) return 'features';
  if (href.includes('/api')) return 'API documentation';
  if (href.includes('/rate-limits')) return 'rate limits documentation';
  if (href.includes('/terms')) return 'terms of service';
  if (href.includes('/privacy')) return 'privacy policy';

  // Extract meaningful parts from path
  const pathParts = href.split('/').filter(part => part && !part.includes('.'));
  if (pathParts.length > 0) {
    const lastPart = pathParts[pathParts.length - 1];
    // Convert kebab-case or snake_case to readable text
    const readable = lastPart.replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    if (readable.length > 2) {
      return readable;
    }
  }

  // Fallback: return original if we can't improve it
  return currentText;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
