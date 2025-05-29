import { TestReport } from './types';
import { promises as fs } from 'fs';
import path from 'path';

interface ReportConfig {
  reportsDir: string;
  saveSnapshots: boolean;
  generateDiffs: boolean;
  keepHistory: boolean;
  maxHistoryItems: number;
}

export class ReportBuilder {
  private config: ReportConfig;

  constructor(config: ReportConfig) {
    this.config = config;
  }

  /**
   * Save a test report
   */
  async saveReport(report: TestReport): Promise<void> {
    const reportDir = path.join(this.config.reportsDir, report.id);
    
    try {
      // Create report directory
      await fs.mkdir(reportDir, { recursive: true });

      // Save main report JSON
      await fs.writeFile(
        path.join(reportDir, 'report.json'),
        JSON.stringify(report, null, 2),
        'utf-8'
      );

      // Save summary markdown
      await this.generateSummaryMarkdown(report, reportDir);

      // Clean up old reports if needed
      if (this.config.keepHistory) {
        await this.cleanupOldReports();
      }
    } catch (error) {
      console.error(`Failed to save report: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate a markdown summary of the test run
   */
  private async generateSummaryMarkdown(report: TestReport, reportDir: string): Promise<void> {
    const lines = [
      '# Test Run Report',
      '',
      `## Summary`,
      `- Run ID: ${report.id}`,
      `- Timestamp: ${new Date(report.timestamp).toISOString()}`,
      `- Duration: ${report.duration}ms`,
      `- Status: ${report.success ? '✅ Passed' : '❌ Failed'}`,
      '',
      '## Statistics',
      `- Total Sites: ${report.summary.total}`,
      `- Passed: ${report.summary.passed}`,
      `- Failed: ${report.summary.failed}`,
      `- Issues Fixed: ${report.summary.issuesFixed}`,
      `- Files Changed: ${report.summary.filesChanged}`,
      '',
      '## Git Information',
      `- Branch: ${report.gitInfo.branch || 'N/A'}`,
      `- Pull Request: ${report.gitInfo.pullRequestUrl || 'N/A'}`,
      '',
      '## Test Results'
    ];

    // Add details for each test site
    for (const result of report.results) {
      lines.push(
        `### ${result.siteName} (${result.framework})`,
        `- Status: ${result.success ? '✅ Passed' : '❌ Failed'}`,
        `- Duration: ${result.duration}ms`,
        '',
        '#### Found Issues:',
        ...result.foundIssues.map(issue => 
          `- [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.description}`
        ),
        '',
        '#### Code Changes:',
        ...result.codeChanges.map(change =>
          `- ${change.file}`
        ),
        ''
      );

      // Add error message if any
      if (result.error) {
        lines.push(
          '#### Error:',
          '```',
          result.error,
          '```',
          ''
        );
      }
    }

    // Save markdown file
    await fs.writeFile(
      path.join(reportDir, 'summary.md'),
      lines.join('\n'),
      'utf-8'
    );
  }

  /**
   * Clean up old reports to maintain history limit
   */
  private async cleanupOldReports(): Promise<void> {
    try {
      const reportsDir = this.config.reportsDir;
      
      // Get all report directories
      const dirs = await fs.readdir(reportsDir);
      
      // Sort by creation time (newest first)
      const sortedDirs = await Promise.all(
        dirs.map(async dir => {
          const stat = await fs.stat(path.join(reportsDir, dir));
          return {
            name: dir,
            time: stat.birthtimeMs
          };
        })
      );
      
      sortedDirs.sort((a, b) => b.time - a.time);

      // Remove excess reports
      const toRemove = sortedDirs.slice(this.config.maxHistoryItems);
      
      for (const dir of toRemove) {
        await fs.rm(path.join(reportsDir, dir.name), {
          recursive: true,
          force: true
        });
      }
    } catch (error) {
      console.warn(`Failed to clean up old reports: ${error.message}`);
    }
  }

  /**
   * Load a specific report
   */
  async loadReport(reportId: string): Promise<TestReport> {
    const reportPath = path.join(this.config.reportsDir, reportId, 'report.json');
    const content = await fs.readFile(reportPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * List all available reports
   */
  async listReports(): Promise<string[]> {
    const reportsDir = this.config.reportsDir;
    const dirs = await fs.readdir(reportsDir);
    return dirs.sort();
  }
} 