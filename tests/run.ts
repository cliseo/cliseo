import { TestRunner } from './core/TestRunner.js';
import chalk from 'chalk';

async function main() {
  try {
    console.log(chalk.blue('\nCLISEO Test Suite'));
    console.log(chalk.blue('================\n'));

    const runner = new TestRunner();
    console.log(chalk.yellow('Setting up test environment...'));
    
    // Run the tests
    console.log(chalk.yellow('\nRunning tests...'));
    const report = await runner.runTests();
    
    // Print results
    console.log('\nResults:');
    console.log('========');
    console.log(`Total Sites: ${report.summary.total}`);
    console.log(`Passed: ${chalk.green(report.summary.passed)}`);
    console.log(`Failed: ${chalk.red(report.summary.failed)}`);
    console.log(`Issues Fixed: ${report.summary.issuesFixed}`);
    console.log(`Files Changed: ${report.summary.filesChanged}`);
    
    // Print detailed results
    console.log('\nDetailed Results:');
    console.log('================');
    
    for (const result of report.results) {
      console.log(`\n${chalk.cyan(result.siteName)} (${result.framework}):`);
      console.log(`Status: ${result.success ? chalk.green('✓ PASS') : chalk.red('✗ FAIL')}`);
      console.log(`Duration: ${result.duration}ms`);
      
      if (result.foundIssues.length > 0) {
        console.log('\nIssues Found:');
        for (const issue of result.foundIssues) {
          const severity = {
            high: chalk.red('HIGH'),
            medium: chalk.yellow('MEDIUM'),
            low: chalk.blue('LOW')
          }[issue.severity] || issue.severity;
          
          console.log(`- [${severity}] ${issue.type}: ${issue.description}`);
          if (issue.location) {
            console.log(`  Location: ${issue.location.file}${issue.location.line ? `:${issue.location.line}` : ''}`);
          }
        }
      }
      
      if (result.codeChanges.length > 0) {
        console.log('\nCode Changes:');
        for (const change of result.codeChanges) {
          console.log(`- ${change.file}`);
        }
      }
      
      if (result.error) {
        console.log(chalk.red(`\nError: ${result.error}`));
      }
    }
    
    // Print git info
    if (report.gitInfo.branch) {
      console.log('\nGit Information:');
      console.log('===============');
      console.log(`Branch: ${report.gitInfo.branch}`);
      if (report.gitInfo.pullRequestUrl) {
        console.log(`Pull Request: ${report.gitInfo.pullRequestUrl}`);
      }
    }
    
    // Exit with appropriate code
    process.exit(report.success ? 0 : 1);
  } catch (error: unknown) {
    console.error(chalk.red('\nTest suite failed:'));
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main(); 