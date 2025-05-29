import { TestSite, TestResult, TestReport, GitResult } from './types';
import config from '../config/test.config';
import testSites from '../config/sites.config';
import { GitManager } from './GitManager';
import { DiffGenerator } from './DiffGenerator';
import { ReportBuilder } from './ReportBuilder';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export class TestRunner {
  private gitManager: GitManager;
  private diffGenerator: DiffGenerator;
  private reportBuilder: ReportBuilder;

  constructor() {
    this.gitManager = new GitManager(config.git);
    this.diffGenerator = new DiffGenerator();
    this.reportBuilder = new ReportBuilder(config.reporting);
  }

  /**
   * Run tests on all configured test sites
   */
  async runTests(): Promise<TestReport> {
    const startTime = Date.now();
    const testId = uuidv4();
    let results: TestResult[] = [];
    let gitInfo: GitResult;

    try {
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
    } catch (error) {
      // Handle errors and generate error report
      const errorReport: TestReport = {
        id: testId,
        timestamp: startTime,
        duration: Date.now() - startTime,
        success: false,
        results: [],
        gitInfo: gitInfo || { success: false, error: error.message },
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

    try {
      // Take snapshot before changes
      const beforeSnapshot = await this.diffGenerator.takeSnapshot(site.path);

      // Run cliseo optimize
      await this.runCliSeoOptimize(site.path);

      // Take snapshot after changes
      const afterSnapshot = await this.diffGenerator.takeSnapshot(site.path);

      // Generate diff
      const codeChanges = this.diffGenerator.generateDiff(beforeSnapshot, afterSnapshot);

      // Analyze results
      const foundIssues = await this.analyzeSEOIssues(site.path);

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
    } catch (error) {
      return {
        siteName: site.name,
        framework: site.framework,
        timestamp: startTime,
        success: false,
        duration: Date.now() - startTime,
        foundIssues: [],
        expectedIssues: site.expectedIssues,
        codeChanges: [],
        error: error.message
      };
    }
  }

  /**
   * Run cliseo optimize command
   */
  private async runCliSeoOptimize(sitePath: string): Promise<void> {
    const command = `cliseo optimize --ai${config.cli.verbose ? ' --verbose' : ''}`;
    const { stdout, stderr } = await execAsync(command, {
      cwd: sitePath,
      timeout: config.cli.commandTimeout
    });

    if (stderr && !config.cli.verbose) {
      throw new Error(`cliseo optimize failed: ${stderr}`);
    }

    if (config.cli.verbose) {
      console.log(stdout);
      if (stderr) console.error(stderr);
    }
  }

  /**
   * Analyze SEO issues in the site
   */
  private async analyzeSEOIssues(sitePath: string): Promise<any[]> {
    // TODO: Implement actual SEO analysis
    // This is a placeholder that should be replaced with real analysis
    return [];
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