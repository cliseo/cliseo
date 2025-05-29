import { TestConfig } from '../core/types';

const config: TestConfig = {
  // Git configuration
  git: {
    // Branch prefix for temporary test branches
    branchPrefix: 'test-run-',
    // Whether to automatically clean up temporary branches
    cleanupBranches: true,
    // Whether to create pull requests for changes
    createPullRequests: true,
  },

  // Test sites configuration
  testSites: {
    // Base directory for test sites
    fixturesDir: '__fixtures__',
    // Timeout for each test site (in milliseconds)
    siteTimeout: 60000,
    // Whether to run tests in parallel
    parallel: true,
    // Maximum number of parallel test runs
    maxParallel: 2,
  },

  // Reporting configuration
  reporting: {
    // Directory for test reports
    reportsDir: 'reports',
    // Whether to save code snapshots
    saveSnapshots: true,
    // Whether to generate detailed diffs
    generateDiffs: true,
    // Whether to keep historical reports
    keepHistory: true,
    // Maximum number of historical reports to keep
    maxHistoryItems: 10,
  },

  // CLI configuration
  cli: {
    // Default command timeout (in milliseconds)
    commandTimeout: 30000,
    // Whether to show verbose output
    verbose: false,
    // Whether to run in CI mode
    ci: process.env.CI === 'true',
  },
};

export default config; 