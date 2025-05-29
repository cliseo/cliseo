/**
 * Main test configuration interface
 */
export interface TestConfig {
  git: {
    branchPrefix: string;
    cleanupBranches: boolean;
    createPullRequests: boolean;
  };
  testSites: {
    fixturesDir: string;
    siteTimeout: number;
    parallel: boolean;
    maxParallel: number;
  };
  reporting: {
    reportsDir: string;
    saveSnapshots: boolean;
    generateDiffs: boolean;
    keepHistory: boolean;
    maxHistoryItems: number;
  };
  cli: {
    commandTimeout: number;
    verbose: boolean;
    ci: boolean;
  };
}

export type Framework = 'react' | 'next' | 'vue' | 'angular';

/**
 * Test site configuration
 */
export interface TestSite {
  name: string;
  path: string;
  framework: Framework;
  expectedIssues: Array<{
    type: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
    location?: {
      file: string;
      line?: number;
    };
  }>;
}

/**
 * SEO issue interface
 */
export interface SEOIssue {
  type: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  location?: {
    file: string;
    line?: number;
  };
}

/**
 * Test result interface
 */
export interface TestResult {
  siteName: string;
  framework: string;
  timestamp: number;
  success: boolean;
  duration: number;
  foundIssues: any[];
  fixedIssues: number;
  remainingIssues: any[];
  expectedIssues: any[];
  codeChanges: any[];
  error?: string;
}

/**
 * Git operation result
 */
export interface GitResult {
  success: boolean;
  branch?: string;
  pullRequestUrl?: string;
  error?: string;
}

/**
 * Test report interface
 */
export interface TestReport {
  id: string;
  timestamp: number;
  duration: number;
  success: boolean;
  results: TestResult[];
  gitInfo: GitResult;
  summary: {
    total: number;
    passed: number;
    failed: number;
    issuesFixed: number;
    filesChanged: number;
  };
} 