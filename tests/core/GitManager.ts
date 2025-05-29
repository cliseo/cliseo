import { GitResult } from './types';
import { simpleGit, SimpleGit } from 'simple-git';
import { v4 as uuidv4 } from 'uuid';

interface GitConfig {
  branchPrefix: string;
  cleanupBranches: boolean;
  createPullRequests: boolean;
}

export class GitManager {
  private git: SimpleGit;
  private config: GitConfig;
  private currentBranch: string | null = null;

  constructor(config: GitConfig) {
    this.git = simpleGit();
    this.config = config;
  }

  /**
   * Create a new branch for testing
   */
  async createTestBranch(): Promise<GitResult> {
    try {
      // Store original branch
      const { current } = await this.git.status();
      const timestamp = Date.now();
      const uniqueId = uuidv4().slice(0, 8);
      
      // Create new branch
      this.currentBranch = `${this.config.branchPrefix}${timestamp}-${uniqueId}`;
      await this.git.checkoutLocalBranch(this.currentBranch);

      return {
        success: true,
        branch: this.currentBranch
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create a pull request with changes
   */
  async createPullRequest(): Promise<GitResult> {
    if (!this.currentBranch) {
      return {
        success: false,
        error: 'No test branch created'
      };
    }

    try {
      // Push changes
      await this.git.push('origin', this.currentBranch);

      // Note: Actual PR creation would need to use GitHub/GitLab API
      // This is a placeholder that just returns the branch info
      return {
        success: true,
        branch: this.currentBranch,
        pullRequestUrl: `https://github.com/owner/repo/compare/main...${this.currentBranch}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clean up temporary branch
   */
  async cleanup(): Promise<GitResult> {
    if (!this.currentBranch) {
      return {
        success: true
      };
    }

    try {
      // Switch back to main
      await this.git.checkout('main');
      
      // Delete the temporary branch
      await this.git.deleteLocalBranch(this.currentBranch);
      
      // Try to delete remote branch if it exists
      try {
        await this.git.push('origin', `:${this.currentBranch}`);
      } catch {
        // Ignore errors if remote branch doesn't exist
      }

      this.currentBranch = null;
      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
} 