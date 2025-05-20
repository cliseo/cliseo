import { glob } from 'glob';
import * as cheerio from 'cheerio';
import chalk from 'chalk';
import ora from 'ora';
import { readFile } from 'fs/promises';
import { join } from 'path';
import OpenAI from 'openai';
import { loadConfig } from '../utils/config.js';
import { ScanOptions, SeoIssue, ScanResult } from '../types/index.js';

// Basic SEO rules for non-AI scan
const basicSeoRules = {
  missingTitle: (doc: cheerio.CheerioAPI) => !doc('title').length,
  missingMetaDescription: (doc: cheerio.CheerioAPI) => !doc('meta[name="description"]').length,
  missingAltTags: (doc: cheerio.CheerioAPI) => doc('img:not([alt])').length > 0,
  missingViewport: (doc: cheerio.CheerioAPI) => !doc('meta[name="viewport"]').length,
  missingRobotsTxt: async (projectRoot: string) => {
    try {
      await readFile(join(projectRoot, 'robots.txt'));
      return false;
    } catch {
      return true;
    }
  },
};

async function performBasicScan(filePath: string): Promise<SeoIssue[]> {
  const issues: SeoIssue[] = [];
  const content = await readFile(filePath, 'utf-8');
  const $ = cheerio.load(content);

  // Check basic SEO rules
  if (basicSeoRules.missingTitle($)) {
    issues.push({
      type: 'error',
      message: 'Missing title tag',
      file: filePath,
      fix: 'Add a descriptive title tag',
    });
  }

  if (basicSeoRules.missingMetaDescription($)) {
    issues.push({
      type: 'warning',
      message: 'Missing meta description',
      file: filePath,
      fix: 'Add a meta description tag',
    });
  }

  if (basicSeoRules.missingAltTags($)) {
    const images = $('img:not([alt])');
    images.each((_, img) => {
      issues.push({
        type: 'warning',
        message: 'Image missing alt text',
        file: filePath,
        element: $.html(img),
        fix: 'Add descriptive alt text to the image',
      });
    });
  }

  if (basicSeoRules.missingViewport($)) {
    issues.push({
      type: 'warning',
      message: 'Missing viewport meta tag',
      file: filePath,
      fix: 'Add viewport meta tag for responsive design',
    });
  }

  return issues;
}

async function performAiScan(filePath: string, openai: OpenAI): Promise<SeoIssue[]> {
  const content = await readFile(filePath, 'utf-8');
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an SEO expert. Analyze the HTML content and provide specific SEO improvements."
        },
        {
          role: "user",
          content: `Analyze this HTML for SEO issues and provide specific fixes:\n\n${content}`
        }
      ]
    });

    const analysis = completion.choices[0].message.content;
    
    // Parse AI response into structured issues
    // This is a simplified version - you'd want more robust parsing
    return analysis.split('\n')
      .filter(line => line.trim())
      .map(issue => ({
        type: 'ai-suggestion',
        message: issue,
        file: filePath,
        fix: issue
      }));

  } catch (error) {
    console.error('Error during AI analysis:', error);
    return [];
  }
}

export async function scanCommand(options: ScanOptions) {
  const spinner = ora('Scanning project for SEO issues...').start();
  const config = await loadConfig();
  
  try {
    // Find all HTML/JSX/TSX files
    const files = await glob('**/*.{html,jsx,tsx}', {
      ignore: ['node_modules/**', 'dist/**', 'build/**'],
    });

    let openai;
    if (options.ai) {
      if (!config.openaiApiKey) {
        spinner.fail('OpenAI API key not found!');
        console.log('Run `cliseo auth` to set up your API key.');
        process.exit(1);
      }
      
      openai = new OpenAI({
        apiKey: config.openaiApiKey
      });
    }

    const results: ScanResult[] = [];

    for (const file of files) {
      const basicIssues = await performBasicScan(file);
      let aiIssues: SeoIssue[] = [];
      
      if (options.ai && openai) {
        aiIssues = await performAiScan(file, openai);
      }

      results.push({
        file,
        issues: [...basicIssues, ...aiIssues],
      });
    }

    spinner.succeed('Scan complete!');

    // Output results
    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      results.forEach(result => {
        if (result.issues.length > 0) {
          console.log(chalk.underline('\nFile:', result.file));
          result.issues.forEach(issue => {
            const icon = issue.type === 'error' ? '❌' : '⚠️';
            console.log(`${icon} ${chalk.bold(issue.message)}`);
            console.log(`   ${chalk.gray('Fix:')} ${issue.fix}`);
            if (issue.element) {
              console.log(`   ${chalk.gray('Element:')} ${issue.element}`);
            }
          });
        }
      });

      // Summary
      const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
      console.log(chalk.bold('\nSummary:'));
      console.log(`Found ${totalIssues} issues across ${files.length} files.`);
    }

  } catch (error) {
    spinner.fail('Scan failed!');
    console.error(error);
    process.exit(1);
  }
} 