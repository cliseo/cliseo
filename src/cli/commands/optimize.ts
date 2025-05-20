import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { glob } from 'glob';
import OpenAI from 'openai';
import simpleGit from 'simple-git';
import { loadConfig } from '../utils/config.js';
import { OptimizeOptions, SeoIssue } from '../types/index.js';

const git = simpleGit();

async function createSeoDirectory() {
  const seoDir = 'seo';
  const structuredDataDir = join(seoDir, 'structured-data');
  
  // Create directories
  await mkdir(seoDir, { recursive: true });
  await mkdir(structuredDataDir, { recursive: true });
  
  // Create basic templates
  const templates = {
    'robots.txt': `User-agent: *
Allow: /

Sitemap: https://yourdomain.com/sitemap.xml`,
    
    'structured-data/product.json': {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": "Product Name",
      "description": "Product description",
      "brand": {
        "@type": "Brand",
        "name": "Brand Name"
      },
      "offers": {
        "@type": "Offer",
        "price": "0.00",
        "priceCurrency": "USD"
      }
    },
    
    'structured-data/article.json': {
      "@context": "https://schema.org/",
      "@type": "Article",
      "headline": "Article Title",
      "author": {
        "@type": "Person",
        "name": "Author Name"
      },
      "datePublished": "2024-01-01T00:00:00Z"
    }
  };
  
  // Write template files
  for (const [file, content] of Object.entries(templates)) {
    const filePath = join(seoDir, file);
    await writeFile(
      filePath,
      typeof content === 'string' ? content : JSON.stringify(content, null, 2)
    );
  }
}

async function generateAiOptimizations(content: string, openai: OpenAI): Promise<SeoIssue[]> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an SEO expert. Generate specific, actionable optimizations for the provided HTML content."
        },
        {
          role: "user",
          content: `Generate SEO optimizations for this HTML:\n\n${content}`
        }
      ]
    });

    const suggestions = completion.choices[0].message.content;
    
    // Parse AI suggestions into structured format
    return suggestions.split('\n')
      .filter(line => line.trim())
      .map(suggestion => ({
        type: 'ai-suggestion',
        message: suggestion,
        file: '',  // Will be set later
        fix: suggestion
      }));
  } catch (error) {
    console.error('Error generating AI optimizations:', error);
    return [];
  }
}

async function applyOptimizations(file: string, issues: SeoIssue[]): Promise<string> {
  let content = await readFile(file, 'utf-8');
  
  for (const issue of issues) {
    // This is a simplified version - in reality, you'd want more sophisticated
    // parsing and application of fixes based on the issue type and context
    if (issue.fix.includes('<')) {
      // It's probably HTML - try to insert it in appropriate place
      if (issue.fix.includes('</head>')) {
        content = content.replace('</head>', `${issue.fix}\n</head>`);
      } else if (issue.fix.includes('</body>')) {
        content = content.replace('</body>', `${issue.fix}\n</body>`);
      }
    }
  }
  
  return content;
}

async function createPullRequest(files: string[]) {
  const branchName = `seo-optimizations-${Date.now()}`;
  
  await git.checkoutLocalBranch(branchName);
  await git.add(files);
  await git.commit('feat: AI-powered SEO optimizations');
  await git.push('origin', branchName);
  
  // Note: In a real implementation, you'd use the GitHub API to create the PR
  console.log(chalk.green(`\nPush successful! Create a PR for branch: ${branchName}`));
}

export async function optimizeCommand(options: OptimizeOptions) {
  const spinner = ora('Preparing SEO optimizations...').start();
  const config = await loadConfig();
  
  try {
    // Create /seo directory if enabled
    if (config.seoDirectory) {
      await createSeoDirectory();
    }
    
    // Find all HTML/JSX/TSX files
    const files = await glob('**/*.{html,jsx,tsx}', {
      ignore: ['node_modules/**', 'dist/**', 'build/**', 'seo/**'],
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

    const modifiedFiles: string[] = [];
    
    for (const file of files) {
      const content = await readFile(file, 'utf-8');
      let optimizations: SeoIssue[] = [];
      
      if (options.ai && openai) {
        optimizations = await generateAiOptimizations(content, openai);
        // Set file path for each optimization
        optimizations.forEach(opt => opt.file = file);
      }
      
      if (optimizations.length > 0) {
        // Show preview if dry run
        if (options.dryRun) {
          console.log(chalk.underline(`\nOptimizations for ${file}:`));
          optimizations.forEach(opt => {
            console.log(`• ${chalk.bold(opt.message)}`);
            console.log(`  ${chalk.gray('Fix:')} ${opt.fix}`);
          });
          continue;
        }
        
        // Confirm changes if not in yes mode
        if (!options.yes) {
          const { proceed } = await inquirer.prompt([{
            type: 'confirm',
            name: 'proceed',
            message: `Apply ${optimizations.length} optimizations to ${file}?`,
            default: true,
          }]);
          
          if (!proceed) continue;
        }
        
        // Apply optimizations
        const optimizedContent = await applyOptimizations(file, optimizations);
        await writeFile(file, optimizedContent);
        modifiedFiles.push(file);
      }
    }

    if (modifiedFiles.length > 0) {
      if (options.gitPr) {
        await createPullRequest(modifiedFiles);
      }
      
      spinner.succeed(`Applied optimizations to ${modifiedFiles.length} files!`);
    } else {
      spinner.info('No optimizations were necessary.');
    }

  } catch (error) {
    spinner.fail('Optimization failed!');
    console.error(error);
    process.exit(1);
  }
} 