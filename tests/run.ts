import { TestRunner } from './core/TestRunner';

async function main() {
  const runner = new TestRunner();

  try {
    console.log('Starting test run...');
    const report = await runner.runTests();

    console.log('\nTest Run Summary:');
    console.log('----------------');
    console.log(`Status: ${report.success ? '✅ Passed' : '❌ Failed'}`);
    console.log(`Total Sites: ${report.summary.total}`);
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Issues Fixed: ${report.summary.issuesFixed}`);
    console.log(`Files Changed: ${report.summary.filesChanged}`);

    if (report.gitInfo.pullRequestUrl) {
      console.log(`\nPull Request: ${report.gitInfo.pullRequestUrl}`);
    }

    console.log('\nDetailed report saved to:', report.id);
    process.exit(report.success ? 0 : 1);
  } catch (error) {
    console.error('Test run failed:', error);
    process.exit(1);
  }
}

main(); 