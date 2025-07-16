// Command Options
export interface ScanOptions {
  ai?: boolean;
  verbose?: boolean;
  json?: boolean;
}

export interface OptimizeOptions {
  ai?: boolean;
  model?: string;
  gitPr?: boolean;
  dryRun?: boolean;
  yes?: boolean;
}

export interface ConnectOptions {
  googleSearchConsole?: boolean;
}

// SEO Types
export type IssueType = 'error' | 'warning' | 'ai-suggestion';

export interface SeoIssue {
  type: IssueType;
  message: string;
  file: string;
  element?: string;
  fix: string;
}

export interface ScanResult {
  file: string;
  issues: SeoIssue[];
}

// Configuration
export interface Config {
  openaiApiKey?: string;
  githubToken?: string;
  googleApiKey?: string;
  authToken?: string;
  userEmail?: string;
  aiAccess?: boolean;
  aiModel?: string;
  createPRs?: boolean;
  seoDirectory?: boolean;
  tracking?: {
    anonymous: boolean;
    searchConsole: boolean;
  };
}

// Git Types
export interface GitPrOptions {
  title: string;
  description: string;
  branch: string;
  files: string[];
}

// Authentication Types
export interface AuthenticationResult {
  success: boolean;
  token?: string;
  email?: string;
  aiAccess?: boolean;
  emailVerified?: boolean;
  requiresVerification?: boolean;
  error?: string;
} 