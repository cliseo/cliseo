import { TestSite, TestResult, TestReport, GitResult } from './types.js';
import config from '../config/test.config.js';
import testSites from '../config/sites.config.js';
import { GitManager } from './GitManager.js';
import { DiffGenerator } from './DiffGenerator.js';
import { ReportBuilder } from './ReportBuilder.js';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const execAsync = promisify(exec);

export class TestRunner {
  private gitManager: GitManager;
  private diffGenerator: DiffGenerator;
  private reportBuilder: ReportBuilder;

  constructor() {
    this.gitManager = new GitManager(config.git);
    this.diffGenerator = new DiffGenerator();
    this.reportBuilder = new ReportBuilder({
      ...config.reporting,
      reportsDir: path.join(projectRoot, 'tests', config.reporting.reportsDir)
    });
  }

  /**
   * Run tests on all configured test sites
   */
  async runTests(): Promise<TestReport> {
    const startTime = Date.now();
    const testId = uuidv4();
    let results: TestResult[] = [];
    let gitInfo: GitResult = { success: false };

    try {
      // Create reports directory if it doesn't exist
      const reportsDir = path.join(projectRoot, 'tests', config.reporting.reportsDir);
      await fs.mkdir(reportsDir, { recursive: true });

      // Restore test sites from templates
      await this.restoreTestSites();

      // Create temporary branch for testing
      gitInfo = await this.gitManager.createTestBranch();
      if (!gitInfo.success) {
        throw new Error(`Failed to create test branch: ${gitInfo.error}`);
      }

      // Run tests either in parallel or sequence
      if (config.testSites.parallel) {
        results = await this.runTestsParallel();
      } else {
        results = await this.runTestsSequential();
      }

      // Generate final report
      const report: TestReport = {
        id: testId,
        timestamp: startTime,
        duration: Date.now() - startTime,
        success: results.every(r => r.success),
        results,
        gitInfo,
        summary: this.generateSummary(results)
      };

      // Save report
      await this.reportBuilder.saveReport(report);

      // Clean up if configured
      if (config.git.cleanupBranches) {
        await this.gitManager.cleanup();
      }

      return report;
    } catch (error: unknown) {
      // Handle errors and generate error report
      const errorReport: TestReport = {
        id: testId,
        timestamp: startTime,
        duration: Date.now() - startTime,
        success: false,
        results: [],
        gitInfo: gitInfo || { success: false, error: error instanceof Error ? error.message : String(error) },
        summary: {
          total: testSites.length,
          passed: 0,
          failed: testSites.length,
          issuesFixed: 0,
          filesChanged: 0
        }
      };

      await this.reportBuilder.saveReport(errorReport);
      throw error;
    }
  }

