import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';

const GLOBAL_CONFIG_FILE = join(homedir(), '.cliseorc');

/**
 * Migrate from old custom JWT tokens to Auth0-only authentication
 */
export async function migrateAuthentication(): Promise<void> {
  try {
    console.log(chalk.blue('🔄 Migrating authentication to Auth0-only...'));
    
    // Read existing config
    let config: any = {};
    try {
      const content = await readFile(GLOBAL_CONFIG_FILE, 'utf-8');
      config = JSON.parse(content);
    } catch (error) {
      // No existing config, nothing to migrate
      console.log(chalk.green('✅ No existing authentication to migrate'));
      return;
    }
    
    // Check if user has old custom JWT token
    if (config.authToken && !config.auth0Tokens) {
      console.log(chalk.yellow('⚠️  Found old authentication format'));
      console.log(chalk.gray('   Old custom JWT tokens are no longer supported'));
      console.log(chalk.gray('   Please run "cliseo auth" to re-authenticate with Auth0'));
      
      // Clear old authentication data
      delete config.authToken;
      
      // Save updated config
      await writeFile(GLOBAL_CONFIG_FILE, JSON.stringify(config, null, 2));
      
      console.log(chalk.green('✅ Old authentication data cleared'));
      console.log(chalk.cyan('💡 Run "cliseo auth" to authenticate with Auth0'));
    } else if (config.auth0Tokens) {
      console.log(chalk.green('✅ Already using Auth0 authentication'));
    } else {
      console.log(chalk.gray('ℹ️  No authentication configured'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Migration failed:'), error);
  }
}