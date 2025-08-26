// Command Options
export interface ScanOptions {
  json?: boolean;
}

export interface OptimizeOptions {
  ai?: boolean;
}



// SEO Types
export type IssueType = 'error' | 'warning' | 'ai-suggestion' | 'ai-link-fix';

export interface SeoIssue {
  type: IssueType;
  message: string;
  file: string;
  element?: string;
  fix: string;
  explanation?: string; // Additional context for AI-generated fixes
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
  auth0Tokens?: string; // JSON string containing Auth0 tokens
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
  error?: string;
} 