  /**
   * Restore test sites from templates
   */
  private async restoreTestSites(): Promise<void> {
    console.log('Restoring test sites from templates...');
    
    for (const site of testSites) {
      const templatePath = path.join(projectRoot, 'tests', '__templates__', site.name);
      const targetPath = path.join(projectRoot, 'tests', site.path);

      try {
        // Check if template exists
        await fs.access(templatePath);
      } catch {
        console.warn(`Template not found for ${site.name}, skipping restoration`);
        continue;
      }

      try {
        // Remove existing test site if it exists
        await fs.rm(targetPath, { recursive: true, force: true });
        
        // Copy template to test site
        await this.copyDirectory(templatePath, targetPath);
      } catch (error: unknown) {
        throw new Error(`Failed to restore test site ${site.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Helper to recursively copy a directory
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Run tests in parallel up to maxParallel
   */
  private async runTestsParallel(): Promise<TestResult[]> {
    const chunks = this.chunkArray(testSites, config.testSites.maxParallel);
    const results: TestResult[] = [];

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(site => this.runSingleTest(site))
      );
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Run tests sequentially
   */
  private async runTestsSequential(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const site of testSites) {
      const result = await this.runSingleTest(site);
      results.push(result);
    }

    return results;
  }

  /**
   * Run test for a single site
   */
  private async runSingleTest(site: TestSite): Promise<TestResult> {
    const startTime = Date.now();
    const sitePath = path.join(projectRoot, 'tests', site.path);

    try {
      // Check if site directory exists
      try {
        await fs.access(sitePath);
      } catch {
        throw new Error(`Test site directory not found: ${sitePath}`);
      }

      // Take snapshot before changes
      const beforeSnapshot = await this.diffGenerator.takeSnapshot(sitePath);

      // Run cliseo optimize
      await this.runCliSeoOptimize(sitePath);

      // Take snapshot after changes
      const afterSnapshot = await this.diffGenerator.takeSnapshot(sitePath);

      // Generate diff
      const codeChanges = this.diffGenerator.generateDiff(beforeSnapshot, afterSnapshot);

      // Analyze results
      const foundIssues = await this.analyzeSEOIssues(sitePath, site);

      return {
        siteName: site.name,
        framework: site.framework,
        timestamp: startTime,
        success: true,
        duration: Date.now() - startTime,
        foundIssues,
        expectedIssues: site.expectedIssues,
        codeChanges
      };
    } catch (error: unknown) {
      return {
        siteName: site.name,
        framework: site.framework,
        timestamp: startTime,
        success: false,
        duration: Date.now() - startTime,
        foundIssues: [],
        expectedIssues: site.expectedIssues,
        codeChanges: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Run cliseo optimize command
   */
  private async runCliSeoOptimize(sitePath: string): Promise<void> {
    const command = `cliseo optimize --ai${config.cli.verbose ? ' --verbose' : ''}`;
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: sitePath,
        timeout: config.cli.commandTimeout
      });

      if (config.cli.verbose) {
        console.log('cliseo optimize output:');
        console.log(stdout);
        if (stderr) console.error(stderr);
      }
    } catch (error: unknown) {
      const err = error as { message: string; stderr: string };
      throw new Error(`cliseo optimize failed: ${err.stderr || err.message}`);
    }
  }

  /**
   * Analyze SEO issues in the site
   */
  private async analyzeSEOIssues(sitePath: string, site: TestSite): Promise<any[]> {
    const issues: any[] = [];
    
    try {
      // Framework-specific paths for index.html
      const indexHtmlPath = this.getFrameworkIndexPath(sitePath, site.framework);
      if (indexHtmlPath) {
        const indexHtml = await fs.readFile(indexHtmlPath, 'utf-8');
        if (!indexHtml.includes('meta name="description"')) {
          issues.push({
            type: 'meta-description',
            description: 'Missing meta description tag',
            severity: 'high',
            location: {
              file: path.relative(sitePath, indexHtmlPath)
            }
          });
        }
      }

      // Framework-specific component paths
      const componentPaths = this.getFrameworkComponentPaths(sitePath, site.framework);
      
      // Check for missing alt text
      if (componentPaths.hero) {
        const heroContent = await fs.readFile(componentPaths.hero, 'utf-8');
        const imgWithoutAlt = (heroContent.match(/<img[^>]+(?!alt=)[^>]*>/g) || []).length;
        if (imgWithoutAlt > 0) {
          issues.push({
            type: 'img-alt',
            description: `${imgWithoutAlt} images missing alt text`,
            severity: 'high',
            location: {
              file: path.relative(sitePath, componentPaths.hero)
            }
          });
        }
      }

      // Check heading hierarchy
      if (componentPaths.about) {
        const aboutContent = await fs.readFile(componentPaths.about, 'utf-8');
        if (aboutContent.includes('<h2>') && !aboutContent.includes('<h1>')) {
          issues.push({
            type: 'heading-structure',
            description: 'Invalid heading hierarchy - missing h1',
            severity: 'medium',
            location: {
              file: path.relative(sitePath, componentPaths.about)
            }
          });
        }
      }

    } catch (error) {
      console.warn('Error analyzing SEO issues:', error);
    }

    return issues;
  }

  /**
   * Get framework-specific path for index.html
   */
  private getFrameworkIndexPath(sitePath: string, framework: string): string {
    switch (framework) {
      case 'react':
        return path.join(sitePath, 'public', 'index.html');
      case 'next':
        return path.join(sitePath, 'src', 'app', 'layout.tsx');
      case 'vue':
        return path.join(sitePath, 'index.html');
      case 'angular':
        return path.join(sitePath, 'src', 'index.html');
      default:
        return '';
    }
  }

  /**
   * Get framework-specific component paths
   */
  private getFrameworkComponentPaths(sitePath: string, framework: string): { hero?: string; about?: string } {
    const paths: { hero?: string; about?: string } = {};
    
    switch (framework) {
      case 'react':
        paths.hero = path.join(sitePath, 'src', 'components', 'Hero.tsx');
        paths.about = path.join(sitePath, 'src', 'components', 'About.tsx');
        break;
      case 'next':
        paths.hero = path.join(sitePath, 'src', 'components', 'Hero.tsx');
        paths.about = path.join(sitePath, 'src', 'components', 'About.tsx');
        break;
      case 'vue':
        paths.hero = path.join(sitePath, 'src', 'components', 'Hero.vue');
        paths.about = path.join(sitePath, 'src', 'components', 'About.vue');
        break;
      case 'angular':
        paths.hero = path.join(sitePath, 'src', 'app', 'hero', 'hero.component.ts');
        paths.about = path.join(sitePath, 'src', 'app', 'about', 'about.component.ts');
        break;
    }
    
    return paths;
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(results: TestResult[]): TestReport['summary'] {
    return {
      total: results.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      issuesFixed: results.reduce((sum, r) => sum + r.foundIssues.length, 0),
      filesChanged: results.reduce((sum, r) => sum + r.codeChanges.length, 0)
    };
  }

  /**
   * Helper to chunk array for parallel processing
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
} 