import { TestReport } from './types.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { format } from 'date-fns';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    const timestamp = format(report.timestamp, 'yyyy-MM-dd_HH-mm-ss');
    const status = report.success ? 'pass' : 'fail';
    const reportDir = path.join(this.config.reportsDir, `${timestamp}_${status}_${report.id}`);
    
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
    } catch (error: unknown) {
      console.error('Failed to save report:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Generate a markdown summary of the test run
   */
  private async generateSummaryMarkdown(report: TestReport, reportDir: string): Promise<void> {
    const timestamp = format(report.timestamp, 'yyyy-MM-dd HH:mm:ss');
    const lines = [
      '# Test Run Report',
      '',
      `## Summary`,
      `- Run ID: ${report.id}`,
      `- Timestamp: ${timestamp}`,
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
        result.foundIssues.length > 0
          ? result.foundIssues.map(issue => 
              `- [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.description}` +
              (issue.location ? `\n  Location: ${issue.location.file}${issue.location.line ? `:${issue.location.line}` : ''}` : '')
            ).join('\n')
          : '- No issues found',
        '',
        '#### Code Changes:',
        result.codeChanges.length > 0
          ? result.codeChanges.map(change => `- ${change.file}`).join('\n')
          : '- No changes made',
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
      // Get all report directories
      const dirs = await fs.readdir(this.config.reportsDir);
      
      // Sort by creation time (newest first)
      const sortedDirs = await Promise.all(
        dirs.map(async dir => {
          const stat = await fs.stat(path.join(this.config.reportsDir, dir));
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
        await fs.rm(path.join(this.config.reportsDir, dir.name), {
          recursive: true,
          force: true
        });
      }
    } catch (error: unknown) {
      console.warn('Failed to clean up old reports:', error instanceof Error ? error.message : String(error));
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
    return dirs.sort().reverse(); // Newest first
  }
} 