import { access, mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { BASIC_PLACEHOLDERS, getMinimalLlmsTxt, getMinimalRobotsTxt, getMinimalSitemapXml } from './seoTemplates.js';

export type SupportedFramework = 'react' | 'next.js' | 'vue' | 'angular' | 'unknown';

export interface EnsureSeoFilesOptions {
  framework?: SupportedFramework;
  baseUrl?: string;
}

export interface EnsureSeoFilesResult {
  robotsCreated: boolean;
  sitemapCreated: boolean;
  llmsCreated: boolean;
  robotsPath: string;
  sitemapPath: string;
  llmsPath: string;
}

function resolveTargetDirectory(projectRoot: string, framework?: SupportedFramework): string {
  if (framework === 'react' || framework === 'next.js') {
    const publicDir = join(projectRoot, 'public');
    if (existsSync(publicDir)) {
      return publicDir;
    }
  }
  return projectRoot;
}

async function ensureFile(path: string, content: string): Promise<boolean> {
  try {
    await access(path);
    return false;
  } catch {
    await writeFile(path, content, 'utf8');
    return true;
  }
}

export async function ensureSeoFiles(projectRoot: string, options: EnsureSeoFilesOptions = {}): Promise<EnsureSeoFilesResult> {
  const { framework = 'unknown', baseUrl = BASIC_PLACEHOLDERS.canonical } = options;
  const targetDir = resolveTargetDirectory(projectRoot, framework);

  await mkdir(targetDir, { recursive: true });

  const robotsPath = join(targetDir, 'robots.txt');
  const sitemapPath = join(targetDir, 'sitemap.xml');
  const llmsPath = join(targetDir, 'llms.txt');

  const robotsCreated = await ensureFile(robotsPath, getMinimalRobotsTxt(baseUrl));
  const sitemapCreated = await ensureFile(sitemapPath, getMinimalSitemapXml(baseUrl));
  const llmsCreated = await ensureFile(llmsPath, getMinimalLlmsTxt());

  return { robotsCreated, sitemapCreated, llmsCreated, robotsPath, sitemapPath, llmsPath };
}
