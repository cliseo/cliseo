import type { CheerioAPI } from 'cheerio';
import { BASIC_PLACEHOLDERS, HeadDefaults, getBasicHeadDefaults } from './seoTemplates.js';

function ensureHeadExists($: CheerioAPI) {
  if (!$('head').length) {
    $('html').prepend('<head></head>');
  }
}

export function ensureHtmlLanguage($: CheerioAPI, language = BASIC_PLACEHOLDERS.language): boolean {
  const html = $('html');
  if (!html.attr('lang')) {
    html.attr('lang', language);
    return true;
  }
  return false;
}

export function ensureHeadDefaults($: CheerioAPI, defaults: HeadDefaults = getBasicHeadDefaults()): { addedTitle: boolean; addedMeta: number; addedLinks: number } {
  ensureHeadExists($);
  const result = { addedTitle: false, addedMeta: 0, addedLinks: 0 };
  const head = $('head');

  if (!$('head > title').length) {
    head.prepend(`<title>${defaults.title}</title>`);
    result.addedTitle = true;
  }

  const existingNames = new Set<string>();
  const existingProperties = new Set<string>();
  $('meta[name]').each((_, el) => {
    const name = $(el).attr('name');
    if (name) existingNames.add(name.toLowerCase());
  });
  $('meta[property]').each((_, el) => {
    const property = $(el).attr('property');
    if (property) existingProperties.add(property.toLowerCase());
  });

  defaults.meta.forEach((meta) => {
    if (meta.name) {
      if (!existingNames.has(meta.name.toLowerCase())) {
        head.append(`<meta name="${meta.name}" content="${meta.content}" />`);
        result.addedMeta += 1;
      }
      return;
    }
    if (meta.property) {
      if (!existingProperties.has(meta.property.toLowerCase())) {
        head.append(`<meta property="${meta.property}" content="${meta.content}" />`);
        result.addedMeta += 1;
      }
    }
  });

  const existingLinks = new Set<string>();
  $('link[rel]').each((_, el) => {
    const rel = $(el).attr('rel');
    if (rel) existingLinks.add(rel.toLowerCase());
  });

  defaults.links.forEach((link) => {
    if (!existingLinks.has(link.rel.toLowerCase())) {
      head.append(`<link rel="${link.rel}" href="${link.href}" />`);
      result.addedLinks += 1;
    }
  });

  return result;
}

export function ensurePrimaryHeading($: CheerioAPI, placeholder = BASIC_PLACEHOLDERS.h1): boolean {
  if ($('h1').length > 0) {
    return false;
  }

  const body = $('body');
  if (!body.length) {
    $('html').append('<body></body>');
  }
  $('body').prepend(`<h1>${placeholder}</h1>`);
  return true;
}

export function ensureImageAltAttributes($: CheerioAPI, placeholder = BASIC_PLACEHOLDERS.imageAlt): number {
  let updated = 0;
  $('img').each((_, img) => {
    const currentAlt = $(img).attr('alt');
    if (!currentAlt || !currentAlt.trim()) {
      $(img).attr('alt', placeholder);
      updated += 1;
    }
  });
  return updated;
}

export function ensureGeoMeta($: CheerioAPI): number {
  const head = $('head');
  if (!head.length) return 0;
  let added = 0;

  const ensureMeta = (selector: string, markup: string) => {
    if (!head.find(selector).length) {
      head.append(markup);
      added += 1;
    }
  };

  ensureMeta('meta[property="og:locale"]', '<meta property="og:locale" content="en_US" />');
  ensureMeta('meta[name="content-language"]', '<meta name="content-language" content="en-US" />');
  ensureMeta('meta[name="geo.region"]', '<meta name="geo.region" content="US-CA" />');
  ensureMeta('meta[name="geo.position"]', '<meta name="geo.position" content="0;0" />');
  ensureMeta('meta[name="ICBM"]', '<meta name="ICBM" content="0,0" />');

  return added;
}
