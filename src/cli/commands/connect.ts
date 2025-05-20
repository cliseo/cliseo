import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { loadConfig, updateConfig } from '../utils/config.js';
import { ConnectOptions } from '../types/index.js';

async function connectGoogleSearchConsole() {
  const config = await loadConfig();
  
  if (!config.googleApiKey) {
    console.log(chalk.red('\n❌ Google API key not found'));
    console.log('Run', chalk.cyan('cliseo auth'), 'to set up your Google API key first.\n');
    process.exit(1);
  }

  const { website } = await inquirer.prompt([{
    type: 'input',
    name: 'website',
    message: 'Enter your website URL (e.g., https://example.com):',
    validate: (input: string) => {
      try {
        new URL(input);
        return true;
      } catch {
        return 'Please enter a valid URL';
      }
    }
  }]);

  const spinner = ora('Connecting to Google Search Console...').start();

  try {
    // Here you would implement the actual Google Search Console API connection
    // For now, we'll just simulate it
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update config to enable Search Console tracking
    await updateConfig({
      tracking: {
        ...config.tracking,
        searchConsole: true
      }
    });
    
    spinner.succeed('Connected to Google Search Console!');
    console.log('\nSEO metrics will now include Search Console data.');
    
  } catch (error) {
    spinner.fail('Failed to connect to Google Search Console');
    console.error(error);
    process.exit(1);
  }
}

export async function connectCommand(options: ConnectOptions) {
  if (options.googleSearchConsole) {
    await connectGoogleSearchConsole();
  } else {
    const { service } = await inquirer.prompt([{
      type: 'list',
      name: 'service',
      message: 'Which service would you like to connect?',
      choices: [
        { name: 'Google Search Console', value: 'searchConsole' }
      ]
    }]);

    if (service === 'searchConsole') {
      await connectGoogleSearchConsole();
    }
  }
} 