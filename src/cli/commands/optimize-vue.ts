// optimizeVueComponents.ts
import { readFileSync, writeFileSync } from 'fs';
import path, { join } from 'path';
import { glob } from 'glob';
import { execSync } from 'child_process';

const SEO_HEAD_BLOCK = `
useHead({
  title: 'Your Page Title',
  meta: [
    { name: 'description', content: 'Default description for this page' },
    { property: 'og:title', content: 'Your OG Title' }
  ],
  link: [
    { rel: 'canonical', href: 'https://yourdomain.com/current-page' }
  ]
})
`;

function isLikelyVuePageFile(filePath: string): boolean {

  const normalized = filePath.replace(/\\/g, '/');
  const base = path.basename(filePath);

  // Must be in a relevant directory like pages, views, or routes
  if (!/\/(pages|views|routes)\//.test(normalized)) {
    return false;
  }

  // Must be a .vue file
  if (!base.endsWith('.vue')) {
    return false;
  }

  // Exclude generic files like App.vue, main.vue, index.vue
  if (/^(App|main|index)\.vue$/i.test(base)) {
    return false;
  }

  return true;
}


async function ensureVueMetaInstalled(projectRoot: string) {
  const pkgPath = join(projectRoot, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const hasVueMeta = pkg.dependencies?.['vue-meta'] || pkg.devDependencies?.['vue-meta'];

  if (!hasVueMeta) {
    console.log('📦 Installing vue-meta...');
    execSync('npm install vue-meta', { cwd: projectRoot, stdio: 'inherit' });
  }
}

async function injectSeoIntoVueFiles(projectRoot: string) {
  const allFiles = await glob('src/{pages,views,routes}/**/*.vue', { cwd: projectRoot, absolute: true });
  const files = allFiles.filter(isLikelyVuePageFile);

  if (files.length === 0) {
    console.warn('⚠️ No Vue files found in src/pages/. Skipping.');
    return;
  }

  for (const file of files) {
    let content = readFileSync(file, 'utf-8');
    let modified = false;

    // Fix H1 tag issues in Vue templates
    const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
    if (templateMatch) {
      let templateContent = templateMatch[1];
      const h1Regex = /<h1[^>]*>/g;
      const h1Matches = [...templateContent.matchAll(h1Regex)];
      
      if (h1Matches.length === 0) {
        // No H1 found - convert first H2 to H1 if it exists
        const h2Match = templateContent.match(/<h2([^>]*)>/);
        if (h2Match) {
          templateContent = templateContent.replace(/<h2([^>]*)>/, '<h1$1>');
          templateContent = templateContent.replace(/<\/h2>/, '</h1>');
          modified = true;
        }
      } else if (h1Matches.length > 1) {
        // Multiple H1s found - convert extras to H2 (skip the first one)
        let replacements = 0;
        templateContent = templateContent.replace(/<h1([^>]*)>/g, (match, attrs) => {
          replacements++;
          return replacements === 1 ? match : `<h2${attrs}>`;
        });
        
        // Fix closing tags
        let h1Opens = 0;
        templateContent = templateContent.replace(/<\/h1>/g, (match) => {
          h1Opens++;
          return h1Opens === 1 ? match : '</h2>';
        });
        
        if (replacements > 1) {
          modified = true;
        }
      }
      
      if (modified) {
        content = content.replace(/<template>([\s\S]*?)<\/template>/, `<template>${templateContent}</template>`);
      }
    }

    if (!content.includes('<script setup')) {
        // No script setup tag: add one at the end with import and useHead
        content += `

<script setup>
import { useHead } from 'vue-meta'

useHead({
title: 'Your Page Title',
meta: [
    { name: 'description', content: 'Default description for this page' },
    { property: 'og:title', content: 'Your OG Title' }
],
link: [
    { rel: 'canonical', href: 'https://yourdomain.com/current-page' }
]
})
</script>
`
        writeFileSync(file, content, 'utf-8')
        console.log(`✅ Added <script setup> and injected SEO into ${file}`)
        continue
    }

    if (content.includes('useHead({')) {
      if (modified) {
        writeFileSync(file, content, 'utf-8');
        console.log(`✅ Fixed H1 tags in ${file}`);
      }
      continue;
    }

    if (!content.includes('import { useHead }')) {
      content = content.replace(
        /<script setup.*?>/,
        match => `${match}\nimport { useHead } from 'vue-meta'`
      );
    }

    const lines = content.split('\n');
    const scriptStartIndex = lines.findIndex(l => l.trim().startsWith('<script setup'));
    const scriptEndIndex = lines.findIndex((l, i) => i > scriptStartIndex && l.trim().startsWith('</script>'));

    const insertIndex = scriptEndIndex === -1 ? lines.length : scriptEndIndex;
    lines.splice(insertIndex, 0, SEO_HEAD_BLOCK);

    writeFileSync(file, lines.join('\n'), 'utf-8');
    console.log(`✅ Injected SEO metadata into ${file}`);
  }
}

export async function optimizeVueComponents(projectRoot: string) {
  await ensureVueMetaInstalled(projectRoot);
  await injectSeoIntoVueFiles(projectRoot);
}
