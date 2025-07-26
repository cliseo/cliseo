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

    if (content.includes('useHead({')) continue;

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
