import inquirer from 'inquirer';
import axios from 'axios';
import * as path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import ora from 'ora';
import { setApiKey } from '../utils/config.js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
const API_URL = process.env.API_URL;

export async function authCommand() {
  console.log(chalk.bold('\nLogin to your cliseo account!\nIf you don\'t have an account, you can sign up at https://cliseo.com/\n'));

  const { email, password } = await inquirer.prompt([
    {
      type: 'input',
      name: 'email',
      message: 'Enter your email:',
      validate: (input: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(input) ? true : 'Please enter a valid email address';
      }
    },
    {
      type: 'password',
      name: 'password',
      message: 'Enter your password:',
    }
  ]);

  const spinner = ora('Authenticating...').start();

  try {
    // API Call to authenticate user
    const response = await axios.post(`${API_URL}/login`, {
    email,
    password,
  });
    if (response.status !== 200) {
      throw new Error('Authentication failed');
    }

  } 
  catch (error) {
    spinner.fail('Authentication failed\n Please check your email and password.');
    console.error(error);
    process.exit(1);
  }
  
  spinner.succeed('Login successful!');
  console.log(chalk.green('Welcome to cliseo!'));



//   console.log(chalk.bold('\n🔑 API Key Setup\n'));
  
//   const { service } = await inquirer.prompt([{
//     type: 'list',
//     name: 'service',
//     message: 'Which service would you like to authenticate?',
//     choices: [
//       { name: 'OpenAI API', value: 'openai' },
//       { name: 'GitHub', value: 'github' },
//       { name: 'Google Search Console', value: 'google' }
//     ]
//   }]);

//   let apiKey: string;
  
//   switch (service) {
//     case 'openai':
//       const { openaiKey } = await inquirer.prompt([{
//         type: 'password',
//         name: 'openaiKey',
//         message: 'Enter your OpenAI API key:',
//         validate: (input: string) => {
//           if (!input.startsWith('sk-')) {
//             return 'OpenAI API keys should start with "sk-"';
//           }
//           return true;
//         }
//       }]);
//       apiKey = openaiKey;
//       break;

//     case 'github':
//       console.log('\nTo create a GitHub token:');
//       console.log('1. Go to https://github.com/settings/tokens');
//       console.log('2. Click "Generate new token"');
//       console.log('3. Select the following scopes:');
//       console.log('   - repo');
//       console.log('   - workflow\n');

//       const { githubToken } = await inquirer.prompt([{
//         type: 'password',
//         name: 'githubToken',
//         message: 'Enter your GitHub token:',
//         validate: (input: string) => {
//           if (!input.match(/^ghp_[a-zA-Z0-9]{36}$/)) {
//             return 'Invalid GitHub token format';
//           }
//           return true;
//         }
//       }]);
//       apiKey = githubToken;
//       break;

//     case 'google':
//       console.log('\nTo get Google Search Console API access:');
//       console.log('1. Go to Google Cloud Console');
//       console.log('2. Create a project or select an existing one');
//       console.log('3. Enable the Search Console API');
//       console.log('4. Create credentials (OAuth 2.0 client ID)\n');

//       const { googleKey } = await inquirer.prompt([{
//         type: 'password',
//         name: 'googleKey',
//         message: 'Enter your Google API key:',
//         validate: (input: string) => input.length > 0
//       }]);
//       apiKey = googleKey;
//       break;

//     default:
//       console.error('Invalid service selected');
//       process.exit(1);
//   }

//   const spinner = ora('Saving API key...').start();
  
//   try {
//     await setApiKey(
//       service === 'openai' ? 'openaiApiKey' :
//       service === 'github' ? 'githubToken' : 'googleApiKey',
//       apiKey
//     );
    
//     spinner.succeed('API key saved successfully!');
    
//     if (service === 'github') {
//       console.log('\nTo create pull requests, run:');
//       console.log(chalk.cyan('cliseo optimize --ai --git-pr'));
//     } else if (service === 'google') {
//       console.log('\nTo connect Search Console, run:');
//       console.log(chalk.cyan('cliseo connect --google-search-console'));
//     }
    
//   } catch (error) {
//     spinner.fail('Failed to save API key');
//     console.error(error);
//     process.exit(1);
//   }
} 