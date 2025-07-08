#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { scanCommand } from './commands/scan.js';
import { optimizeCommand } from './commands/optimize.js';
import { authCommand } from './commands/auth.js';
import { connectCommand } from './commands/connect.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf8')
);

const program = new Command();

// Setup CLI metadata
program
  .name('cliseo')
  .description('AI-Powered SEO Optimization CLI')
  .version(packageJson.version);

// Register commands
program
  .command('scan')
  .description('Scan project for SEO issues')
  .option('--ai', 'Enable AI-powered deep analysis (requires authentication)')
  .option('--verbose', 'Show detailed output')
  .option('--json', 'Output results in JSON format')
  .action(scanCommand);

program
  .command('optimize [directory]')
  .description('Apply SEO optimizations to codebase')
  .option('--ai', 'Use AI for generating improvements (requires authentication)')
  .option('--dry-run', 'Preview changes without applying')
  .option('--yes', 'Skip confirmation prompts')
  .action(optimizeCommand);

program
  .command('auth')
  .description('Authenticate with cliseo for AI features')
  .action(authCommand);

program
  .command('connect')
  .description('Connect external services')
  .option('--google-search-console', 'Connect Google Search Console')
  .action(connectCommand);

// Add some color to help text
program.configureHelp({
  subcommandTerm: (cmd) => chalk.cyan(cmd.name()),
  optionTerm: (option) => chalk.yellow(option.flags)
});

// Error handling for unknown commands
program.on('command:*', function () {
  console.error(chalk.red('Invalid command: %s'), program.args.join(' '));
  console.log('Use --help for a list of available commands.');
  process.exit(1);
});

program.parse(process.argv); 